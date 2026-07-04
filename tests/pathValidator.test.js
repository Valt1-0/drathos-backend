import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  sanitizePath,
  validateFileName,
  validateFileAccess,
  validateMagicBytes,
  cleanFileName,
} from "../src/utils/pathValidator.js";

// Real temp directories: sanitizePath resolves symlinks on the base dir,
// so it needs an existing directory on disk.
let baseDir;
let outsideDir;

beforeAll(() => {
  baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "drathos-base-"));
  outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "drathos-outside-"));
  fs.writeFileSync(path.join(baseDir, "game.zip"), "dummy");
  fs.writeFileSync(path.join(outsideDir, "secret.txt"), "secret");
});

afterAll(() => {
  fs.rmSync(baseDir, { recursive: true, force: true });
  fs.rmSync(outsideDir, { recursive: true, force: true });
});

describe("sanitizePath", () => {
  it("accepts a plain filename inside the base directory", () => {
    const result = sanitizePath(baseDir, "game.zip");
    expect(result).toBe(fs.realpathSync(path.join(baseDir, "game.zip")));
  });

  it("accepts a not-yet-existing filename (new upload)", () => {
    const result = sanitizePath(baseDir, "new-upload.zip");
    expect(result.startsWith(fs.realpathSync(baseDir))).toBe(true);
  });

  it("rejects parent-directory traversal", () => {
    expect(() => sanitizePath(baseDir, "../escape.zip")).toThrow(/Access denied/);
  });

  it("rejects deep traversal to an existing outside file", () => {
    const traversal = path.relative(baseDir, path.join(outsideDir, "secret.txt"));
    expect(() => sanitizePath(baseDir, traversal)).toThrow(/Access denied/);
  });

  it("rejects absolute paths pointing outside the base", () => {
    expect(() => sanitizePath(baseDir, path.join(outsideDir, "secret.txt"))).toThrow(
      /Access denied/
    );
  });

  it("rejects a symlink escaping the base directory", () => {
    const linkPath = path.join(baseDir, "sneaky-link");
    try {
      fs.symlinkSync(path.join(outsideDir, "secret.txt"), linkPath);
    } catch {
      // Symlink creation needs privileges on Windows — skip silently there
      return;
    }
    expect(() => sanitizePath(baseDir, "sneaky-link")).toThrow(/Access denied/);
  });
});

describe("validateFileName", () => {
  it("accepts a clean archive filename", () => {
    expect(validateFileName("hollow_knight.zip")).toBe("hollow_knight.zip");
    expect(validateFileName("game.tar.gz")).toBe("game.tar.gz");
  });

  it("rejects empty or non-string input", () => {
    expect(() => validateFileName("")).toThrow(/Invalid filename/);
    expect(() => validateFileName(null)).toThrow(/Invalid filename/);
    expect(() => validateFileName(42)).toThrow(/Invalid filename/);
  });

  it("rejects path traversal sequences", () => {
    expect(() => validateFileName("..evil.zip")).toThrow(/traversal/);
  });

  it("rejects path separators", () => {
    expect(() => validateFileName("dir/file.zip")).toThrow(/separators/);
    expect(() => validateFileName("dir\\file.zip")).toThrow(/separators/);
  });

  it("rejects forbidden characters including control chars", () => {
    expect(() => validateFileName("ga<me>.zip")).toThrow(/forbidden characters/);
    expect(() => validateFileName("game\x00.zip")).toThrow(/forbidden characters/);
  });

  it("rejects disallowed extensions", () => {
    expect(() => validateFileName("malware.exe")).toThrow(/Disallowed extension/);
    expect(() => validateFileName("script.sh")).toThrow(/Disallowed extension/);
  });

  it("rejects names longer than 255 characters", () => {
    const long = "a".repeat(256) + ".zip";
    expect(() => validateFileName(long)).toThrow(/too long/);
  });
});

describe("validateFileAccess", () => {
  it("returns the resolved path for an existing file in the allowed dir", () => {
    const result = validateFileAccess("game.zip", baseDir);
    expect(result).toBe(fs.realpathSync(path.join(baseDir, "game.zip")));
  });

  it("rejects missing files", () => {
    expect(() => validateFileAccess("nope.zip", baseDir)).toThrow(/File not found/);
  });

  it("rejects directories", () => {
    const sub = path.join(baseDir, "subdir");
    fs.mkdirSync(sub, { recursive: true });
    expect(() => validateFileAccess("subdir", baseDir)).toThrow(/not point to a file/);
  });

  it("rejects traversal out of the allowed dir", () => {
    expect(() =>
      validateFileAccess(path.join(outsideDir, "secret.txt"), baseDir)
    ).toThrow(/Access denied/);
  });
});

describe("validateMagicBytes", () => {
  const writeTmp = (name, bytes) => {
    const p = path.join(baseDir, name);
    fs.writeFileSync(p, Buffer.from(bytes));
    return p;
  };

  it("accepts a real ZIP signature", () => {
    const p = writeTmp("ok.zip", [0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(validateMagicBytes(p, ".zip")).toBe(true);
  });

  it("accepts a real 7z signature", () => {
    const p = writeTmp("ok.7z", [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);
    expect(validateMagicBytes(p, ".7z")).toBe(true);
  });

  it("accepts a real gzip signature", () => {
    const p = writeTmp("ok.gz", [0x1f, 0x8b, 0x08]);
    expect(validateMagicBytes(p, ".gz")).toBe(true);
  });

  it("rejects an executable renamed to .zip", () => {
    // MZ header (Windows PE) disguised as a zip
    const p = writeTmp("fake.zip", [0x4d, 0x5a, 0x90, 0x00]);
    expect(validateMagicBytes(p, ".zip")).toBe(false);
  });

  it("rejects a file shorter than the signature", () => {
    const p = writeTmp("tiny.7z", [0x37]);
    expect(validateMagicBytes(p, ".7z")).toBe(false);
  });

  it("passes through extensions without a known signature (.tar)", () => {
    const p = writeTmp("whatever.tar", [0x00, 0x01]);
    expect(validateMagicBytes(p, ".tar")).toBe(true);
  });
});

describe("cleanFileName", () => {
  it("lowercases and replaces unsafe characters with underscores", () => {
    expect(cleanFileName("My Game (v1.2)!")).toBe("my_game_v1_2_");
  });

  it("collapses repeated underscores", () => {
    expect(cleanFileName("a  --  b")).toBe("a_--_b");
    expect(cleanFileName("a!!!b")).toBe("a_b");
  });

  it("truncates to 200 characters", () => {
    expect(cleanFileName("x".repeat(300))).toHaveLength(200);
  });
});
