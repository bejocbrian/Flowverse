/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.role = 'admin'",
    "deleteRule": "@request.auth.role = 'admin'",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text_mcid01",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "text_mcid02",
        "name": "key",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text",
        "autogeneratePattern": "",
        "max": 0,
        "min": 0,
        "pattern": ""
      },
      {
        "hidden": false,
        "id": "text_mcid03",
        "name": "label",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text",
        "autogeneratePattern": "",
        "max": 0,
        "min": 0,
        "pattern": ""
      },
      {
        "hidden": false,
        "id": "text_mcid04",
        "name": "provider",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text",
        "autogeneratePattern": "",
        "max": 0,
        "min": 0,
        "pattern": ""
      },
      {
        "hidden": false,
        "id": "select_mcid05",
        "name": "type",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "select",
        "maxSelect": 1,
        "values": ["video", "image"]
      },
      {
        "hidden": false,
        "id": "select_mcid06",
        "name": "billing",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "select",
        "maxSelect": 1,
        "values": ["per_video", "per_second", "per_image"]
      },
      {
        "hidden": false,
        "id": "json_mcid07",
        "name": "credits",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "json_mcid08",
        "name": "creditsPerSecond",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "json_mcid09",
        "name": "durations",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "number_mcid10",
        "name": "minDuration",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "number",
        "max": 600,
        "min": 0,
        "onlyInt": true
      },
      {
        "hidden": false,
        "id": "number_mcid11",
        "name": "maxDuration",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "number",
        "max": 600,
        "min": 0,
        "onlyInt": true
      },
      {
        "hidden": false,
        "id": "json_mcid12",
        "name": "aspectRatios",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "json_mcid13",
        "name": "imageModes",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "number_mcid14",
        "name": "maxRefImages",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "number",
        "max": 10,
        "min": 0,
        "onlyInt": true
      },
      {
        "hidden": false,
        "id": "bool_mcid15",
        "name": "freeAccess",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "bool_mcid16",
        "name": "routed",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "bool_mcid17",
        "name": "enabled",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "number_mcid18",
        "name": "sortOrder",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "number",
        "max": 10000,
        "min": 0,
        "onlyInt": true
      },
      {
        "hidden": false,
        "id": "text_mcid19",
        "name": "vendorModelId",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text",
        "autogeneratePattern": "",
        "max": 0,
        "min": 0,
        "pattern": ""
      },
      {
        "hidden": false,
        "id": "text_mcid20",
        "name": "description",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text",
        "autogeneratePattern": "",
        "max": 0,
        "min": 0,
        "pattern": ""
      },
      {
        "hidden": false,
        "id": "text_mcid21",
        "name": "category",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text",
        "autogeneratePattern": "",
        "max": 0,
        "min": 0,
        "pattern": ""
      },
      {
        "hidden": false,
        "id": "autodate_mcid22",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate_mcid23",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_model_catalog01",
    "indexes": [
      "CREATE UNIQUE INDEX idx_model_catalog_key ON model_catalog (key)"
    ],
    "listRule": "",
    "name": "model_catalog",
    "system": false,
    "type": "base",
    "updateRule": "@request.auth.role = 'admin'",
    "viewRule": ""
  });

  try {
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("Collection name must be unique")) {
      console.log("Collection model_catalog already exists, skipping");
      return;
    }
    throw e;
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("pbc_model_catalog01");
    return app.delete(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection model_catalog not found, skipping revert");
      return;
    }
    throw e;
  }
})
