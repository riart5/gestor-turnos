import { prisma } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { describeShift, todayStr } from '../lib/shiftTypes.js';
import { notify } from '../lib/notify.js';
import { publicUserSelect } from '../lib/publicUser.js';

export const PENDING_STATUSES = ['PENDING_PEER', 'PENDING_SUPERVISOR'];

const swapInclude = {
  requester: { select: publicUserSelect },
  target: { select: publicUserSelect },
  offeredShift: true,
  requestedShift: true,
};

async function getSwapOrThrow(id, db = prisma) {
  const swap = await db.swapRequest.findUnique({ where: { id }, include: swapInclude });
  if (!swap) throw notFound('Solicitud de intercambio no encontrada');
  return swap;
}

/**
 * Comprueba que, tras el intercambio, nadie acaba con dos turnos el mismo día.
 * Se ejecuta al crear la solicitud y otra vez al aprobarla, porque el
 * cuadrante puede haber cambiado entre medias.
 */
async function assertNoConflicts({ requesterId, targetId, offeredShift, requestedShift }, db = prisma) {
  const targetBusy = await db.shift.findFirst({
    where: {
      userId: targetId,
      date: offeredShift.date,
      ...(requestedShift && { id: { not: requestedShift.id } }),
    },
  });
  if (targetBusy) {
    throw conflict(`El compañero ya tiene un turno el ${offeredShift.date}`);
  }
  if (requestedShift) {
    const requesterBusy = await db.shift.findFirst({
      where: { userId: requesterId, date: requestedShift.date, id: { not: offeredShift.id } },
    });
    if (requesterBusy) {
      throw conflict(`Ya tienes un turno el ${requestedShift.date}`);
    }
  }
}

export async function createSwap(user, { offeredShiftId, targetId, requestedShiftId, message }) {
  const today = todayStr();

  const offeredShift = await prisma.shift.findUnique({ where: { id: offeredShiftId } });
  if (!offeredShift) throw notFound('El turno que ofreces no existe');
  if (offeredShift.userId !== user.id) throw forbidden('Solo puedes ofrecer tus propios turnos');
  if (offeredShift.date < today) throw badRequest('No se pueden intercambiar turnos pasados');

  if (targetId === user.id) throw badRequest('No puedes intercambiar un turno contigo mismo');
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target || target.unitId !== user.unitId) throw badRequest('El compañero debe pertenecer a tu planta');

  let requestedShift = null;
  if (requestedShiftId != null) {
    requestedShift = await prisma.shift.findUnique({ where: { id: requestedShiftId } });
    if (!requestedShift) throw notFound('El turno solicitado no existe');
    if (requestedShift.userId !== targetId) throw badRequest('El turno solicitado no pertenece a ese compañero');
    if (requestedShift.date < today) throw badRequest('No se pueden intercambiar turnos pasados');
  }

  const duplicate = await prisma.swapRequest.findFirst({
    where: { offeredShiftId, status: { in: PENDING_STATUSES } },
  });
  if (duplicate) throw conflict('Ya hay una solicitud pendiente para ese turno');

  await assertNoConflicts({ requesterId: user.id, targetId, offeredShift, requestedShift });

  const swap = await prisma.swapRequest.create({
    data: { requesterId: user.id, targetId, offeredShiftId, requestedShiftId: requestedShift?.id ?? null, message },
    include: swapInclude,
  });

  const what = requestedShift
    ? `cambiar su ${describeShift(offeredShift)} por tu ${describeShift(requestedShift)}`
    : `cederte su ${describeShift(offeredShift)}`;
  await notify(targetId, `${user.name} quiere ${what}`, '/intercambios');

  return swap;
}

export async function respondAsPeer(user, swapId, accept) {
  const swap = await getSwapOrThrow(swapId);
  if (swap.targetId !== user.id) throw forbidden('Esta solicitud no va dirigida a ti');
  if (swap.status !== 'PENDING_PEER') throw conflict('Esta solicitud ya no está pendiente de tu respuesta');

  if (!accept) {
    const updated = await prisma.swapRequest.update({
      where: { id: swapId },
      data: { status: 'REJECTED', resolvedById: user.id, resolvedAt: new Date() },
      include: swapInclude,
    });
    await notify(swap.requesterId, `${user.name} ha rechazado tu propuesta de intercambio`, '/intercambios');
    return updated;
  }

  await assertNoConflicts(swap);
  const updated = await prisma.swapRequest.update({
    where: { id: swapId },
    data: { status: 'PENDING_SUPERVISOR' },
    include: swapInclude,
  });

  await notify(swap.requesterId, `${user.name} ha aceptado el intercambio. Falta la aprobación del supervisor`, '/intercambios');
  const supervisors = await prisma.user.findMany({ where: { unitId: user.unitId, role: 'SUPERVISOR' } });
  await Promise.all(
    supervisors.map((s) =>
      notify(s.id, `Intercambio entre ${swap.requester.name} y ${user.name} pendiente de aprobación`, '/intercambios'),
    ),
  );
  return updated;
}

