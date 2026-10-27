const { isObjectId } = require('./objectId');

class CastError extends Error {
    constructor(value, path, modelName) {
        super(`Cast to ObjectId failed for value "${value}" (type ${typeof value}) at path "${path}" for model "${modelName}"`);
        this.name = 'CastError';
        this.kind = 'ObjectId';
        this.value = value;
        this.path = path;
    }
}

const assertObjectIdFilter = (filter, modelName) => {
    if (!filter || !('_id' in filter)) return filter;
    const value = filter._id;
    const wanted = value && typeof value === 'object' && Array.isArray(value.$in) ? value.$in : [value];
    wanted.forEach((v) => {
        if (v !== undefined && v !== null && !isObjectId(String(v))) throw new CastError(v, '_id', modelName);
    });
    return filter;
};

module.exports = { CastError, assertObjectIdFilter };
