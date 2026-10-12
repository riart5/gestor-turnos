import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, as, createWorld, dayOffset, resetDb } from './helpers.js';

let w;
beforeEach(async () => {
  await resetDb();
  w = await createWorld();
});

describe('auth', () => {
  it('permite login con credenciales correctas y no expone el hash', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ana@test.com', password: 'secreto' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rechaza contraseña incorrecta', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ana@test.com', password: 'mal' });
    expect(res.status).toBe(401);
  });

  it('exige token en rutas protegidas', async () => {
    const res = await request(app).get('/api/shifts?from=2026-01-01&to=2026-01-31');
    expect(res.status).toBe(401);
  });
});

describe('permisos sobre turnos', () => {
  it('un sanitario no puede crear turnos', async () => {
    const res = await as(w.ana).post('/api/shifts', { userId: w.ana.id, date: dayOffset(3), type: 'M' });
    expect(res.status).toBe(403);
  });

  it('el supervisor crea turnos y notifica al sanitario', async () => {
    const res = await as(w.supervisor).post('/api/shifts', { userId: w.ana.id, date: dayOffset(3), type: 'N' });
    expect(res.status).toBe(201);
    const notifs = await as(w.ana).get('/api/notifications');
    expect(notifs.body[0].message).toMatch(/Noche/);
  });

  it('no permite dos turnos el mismo día a la misma persona', async () => {
    const date = dayOffset(3);
    await as(w.supervisor).post('/api/shifts', { userId: w.ana.id, date, type: 'M' });
    const res = await as(w.supervisor).post('/api/shifts', { userId: w.ana.id, date, type: 'T' });
    expect(res.status).toBe(409);
  });

  it('el supervisor no puede asignar turnos a personal de otra planta', async () => {
    const res = await as(w.supervisor).post('/api/shifts', { userId: w.outsider.id, date: dayOffset(3), type: 'M' });
    expect(res.status).toBe(400);
  });
});
