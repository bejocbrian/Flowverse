/// <reference path="../pb_data/types.d.ts" />
//
// One-time repair: earlier seed data wrote settings values as a JSON-field
// string whose content is single-quoted pseudo-JSON, e.g. the field holds
// the JSON string literal:  "{'text': 'AI Video Studio'}"
//
// We normalize each such row to the inner primitive ("AI Video Studio", 8,
// "16:9", ...).
//
// SAFETY: this migration only writes a row when it can extract a clean,
// defined primitive (string/number/boolean). If a value is already clean,
// or can't be confidently parsed, the row is left completely untouched.
// It never writes null/undefined - an earlier version of this migration
// did, which blanked the settings; this version is defensive about that.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('settings');
  if (!collection) {
    console.log('settings collection not found, skipping');
    return;
  }

  function decode(raw) {
    // JSON fields come back as raw bytes (typeof object) or a string.
    if (typeof raw === 'string') return raw;
    if (raw === null || raw === undefined) return null;
    try {
      return String(raw);
    } catch (_) {
      return null;
    }
  }

  // Try to turn the stored representation into a clean primitive.
  // Returns { ok: true, value } only when confident; otherwise { ok: false }.
  function normalize(raw) {
    let current = decode(raw);
    if (current === null) return { ok: false };

    // Already a clean primitive (number/bool) - nothing to do.
    if (typeof current === 'number' || typeof current === 'boolean') {
      return { ok: false }; // unchanged
    }

    // Iteratively unwrap up to a few layers: JSON string literals, objects,
    // and single-quoted pseudo-JSON.
    for (let i = 0; i < 5; i++) {
      if (typeof current === 'number' || typeof current === 'boolean') {
        return { ok: true, value: current };
      }

      if (current && typeof current === 'object') {
        if ('text' in current) { current = current.text; continue; }
        if ('number' in current) { current = current.number; continue; }
        if ('value' in current) { current = current.value; continue; }
        // Unknown object shape - don't risk mangling it.
        return { ok: false };
      }

      if (typeof current !== 'string') return { ok: false };

      const s = current;

      // Strict JSON parse first (handles outer-quoted string literals and
      // proper JSON objects/numbers).
      let parsedStrict;
      let strictOk = false;
      try {
        parsedStrict = JSON.parse(s);
        strictOk = true;
      } catch (_) {
        strictOk = false;
      }

      if (strictOk) {
        // If parsing changed the representation, keep unwrapping.
        if (typeof parsedStrict === 'string') {
          if (parsedStrict === s) return { ok: true, value: s };
          current = parsedStrict;
          continue;
        }
        current = parsedStrict;
        continue;
      }

      // Not strict JSON: try the legacy single-quoted object form.
      const trimmed = s.trim();
      const looksWrapped =
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'));

      if (looksWrapped) {
        try {
          current = JSON.parse(trimmed.replace(/'/g, '"'));
          continue;
        } catch (_) {
          // Can't repair - treat the trimmed string as the final value.
          return { ok: true, value: s };
        }
      }

      // A plain string that isn't JSON - it's already clean.
      return { ok: true, value: s };
    }

    // Bailed out of the loop without converging - leave untouched.
    return { ok: false };
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
    const result = normalize(raw);

    // Hard guard: never write null/undefined.
    if (!result.ok) continue;
    if (result.value === null || result.value === undefined) continue;

    // Only write if it actually differs from what's stored.
    const before = decode(raw);
    const beforeJson = JSON.stringify(before);
    const afterJson = JSON.stringify(result.value);
    if (beforeJson === afterJson) continue;

    row.set('value', result.value);
    app.save(row);
    updated++;
  }

  console.log('settings legacy value repair complete: updated ' + updated + ' row(s).');
}, (app) => {
  // Not reversible - the original malformed values are not preserved.
});