export async function resolveAsSupervisor(supervisor, swapId, approve) {
  const swap = await getSwapOrThrow(swapId);
  if (swap.requester.unitId !== supervisor.unitId) throw forbidden('Esta solicitud no es de tu planta');
  if (swap.status !== 'PENDING_SUPERVISOR') throw conflict('Esta solicitud no está pendiente de aprobación');

  if (!approve) {
    const updated = await prisma.swapRequest.update({
      where: { id: swapId },
      data: { status: 'REJECTED', resolvedById: supervisor.id, resolvedAt: new Date() },
      include: swapInclude,
    });
    const msg = `El supervisor ha rechazado el intercambio entre ${swap.requester.name} y ${swap.target.name}`;
    await Promise.all([notify(swap.requesterId, msg, '/intercambios'), notify(swap.targetId, msg, '/intercambios')]);
    return updated;
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Revalidamos dentro de la transacción: el cuadrante pudo cambiar desde que se creó la solicitud
    const offered = await tx.shift.findUnique({ where: { id: swap.offeredShiftId } });
    const requested = swap.requestedShiftId ? await tx.shift.findUnique({ where: { id: swap.requestedShiftId } }) : null;
    if (offered.userId !== swap.requesterId || (requested && requested.userId !== swap.targetId)) {
      throw conflict('Los turnos han cambiado desde que se creó la solicitud');
    }
    await assertNoConflicts({ ...swap, offeredShift: offered, requestedShift: requested }, tx);

    if (requested) {
      // Si ambos turnos son el mismo día, la restricción única (userId, date) fallaría
      // a mitad del intercambio; movemos temporalmente la fecha de uno de ellos.
      await tx.shift.update({ where: { id: requested.id }, data: { date: `tmp-${requested.id}` } });
      await tx.shift.update({ where: { id: offered.id }, data: { userId: swap.targetId } });
      await tx.shift.update({ where: { id: requested.id }, data: { userId: swap.requesterId, date: requested.date } });
    } else {
      await tx.shift.update({ where: { id: offered.id }, data: { userId: swap.targetId } });
    }

    // Otras solicitudes pendientes sobre estos turnos ya no tienen sentido
    const shiftIds = [offered.id, requested?.id].filter(Boolean);
    await tx.swapRequest.updateMany({
      where: {
        id: { not: swap.id },
        status: { in: PENDING_STATUSES },
        OR: [{ offeredShiftId: { in: shiftIds } }, { requestedShiftId: { in: shiftIds } }],
      },
      data: { status: 'CANCELLED', resolvedAt: new Date() },
    });

    return tx.swapRequest.update({
      where: { id: swapId },
      data: { status: 'APPROVED', resolvedById: supervisor.id, resolvedAt: new Date() },
      include: swapInclude,
    });
  });

  const msg = `Intercambio aprobado: ${swap.requester.name} ↔ ${swap.target.name}. Tu calendario ya está actualizado`;
  await Promise.all([notify(swap.requesterId, msg, '/'), notify(swap.targetId, msg, '/')]);
  return updated;
}

export async function cancelSwap(user, swapId) {
  const swap = await getSwapOrThrow(swapId);
  if (swap.requesterId !== user.id) throw forbidden('Solo quien creó la solicitud puede cancelarla');
  if (!PENDING_STATUSES.includes(swap.status)) throw conflict('La solicitud ya está cerrada');

  const updated = await prisma.swapRequest.update({
    where: { id: swapId },
    data: { status: 'CANCELLED', resolvedAt: new Date() },
    include: swapInclude,
  });
  await notify(swap.targetId, `${user.name} ha cancelado su propuesta de intercambio`, '/intercambios');
  return updated;
}

export function listSwaps(user) {
  const where =
    user.role === 'SUPERVISOR'
      ? { requester: { unitId: user.unitId } }
      : { OR: [{ requesterId: user.id }, { targetId: user.id }] };
  return prisma.swapRequest.findMany({ where, include: swapInclude, orderBy: { createdAt: 'desc' } });
}
