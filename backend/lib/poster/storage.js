const supabase = require('../../utils/supabase');

// ── Storage + history ─────────────────────────────────────────────────────────
// Bucket and table are created by supabase/migrations/009_daily_posters.sql.
// Writes use the service-role key, so no storage INSERT policy is needed
// (same pattern as hotel-logos in storage.sql).
const BUCKET = 'daily-posters';

async function savePoster({ pngBuffer, theme, copy }) {
  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filePath = `${stamp}-${theme.key}.png`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, pngBuffer, { contentType: 'image/png', upsert: true });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  const imageUrl = pub.publicUrl;

  const { data, error: insErr } = await supabase
    .from('daily_posters')
    .insert({
      theme: theme.key,
      headline: copy.headline,
      subtext: copy.subtext,
      caption: copy.caption,
      image_prompt: copy.imagePrompt,
      image_url: imageUrl,
    })
    .select()
    .single();
  // The poster exists in storage even if history logging fails — report the
  // URL either way so the day's post isn't lost.
  if (insErr) console.error('daily_posters insert failed:', insErr.message);

  return { imageUrl, row: data || null };
}

module.exports = { savePoster, BUCKET };
