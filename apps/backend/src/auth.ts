import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Параметры scrypt задают вычислительную стоимость хеширования пароля.
const scryptCost = 16_384;
const scryptBlockSize = 8;
const scryptParallelization = 1;
const keyLength = 64;
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

/** Имя cookie, которой браузер передаёт токен пользовательской сессии. */
export const sessionCookieName = "todoist_session";
/** Срок жизни сессии в секундах для cookie и записи в хранилище. */
export const sessionLifetimeSeconds = sessionLifetimeMs / 1000;

/** Асинхронно выводит ключ пароля заданной длины и параметров scrypt. */
const deriveKey = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      { N: scryptCost, r: scryptBlockSize, p: scryptParallelization, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error === null ? resolve(key) : reject(error)),
    );
  });

/** Генерирует соль и возвращает запись хеша для последующей проверки пароля. */
export const hashPassword = async (password: string) => {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);

  return `scrypt$${scryptCost}$${scryptBlockSize}$${scryptParallelization}$${salt.toString("hex")}$${key.toString("hex")}`;
};

/** Сверяет пароль с сохранённым хешем постоянным по времени сравнением ключей. */
export const verifyPassword = async (password: string, storedHash: string) => {
  // Сначала отклоняем неизвестные алгоритмы и параметры формата хеша.
  const [algorithm, costText, blockSizeText, parallelizationText, saltText, keyText] = storedHash.split("$");

  // Проверяем длину hex-полей перед преобразованием строки в байты.
  if (
    algorithm !== "scrypt" ||
    costText !== String(scryptCost) ||
    blockSizeText !== String(scryptBlockSize) ||
    parallelizationText !== String(scryptParallelization)
  ) {
    return false;
  }

  if (
    saltText === undefined ||
    keyText === undefined ||
    !/^[0-9a-f]{32}$/i.test(saltText) ||
    !/^[0-9a-f]{128}$/i.test(keyText)
  ) {
    return false;
  }

  const expected = Buffer.from(keyText, "hex");
  const actual = await deriveKey(password, Buffer.from(saltText, "hex"));

  return timingSafeEqual(actual, expected);
};

/** Создаёт непредсказуемый токен, который сервер выдаёт клиенту как cookie. */
export const createSessionToken = () => randomBytes(32).toString("base64url");

/** Хеширует токен перед сохранением, чтобы не хранить bearer-секрет открытым текстом. */
export const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");
