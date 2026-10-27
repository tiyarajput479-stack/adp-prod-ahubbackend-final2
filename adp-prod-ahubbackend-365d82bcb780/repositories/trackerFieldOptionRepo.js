const { sql, createRequest, toSqlDateTime } = require('../helpers/sqlDb');
const { newObjectId, isObjectId } = require('../helpers/objectId');

const TABLE = 'dbo.TrackerFieldOption';
const CHUNK_SIZE = 500;
const SELECT_COLUMNS = 'DocId, Field, [Value], CreatedAt, UpdatedAt';

const toIso = (value) => (value instanceof Date ? value.toISOString() : value);

const rowToDoc = (row) => {
    const doc = { _id: row.DocId, field: row.Field, value: row.Value };
    if (row.CreatedAt) doc.createdAt = toIso(row.CreatedAt);
    if (row.UpdatedAt) doc.updatedAt = toIso(row.UpdatedAt);
    return doc;
};

const assertId = (id) => {
    if (!isObjectId(id)) {
        throw new Error(
            `Cast to ObjectId failed for value "${id}" (type string) at path "_id" for model "TrackerFieldOption"`,
        );
    }
    return String(id).toLowerCase();
};

const OPENJSON_ROWS = `OPENJSON(@rows) WITH (
    DocId CHAR(24) '$.DocId', Field NVARCHAR(MAX) '$.Field', [Value] NVARCHAR(MAX) '$.Value',
    CreatedAt DATETIME2(3) '$.CreatedAt', UpdatedAt DATETIME2(3) '$.UpdatedAt'
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

const find = async ({ field } = {}, executor) => {
    const request = await createRequest(executor);
    request.input('field', sql.NVarChar(100), field || null);
    const result = await request.query(`
        SELECT ${SELECT_COLUMNS} FROM ${TABLE}
        WHERE (@field IS NULL OR Field = @field)
        ORDER BY Field, [Value];`);
    return result.recordset.map(rowToDoc);
};

const findOrCreate = async (field, value, executor) => {
    const request = await createRequest(executor);
    request.input('field', sql.NVarChar(100), field);
    request.input('value', sql.NVarChar(400), value);
    request.input('docId', sql.Char(24), newObjectId());
    const result = await request.query(`
        BEGIN TRY
            BEGIN TRANSACTION;
            UPDATE ${TABLE} WITH (UPDLOCK, HOLDLOCK) SET UpdatedAt = SYSUTCDATETIME()
                WHERE Field = @field AND [Value] = @value;
            IF @@ROWCOUNT = 0
                INSERT INTO ${TABLE} (DocId, Field, [Value], CreatedAt, UpdatedAt)
                VALUES (@docId, @field, @value, SYSUTCDATETIME(), SYSUTCDATETIME());
            COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
            THROW;
        END CATCH;
        SELECT ${SELECT_COLUMNS} FROM ${TABLE} WHERE Field = @field AND [Value] = @value;`);
    return rowToDoc(result.recordset[0]);
};

const updateById = async (id, { field, value }, executor) => {
    const request = await createRequest(executor);
    request.input('docId', sql.Char(24), assertId(id));
    request.input('field', sql.NVarChar(100), field || null);
    request.input('value', sql.NVarChar(400), value);
    const result = await request.query(`
        UPDATE ${TABLE} SET Field = COALESCE(@field, Field), [Value] = @value, UpdatedAt = SYSUTCDATETIME()
        OUTPUT inserted.DocId, inserted.Field, inserted.[Value], inserted.CreatedAt, inserted.UpdatedAt
        WHERE DocId = @docId;`);
    return result.recordset[0] ? rowToDoc(result.recordset[0]) : null;
};

const deleteById = async (id, executor) => {
    const request = await createRequest(executor);
    request.input('docId', sql.Char(24), assertId(id));
    const result = await request.query(`
        DELETE FROM ${TABLE}
        OUTPUT deleted.DocId, deleted.Field, deleted.[Value], deleted.CreatedAt, deleted.UpdatedAt
        WHERE DocId = @docId;`);
    return result.recordset[0] ? rowToDoc(result.recordset[0]) : null;
};

const insertMissing = (pairs, executor) => {
    const now = toSqlDateTime(new Date());
    const rows = pairs.map(({ field, value }) => ({
        DocId: newObjectId(),
        Field: field,
        Value: value,
        CreatedAt: now,
        UpdatedAt: now,
    }));
    return runChunked(
        rows,
        `
        INSERT INTO ${TABLE} (DocId, Field, [Value], CreatedAt, UpdatedAt)
        SELECT s.DocId, s.Field, s.[Value], s.CreatedAt, s.UpdatedAt FROM ${OPENJSON_ROWS}
        WHERE NOT EXISTS (SELECT 1 FROM ${TABLE} AS t WHERE t.Field = s.Field AND t.[Value] = s.[Value]);`,
        executor,
    );
};

const deleteAll = async (executor) => {
    const request = await createRequest(executor);
    const result = await request.query(`DELETE FROM ${TABLE};`);
    return result.rowsAffected[0] || 0;
};

module.exports = {
    rowToDoc,
    find,
    findOrCreate,
    updateById,
    deleteById,
    insertMissing,
    deleteAll,
};

