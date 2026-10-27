const { generateAccessToken } = require("./TokenControllers");
const usersRepo = require("../repositories/usersRepo");

const verifyUser = async (req, res) => {
  try {
    const checkexist = await usersRepo.findByEsId(req.query.esId, { withId: false });
    if (checkexist.length > 0) {
      const accessToken = generateAccessToken(req.query.esId);
      res.status(200).send({ accessToken: accessToken });
      return;
    } else {
      res.status(400).json({
        status: "failed",
        message: `Not Authorized`,
        accessToken: null,
      });
    }
  } catch (e) {
    console.log(e);
    res.status(500).send({data: null, error: e.message});
  }
};

module.exports = {
  verifyUser,
};
