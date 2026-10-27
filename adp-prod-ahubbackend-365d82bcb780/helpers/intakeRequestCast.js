const PIPELINE_STAGES = [
    'Submitted',
    'Under Evaluation',
    'Ready for Review',
    'Submitted to Support',
    'TECH APPROVED - SHARED SUPPORT',
    'TECH APPROVED - GPT FULL SOLUTION',
    'TECH APPROVED - DIGITECH FULL SOLUTION',
    'REJECTED',
    'Committed - Shared Support',
    'Committed - GPT Full Solution',
    'Committed - DT Full Solution',
    'Rejected - Existing DT Solution',
    'Rejected - Value Proposition',
    'Rejected by GPT Team',
    'Rejected by DT Team',
    'Under GPT Evaluation',
    'Under DT Evaluation',
    'Committed by GPT',
    'Committed by DT',
];

const normalizeOfferArraySetter = (value) => {
    const pickLabel = (item) => {
        if (item == null) return '';
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'object') {
            return String(item.value || item.label || item.title || item.name || '').trim();
        }
        return String(item).trim();
    };
    let parts = [];
    if (Array.isArray(value)) parts = value.map(pickLabel);
    else if (value && typeof value === 'object') parts = [pickLabel(value)];
    else if (typeof value === 'string') parts = value.split(/[;,]/).map((item) => item.trim());
    const cleaned = parts.filter((item) => item && item.toLowerCase() !== '[object object]');
    return Array.from(new Set(cleaned));
};

