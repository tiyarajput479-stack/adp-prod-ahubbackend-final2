const { sql, createRequest, toSqlDateTime } = require('../helpers/sqlDb');
const { newObjectId, isObjectId } = require('../helpers/objectId');

const TABLE = 'dbo.Role';
const CHUNK_SIZE = 500;
const SELECT_COLUMNS = 'DocId, [Role], AccessPages, [Status], CreatedBy, [Time]';
const FIELDS = [
    { field: 'role', column: 'Role', max: 200 },
    { field: 'accessPages', column: 'AccessPages', max: 2000 },
    { field: 'status', column: 'Status', max: 100 },
    { field: 'createdBy', column: 'CreatedBy', max: 400 },
];

const toIso = (value) => (value instanceof Date ? value.toISOString() : value);
const toText = (value) => (value === undefined || value === null ? null : String(value));
const toTime = (value) =>
    value === undefined || value === null || value === '' ? null : toSqlDateTime(value);

const rowToDoc = (row, { withId = true } = {}) => {
    const doc = withId ? { _id: row.DocId } : {};
    FIELDS.forEach(({ field, column }) => {
        if (row[column] !== null && row[column] !== undefined) doc[field] = row[column];
    });
    if (row.Time !== null && row.Time !== undefined) doc.time = toIso(row.Time);
    return doc;
};

const docToRow = (doc) => ({
    DocId: doc._id,
    Role: toText(doc.role),
    AccessPages: toText(doc.accessPages),
    Status: toText(doc.status),
    CreatedBy: toText(doc.createdBy),
    Time: toTime(doc.time),
});

const castError = (id) => {
    const message = `Cast to ObjectId failed for value "${id}" (type ${typeof id}) at path "_id" for model "Roles"`;
    const error = new Error(message);
    Object.defineProperty(error, 'message', { value: message, enumerable: true, writable: true });
    Object.defineProperty(error, 'name', { value: 'CastError', enumerable: true, writable: true });
    Object.assign(error, {
        stringValue: `"${id}"`,
        valueType: typeof id,
        kind: 'ObjectId',
        value: id,
        path: '_id',
        reason: {},
    });
    return error;
};

const assertId = (id) => {
    if (!isObjectId(id)) throw castError(id);
    return String(id).toLowerCase();
};

const roleFilter = (request, role) => {
    if (role === undefined || role === null) return '[Role] IS NULL';
    request.input('role', sql.NVarChar(sql.MAX), String(role));
    return '[Role] = @role AND DATALENGTH([Role]) = DATALENGTH(@role)';
};

const OPENJSON_ROWS = `OPENJSON(@rows) WITH (
    DocId CHAR(24) '$.DocId', [Role] NVARCHAR(MAX) '$.Role', AccessPages NVARCHAR(MAX) '$.AccessPages',
    [Status] NVARCHAR(MAX) '$.Status', CreatedBy NVARCHAR(MAX) '$.CreatedBy', [Time] DATETIME2(3) '$.Time'
) AS s`;

const runChunked = async (rows, sqlText, executor) => {
    let affected = 0;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const request = await createRequest(executor);
        request.input('rows', sql.NVarChar(sql.MAX), JSON.stringify(rows.slice(i, i + CHUNK_SIZE)));
        const result = await request.query(sqlText);
        affected += result.rowsAffected[0] || 0;
    }
    return affected;
};

const listRows = async (executor) => {
    const request = await createRequest(executor);
    const result = await request.query(`SELECT ${SELECT_COLUMNS} FROM ${TABLE} ORDER BY DocId;`);
    return result.recordset;
};

const insertRows = (rows, executor) =>
    runChunked(
        rows,
        `
    INSERT INTO ${TABLE} (DocId, [Role], AccessPages, [Status], CreatedBy, [Time])
    SELECT s.DocId, s.[Role], s.AccessPages, s.[Status], s.CreatedBy, s.[Time] FROM ${OPENJSON_ROWS}
    WHERE NOT EXISTS (SELECT 1 FROM ${TABLE} AS t WHERE t.DocId = s.DocId);`,
        executor,
    );

const findAll = async (executor) => (await listRows(executor)).map((row) => rowToDoc(row));

const findByRole = async (role, { withId = true } = {}, executor) => {
    const request = await createRequest(executor);
    const where = roleFilter(request, role);
    const result = await request.query(
        `SELECT ${SELECT_COLUMNS} FROM ${TABLE} WHERE ${where} ORDER BY DocId;`,
    );
    return result.recordset.map((row) => rowToDoc(row, { withId }));
};

const insertRole = async (doc, executor) => {
    const row = docToRow({ ...doc, _id: newObjectId() });
    try {
        await insertRows([row], executor);
    } catch (err) {
  
        if (err.number === 2627 || err.number === 2601) {
            throw new Error(`Role "${doc.role}" already exists`);
        }
        throw err;
    }
    return rowToDoc({ ...row, Time: row.Time === null ? null : new Date(`${row.Time}Z`) });
};

const updateFirstByRole = async (role, data, executor) => {
    const request = await createRequest(executor);
    const where = roleFilter(request, role);
    const sets = [];
    const row = docToRow(data);
    FIELDS.forEach(({ field, column }) => {
        if (data[field] === undefined) return;
        request.input(`v_${column}`, sql.NVarChar(sql.MAX), row[column]);
        sets.push(`t.[${column}] = @v_${column}`);
    });
    if (data.time !== undefined) {
        request.input('v_Time', sql.DateTime2(3), row.Time === null ? null : new Date(`${row.Time}Z`));
        sets.push('t.[Time] = @v_Time');
    }
    if (!sets.length) {
        const found = await findByRole(role, {}, executor);
        return found[0] || null;
    }
    const result = await request.query(`
        WITH t AS (SELECT TOP (1) * FROM ${TABLE} WHERE ${where} ORDER BY DocId)
        UPDATE t SET ${sets.join(', ')}
        OUTPUT deleted.DocId, deleted.[Role], deleted.AccessPages, deleted.[Status],
               deleted.CreatedBy, deleted.[Time];`);
    return result.recordset[0] ? rowToDoc(result.recordset[0]) : null;
};

const deleteById = async (id, executor) => {
    if (id === undefined || id === null) return { acknowledged: true, deletedCount: 0 };
    const request = await createRequest(executor);
    request.input('docId', sql.Char(24), assertId(id));
    const result = await request.query(`DELETE FROM ${TABLE} WHERE DocId = @docId;`);
    return { acknowledged: true, deletedCount: result.rowsAffected[0] || 0 };
};

module.exports = {
    FIELDS,
    rowToDoc,
    docToRow,
    findAll,
    findByRole,
    insertRole,
    updateFirstByRole,
    deleteById,
};
