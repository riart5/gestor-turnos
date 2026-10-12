import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { publicUser } from '../lib/publicUser.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { unit: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Email o contraseña incorrectos');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const unit = await prisma.unit.findUnique({ where: { id: req.user.unitId } });
  res.json({ user: { ...publicUser(req.user), unit } });
});

export default router;
