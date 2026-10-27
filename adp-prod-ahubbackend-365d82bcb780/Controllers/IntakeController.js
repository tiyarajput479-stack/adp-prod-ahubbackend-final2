const intakeRequestRepo = require('../repositories/intakeRequestRepo');
const attachmentRepo = require('../repositories/attachmentRepo');
const intakeAdminResourceRepo = require('../repositories/intakeAdminResourceRepo');
const usersRepo = require('../repositories/usersRepo');
const axios = require('axios');

const PIPELINE_STAGES = [
  'Submitted',
  'Rejected by GPT Team',
  'Rejected by DT Team',
  'Under GPT Evaluation',
  'Under DT Evaluation',
  'Committed by GPT',
  'Committed by DT',
];

const normalizeMeasure = (measure) => (
  ['count', 'fte', 'dollar'].includes(measure) ? measure : 'count'
);

const PIPELINE_STAGE_SET = new Set(PIPELINE_STAGES);

// Legacy stages that were retired from the pipeline are folded into the
// nearest surviving canonical stage so older records still show up in the
// dashboard distribution under one of the current 7 stages.
const LEGACY_STAGE_MAP = {
  'In Review': 'Committed by DT',
  'In Delivery': 'Committed by DT',
  Delivered: 'Committed by DT',
};

const ACTION_TRANSITIONS = {
  'Start evaluation': { from: ['Submitted'], toStatus: 'Under Evaluation' },
  'Submit for review': { from: ['Under Evaluation'], toStatus: 'Ready for Review' },
  'Evaluate (GPT)': { from: ['Submitted'], toStatus: 'Under GPT Evaluation', toTeam: 'GPT' },
  'Commit (GPT)': { from: ['Under GPT Evaluation'], toStatus: 'Committed by GPT', toTeam: 'GPT' },
  'Reject (GPT)': { from: ['Under GPT Evaluation'], toStatus: 'Rejected by GPT Team', toTeam: 'GPT' },
  'Forward to DT': { from: ['Under GPT Evaluation'], toStatus: 'Under DT Evaluation', toTeam: 'DT' },
  'Commit (DT)': { from: ['Under DT Evaluation'], toStatus: 'Committed by DT', toTeam: 'DT' },
  'Reject (DT)': { from: ['Under DT Evaluation'], toStatus: 'Rejected by DT Team', toTeam: 'DT' },
  // Current review-outcome wording (must match the frontend getAvailableActions
  // / evalOutcomeOptionsByTeam strings so the ACTIONS panel buttons resolve).
  'TECH APPROVED - SHARED SUPPORT': { from: ['Ready for Review'], toStatus: 'TECH APPROVED - SHARED SUPPORT' },
  'TECH APPROVED - GPT FULL SOLUTION': { from: ['Ready for Review'], toStatus: 'TECH APPROVED - GPT FULL SOLUTION' },
  'TECH APPROVED - DIGITECH FULL SOLUTION': { from: ['Ready for Review'], toStatus: 'TECH APPROVED - DIGITECH FULL SOLUTION' },
  REJECTED: { from: ['Ready for Review'], toStatus: 'REJECTED' },
  // Legacy review-outcome wording retained for backward compatibility. Older
  // clients still send these; fold them into the current canonical statuses.
  'Committed - Shared Support': { from: ['Ready for Review'], toStatus: 'TECH APPROVED - SHARED SUPPORT' },
  'Committed - GPT Full Solution': { from: ['Ready for Review'], toStatus: 'TECH APPROVED - GPT FULL SOLUTION' },
  'Committed - DT Full Solution': { from: ['Ready for Review'], toStatus: 'TECH APPROVED - DIGITECH FULL SOLUTION' },
  'Rejected - Existing DT Solution': { from: ['Ready for Review'], toStatus: 'REJECTED' },
  'Rejected - Value Proposition': { from: ['Ready for Review'], toStatus: 'REJECTED' },
};

const REVIEW_ACTIONS = new Set([
  // Current wording.
  'TECH APPROVED - SHARED SUPPORT',
  'TECH APPROVED - GPT FULL SOLUTION',
  'TECH APPROVED - DIGITECH FULL SOLUTION',
  'REJECTED',
  // Legacy wording (kept so permission checks still classify old actions).
  'Committed - Shared Support',
  'Committed - GPT Full Solution',
  'Committed - DT Full Solution',
  'Rejected - Existing DT Solution',
  'Rejected - Value Proposition',
]);

