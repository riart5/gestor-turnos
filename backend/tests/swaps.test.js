import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { as, createWorld, dayOffset, resetDb, shift } from './helpers.js';

let w;
beforeEach(async () => {
  await resetDb();
  w = await createWorld();
});

async function fullFlow(body, requester = w.ana, target = w.luis) {
  const created = await as(requester).post('/api/swaps', body);
  expect(created.status).toBe(201);
  const id = created.body.id;
  expect((await as(target).post(`/api/swaps/${id}/accept`)).body.status).toBe('PENDING_SUPERVISOR');
  const approved = await as(w.supervisor).post(`/api/swaps/${id}/approve`);
  expect(approved.status).toBe(200);
  expect(approved.body.status).toBe('APPROVED');
  return id;
}

describe('flujo de intercambio', () => {
  it('intercambia dos turnos tras aceptación del compañero y aprobación del supervisor', async () => {
    const a = await shift(w.ana, dayOffset(2), 'M');
    const l = await shift(w.luis, dayOffset(4), 'N');

    await fullFlow({ offeredShiftId: a.id, targetId: w.luis.id, requestedShiftId: l.id });

    expect((await prisma.shift.findUnique({ where: { id: a.id } })).userId).toBe(w.luis.id);
    expect((await prisma.shift.findUnique({ where: { id: l.id } })).userId).toBe(w.ana.id);
  });

  it('intercambia turnos del mismo día (mañana por noche)', async () => {
    const date = dayOffset(2);
    const a = await shift(w.ana, date, 'M');
    const l = await shift(w.luis, date, 'N');

    await fullFlow({ offeredShiftId: a.id, targetId: w.luis.id, requestedShiftId: l.id });

    const ana = await prisma.shift.findFirst({ where: { userId: w.ana.id, date } });
    const luis = await prisma.shift.findFirst({ where: { userId: w.luis.id, date } });
    expect(ana.type).toBe('N');
    expect(luis.type).toBe('M');
  });

  it('permite ceder un turno sin recibir otro a cambio', async () => {
    const a = await shift(w.ana, dayOffset(2));
    await fullFlow({ offeredShiftId: a.id, targetId: w.luis.id });
    expect((await prisma.shift.findUnique({ where: { id: a.id } })).userId).toBe(w.luis.id);
  });

  it('el supervisor no puede aprobar antes de que acepte el compañero', async () => {
    const a = await shift(w.ana, dayOffset(2));
    const { body } = await as(w.ana).post('/api/swaps', { offeredShiftId: a.id, targetId: w.luis.id });
    const res = await as(w.supervisor).post(`/api/swaps/${body.id}/approve`);
    expect(res.status).toBe(409);
  });

  it('el rechazo del compañero cierra la solicitud y no toca los turnos', async () => {
    const a = await shift(w.ana, dayOffset(2));
    const { body } = await as(w.ana).post('/api/swaps', { offeredShiftId: a.id, targetId: w.luis.id });
    const res = await as(w.luis).post(`/api/swaps/${body.id}/reject`);
    expect(res.body.status).toBe('REJECTED');
    expect((await prisma.shift.findUnique({ where: { id: a.id } })).userId).toBe(w.ana.id);
  });
});

describe('validaciones de intercambio', () => {
  it('no se puede ofrecer un turno ajeno', async () => {
    const l = await shift(w.luis, dayOffset(2));
    const res = await as(w.ana).post('/api/swaps', { offeredShiftId: l.id, targetId: w.luis.id });
    expect(res.status).toBe(403);
  });

  it('no se pueden intercambiar turnos pasados', async () => {
    const a = await shift(w.ana, dayOffset(-1));
    const res = await as(w.ana).post('/api/swaps', { offeredShiftId: a.id, targetId: w.luis.id });
    expect(res.status).toBe(400);
  });

  it('no se puede intercambiar con alguien de otra planta', async () => {
    const a = await shift(w.ana, dayOffset(2));
    const res = await as(w.ana).post('/api/swaps', { offeredShiftId: a.id, targetId: w.outsider.id });
    expect(res.status).toBe(400);
  });

  it('detecta que el compañero ya trabaja ese día', async () => {
    const date = dayOffset(2);
    const a = await shift(w.ana, date, 'M');
    await shift(w.luis, date, 'T');
    const res = await as(w.ana).post('/api/swaps', { offeredShiftId: a.id, targetId: w.luis.id });
    expect(res.status).toBe(409);
  });

  it('no permite dos solicitudes pendientes sobre el mismo turno', async () => {
    const a = await shift(w.ana, dayOffset(2));
    await as(w.ana).post('/api/swaps', { offeredShiftId: a.id, targetId: w.luis.id });
    const res = await as(w.ana).post('/api/swaps', { offeredShiftId: a.id, targetId: w.luis.id });
    expect(res.status).toBe(409);
  });

  it('si el supervisor modifica el turno, los intercambios pendientes se cancelan', async () => {
    const a = await shift(w.ana, dayOffset(2), 'M');
    const { body } = await as(w.ana).post('/api/swaps', { offeredShiftId: a.id, targetId: w.luis.id });
    await as(w.supervisor).patch(`/api/shifts/${a.id}`, { type: 'T' });
    const swap = await prisma.swapRequest.findUnique({ where: { id: body.id } });
    expect(swap.status).toBe('CANCELLED');
  });

  it('un sanitario solo ve sus propias solicitudes', async () => {
    const a = await shift(w.ana, dayOffset(2));
    await as(w.ana).post('/api/swaps', { offeredShiftId: a.id, targetId: w.luis.id });
    const third = await prisma.user.create({
      data: { name: 'Eva', email: 'eva@test.com', role: 'STAFF', position: 'TCAE', passwordHash: 'x', unitId: w.unit.id },
    });
    expect((await as(third).get('/api/swaps')).body).toHaveLength(0);
    expect((await as(w.supervisor).get('/api/swaps')).body).toHaveLength(1);
  });
});
