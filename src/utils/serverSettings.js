import ServerSettings from "../models/serverSettingsModel.js";

const CACHE_TTL_MS = 60_000;

let cache = null;
let cacheTime = 0;

export async function getSettings() {
  if (cache && Date.now() - cacheTime < CACHE_TTL_MS) return cache;

  let settings = await ServerSettings.findOne({}).lean();
  if (!settings) {
    const doc = new ServerSettings({});
    await doc.save();
    settings = doc.toObject();
  }

  cache = settings;
  cacheTime = Date.now();
  return cache;
}

export async function updateSettings(patch) {
  const allowed = {};
  if (typeof patch.maxModSizeGB === "number") allowed.maxModSizeGB = patch.maxModSizeGB;
  if (typeof patch.maxGameSizeGB === "number") allowed.maxGameSizeGB = patch.maxGameSizeGB;

  const updated = await ServerSettings.findOneAndUpdate(
    {},
    { $set: allowed },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  cache = updated;
  cacheTime = Date.now();
  return updated;
}