const parseDelimited = (value) =>
  String(value || '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseLowerSet = (value) => new Set(parseDelimited(value).map((item) => item.toLowerCase()));

const hasAllScope = (scopeSet) =>
  !scopeSet || scopeSet.size === 0 || scopeSet.has('all') || scopeSet.has('*');

const toLower = (value) => String(value || '').trim().toLowerCase();

const normalizeRole = (value) => toLower(value);

const getRequiredPermission = (action) => (REVIEW_ACTIONS.has(action) ? 'review' : 'evaluate');

const buildOfferTeamMap = (offers = []) => {
  const map = new Map();
  offers.forEach((offer) => {
    const title = toLower(offer?.title);
    const team = String(offer?.team || '').trim();
    if (!title || !team) return;
    map.set(title, team);
  });
  return map;
};

const resolveRequestTeam = (request = {}, offerTeamMap = new Map()) => {
  const explicitTeam = String(request?.team || '').trim();
  if (explicitTeam) return explicitTeam;
  const offerTitles = getOfferList(request).map((title) => title.toLowerCase());
  for (const title of offerTitles) {
    const team = String(offerTeamMap.get(title) || '').trim();
    if (team) return team;
  }
  return '';
};

const hasScopeForRequest = (user = {}, request = {}, requestTeam = '') => {
  const role = normalizeRole(user?.role);
  if (role === 'admin') return true;

  const countries = parseLowerSet(user?.countries);
  const products = parseLowerSet(user?.products);
  const teams = parseLowerSet(user?.teams);

  const reqCountry = toLower(request?.countryBu);
  const reqOffers = getOfferList(request).map((title) => title.toLowerCase());
  const reqTeam = toLower(requestTeam);

  const countryMatch = hasAllScope(countries) || (reqCountry && countries.has(reqCountry));
  const productMatch =
    hasAllScope(products) || reqOffers.some((offer) => products.has(offer));
  const teamMatch = hasAllScope(teams) || !reqTeam || teams.has(reqTeam);

  return countryMatch && productMatch && teamMatch;
};

const hasRequiredPermission = (user = {}, action = '') => {
  const role = normalizeRole(user?.role);
  if (role === 'admin') return true;

  const required = getRequiredPermission(action);
  const permissions = parseLowerSet(user?.permissions || user?.intakePermissions);
  return permissions.has(required);
};

const getAdminResources = async () => {
  const [users, offerDocs] = await Promise.all([
    usersRepo.findAll(),
    intakeAdminResourceRepo.findByResources(['offers']),
  ]);

  const offers = offerDocs.map((doc) => (
    doc?.payload && typeof doc.payload === 'object' ? doc.payload : {}
  ));

  return { users, offers };
};

const resolveNotificationRecipients = ({ users = [], request = {}, action = '', requestTeam = '', actorEmail = '' }) => {
  const recipients = new Set();
  const normalizedActor = toLower(actorEmail);

  users.forEach((user) => {
    const email = String(user?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    if (normalizedActor && email === normalizedActor) return;
    if (!hasRequiredPermission(user, action)) return;
    if (!hasScopeForRequest(user, request, requestTeam)) return;
    recipients.add(email);
  });

  return Array.from(recipients);
};

const sendStatusNotification = async ({ request = {}, action = '', recipients = [], actorName = '', actorEmail = '' }) => {
  const webhook = trimString(process.env.INTAKE_NOTIFICATION_WEBHOOK_URL);
  if (!webhook || !recipients.length) {
    return { sent: false, reason: !recipients.length ? 'no-recipients' : 'webhook-not-configured' };
  }

  const payload = {
    type: 'intake-status-action',
    action,
    oppId: request?.oppId || '',
    requestTitle: request?.requestTitle || '',
    status: request?.status || '',
    countryBu: request?.countryBu || '',
    offer: getOfferString(request),
    team: request?.team || '',
    actorName: actorName || '',
    actorEmail: actorEmail || '',
    recipients,
  };

  try {
    await axios.post(webhook, payload, { timeout: 7000 });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error?.message || 'notification-failed' };
  }
};

const canonicalStage = (stage) => {
  const value = trimString(stage);
  if (LEGACY_STAGE_MAP[value]) return LEGACY_STAGE_MAP[value];
  return PIPELINE_STAGE_SET.has(value) ? value : 'Submitted';
};

const normalizeStatusValue = (value) => {
  const text = trimString(value);
  if (!text) return 'Submitted';
  if (text.toLowerCase() === 'commited by dt') return 'Committed by DT';
  if (text.toLowerCase() === 'commited by gpt') return 'Committed by GPT';
  if (text.toLowerCase() === 'rejected by dt team') return 'Rejected by DT Team';
  if (text.toLowerCase() === 'rejected by gpt team') return 'Rejected by GPT Team';
  return text;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const trimString = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value.trim();
};

// Normalizes an offer value into a clean array of labels. Accepts a plain
// string, an array of strings/objects, or a single option object. Guards against
// stray "[object Object]" tokens produced by earlier client serialization bugs.
const normalizeOfferArray = (value) => {
  const pickLabel = (item) => {
    if (item == null) return '';
    if (typeof item === 'string') return item.trim();
    if (typeof item === 'object') {
      return String(item.value || item.label || item.title || item.name || '').trim();
    }
    return String(item).trim();
  };

  let parts = [];
  if (Array.isArray(value)) {
    parts = value.map(pickLabel);
  } else if (value && typeof value === 'object') {
    parts = [pickLabel(value)];
  } else if (typeof value === 'string') {
    parts = value.split(/[;,]/).map((item) => item.trim());
  }

  const cleaned = parts.filter((item) => item && item.toLowerCase() !== '[object object]');
  return Array.from(new Set(cleaned));
};

// Returns a request's offer titles as an array, regardless of whether the stored
// value is a legacy delimited string or the current array shape.
const getOfferList = (request = {}) => normalizeOfferArray(request?.offerImpact);

// Joins a request's offer titles into a readable "; "-delimited string.
const getOfferString = (request = {}) => getOfferList(request).join('; ');

// --- SLT Portfolio (Ops Plan) flow -----------------------------------------
// Server-side mirror of the frontend opsPlanConstants so status transitions can
// be validated and audited here (never trusting the client for the target
// stage). Keep these in sync with src/components/opsPlan/opsPlanConstants.js.
const OPS_MONTH_KEYS = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'];

const OPS_STATUS = {
  SUBMITTED: 'Submitted',
  UNDER_EVALUATION: 'Under Evaluation',
  READY_FOR_REVIEW: 'Ready for Review',
  REQUIRES_BU_INPUT: 'Requires BU Input',
  REJECTED_INSUFFICIENT: 'Rejected - Insufficient Information',
  READY_FOR_SLT: 'Ready for SLT',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DEFERRED: 'Deferred',
  IN_SHP: 'In SHP',
};

// Stages owned by the technical-assessment flow (derived from the main status),
// never advanced directly from the Ops track.
const OPS_SHARED_STAGES = [
  OPS_STATUS.SUBMITTED,
  OPS_STATUS.UNDER_EVALUATION,
  OPS_STATUS.READY_FOR_REVIEW,
];

// Normalizes stored BU Input rows into { bu, source, months:{...numbers} } so
// partial/legacy shapes still round-trip and month cells persist as numbers.
const normalizeBuInputRows = (raw) => {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const monthsSource = row.months && typeof row.months === 'object' ? row.months : row;
      const months = OPS_MONTH_KEYS.reduce((acc, key) => {
        const value = Number(monthsSource[key]);
        acc[key] = Number.isFinite(value) ? value : 0;
        return acc;
      }, {});
      return {
        bu: trimString(row.bu),
        source: trimString(row.source),
        subBu: trimString(Array.isArray(row.subBu) ? row.subBu[0] : row.subBu),
        region: trimString(Array.isArray(row.region) ? row.region[0] : row.region),
        months,
      };
    });
};

