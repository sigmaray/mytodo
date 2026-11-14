import { hashPassword } from "./auth";
import { getDatabaseUrl } from "./database-url";
import { createPostgresUserRepository } from "./db/users-repository";

// CLI использует ту же конфигурацию подключения, что и backend-приложение.
const databaseUrl = getDatabaseUrl();
// Имя действия и аргументы читаются после названия подкоманды `users`.
const [action, ...args] = process.argv.slice(2);
// Репозиторий закрывается в finally независимо от результата команды.
const users = createPostgresUserRepository(databaseUrl);

/** Печатает синтаксис поддерживаемых команд управления учётными записями. */
const usage = () => {
  console.error("Usage:");
  console.error("  pnpm --filter @todoist-clone/backend users list");
  console.error("  pnpm --filter @todoist-clone/backend users create <username> <password> [--admin]");
  console.error(
    "  pnpm --filter @todoist-clone/backend users update <username> [--name=<username>] [--password=<password>] [--admin=true|false]",
  );
  console.error("  pnpm --filter @todoist-clone/backend users delete <username>");
};

/** Возвращает значение параметра CLI в формате `--name=value`, если он передан. */
const option = (name: string) => args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);

/** Выполняет выбранную команду и закрывает соединение с PostgreSQL после её завершения. */
const run = async () => {
  if (action === "list") {
    console.log(JSON.stringify(await users.list(), null, 2));
    return;
  }

  if (action === "create") {
    const [username, password] = args;
    if (!username || !password) return usage();
    // Не создаём аккаунты, пока существующий администратор не сможет войти.
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
    // Проверяем значение роли до построения patch, чтобы опечатка не меняла аккаунт.
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
    // В patch включаются только переданные параметры, чтобы остальные настройки не затереть.
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
    // Последняя административная учётная запись нужна для восстановления доступа к системе.
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
