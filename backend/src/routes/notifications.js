import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
});

router.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  res.status(204).end();
});

router.post('/:id/read', async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: Number(req.params.id), userId: req.user.id },
    data: { read: true },
  });
  res.status(204).end();
});

export default router;
