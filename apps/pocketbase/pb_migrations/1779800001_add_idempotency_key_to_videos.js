/// <reference path="../pb_data/types.d.ts" />

// Adds an idempotency_key field to videos. The API uses this to detect
// double-submits (same user retrying a request) and avoid double-charging
// credits. Indexed for fast lookup.
migrate((app) => {
	const collection = app.findCollectionByNameOrId('videos');

	const existing = collection.fields.getByName('idempotency_key');
	if (!existing) {
		collection.fields.add(new TextField({
			name: 'idempotency_key',
			required: false,
			max: 100,
		}));
	}

	// Composite index covering both user_id + idempotency_key. Make sure the
	// idx name is unique and no duplicate already exists.
	const idxName = 'idx_videos_user_idempotency';
	const indexes = collection.indexes || [];
	const hasIdx = indexes.some(s => typeof s === 'string' && s.includes(idxName));
	if (!hasIdx) {
		indexes.push(`CREATE INDEX \`${idxName}\` ON \`videos\` (\`user_id\`, \`idempotency_key\`)`);
		collection.indexes = indexes;
	}

	return app.save(collection);
}, (app) => {
	const collection = app.findCollectionByNameOrId('videos');
	try { collection.fields.removeByName('idempotency_key'); } catch (_e) { /* ignore */ }
	collection.indexes = (collection.indexes || []).filter(
		s => !(typeof s === 'string' && s.includes('idx_videos_user_idempotency'))
	);
	return app.save(collection);
});