const FIELD_SPECS = {
    oppId: { kind: 'text', required: true },
    requestTitle: { kind: 'text', required: true, trim: true },
    requestorId: { kind: 'text', default: '', trim: true },
    requestorName: { kind: 'text', default: '', trim: true },
    submittedBy: { kind: 'text', default: '', trim: true },
    owner: { kind: 'text', default: '', trim: true },
    countryBu: { kind: 'text', default: 'Unassigned', trim: true },
    subBu: { kind: 'stringArray', default: [] },
    region: { kind: 'stringArray', default: [] },
    offerImpact: { kind: 'stringArray', default: [], setter: normalizeOfferArraySetter },
    dtOfferImpact: { kind: 'text', default: '', trim: true },
    savingsDollar: { kind: 'number', default: 0 },
    savingsFte: { kind: 'number', default: 0 },
    fteAnnualSavings: { kind: 'number', default: 0 },
    expectedDelivery: { kind: 'text', default: '', trim: true },
    team: { kind: 'text', default: '', trim: true },
    status: { kind: 'text', default: 'Submitted', trim: true },
    opsStatus: { kind: 'text', default: '', trim: true },
    opsUpdatedBy: { kind: 'text', default: '', trim: true },
    gptDelivery: { kind: 'text', default: '', trim: true },
    stage: { kind: 'text', default: 'Submitted', enum: PIPELINE_STAGES },
    solutionType: { kind: 'text', default: 'Existing', trim: true },
    solution: { kind: 'text', default: 'Existing', trim: true },
    deliveryWeeks: { kind: 'number', default: 0 },
    problemStatement: { kind: 'text', default: '', trim: true },
    targetDate: { kind: 'text', default: '', trim: true },
    opportunityOverview: { kind: 'text', default: '', trim: true },
    opportunity: { kind: 'text', default: '', trim: true },
    incidentSavingsDollar: { kind: 'number', default: 0 },
    timeSavingsPerMonth: { kind: 'number', default: 0 },
    shore: { kind: 'text', default: '', trim: true },
    incidentsSaved: { kind: 'number', default: 0 },
    timeSavings: { kind: 'number', default: 0 },
    clientsImpacted: { kind: 'number', default: 0 },
    fteSavingsDollar: { kind: 'number', default: 0 },
    revenue: { kind: 'number', default: 0 },
    statusChangedOn: { kind: 'text', default: '', trim: true },
    completedOn: { kind: 'text', default: '', trim: true },
    submittedOn: { kind: 'text', default: '', trim: true },
    created: { kind: 'text', default: '', trim: true },
    modified: { kind: 'text', default: '', trim: true },
    requestType: { kind: 'text', default: '', trim: true },
    serviceImplementation: { kind: 'stringArray', default: [] },
    strategicInitiatives: { kind: 'stringArray', default: [] },
    orgReadiness: { kind: 'text', default: '', trim: true },
    benefitTypes: { kind: 'stringArray', default: [] },
    productivityLevel: { kind: 'text', default: '', trim: true },
    costAvoidanceLevel: { kind: 'text', default: '', trim: true },
    complianceRiskLevel: { kind: 'text', default: '', trim: true },
    technicalDetailsMode: { kind: 'text', default: 'text', enum: ['text', 'attachment'] },
    technicalDependencies: { kind: 'text', default: '', trim: true },
    bcProcessOwner: { kind: 'text', default: '', trim: true },
    bcProjectSponsor: { kind: 'text', default: '', trim: true },
    bcProblemStatement: { kind: 'text', default: '', trim: true },
    bcGoalStatement: { kind: 'text', default: '', trim: true },
    bcScopeIn: { kind: 'text', default: '', trim: true },
    bcScopeOut: { kind: 'text', default: '', trim: true },
    businessCase: {
        kind: 'nested',
        nestedFields: ['processOwner', 'projectSponsor', 'problemStatement', 'goalStatement', 'scopeIn', 'scopeOut'],
    },
    timelineDate: { kind: 'text', default: '', trim: true },
    timelineNotes: { kind: 'text', default: '', trim: true },
    processName: { kind: 'text', default: '', trim: true },
    tool: { kind: 'text', default: '', trim: true },
    systemRequestTypes: { kind: 'stringArray', default: [] },
    systemSource: { kind: 'text', default: '', trim: true },
    legalDetails: { kind: 'text', default: '', trim: true },
    complianceDetails: { kind: 'text', default: '', trim: true },
    deliveryModel: { kind: 'text', default: '', trim: true },
    securityMode: { kind: 'text', default: 'number', enum: ['number', 'risk'] },
    securityRiskLevel: { kind: 'text', default: '', trim: true },
    securityIncidents: { kind: 'number', default: 0 },
    timeMode: { kind: 'text', default: 'details', enum: ['details', 'cost'] },
    costReductionLevel: { kind: 'text', default: '', trim: true },
    minutesSavedPerTransaction: { kind: 'number', default: 0 },
    annualVolume: { kind: 'number', default: 0 },
    revenueMode: { kind: 'text', default: 'amount', enum: ['amount', 'level'] },
    revenueImpact: { kind: 'number', default: 0 },
    revenueGenerationLevel: { kind: 'text', default: '', trim: true },
    efficiencyLevel: { kind: 'text', default: '', trim: true },
    businessValueComment: { kind: 'text', default: '', trim: true },
    businessValueValidated: { kind: 'bool', default: false },
    calculatedBusinessValue: { kind: 'number', default: 0 },
    dtStrategic: { kind: 'number', default: 0 },
    dtFeasibility: { kind: 'number', default: 0 },
    dtInvestment: { kind: 'number', default: 0 },
    dtSizing: { kind: 'text', default: '', trim: true },
    dtRoi: { kind: 'number', default: 0 },
    dtBenefitScore: { kind: 'number', default: 0 },
    dtTechnicalReadiness: { kind: 'text', default: '', trim: true },
    dtImplementationEffort: { kind: 'text', default: '', trim: true },
    dtTimeToValueGpt: { kind: 'text', default: '', trim: true },
    dtDevTimeDt: { kind: 'text', default: '', trim: true },
    dtOrgReadiness: { kind: 'text', default: '', trim: true },
    dtPrioritizationScore: { kind: 'number', default: 0 },
    dtCommitmentRecommendation: { kind: 'text', default: '', trim: true },
    dtRejectionReason: { kind: 'text', default: '', trim: true },
    dtDeliveryEstimate: { kind: 'text', default: '', trim: true },
    dtDelivery: { kind: 'text', default: '', trim: true },
    dtRequiredAttendees: { kind: 'text', default: '', trim: true },
    dtNotes: { kind: 'text', default: '', trim: true },
    dtEvaluator: { kind: 'text', default: '', trim: true },
    dtEvaluatedOn: { kind: 'text', default: '', trim: true },
    dtFeasibilityCriteria: { kind: 'text', default: '', trim: true },
    dtDraftSavedOn: { kind: 'text', default: '', trim: true },
    gptStrategic: { kind: 'number', default: 0 },
    gptFeasibility: { kind: 'number', default: 0 },
    gptInvestment: { kind: 'number', default: 0 },
    gptRoi: { kind: 'number', default: 0 },
    gptSizing: { kind: 'text', default: '', trim: true },
    gptBenefitScore: { kind: 'number', default: 0 },
    gptTechnicalReadiness: { kind: 'text', default: '', trim: true },
    gptImplementationEffort: { kind: 'text', default: '', trim: true },
    gptTimeToValueGpt: { kind: 'text', default: '', trim: true },
    gptDevTimeDt: { kind: 'text', default: '', trim: true },
    gptOrgReadiness: { kind: 'text', default: '', trim: true },
    gptPrioritizationScore: { kind: 'number', default: 0 },
    gptCommitmentRecommendation: { kind: 'text', default: '', trim: true },
    gptRejectionReason: { kind: 'text', default: '', trim: true },
    gptDeliveryEstimate: { kind: 'text', default: '', trim: true },
    gptNotes: { kind: 'text', default: '', trim: true },
    gptEvaluator: { kind: 'text', default: '', trim: true },
    gptEvaluatedOn: { kind: 'text', default: '', trim: true },
    gptFeasibilityCriteria: { kind: 'text', default: '', trim: true },
    gptDraftSavedOn: { kind: 'text', default: '', trim: true },
    gptRequiredAttendees: { kind: 'text', default: '', trim: true },
    reviewOutcome: { kind: 'text', default: '', trim: true },
    reviewerNotes: { kind: 'text', default: '', trim: true },
    evaluatorNotes: { kind: 'text', default: '', trim: true },
    finalReviewer: { kind: 'text', default: '', trim: true },
    reviewDraftSavedOn: { kind: 'text', default: '', trim: true },
};

