const express = require('express');
const multer = require('multer')
// const upload = multer({dest: 'uploads/'})
const storage = multer.memoryStorage();
const upload = multer({storage : storage})
const { uploadFile, multiupload } = require('../Controllers/AttachmentController');

const AttachmentRouter = express.Router();

// AttachmentRouter.route('/upload').post(upload.single('file'),uploadFile);
AttachmentRouter.route('/multiupload').post(upload.array('files'), multiupload)

module.exports= AttachmentRouter