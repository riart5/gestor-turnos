import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { signToken } from '../src/middleware/auth.js';

export const app = createApp();

export function dayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function resetDb() {
  await prisma.notification.deleteMany();
  await prisma.swapRequest.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.user.deleteMany();
  await prisma.unit.deleteMany();
}

const passwordHash = bcrypt.hashSync('secreto', 4);

export async function createWorld() {
  const unit = await prisma.unit.create({ data: { name: 'Planta test' } });
  const otherUnit = await prisma.unit.create({ data: { name: 'Otra planta' } });
  const mk = (name, role, unitId = unit.id) =>
    prisma.user.create({
      data: { name, email: `${name.toLowerCase()}@test.com`, role, position: 'Enfermería', passwordHash, unitId },
    });
  return {
    unit,
    supervisor: await mk('Sara', 'SUPERVISOR'),
    ana: await mk('Ana', 'STAFF'),
    luis: await mk('Luis', 'STAFF'),
    outsider: await mk('Pepe', 'STAFF', otherUnit.id),
  };
}

export function shift(user, date, type = 'M') {
  return prisma.shift.create({ data: { userId: user.id, unitId: user.unitId, date, type } });
}

// Cliente HTTP autenticado como `user`
export function as(user) {
  const auth = { Authorization: `Bearer ${signToken(user)}` };
  return {
    get: (url) => request(app).get(url).set(auth),
    post: (url, body) => request(app).post(url).set(auth).send(body),
    patch: (url, body) => request(app).patch(url).set(auth).send(body),
    delete: (url) => request(app).delete(url).set(auth),
  };
}
