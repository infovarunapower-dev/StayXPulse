const crypto = require('crypto');
const supabase = require('./supabase');

const generateUserId = async () => {
  const { count } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'hoteladmin');
  const num = String((count || 0) + 1).padStart(3, '0');
  return `HTL${num}`;
};

// Real customer login passwords — use a CSPRNG, not Math.random().
const generatePassword = () => {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  const pick = (s) => s[crypto.randomInt(s.length)];
  const pwd = [pick(upper), pick(lower), pick(digits), pick(special)];
  for (let i = 0; i < 6; i++) pwd.push(pick(all));
  // Fisher–Yates shuffle with the CSPRNG so the class positions aren't fixed.
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }
  return pwd.join('');
};

module.exports = { generateUserId, generatePassword };