const HISTORY_ITEM_FIELDS = ['status', 'action', 'actorName', 'actorEmail', 'changedOn', 'note'];
const PUSH_TARGETS = new Set(['statusHistory', 'opsStatusHistory']);

const KNOWN_TOP_LEVEL_KEYS = new Set([
    '_id',
    '__v',
    'createdAt',
    'updatedAt',
    ...Object.keys(FIELD_SPECS),
    'statusHistory',
    'opsStatusHistory',
    'buInputRows',
    'attachments',
]);
const isKnownPath = (path) => KNOWN_TOP_LEVEL_KEYS.has(path);

const emptyBusinessCase = () =>
    Object.fromEntries(FIELD_SPECS.businessCase.nestedFields.map((f) => [f, '']));

const castNested = (spec, value) => {
    const src = value && typeof value === 'object' ? value : {};
    const out = {};
    spec.nestedFields.forEach((f) => {
        out[f] = String(src[f] ?? '').trim();
    });
    return out;
};

const castScalar = (spec, value, path, errors) => {
    if (spec.kind === 'text') {
        let v = value === undefined || value === null ? '' : String(value);
        if (spec.trim) v = v.trim();
        if (spec.enum && !spec.enum.includes(v)) {
            errors.push(`${path}: \`${v}\` is not a valid enum value for path \`${path}\`.`);
        }
        return v;
    }
    if (spec.kind === 'number') {
        if (value === undefined || value === null || value === '') return 0;
        const n = Number(value);
        if (!Number.isFinite(n)) {
            errors.push(`${path}: Cast to Number failed for value "${value}" at path "${path}"`);
            return 0;
        }
        return n;
    }
    if (spec.kind === 'bool') {
        if (value === undefined || value === null) return false;
        if (value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1') return true;
        if (value === false || value === 'false' || value === 'FALSE' || value === 0 || value === '0') return false;
        errors.push(`${path}: Cast to Boolean failed for value "${value}" at path "${path}"`);
        return Boolean(value);
    }
    // stringArray
    const raw = spec.setter
        ? spec.setter(value)
        : Array.isArray(value)
          ? value
          : value === undefined
            ? []
            : [value];
    return raw.map((v) => String(v));
};

const castPathValue = (path, value, errors, { forPush = false } = {}) => {
    if (forPush && PUSH_TARGETS.has(path)) {
        const src = value && typeof value === 'object' ? value : {};
        const item = {};
        HISTORY_ITEM_FIELDS.forEach((f) => {
            item[f] = String(src[f] ?? '').trim();
        });
        return item;
    }
    const spec = FIELD_SPECS[path];
    if (!spec) return value;
    return spec.kind === 'nested' ? castNested(spec, value) : castScalar(spec, value, path, errors);
};

const raiseIfErrors = (errors) => {
    if (!errors.length) return;
    const err = new Error(`Validation failed: ${errors.join(', ')}`);
    err.name = 'ValidationError';
    throw err;
};

const castUpdate = (update, { validate }) => {
    const setPaths = Object.keys(update.$set || {}).filter(isKnownPath);
    const pushPaths = Object.keys(update.$push || {}).filter(isKnownPath);
    const errors = [];
    const set = {};
    const push = {};
    setPaths.forEach((p) => {
        set[p] = castPathValue(p, update.$set[p], errors);
    });
    pushPaths.forEach((p) => {
        push[p] = castPathValue(p, update.$push[p], errors, { forPush: true });
    });
    if (validate) raiseIfErrors(errors);
    return { set, push };
};

const castListFilter = (filter) => {
    const cast = {};
    if ('stage' in filter) cast.stage = String(filter.stage);
    if ('countryBu' in filter) cast.countryBu = String(filter.countryBu);
    if ('$or' in filter) cast.$or = filter.$or;
    return cast;
};

const buildIntakeRequestDocument = (payload) => {
    const errors = [];
    const doc = {};
    Object.entries(FIELD_SPECS).forEach(([field, spec]) => {
        const provided = Object.prototype.hasOwnProperty.call(payload, field) && payload[field] !== undefined;
        if (spec.kind === 'nested') {
            doc[field] = provided ? castNested(spec, payload[field]) : emptyBusinessCase();
            return;
        }
        if (!provided) {
            if (spec.required) errors.push(`${field}: Path \`${field}\` is required.`);
            doc[field] = spec.default !== undefined ? spec.default : spec.kind === 'stringArray' ? [] : '';
            return;
        }
        const value = payload[field];
        if (spec.required && String(value).trim() === '') {
            errors.push(`${field}: Path \`${field}\` is required.`);
        }
        doc[field] = castScalar(spec, value, field, errors);
    });
    ['statusHistory', 'opsStatusHistory', 'buInputRows', 'attachments'].forEach((child) => {
        if (payload[child] !== undefined) doc[child] = payload[child];
    });
    raiseIfErrors(errors);
    return doc;
};

module.exports = {
    PIPELINE_STAGES,
    FIELD_SPECS,
    isKnownPath,
    castUpdate,
    castListFilter,
    buildIntakeRequestDocument,
};
