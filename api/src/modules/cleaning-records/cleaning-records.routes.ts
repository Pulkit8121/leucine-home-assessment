import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseOrThrow } from '../../lib/validate.js';
import { currentUser, requireAuth } from '../../middleware/require-auth.js';
import { getAuditHistory } from '../audit/audit.service.js';
import {
  auditHistoryQuerySchema,
  createCleaningRecordSchema,
  equipmentIdParamSchema,
  listCleaningRecordsQuerySchema,
  recordIdParamSchema,
  updateCleaningRecordSchema,
} from './cleaning-records.schemas.js';
import * as service from './cleaning-records.service.js';

/**
 * Routes are split in two because their URL shapes differ:
 *  - collection routes are nested under /equipment/:equipmentId/cleaning-records
 *  - a single record is addressed directly at /cleaning-records/:recordId, since its id
 *    is globally unique and repeating the parent in the URL adds nothing.
 */
export const equipmentCleaningRecordsRouter: Router = Router({ mergeParams: true });

equipmentCleaningRecordsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { equipmentId } = parseOrThrow(equipmentIdParamSchema, req.params);
    const query = parseOrThrow(
      listCleaningRecordsQuerySchema,
      req.query,
      'Invalid query parameters',
    );
    res.json(await service.listCleaningRecords(equipmentId, query));
  }),
);

equipmentCleaningRecordsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { equipmentId } = parseOrThrow(equipmentIdParamSchema, req.params);
    const input = parseOrThrow(createCleaningRecordSchema, req.body);
    const record = await service.createCleaningRecord(equipmentId, input, currentUser(req));
    res.status(201).json({ data: record });
  }),
);

export const cleaningRecordsRouter: Router = Router();

cleaningRecordsRouter.get(
  '/:recordId',
  asyncHandler(async (req, res) => {
    const { recordId } = parseOrThrow(recordIdParamSchema, req.params);
    res.json({ data: await service.getCleaningRecord(recordId) });
  }),
);

cleaningRecordsRouter.patch(
  '/:recordId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { recordId } = parseOrThrow(recordIdParamSchema, req.params);
    const input = parseOrThrow(updateCleaningRecordSchema, req.body);
    const record = await service.updateCleaningRecord(recordId, input, currentUser(req));
    res.json({ data: record });
  }),
);

cleaningRecordsRouter.get(
  '/:recordId/audit',
  asyncHandler(async (req, res) => {
    const { recordId } = parseOrThrow(recordIdParamSchema, req.params);
    const query = parseOrThrow(auditHistoryQuerySchema, req.query, 'Invalid query parameters');
    res.json(await getAuditHistory(recordId, query));
  }),
);
