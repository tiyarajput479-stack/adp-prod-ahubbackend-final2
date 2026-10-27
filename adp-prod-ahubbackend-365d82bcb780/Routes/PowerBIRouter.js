const express = require('express');
const { DigiTechResoureAllocation, TechonologywisemonthlyResourceAllocation, AllRequestsforBI, ResourceAllocationAPI, ExecutiveSummaryAPI, InitiativewiseResourcePI, verifyUser, monthlyResourceAllocation, monthlyResourceAllocationnew, AllRequestsforBInew } = require('../Controllers/PowerBIController');

const PowerBIRouter = express.Router();



PowerBIRouter.route('/getExecutiveSummaryDetails').get(ExecutiveSummaryAPI);
PowerBIRouter.route('/getResourceDetails').get(ResourceAllocationAPI);
PowerBIRouter.route('/getAllRequests').get(AllRequestsforBI);
PowerBIRouter.route('/getAllRequestsNew').get(AllRequestsforBInew);
PowerBIRouter.route('/generateToken').get(verifyUser);
PowerBIRouter.route('/getmonthlyResourceAllocation').get(monthlyResourceAllocation);
PowerBIRouter.route('/getmonthlyResourceAllocationnew').get(monthlyResourceAllocationnew);
PowerBIRouter.route('/getInitiativewise').get(InitiativewiseResourcePI);

module.exports = PowerBIRouter;