import path from "path";
import fs from "fs";

export function sanitizePath(basePath, userPath) {
  // Resolve symlinks on the base directory (must already exist)
  const resolvedBase = fs.realpathSync(path.resolve(basePath));
  const joined = path.resolve(resolvedBase, userPath);

  if (fs.existsSync(joined)) {
    // Target exists — resolve its symlinks and verify it stays within base
    const realTarget = fs.realpathSync(joined);
    if (realTarget !== resolvedBase && !realTarget.startsWith(resolvedBase + path.sep)) {
      throw new Error("Access denied: path escapes base directory");
    }
    return realTarget;
  }

  // Target doesn't exist yet (new upload) — string boundary check is sufficient
  const relative = path.relative(resolvedBase, joined);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Access denied: invalid path");
  }
  return joined;
}

export function validateFileName(filename) {
  if (!filename || typeof filename !== "string") {
    throw new Error("Nom de fichier invalide");
  }

  const forbiddenChars = /[<>:"|?*\x00-\x1F]/g;
  if (forbiddenChars.test(filename)) {
    throw new Error("Nom de fichier contient des caractères interdits");
  }

  if (filename.includes("..")) {
    throw new Error(
      "Nom de fichier invalide: tentative de path traversal détectée"
    );
  }

  if (filename.includes("/") || filename.includes("\\")) {
    throw new Error("Nom de fichier invalide: chemin non autorisé");
  }

  const allowedExtensions = [".zip", ".7z", ".rar", ".tar", ".gz", ".tar.gz", ".tar.bz2"];
  const lowerFilename = filename.toLowerCase();
  const hasAllowedExtension = allowedExtensions.some((ext) => lowerFilename.endsWith(ext));

  if (!hasAllowedExtension) {
    const ext = path.extname(filename).toLowerCase();
    throw new Error(`Extension non autorisée: ${ext}`);
  }

  if (filename.length > 255) {
    throw new Error("Nom de fichier trop long (max 255 caractères)");
  }

  return filename;
}

export function validateFileAccess(filePath, allowedDir) {
  const sanitized = sanitizePath(allowedDir, filePath);

  if (!fs.existsSync(sanitized)) {
    throw new Error("Fichier introuvable");
  }

  const stats = fs.statSync(sanitized);
  if (!stats.isFile()) {
    throw new Error("Le chemin ne pointe pas vers un fichier");
  }

  return sanitized;
}

export function validateMagicBytes(filePath, extension) {
  const lowerExt = extension.toLowerCase();

  const SIGNATURES = {
    ".zip": { bytes: [0x50, 0x4b], offset: 0 },            // PK
    ".7z":  { bytes: [0x37, 0x7a, 0xbc, 0xaf], offset: 0 }, // 7z¼¯
    ".rar": { bytes: [0x52, 0x61, 0x72, 0x21], offset: 0 }, // Rar!
    ".gz":  { bytes: [0x1f, 0x8b], offset: 0 },              // gzip
    ".tgz": { bytes: [0x1f, 0x8b], offset: 0 },
    ".bz2": { bytes: [0x42, 0x5a, 0x68], offset: 0 },        // BZh
  };

  const rule = SIGNATURES[lowerExt];
  if (!rule) return true; // .tar and others with no known signature: pass through

  const bufSize = rule.offset + rule.bytes.length;
  const buf = Buffer.alloc(bufSize);
  let fd;
  try {
    fd = fs.openSync(filePath, "r");
    const bytesRead = fs.readSync(fd, buf, 0, bufSize, 0);
    if (bytesRead < bufSize) return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }

  return rule.bytes.every((b, i) => buf[rule.offset + i] === b);
}

export function cleanFileName(filename) {
  return filename
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 200);
}
