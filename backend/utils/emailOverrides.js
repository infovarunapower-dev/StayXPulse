const supabase = require('./supabase');
const { EDITABLE } = require('./templates');

const FIELDS = ['subject', 'heading', 'intro', 'notice'];

// The saved overrides for one email type (only the edited fields). Never throws
// — a failure just means "use defaults", so a DB blip can't stop an email.
async function getOverride(type) {
  try {
    const { data } = await supabase.from('email_templates')
      .select('subject, heading, intro, notice').eq('type', type).maybeSingle();
    return data || {};
  } catch { return {}; }
}

// For the editor UI: default + current (override applied) + placeholders per type.
async function listTemplates() {
  let overrides = {};
  try {
    const { data } = await supabase.from('email_templates').select('*');
    (data || []).forEach(r => { overrides[r.type] = r; });
  } catch { /* fall back to defaults only */ }

  return Object.entries(EDITABLE).map(([type, def]) => {
    const ov = overrides[type] || {};
    const cur = {};
    FIELDS.forEach(f => { cur[f] = (ov[f] != null ? ov[f] : (def[f] || '')); });
    return {
      type,
      label: def.label,
      placeholders: def.placeholders || [],
      defaults: FIELDS.reduce((o, f) => (o[f] = def[f] || '', o), {}),
      current: cur,
      customized: !!overrides[type],
    };
  });
}

async function saveOverride(type, fields) {
  if (!EDITABLE[type]) throw new Error('Unknown email type');
  const row = { type, updated_at: new Date().toISOString() };
  FIELDS.forEach(f => {
    if (f in fields) {
      const v = fields[f];
      row[f] = (v == null || String(v).trim() === '') ? null : String(v).slice(0, 2000);
    }
  });
  const { error } = await supabase.from('email_templates').upsert(row, { onConflict: 'type' });
  if (error) throw error;
}

async function resetOverride(type) {
  await supabase.from('email_templates').delete().eq('type', type);
}

module.exports = { getOverride, listTemplates, saveOverride, resetOverride };
