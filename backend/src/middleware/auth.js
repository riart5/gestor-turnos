import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { HttpError, forbidden } from '../lib/errors.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'No autenticado'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return next(new HttpError(401, 'Usuario no válido'));
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, 'Sesión caducada o no válida'));
  }
}

export function requireSupervisor(req, res, next) {
  if (req.user.role !== 'SUPERVISOR') return next(forbidden('Solo el supervisor de planta puede hacer esto'));
  next();
}
