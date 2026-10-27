const express = require('express');
const {
  listAdminResource,
  createAdminResourceItem,
  updateAdminResourceItem,
  deleteAdminResourceItem,
} = require('../Controllers/IntakeAdminController');

const IntakeAdminRouter = express.Router();

IntakeAdminRouter.route('/:resource').get(listAdminResource).post(createAdminResourceItem);
IntakeAdminRouter.route('/:resource/:id').put(updateAdminResourceItem).delete(deleteAdminResourceItem);

module.exports = IntakeAdminRouter;
