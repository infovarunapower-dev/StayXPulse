// Batched Russian translation of menu items, using the same Anthropic SDK the
// menu-scan feature uses. Translations are cached on food_items (name_ru etc.)
// by the caller, so a given item is only ever translated once.

const TRANSLATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name_ru', 'description_ru', 'category_ru'],
        properties: {
          id:             { type: 'string', description: 'echo the id given' },
          name_ru:        { type: 'string' },
          description_ru: { type: 'string' },
          category_ru:    { type: 'string' },
        },
      },
    },
  },
};

// items: [{ id, name, description, category }]  ->  Map id -> {name_ru, description_ru, category_ru}
// Returns an empty Map if translation is unavailable or fails — the caller then
// falls back to the English text, so a translation outage never breaks the menu.
const translateItemsToRu = async (items) => {
  const out = new Map();
  if (!process.env.ANTHROPIC_API_KEY || !items || items.length === 0) return out;

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();

    const payload = items.map(i => ({
      id: String(i.id),
      name: i.name || '',
      description: i.description || '',
      category: i.category || '',
    }));

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: TRANSLATION_SCHEMA } },
      messages: [{
        role: 'user',
        content:
          'Translate these hotel food-menu items from English to natural, idiomatic Russian for restaurant guests. ' +
          'Translate name, description and category. Keep well-known Indian dish names recognisable (transliterate rather than over-literally translate, e.g. "Biryani" -> "Бирьяни", "Lassi" -> "Ласси", "Dosa" -> "Доса"). ' +
          'Keep any size/portion note in the name (e.g. "(Half)" -> "(половина)"). ' +
          'If description is empty, return an empty string for description_ru. Echo each id exactly.\n\n' +
          JSON.stringify(payload),
      }],
    });

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return out;

    const textBlock = response.content.find(b => b.type === 'text');
    const parsed = JSON.parse(textBlock.text);
    (parsed.items || []).forEach(t => {
      out.set(String(t.id), {
        name_ru: t.name_ru || null,
        description_ru: t.description_ru || null,
        category_ru: t.category_ru || null,
      });
    });
  } catch (e) {
    console.error('Menu translation failed:', e.message);
  }
  return out;
};

module.exports = { translateItemsToRu };
