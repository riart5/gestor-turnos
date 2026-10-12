import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireSupervisor } from '../middleware/auth.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { ABSENCE_TYPES } from '../lib/absenceTypes.js';
import { SHIFT_TYPE_KEYS, describeShift } from '../lib/shiftTypes.js';
import { notify } from '../lib/notify.js';
import { publicUserSelect } from '../lib/publicUser.js';
import { PENDING_STATUSES } from '../services/swapService.js';

const router = Router();

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD');

const listSchema = z.object({
  from: dateStr,
  to: dateStr,
  userId: z.coerce.number().int().optional(),
});

// Cuadrante de la planta entre dos fechas (todos ven el cuadrante para poder proponer cambios)
router.get('/', async (req, res) => {
  const { from, to, userId } = listSchema.parse(req.query);
  const shifts = await prisma.shift.findMany({
    where: { unitId: req.user.unitId, date: { gte: from, lte: to }, ...(userId && { userId }) },
    include: { user: { select: publicUserSelect } },
    orderBy: [{ date: 'asc' }, { type: 'asc' }],
  });
  res.json(shifts);
});

const shiftSchema = z.object({
  userId: z.number().int(),
  date: dateStr,
  type: z.enum(SHIFT_TYPE_KEYS),
  notes: z.string().trim().max(200).optional().nullable(),
});

async function assertUserInUnit(userId, unitId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.unitId !== unitId) throw badRequest('El usuario no pertenece a tu planta');
}

async function assertNotAbsent(userId, date) {
  const absence = await prisma.absence.findUnique({ where: { userId_date: { userId, date } } });
  if (absence) throw conflict(`Ese día está marcado como ${ABSENCE_TYPES[absence.type].label.toLowerCase()}`);
}

async function findUnitShift(id, unitId) {
  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift || shift.unitId !== unitId) throw notFound('Turno no encontrado');
  return shift;
}

// Cualquier cambio manual del supervisor invalida los intercambios pendientes sobre ese turno
function cancelPendingSwapsFor(shiftId) {
  return prisma.swapRequest.updateMany({
    where: {
      status: { in: PENDING_STATUSES },
      OR: [{ offeredShiftId: shiftId }, { requestedShiftId: shiftId }],
    },
    data: { status: 'CANCELLED', resolvedAt: new Date() },
  });
}

router.post('/', requireSupervisor, async (req, res) => {
  const data = shiftSchema.parse(req.body);
  await assertUserInUnit(data.userId, req.user.unitId);
  await assertNotAbsent(data.userId, data.date);
  const shift = await prisma.shift.create({
    data: { ...data, unitId: req.user.unitId },
    include: { user: { select: publicUserSelect } },
  });
  await notify(shift.userId, `Se te ha asignado un turno: ${describeShift(shift)}`, '/');
  res.status(201).json(shift);
});

router.patch('/:id', requireSupervisor, async (req, res) => {
  const id = Number(req.params.id);
  const before = await findUnitShift(id, req.user.unitId);
  const data = shiftSchema.partial().parse(req.body);
  if (data.userId) await assertUserInUnit(data.userId, req.user.unitId);
  if (data.userId || data.date) await assertNotAbsent(data.userId ?? before.userId, data.date ?? before.date);

  const shift = await prisma.shift.update({
    where: { id },
    data,
    include: { user: { select: publicUserSelect } },
  });
  await cancelPendingSwapsFor(id);

  if (before.userId !== shift.userId) {
    await notify(before.userId, `Se te ha retirado el turno de ${describeShift(before)}`, '/');
    await notify(shift.userId, `Se te ha asignado un turno: ${describeShift(shift)}`, '/');
  } else {
    await notify(shift.userId, `Tu turno de ${describeShift(before)} ha cambiado a ${describeShift(shift)}`, '/');
  }
  res.json(shift);
});

router.delete('/:id', requireSupervisor, async (req, res) => {
  const id = Number(req.params.id);
  const shift = await findUnitShift(id, req.user.unitId);
  await prisma.shift.delete({ where: { id } });
  await notify(shift.userId, `Se ha eliminado tu turno de ${describeShift(shift)}`, '/');
  res.status(204).end();
});

export default router;
