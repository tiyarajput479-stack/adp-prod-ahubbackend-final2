const { createToken, verifyToken } = require("../Controllers/TokenControllers");

const express = require('express');

const tokenRouter = express.Router();

// tokenRouter.route('/generateToken').post(createToken);
// // tokenRouter.route('/verifyToken').get(verifyToken)

module.exports = tokenRouter;