/**
 * Where uploaded files live, and the guard that stops a filename escaping it.
 *
 * The traversal case is not hypothetical. Most callers pass a nanoid
 * generated at upload time, but emailReview resolves the name on an inbound
 * email attachment, which is chosen by whoever sent the message. The same
 * resolved path is then read from and, in other call sites, unlinked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "path";

async function loadWith(uploadDir?: string) {
  vi.resetModules();
  if (uploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = uploadDir;
  return import("../uploadsDir");
}

const saved = { ...process.env };
beforeEach(() => { delete process.env.UPLOAD_DIR; });
afterEach(() => { process.env = { ...saved }; });

describe("UPLOADS_DIR", () => {
  it("defaults to ./uploads under the working directory", async () => {
    const m = await loadWith(undefined);
    expect(m.UPLOADS_DIR).toBe(path.join(process.cwd(), "uploads"));
  });

  it("follows UPLOAD_DIR when set, which is how a mounted volume is used", async () => {
    const m = await loadWith("/data/uploads");
    expect(m.UPLOADS_DIR).toBe("/data/uploads");
  });

  it("is always absolute, so it does not depend on the working directory later", async () => {
    const m = await loadWith("some/relative/dir");
    expect(path.isAbsolute(m.UPLOADS_DIR)).toBe(true);
  });

  it("ignores an empty or whitespace value rather than resolving to root", async () => {
    expect((await loadWith("   ")).UPLOADS_DIR).toBe(path.join(process.cwd(), "uploads"));
  });
});

describe("uploadPath", () => {
  it("joins an ordinary filename", async () => {
    const m = await loadWith("/data/uploads");
    expect(m.uploadPath("abc123.pdf")).toBe("/data/uploads/abc123.pdf");
  });

  it("refuses a name that climbs out of the directory", async () => {
    const m = await loadWith("/data/uploads");
    for (const bad of ["../secrets.env", "../../etc/passwd", "sub/../../escape.txt"]) {
      expect(() => m.uploadPath(bad), `"${bad}" should be refused`).toThrow(/escapes the uploads directory/);
    }
  });

  it("refuses an absolute path, which would ignore the directory entirely", async () => {
    const m = await loadWith("/data/uploads");
    expect(() => m.uploadPath("/etc/passwd")).toThrow(/escapes the uploads directory/);
  });

  it("does not refuse a name that merely shares the directory's prefix", async () => {
    // /data/uploads-other must not be treated as inside /data/uploads, and a
    // legitimate nested name must still resolve.
    const m = await loadWith("/data/uploads");
    expect(() => m.uploadPath("../uploads-other/x.pdf")).toThrow();
    expect(m.uploadPath("nested/file.pdf")).toBe("/data/uploads/nested/file.pdf");
  });

  it("uploadPathOrNull returns null instead of throwing", async () => {
    const m = await loadWith("/data/uploads");
    expect(m.uploadPathOrNull("../escape")).toBeNull();
    expect(m.uploadPathOrNull("ok.pdf")).toBe("/data/uploads/ok.pdf");
  });
});
