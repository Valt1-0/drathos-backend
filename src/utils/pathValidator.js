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
    throw new Error("Invalid filename");
  }

  // eslint-disable-next-line no-control-regex -- control chars are deliberately rejected in filenames
  const forbiddenChars = /[<>:"|?*\x00-\x1F]/g;
  if (forbiddenChars.test(filename)) {
    throw new Error("Filename contains forbidden characters");
  }

  if (filename.includes("..")) {
    throw new Error("Invalid filename: path traversal attempt detected");
  }

  if (filename.includes("/") || filename.includes("\\")) {
    throw new Error("Invalid filename: path separators not allowed");
  }

  const allowedExtensions = [".zip", ".7z", ".rar", ".tar", ".gz", ".tar.gz", ".tar.bz2"];
  const lowerFilename = filename.toLowerCase();
  const hasAllowedExtension = allowedExtensions.some((ext) => lowerFilename.endsWith(ext));

  if (!hasAllowedExtension) {
    const ext = path.extname(filename).toLowerCase();
    throw new Error(`Disallowed extension: ${ext}`);
  }

  if (filename.length > 255) {
    throw new Error("Filename too long (max 255 characters)");
  }

  return filename;
}

export function validateFileAccess(filePath, allowedDir) {
  const sanitized = sanitizePath(allowedDir, filePath);

  if (!fs.existsSync(sanitized)) {
    throw new Error("File not found");
  }

  const stats = fs.statSync(sanitized);
  if (!stats.isFile()) {
    throw new Error("Path does not point to a file");
  }

  return sanitized;
}

export function validateMagicBytes(filePath, extension) {
  const lowerExt = extension.toLowerCase();

  const XZ = { bytes: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00], offset: 0 }; // ýz XZ
  const GZ = { bytes: [0x1f, 0x8b], offset: 0 };                          // gzip
  const BZ = { bytes: [0x42, 0x5a, 0x68], offset: 0 };                    // BZh

  const SIGNATURES = {
    ".zip": { bytes: [0x50, 0x4b], offset: 0 },            // PK
    ".7z":  { bytes: [0x37, 0x7a, 0xbc, 0xaf], offset: 0 }, // 7z¼¯
    ".rar": { bytes: [0x52, 0x61, 0x72, 0x21], offset: 0 }, // Rar!
    ".gz":  GZ,
    ".tgz": GZ,
    ".tar.gz": GZ,
    ".bz2": BZ,
    ".tbz2": BZ,
    ".tar.bz2": BZ,
    ".xz":  XZ,
    ".txz": XZ,
    ".tar.xz": XZ,
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