// True when at least one BU Input line is meaningfully filled in (identifies a
// BU/source or carries any non-zero monthly value). Empty placeholder rows do
// not count. Gates the "Ready for SLT" advance.
const hasBuInputRows = (rows) =>
  Array.isArray(rows) &&
  rows.some((row) => {
    if (!row || typeof row !== 'object') return false;
    if (trimString(row.bu) || trimString(row.source)) return true;
    const months = row.months && typeof row.months === 'object' ? row.months : {};
    return OPS_MONTH_KEYS.some((key) => {
      const value = Number(months[key]);
      return Number.isFinite(value) && value !== 0;
    });
  });

// A request supports the Ops Plan / SLT Portfolio flow when "Ops Plan" is among
// its selected strategic initiatives.
const isOpsPlanRequest = (request = {}) =>
  toBenefitArray(request?.strategicInitiatives)
    .some((value) => toLower(value) === 'ops plan');

// True when the request is a Process Improvement (BPI): it goes straight into
// the SHP overall view, skipping the technical-assessment stages.
const isBpiRequest = (request = {}) => {
  const type = toLower(request?.requestType || request?.solutionType || request?.solution);
  return type.includes('process improvement') || type === 'bpi' || type.includes('(bpi)');
};

// True when the main technical assessment is complete (tech-approved / committed
// at the review board), which unlocks the Ops-specific SLT stages.
const isTechAssessmentApproved = (request = {}) => {
  const main = trimString(request?.status).toUpperCase();
  return main.startsWith('TECH APPROVED') || main.startsWith('COMMITTED');
};

// Resolves the Ops status for a request. An explicit Ops-specific `opsStatus`
// always wins; otherwise the stage is derived from the main technical status so
// the shared Submitted / Under Evaluation / Ready for Review stages are never
// duplicated. BPI requests skip assessment and land at "Ready for SLT".
const getOpsStatus = (request = {}) => {
  const explicit = trimString(request?.opsStatus);
  if (explicit && !OPS_SHARED_STAGES.includes(explicit)) return explicit;
  if (isBpiRequest(request)) return OPS_STATUS.READY_FOR_SLT;
  const main = trimString(request?.status);
  if (main === OPS_STATUS.UNDER_EVALUATION) return OPS_STATUS.UNDER_EVALUATION;
  if (main === OPS_STATUS.READY_FOR_REVIEW) return OPS_STATUS.READY_FOR_REVIEW;
  if (isTechAssessmentApproved(request)) return OPS_STATUS.READY_FOR_REVIEW;
  return OPS_STATUS.SUBMITTED;
};

// Next actions available from a given Ops status. The action string is also the
// resulting `opsStatus`, so a valid action == the target stage.
const getOpsNextActions = (status, { isBpi = false, techApproved = false } = {}) => {
  switch (status) {
    case OPS_STATUS.SUBMITTED:
      return isBpi ? [OPS_STATUS.READY_FOR_SLT] : [];
    case OPS_STATUS.UNDER_EVALUATION:
      return [];
    case OPS_STATUS.READY_FOR_REVIEW:
      return isBpi || techApproved
        ? [OPS_STATUS.REQUIRES_BU_INPUT]
        : [];
    case OPS_STATUS.REQUIRES_BU_INPUT:
      return [OPS_STATUS.READY_FOR_SLT];
    case OPS_STATUS.READY_FOR_SLT:
      return [OPS_STATUS.APPROVED, OPS_STATUS.REJECTED, OPS_STATUS.DEFERRED];
    case OPS_STATUS.APPROVED:
      return [OPS_STATUS.IN_SHP];
    default:
      return [];
  }
};

const toIsoString = (value, fallback = '') => {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : fallback;
  }
  return date.toISOString();
};

const parseScore = (value) => {
  if (typeof value !== 'string') return 0;
  const match = value.match(/^\s*(\d+)/);
  return match ? Number(match[1]) || 0 : 0;
};

const toBenefitArray = (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim())
    : [];

