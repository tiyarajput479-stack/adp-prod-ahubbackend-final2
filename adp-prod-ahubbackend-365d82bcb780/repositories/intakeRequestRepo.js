const { sql, createRequest, getPool, toSqlDateTime } = require('../helpers/sqlDb');
const counterRepo = require('./counterRepo');
const { isKnownPath, castUpdate, castListFilter, buildIntakeRequestDocument } = require('../helpers/intakeRequestCast');
const { newObjectId } = require('../helpers/objectId');

const TABLE = 'dbo.IntakeRequest';
const OPP_ID_SEQUENCE = 'intakeOppId';
const OPP_ID_PREFIX = 'OPP';
const OPP_ID_PAD = 6;

const FIELDS = [
    ['oppId', 'text'],
    ['requestTitle', 'text'],
    ['requestorId', 'text'],
    ['requestorName', 'text'],
    ['submittedBy', 'text'],
    ['owner', 'text'],
    ['countryBu', 'text'],
    ['subBu', 'json'],
    ['region', 'json'],
    ['offerImpact', 'json'],
    ['dtOfferImpact', 'text'],
    ['savingsDollar', 'number'],
    ['savingsFte', 'number'],
    ['fteAnnualSavings', 'number'],
    ['expectedDelivery', 'text'],
    ['team', 'text'],
    ['status', 'text'],
    ['opsStatus', 'text'],
    ['opsUpdatedBy', 'text'],
    ['gptDelivery', 'text'],
    ['stage', 'text'],
    ['solutionType', 'text'],
    ['solution', 'text'],
    ['deliveryWeeks', 'number'],
    ['problemStatement', 'text'],
    ['targetDate', 'text'],
    ['opportunityOverview', 'text'],
    ['opportunity', 'text'],
    ['incidentSavingsDollar', 'number'],
    ['timeSavingsPerMonth', 'number'],
    ['shore', 'text'],
    ['incidentsSaved', 'number'],
    ['timeSavings', 'number'],
    ['clientsImpacted', 'number'],
    ['fteSavingsDollar', 'number'],
    ['revenue', 'number'],
    ['statusChangedOn', 'text'],
    ['completedOn', 'text'],
    ['submittedOn', 'text'],
    ['created', 'text'],
    ['modified', 'text'],
    ['requestType', 'text'],
    ['serviceImplementation', 'json'],
    ['strategicInitiatives', 'json'],
    ['orgReadiness', 'text'],
    ['benefitTypes', 'json'],
    ['productivityLevel', 'text'],
    ['costAvoidanceLevel', 'text'],
    ['complianceRiskLevel', 'text'],
    ['technicalDetailsMode', 'text'],
    ['technicalDependencies', 'text'],
    ['bcProcessOwner', 'text'],
    ['bcProjectSponsor', 'text'],
    ['bcProblemStatement', 'text'],
    ['bcGoalStatement', 'text'],
    ['bcScopeIn', 'text'],
    ['bcScopeOut', 'text'],
    ['businessCase', 'json'],
    ['timelineDate', 'text'],
    ['timelineNotes', 'text'],
    ['processName', 'text'],
    ['tool', 'text'],
    ['systemRequestTypes', 'json'],
    ['systemSource', 'text'],
    ['legalDetails', 'text'],
    ['complianceDetails', 'text'],
    ['deliveryModel', 'text'],
    ['securityMode', 'text'],
    ['securityRiskLevel', 'text'],
    ['securityIncidents', 'number'],
    ['timeMode', 'text'],
    ['costReductionLevel', 'text'],
    ['minutesSavedPerTransaction', 'number'],
    ['annualVolume', 'number'],
    ['revenueMode', 'text'],
    ['revenueImpact', 'number'],
    ['revenueGenerationLevel', 'text'],
    ['efficiencyLevel', 'text'],
    ['businessValueComment', 'text'],
    ['businessValueValidated', 'bool'],
    ['calculatedBusinessValue', 'number'],
    ['dtStrategic', 'number'],
    ['dtFeasibility', 'number'],
    ['dtInvestment', 'number'],
    ['dtSizing', 'text'],
    ['dtRoi', 'number'],
    ['dtBenefitScore', 'number'],
    ['dtTechnicalReadiness', 'text'],
    ['dtImplementationEffort', 'text'],
    ['dtTimeToValueGpt', 'text'],
    ['dtDevTimeDt', 'text'],
    ['dtOrgReadiness', 'text'],
    ['dtPrioritizationScore', 'number'],
    ['dtCommitmentRecommendation', 'text'],
    ['dtRejectionReason', 'text'],
    ['dtDeliveryEstimate', 'text'],
    ['dtDelivery', 'text'],
    ['dtRequiredAttendees', 'text'],
    ['dtNotes', 'text'],
    ['dtEvaluator', 'text'],
    ['dtEvaluatedOn', 'text'],
    ['dtFeasibilityCriteria', 'text'],
    ['dtDraftSavedOn', 'text'],
    ['gptStrategic', 'number'],
    ['gptFeasibility', 'number'],
    ['gptInvestment', 'number'],
    ['gptRoi', 'number'],
    ['gptSizing', 'text'],
    ['gptBenefitScore', 'number'],
    ['gptTechnicalReadiness', 'text'],
    ['gptImplementationEffort', 'text'],
    ['gptTimeToValueGpt', 'text'],
    ['gptDevTimeDt', 'text'],
    ['gptOrgReadiness', 'text'],
    ['gptPrioritizationScore', 'number'],
    ['gptCommitmentRecommendation', 'text'],
    ['gptRejectionReason', 'text'],
    ['gptDeliveryEstimate', 'text'],
    ['gptNotes', 'text'],
    ['gptEvaluator', 'text'],
    ['gptEvaluatedOn', 'text'],
    ['gptFeasibilityCriteria', 'text'],
    ['gptDraftSavedOn', 'text'],
    ['gptRequiredAttendees', 'text'],
    ['reviewOutcome', 'text'],
    ['reviewerNotes', 'text'],
    ['evaluatorNotes', 'text'],
    ['finalReviewer', 'text'],
    ['reviewDraftSavedOn', 'text'],
];
const HISTORY_FIELDS = [
    ['status', 'text'],
    ['action', 'text'],
    ['actorName', 'text'],
    ['actorEmail', 'text'],
    ['changedOn', 'text'],
    ['note', 'text'],
];
const CHILDREN = [
    { name: 'statusHistory', table: 'dbo.IntakeRequestStatusHistory', fields: HISTORY_FIELDS },
    { name: 'opsStatusHistory', table: 'dbo.IntakeRequestOpsStatusHistory', fields: HISTORY_FIELDS },
    {
        name: 'buInputRows',
        table: 'dbo.IntakeRequestBuInputRow',
        fields: [
            ['bu', 'text'],
            ['source', 'text'],
            ['subBu', 'text'],
            ['region', 'text'],
            ['months', 'json'],
        ],
    },
    {
        name: 'attachments',
        table: 'dbo.IntakeRequestAttachmentInfo',
        fields: [
            ['name', 'text'],
            ['size', 'number'],
            ['type', 'text'],
        ],
    },
].map((child) => ({ ...child, present: `${column(child.name)}Present` }));

