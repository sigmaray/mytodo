import { and, eq, gt, isNotNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { PublicUser, UserRecord, UserRepository } from "../users";
import { sessions, users } from "./schema";

/**
 * Removes the password and settings before returning a user to the client.
 *
 * @param {Pick<UserRecord, "id" | "username" | "isAdmin">} user
 * @returns {PublicUser}
 */
const toPublicUser = (user: Pick<UserRecord, "id" | "username" | "isAdmin">): PublicUser => ({
  id: user.id,
  username: user.username,
  isAdmin: user.isAdmin,
});

/**
 * Creates PostgreSQL storage for users, passwords, settings, and sessions.
 *
 * @param {string} databaseUrl
 * @returns {UserRepository}
 */
export const createPostgresUserRepository = (databaseUrl: string): UserRepository => {
  const client = postgres(databaseUrl, { max: 10 });
  const db = drizzle(client);

  return {
    /** Loads the internal account record by login name. */
    getByUsername: async (username) => {
      const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
      const row = rows[0];
      return row === undefined
        ? null
        : {
            id: row.id,
            username: row.username,
            passwordHash: row.passwordHash,
            isAdmin: row.isAdmin,
            confirmDelete: row.confirmDelete,
            inboxDescription: row.inboxDescription,
          };
    },
    /** Loads the internal account record by UUID. */
    getById: async (id) => {
      const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
      const row = rows[0];
      return row === undefined
        ? null
        : {
            id: row.id,
            username: row.username,
            passwordHash: row.passwordHash,
            isAdmin: row.isAdmin,
            confirmDelete: row.confirmDelete,
            inboxDescription: row.inboxDescription,
          };
    },
    /** Returns only the public fields for all users. */
    list: async () =>
      (
        await db
          .select({ id: users.id, username: users.username, isAdmin: users.isAdmin })
          .from(users)
          .orderBy(users.username)
      ).map(toPublicUser),
    /** Creates an account and returns its safe public representation. */
    create: async (username, passwordHash, isAdmin) => {
      const rows = await db
        .insert(users)
        .values({ id: crypto.randomUUID(), username, passwordHash, isAdmin })
        .returning({ id: users.id, username: users.username, isAdmin: users.isAdmin });
      const row = rows[0];
      if (row === undefined) throw new Error("User insert failed");
      return toPublicUser(row);
    },
    /** Updates user fields and revokes sessions when the password changes. */
    update: async (id, patch) => {
      /** Store the password hash separately from the other mutable public fields. */
      const { passwordHash, ...publicPatch } = patch;
      const rows = await db
        .update(users)
        .set({ ...publicPatch, passwordHash })
        .where(eq(users.id, id))
        .returning({ id: users.id, username: users.username, isAdmin: users.isAdmin });
      /** Revoke sessions only when the password changes; username edits should not sign users out. */
      if (passwordHash !== undefined) await db.delete(sessions).where(eq(sessions.userId, id));
      const row = rows[0];
      return row === undefined ? null : toPublicUser(row);
    },
    /** Sets the password and revokes all existing account sessions. */
    setPassword: async (id, passwordHash) => {
      const rows = await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, id))
        .returning({ id: users.id });
      await db.delete(sessions).where(eq(sessions.userId, id));
      return rows.length > 0;
    },
    /** Deletes the user's data and account in a single transaction. */
    delete: async (id) =>
      client.begin(async (transaction) => {
        /** Use a transaction so a partial failure cannot leave related data behind. */
        await transaction`DELETE FROM tasks WHERE user_id = ${id}`;
        await transaction`DELETE FROM sections WHERE user_id = ${id}`;
        await transaction`DELETE FROM projects WHERE user_id = ${id}`;
        await transaction`DELETE FROM sessions WHERE user_id = ${id}`;
        const deleted = await transaction`DELETE FROM users WHERE id = ${id} RETURNING id`;
        return deleted.length > 0;
      }),
    /** Checks whether at least one user has a password set. */
    hasPasswordUsers: async () =>
      (await db.select({ id: users.id }).from(users).where(isNotNull(users.passwordHash)).limit(1)).length >
      0,
    /** Saves a session after removing records that have already expired. */
    saveSession: async (tokenHash, userId, expiresAt) => {
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
      await db
        .insert(sessions)
        .values({ tokenHash, userId, expiresAt })
        .onConflictDoUpdate({ target: sessions.tokenHash, set: { userId, expiresAt } });
    },
    /** Checks token expiration and returns the UUID of the active session owner. */
    getSessionUserId: async (tokenHash, now) => {
      const rows = await db
        .select({ userId: sessions.userId })
        .from(sessions)
        .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
        .limit(1);
      return rows[0]?.userId ?? null;
    },
    /** Deletes a session by its hash. */
    deleteSession: async (tokenHash) => {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },
    /** Revokes all sessions for the specified user. */
    deleteAllSessions: async (userId) => {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    },
    /** Saves personal list settings and deletion confirmation preferences. */
    savePreferences: async (id, confirmDelete, inboxDescription) => {
      await db.update(users).set({ confirmDelete, inboxDescription }).where(eq(users.id, id));
    },
    /** Closes the repository's PostgreSQL connection pool. */
    close: async () => {
      await client.end();
    },
  };
};
