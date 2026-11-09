import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

export type AttachmentMetadata = Readonly<{
  id: string;
  name: string;
  mimeType: string;
  size: number;
}>;

export const validateAttachmentFiles = (
  files: ReadonlyArray<File>,
): "invalid-file" | "limits-exceeded" | null => {
  const invalidFile = files.some((file) => {
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
  if (invalidFile) return "invalid-file";
  if (
    files.length > 10 ||
    files.some((file) => file.size > 10 * 1024 * 1024) ||
    files.reduce((sum, file) => sum + file.size, 0) > 25 * 1024 * 1024
  )
    return "limits-exceeded";
  return null;
};

export const detectSafeImageMimeType = (contents: Buffer): string | null => {
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

export const createAttachmentStorage = (directory: string | null) => {
  const resolvedDirectory = directory?.trim() ? resolve(directory) : null;
  const pathForId = (id: string) =>
    resolvedDirectory !== null && /^[0-9a-f-]{36}$/i.test(id) ? resolve(resolvedDirectory, id) : null;

  const remove = async (id: string) => {
    const path = pathForId(id);
    if (path !== null) await rm(path, { force: true });
  };

  const removeMany = async (ids: ReadonlyArray<string>) => Promise.all(ids.map(remove));

  const saveOne = async (file: File): Promise<AttachmentMetadata> => {
    if (resolvedDirectory === null) throw new Error("Attachment storage is disabled");
    const id = crypto.randomUUID();
    const path = pathForId(id);
    if (path === null) throw new Error("Invalid attachment identifier");
    await mkdir(resolvedDirectory, { recursive: true });
    await writeFile(path, new Uint8Array(await file.arrayBuffer()), { flag: "wx", mode: 0o600 });
    return Object.freeze({
      id,
      name: basename(file.name.replaceAll("\\", "/")).slice(0, 255) || "attachment",
      mimeType: file.type.slice(0, 128) || "application/octet-stream",
      size: file.size,
    });
  };

  const saveMany = async (files: ReadonlyArray<File>): Promise<ReadonlyArray<AttachmentMetadata>> => {
    const saveRemaining = async (
      index: number,
      saved: ReadonlyArray<AttachmentMetadata>,
    ): Promise<ReadonlyArray<AttachmentMetadata>> => {
      if (index >= files.length) return Object.freeze([...saved]);
      try {
        const savedAttachment = await saveOne(files[index]!);
        return await saveRemaining(index + 1, [...saved, savedAttachment]);
      } catch (error) {
        await removeMany(saved.map((item) => item.id));
        throw error;
      }
    };
    return saveRemaining(0, Object.freeze([]));
  };

  const read = async (id: string) => {
    const path = pathForId(id);
    if (path === null) return null;
    try {
      return await readFile(path);
    } catch {
      return null;
    }
  };

  return Object.freeze({
    enabled: resolvedDirectory !== null,
    saveOne,
    saveMany,
    remove,
    removeMany,
    read,
  });
};
