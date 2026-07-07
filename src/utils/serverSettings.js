import ServerSettings from "../models/serverSettingsModel.js";

const CACHE_TTL_MS = 60_000;

let cache = null;
let cacheTime = 0;
let migrated = false;

// Upgrade path: adopt a pre-key doc so the upsert below reuses it instead of
// creating a fresh default one and resetting the admin's limits.
async function migrateLegacyDoc() {
  if (migrated) return;
  migrated = true;
  try {
    await ServerSettings.updateOne({ key: { $exists: false } }, { $set: { key: "singleton" } });
  } catch {
    // Already adopted or none present
  }
}

export async function getSettings() {
  if (cache && Date.now() - cacheTime < CACHE_TTL_MS) return cache;

  await migrateLegacyDoc();

  const settings = await ServerSettings.findOneAndUpdate(
    { key: "singleton" },
    { $setOnInsert: { key: "singleton" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  cache = settings;
  cacheTime = Date.now();
  return cache;
}

export async function updateSettings(patch) {
  const allowed = {};
  if (typeof patch.maxModSizeGB === "number") allowed.maxModSizeGB = patch.maxModSizeGB;
  if (typeof patch.maxGameSizeGB === "number") allowed.maxGameSizeGB = patch.maxGameSizeGB;
  if (typeof patch.registrationEnabled === "boolean") allowed.registrationEnabled = patch.registrationEnabled;

  const updated = await ServerSettings.findOneAndUpdate(
    { key: "singleton" },
    { $set: allowed, $setOnInsert: { key: "singleton" } },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  cache = updated;
  cacheTime = Date.now();
  return updated;
}
