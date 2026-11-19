import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

/**
 * Attachment metadata stored with a comment and returned by the API.
 *
 * @typedef {Object} AttachmentMetadata
 * @property {string} id - Unique attachment identifier.
 * @property {string} name - Original file name.
 * @property {string} mimeType - File MIME type.
 * @property {number} size - File size in bytes.
 */
export type AttachmentMetadata = {
  id: string;

  name: string;

  mimeType: string;

  size: number;
};

/**
 * Validates uploaded file names, MIME types, and size limits.
 *
 * @param {Array<File>} files
 * @returns {"invalid-file" | "limits-exceeded" | null}
 */
export const validateAttachmentFiles = (files: Array<File>): "invalid-file" | "limits-exceeded" | null => {
  /** Validate file metadata first, then check the file count and total size. */
  const invalidFile = files.some((file) => {
    /** Validate the suffix separately; basename is used below to constrain the path. */
    const extension = extname(file.name);
    const validName =
      file.name.length > 0 &&
      file.name.length <= 255 &&
      (extension.length === 0 || /^\.[a-z0-9]{1,16}$/i.test(extension));
    const validMime =
      file.type.length === 0 ||
      /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,63}$/i.test(file.type);
    return !validName || !validMime;
  });
  /** Return metadata errors first so each rejection has a clear reason. */
  if (invalidFile) return "invalid-file";
  /** Limits apply to the file count, individual file sizes, and total request size. */
  if (
    files.length > 10 ||
    files.some((file) => file.size > 10 * 1024 * 1024) ||
    files.reduce((sum, file) => sum + file.size, 0) > 25 * 1024 * 1024
  )
    return "limits-exceeded";
  return null;
};

/**
 * Detects an image type from its byte signature instead of trusting the file extension.
 *
 * @param {Buffer} contents
 * @returns {string | null}
 */
export const detectSafeImageMimeType = (contents: Buffer): string | null => {
  /** Determine MIME from the format signature, not the name or client-provided header. */
  const isPng =
    contents.length >= 8 && contents.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = contents.length >= 3 && contents[0] === 255 && contents[1] === 216 && contents[2] === 255;
  const isGif = contents.length >= 6 && contents.subarray(0, 3).toString("ascii") === "GIF";
  const isWebp =
    contents.length >= 12 &&
    contents.subarray(0, 4).toString("ascii") === "RIFF" &&
    contents.subarray(8, 12).toString("ascii") === "WEBP";
  return isPng ? "image/png" : isJpeg ? "image/jpeg" : isGif ? "image/gif" : isWebp ? "image/webp" : null;
};

/**
 * Creates file storage for attachments addressed by UUID.
 *
 * @param {string | null} directory
 * @returns The configured attachment storage.
 */
export const createAttachmentStorage = (directory: string | null) => {
  /** Resolve the directory once so operations do not depend on the current working directory. */
  const resolvedDirectory = directory?.trim() ? resolve(directory) : null;
  /**
   * UUID validation prevents an identifier from being used as an arbitrary file path.
   *
   * @param {string} id
   */
  const pathForId = (id: string) =>
    resolvedDirectory !== null && /^[0-9a-f-]{36}$/i.test(id) ? resolve(resolvedDirectory, id) : null;

  /**
   * Deletes an attachment file if its identifier is valid.
   *
   * @param {string} id
   */
  const remove = async (id: string) => {
    const path = pathForId(id);
    if (path !== null) await rm(path, { force: true });
  };

  /**
   * Deletes multiple files, for example when cleaning up deleted comments.
   *
   * @param {Array<string>} ids
   */
  const removeMany = async (ids: Array<string>) => Promise.all(ids.map(remove));

  /**
   * Writes one file with restricted permissions and returns its metadata.
   *
   * @param {File} file
   * @returns {Promise<AttachmentMetadata>}
   */
  const saveOne = async (file: File): Promise<AttachmentMetadata> => {
    if (resolvedDirectory === null) throw new Error("Attachment storage is disabled");
    const id = crypto.randomUUID();
    const path = pathForId(id);
    if (path === null) throw new Error("Invalid attachment identifier");
    await mkdir(resolvedDirectory, { recursive: true });
    await writeFile(path, new Uint8Array(await file.arrayBuffer()), { flag: "wx", mode: 0o600 });
    return {
      id,
      /** Normalize path separators and keep only the file name for display. */
      name: basename(file.name.replaceAll("\\", "/")).slice(0, 255) || "attachment",
      /** Limit the MIME type length and use a neutral value when it is empty. */
      mimeType: file.type.slice(0, 128) || "application/octet-stream",
      size: file.size,
    };
  };

  /**
   * Saves a batch of files and removes any files already written if an error occurs.
   *
   * @param {Array<File>} files
   * @returns {Promise<Array<AttachmentMetadata>>}
   */
  const saveMany = async (files: Array<File>): Promise<Array<AttachmentMetadata>> => {
    /**
     * Sequential writes make it possible to roll back exactly the files already saved.
     *
     * @param {number} index
     * @param {Array<AttachmentMetadata>} saved
     * @returns {Promise<Array<AttachmentMetadata>>}
     */
    const saveRemaining = async (
      index: number,
      saved: Array<AttachmentMetadata>,
    ): Promise<Array<AttachmentMetadata>> => {
      if (index >= files.length) return [...saved];
      try {
        const savedAttachment = await saveOne(files[index]!);
        return await saveRemaining(index + 1, [...saved, savedAttachment]);
      } catch (error) {
        await removeMany(saved.map((item) => item.id));
        throw error;
      }
    };
    return saveRemaining(0, []);
  };

  /**
   * Reads a file's contents or returns `null` if it cannot be retrieved.
   *
   * @param {string} id
   * @returns The file contents, or `null` when unavailable.
   */
  const read = async (id: string) => {
    const path = pathForId(id);
    if (path === null) return null;
    try {
      return await readFile(path);
    } catch {
      return null;
    }
  };

  return {
    enabled: resolvedDirectory !== null,
    saveOne,
    saveMany,
    remove,
    removeMany,
    read,
  };
};

/**
 * Operations provided by the configured file storage.
 *
 * @typedef {ReturnType<typeof createAttachmentStorage>} AttachmentStorage
 */
export type AttachmentStorage = ReturnType<typeof createAttachmentStorage>;