function column(field) {
    return field.charAt(0).toUpperCase() + field.slice(1);
}
const q = (name) => `[${name}]`;
const DATA_COLUMNS = [
    ...FIELDS.map(([f]) => column(f)),
    'ExtraFields',
    ...CHILDREN.map((c) => c.present),
    'CreatedAt',
    'UpdatedAt',
    'Version',
];
const SELECT_COLUMNS = ['DocId', ...DATA_COLUMNS].map(q).join(', ');
const KNOWN_KEYS = new Set([
    '_id',
    '__v',
    'createdAt',
    'updatedAt',
    ...FIELDS.map(([f]) => f),
    ...CHILDREN.map((c) => c.name),
]);
const SQL_TYPE = {
    text: () => sql.NVarChar(sql.MAX),
    json: () => sql.NVarChar(sql.MAX),
    number: () => sql.Float,
    bool: () => sql.Bit,
};

const encode = (kind, value, where) => {
    if (value === null) throw new Error(`${where} is null (not supported)`);
    if (kind === 'text' && typeof value !== 'string') throw new Error(`${where} is not text`);
    if (kind === 'number' && !(typeof value === 'number' && Number.isFinite(value))) {
        throw new Error(`${where} is not a finite number`);
    }
    if (kind === 'bool' && typeof value !== 'boolean') throw new Error(`${where} is not true/false`);
    if (kind === 'json') {
        if (typeof value !== 'object') throw new Error(`${where} is not a list or object`);
        return JSON.stringify(value);
    }
    return value;
};
const decode = (kind, value) => {
    if (kind === 'json') return JSON.parse(value);
    if (kind === 'bool') return Boolean(value);
    if (kind === 'number') return Number(value);
    return value;
};
const toDate = (value) => (value instanceof Date ? value : new Date(/Z$/.test(value) ? value : `${value}Z`));

