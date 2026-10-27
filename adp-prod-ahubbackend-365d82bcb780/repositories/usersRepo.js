const { sql, createRequest } = require('../helpers/sqlDb');
const { newObjectId, isObjectId } = require('../helpers/objectId');

const TABLE = 'dbo.Users';
const FIELDS = [
    { field: 'esId', column: 'EsId', max: 200 },
    { field: 'email', column: 'Email', max: 400 },
    { field: 'displayName', column: 'DisplayName', max: 400 },
    { field: 'designation', column: 'Designation', max: 400 },
    { field: 'role', column: 'Role', max: 200 },
    { field: 'permissions', column: 'Permissions' },
    { field: 'teams', column: 'Teams' },
    { field: 'countries', column: 'Countries' },
    { field: 'products', column: 'Products' },
];
const COLUMNS = FIELDS.map((f) => `[${f.column}]`).join(', ');
const SELECT_COLUMNS = `DocId, ${COLUMNS}, CreatedAt, UpdatedAt`;

const toText = (value) => (value === undefined || value === null || value === '' ? null : String(value));
const SQL_TYPE = (max) => (max ? sql.NVarChar(max) : sql.NVarChar(sql.MAX));
const toIso = (value) => (value instanceof Date ? value.toISOString() : value);

const rowToDoc = (row, { withId = true } = {}) => {
    const doc = withId ? { _id: row.DocId } : {};
    FIELDS.forEach(({ field, column }) => {
        if (row[column] !== null && row[column] !== undefined) doc[field] = row[column];
    });
    if (row.CreatedAt) doc.createdAt = toIso(row.CreatedAt);
    if (row.UpdatedAt) doc.updatedAt = toIso(row.UpdatedAt);
    return doc;
};

const docToRow = (doc) => {
    const row = {};
    FIELDS.forEach(({ field, column }) => {
        row[column] = toText(doc[field]);
    });
    return row;
};


const esIdFilter = (request, esId) => {
    if (esId === undefined || esId === null) return 'EsId IS NULL';
    request.input('esId', sql.NVarChar(sql.MAX), String(esId));
    return 'EsId = @esId AND DATALENGTH(EsId) = DATALENGTH(@esId)';
};

const emailFilter = (request, email) => {
    if (email === undefined || email === null) return 'Email IS NULL';
    request.input('email', sql.NVarChar(sql.MAX), String(email));
    return 'Email = @email AND DATALENGTH(Email) = DATALENGTH(@email)';
};

const findAll = async (executor) => {
    const request = await createRequest(executor);
    const result = await request.query(`SELECT ${SELECT_COLUMNS} FROM ${TABLE} ORDER BY Seq;`);
    return result.recordset.map((row) => rowToDoc(row));
};


const findByEsId = async (esId, { withId = true } = {}, executor) => {
    const request = await createRequest(executor);
    const where = esIdFilter(request, esId);
    const result = await request.query(`SELECT ${SELECT_COLUMNS} FROM ${TABLE} WHERE ${where} ORDER BY DocId;`);
    return result.recordset.map((row) => rowToDoc(row, { withId }));
};

const findOneByEsId = async (esId, executor) => (await findByEsId(esId, {}, executor))[0] || null;

const findByEsIdOrEmail = async (esId, email, executor) => {
    const request = await createRequest(executor);
    const clauses = [];
    if (esId) {
        request.input('esIdLower', sql.NVarChar(sql.MAX), String(esId).toLowerCase());
        clauses.push('LOWER(EsId) = @esIdLower');
    }
    if (email) {
        request.input('emailLower', sql.NVarChar(sql.MAX), String(email).toLowerCase());
        clauses.push('LOWER(Email) = @emailLower');
    }
    if (!clauses.length) return [];
    const result = await request.query(
        `SELECT ${SELECT_COLUMNS} FROM ${TABLE} WHERE ${clauses.join(' OR ')} ORDER BY DocId;`,
    );
    return result.recordset.map((row) => rowToDoc(row));
};

