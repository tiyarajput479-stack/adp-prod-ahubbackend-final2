const attachmentRepo = require("../repositories/attachmentRepo");
const fs = require('fs')
const fse = require('fs-extra');
const { request } = require("http");
const mime = require('mime-types')



const multiupload = async(req, res) =>{
    try{
        const id = req.query.requestId;
        const files = req.files;
        if(!files || files.length ===0 ){
            return res.status(200).json({err : 'NO files were uploaded'})
        }
        const fileData = []
        for(const file of files){
            fileData.push({
                requestId: id,
                name: file.originalname,
                data: file.buffer.toString('base64')
            })
        }
        console.log(fileData);
        // const datatoForm =  { requestId : id, Attachments: fileData}
        // const newRequest = await new AttachmentModel(datatoForm);
        // const response =  newRequest.save();
        const response = await attachmentRepo.insertMany(fileData);
        res.status(200).json(response);

    } catch(err){
        console.log(err)
        res.status(500).json(err)
    }
}


const getFileNamesByRequestId = async(req, res) =>{
    try{
        const id  = req.query.id;
        const files = await attachmentRepo.find({requestId : id});
        if(files.length ==0){
            return res.status(201).json({data: [], message : "No Attachments"})
        }
        res.status(200).json({data: files, message: "Success"})
    }catch(err){
        res.status(500).json({data: [], message: "Internal Server Error", error: err})
    }
}
const getFilesByRequestId = async(req, res) =>{
    try{
        console.log('entered Download File API')
        console.log(req.query)
        const files = await attachmentRepo.find({ _id: req.query._id});
        if(files.length ===0)
         return res.status(201).json({"data": 'File not found'})
        const mimeType = mime.lookup(files?.[0]?.name)
        console.log(mimeType)
         res.setHeader("Content-Type", mimeType);
         res.setHeader("content-Disposition",`attachment; filename=${files?.[0].name}`);
         res.setHeader("Access-Control-Expose-Headers", "content-Disposition")
         res.setHeader('Content-Security-Policy', "default-src 'self';");
         res.setHeader('X-Content-Type-Options', 'nosniff');
         res.setHeader('X-XSS-Protection', '1; mode=block');
         const file = Buffer.from(files?.[0]?.data, 'base64'); 
        return res.status(200).send(file);
    } catch(err){
        console.log(err)
        res.status(500).json({error: 'Internal Server Error', msg: err})
    }
}
module.exports = {
   
    multiupload,
    getFilesByRequestId,
    getFileNamesByRequestId
}


