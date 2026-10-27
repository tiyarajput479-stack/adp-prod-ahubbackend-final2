
const { sql, createRequest, toSqlDateTime } = require('../helpers/sqlDb');
const { newObjectId, objectIdTime } = require('../helpers/objectId');

const TABLE = 'dbo.ResourceAudit';
const CHUNK_SIZE = 500;
const MAX_LIMIT = 1000;

const TEXT_COLUMNS = [
    { column: 'Action', max: 20 },
    { column: 'ResourceId', max: 64 },
    { column: 'ResourceName', max: 400 },
    { column: 'ProjectProduct', max: 400 },
    { column: 'ActorEsId', max: 200 },
    { column: 'ActorName', max: 400 },
    { column: 'ActorEmail', max: 400 },
    { column: 'Changes', max: null },
    { column: 'Snapshot', max: null },
    { column: 'CorrelationId', max: 100 },
];
const COLUMN_NAMES = TEXT_COLUMNS.map((c) => c.column);
const q = (column) => `[${column}]`;
const SELECT_COLUMNS = `DocId, ${COLUMN_NAMES.map(q).join(', ')}, CreatedAt`;

const INSERT_SQL = `
INSERT INTO ${TABLE} (DocId, ${COLUMN_NAMES.map(q).join(', ')}, CreatedAt)
SELECT s.DocId, ${COLUMN_NAMES.map((c) => `s.${q(c)}`).join(', ')}, ISNULL(s.CreatedAt, SYSUTCDATETIME())
FROM OPENJSON(@rows) WITH (
    DocId CHAR(24) '$.DocId',
    ${COLUMN_NAMES.map((c) => `${q(c)} NVARCHAR(MAX) '$.${c}'`).join(',\n    ')},
    CreatedAt DATETIME2(3) '$.CreatedAt'
) AS s
WHERE NOT EXISTS (SELECT 1 FROM ${TABLE} AS t WHERE t.DocId = s.DocId);`;

const toText = (value) => (value === undefined || value === null ? null : String(value));

const entryToRow = (entry = {}, docId, createdAt) => ({
    DocId: docId,
    Action: toText(entry.action),
    ResourceId: toText(entry.resourceId),
    ResourceName: toText(entry.resourceName ?? ''),
    ProjectProduct: toText(entry.projectProduct ?? ''),
    ActorEsId: toText(entry.actor?.esId ?? ''),
    ActorName: toText(entry.actor?.name ?? ''),
    ActorEmail: toText(entry.actor?.email ?? ''),
    Changes: JSON.stringify(entry.changes ?? []),
    Snapshot: entry.snapshot === undefined || entry.snapshot === null ? null : JSON.stringify(entry.snapshot),
    CorrelationId: toText(entry.correlationId ?? ''),
    CreatedAt: toSqlDateTime(createdAt || objectIdTime(docId)),
});

const rowToEntry = (row) => ({
    _id: row.DocId,
    action: row.Action,
    resourceId: row.ResourceId ?? undefined,
    resourceName: row.ResourceName ?? '',
    projectProduct: row.ProjectProduct ?? '',
    actor: {
        esId: row.ActorEsId ?? '',
        name: row.ActorName ?? '',
        email: row.ActorEmail ?? '',
    },
    changes: row.Changes ? JSON.parse(row.Changes) : [],
    snapshot: row.Snapshot ? JSON.parse(row.Snapshot) : null,
    correlationId: row.CorrelationId ?? '',
    createdAt: row.CreatedAt instanceof Date ? row.CreatedAt.toISOString() : row.CreatedAt,
});

const insertRows = async (rows, executor) => {
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const request = await createRequest(executor);
        request.input('rows', sql.NVarChar(sql.MAX), JSON.stringify(rows.slice(i, i + CHUNK_SIZE)));
        const result = await request.query(INSERT_SQL);
        inserted += result.rowsAffected[0] || 0;
    }
    return inserted;
};

const insertEntries = (entries, executor) => {
    const now = new Date();
    return insertRows(entries.map((entry) => entryToRow(entry, newObjectId(), now)), executor);
};

const find = async ({ resourceId, action, limit } = {}, executor) => {
    const request = await createRequest(executor);
    request.input('limit', sql.Int, Math.min(Math.max(Math.floor(Number(limit)) || 200, 1), MAX_LIMIT));
    request.input('resourceId', sql.NVarChar(64), resourceId ? String(resourceId) : null);
    request.input('action', sql.NVarChar(20), action ? String(action).toLowerCase() : null);
    const result = await request.query(`
        SELECT TOP (@limit) ${SELECT_COLUMNS}
        FROM ${TABLE}
        WHERE (@resourceId IS NULL OR ResourceId = @resourceId)
          AND (@action IS NULL OR [Action] = @action)
        ORDER BY CreatedAt DESC, DocId ASC;`);
    return result.recordset.map(rowToEntry);
};

module.exports = {
    entryToRow,
    rowToEntry,
    insertEntries,
    find,
};