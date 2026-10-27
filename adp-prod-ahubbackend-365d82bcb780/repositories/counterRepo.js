const { sql, createRequest } = require('../helpers/sqlDb');

// dbo.Counter: named sequences (Mongo `counters`), e.g. intakeOppId for the OPP-000123 request ids.

const TABLE = 'dbo.Counter';

// Like CounterModel.next(name): adds 1 and returns the new value in one locked statement, so two callers can
// never get the same number. A missing counter starts at 1 (Mongo: upsert of { seq: 0 } + $inc 1).
const next = async (name, executor) => {
    const request = await createRequest(executor);
    request.input('name', sql.NVarChar(200), String(name));
    const result = await request.query(`
        MERGE ${TABLE} WITH (HOLDLOCK) AS t
        USING (SELECT @name AS [Name]) AS s
        ON t.[Name] = s.[Name] AND DATALENGTH(t.[Name]) = DATALENGTH(s.[Name])
        WHEN MATCHED THEN UPDATE SET Seq = t.Seq + 1
        WHEN NOT MATCHED THEN INSERT ([Name], Seq) VALUES (@name, 1)
        OUTPUT inserted.Seq;`);
    return Number(result.recordset[0].Seq);
};

module.exports = { next };
