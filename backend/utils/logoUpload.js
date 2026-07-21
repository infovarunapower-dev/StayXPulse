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

// Uploads to Supabase Storage. Returns { url, error } rather than throwing:
// registration treats a failure as non-fatal (a logo is optional and must not
// block signup), while the profile page surfaces `error` so the user is told
// what actually went wrong instead of a generic "try again".
const uploadHotelLogo = async (file) => {
  if (!file || !file.buffer) return { url: null, error: null };
  try {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const key = `logo_${uuidv4()}${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(key, file.buffer, {
      contentType: ALLOWED[ext] || file.mimetype,
      upsert: false,
    });
    if (error) {
      // "Bucket not found" means storage.sql was never run on this project.
      const hint = /not found/i.test(error.message || '')
        ? `Storage bucket "${BUCKET}" does not exist — run supabase/storage.sql`
        : error.message;
      console.error(`Logo upload failed [${BUCKET}]:`, error.message);
      return { url: null, error: hint };
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
    if (!data?.publicUrl) return { url: null, error: 'Upload succeeded but no public URL was returned' };
    return { url: data.publicUrl, error: null };
  } catch (e) {
    console.error(`Logo upload threw [${BUCKET}]:`, e.message);
    return { url: null, error: e.message };
  }
};

module.exports = { logoUpload, uploadHotelLogo };
