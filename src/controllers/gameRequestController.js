import logger from "../utils/logger.js";
import GameRequest from "../models/gameRequestModel.js";

export const getAllRequests = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      GameRequest.find()
        .populate("userId", "username role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      GameRequest.countDocuments(),
    ]);

    res.status(200).json({ requests, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error("Erreur getAllRequests:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const createRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameTitle, description } = req.body;

    if (typeof gameTitle !== "string" || !gameTitle.trim()) {
      return res.status(400).json({ message: "Le titre du jeu est requis" });
    }
    if (gameTitle.length > 200) {
      return res.status(400).json({ message: "Le titre du jeu est trop long (max 200 caractères)" });
    }
    if (description !== undefined && (typeof description !== "string" || description.length > 500)) {
      return res.status(400).json({ message: "La description est invalide (max 500 caractères)" });
    }

    const request = new GameRequest({
      userId,
      gameTitle: gameTitle.trim(),
      description: description?.trim() || "",
    });

    await request.save();
    await request.populate("userId", "username role");
    res.status(201).json(request);
  } catch (err) {
    logger.error("Erreur createRequest:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const deleteRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const isPrivileged = ["admin", "moderator"].includes(req.user.role);

    const filter = isPrivileged ? { _id: id } : { _id: id, userId };
    const deleted = await GameRequest.findOneAndDelete(filter);

    if (!deleted) {
      return res.status(404).json({ message: "Demande introuvable ou non autorisée" });
    }

    res.status(200).json({ message: "Demande supprimée" });
  } catch (err) {
    logger.error("Erreur deleteRequest:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
