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

// Cache in-memory pour les détails de jeux (TTL 1h)
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

async function getToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

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
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // 60s de marge

  return accessToken;
}

export const searchGames = async (req, res) => {
  try {
    const { game } = req.query; // Extraction du terme de recherche depuis l'URL

    if (!game) {
      return res.status(400).json({ error: "Paramètre 'game' requis." });
    }

    const token = await getToken(); // Obtention du token OAuth

    const igdbRes = await fetchWithTimeout("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `search "${game}"; fields id,name,first_release_date; limit 10;`,
    });

    if (!igdbRes.ok) {
      logger.error("Erreur API IGDB:", igdbRes.status, igdbRes.statusText);
      return res
        .status(igdbRes.status)
        .json({ error: "Failed to fetch from IGDB" });
    }

    const data = await igdbRes.json();
    logger.info("Jeux récupérés:", data.length);
    res.json(data);
  } catch (err) {
    logger.error("Erreur lors de la recherche des jeux:", err);
    res
      .status(500)
      .json({ error: "Erreur serveur lors de la recherche des jeux" });
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
    // Arrêter si on a trouvé les deux
    if (developer && publisher) break;
  }

  return { developer, publisher };
};

export const fetchGenresByIds = async (ids) => {
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

    const data = await response.json(); // ✅ lire une seule fois
    if (!response.ok) {
      logger.error("IGDB error body:", data); // on peut loguer l'erreur ici
      throw new Error("IGDB genres fetch failed: " + response.status);
    }

    return data; // ✅ pas de deuxième appel à .json()
  } catch (error) {
    logger.error("Error in fetchGenresByIds:", error);
    throw error;
  }
};

