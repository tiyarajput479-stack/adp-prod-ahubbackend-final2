
const express = require('express');
const {CreateModel, allModels, UpdateResourceDetailsAndCostTrackerDetails, addProject}  = require('../Controllers/ResourceDetailsController');


const ResourceDetailsRouter = express.Router();

ResourceDetailsRouter.route('/newModel').post(CreateModel);
ResourceDetailsRouter.route('/allModels').get(allModels);
ResourceDetailsRouter.route('/UpdateResourceDetailsAndCostTrackerDetails').put(UpdateResourceDetailsAndCostTrackerDetails);
// ResourceDetailsRouter.route('/allocateProject').post(addProject);
// ResourceDetailsRouter.route('/projects').post(getProjectDetails);




module.exports = ResourceDetailsRouter;

