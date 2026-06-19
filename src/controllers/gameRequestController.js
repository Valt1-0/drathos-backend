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
    logger.error("Error getAllRequests:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const createRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameTitle, description } = req.body;

    if (typeof gameTitle !== "string" || !gameTitle.trim()) {
      return res.status(400).json({ message: "Game title is required" });
    }
    if (gameTitle.length > 200) {
      return res.status(400).json({ message: "Game title is too long (max 200 characters)" });
    }
    if (description !== undefined && (typeof description !== "string" || description.length > 500)) {
      return res.status(400).json({ message: "Description is invalid (max 500 characters)" });
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
    logger.error("Error createRequest:", err);
    res.status(500).json({ message: "Server error" });
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
      return res.status(404).json({ message: "Request not found or unauthorized" });
    }

    res.status(200).json({ message: "Request deleted" });
  } catch (err) {
    logger.error("Error deleteRequest:", err);
    res.status(500).json({ message: "Server error" });
  }
};
