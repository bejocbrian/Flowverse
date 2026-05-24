/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Update video quality values from legacy (Fast/Standard/High)
 * to resolution-based (720p/1080p) format.
 */
migrate((app) => {
  // Map legacy quality values to new resolution-based values
  const qualityMap = {
    'Fast': '720p',
    'fast': '720p',
    'Standard': '720p',
    'standard': '720p',
    'High': '1080p',
    'high': '1080p',
    'premium': '1080p',
    'Premium': '1080p',
  };

  const collection = app.findCollectionByNameOrId('videos');
  if (!collection) {
    console.log('Videos collection not found, skipping migration');
    return;
  }

  // Fetch all videos with legacy quality values
  const legacyQualities = Object.keys(qualityMap).map(q => `quality = "${q}"`).join(' || ');
  
  try {
    const records = app.findRecordsByFilter(
      'videos',
      legacyQualities,
      '',   // sort
      0,    // limit (0 = all)
      0     // offset
    );

    let updatedCount = 0;
    for (const record of records) {
      const oldQuality = record.get('quality');
      const newQuality = qualityMap[oldQuality];
      if (newQuality && newQuality !== oldQuality) {
        record.set('quality', newQuality);
        app.save(record);
        updatedCount++;
      }
    }

    console.log(`Migration complete: Updated ${updatedCount} video records from legacy quality to resolution-based values.`);
  } catch (e) {
    console.log('No legacy quality records found or migration already applied:', e.message);
  }
}, (app) => {
  // Revert: Convert back to legacy values
  const reverseMap = {
    '720p': 'Standard',
    '1080p': 'High',
  };

  try {
    const records = app.findRecordsByFilter(
      'videos',
      'quality = "720p" || quality = "1080p"',
      '',
      0,
      0
    );

    for (const record of records) {
      const current = record.get('quality');
      const legacy = reverseMap[current];
      if (legacy) {
        record.set('quality', legacy);
        app.save(record);
      }
    }
  } catch (e) {
    console.log('Revert migration: No records to revert:', e.message);
  }
});
