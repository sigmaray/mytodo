import { hashPassword } from "./auth";
import { getDatabaseUrl } from "./database-url";
import { createPostgresUserRepository } from "./db/users-repository";

/** The CLI uses the same connection configuration as the backend application. */
const databaseUrl = getDatabaseUrl();
/** Read the action and its arguments after the `users` subcommand. */
const [action, ...args] = process.argv.slice(2);
/** Always close the repository in `finally`, regardless of the command result. */
const users = createPostgresUserRepository(databaseUrl);

/**
 * Prints the syntax for supported account management commands.
 */
const usage = () => {
  console.error("Usage:");
  console.error("  pnpm --filter @todoist-clone/backend users list");
  console.error("  pnpm --filter @todoist-clone/backend users create <username> <password> [--admin]");
  console.error(
    "  pnpm --filter @todoist-clone/backend users update <username> [--name=<username>] [--password=<password>] [--admin=true|false]",
  );
  console.error("  pnpm --filter @todoist-clone/backend users delete <username>");
};

/**
 * Returns a CLI option value in `--name=value` format, if provided.
 *
 * @param {string} name
 */
const option = (name: string) => args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);

/**
 * Runs the selected command and closes the PostgreSQL connection when it finishes.
 *
 * @returns The command result.
 */
const run = async () => {
  if (action === "list") {
    console.log(JSON.stringify(await users.list(), null, 2));
    return;
  }

  if (action === "create") {
    const [username, password] = args;
    if (!username || !password) return usage();
    /** Do not create accounts until an existing administrator can sign in. */
    const existingAdmins = await Promise.all(
      (await users.list()).filter((user) => user.isAdmin).map((user) => users.getById(user.id)),
    );
    if (existingAdmins.some((user) => user?.passwordHash === null))
      throw new Error("Set a password for the existing administrator before creating accounts");
    const created = await users.create(
      username.trim().toLowerCase(),
      await hashPassword(password),
      args.includes("--admin"),
    );
    console.log(JSON.stringify(created, null, 2));
    return;
  }

  if (action === "update") {
    const username = args[0];
    if (!username) return usage();
    const existing = await users.getByUsername(username.trim().toLowerCase());
    if (existing === null) throw new Error("User not found");
    /** Validate the role before building the patch so a typo cannot change the account. */
    const nextAdmin = option("--admin");
    if (nextAdmin !== undefined && nextAdmin !== "true" && nextAdmin !== "false")
      throw new Error("--admin must be true or false");
    if (option("--password") === "") throw new Error("Password must not be empty");
    if (
      existing.isAdmin &&
      nextAdmin === "false" &&
      (await users.list()).filter((user) => user.isAdmin).length < 2
    )
      throw new Error("Cannot remove the last administrator");
    /** Include only supplied options in the patch so other settings are preserved. */
    const patch = {
      ...(option("--name") === undefined ? {} : { username: option("--name")!.trim().toLowerCase() }),
      ...(option("--password") === undefined
        ? {}
        : { passwordHash: await hashPassword(option("--password")!) }),
      ...(nextAdmin === undefined ? {} : { isAdmin: nextAdmin === "true" }),
    };
    if (Object.keys(patch).length === 0) return usage();
    const updated = await users.update(existing.id, patch);
    if (updated === null) throw new Error("Username already exists");
    console.log(JSON.stringify(updated, null, 2));
    return;
  }

  if (action === "delete") {
    const username = args[0];
    if (!username) return usage();
    const existing = await users.getByUsername(username.trim().toLowerCase());
    if (existing === null) throw new Error("User not found");
    /** Keep the last administrator account so access to the system can be recovered. */
    if (existing.isAdmin && (await users.list()).filter((user) => user.isAdmin).length < 2)
      throw new Error("Cannot delete the last administrator");
    await users.delete(existing.id);
    console.log(`Deleted user ${existing.username}`);
    return;
  }

  usage();
  process.exitCode = 1;
};

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "User command failed");
    process.exitCode = 1;
  })
  .finally(() => users.close());
