const { ReadStream } = require("fs-extra");
const resourceRepo = require("../repositories/resourceTrackerRepo");
const resourceAuditRepo = require("../repositories/resourceAuditRepo");
const { withTransaction } = require("../helpers/sqlDb");
const { getActor, diffResource, recordAudit } = require("../helpers/resourceAudit");


const addResource = async (req, res) => {
    try {
        const resourcetoAdd = req.body;
        console.log(resourcetoAdd)
        const isResourceAlreayExists = await resourceRepo.findByName(resourcetoAdd.Name);
        console.log(isResourceAlreayExists)
        if (isResourceAlreayExists.length >0) {
            return res.status(201).send({ data: isResourceAlreayExists, message: 'user Already exists', status: 'Failure' })
        }
        const [response] = await withTransaction((tx) => resourceRepo.insertDocs([resourcetoAdd], tx));
        await recordAudit({
            action: 'create',
            resourceId: String(response?._id || ''),
            resourceName: String(response?.Name || resourcetoAdd?.Name || ''),
            projectProduct: String(response?.['Project/Product'] || resourcetoAdd?.['Project/Product'] || ''),
            actor: getActor(req),
            snapshot: resourcetoAdd,
            correlationId: req.correlationId || '',
        });
        res.status(200).send({ data: response, message: 'User added successfully', status: 'success' });
    }
    catch (err) {
        res.status(500).send({ data: null, message: err.message, status: 'Failure' })
    }
}

const addMultipleResources = async (req, res) => {
    try {
        const resourcesToAdd = req.body;
        if (!Array.isArray(resourcesToAdd)) {
            return res.status(400).send({data: null, message: 'Invalid payload: expected an array', status: 'error'});
        }
        
        if(resourcesToAdd.length ==0){
            return res.status(200).send({data:null, message: 'Empty payload', status: 'success'})
        }
        const existingResources = await resourceRepo.findAll();
        const placeholderNames = ['VACANT', 'OFFERED', 'NA', ''];
        let found = false
        for(const existing of existingResources){
            for(let i=0; i<resourcesToAdd.length; i++){
                const newName = resourcesToAdd[i]?.Name?.toString()?.trim()?.toUpperCase();
                if(placeholderNames.includes(newName)) continue;
                if(existing?.Name?.toString()?.trim()?.toUpperCase() === newName && existing?.['Project/Product'] === resourcesToAdd[i]?.['Project/Product'] ){
                    found = true;
                    return res.status(400).send({data: null , message: 'Resource already exists', status: 'Failure'});
                }
            }
            
        }
        if(!found){
        const response = await withTransaction((tx) => resourceRepo.insertDocs(resourcesToAdd, tx));
        const actor = getActor(req);
        await recordAudit(
            (Array.isArray(response) ? response : []).map((doc) => ({
                action: 'create',
                resourceId: String(doc?._id || ''),
                resourceName: String(doc?.Name || ''),
                projectProduct: String(doc?.['Project/Product'] || ''),
                actor,
                snapshot: doc,
                correlationId: req.correlationId || '',
            }))
        );
        res.status(200).send({ data: response, message: 'Users added successfully', status: 'success' });
        }
    }
    catch (err) {
        console.log(err)
        res.status(500).send({ data: null, message: err.message, status: 'Failure' })
    }
}

const deleteResources = async (req, res) => {
    try {

        const body = req.body;
        if (!Array.isArray(body)) {
            return res.status(400).send({data: null, message: 'Invalid payload: expected an array', status: 'error'});
        }
        if(body.length ===0){
            return res.status(200).send({data:null, message: 'Empty payload', status: 'success'})
        }
        const ids = body.map(request => request?._id)
        console.log(JSON.stringify(ids))

        const deletedCount = await resourceRepo.deleteByIds(ids);
        const response = { acknowledged: true, insertedCount: 0, matchedCount: 0, modifiedCount: 0, deletedCount, upsertedCount: 0 };
        if(response.matchedCount === body.length && response.deletedCount !== body.length) {
           return res.status(400).send({ data: response, message: ` Deleted ${response.deletedCount} of ${body.length} rows`, status: 'Failure' })
        }
            const actor = getActor(req);
            await recordAudit(
                body.map((row) => ({
                    action: 'delete',
                    resourceId: String(row?._id || ''),
                    resourceName: String(row?.Name || ''),
                    projectProduct: String(row?.['Project/Product'] || ''),
                    actor,
                    snapshot: row,
                    correlationId: req.correlationId || '',
                }))
            );
            res.status(200).send({ data: response, message: "Updated Successfully!", status: 'Success' })
        

    } catch (err) {
        console.log(err)
        res.status(500).send({ data: null, message: err.message, status: 'Failure' })
    }
}

