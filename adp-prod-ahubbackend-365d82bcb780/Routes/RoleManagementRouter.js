
const express = require('express');
const { addRole, getallRoles, updateRoleInfo, deleteRole, getRoleInfo } = require('../Controllers/RoleManagementController');


const RoleRouter = express.Router();

RoleRouter.route('/addRole').post(addRole);
 RoleRouter.route('/getRoleInfo').get(getRoleInfo)
 RoleRouter.route('/allRoles').get(getallRoles);
 RoleRouter.route('/updateRoleInfo').post(updateRoleInfo);
 RoleRouter.route('/deleteRole').get(deleteRole);
module.exports = RoleRouter;