const normalizeRequestRecord = (input = {}) => {
  const nowIso = new Date().toISOString();
  const createdOn =
    toIsoString(input.createdOn, '') ||
    toIsoString(input.submittedOn, '') ||
    toIsoString(input.created, '') ||
    toIsoString(input.createdAt, '') ||
    nowIso;
  const modified = toIsoString(input.modified, '') || toIsoString(input.updatedAt, '') || createdOn;

  const requestTitle = trimString(input.requestTitle || input.title);
  const status = trimString(input.status) || 'Submitted';
  const stage =
    PIPELINE_STAGE_SET.has(input.stage)
      ? input.stage
      : PIPELINE_STAGE_SET.has(status)
      ? status
      : 'Submitted';

  const savingsDollar = toNumber(input.savingsDollar ?? input.calculatedBusinessValue);
  const savingsFte = toNumber(input.savingsFte);
  const incidentSavingsDollar = toNumber(input.incidentSavingsDollar ?? input.incidentSavings);
  const incidentsSaved = toNumber(input.incidentsSaved ?? input.securityIncidents);
  const timeSavings = toNumber(input.timeSavings ?? input.minutesSavedPerTransaction);
  const clientsImpacted = toNumber(input.clientsImpacted ?? input.annualVolume);

  const rawTimeSavingsPerMonth = input.timeSavingsPerMonth ?? input.monthlyTimeSavings;
  const timeSavingsPerMonth =
    rawTimeSavingsPerMonth !== undefined && rawTimeSavingsPerMonth !== null && rawTimeSavingsPerMonth !== ''
      ? toNumber(rawTimeSavingsPerMonth)
      : Number(((timeSavings * clientsImpacted) / 12).toFixed(2));

  const revenue = toNumber(input.revenue ?? input.revenueImpact);
  const complianceRiskLevel = trimString(input.complianceRiskLevel);
  const costReductionLevel = trimString(input.costReductionLevel);
  const costAvoidanceLevel = trimString(input.costAvoidanceLevel);
  const revenueGenerationLevel = trimString(input.revenueGenerationLevel);
  const productivityLevel = trimString(input.productivityLevel);

  const dtStrategicRaw = input.dtStrategic;
  const derivedStrategic = Math.max(
    parseScore(complianceRiskLevel),
    parseScore(costReductionLevel),
    parseScore(costAvoidanceLevel),
    parseScore(revenueGenerationLevel),
    parseScore(productivityLevel)
  );
  const dtStrategic =
    dtStrategicRaw !== undefined && dtStrategicRaw !== null && dtStrategicRaw !== ''
      ? toNumber(dtStrategicRaw)
      : derivedStrategic;

  const dtInvestment = toNumber(input.dtInvestment ?? input.calculatedBusinessValue ?? savingsDollar);
  // Sizing is a display value (T-shirt size like "M"/"XL" from the evaluation
  // modal, or a numeric FTE proxy on legacy/seed records), so keep it as a
  // trimmed string instead of coercing it to a number.
  const dtSizingRaw = input.dtSizing ?? input.savingsFte;
  const dtSizing =
    dtSizingRaw === undefined || dtSizingRaw === null ? '' : String(dtSizingRaw).trim();
  const gptSizingRaw = input.gptSizing;
  const gptSizing =
    gptSizingRaw === undefined || gptSizingRaw === null ? '' : String(gptSizingRaw).trim();
  const rawRoi = input.dtRoi ?? input.dtROI;
  const dtRoi =
    rawRoi !== undefined && rawRoi !== null && rawRoi !== ''
      ? toNumber(rawRoi)
      : dtInvestment > 0
      ? Number(((revenue + savingsDollar) / dtInvestment).toFixed(2))
      : 0;

  const completedOn = trimString(input.completedOn);

  return {
    oppId: trimString(input.oppId),
    requestTitle,
    requestorId: trimString(input.requestorId),
    requestorName: trimString(input.requestorName),
    submittedBy: trimString(input.submittedBy || input.requestorName),
    owner: trimString(input.owner || input.requestorName),
    countryBu: trimString(input.countryBu) || 'Unassigned',
    subBu: toBenefitArray(input.subBu),
    region: toBenefitArray(input.region),
    offerImpact: normalizeOfferArray(input.offerImpact || input.offer || input.gptOfferImpact),
    dtOfferImpact: trimString(input.dtOfferImpact),
    savingsDollar,
    savingsFte,
    fteAnnualSavings: toNumber(input.fteAnnualSavings),
    // Ops Plan flow (SLT Portfolio board): dedicated status track, the BU input
    // table captured after the GPTech Board, the SLT audit trail, and last
    // editor.
    opsStatus: trimString(input.opsStatus),
    opsUpdatedBy: trimString(input.opsUpdatedBy),
    buInputRows: normalizeBuInputRows(input.buInputRows),
    opsStatusHistory: Array.isArray(input.opsStatusHistory)
      ? input.opsStatusHistory.filter((row) => row && typeof row === 'object')
      : [],
    expectedDelivery: trimString(input.expectedDelivery || input.targetDate),
    team: trimString(input.team),
    status,
    gptDelivery: trimString(input.gptDelivery),
    stage,
    solutionType: trimString(input.solutionType) || 'Existing',
    solution: trimString(input.solution || input.solutionType) || 'Existing',
    deliveryWeeks: toNumber(input.deliveryWeeks),
    problemStatement: trimString(input.problemStatement),
    targetDate: trimString(input.targetDate),
    opportunityOverview: trimString(input.opportunityOverview),
    opportunity: trimString(input.opportunity || input.opportunityOverview),
    incidentSavingsDollar,
    timeSavingsPerMonth,
    shore: trimString(input.shore || input.deliveryModel),
    incidentsSaved,
    timeSavings,
    clientsImpacted,
    fteSavingsDollar: toNumber(input.fteSavingsDollar ?? input.calculatedBusinessValue),
    revenue,
    statusChangedOn: toIsoString(input.statusChangedOn, '') || modified,
    completedOn,
    submittedOn: toIsoString(input.submittedOn, '') || createdOn,
    created: toIsoString(input.created, '') || createdOn,
    modified,
    requestType: trimString(input.requestType),
    serviceImplementation: toBenefitArray(input.serviceImplementation),
    strategicInitiatives: toBenefitArray(input.strategicInitiatives),
    orgReadiness: trimString(input.orgReadiness),
    benefitTypes: toBenefitArray(input.benefitTypes),
    productivityLevel,
    costAvoidanceLevel,
    costReductionLevel,
    revenueGenerationLevel,
    complianceRiskLevel,
    technicalDetailsMode: trimString(input.technicalDetailsMode) || 'text',
    technicalDependencies: trimString(input.technicalDependencies),
    bcProcessOwner: trimString(input.bcProcessOwner || input.businessCase?.processOwner),
    bcProjectSponsor: trimString(input.bcProjectSponsor || input.businessCase?.projectSponsor),
    bcProblemStatement: trimString(input.bcProblemStatement || input.businessCase?.problemStatement),
    bcGoalStatement: trimString(input.bcGoalStatement || input.businessCase?.goalStatement),
    bcScopeIn: trimString(input.bcScopeIn || input.businessCase?.scopeIn),
    bcScopeOut: trimString(input.bcScopeOut || input.businessCase?.scopeOut),
    businessCase: {
      processOwner: trimString(input.businessCase?.processOwner || input.bcProcessOwner),
      projectSponsor: trimString(input.businessCase?.projectSponsor || input.bcProjectSponsor),
      problemStatement: trimString(input.businessCase?.problemStatement || input.bcProblemStatement),
      goalStatement: trimString(input.businessCase?.goalStatement || input.bcGoalStatement),
      scopeIn: trimString(input.businessCase?.scopeIn || input.bcScopeIn),
      scopeOut: trimString(input.businessCase?.scopeOut || input.bcScopeOut),
    },
    timelineDate: trimString(input.timelineDate),
    timelineNotes: trimString(input.timelineNotes),
    processName: trimString(input.processName),
    tool: trimString(input.tool),
    systemRequestTypes: Array.isArray(input.systemRequestTypes)
      ? input.systemRequestTypes.filter((value) => typeof value === 'string' && value.trim())
      : [],
    systemSource: trimString(input.systemSource),
    legalDetails: trimString(input.legalDetails),
    complianceDetails: trimString(input.complianceDetails),
    deliveryModel: trimString(input.deliveryModel),
    securityMode: trimString(input.securityMode) || 'number',
    securityRiskLevel: '',
    securityIncidents: toNumber(input.securityIncidents),
    timeMode: trimString(input.timeMode) || 'details',
    costReductionLevel,
    minutesSavedPerTransaction: toNumber(input.minutesSavedPerTransaction),
    annualVolume: toNumber(input.annualVolume),
    revenueMode: trimString(input.revenueMode) || 'amount',
    revenueImpact: toNumber(input.revenueImpact),
    revenueGenerationLevel,
    efficiencyLevel: '',
    businessValueComment: trimString(input.businessValueComment),
    businessValueValidated: Boolean(input.businessValueValidated),
    calculatedBusinessValue: toNumber(input.calculatedBusinessValue),
    dtStrategic,
    dtFeasibility: toNumber(input.dtFeasibility),
    dtInvestment,
    dtSizing,
    dtRoi,
    dtBenefitScore: toNumber(input.dtBenefitScore),
    dtTechnicalReadiness: trimString(input.dtTechnicalReadiness),
    dtImplementationEffort: trimString(input.dtImplementationEffort),
    dtTimeToValueGpt: trimString(input.dtTimeToValueGpt),
    dtDevTimeDt: trimString(input.dtDevTimeDt),
    dtOrgReadiness: trimString(input.dtOrgReadiness),
    dtPrioritizationScore: toNumber(input.dtPrioritizationScore),
    dtCommitmentRecommendation: trimString(input.dtCommitmentRecommendation),
    dtRejectionReason: trimString(input.dtRejectionReason),
    dtDeliveryEstimate: trimString(input.dtDeliveryEstimate || input.dtDelivery),
    dtDelivery: trimString(input.dtDelivery),
    dtRequiredAttendees: trimString(input.dtRequiredAttendees),
    dtNotes: trimString(input.dtNotes),
    dtEvaluator: trimString(input.dtEvaluator),
    dtEvaluatedOn: toIsoString(input.dtEvaluatedOn, ''),
    dtFeasibilityCriteria: trimString(input.dtFeasibilityCriteria),
    dtDraftSavedOn: toIsoString(input.dtDraftSavedOn, ''),
    gptStrategic: toNumber(input.gptStrategic),
    gptFeasibility: toNumber(input.gptFeasibility),
    gptInvestment: toNumber(input.gptInvestment),
    gptRoi: toNumber(input.gptRoi ?? input.gptROI),
    gptSizing,
    gptBenefitScore: toNumber(input.gptBenefitScore),
    gptTechnicalReadiness: trimString(input.gptTechnicalReadiness),
    gptImplementationEffort: trimString(input.gptImplementationEffort),
    gptTimeToValueGpt: trimString(input.gptTimeToValueGpt),
    gptDevTimeDt: trimString(input.gptDevTimeDt),
    gptOrgReadiness: trimString(input.gptOrgReadiness),
    gptPrioritizationScore: toNumber(input.gptPrioritizationScore),
    gptCommitmentRecommendation: trimString(input.gptCommitmentRecommendation),
    gptRejectionReason: trimString(input.gptRejectionReason),
    gptDeliveryEstimate: trimString(input.gptDeliveryEstimate || input.gptDelivery),
    gptRequiredAttendees: trimString(input.gptRequiredAttendees),
    gptNotes: trimString(input.gptNotes),
    gptEvaluator: trimString(input.gptEvaluator),
    gptEvaluatedOn: toIsoString(input.gptEvaluatedOn, ''),
    gptFeasibilityCriteria: trimString(input.gptFeasibilityCriteria),
    gptDraftSavedOn: toIsoString(input.gptDraftSavedOn, ''),
    reviewOutcome: trimString(input.reviewOutcome),
    reviewerNotes: trimString(input.reviewerNotes),
    evaluatorNotes: trimString(input.evaluatorNotes),
    finalReviewer: trimString(input.finalReviewer),
    reviewDraftSavedOn: toIsoString(input.reviewDraftSavedOn, ''),
    createdOn,
    statusHistory: Array.isArray(input.statusHistory)
      ? input.statusHistory
          .filter((entry) => entry && typeof entry === 'object')
          .map((entry) => ({
            status: trimString(entry.status),
            action: trimString(entry.action),
            actorName: trimString(entry.actorName),
            actorEmail: trimString(entry.actorEmail).toLowerCase(),
            changedOn: toIsoString(entry.changedOn, '') || trimString(entry.changedOn),
            note: trimString(entry.note),
          }))
      : [],
    attachments: Array.isArray(input.attachments)
      ? input.attachments.map((file) => ({
          name: trimString(file?.name),
          size: toNumber(file?.size),
          type: trimString(file?.type),
        }))
      : [],
  };
};

