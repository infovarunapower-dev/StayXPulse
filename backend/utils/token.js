const jwt = require('jsonwebtoken');

const generateToken = (userId, rememberMe = false) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: rememberMe ? process.env.JWT_REMEMBER_EXPIRE : process.env.JWT_EXPIRE }
  );
};

module.exports = generateToken;