const allResources = async (req, res) => {
    try {
        const allResources = await resourceRepo.findAll();
        if (allResources.length === 0) {
            return res.status(204).send({ data: null, message: 'No Resources found', status: 'Success' })
        }
        res.status(200).send({ data: allResources, message: 'All Resources were fetched', status: 'Success' });
    }
    catch (err) {
        res.status(500).send({ data: null, message: err.message, status: 'Failure' })
    }
}

const updateMultipleResources = async (req, res) => {
    try {
        const body = req.body;
        if (!Array.isArray(body)) {
            return res.status(400).send({data: null, message: 'Invalid payload: expected an array', status: 'error'});
        }
        if(body.length ===0){
            return res.status(200).send({data:null, message: 'Empty payload', status: 'success'})
        }
       
        const resourcesToEdit = body.map(resource => {
            if (!resource.Name || !resource._id) {
                throw new Error('Invalid resource format: Name and _id are required');
            }
            return {
                ...resource,
                Name: resource.Name.toString().trim()
            };
        });
        const existingResources = await resourceRepo.findAll();
        const placeholderNames = ['VACANT', 'OFFERED', 'NA', ''];

        let found = false
        if(Array.isArray(existingResources) && existingResources.length>0) {
        for(const existing of existingResources){
            for(let i=0; i<resourcesToEdit.length; i++){
                const editName = resourcesToEdit[i]?.Name?.toString()?.trim()?.toUpperCase();
                if(placeholderNames.includes(editName)) continue;
                if(existing?.Name?.toString()?.trim()?.toUpperCase() === editName && existing?.['Project/Product'] === resourcesToEdit[i]?.['Project/Product'] && existing._id != resourcesToEdit[i]?._id  ){
                    console.log('found')
                    found = true;
                    return res.status(400).send({data: null , message: 'Resource already exists', status: 'Failure'});
                }
            }
        }  
    }
        // Partial update ($set semantics): only the fields sent for each row change.
        const response = await withTransaction((tx) => resourceRepo.updateDocs(resourcesToEdit, tx));
        if (response.modifiedCount === body.length)
            res.status(200).send({ data: response, message: "Updated Successfully!", status: 'Success' })
        else {
            res.status(400).send({ data: response, message: ` update ${response.modifiedCount} of ${body.length} rows`, status: 'Failure' })
        }
        // Audit: record the field-level changes for each edited resource using
        // the snapshot of existing docs fetched above.
        const existingById = new Map(
            (Array.isArray(existingResources) ? existingResources : []).map((doc) => [String(doc._id), doc])
        );
        const actor = getActor(req);
        const auditEntries = resourcesToEdit
            .map((next) => {
                const prev = existingById.get(String(next._id));
                const changes = diffResource(prev, next);
                if (!changes.length) return null;
                return {
                    action: 'update',
                    resourceId: String(next._id || ''),
                    resourceName: String(next?.Name || prev?.Name || ''),
                    projectProduct: String(next?.['Project/Product'] || prev?.['Project/Product'] || ''),
                    actor,
                    changes,
                    correlationId: req.correlationId || '',
                };
            })
            .filter(Boolean);
        await recordAudit(auditEntries);
    }
    catch (err) {
        console.log(err)
        res.status(500).send({ data: null, message: err.message, status: 'Failure' })
    }
}

