const { sql, createRequest, toSqlDateTime } = require('../helpers/sqlDb');
const { newObjectId, isObjectId, objectIdTime } = require('../helpers/objectId');

const TABLE = 'dbo.ResourceTracker';
const CHUNK_SIZE = 500;

const COLUMNS = [
    { field: 'Associate ID', column: 'AssociateId', max: 100 },
    { field: 'Name', column: 'Name', max: 400 },
    { field: 'Reporting Manager', column: 'ReportingManager', max: 400 },
    { field: 'Manager', column: 'Manager', max: 400 },
    { field: 'Type', column: 'Type', max: 400 },
    { field: 'Stream', column: 'Stream', max: 400 },
    { field: 'Role', column: 'Role', max: 400 },
    { field: 'Country', column: 'Country', max: 400 },
    { field: 'Status', column: 'Status', max: 400 },
    { field: 'Project/Product', column: 'ProjectProduct', max: 400 },
    { field: 'Group', column: 'Group', max: 400 },
    { field: 'Finance Names', column: 'FinanceNames', max: 400 },
    { field: 'iKare Project', column: 'IKareProject', max: 400 },
    { field: 'Comments', column: 'Comments', max: null },
];
const DATA_COLUMNS = [...COLUMNS.map((c) => c.column), 'ProjectDetails', 'ExtraFields'];
const RESERVED_FIELDS = new Set(['_id', '__v']);

const q = (column) => `[${column}]`;
const SELECT_COLUMNS = `DocId, ${DATA_COLUMNS.map(q).join(', ')}, CreatedAt`;

const OPENJSON_ROWS = `OPENJSON(@rows) WITH (
    DocId CHAR(24) '$.DocId',
    ${DATA_COLUMNS.map((c) => `${q(c)} NVARCHAR(MAX) '$.${c}'`).join(',\n    ')},
    CreatedAt DATETIME2(3) '$.CreatedAt'
) AS s`;

const INSERT_SQL = (skipExisting) => `
INSERT INTO ${TABLE} (DocId, ${DATA_COLUMNS.map(q).join(', ')}, CreatedAt, UpdatedAt)
SELECT s.DocId, ${DATA_COLUMNS.map((c) => `s.${q(c)}`).join(', ')},
       ISNULL(s.CreatedAt, SYSUTCDATETIME()), SYSUTCDATETIME()
FROM ${OPENJSON_ROWS}
${skipExisting ? `WHERE NOT EXISTS (SELECT 1 FROM ${TABLE} AS t WHERE t.DocId = s.DocId)` : ''};`;

const UPDATE_SQL = `
UPDATE t SET
    ${DATA_COLUMNS.map((c) => `t.${q(c)} = s.${q(c)}`).join(',\n    ')},
    t.UpdatedAt = SYSUTCDATETIME()
FROM ${TABLE} AS t
JOIN ${OPENJSON_ROWS} ON s.DocId = t.DocId;`;

const docToRow = (doc = {}, docId, createdAt) => {
    const row = { DocId: docId };
    const extras = {};
    COLUMNS.forEach(({ column }) => {
        row[column] = null;
    });
    row.ProjectDetails = null;

    Object.keys(doc).forEach((key) => {
        const value = doc[key];
        if (RESERVED_FIELDS.has(key) || value === undefined) return;
        const target = COLUMNS.find((c) => c.field === key);
        if (target && typeof value === 'string') row[target.column] = value;
        else if (key === 'ProjectDetails' && Array.isArray(value)) row.ProjectDetails = JSON.stringify(value);
        else extras[key] = value;
    });

    row.ExtraFields = Object.keys(extras).length ? JSON.stringify(extras) : null;
    row.CreatedAt = toSqlDateTime(createdAt || objectIdTime(docId));
    return row;
};

const rowToDoc = (row) => {
    const doc = { _id: row.DocId };
    COLUMNS.forEach(({ field, column }) => {
        if (row[column] !== null && row[column] !== undefined) doc[field] = row[column];
    });
    if (row.ProjectDetails !== null && row.ProjectDetails !== undefined) {
        doc.ProjectDetails = JSON.parse(row.ProjectDetails);
    }
    if (row.ExtraFields) Object.assign(doc, JSON.parse(row.ExtraFields));
    doc.__v = 0;
    return doc;
};

const rowsDiffer = (a, b) => DATA_COLUMNS.some((c) => (a?.[c] ?? null) !== (b?.[c] ?? null));

