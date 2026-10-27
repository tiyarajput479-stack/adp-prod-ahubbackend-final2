const programTrackerRepo = require('../repositories/programTrackerRepo');
const listPrograms = async (req, res) => {
  try {
    const docs = await programTrackerRepo.findAll();
    return res.status(200).json(docs);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list programs', error: error?.message });
  }
};

const createProgram = async (req, res) => {
  try {
    const input = req.body && typeof req.body === 'object' ? req.body : {};
    const problems = programTrackerRepo.validateDoc(input);
    if (problems.length) {
      return res.status(400).json({ message: problems.join('; ') });
    }
    const doc = await programTrackerRepo.insertDoc(input);
    return res.status(200).json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create program', error: error?.message });
  }
};

const updateProgram = async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!id) {
      return res.status(400).json({ message: 'Missing program id' });
    }
    const input = req.body && typeof req.body === 'object' ? req.body : {};
    const doc = await programTrackerRepo.updateById(id, input);
    if (!doc) {
      return res.status(404).json({ message: 'Program not found' });
    }
    return res.status(200).json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update program', error: error?.message });
  }
};

const deleteProgram = async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!id) {
      return res.status(400).json({ message: 'Missing program id' });
    }
    const result = await programTrackerRepo.deleteById(id);
    if (!result.deletedCount) {
      return res.status(404).json({ message: 'Program not found' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete program', error: error?.message });
  }
};

module.exports = {
  listPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
};
