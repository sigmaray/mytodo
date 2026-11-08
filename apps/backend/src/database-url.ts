export const getDatabaseUrl = (environment: Readonly<Record<string, string | undefined>> = process.env): string => {
  if (environment.DATABASE_URL !== undefined) return environment.DATABASE_URL;

  const host = environment.MYTODO_DB_HOST ?? "localhost";
  const formattedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const username = encodeURIComponent(environment.MYTODO_DB_USER ?? "todoist");
  const password = encodeURIComponent(environment.MYTODO_DB_PASSWORD ?? "todoist");
  const database = encodeURIComponent(environment.MYTODO_DB_NAME ?? "todoist");
  const port = environment.MYTODO_DB_PORT ?? "5432";
  return `postgresql://${username}:${password}@${formattedHost}:${port}/${database}`;
};