const buildPipelineFromRequests = (requests, measure = 'count') => {
  const rowsMap = new Map();

  requests.forEach((request) => {
    const country = request.countryBu || 'Unassigned';
    const stage = request.stage || request.status || 'Submitted';

    if (!rowsMap.has(country)) {
      rowsMap.set(country, { country, cells: {}, total: 0 });
    }

    const row = rowsMap.get(country);
    const value =
      measure === 'fte'
        ? Number(request.savingsFte) || 0
        : measure === 'dollar'
        ? Number(request.savingsDollar) || 0
        : 1;

    row.cells[stage] = (row.cells[stage] || 0) + value;
    row.total += value;
  });

  const rows = Array.from(rowsMap.values()).sort((a, b) => b.total - a.total);
  const columnTotals = {};
  let grandTotal = 0;

  PIPELINE_STAGES.forEach((stage) => {
    columnTotals[stage] = rows.reduce((sum, row) => sum + (row.cells[stage] || 0), 0);
    grandTotal += columnTotals[stage];
  });

  return { measure, stages: PIPELINE_STAGES, rows, columnTotals, grandTotal };
};

const listRequests = async (req, res) => {
  try {
    const { stage, countryBu, q, page = 1, limit = 100 } = req.query;
    const filter = {};

    if (stage) {
      filter.stage = stage;
    }
    if (countryBu) {
      filter.countryBu = countryBu;
    }
    if (q) {
      filter.$or = [
        { requestTitle: { $regex: q, $options: 'i' } },
        { oppId: { $regex: q, $options: 'i' } },
      ];
    }

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);

    const [items, total] = await intakeRequestRepo.listNewestFirst(
      filter,
      (parsedPage - 1) * parsedLimit,
      parsedLimit
    );

    const normalizedItems = items.map((item) => ({ ...item, ...normalizeRequestRecord(item) }));

    res.status(200).json({ items: normalizedItems, total, page: parsedPage, limit: parsedLimit });
  } catch (error) {
    res.status(500).json({ message: 'Failed to list intake requests', error: error.message });
  }
};