const runChunked = async (rows, sqlText, executor) => {
    let affected = 0;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const request = await createRequest(executor);
        request.input('rows', sql.NVarChar(sql.MAX), JSON.stringify(rows.slice(i, i + CHUNK_SIZE)));
        const result = await request.query(sqlText);
        affected += result.rowsAffected.reduce((sum, n) => sum + n, 0);
    }
    return affected;
};

const listRows = async (executor) => {
    const request = await createRequest(executor);
    const result = await request.query(`SELECT ${SELECT_COLUMNS} FROM ${TABLE} ORDER BY DocId;`);
    return result.recordset;
};

const listRowsByIds = async (ids, executor) => {
    if (!ids.length) return [];
    const request = await createRequest(executor);
    request.input('ids', sql.NVarChar(sql.MAX), JSON.stringify(ids));
    const result = await request.query(
        `SELECT ${SELECT_COLUMNS} FROM ${TABLE} WHERE DocId IN (SELECT [value] FROM OPENJSON(@ids));`
    );
    return result.recordset;
};

const insertRows = (rows, executor, { skipExisting = false } = {}) =>
    runChunked(rows, INSERT_SQL(skipExisting), executor);

const updateRows = (rows, executor) => runChunked(rows, UPDATE_SQL, executor);

const findAll = async (executor) => (await listRows(executor)).map(rowToDoc);

const findByName = async (name, executor) => {
    if (typeof name !== 'string') return [];
    const request = await createRequest(executor);
    request.input('name', sql.NVarChar(400), name);
    const result = await request.query(
        `SELECT ${SELECT_COLUMNS} FROM ${TABLE}
         WHERE Name COLLATE Latin1_General_100_CS_AS = @name ORDER BY DocId;`
    );
    return result.recordset.map(rowToDoc);
};

const insertDocs = async (docs, executor) => {
    const now = new Date();
    const rows = docs.map((doc) => {
        const docId = isObjectId(doc?._id) ? String(doc._id).toLowerCase() : newObjectId();
        return docToRow(doc, docId, now);
    });
    await insertRows(rows, executor);
    return rows.map(rowToDoc);
};

const updateDocs = async (docs, executor) => {
    const ids = [...new Set(docs.map((doc) => String(doc?._id || '').toLowerCase()).filter(isObjectId))];
    const current = new Map((await listRowsByIds(ids, executor)).map((row) => [row.DocId, row]));
    const changedIds = new Set();
    let matchedCount = 0;
    let modifiedCount = 0;

    docs.forEach((doc) => {
        const docId = String(doc?._id || '').toLowerCase();
        const prev = current.get(docId);
        if (!prev) return;
        matchedCount += 1;
        const next = docToRow({ ...rowToDoc(prev), ...doc }, docId, prev.CreatedAt);
        if (rowsDiffer(prev, next)) {
            modifiedCount += 1;
            changedIds.add(docId);
            current.set(docId, next);
        }
    });

    await updateRows([...changedIds].map((id) => current.get(id)), executor);
    return { acknowledged: true, insertedCount: 0, matchedCount, modifiedCount, deletedCount: 0, upsertedCount: 0 };
};

const deleteByIds = async (ids, executor) => {
    const validIds = [...new Set(ids.map((id) => String(id || '').toLowerCase()).filter(isObjectId))];
    if (!validIds.length) return 0;
    const request = await createRequest(executor);
    request.input('ids', sql.NVarChar(sql.MAX), JSON.stringify(validIds));
    const result = await request.query(
        `DELETE FROM ${TABLE} WHERE DocId IN (SELECT [value] FROM OPENJSON(@ids));`
    );
    return result.rowsAffected[0] || 0;
};

const setProjectDetails = async (docId, projectDetails, executor) => {
    const request = await createRequest(executor);
    request.input('docId', sql.Char(24), docId);
    request.input('details', sql.NVarChar(sql.MAX), JSON.stringify(Array.isArray(projectDetails) ? projectDetails : []));
    const result = await request.query(
        `UPDATE ${TABLE} SET ProjectDetails = @details, UpdatedAt = SYSUTCDATETIME() WHERE DocId = @docId;`
    );
    return result.rowsAffected[0] || 0;
};

module.exports = {
    COLUMNS,
    docToRow,
    rowToDoc,
    rowsDiffer,
    listRows,
    insertRows,
    updateRows,
    findAll,
    findByName,
    insertDocs,
    updateDocs,
    deleteByIds,
    setProjectDetails,
};
