import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireSupervisor } from '../middleware/auth.js';
import { publicUserSelect } from '../lib/publicUser.js';

const router = Router();

// Compañeros de la planta del usuario
router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({
    where: { unitId: req.user.unitId },
    select: publicUserSelect,
    orderBy: [{ role: 'desc' }, { name: 'asc' }],
  });
  res.json(users);
});

const createUserSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  position: z.string().trim().min(2),
});

// El supervisor da de alta personal en su planta
router.post('/', requireSupervisor, async (req, res) => {
  const data = createUserSchema.parse(req.body);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      position: data.position,
      passwordHash: await bcrypt.hash(data.password, 10),
      role: 'STAFF',
      unitId: req.user.unitId,
    },
    select: publicUserSelect,
  });
  res.status(201).json(user);
});

export default router;