const createRequest = async (req, res) => {
  try {
    const body = req.body || {};

   
    const { oppId, _id, id, ...safeBody } = body;

    const payload = normalizeRequestRecord({
      ...safeBody,
      requestTitle: trimString(body.requestTitle || body.title),
    });

    if (!payload.requestTitle) {
      return res.status(400).json({ message: 'Failed to create intake request', error: 'requestTitle is required' });
    }

    const created = await intakeRequestRepo.create(payload);

 
    const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
    const filesWithData = rawAttachments
      .filter((file) => file && typeof file.data === 'string' && file.data.length > 0)
      .map((file) => ({
        requestId: created._id.toString(),
        name: trimString(file.name),
        data: file.data,
      }));

    if (filesWithData.length) {
      await attachmentRepo.insertMany(filesWithData);
    }

    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create intake request', error: error.message });
  }
};

const applyRequestAction = async (req, res) => {
  try {
    const oppId = trimString(req.params?.oppId);
    const action = trimString(req.body?.action);
    const note = trimString(req.body?.note);
    const actorName = trimString(req.body?.actorName);
    const actorEmail = trimString(req.body?.actorEmail).toLowerCase();

    if (!oppId) {
      return res.status(400).json({ message: 'Failed to apply request action', error: 'oppId is required' });
    }

    const transition = ACTION_TRANSITIONS[action];
    if (!transition) {
      return res.status(400).json({ message: 'Failed to apply request action', error: 'Unsupported action' });
    }

    const current = await intakeRequestRepo.findOneByOppId(oppId);
    if (!current) {
      return res.status(404).json({ message: 'Failed to apply request action', error: `Request ${oppId} not found` });
    }

    if (!actorEmail || !actorEmail.includes('@')) {
      return res.status(400).json({ message: 'Failed to apply request action', error: 'actorEmail is required' });
    }

    const { users, offers } = await getAdminResources();
    const actor = users.find((user) => toLower(user?.email) === actorEmail);
    if (!actor) {
      return res.status(403).json({ message: 'Failed to apply request action', error: 'Actor is not configured in admin users' });
    }

    const offerTeamMap = buildOfferTeamMap(offers);
    const requestTeam = resolveRequestTeam(current, offerTeamMap);

    if (!hasRequiredPermission(actor, action)) {
      return res.status(403).json({ message: 'Failed to apply request action', error: 'You do not have required permission for this action' });
    }

    if (!hasScopeForRequest(actor, current, requestTeam)) {
      return res.status(403).json({ message: 'Failed to apply request action', error: 'You do not have scope access for this request' });
    }

    const currentStatus = normalizeStatusValue(current.status || current.stage || 'Submitted');
    if (!transition.from.includes(currentStatus)) {
      return res.status(409).json({
        message: 'Failed to apply request action',
        error: `Action ${action} is not valid from status ${currentStatus}`,
      });
    }

    const nowIso = new Date().toISOString();
    const update = {
      status: transition.toStatus,
      stage: transition.toStatus,
      team: transition.toTeam || requestTeam || trimString(current.team),
      statusChangedOn: nowIso,
      modified: nowIso,
    };

    const isDtAction = action.includes('(DT)') || action.includes('DT');
    const isGptAction = action.includes('(GPT)') || action.includes('GPT');

    if (note) {
      if (isDtAction) update.dtNotes = note;
      if (isGptAction) update.gptNotes = note;
    }

    if (actorName) {
      if (isDtAction) update.dtEvaluator = actorName;
      if (isGptAction) update.gptEvaluator = actorName;
    }

    // Record who performed this transition so the request timeline can show the
    // actual actor per status change (persistent audit trail).
    const historyEntry = {
      status: transition.toStatus,
      action,
      actorName: actorName || trimString(actor?.displayName) || actorEmail,
      actorEmail,
      changedOn: nowIso,
      note: note || '',
    };

    const updated = await intakeRequestRepo.updateByOppId(oppId, {
      $set: update,
      $push: { statusHistory: historyEntry },
    });

    const normalizedUpdated = { ...updated, ...normalizeRequestRecord(updated) };
    const recipients = resolveNotificationRecipients({
      users,
      request: normalizedUpdated,
      action,
      requestTeam: resolveRequestTeam(normalizedUpdated, offerTeamMap),
      actorEmail,
    });

    const notification = await sendStatusNotification({
      request: normalizedUpdated,
      action,
      recipients,
      actorName,
      actorEmail,
    });

    return res.status(200).json({
      ...normalizedUpdated,
      notification: {
        recipients,
        sent: Boolean(notification?.sent),
        reason: notification?.reason || '',
      },
    });
  } catch (error) {
    return res.status(400).json({ message: 'Failed to apply request action', error: error.message });
  }
};

