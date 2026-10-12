import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { as, createWorld, dayOffset, resetDb, shift } from './helpers.js';

let w;
beforeEach(async () => {
  await resetDb();
  w = await createWorld();
});

// Fechas futuras del año que viene, para no depender del día en que se ejecuten los tests
const nextYear = new Date().getFullYear() + 1;
const dayOfNextYear = (n) => {
  const d = new Date(nextYear, 0, 1 + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

describe('vacaciones y asuntos propios', () => {
  it('el sanitario se marca un día y se descuenta de su saldo anual', async () => {
    const res = await as(w.ana).post('/api/absences', { date: dayOfNextYear(10), type: 'VACATION' });
    expect(res.status).toBe(201);

    const balance = await as(w.ana).get(`/api/absences/balance?year=${nextYear}`);
    expect(balance.body.VACATION).toEqual({ allowance: 23, used: 1, remaining: 22 });
    expect(balance.body.PERSONAL).toEqual({ allowance: 6, used: 0, remaining: 6 });
  });

  it('no permite pasar de 6 asuntos propios al año', async () => {
    for (let i = 0; i < 6; i++) {
      expect((await as(w.ana).post('/api/absences', { date: dayOfNextYear(i), type: 'PERSONAL' })).status).toBe(201);
    }
    const res = await as(w.ana).post('/api/absences', { date: dayOfNextYear(6), type: 'PERSONAL' });
    expect(res.status).toBe(409);
  });

  it('no permite pasar de 23 días de vacaciones al año', async () => {
    await prisma.absence.createMany({
      data: Array.from({ length: 23 }, (_, i) => ({
        date: dayOfNextYear(i),
        type: 'VACATION',
        userId: w.ana.id,
        unitId: w.ana.unitId,
      })),
    });
    const res = await as(w.ana).post('/api/absences', { date: dayOfNextYear(40), type: 'VACATION' });
    expect(res.status).toBe(409);
    // Los asuntos propios tienen su propio cupo
    expect((await as(w.ana).post('/api/absences', { date: dayOfNextYear(41), type: 'PERSONAL' })).status).toBe(201);
  });

  it('no permite fechas pasadas ni dos ausencias el mismo día', async () => {
    expect((await as(w.ana).post('/api/absences', { date: dayOffset(-1), type: 'VACATION' })).status).toBe(400);
    expect((await as(w.ana).post('/api/absences', { date: dayOffset(3), type: 'VACATION' })).status).toBe(201);
    expect((await as(w.ana).post('/api/absences', { date: dayOffset(3), type: 'PERSONAL' })).status).toBe(409);
  });

  it('libera el turno de ese día y avisa a la supervisión', async () => {
    const s = await shift(w.ana, dayOffset(5), 'T');
    expect((await as(w.ana).post('/api/absences', { date: dayOffset(5), type: 'VACATION' })).status).toBe(201);

    expect(await prisma.shift.findUnique({ where: { id: s.id } })).toBeNull();
    const notes = await prisma.notification.findMany({ where: { userId: w.supervisor.id } });
    expect(notes.some((n) => n.message.includes('sin cubrir'))).toBe(true);
  });

  it('no deja pedir el día si el turno tiene un intercambio en curso', async () => {
    const s = await shift(w.ana, dayOffset(5));
    await as(w.ana).post('/api/swaps', { offeredShiftId: s.id, targetId: w.luis.id });
    const res = await as(w.ana).post('/api/absences', { date: dayOffset(5), type: 'VACATION' });
    expect(res.status).toBe(409);
  });

  it('al anular el día se recupera en el saldo; solo el propio sanitario puede anularlo', async () => {
    const { body } = await as(w.ana).post('/api/absences', { date: dayOfNextYear(3), type: 'PERSONAL' });
    expect((await as(w.luis).delete(`/api/absences/${body.id}`)).status).toBe(403);
    expect((await as(w.ana).delete(`/api/absences/${body.id}`)).status).toBe(204);
    const balance = await as(w.ana).get(`/api/absences/balance?year=${nextYear}`);
    expect(balance.body.PERSONAL.remaining).toBe(6);
  });

  it('el supervisor no puede asignar un turno en un día de vacaciones', async () => {
    await as(w.ana).post('/api/absences', { date: dayOffset(4), type: 'VACATION' });
    const res = await as(w.supervisor).post('/api/shifts', { userId: w.ana.id, date: dayOffset(4), type: 'M' });
    expect(res.status).toBe(409);
  });

  it('no se puede ceder un turno a un compañero que ese día está de vacaciones', async () => {
    await as(w.luis).post('/api/absences', { date: dayOffset(4), type: 'VACATION' });
    const s = await shift(w.ana, dayOffset(4));
    const res = await as(w.ana).post('/api/swaps', { offeredShiftId: s.id, targetId: w.luis.id });
    expect(res.status).toBe(409);
  });

  it('el cuadrante muestra solo las ausencias de la propia planta', async () => {
    await as(w.ana).post('/api/absences', { date: dayOffset(4), type: 'VACATION' });
    await as(w.outsider).post('/api/absences', { date: dayOffset(4), type: 'VACATION' });
    const res = await as(w.luis).get(`/api/absences?from=${dayOffset(0)}&to=${dayOffset(10)}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].user.name).toBe('Ana');
  });
});
