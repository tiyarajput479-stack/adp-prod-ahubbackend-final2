
const jwt = require('jsonwebtoken');
const logger = require('../helpers/logger');

function generateAccessToken(user) {
    const payload = {
      id: user.esId,
     
    };
    
    const secret = process.env.secretKey;
    const options = { expiresIn: '24h' };
  
    return jwt.sign(payload, secret, options);
  }

  function verifyAccessToken(token) {
    const secret = process.env.secretKey;
  
    try {
      const decoded = jwt.verify(token, secret);
      return { success: true, data: decoded };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    // console.log(authHeader)
    const token = authHeader && authHeader.split(' ')[1];
  
    if (!token) {
      logger.warn('auth.missing_token', {
        correlationId: req.correlationId,
        path: req.originalUrl,
        ip: req.ip || req.socket?.remoteAddress,
      });
      return res.status(401).send('unauthorisied');
    }
  
    const result = verifyAccessToken(token);
    //console.log(result)
    if (!result.success) {
      logger.warn('auth.invalid_token', {
        correlationId: req.correlationId,
        path: req.originalUrl,
        ip: req.ip || req.socket?.remoteAddress,
        reason: result.error,
      });
      return res.status(403).json({ error: result.error });
    }
  
    req.user = result.data;
    next();
  }
module.exports = {
    generateAccessToken,
    verifyAccessToken,
    authenticateToken
}