import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { sha256File } from "../src/utils/fileHash.js";

let dir;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "drathos-hash-"));
});
afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("sha256File", () => {
  it("matches Node's crypto over the same bytes", async () => {
    const p = path.join(dir, "a.bin");
    const data = Buffer.from("crumb circuit simulator archive bytes");
    fs.writeFileSync(p, data);
    const expected = crypto.createHash("sha256").update(data).digest("hex");
    expect(await sha256File(p)).toBe(expected);
  });

  it("is deterministic and content-sensitive", async () => {
    const p1 = path.join(dir, "b.bin");
    const p2 = path.join(dir, "c.bin");
    fs.writeFileSync(p1, "same");
    fs.writeFileSync(p2, "same");
    expect(await sha256File(p1)).toBe(await sha256File(p2));

    fs.writeFileSync(p2, "different");
    expect(await sha256File(p1)).not.toBe(await sha256File(p2));
  });

  it("rejects on a missing file", async () => {
    await expect(sha256File(path.join(dir, "nope.bin"))).rejects.toBeTruthy();
  });
});