const addProject = async (req, res) => {
    try {
        let body = req.body;
       
       
        const Resource = await resourceRepo.findByName(body["Name"]);
        console.log(await Resource?.[0]?.["Name"])
     
      
        const arr = await Resource?.[0]?.["ProjectDetails"] ?? []
      
        arr.push(body);
        console.log(arr);
        // Same as Mongo updateOne({ Name }): only the first matching resource is updated.
        const matched = Resource.length > 0 ? 1 : 0
        const modified = matched ? await resourceRepo.setProjectDetails(Resource[0]._id, arr) : 0
        const updatedData = { acknowledged: true, matchedCount: matched, modifiedCount: modified, upsertedCount: 0, upsertedId: null }
     
       res.status(200).send({data:updatedData, message:'Project added successfully!', status: 'Success'})
    } catch (err) {
        console.log(err)
        res.status(500).send({data:null, message: err.message, status: 'Failure'})
    }
}

const getProjectDetails = async (req, res) => {
    try {
        const projectDetailsArray = []
        const ResourceDetailsArray = [];
        let roleitems =[]
        let roleunique = []
        let filtered = [];
        const filters = req?.body ?? {};
        const allResources= await resourceRepo.findAll();
        allResources.forEach((val) => {
            ResourceDetailsArray.push({label: val?.Name, value: val?.Name});
             if(!roleunique.includes(val.Role)){
             roleunique.push(val.Role)
             roleitems.push({label:val.Role, value: val.Role})
             }
            let found = false;
            Object.keys(val).forEach((key) => {
                if (key === 'ProjectDetails') {
                    found = true;
                }
            })
            if (found) {
                val['ProjectDetails'].forEach((projectDetails) => {
                    projectDetails.Role = val.Role
                    projectDetailsArray.push(projectDetails);

                })
            }
        })
         filtered = projectDetailsArray;
       
        Object.keys(filters).forEach((key) => {

            if ((key !=='StartDate'&& key!== 'EndDate') &&filters?.[key].length !== 0) {
              console.log(key);
              filtered = filtered.filter(item => {
                let payloadFilterKey = Array.isArray(filters?.[key]) ? filters?.[key] : [];
                let payloadFilterKeyLength = payloadFilterKey.length;
                for (let i = 0; i <payloadFilterKeyLength; i++) {

                  if (  (item?.[key].toUpperCase() === payloadFilterKey?.[i]?.value.toUpperCase())) {
                    return item;
                  }
                }
              })
            }
          })

          if(filtered.length !==0){

            if(filters?.['StartDate']  && filters?.['EndDate']){
             console.log('both')
             filtered = filtered.filter(item => (item?.StartDate === filters?.['StartDate'] && item?.EndDate === filters?.['EndDate']) )
            }
            else if(filters?.['StartDate']){
             console.log('only one')
             filtered = filtered.filter(item => item?.StartDate === filters?.['StartDate'])
            }
            else if(filters?.['EndDate']){
             filtered = filtered.filter(item => item?.EndDate === filters?.['EndDate'])
            }
         }

        const result = {
            Resources : ResourceDetailsArray,
            Projects  : filtered,
            Role : roleitems
        }

        res.status(200).send({data:result, message:'All Projects are fetched successfully', status: 'Success'})

    } catch (err) {
        console.log(err)
        res.status(500).send({data: null, message: err.message, status: 'Failure'});
    }
}

// Returns the Resource Tracker change history (newest first). Supports optional
// filters: `resourceId`, `action` (create|update|delete), and `limit`.
const getResourceAudit = async (req, res) => {
    try {
        const { resourceId, action, limit } = req.query || {};
        const entries = await resourceAuditRepo.find({ resourceId, action, limit });
        res.status(200).send({ data: entries, message: 'Audit history fetched', status: 'Success' });
    } catch (err) {
        console.log(err)
        res.status(500).send({ data: null, message: err.message, status: 'Failure' });
    }
}


module.exports = {
    allResources,
    addResource,
    addMultipleResources,
    updateMultipleResources,
    addProject,
    deleteResources,
    getProjectDetails,
    getResourceAudit
}