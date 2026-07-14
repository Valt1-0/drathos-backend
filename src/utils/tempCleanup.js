import fs from "fs";
import path from "path";
import logger from "./logger.js";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Aborted/malformed uploads leave multer temp files behind — sweep anything
// older than 24h, at startup then every 6h.
export function scheduleTempCleanup(dir, label) {
  const sweep = () => {
    try {
      const now = Date.now();
      for (const file of fs.readdirSync(dir)) {
        const filePath = path.join(dir, file);
        try {
          if (now - fs.statSync(filePath).mtimeMs > MAX_AGE_MS) {
            fs.unlinkSync(filePath);
            logger.info(`[tempCleanup:${label}] Removed: ${file}`);
          }
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      logger.warn(`[tempCleanup:${label}] Error: ${err.message}`);
    }
  };

  sweep();
  setInterval(sweep, SWEEP_INTERVAL_MS).unref();
}
