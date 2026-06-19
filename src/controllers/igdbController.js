import logger from "../utils/logger.js";

const IGDB_TIMEOUT_MS = 30_000;

const fetchWithTimeout = (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IGDB_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
};

let accessToken = null;
let tokenExpiry = 0;
let tokenPromise = null;

const igdbCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

const getCached = (key) => {
  const entry = igdbCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { igdbCache.delete(key); return null; }
  return entry.data;
};

const setCache = (key, data) => {
  igdbCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of igdbCache) {
    if (now > entry.expiresAt) igdbCache.delete(key);
  }
}, 30 * 60 * 1000).unref();

async function refreshToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  const res = await fetchWithTimeout("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
  });

  if (!res.ok) {
    throw new Error(`Failed to obtain IGDB token: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

async function getToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  // Deduplicate concurrent refresh requests — all callers share the same promise
  if (!tokenPromise) {
    tokenPromise = refreshToken().finally(() => { tokenPromise = null; });
  }
  return tokenPromise;
}

export const searchGames = async (req, res) => {
  try {
    const { game } = req.query;

    if (!game || typeof game !== "string" || game.trim().length === 0) {
      return res.status(400).json({ error: "'game' parameter is required." });
    }

    if (game.length > 100) {
      return res.status(400).json({ error: "Search query too long (max 100 characters)." });
    }

    const sanitizedGame = game
      .replace(/[^a-zA-Z0-9\s\-.,éèêëàâùûüîïôœçÉÈÊËÀÂÙÛÜÎÏÔŒÇ]/g, "")
      .trim();

    if (!sanitizedGame) {
      return res.status(400).json({ error: "Invalid search parameters." });
    }

    const token = await getToken();

    const igdbRes = await fetchWithTimeout("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `search "${sanitizedGame}"; fields id,name,first_release_date; limit 10;`,
    });

    if (!igdbRes.ok) {
      logger.error("IGDB API error:", igdbRes.status, igdbRes.statusText);
      return res
        .status(igdbRes.status)
        .json({ error: "Failed to fetch from IGDB" });
    }

    const data = await igdbRes.json();
    logger.info("Games retrieved:", data.length);
    res.json(data);
  } catch (err) {
    logger.error("Error searching games:", err);
    res
      .status(500)
      .json({ error: "Server error while searching games" });
  }
};

export const fetchGameDetails = async (igdbId) => {
  const cacheKey = `game:${igdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const token = await getToken();

    const response = await fetchWithTimeout("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: `fields name, summary, storyline, genres.name, platforms.name, rating, aggregated_rating, cover.url, first_release_date, involved_companies.company.name, involved_companies.developer, involved_companies.publisher; where id = ${igdbId};`,
    });

    if (!response.ok) throw new Error(`IGDB error: ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("No game data found from IGDB.");

    setCache(cacheKey, data[0]);
    return data[0];
  } catch (error) {
    logger.error("Error fetching game details:", error);
    throw error;
  }
};

export const extractCompanies = (involvedCompanies) => {
  if (!involvedCompanies || !Array.isArray(involvedCompanies)) {
    return { developer: null, publisher: null };
  }

  let developer = null;
  let publisher = null;

  for (const company of involvedCompanies) {
    if (company.developer && !developer && company.company?.name) {
      developer = company.company.name;
    }
    if (company.publisher && !publisher && company.company?.name) {
      publisher = company.company.name;
    }
    if (developer && publisher) break;
  }

  return { developer, publisher };
};

export const fetchGenresByIds = async (ids) => {
  if (!ids || ids.length === 0) return [];

  try {
    const token = await getToken();

    const response = await fetchWithTimeout("https://api.igdb.com/v4/genres", {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `fields id, name, slug; where id = (${ids.join(",")});`,
    });

    const data = await response.json();
    if (!response.ok) {
      logger.error("IGDB error body:", data);
      throw new Error("IGDB genres fetch failed: " + response.status);
    }

    return data;
  } catch (error) {
    logger.error("Error in fetchGenresByIds:", error);
    throw error;
  }
};
