import { Router } from 'express';
import { z } from 'zod';
import { requireSupervisor } from '../middleware/auth.js';
import {
  cancelSwap,
  createSwap,
  listSwaps,
  resolveAsSupervisor,
  respondAsPeer,
} from '../services/swapService.js';

const router = Router();

const createSchema = z.object({
  offeredShiftId: z.number().int(),
  targetId: z.number().int(),
  requestedShiftId: z.number().int().nullable().optional(),
  message: z.string().trim().max(300).optional(),
});

const swapId = (req) => Number(req.params.id);

router.get('/', async (req, res) => {
  res.json(await listSwaps(req.user));
});

router.post('/', async (req, res) => {
  const swap = await createSwap(req.user, createSchema.parse(req.body));
  res.status(201).json(swap);
});

router.post('/:id/accept', async (req, res) => {
  res.json(await respondAsPeer(req.user, swapId(req), true));
});

router.post('/:id/reject', async (req, res) => {
  res.json(await respondAsPeer(req.user, swapId(req), false));
});

router.post('/:id/cancel', async (req, res) => {
  res.json(await cancelSwap(req.user, swapId(req)));
});

router.post('/:id/approve', requireSupervisor, async (req, res) => {
  res.json(await resolveAsSupervisor(req.user, swapId(req), true));
});

router.post('/:id/deny', requireSupervisor, async (req, res) => {
  res.json(await resolveAsSupervisor(req.user, swapId(req), false));
});

export default router;
