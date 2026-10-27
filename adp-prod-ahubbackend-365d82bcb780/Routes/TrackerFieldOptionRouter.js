const express = require('express');
const {
  listTrackerFieldOptions,
  createTrackerFieldOption,
  updateTrackerFieldOption,
  deleteTrackerFieldOption,
} = require('../Controllers/TrackerFieldOptionController');

const TrackerFieldOptionRouter = express.Router();

TrackerFieldOptionRouter.route('/trackerFieldOptions')
  .get(listTrackerFieldOptions)
  .post(createTrackerFieldOption);

TrackerFieldOptionRouter.route('/trackerFieldOptions/:id')
  .put(updateTrackerFieldOption)
  .delete(deleteTrackerFieldOption);

module.exports = TrackerFieldOptionRouter;
