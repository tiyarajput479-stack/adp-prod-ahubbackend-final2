const { sql, createRequest, toSqlDateTime } = require('../helpers/sqlDb');
const { newObjectId } = require('../helpers/objectId');

const TABLE = 'dbo.IntakeAdminResource';
const SELECT_COLUMNS = 'DocId, Resource, ItemId, Payload, CreatedAt, UpdatedAt';
const OUTPUT = (side) =>
    ['DocId', 'Resource', 'ItemId', 'Payload', 'CreatedAt', 'UpdatedAt']
        .map((c) => `${side}.${c}`)
        .join(', ');
const KNOWN_KEYS = new Set(['_id', 'resource', 'itemId', 'payload', 'createdAt', 'updatedAt']);
const ITEM_MATCH = `Resource = @resource AND DATALENGTH(Resource) = DATALENGTH(@resource)
    AND ItemId = @itemId AND DATALENGTH(ItemId) = DATALENGTH(@itemId)`;
const toIso = (value) => (value instanceof Date ? value.toISOString() : value);
const toPayloadText = (payload) =>
    payload === undefined || payload === null ? null : JSON.stringify(payload);

const rowToDoc = (row) => {
    const doc = { _id: row.DocId, resource: row.Resource, itemId: row.ItemId };
    if (row.Payload !== null && row.Payload !== undefined) doc.payload = JSON.parse(row.Payload);
    if (row.CreatedAt) doc.createdAt = new Date(toIso(row.CreatedAt));
    if (row.UpdatedAt) doc.updatedAt = new Date(toIso(row.UpdatedAt));
    return doc;
};

const docToRow = (doc) => ({
    DocId: doc._id,
    Resource: doc.resource,
    ItemId: doc.itemId,
    Payload: toPayloadText(doc.payload),
    CreatedAt: doc.createdAt ? toSqlDateTime(doc.createdAt) : null,
    UpdatedAt: doc.updatedAt ? toSqlDateTime(doc.updatedAt) : null,
});

const itemRequest = async (resource, itemId, executor) => {
    const request = await createRequest(executor);
    request.input('resource', sql.NVarChar(sql.MAX), String(resource));
    request.input('itemId', sql.NVarChar(sql.MAX), String(itemId));
    return request;
};


const findByResourceSortedByCreatedAt = async (resource, executor) => {
    const request = await createRequest(executor);
    request.input('resource', sql.NVarChar(sql.MAX), String(resource));
    const result = await request.query(`
        SELECT ${SELECT_COLUMNS} FROM ${TABLE}
        WHERE Resource = @resource AND DATALENGTH(Resource) = DATALENGTH(@resource)
        ORDER BY CreatedAt, Seq;`);
    return result.recordset.map(rowToDoc);
};

const findByResources = async (resources, executor) => {
    const request = await createRequest(executor);
    request.input('resources', sql.NVarChar(sql.MAX), JSON.stringify(resources.map(String)));
    const result = await request.query(`
        SELECT ${SELECT_COLUMNS} FROM ${TABLE}
        WHERE Resource IN (SELECT [value] COLLATE Latin1_General_100_BIN2 FROM OPENJSON(@resources))
        ORDER BY Seq;`);
    const wanted = new Set(resources.map(String));
    return result.recordset.map(rowToDoc).filter((doc) => wanted.has(doc.resource));
};

const fieldValues = (payload, field) => {
    if (Array.isArray(payload)) {
        return payload.flatMap((item) =>
            item && typeof item === 'object' && !Array.isArray(item) ? [item[field]] : [],
        );
    }
    return payload && typeof payload === 'object' ? [payload[field]] : [];
};

const textMatches = (text, regex) =>
    regex.test(text) || (text.endsWith('\n') && regex.test(text.slice(0, -1)));
const regexMatches = (value, regex) => {
    if (typeof value === 'string') return textMatches(value, regex);
    if (Array.isArray(value))
        return value.some((item) => typeof item === 'string' && textMatches(item, regex));
    return false;
};

const findByResourceMatchingPayload = async (resource, conditions, executor) => {
    const docs = await findByResources([resource], executor);
    return docs.filter((doc) =>
        conditions.some(({ field, regex }) =>
            fieldValues(doc.payload, field).some((value) => regexMatches(value, regex)),
        ),
    );
};

const upsertPayload = async (resource, itemId, payload, executor) => {
    const request = await itemRequest(resource, itemId, executor);
    request.input('payload', sql.NVarChar(sql.MAX), toPayloadText(payload));
    request.input('docId', sql.Char(24), newObjectId());
    request.input('now', sql.NVarChar(30), toSqlDateTime(new Date()));
    const result = await request.query(`
        MERGE ${TABLE} WITH (HOLDLOCK) AS t
        USING (SELECT @resource AS Resource, @itemId AS ItemId) AS s
        ON t.Resource = s.Resource AND DATALENGTH(t.Resource) = DATALENGTH(s.Resource)
           AND t.ItemId = s.ItemId AND DATALENGTH(t.ItemId) = DATALENGTH(s.ItemId)
        WHEN MATCHED THEN UPDATE SET Payload = @payload, UpdatedAt = CAST(@now AS DATETIME2(3))
        WHEN NOT MATCHED THEN
            INSERT (DocId, Resource, ItemId, Payload, CreatedAt, UpdatedAt)
            VALUES (@docId, @resource, @itemId, @payload, CAST(@now AS DATETIME2(3)), CAST(@now AS DATETIME2(3)))
        OUTPUT ${OUTPUT('inserted')};`);
    return rowToDoc(result.recordset[0]);
};
const updatePayload = async (resource, itemId, payload, executor) => {
    const request = await itemRequest(resource, itemId, executor);
    request.input('payload', sql.NVarChar(sql.MAX), toPayloadText(payload));
    request.input('now', sql.NVarChar(30), toSqlDateTime(new Date()));
    const result = await request.query(`
        UPDATE ${TABLE} SET Payload = @payload, UpdatedAt = CAST(@now AS DATETIME2(3))
        OUTPUT ${OUTPUT('inserted')}
        WHERE ${ITEM_MATCH};`);
    return result.recordset[0] ? rowToDoc(result.recordset[0]) : null;
};

const deleteItem = async (resource, itemId, executor) => {
    const request = await itemRequest(resource, itemId, executor);
    const result = await request.query(`
        DELETE FROM ${TABLE}
        OUTPUT ${OUTPUT('deleted')}
        WHERE ${ITEM_MATCH};`);
    return result.recordset[0] ? rowToDoc(result.recordset[0]) : null;
};

module.exports = {
    rowToDoc,
    findByResourceSortedByCreatedAt,
    findByResources,
    findByResourceMatchingPayload,
    upsertPayload,
    updatePayload,
    deleteItem,
};

