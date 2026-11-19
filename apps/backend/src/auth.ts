import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** Scrypt parameters control the computational cost of password hashing. */
const scryptCost = 16_384;
const scryptBlockSize = 8;
const scryptParallelization = 1;
const keyLength = 64;
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

/** Name of the cookie used by the browser to send the user session token. */
export const sessionCookieName = "todoist_session";
/** Session lifetime in seconds for both the cookie and the stored record. */
export const sessionLifetimeSeconds = sessionLifetimeMs / 1000;

/**
 * Asynchronously derives a password key using the specified length and scrypt parameters.
 *
 * @param {string} password
 * @param {Buffer} salt
 */
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

/**
 * Generates a salt and returns a hash record for later password verification.
 *
 * @param {string} password
 * @returns The encoded password hash.
 */
export const hashPassword = async (password: string) => {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);

  return `scrypt$${scryptCost}$${scryptBlockSize}$${scryptParallelization}$${salt.toString("hex")}$${key.toString("hex")}`;
};

/**
 * Compares a password with its stored hash using a timing-safe key comparison.
 *
 * @param {string} password
 * @param {string} storedHash
 * @returns Whether the password matches the stored hash.
 */
export const verifyPassword = async (password: string, storedHash: string) => {
  /** Reject unknown algorithms and hash parameters first. */
  const [algorithm, costText, blockSizeText, parallelizationText, saltText, keyText] = storedHash.split("$");

  /** Validate hex field lengths before converting the string to bytes. */
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

/**
 * Creates an unpredictable token that the server issues to the client as a cookie.
 */
export const createSessionToken = () => randomBytes(32).toString("base64url");

/**
 * Hashes a token before storing it so the bearer secret is never stored in plaintext.
 *
 * @param {string} token
 */
export const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");