const docToParts = (doc) => {
    const docId = String(doc._id);
    const row = { DocId: docId };
    FIELDS.forEach(([f, kind]) => {
        row[column(f)] = doc[f] === undefined ? null : encode(kind, doc[f], `${docId} "${f}"`);
    });
    const extras = Object.keys(doc).filter((k) => !KNOWN_KEYS.has(k) && doc[k] !== undefined);
    row.ExtraFields = extras.length
        ? JSON.stringify(Object.fromEntries(extras.map((k) => [k, doc[k]])))
        : null;
    const children = {};
    CHILDREN.forEach((child) => {
        const list = doc[child.name];
        if (list !== undefined && !Array.isArray(list))
            throw new Error(`${docId} "${child.name}" is not a list`);
        row[child.present] = Array.isArray(list);
        const known = new Set(child.fields.map(([f]) => f));
        children[child.name] = (list || []).map((item, position) => {
            const where = `${docId} "${child.name}[${position}]"`;
            if (!item || typeof item !== 'object' || Array.isArray(item))
                throw new Error(`${where} is not an object`);
            const unknown = Object.keys(item).filter((k) => !known.has(k) && item[k] !== undefined);
            if (unknown.length) throw new Error(`${where} has keys with no column: ${unknown.join(', ')}`);
            const childRow = { RequestDocId: docId, Position: position };
            child.fields.forEach(([f, kind]) => {
                childRow[column(f)] = item[f] === undefined ? null : encode(kind, item[f], `${where}.${f}`);
            });
            return childRow;
        });
    });
    row.CreatedAt = doc.createdAt ? toSqlDateTime(doc.createdAt) : null;
    row.UpdatedAt = doc.updatedAt ? toSqlDateTime(doc.updatedAt) : null;
    if (doc.__v !== undefined && !Number.isInteger(doc.__v))
        throw new Error(`${docId} "__v" is not a whole number`);
    row.Version = doc.__v === undefined ? null : doc.__v;
    return { row, children };
};

const partsToDoc = (row, childRows = {}) => {
    const doc = { _id: row.DocId };
    FIELDS.forEach(([f, kind]) => {
        if (row[column(f)] !== null && row[column(f)] !== undefined) doc[f] = decode(kind, row[column(f)]);
    });
    CHILDREN.forEach((child) => {
        if (!row[child.present]) return;
        doc[child.name] = (childRows[child.name] || [])
            .sort((a, b) => a.Position - b.Position)
            .map((childRow) => {
                const item = {};
                child.fields.forEach(([f, kind]) => {
                    const value = childRow[column(f)];
                    if (value !== null && value !== undefined) item[f] = decode(kind, value);
                });
                return item;
            });
    });
    if (row.ExtraFields) Object.assign(doc, JSON.parse(row.ExtraFields));
    if (row.CreatedAt) doc.createdAt = toDate(row.CreatedAt);
    if (row.UpdatedAt) doc.updatedAt = toDate(row.UpdatedAt);
    if (row.Version !== null && row.Version !== undefined) doc.__v = row.Version;
    return doc;
};

