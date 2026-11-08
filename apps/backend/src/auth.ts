import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const scryptCost = 16_384;
const scryptBlockSize = 8;
const scryptParallelization = 1;
const keyLength = 64;
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export const sessionCookieName = "todoist_session";
export const sessionLifetimeSeconds = sessionLifetimeMs / 1000;

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

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);

  return `scrypt$${scryptCost}$${scryptBlockSize}$${scryptParallelization}$${salt.toString("hex")}$${key.toString("hex")}`;
};

export const verifyPassword = async (password: string, storedHash: string) => {
  const [algorithm, costText, blockSizeText, parallelizationText, saltText, keyText] = storedHash.split("$");

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

export const createSessionToken = () => randomBytes(32).toString("base64url");

export const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");
