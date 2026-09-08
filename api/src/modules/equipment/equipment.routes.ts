import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseOrThrow } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/require-auth.js';
import {
  createEquipmentSchema,
  idParamSchema,
  listEquipmentQuerySchema,
  updateEquipmentSchema,
} from './equipment.schemas.js';
import * as service from './equipment.service.js';

export const equipmentRouter: Router = Router();

equipmentRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseOrThrow(listEquipmentQuerySchema, req.query, 'Invalid query parameters');
    res.json({ data: await service.listEquipment(query) });
  }),
);

equipmentRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    res.json({ data: await service.getEquipment(id) });
  }),
);

equipmentRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(createEquipmentSchema, req.body);
    res.status(201).json({ data: await service.createEquipment(input) });
  }),
);

equipmentRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const input = parseOrThrow(updateEquipmentSchema, req.body);
    res.json({ data: await service.updateEquipment(id, input) });
  }),
);

equipmentRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    await service.deleteEquipment(id);
    res.status(204).send();
  }),
);