const canon = (value) => {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z?$/.test(value)) {
        return toDate(value).getTime();
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value === undefined ? null : value;
};
const partsDiffer = (a, b) =>
    DATA_COLUMNS.some((c) => canon(a.row[c]) !== canon(b.row[c])) ||
    CHILDREN.some((child) => {
        const x = a.children[child.name] || [];
        const y = b.children[child.name] || [];
        const cols = child.fields.map(([f]) => column(f));
        return (
            x.length !== y.length ||
            x.some((r, i) => cols.some((c) => canon(r[c]) !== canon(y[i][c])) || r.Position !== y[i].Position)
        );
    });

const loadChildren = async (docIds, executor) => {
    const byName = {};
    if (!docIds.length) return byName;
    const fetchChild = async (child) => {
        const request = await createRequest(executor);
        request.input('ids', sql.NVarChar(sql.MAX), JSON.stringify(docIds));
        const cols = ['RequestDocId', 'Position', ...child.fields.map(([f]) => column(f))].map(q).join(', ');
        const result = await request.query(`
            SELECT ${cols} FROM ${child.table}
            WHERE RequestDocId IN (SELECT [value] FROM OPENJSON(@ids))
            ORDER BY RequestDocId, Position;`);
        result.recordset.forEach((r) => {
            byName[r.RequestDocId] = byName[r.RequestDocId] || {};
            (byName[r.RequestDocId][child.name] = byName[r.RequestDocId][child.name] || []).push(r);
        });
    };

    if (executor) {
        for (const child of CHILDREN) {
            await fetchChild(child);
        }
    } else {
        await Promise.all(CHILDREN.map(fetchChild));
    }
    return byName;
};

const loadParts = async (where, inputs, orderBy, executor, lock = '') => {
    const request = await createRequest(executor);
    inputs.forEach(([name, type, value]) => request.input(name, type, value));
    const result = await request.query(
        `SELECT ${SELECT_COLUMNS} FROM ${TABLE} ${lock} ${where ? `WHERE ${where}` : ''} ORDER BY ${orderBy};`,
    );
    const children = await loadChildren(
        result.recordset.map((r) => r.DocId),
        executor,
    );
    return result.recordset.map((row) => {
        const childRows = children[row.DocId] || {};
        const byChild = {};
        CHILDREN.forEach((c) => {
            byChild[c.name] = childRows[c.name] || [];
        });
        return { row, children: byChild };
    });
};
const loadDocs = async (...args) => (await loadParts(...args)).map((p) => partsToDoc(p.row, p.children));

const addInputs = (request, row, columns = DATA_COLUMNS) => {
    columns.forEach((c) => {
        const field = FIELDS.find(([f]) => column(f) === c);
        const name = `p_${c}`;
        if (field) request.input(name, SQL_TYPE[field[1]](), row[c]);
        else if (c === 'ExtraFields') request.input(name, sql.NVarChar(sql.MAX), row[c]);
        else if (c.endsWith('Present')) request.input(name, sql.Bit, row[c]);
        else if (c === 'Version') request.input(name, sql.Int, row[c]);
        else request.input(name, sql.NVarChar(30), row[c]);
    });
};
const valueSql = (c) =>
    c === 'CreatedAt' || c === 'UpdatedAt' ? `CAST(@p_${c} AS DATETIME2(3))` : `@p_${c}`;


const childRowsEqual = (a, b, child) => {
    const cols = child.fields.map(([f]) => column(f));
    return (
        a.length === b.length &&
        !a.some((r, i) => cols.some((c) => canon(r[c]) !== canon(b[i][c])) || r.Position !== b[i].Position)
    );
};

