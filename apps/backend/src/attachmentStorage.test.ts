import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createAttachmentStorage,
  detectSafeImageMimeType,
  validateAttachmentFiles,
} from "./attachmentStorage";

let temporaryDirectory: string | null = null;

const createStorage = async () => {
  const directory = await mkdtemp(join(tmpdir(), "todoist-attachments-"));
  temporaryDirectory = directory;
  return createAttachmentStorage(directory);
};

afterEach(async () => {
  if (temporaryDirectory !== null) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = null;
});

describe("attachment storage", () => {
  it("saves, reads, and removes files using generated storage identifiers", async () => {
    const storage = await createStorage();
    const [attachment] = await storage.saveMany([
      new File(["hello"], "folder\\note.txt", { type: "text/plain" }),
    ]);

    expect(attachment).toMatchObject({ name: "note.txt", mimeType: "text/plain", size: 5 });
    expect(await storage.read(attachment!.id)).toEqual(Buffer.from("hello"));

    await storage.remove(attachment!.id);
    expect(await storage.read(attachment!.id)).toBeNull();
    expect(await storage.read("../../outside")).toBeNull();
  });

  it("validates upload names, MIME types, and aggregate size limits", () => {
    expect(validateAttachmentFiles([new File(["ok"], "note.txt", { type: "text/plain" })])).toBeNull();
    expect(validateAttachmentFiles([new File(["bad"], "bad.txt\n", { type: "text/plain" })])).toBe(
      "invalid-file",
    );
    expect(
      validateAttachmentFiles(Array.from({ length: 11 }, (_, index) => new File(["x"], `${index}.txt`))),
    ).toBe("limits-exceeded");
  });

  it("detects image types from file contents rather than the declared MIME type", () => {
    expect(detectSafeImageMimeType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(detectSafeImageMimeType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });
});
