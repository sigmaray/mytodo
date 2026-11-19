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

/**
 * Creates a separate temporary file store to isolate a test scenario.
 *
 * @returns The temporary directory and attachment storage instance.
 */
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
  /** Check the full file lifecycle and ensure IDs cannot access unrelated paths. */
  /** The store writes, reads, and deletes a file by its generated identifier. */
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

  /** Invalid metadata and exceeded limits must block an upload. */
  /** Validate allowed names, MIME types, and total upload limits. */
  it("validates upload names, MIME types, and aggregate size limits", () => {
    expect(validateAttachmentFiles([new File(["ok"], "note.txt", { type: "text/plain" })])).toBeNull();
    expect(validateAttachmentFiles([new File(["bad"], "bad.txt\n", { type: "text/plain" })])).toBe(
      "invalid-file",
    );
    expect(
      validateAttachmentFiles(Array.from({ length: 11 }, (_, index) => new File(["x"], `${index}.txt`))),
    ).toBe("limits-exceeded");
  });

  /** Detect the type from the content signature, not the extension or client MIME value. */
  /** Identify image types by their byte signature, not by the client's declaration. */
  it("detects image types from file contents rather than the declared MIME type", () => {
    expect(detectSafeImageMimeType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(detectSafeImageMimeType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });
});