const writeChildren = async (parts, executor, { replace, previous } = {}) => {
    const docId = parts.row.DocId;
    for (const child of CHILDREN) {
        const rows = parts.children[child.name] || [];
        if (replace) {
            const prevRows = previous?.children[child.name] || [];
            if (childRowsEqual(prevRows, rows, child)) continue;
            const del = await createRequest(executor);
            del.input('docId', sql.Char(24), docId);
            await del.query(`DELETE FROM ${child.table} WHERE RequestDocId = @docId;`);
        }
        const cols = ['RequestDocId', 'Position', ...child.fields.map(([f]) => column(f))];
        const kinds = ['id', 'pos', ...child.fields.map(([, kind]) => kind)];
        for (let i = 0; i < rows.length; i += 100) {
            const chunk = rows.slice(i, i + 100);
            const request = await createRequest(executor);
            const values = chunk.map(
                (r, ri) =>
                    `(${cols
                        .map((c, ci) => {
                            const name = `c${ri}_${ci}`;
                            const kind = kinds[ci];
                            if (kind === 'id') request.input(name, sql.Char(24), r[c]);
                            else if (kind === 'pos') request.input(name, sql.Int, r[c]);
                            else request.input(name, SQL_TYPE[kind](), r[c]);
                            return `@${name}`;
                        })
                        .join(', ')})`,
            );
            await request.query(
                `INSERT INTO ${child.table} (${cols.map(q).join(', ')}) VALUES ${values.join(', ')};`,
            );
        }
    }
};

const insertParts = async (parts, executor) => {
    const request = await createRequest(executor);
    request.input('docId', sql.Char(24), parts.row.DocId);
    addInputs(request, parts.row);
    await request.query(`INSERT INTO ${TABLE} (DocId, ${DATA_COLUMNS.map(q).join(', ')})
        VALUES (@docId, ${DATA_COLUMNS.map(valueSql).join(', ')});`);
    await writeChildren(parts, executor, { replace: false });
};

const updateParts = async (parts, executor, previousParts) => {
    const request = await createRequest(executor);
    request.input('docId', sql.Char(24), parts.row.DocId);
    const changedColumns = previousParts
        ? DATA_COLUMNS.filter((c) => canon(previousParts.row[c]) !== canon(parts.row[c]))
        : DATA_COLUMNS;
    if (changedColumns.length) {
        addInputs(request, parts.row, changedColumns);
        await request.query(`UPDATE ${TABLE} SET ${changedColumns.map((c) => `${q(c)} = ${valueSql(c)}`).join(', ')}
            WHERE DocId = @docId;`);
    }
    await writeChildren(parts, executor, { replace: true, previous: previousParts });
};

const inTransaction = async (executor, work) => {
    if (executor) return work(executor);
    const tx = new sql.Transaction(await getPool());
    await tx.begin();
    try {
        const result = await work(tx);
        await tx.commit();
        return result;
    } catch (err) {
        await tx.rollback().catch(() => {});
        throw err;
    }
};

const applyUpdate = (doc, cast, now) => {
    const next = { ...doc };
    Object.entries(cast.set).forEach(([p, value]) => {
        next[p] = value;
    });
    Object.entries(cast.push).forEach(([p, value]) => {
        next[p] = [...(Array.isArray(doc[p]) ? doc[p] : []), value];
    });
    next.updatedAt = now;
    return next;
};

const BY_OPP_ID = 'OppId = @oppId AND DATALENGTH(OppId) = DATALENGTH(@oppId)';
const oppIdInput = (oppId) => [['oppId', sql.NVarChar(sql.MAX), String(oppId)]];

const findAll = async ({ projection } = {}, executor) => {
    const docs = await loadDocs('', [], 'Seq', executor);
    if (!projection) return docs;
    const keep = Object.keys(projection).filter((k) => projection[k]);
    return docs.map((doc) =>
        Object.fromEntries(Object.entries(doc).filter(([k]) => k === '_id' || keep.includes(k))),
    );
};

