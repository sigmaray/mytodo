import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

/**
 * Метаданные вложения, сохраняемые в комментарии и возвращаемые через API.
 *
 * @typedef {Object} AttachmentMetadata
 * @property {string} id - Идентификатор сущности, с которой работает модуль.
 * @property {string} name - Данные «name», используемые типом «AttachmentMetadata».
 * @property {string} mimeType - Данные «mime type», используемые типом «AttachmentMetadata».
 * @property {number} size - Данные «size», используемые типом «AttachmentMetadata».
 */
export type AttachmentMetadata = {
  id: string;

  name: string;

  mimeType: string;

  size: number;
};

/**
 * Проверяет имена, MIME-типы и предельные размеры загружаемых файлов.
 *
 * @param {Array<File>} files
 * @returns {"invalid-file" | "limits-exceeded" | null}
 */
export const validateAttachmentFiles = (files: Array<File>): "invalid-file" | "limits-exceeded" | null => {
  /** Сначала проверяем метаданные файлов, затем их количество и суммарный объём. */
  const invalidFile = files.some((file) => {
    /** Проверяем суффикс отдельно, потому что basename уже ограничивает путь ниже. */
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
  /** Сначала возвращаем ошибку метаданных, чтобы причины отказа были однозначными. */
  if (invalidFile) return "invalid-file";
  /** Лимиты ограничивают количество файлов, размер каждого файла и общий объём запроса. */
  if (
    files.length > 10 ||
    files.some((file) => file.size > 10 * 1024 * 1024) ||
    files.reduce((sum, file) => sum + file.size, 0) > 25 * 1024 * 1024
  )
    return "limits-exceeded";
  return null;
};

/**
 * Определяет тип изображения по сигнатуре байтов, не доверяя расширению файла.
 *
 * @param {Buffer} contents
 * @returns {string | null}
 */
export const detectSafeImageMimeType = (contents: Buffer): string | null => {
  /** MIME определяется по сигнатурам форматов, а не по имени или заголовку клиента. */
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
 * Создаёт файловое хранилище вложений, доступ к которому адресуется UUID.
 *
 * @param {string | null} directory
 * @returns Результат выполнения функции.
 */
export const createAttachmentStorage = (directory: string | null) => {
  /** Разрешаем каталог при создании, чтобы операции не зависели от текущей директории. */
  const resolvedDirectory = directory?.trim() ? resolve(directory) : null;
  /**
   * Проверка UUID не позволяет использовать идентификатор как путь к произвольному файлу.
   *
   * @param {string} id
   */
  const pathForId = (id: string) =>
    resolvedDirectory !== null && /^[0-9a-f-]{36}$/i.test(id) ? resolve(resolvedDirectory, id) : null;

  /**
   * Удаляет файл вложения, если его идентификатор допустим.
   *
   * @param {string} id
   */
  const remove = async (id: string) => {
    const path = pathForId(id);
    if (path !== null) await rm(path, { force: true });
  };

  /**
   * Удаляет несколько файлов, например при очистке удалённых комментариев.
   *
   * @param {Array<string>} ids
   */
  const removeMany = async (ids: Array<string>) => Promise.all(ids.map(remove));

  /**
   * Записывает один файл с закрытыми правами и возвращает его метаданные.
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
      /** Нормализуем разделители пути и оставляем только имя файла для интерфейса. */
      name: basename(file.name.replaceAll("\\", "/")).slice(0, 255) || "attachment",
      /** Ограничиваем длину типа и задаём нейтральное значение при пустом MIME. */
      mimeType: file.type.slice(0, 128) || "application/octet-stream",
      size: file.size,
    };
  };

  /**
   * Сохраняет файлы набора; при ошибке удаляет все уже записанные файлы этого набора.
   *
   * @param {Array<File>} files
   * @returns {Promise<Array<AttachmentMetadata>>}
   */
  const saveMany = async (files: Array<File>): Promise<Array<AttachmentMetadata>> => {
    /**
     * Последовательная запись позволяет откатить именно успешно сохранённую часть набора.
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
   * Читает содержимое файла или возвращает `null`, если его нельзя получить.
   *
   * @param {string} id
   * @returns Результат выполнения функции.
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
 * Тип операций, предоставляемых настроенным файловым хранилищем.
 *
 * @typedef {ReturnType<typeof createAttachmentStorage>} AttachmentStorage
 */
export type AttachmentStorage = ReturnType<typeof createAttachmentStorage>;
