const { sql, createRequest } = require('../helpers/sqlDb');
const { newObjectId, isObjectId } = require('../helpers/objectId');
const TABLE = 'dbo.ProgramTracker';
const SELECT_COLUMNS = `DocId, Bu, Scope, Program, Dt, Gpt, Total, Fy, ProgramLeadership,
    ProductMgmt, ProgramMgmt, DtProductMgmt, TechLead, ExecSponsor, BexLeader, ProjectMgmt,
    Definition, Delivery, Capacity, Risk, [Keep], Improve, [Start], Stop,
    CreatedAt, UpdatedAt`;

const FIELDS = [
    { field: 'bu', column: 'Bu', kind: 'text', max: 200 },
    { field: 'scope', column: 'Scope', kind: 'text', max: 100 },
    { field: 'program', column: 'Program', kind: 'text', max: 400 },
    { field: 'dt', column: 'Dt', kind: 'number' },
    { field: 'gpt', column: 'Gpt', kind: 'number' },
    { field: 'total', column: 'Total', kind: 'number' },
    { field: 'fy', column: 'Fy', kind: 'text', max: 20 },
    { field: 'programLeadership', column: 'ProgramLeadership', kind: 'text', max: 400 },
    { field: 'productMgmt', column: 'ProductMgmt', kind: 'text', max: 400 },
    { field: 'programMgmt', column: 'ProgramMgmt', kind: 'text', max: 400 },
    { field: 'dtProductMgmt', column: 'DtProductMgmt', kind: 'text', max: 400 },
    { field: 'techLead', column: 'TechLead', kind: 'text', max: 400 },
    { field: 'execSponsor', column: 'ExecSponsor', kind: 'text', max: 400 },
    { field: 'bexLeader', column: 'BexLeader', kind: 'text', max: 400 },
    { field: 'projectMgmt', column: 'ProjectMgmt', kind: 'text', max: 400 },
    { field: 'definition', column: 'Definition', kind: 'text', max: 50 },
    { field: 'delivery', column: 'Delivery', kind: 'text', max: 50 },
    { field: 'capacity', column: 'Capacity', kind: 'text', max: 50 },
    { field: 'risk', column: 'Risk', kind: 'text', max: 50 },
    { field: 'keep', column: 'Keep', kind: 'text' },
    { field: 'improve', column: 'Improve', kind: 'text' },
    { field: 'start', column: 'Start', kind: 'text' },
    { field: 'stop', column: 'Stop', kind: 'text' },
];
const KNOWN_KEYS = new Set(['_id', ...FIELDS.map((f) => f.field)]);

const toText = (value) => (value === undefined || value === null || value === '' ? null : String(value));
const toNumber = (value) => (value === undefined || value === null || value === '' ? null : Number(value));
const SQL_TYPE = (kind, max) =>
    kind === 'number' ? sql.Float : max ? sql.NVarChar(max) : sql.NVarChar(sql.MAX);

const rowToDoc = (row) => {
    const doc = { _id: row.DocId };
    FIELDS.forEach(({ field, column, kind }) => {
        const value = row[column];
        if (value === null || value === undefined) return;
        doc[field] = kind === 'number' ? Number(value) : value;
    });
    if (row.CreatedAt) doc.createdAt = row.CreatedAt instanceof Date ? row.CreatedAt.toISOString() : row.CreatedAt;
    if (row.UpdatedAt) doc.updatedAt = row.UpdatedAt instanceof Date ? row.UpdatedAt.toISOString() : row.UpdatedAt;
    return doc;
};

const docToRow = (doc) => {
    const row = {};
    FIELDS.forEach(({ field, column, kind }) => {
        row[column] = kind === 'number' ? toNumber(doc[field]) : toText(doc[field]);
    });
    return row;
};


const validateDoc = (doc) => {
    const problems = [];
    if (!String(doc.bu ?? '').trim()) problems.push('"bu" is required');
    if (!String(doc.program ?? '').trim()) problems.push('"program" is required');
    FIELDS.forEach(({ field, kind, max }) => {
        const value = doc[field];
        if (kind === 'text' && max && typeof value === 'string' && value.length > max) {
            problems.push(`"${field}" is longer than ${max} chars`);
        }
        if (kind === 'number' && value !== undefined && value !== '' && Number.isNaN(Number(value))) {
            problems.push(`"${field}" is not a number`);
        }
    });
    return problems;
};

const assertId = (id) => {
    if (!isObjectId(id)) {
        throw new Error(
            `Cast to ObjectId failed for value "${id}" (type string) at path "_id" for model "ProgramTracker"`,
        );
    }
    return String(id).toLowerCase();
};

const bindRow = (request, row) => {
    FIELDS.forEach(({ column, kind, max }) => {
        request.input(column, SQL_TYPE(kind, max), row[column]);
    });
};

const findAll = async (executor) => {
    const request = await createRequest(executor);
    const result = await request.query(`SELECT ${SELECT_COLUMNS} FROM ${TABLE} ORDER BY Seq;`);
    return result.recordset.map(rowToDoc);
};

const insertDoc = async (doc, executor) => {
    const docId = newObjectId();
    const row = docToRow(doc);
    const request = await createRequest(executor);
    request.input('docId', sql.Char(24), docId);
    bindRow(request, row);
    const columns = FIELDS.map((f) => f.column);
    const result = await request.query(`
        INSERT INTO ${TABLE} (DocId, ${columns.map((c) => `[${c}]`).join(', ')}, CreatedAt, UpdatedAt)
        OUTPUT ${SELECT_COLUMNS.split(',').map((c) => `inserted.${c.trim()}`).join(', ')}
        VALUES (@docId, ${columns.map((c) => `@${c}`).join(', ')}, SYSUTCDATETIME(), SYSUTCDATETIME());`);
    return rowToDoc(result.recordset[0]);
};

const updateById = async (id, data, executor) => {
    const docId = assertId(id);
    const row = docToRow(data);
    const request = await createRequest(executor);
    request.input('docId', sql.Char(24), docId);
    const sets = [];
    FIELDS.forEach(({ field, column, kind, max }) => {
        if (data[field] === undefined) return;
        request.input(column, SQL_TYPE(kind, max), row[column]);
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
    request.input('docId', sql.Char(24), docId);
    const result = await request.query(`DELETE FROM ${TABLE} WHERE DocId = @docId;`);
    return { acknowledged: true, deletedCount: result.rowsAffected[0] || 0 };
};

module.exports = {
    FIELDS,
    rowToDoc,
    docToRow,
    validateDoc,
    findAll,
    insertDoc,
    updateById,
    deleteById,
};