// POST /intake/requests/:oppId/ops-action - advance the SLT Portfolio (Ops
// Plan) status track. The target stage is validated server-side against the
// allowed transitions from the request's current Ops status (never trusting the
// client) and recorded in the `opsStatusHistory` audit trail. The BU input
// table may be saved atomically alongside the transition (e.g. when advancing
// out of "Requires BU Input").
const applyOpsAction = async (req, res) => {
  try {
    const oppId = trimString(req.params?.oppId);
    const action = trimString(req.body?.action);
    const note = trimString(req.body?.note);
    const actorName = trimString(req.body?.actorName);
    const actorEmail = trimString(req.body?.actorEmail).toLowerCase();

    if (!oppId) {
      return res.status(400).json({ message: 'Failed to apply Ops Plan action', error: 'oppId is required' });
    }
    if (!action) {
      return res.status(400).json({ message: 'Failed to apply Ops Plan action', error: 'action is required' });
    }

    const current = await intakeRequestRepo.findOneByOppId(oppId);
    if (!current) {
      return res.status(404).json({ message: 'Failed to apply Ops Plan action', error: `Request ${oppId} not found` });
    }

    if (!isOpsPlanRequest(current)) {
      return res.status(400).json({ message: 'Failed to apply Ops Plan action', error: 'Request is not part of the SLT Portfolio (Ops Plan) flow' });
    }

    const currentOps = getOpsStatus(current);
    const validActions = getOpsNextActions(currentOps, {
      isBpi: isBpiRequest(current),
      techApproved: isTechAssessmentApproved(current),
    });

    if (!validActions.includes(action)) {
      return res.status(409).json({
        message: 'Failed to apply Ops Plan action',
        error: `Action "${action}" is not valid from Ops status "${currentOps}"`,
      });
    }

    // Advancing to "Ready for SLT" requires at least one meaningful BU input
    // line. The rows may come with this request (buInputRows) or already be
    // persisted on the record.
    if (action === OPS_STATUS.READY_FOR_SLT) {
      const incomingRows = Object.prototype.hasOwnProperty.call(req.body || {}, 'buInputRows')
        ? normalizeBuInputRows(req.body.buInputRows)
        : null;
      const effectiveRows = incomingRows !== null ? incomingRows : normalizeBuInputRows(current.buInputRows);
      if (!hasBuInputRows(effectiveRows)) {
        return res.status(422).json({
          message: 'Failed to apply Ops Plan action',
          error: 'At least one BU input line is required before advancing to Ready for SLT',
        });
      }
    }

    const nowIso = new Date().toISOString();
    const update = {
      opsStatus: action,
      opsUpdatedBy: actorName || actorEmail || trimString(current.opsUpdatedBy),
      modified: nowIso,
    };

    // Allow the BU input table to be persisted in the same call (optional).
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'buInputRows')) {
      update.buInputRows = normalizeBuInputRows(req.body.buInputRows);
    }

    const historyEntry = {
      status: action,
      action,
      actorName: actorName || actorEmail,
      actorEmail,
      changedOn: nowIso,
      note: note || '',
    };

    const updated = await intakeRequestRepo.updateByOppId(oppId, {
      $set: update,
      $push: { opsStatusHistory: historyEntry },
    });

    return res.status(200).json({ ...updated, ...normalizeRequestRecord(updated) });
  } catch (error) {
    return res.status(400).json({ message: 'Failed to apply Ops Plan action', error: error.message });
  }
};

// Fields a user is allowed to edit from the request details pane (Overview +
// Benefits modals). Everything else (identifiers, evaluation scores, workflow
// status timestamps) is owned by the server / workflow actions.
const EDITABLE_REQUEST_FIELDS = [
  // Overview (Edit request info)
  'requestTitle',
  'problemStatement',
  'countryBu',
  'offerImpact',
  'subBu',
  'region',
  'dtOfferImpact',
  'targetDate',
  'expectedDelivery',
  'team',
  'status',
  // Benefits - shared
  'requestType',
  'serviceImplementation',
  'strategicInitiatives',
  'orgReadiness',
  'solutionType',
  'solution',
  'opportunity',
  'opportunityOverview',
  'technicalDetailsMode',
  'technicalDependencies',
  'bcProcessOwner',
  'bcProjectSponsor',
  'bcProblemStatement',
  'bcGoalStatement',
  'bcScopeIn',
  'bcScopeOut',
  'timelineDate',
  'timelineNotes',
  'processName',
  'tool',
  'systemRequestTypes',
  'systemSource',
  'legalDetails',
  'complianceDetails',
  'savingsFte',
  'savingsDollar',
  // Ops Plan flow (SLT Portfolio board). Status transitions go through the
  // dedicated ops-action endpoint; only the BU input table and last-editor are
  // saved via this generic PATCH.
  'buInputRows',
  'opsUpdatedBy',
  // Benefits - full calculator (tech solution)
  'benefitTypes',
  'productivityLevel',
  'costAvoidanceLevel',
  'costReductionLevel',
  'revenueGenerationLevel',
  'complianceRiskLevel',
  'securityMode',
  'securityIncidents',
  'timeMode',
  'timeSavings',
  'annualVolume',
  'minutesSavedPerTransaction',
  'shore',
  'deliveryModel',
  'revenueMode',
  'revenue',
  'revenueImpact',
  // Evaluation (GPT / DT) - written from the evaluation modal
  'gptStrategic',
  'gptFeasibility',
  'gptInvestment',
  'gptSizing',
  'gptDelivery',
  'gptRoi',
  'gptBenefitScore',
  'gptTechnicalReadiness',
  'gptImplementationEffort',
  'gptTimeToValueGpt',
  'gptDevTimeDt',
  'gptOrgReadiness',
  'gptPrioritizationScore',
  'gptCommitmentRecommendation',
  'gptRejectionReason',
  'gptDeliveryEstimate',
  'gptRequiredAttendees',
  'gptNotes',
  'gptEvaluator',
  'gptEvaluatedOn',
  'gptFeasibilityCriteria',
  'gptDraftSavedOn',
  'dtStrategic',
  'dtFeasibility',
  'dtInvestment',
  'dtSizing',
  'dtDelivery',
  'dtRoi',
  'dtNotes',
  'dtEvaluator',
  'dtBenefitScore',
  'dtTechnicalReadiness',
  'dtImplementationEffort',
  'dtTimeToValueGpt',
  'dtDevTimeDt',
  'dtOrgReadiness',
  'dtPrioritizationScore',
  'dtCommitmentRecommendation',
  'dtRejectionReason',
  'dtDeliveryEstimate',
  'dtRequiredAttendees',
  'dtEvaluatedOn',
  'dtFeasibilityCriteria',
  'dtDraftSavedOn',
  // Final review decision (review modal)
  'reviewOutcome',
  'reviewerNotes',
  'evaluatorNotes',
  'finalReviewer',
  'reviewDraftSavedOn',
  // Workflow audit trail + status timestamp (appended when status changes).
  'statusChangedOn',
  'statusHistory',
];

