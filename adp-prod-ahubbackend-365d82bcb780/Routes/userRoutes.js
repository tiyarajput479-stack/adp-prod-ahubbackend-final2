
const express = require('express');
const {  adduser, getuser, users, update, deleteuser } = require('../Controllers/userController');
const { verifyUser } = require('../Controllers/PowerBIController');

const userRouter = express.Router();

userRouter.route('/add').post(adduser);
userRouter.route('/verify').get(getuser)
userRouter.route('/allusers').get(users);
userRouter.route('/generateToken').get(verifyUser);

userRouter.route('/update').post(update);
userRouter.route('/delete').get(deleteuser);
module.exports = userRouter;