const express = require('express');
const {
  listPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
} = require('../Controllers/ProgramTrackerController');

const ProgramTrackerRouter = express.Router();

ProgramTrackerRouter.route('/programTracker').get(listPrograms);
ProgramTrackerRouter.route('/programTracker').post(createProgram);
ProgramTrackerRouter.route('/programTracker/:id').put(updateProgram);
ProgramTrackerRouter.route('/programTracker/:id').delete(deleteProgram);

module.exports = ProgramTrackerRouter;
