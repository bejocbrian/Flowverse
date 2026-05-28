/// <reference path="../pb_data/types.d.ts" />
//
// One-time repair: earlier seed data wrote settings values as strings like
//   "{'text': 'AI Video Studio'}"
// using single quotes, which is not valid JSON. The admin UI rendered the
// raw blob into the field. This migration normalizes any such row to its
// inner primitive ("AI Video Studio", 8, "16:9", etc.).
//
// We only touch rows that obviously match the legacy pattern. Anything
// that's already a clean JSON object/string/number is left alone.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('settings');
  if (!collection) {
    console.log('settings collection not found, skipping');
    return;
  }

  function unwrap(value) {
    if (value && typeof value === 'object') {
      if ('text' in value) return value.text;
      if ('number' in value) return value.number;
      if ('value' in value) return value.value;
      return value;
    }

    if (typeof value !== 'string') return value;

    try {
      return unwrap(JSON.parse(value));
    } catch (_) {
      // not strict JSON, try the legacy single-quoted form
    }

    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const repaired = trimmed.replace(/'/g, '"');
        return unwrap(JSON.parse(repaired));
      } catch (_) {
        // give up
      }
    }

    return value;
  }

  let records;
  try {
    records = app.findRecordsByFilter('settings', 'id != ""', '', 0, 0);
  } catch (e) {
    console.log('settings: nothing to migrate (' + e.message + ')');
    return;
  }

  let updated = 0;
  for (const row of records) {
    const raw = row.get('value');
    const normalized = unwrap(raw);

    if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
      row.set('value', normalized);
      app.save(row);
      updated++;
    }
  }

  console.log('settings legacy value repair complete: updated ' + updated + ' row(s).');
}, (app) => {
  // Not reversible - the original malformed values are not preserved.
});
