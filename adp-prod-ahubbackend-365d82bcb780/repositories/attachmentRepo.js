const { sql, createRequest, getPool } = require('../helpers/sqlDb');
const { assertObjectIdFilter } = require('../helpers/mongoCompat');
const { newObjectId } = require('../helpers/objectId');

const TABLE = 'dbo.Attachment';
const KNOWN_KEYS = new Set(['_id', 'requestId', 'name', 'data', '__v']);
const SELECT_COLUMNS = 'DocId, RequestId, [Name], Data, DataText, [Version]';

const isPlainBase64 = (text) => Buffer.from(text, 'base64').toString('base64') === text;

const docToRow = (doc) => {
    const docId = String(doc._id);
    const extra = Object.keys(doc).filter((k) => !KNOWN_KEYS.has(k) && doc[k] !== undefined);
    if (extra.length) throw new Error(`${docId} has keys with no column: ${extra.join(', ')}`);
    ['requestId', 'name', 'data'].forEach((f) => {
        if (doc[f] === null) throw new Error(`${docId} "${f}" is null (not supported)`);
        if (doc[f] !== undefined && typeof doc[f] !== 'string')
            throw new Error(`${docId} "${f}" is not text`);
    });
    if (doc.__v !== undefined && !Number.isInteger(doc.__v))
        throw new Error(`${docId} "__v" is not a whole number`);
    const plain = typeof doc.data === 'string' && isPlainBase64(doc.data);
    return {
        DocId: docId,
        RequestId: doc.requestId === undefined ? null : doc.requestId,
        Name: doc.name === undefined ? null : doc.name,
        Data: plain ? Buffer.from(doc.data, 'base64') : null,
        DataText: typeof doc.data === 'string' && !plain ? doc.data : null,
        Version: doc.__v === undefined ? null : doc.__v,
    };
};

const rowToDoc = (row) => {
    const doc = { _id: row.DocId };
    if (row.RequestId !== null && row.RequestId !== undefined) doc.requestId = row.RequestId;
    if (row.Name !== null && row.Name !== undefined) doc.name = row.Name;
    if (row.Data !== null && row.Data !== undefined) doc.data = Buffer.from(row.Data).toString('base64');
    else if (row.DataText !== null && row.DataText !== undefined) doc.data = row.DataText;
    if (row.Version !== null && row.Version !== undefined) doc.__v = row.Version;
    return doc;
};

const insertRow = async (row, executor) => {
    const request = await createRequest(executor);
    request.input('docId', sql.Char(24), row.DocId);
    request.input('requestId', sql.NVarChar(850), row.RequestId);
    request.input('name', sql.NVarChar(sql.MAX), row.Name);
    request.input('data', sql.VarBinary(sql.MAX), row.Data);
    request.input('dataText', sql.NVarChar(sql.MAX), row.DataText);
    request.input('version', sql.Int, row.Version);
    await request.query(`INSERT INTO ${TABLE} (DocId, RequestId, [Name], Data, DataText, [Version])
        VALUES (@docId, @requestId, @name, @data, @dataText, @version);`);
};

const COLUMN_OF = { _id: 'DocId', requestId: 'RequestId' };

const matcher = (request, key, value, name) => {
    const columnName = COLUMN_OF[key];
    if (!columnName) throw new Error(`attachmentRepo.find: unsupported filter key ${key}`);
    if (value === undefined || value === null) {
        return { where: `${columnName} IS NULL`, test: (row) => row[columnName] === null };
    }
    const wanted = (value && Array.isArray(value.$in) ? value.$in : [value]).map(String);
    request.input(name, sql.NVarChar(sql.MAX), JSON.stringify(wanted));
    return {
        where: `${columnName} IN (SELECT [value] COLLATE Latin1_General_100_BIN2 FROM OPENJSON(@${name}))`,
        test: (row) => wanted.includes(row[columnName]),
    };
};

const find = async (filter, executor) => {
    const cast = assertObjectIdFilter(filter, 'Attachments');
    const request = await createRequest(executor);
    const parts = Object.entries(cast).map(([key, value], i) => matcher(request, key, value, `w${i}`));
    const where = parts.length ? `WHERE ${parts.map((p) => p.where).join(' AND ')}` : '';
    const result = await request.query(`SELECT ${SELECT_COLUMNS} FROM ${TABLE} ${where} ORDER BY Seq;`);
    return result.recordset.filter((row) => parts.every((p) => p.test(row))).map(rowToDoc);
};

const insertMany = async (docs, executor) => {
    const withVersion = docs.map((d) => ({ ...d, _id: d._id ?? newObjectId(), __v: 0 }));
    const rows = withVersion.map((d) => docToRow(d));
    if (executor) {
        for (const row of rows) await insertRow(row, executor);
        return rows.map(rowToDoc);
    }
    const tx = new sql.Transaction(await getPool());
    await tx.begin();
    try {
        for (const row of rows) await insertRow(row, tx);
        await tx.commit();
    } catch (err) {
        await tx.rollback().catch(() => {});
        throw err;
    }
    return rows.map(rowToDoc);
};

module.exports = {
    docToRow,
    rowToDoc,
    find,
    insertMany,
};
