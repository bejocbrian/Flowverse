/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const email = $os.getenv("PB_SUPERUSER_EMAIL")
    const password = $os.getenv("PB_SUPERUSER_PASSWORD")

    // Skip if env vars are not set (local development)
    if (!email || !password) {
        console.log("PB_SUPERUSER_EMAIL/PASSWORD not set, skipping superuser creation")
        return
    }

    const superusers = app.findCollectionByNameOrId("_superusers")
    const record = new Record(superusers)
    
    record.set("email", email)
    record.set("password", password)
    
    try {
        app.save(record)
    } catch (e) {
        // Ignore if superuser already exists
        console.log("Superuser may already exist, skipping:", e.message)
    }
})
