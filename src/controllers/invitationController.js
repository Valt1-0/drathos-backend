import crypto from "crypto";
import logger from "../utils/logger.js";
import InvitationCode from "../models/invitationCodeModel.js";

// No ambiguous characters (0/O, 1/I/L)
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const MAX_ACTIVE_CODES = 100;

const generateCode = () => {
  const bytes = crypto.randomBytes(8);
  let raw = "";
  for (const b of bytes) raw += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
};

const MAX_USES_LIMIT = 100;

export const createInvitation = async (req, res) => {
  try {
    const { expiresInDays, maxUses } = req.body;

    let expiresAt = null;
    if (expiresInDays !== undefined && expiresInDays !== null) {
      const days = Number(expiresInDays);
      if (!Number.isFinite(days) || days < 1 || days > 365) {
        return res
          .status(400)
          .json({ error: true, message: "expiresInDays must be between 1 and 365." });
      }
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    let uses = 1;
    if (maxUses !== undefined && maxUses !== null) {
      uses = Number(maxUses);
      if (!Number.isInteger(uses) || uses < 1 || uses > MAX_USES_LIMIT) {
        return res.status(400).json({
          error: true,
          message: `maxUses must be an integer between 1 and ${MAX_USES_LIMIT}.`,
        });
      }
    }

    const activeCount = await InvitationCode.countDocuments({
      revoked: { $ne: true },
      $expr: { $lt: ["$usedCount", "$maxUses"] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });
    if (activeCount >= MAX_ACTIVE_CODES) {
      return res.status(400).json({
        error: true,
        message: `Too many active invitation codes (max ${MAX_ACTIVE_CODES}). Revoke unused ones first.`,
      });
    }

    let invitation = null;
    for (let attempt = 0; attempt < 3 && !invitation; attempt++) {
      try {
        invitation = await InvitationCode.create({
          code: generateCode(),
          createdBy: req.user.id,
          expiresAt,
          maxUses: uses,
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
    if (!invitation) {
      return res.status(500).json({ error: true, message: "Could not generate a unique code." });
    }

    logger.info(`[invitations] Code created by ${req.user.username} (maxUses: ${uses}, expires: ${expiresAt ?? "never"})`);

    res.status(201).json({
      error: false,
      invitation: {
        _id: invitation._id,
        code: invitation.code,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        maxUses: invitation.maxUses,
        usedCount: 0,
        uses: [],
      },
    });
  } catch (error) {
    logger.error("[invitations] create error:", error.message);
    res.status(500).json({ error: true, message: "Error creating invitation code." });
  }
};

const statusOf = (inv, now) => {
  if (inv.revoked) return "revoked";
  if ((inv.usedCount || 0) >= inv.maxUses) return "used";
  if (inv.expiresAt && inv.expiresAt.getTime() < now) return "expired";
  return "active";
};

export const listInvitations = async (req, res) => {
  try {
    const invitations = await InvitationCode.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("createdBy", "username")
      .populate("uses.user", "username")
      .lean();

    const now = Date.now();
    res.json({
      error: false,
      invitations: invitations.map((inv) => ({
        _id: inv._id,
        code: inv.code,
        createdAt: inv.createdAt,
        createdBy: inv.createdBy?.username ?? null,
        expiresAt: inv.expiresAt,
        maxUses: inv.maxUses,
        usedCount: inv.usedCount || 0,
        uses: (inv.uses || []).map((u) => ({
          username: u.user?.username ?? null,
          usedAt: u.usedAt,
        })),
        status: statusOf(inv, now),
      })),
    });
  } catch (error) {
    logger.error("[invitations] list error:", error.message);
    res.status(500).json({ error: true, message: "Error fetching invitation codes." });
  }
};

// Never used → hard delete. Already used → revoke (disable further use) while
// keeping the usage history for audit.
export const deleteInvitation = async (req, res) => {
  try {
    const invitation = await InvitationCode.findById(req.params.id);
    if (!invitation) {
      return res.status(404).json({ error: true, message: "Invitation code not found." });
    }

    if ((invitation.usedCount || 0) === 0 && (invitation.uses || []).length === 0) {
      await InvitationCode.deleteOne({ _id: invitation._id });
      logger.info(`[invitations] Code ${invitation.code} deleted by ${req.user.username}`);
      return res.json({ error: false, message: "Invitation code deleted.", deleted: true });
    }

    if (invitation.revoked) {
      return res.json({ error: false, message: "Invitation code already revoked.", deleted: false });
    }

    invitation.revoked = true;
    await invitation.save();
    logger.info(`[invitations] Code ${invitation.code} revoked by ${req.user.username}`);
    res.json({ error: false, message: "Invitation code revoked.", deleted: false });
  } catch (error) {
    logger.error("[invitations] delete error:", error.message);
    res.status(500).json({ error: true, message: "Error deleting invitation code." });
  }
};
