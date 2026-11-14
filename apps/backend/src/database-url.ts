/** Возвращает готовый PostgreSQL URL или собирает его из отдельных настроек окружения. */
export const getDatabaseUrl = (environment: Record<string, string | undefined> = process.env): string => {
  // Полная строка подключения имеет приоритет над набором отдельных переменных.
  if (environment.DATABASE_URL !== undefined) return environment.DATABASE_URL;

  // IPv6-хост обрамляется скобками, а пароль и имя пользователя кодируются как URL-компоненты.
  const host = environment.MYTODO_DB_HOST ?? "localhost";
  const formattedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const username = encodeURIComponent(environment.MYTODO_DB_USER ?? "todoist");
  const password = encodeURIComponent(environment.MYTODO_DB_PASSWORD ?? "todoist");
  const database = encodeURIComponent(environment.MYTODO_DB_NAME ?? "todoist");
  const port = environment.MYTODO_DB_PORT ?? "5432";
  return `postgresql://${username}:${password}@${formattedHost}:${port}/${database}`;
};
