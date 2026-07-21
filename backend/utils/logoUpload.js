const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const supabase = require('./supabase');

const BUCKET = 'hotel-logos';

// Memory storage, NOT disk: Vercel's filesystem is read-only outside /tmp, so
// the old diskStorage middleware threw on every upload in production.
const ALLOWED = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
};

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    // SVG is deliberately NOT allowed — it can carry script, and the bucket is
    // public, so a stored SVG would be a stored-XSS vector on our own origin.
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED[ext] && file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Logo must be a JPG, PNG or WEBP image under 2MB.'));
  },
});

// Uploads to Supabase Storage and returns the public URL, or null if there is
// no file. Never throws: a logo is optional, so a storage hiccup must not fail
// the registration it is attached to.
const uploadHotelLogo = async (file) => {
  if (!file || !file.buffer) return null;
  try {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const key = `logo_${uuidv4()}${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(key, file.buffer, {
      contentType: ALLOWED[ext] || file.mimetype,
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
    return data?.publicUrl || null;
  } catch (e) {
    console.error('Logo upload failed:', e.message);
    return null;
  }
};

module.exports = { logoUpload, uploadHotelLogo };