const insertUser = async (doc, executor) => {
    const docId = newObjectId();
    const row = docToRow(doc);
    const request = await createRequest(executor);
    request.input('docId', sql.Char(24), docId);
    FIELDS.forEach(({ column, max }) => request.input(column, SQL_TYPE(max), row[column]));
    const result = await request.query(`
        INSERT INTO ${TABLE} (DocId, ${COLUMNS}, CreatedAt, UpdatedAt)
        OUTPUT ${SELECT_COLUMNS.split(',').map((c) => `inserted.${c.trim()}`).join(', ')}
        VALUES (@docId, ${FIELDS.map((f) => `@${f.column}`).join(', ')}, SYSUTCDATETIME(), SYSUTCDATETIME());`);
    return rowToDoc(result.recordset[0]);
};

const updateFirstByEsId = async (esId, data, executor) => {
    const request = await createRequest(executor);
    const where = esIdFilter(request, esId);
    const sets = [];
    const row = docToRow(data);
    FIELDS.forEach(({ field, column, max }) => {
        if (data[field] === undefined) return;
        request.input(`v_${column}`, SQL_TYPE(max), row[column]);
        sets.push(`t.[${column}] = @v_${column}`);
    });
    if (!sets.length) return findOneByEsId(esId, executor);
    sets.push('t.UpdatedAt = SYSUTCDATETIME()');
    const result = await request.query(`
        WITH t AS (SELECT TOP (1) * FROM ${TABLE} WHERE ${where} ORDER BY DocId)
        UPDATE t SET ${sets.join(', ')}
        OUTPUT inserted.DocId, ${COLUMNS.split(',').map((c) => `inserted.${c.trim()}`).join(', ')},
               inserted.CreatedAt, inserted.UpdatedAt;`);
    return result.recordset[0] ? rowToDoc(result.recordset[0]) : null;
};

const deleteFirstByEsId = async (esId, executor) => {
    const request = await createRequest(executor);
    const where = esIdFilter(request, esId);
    const result = await request.query(`
        WITH t AS (SELECT TOP (1) * FROM ${TABLE} WHERE ${where} ORDER BY DocId)
        DELETE FROM t;`);
    return { acknowledged: true, deletedCount: result.rowsAffected[0] || 0 };
};

const assertId = (id) => {
    if (!isObjectId(id)) {
        throw new Error(`Cast to ObjectId failed for value "${id}" (type string) at path "_id" for model "Users"`);
    }
    return String(id).toLowerCase();
};

const updateById = async (id, data, executor) => {
    const docId = assertId(id);
    const request = await createRequest(executor);
    request.input('docId', sql.Char(24), docId);
    const sets = [];
    const row = docToRow(data);
    FIELDS.forEach(({ field, column, max }) => {
        if (data[field] === undefined) return;
        request.input(column, SQL_TYPE(max), row[column]);
        sets.push(`[${column}] = @${column}`);
    });
    if (!sets.length) {
        const result = await request.query(`SELECT ${SELECT_COLUMNS} FROM ${TABLE} WHERE DocId = @docId;`);
        return result.recordset[0] ? rowToDoc(result.recordset[0]) : null;
    }
    sets.push('UpdatedAt = SYSUTCDATETIME()');
    const result = await request.query(`
        UPDATE ${TABLE} SET ${sets.join(', ')}
        OUTPUT ${SELECT_COLUMNS.split(',').map((c) => `inserted.${c.trim()}`).join(', ')}
        WHERE DocId = @docId;`);
    return result.recordset[0] ? rowToDoc(result.recordset[0]) : null;
};

const deleteById = async (id, executor) => {
    const docId = assertId(id);
    const request = await createRequest(executor);
    const result = await request.query(`
        DELETE FROM ${TABLE}
        OUTPUT ${SELECT_COLUMNS.split(',').map((c) => `deleted.${c.trim()}`).join(', ')}
        WHERE DocId = @docId;`);
    return result.recordset[0] ? rowToDoc(result.recordset[0]) : null;
};

module.exports = {
    FIELDS,
    rowToDoc,
    docToRow,
    findAll,
    findByEsId,
    findOneByEsId,
    findByEsIdOrEmail,
    insertUser,
    updateFirstByEsId,
    deleteFirstByEsId,
    updateById,
    deleteById,
};