// PATCH /intake/requests/:oppId - partial update of an existing request from
// the details pane. Client-supplied identifiers are ignored so `oppId`/`_id`
// can never be changed or spoofed.
const updateRequest = async (req, res) => {
  try {
    const oppId = trimString(req.params?.oppId);
    if (!oppId) {
      return res.status(400).json({ message: 'Failed to update intake request', error: 'oppId is required' });
    }

    const current = await intakeRequestRepo.findOneByOppId(oppId);
    if (!current) {
      return res.status(404).json({ message: 'Failed to update intake request', error: `Request ${oppId} not found` });
    }

    const body = req.body || {};

    // Only merge whitelisted fields that were actually sent, so a partial
    // payload never wipes existing values.
    const patch = {};
    EDITABLE_REQUEST_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        patch[field] = body[field];
      }
    });

    if (Object.prototype.hasOwnProperty.call(body, 'requestTitle') && !trimString(body.requestTitle)) {
      return res.status(400).json({ message: 'Failed to update intake request', error: 'requestTitle cannot be empty' });
    }

    // Merge current + patch, then re-normalize so derived fields (stage, ROI,
    // timeSavingsPerMonth, etc.) stay consistent with the edited values.
    const normalized = normalizeRequestRecord({ ...current, ...patch });
    normalized.oppId = current.oppId; // never allow identity to change
    normalized.modified = new Date().toISOString();

    const updated = await intakeRequestRepo.updateByOppId(oppId, { $set: normalized });

    return res.status(200).json({ ...updated, ...normalizeRequestRecord(updated) });
  } catch (error) {
    return res.status(400).json({ message: 'Failed to update intake request', error: error.message });
  }
};

const backfillSharePointColumns = async (req, res) => {
  try {
    const docs = await intakeRequestRepo.findAll();

    if (!docs.length) {
      return res.status(200).json({ scanned: 0, updated: 0, message: 'No intake requests found' });
    }

    const fieldsToBackfill = [
      'submittedBy',
      'owner',
      'offerImpact',
      'expectedDelivery',
      'team',
      'solution',
      'opportunity',
      'incidentSavingsDollar',
      'timeSavingsPerMonth',
      'shore',
      'incidentsSaved',
      'timeSavings',
      'clientsImpacted',
      'fteSavingsDollar',
      'revenue',
      'statusChangedOn',
      'completedOn',
      'submittedOn',
      'created',
      'modified',
      'dtStrategic',
      'dtFeasibility',
      'dtInvestment',
      'dtSizing',
      'dtRoi',
      'createdOn',
    ];

    const bulkOps = docs
      .map((doc) => {
        const normalized = normalizeRequestRecord(doc);
        const setFields = {};

        fieldsToBackfill.forEach((field) => {
          const currentValue = doc[field];
          const nextValue = normalized[field];
          const isCurrentEmpty = currentValue === undefined || currentValue === null || currentValue === '';
          const hasNextValue = nextValue !== undefined && nextValue !== null && nextValue !== '';
          if (isCurrentEmpty && hasNextValue) {
            setFields[field] = nextValue;
          }
        });

        if (!Object.keys(setFields).length) return null;

        return {
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: setFields },
          },
        };
      })
      .filter(Boolean);

    if (!bulkOps.length) {
      return res.status(200).json({ scanned: docs.length, updated: 0, message: 'No rows required backfill' });
    }

    const result = await intakeRequestRepo.bulkWrite(bulkOps);

    return res.status(200).json({
      scanned: docs.length,
      updated: Number(result.modifiedCount || 0),
      matched: Number(result.matchedCount || 0),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to backfill intake requests', error: error.message });
  }
};

const getDashboardMetrics = async (req, res) => {
  try {
    const [
      activeRequests,
      sumAgg,
      avgAgg,
      countryAgg,
      solutionAgg,
      stageAgg,
      fteCountryAgg,
    ] = await intakeRequestRepo.dashboardAggregates();

    res.status(200).json({
      kpis: {
        activeRequests,
        totalFteSavings: Number(sumAgg?.[0]?.totalFteSavings || 0),
        totalAnnualValue: Number(sumAgg?.[0]?.totalAnnualValue || 0),
        avgDeliveryWeeks: Number((avgAgg?.[0]?.avgDeliveryWeeks || 0).toFixed(1)),
      },
      savingsByCountry: {
        categories: countryAgg.map((item) => item._id),
        data: countryAgg.map((item) => Number(item.value || 0)),
      },
      savingsBySolution: {
        categories: solutionAgg.map((item) => item._id),
        data: solutionAgg.map((item) => Number(item.value || 0)),
      },
      pipelineStages: (() => {
        const merged = new Map();
        stageAgg.forEach((item) => {
          const name = canonicalStage(item._id);
          merged.set(name, (merged.get(name) || 0) + Number(item.y || 0));
        });
        return PIPELINE_STAGES.filter((name) => merged.has(name)).map((name) => ({
          name,
          y: merged.get(name),
        }));
      })(),
      fteByCountry: {
        categories: fteCountryAgg.map((item) => item._id),
        data: fteCountryAgg.map((item) => Number(item.value || 0)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get dashboard metrics', error: error.message });
  }
};

const getPipeline = async (req, res) => {
  try {
    const measure = normalizeMeasure(req.query.measure);
    const requests = await intakeRequestRepo.findPipelineRows();

    res.status(200).json(buildPipelineFromRequests(requests, measure));
  } catch (error) {
    res.status(500).json({ message: 'Failed to get pipeline', error: error.message });
  }
};

// Returns the stored attachments (name + base64 data) for a request. The intake
// list/detail endpoints only carry attachment metadata (name/size/type); the
// actual base64 content lives in the separate `Attachments` collection keyed by
// `requestId` (the intake request's _id), so it is loaded on demand here.
const getRequestAttachments = async (req, res) => {
  try {
    const requestId = trimString(req.params?.requestId);
    if (!requestId) {
      return res.status(400).json({ message: 'requestId is required', items: [] });
    }

    const files = await attachmentRepo.find({ requestId });
    const items = (files || []).map((file) => ({
      _id: file._id,
      requestId: file.requestId,
      name: file.name,
      data: file.data,
    }));

    res.status(200).json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load attachments', error: error.message, items: [] });
  }
};

module.exports = {
  listRequests,
  createRequest,
  updateRequest,
  applyRequestAction,
  applyOpsAction,
  backfillSharePointColumns,
  getDashboardMetrics,
  getPipeline,
  getRequestAttachments,
};