const findOneByOppId = async (oppId, executor) =>
    (await loadDocs(BY_OPP_ID, oppIdInput(oppId), 'Seq', executor))[0] || null;

const findPipelineRows = async (executor) => {
    const request = await createRequest(executor);
    const result = await request.query(`
        SELECT CountryBu, Stage, Status, SavingsFte, SavingsDollar
        FROM ${TABLE};`);
    return result.recordset.map((r) => ({
        countryBu: r.CountryBu,
        stage: r.Stage,
        status: r.Status,
        savingsFte: r.SavingsFte,
        savingsDollar: r.SavingsDollar,
    }));
};

const escapeLike = (text) => String(text).replace(/[\\%_\[]/g, (c) => `\\${c}`);

const listNewestFirst = async (filter, skip, limit, executor) => {
    const cast = castListFilter(filter);
    const request = await createRequest(executor);
    const conditions = [];
    if (cast.stage !== undefined) {
        request.input('stage', sql.NVarChar(sql.MAX), cast.stage);
        conditions.push('Stage = @stage');
    }
    if (cast.countryBu !== undefined) {
        request.input('countryBu', sql.NVarChar(sql.MAX), cast.countryBu);
        conditions.push('CountryBu = @countryBu');
    }
    if (cast.$or !== undefined) {
        const rawQ = cast.$or[0]?.requestTitle?.$regex ?? cast.$or[1]?.oppId?.$regex ?? '';
        request.input('q', sql.NVarChar(sql.MAX), `%${escapeLike(rawQ)}%`);
        conditions.push("(RequestTitle COLLATE Latin1_General_CI_AS LIKE @q ESCAPE '\\' OR OppId COLLATE Latin1_General_CI_AS LIKE @q ESCAPE '\\')");
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    request.input('skip', sql.Int, skip);
    request.input('limit', sql.Int, limit);
    const result = await request.query(`
        SELECT DocId, COUNT(*) OVER() AS TotalCount
        FROM ${TABLE}
        ${where}
        ORDER BY CASE WHEN CreatedAt IS NULL THEN 1 ELSE 0 END, CreatedAt DESC, Seq ASC
        OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;`);
    const total = result.recordset[0] ? Number(result.recordset[0].TotalCount) : 0;
    const page = result.recordset.map((r) => r.DocId);
    const docs = page.length
        ? await loadDocs(
              'DocId IN (SELECT [value] FROM OPENJSON(@ids))',
              [['ids', sql.NVarChar(sql.MAX), JSON.stringify(page)]],
              'Seq',
              executor,
          )
        : [];
    const byId = new Map(docs.map((d) => [d._id, d]));
    return [page.map((id) => byId.get(id)), total];
};

const create = async (payload, executor) => {
    let oppId = payload.oppId && String(payload.oppId).trim() ? payload.oppId : null;
    if (!oppId) {
        const seq = await counterRepo.next(OPP_ID_SEQUENCE, executor);
        oppId = `${OPP_ID_PREFIX}-${String(seq).padStart(OPP_ID_PAD, '0')}`;
    }
    const doc = buildIntakeRequestDocument({ ...payload, oppId });
    doc._id = newObjectId();
    const now = new Date();
    doc.createdAt = now;
    doc.updatedAt = now;
    doc.__v = 0;
    const parts = docToParts(doc);
    await inTransaction(executor, (tx) => insertParts(parts, tx));
    return doc;
};

const updateByOppId = async (oppId, update, executor) => {
    const cast = await castUpdate(update, { validate: true });
    return inTransaction(executor, async (tx) => {
        const [current] = await loadDocs(BY_OPP_ID, oppIdInput(oppId), 'Seq', tx, 'WITH (UPDLOCK, HOLDLOCK)');
        if (!current) return null;
        const next = applyUpdate(current, cast, new Date());
        await updateParts(docToParts(next), tx, docToParts(current));
        return next;
    });
};

const bulkWrite = async (ops, executor) => {
    let matchedCount = 0;
    let modifiedCount = 0;
    let firstError = null;
    for (const op of ops) {
        try {
            const { filter, update } = op.updateOne;
            const cast = await castUpdate(update, { validate: false });
            await inTransaction(executor, async (tx) => {
                const [current] = await loadDocs(
                    'DocId = @docId',
                    [['docId', sql.Char(24), String(filter._id)]],
                    'Seq',
                    tx,
                    'WITH (UPDLOCK, HOLDLOCK)',
                );
                if (!current) return;
                matchedCount += 1;
                const currentParts = docToParts(current);
                const nextParts = docToParts(applyUpdate(current, cast, new Date()));
                if (partsDiffer(currentParts, nextParts)) {
                    await updateParts(nextParts, tx, currentParts);
                    modifiedCount += 1;
                }
            });
        } catch (err) {
            firstError = firstError || err;
        }
    }
    if (firstError) throw firstError;
    return { matchedCount, modifiedCount };
};

const dashboardAggregates = async (executor) => {
    const request = await createRequest(executor);
    const result = await request.query(`
        SELECT
            SUM(CASE WHEN Stage IS NULL OR Stage <> 'Delivered' THEN 1 ELSE 0 END) AS ActiveCount,
            SUM(SavingsFte) AS TotalFteSavings,
            SUM(SavingsDollar) AS TotalAnnualValue,
            AVG(CASE WHEN DeliveryWeeks > 0 THEN DeliveryWeeks END) AS AvgDeliveryWeeks,
            COUNT(*) AS RowTotal,
            COUNT(CASE WHEN DeliveryWeeks > 0 THEN 1 END) AS WeeksCount
        FROM ${TABLE};`);
    const totals = result.recordset[0] || {};
    const rowCount = Number(totals.RowTotal || 0);
    const weeksCount = Number(totals.WeeksCount || 0);
    const active = Number(totals.ActiveCount || 0);
    const sums = rowCount
        ? [{ _id: null, totalFteSavings: Number(totals.TotalFteSavings) || 0, totalAnnualValue: Number(totals.TotalAnnualValue) || 0 }]
        : [];
    const avg = weeksCount
        ? [{ _id: null, avgDeliveryWeeks: Number(totals.AvgDeliveryWeeks) || 0 }]
        : [];

    const groupBy = async (groupCol, fallback, sumCol) => {
        const req = await createRequest(executor);
        req.input('fallback', sql.NVarChar(100), fallback);
        const res = await req.query(`
            SELECT ISNULL(${groupCol}, @fallback) AS GroupId, SUM(${sumCol}) AS Value
            FROM ${TABLE}
            GROUP BY ISNULL(${groupCol}, @fallback)
            ORDER BY GroupId;`);
        return res.recordset.map((r) => ({ _id: r.GroupId, value: Number(r.Value) || 0 }));
    };
    const stageGroup = async () => {
        const req = await createRequest(executor);
        const res = await req.query(`
            SELECT ISNULL(Stage, 'Submitted') AS GroupId, COUNT(*) AS Y, MIN(Seq) AS FirstSeq
            FROM ${TABLE}
            GROUP BY ISNULL(Stage, 'Submitted')
            ORDER BY FirstSeq;`);
        return res.recordset.map((r) => ({ _id: r.GroupId, y: Number(r.Y) }));
    };

    const [country, solution, stage, fteCountry] = await Promise.all([
        groupBy('CountryBu', 'Unassigned', 'SavingsDollar'),
        groupBy('SolutionType', 'Existing', 'SavingsDollar'),
        stageGroup(),
        groupBy('CountryBu', 'Unassigned', 'SavingsFte'),
    ]);

    return [active, sums, avg, country, solution, stage, fteCountry];
};

module.exports = {
    FIELDS,
    CHILDREN,
    KNOWN_KEYS,
    docToParts,
    partsToDoc,
    partsDiffer,
    findAll,
    findOneByOppId,
    findPipelineRows,
    listNewestFirst,
    create,
    updateByOppId,
    bulkWrite,
    dashboardAggregates,
};
