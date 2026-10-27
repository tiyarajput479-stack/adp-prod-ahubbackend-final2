const express = require('express');
const {
  listRequests,
  createRequest,
  updateRequest,
  applyRequestAction,
  applyOpsAction,
  backfillSharePointColumns,
  getDashboardMetrics,
  getPipeline,
  getRequestAttachments,
} = require('../Controllers/IntakeController');
const IntakeAdminRouter = require('./IntakeAdminRouter');

const IntakeRouter = express.Router();

IntakeRouter.route('/requests').get(listRequests);
IntakeRouter.route('/requests').post(createRequest);
IntakeRouter.route('/requests/backfill-sharepoint-columns').post(backfillSharePointColumns);
IntakeRouter.route('/requests/:requestId/attachments').get(getRequestAttachments);
IntakeRouter.route('/requests/:oppId').patch(updateRequest);
IntakeRouter.route('/requests/:oppId/action').post(applyRequestAction);
IntakeRouter.route('/requests/:oppId/ops-action').post(applyOpsAction);
IntakeRouter.route('/dashboard').get(getDashboardMetrics);
IntakeRouter.route('/pipeline').get(getPipeline);
IntakeRouter.use('/admin', IntakeAdminRouter);

module.exports = IntakeRouter;
