
const express = require('express');
const { addResource, addMultipleResources, updateMultipleResources, allResources, deleteResources, addProject, getProjectDetails, getResourceAudit } = require('../Controllers/NewResourceController');
const { getFilesByRequestId, getFileNamesByRequestId } = require('../Controllers/AttachmentController');


const NewResourceTrackerRouter = express.Router();

NewResourceTrackerRouter.route('/addResource').post(addResource)
NewResourceTrackerRouter.route('/addMultipleResources').post(addMultipleResources)
NewResourceTrackerRouter.route('/updateMultipleResources').post(updateMultipleResources)
NewResourceTrackerRouter.route('/deleteResources').post(deleteResources)
NewResourceTrackerRouter.route('/getAllResources').get(allResources)
NewResourceTrackerRouter.route('/projectAllocation').post(addProject)
NewResourceTrackerRouter.route('/getProjectDetails').post(getProjectDetails)
NewResourceTrackerRouter.route('/getResourceAudit').get(getResourceAudit)

// Attachment download endpoints (migrated from the retired RequestRouter).
NewResourceTrackerRouter.route('/getFile').get(getFilesByRequestId)
NewResourceTrackerRouter.route('/getFileNames').get(getFileNamesByRequestId)

module.exports = NewResourceTrackerRouter;