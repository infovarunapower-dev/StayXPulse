const { User } = require('../models');

// Generates UIDs like HTL001, HTL002 ...
const generateUserId = async () => {
  const count = await User.countDocuments({ role: 'hoteladmin' });
  const num = String(count + 1).padStart(3, '0');
  return `HTL${num}`;
};

// Generates a strong random password
const generatePassword = () => {
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower  = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = 0; i < 6; i++) pwd.push(all[Math.floor(Math.random() * all.length)]);
  return pwd.sort(() => Math.random() - 0.5).join('');
};

module.exports = { generateUserId, generatePassword };
