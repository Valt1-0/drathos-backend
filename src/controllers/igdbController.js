let accessToken = null;

async function getToken() {
  if (accessToken) {
    console.log("Returning cached access token");
    return accessToken;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  console.log("Fetching new access token...");
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );

  const data = await res.json();
  accessToken = data.access_token;

  return accessToken;
}

export const searchGames = async (req, res) => {
  try {
    const { game } = req.query; // Extraction du terme de recherche depuis l'URL

    if (!game) {
      return res.status(400).json({ error: "Paramètre 'game' requis." });
    }

    const token = await getToken(); // Obtention du token OAuth

    const igdbRes = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `search "${game}"; fields id,name,first_release_date; limit 10;`,
    });

    if (!igdbRes.ok) {
      console.error("Erreur API IGDB:", igdbRes.status, igdbRes.statusText);
      return res
        .status(igdbRes.status)
        .json({ error: "Failed to fetch from IGDB" });
    }

    const data = await igdbRes.json();
    console.log("Jeux récupérés:", data.length);
    res.json(data);
  } catch (err) {
    console.error("Erreur lors de la recherche des jeux:", err);
    res
      .status(500)
      .json({ error: "Erreur serveur lors de la recherche des jeux" });
  }
};

export const fetchGameDetails = async (igdbId) => {
  try {
    const token = await getToken(); // Obtention du token OAuth
    if (!token) {
      throw new Error("Failed to obtain IGDB access token.");
    }
    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: `fields name, summary, storyline, genres.name, platforms.name, rating, aggregated_rating, cover.url, first_release_date, involved_companies.company.name, involved_companies.developer, involved_companies.publisher; where id = ${igdbId};`,
    });

    if (!response.ok) {
      throw new Error(`IGDB error: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No game data found from IGDB.");
    }

    return data[0]; // renvoie l'objet du jeu
  } catch (error) {
    console.error("Error fetching game details:", error);
    throw error; // rethrow the error to be handled by the caller
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

    const response = await fetch("https://api.igdb.com/v4/genres", {
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
      console.error("IGDB error body:", data); // on peut loguer l'erreur ici
      throw new Error("IGDB genres fetch failed: " + response.status);
    }

    return data; // ✅ pas de deuxième appel à .json()
  } catch (error) {
    console.error("Error in fetchGenresByIds:", error);
    throw error;
  }
};

