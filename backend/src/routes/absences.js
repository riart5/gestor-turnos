import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { ABSENCE_TYPES, ABSENCE_TYPE_KEYS, describeAbsence } from '../lib/absenceTypes.js';
import { describeShift, todayStr } from '../lib/shiftTypes.js';
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

// Ausencias de la planta entre dos fechas (se muestran en el cuadrante)
router.get('/', async (req, res) => {
  const { from, to, userId } = listSchema.parse(req.query);
  const absences = await prisma.absence.findMany({
    where: { unitId: req.user.unitId, date: { gte: from, lte: to }, ...(userId && { userId }) },
    include: { user: { select: publicUserSelect } },
    orderBy: { date: 'asc' },
  });
  res.json(absences);
});

async function computeBalance(userId, year, db = prisma) {
  const used = await db.absence.groupBy({
    by: ['type'],
    where: { userId, date: { gte: `${year}-01-01`, lte: `${year}-12-31` } },
    _count: true,
  });
  const usedBy = Object.fromEntries(used.map((u) => [u.type, u._count]));
  return Object.fromEntries(
    Object.entries(ABSENCE_TYPES).map(([type, { allowance }]) => {
      const n = usedBy[type] ?? 0;
      return [type, { allowance, used: n, remaining: allowance - n }];
    }),
  );
}

const balanceSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

// Días disponibles del usuario en un año
router.get('/balance', async (req, res) => {
  const { year } = balanceSchema.parse(req.query);
  res.json({ year, ...(await computeBalance(req.user.id, year)) });
});

const createSchema = z.object({
  date: dateStr,
  type: z.enum(ABSENCE_TYPE_KEYS),
});

function notifySupervisors(unitId, message, db = prisma) {
  return db.user
    .findMany({ where: { unitId, role: 'SUPERVISOR' } })
    .then((sups) => Promise.all(sups.map((s) => notify(s.id, message, '/cuadrante', db))));
}

// El sanitario se marca un día de vacaciones o asunto propio
router.post('/', async (req, res) => {
  const { date, type } = createSchema.parse(req.body);
  if (date < todayStr()) throw badRequest('No puedes pedir días en fechas pasadas');

  const { absence, releasedShift } = await prisma.$transaction(async (tx) => {
    const balance = await computeBalance(req.user.id, Number(date.slice(0, 4)), tx);
    if (balance[type].remaining <= 0) {
      throw conflict(`Ya has usado los ${ABSENCE_TYPES[type].allowance} días de ${ABSENCE_TYPES[type].label.toLowerCase()} de ${date.slice(0, 4)}`);
    }

    // Si ese día tenía turno, queda libre para que la supervisión lo cubra
    const shift = await tx.shift.findUnique({ where: { userId_date: { userId: req.user.id, date } } });
    if (shift) {
      const pendingSwap = await tx.swapRequest.findFirst({
        where: {
          status: { in: PENDING_STATUSES },
          OR: [{ offeredShiftId: shift.id }, { requestedShiftId: shift.id }],
        },
      });
      if (pendingSwap) throw conflict('Ese turno tiene un intercambio en curso. Cancélalo antes de pedir el día');
      await tx.shift.delete({ where: { id: shift.id } });
    }

    const absence = await tx.absence.create({
      data: { date, type, userId: req.user.id, unitId: req.user.unitId },
      include: { user: { select: publicUserSelect } },
    });
    return { absence, releasedShift: shift };
  });

  const msg = releasedShift
    ? `${req.user.name} se ha cogido ${describeAbsence(absence)}. Su turno de ${describeShift(releasedShift)} queda sin cubrir`
    : `${req.user.name} se ha cogido ${describeAbsence(absence)}`;
  await notifySupervisors(req.user.unitId, msg);
  res.status(201).json(absence);
});

// El sanitario anula un día que se había marcado y lo recupera
router.delete('/:id', async (req, res) => {
  const absence = await prisma.absence.findUnique({ where: { id: Number(req.params.id) } });
  if (!absence) throw notFound('Ausencia no encontrada');
  if (absence.userId !== req.user.id) throw forbidden('Solo puedes anular tus propios días');
  if (absence.date < todayStr()) throw badRequest('No se pueden anular días pasados');

  await prisma.absence.delete({ where: { id: absence.id } });
  await notifySupervisors(req.user.unitId, `${req.user.name} ha anulado ${describeAbsence(absence)}`);
  res.status(204).end();
});

export default router;
