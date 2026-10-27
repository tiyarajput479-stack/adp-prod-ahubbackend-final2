const usersRepo = require("../repositories/usersRepo");
const { getRoles } = require("./RoleManagementController");
const { generateAccessToken } = require("./TokenControllers");



const adduser = async (req, res) => {
  try {
    const { esId, displayName, designation, email, role, permissions, teams, countries, products } = req.body;

    const exists = await usersRepo.findOneByEsId(esId);
    if (exists) {
      return res.status(201).send({ data: esId, message: 'User already exist' });
    }

    const u = await usersRepo.insertUser({ esId, displayName, designation, email, role, permissions, teams, countries, products });
    res.status(200).send({ data: u, message: 'Record Saved Successfully' });

  } catch (e) {
    console.log(e);
    res.status(500).json(e);
  }
};

const users = async (req, res) => {
  try {
    const [userList, roles] = await Promise.all([
      usersRepo.findAll(),
      getRoles()
    ]);

    if (!userList.length) {
      return res.status(200).json({ data: [], msg: 'No users found' });
    }

    res.status(200).json({ data: userList, roles });

  } catch (err) {
    res.status(500).json(err);
  }
};

const getuser = async (req, res) => {
  try {
    const { mail: email = "", esId = "" } = req.query;

  
    const docs = (esId || email) ? await usersRepo.findByEsIdOrEmail(esId, email) : [];
    const checkexist = docs.map((doc) => ({ ...doc, id: doc._id }));

    const accessToken = generateAccessToken(esId);
    const status = checkexist.length > 0 ? 200 : 201;

    res.status(status).send({ data: checkexist, accessToken });

  } catch (e) {
    console.log(e);
    res.status(500).json(e);
  }
};

const update = async (req, res) => {
  try {
    const { esId, displayName, designation, email, role, permissions, teams, countries, products } = req.body;

    const exists = await usersRepo.findOneByEsId(esId);
    if (!exists) {
      return res.status(200).send({ data: null, message: 'User not found' });
    }

    const doc = await usersRepo.updateFirstByEsId(
      esId,
      { esId, displayName, designation, email, role, permissions, teams, countries, products }
    );

    res.status(200).send({ data: doc, message: 'Record updated successfully' });

  } catch (e) {
    console.log(e);
    res.status(500).json(e);
  }
};

const deleteuser = async (req, res) => {
  try {
    const doc = await usersRepo.deleteFirstByEsId(req.query.userName || req.query.esId);
    res.status(200).send({ data: doc, message: 'Record deleted successfully' });

  } catch (e) {
    console.log(e);
    res.status(500).json(e);
  }
};

module.exports = { adduser, getuser, users, update, deleteuser };