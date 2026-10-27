const intakeAdminResourceRepo = require('../repositories/intakeAdminResourceRepo');
const usersRepo = require('../repositories/usersRepo');

const SUPPORTED_RESOURCES = new Set([
  'teams',
  'countries',
  'products',
  'offers',
  'constants',
  'actions',
  'users',
  'strategic-initiatives',
]);

const normalizeResource = (resource) => String(resource || '').trim().toLowerCase();

const isSupportedResource = (resource) => SUPPORTED_RESOURCES.has(normalizeResource(resource));

const genId = (resource) => `${resource}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

const toDelimited = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join('; ');
  }

  return String(value || '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join('; ');
};

const normalizeOffersPayload = (payload) => {
  const title = String(payload?.title || '').trim();
  return {
    ...payload,
    title,
    countries: toDelimited(payload?.countries),
  };
};

const normalizeCountriesPayload = (payload) => {
  const title = String(payload?.title || '').trim();
  return {
    ...payload,
    title,
    // Optional Global Payroll-style configuration: Sub BUs and Regions are
    // stored as "; " delimited strings (accepting arrays or strings on input).
    subBus: toDelimited(payload?.subBus),
    regions: toDelimited(payload?.regions),
  };
};

const normalizeUsersPayload = (payload) => {
  const email = String(payload?.email || '').trim().toLowerCase();
  return {
    ...payload,
    email,
    displayName: String(payload?.displayName || '').trim(),
    role: String(payload?.role || '').trim(),
    designation: String(payload?.designation || '').trim(),
    esId: String(payload?.esId || '').trim(),
    permissions: toDelimited(payload?.permissions),
    teams: toDelimited(payload?.teams),
    countries: toDelimited(payload?.countries),
    products: toDelimited(payload?.products),
  };
};

const normalizeAdminPayload = (resource, payload) => {
  if (resource === 'offers') return normalizeOffersPayload(payload);
  if (resource === 'countries') return normalizeCountriesPayload(payload);
  if (resource === 'users') return normalizeUsersPayload(payload);
  return payload;
};

const validateAdminPayload = (resource, payload) => {
  if (resource === 'offers' && !String(payload?.title || '').trim()) {
    return 'Offer title is required';
  }

  if (resource === 'users' && !String(payload?.email || '').trim()) {
    return 'User email is required';
  }

  return '';
};

const toResponseItem = (doc) => {
  const payload = typeof doc?.payload === 'object' && doc?.payload !== null ? doc.payload : {};
  return {
    ...payload,
    id: doc.itemId,
  };
};

const toUserResponseItem = (doc) => ({ ...doc, id: doc._id });

const listAdminResource = async (req, res) => {
  try {
    const resource = normalizeResource(req.params.resource);
    if (!isSupportedResource(resource)) {
      return res.status(400).json({ message: 'Unsupported admin resource' });
    }

    if (resource === 'users') {
      const docs = await usersRepo.findAll();
      return res.status(200).json(docs.map(toUserResponseItem));
    }

    const docs = await intakeAdminResourceRepo.findByResourceSortedByCreatedAt(resource);
    return res.status(200).json(docs.map(toResponseItem));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list admin resource', error: error?.message });
  }
};

const createAdminResourceItem = async (req, res) => {
  try {
    const resource = normalizeResource(req.params.resource);
    if (!isSupportedResource(resource)) {
      return res.status(400).json({ message: 'Unsupported admin resource' });
    }

    const input = req.body && typeof req.body === 'object' ? req.body : {};
    const validationError = validateAdminPayload(resource, input);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const payload = normalizeAdminPayload(resource, { ...input });
    delete payload.id;

    if (resource === 'users') {
      const doc = await usersRepo.insertUser(payload);
      return res.status(200).json(toUserResponseItem(doc));
    }

    const itemId = String(input.id || genId(resource));
    const doc = await intakeAdminResourceRepo.upsertPayload(resource, itemId, payload);

    return res.status(200).json(toResponseItem(doc));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create admin resource item', error: error?.message });
  }
};

const updateAdminResourceItem = async (req, res) => {
  try {
    const resource = normalizeResource(req.params.resource);
    const itemId = String(req.params.id || '');

    if (!isSupportedResource(resource)) {
      return res.status(400).json({ message: 'Unsupported admin resource' });
    }

    if (!itemId) {
      return res.status(400).json({ message: 'Missing resource item id' });
    }

    const input = req.body && typeof req.body === 'object' ? req.body : {};
    const validationError = validateAdminPayload(resource, input);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const payload = normalizeAdminPayload(resource, { ...input });
    delete payload.id;

    if (resource === 'users') {
      const doc = await usersRepo.updateById(itemId, payload);
      if (!doc) {
        return res.status(404).json({ message: 'Admin resource item not found' });
      }
      return res.status(200).json(toUserResponseItem(doc));
    }

    const doc = await intakeAdminResourceRepo.updatePayload(resource, itemId, payload);

    if (!doc) {
      return res.status(404).json({ message: 'Admin resource item not found' });
    }

    return res.status(200).json(toResponseItem(doc));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update admin resource item', error: error?.message });
  }
};

const deleteAdminResourceItem = async (req, res) => {
  try {
    const resource = normalizeResource(req.params.resource);
    const itemId = String(req.params.id || '');

    if (!isSupportedResource(resource)) {
      return res.status(400).json({ message: 'Unsupported admin resource' });
    }

    if (!itemId) {
      return res.status(400).json({ message: 'Missing resource item id' });
    }

    if (resource === 'users') {
      const doc = await usersRepo.deleteById(itemId);
      if (!doc) {
        return res.status(404).json({ message: 'Admin resource item not found' });
      }
      return res.status(200).json({ success: true });
    }

    const deleted = await intakeAdminResourceRepo.deleteItem(resource, itemId);
    if (!deleted) {
      return res.status(404).json({ message: 'Admin resource item not found' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete admin resource item', error: error?.message });
  }
};

module.exports = {
  listAdminResource,
  createAdminResourceItem,
  updateAdminResourceItem,
  deleteAdminResourceItem,
};
