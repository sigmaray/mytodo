/**
 * Returns a complete PostgreSQL URL or builds one from individual environment settings.
 *
 * @param {Record<string, string | undefined>} [environment]
 * @returns {string}
 */
export const getDatabaseUrl = (environment: Record<string, string | undefined> = process.env): string => {
  /** A complete connection string takes precedence over individual variables. */
  if (environment.DATABASE_URL !== undefined) return environment.DATABASE_URL;

  /** Bracket IPv6 hosts and encode the username and password as URL components. */
  const host = environment.MYTODO_DB_HOST ?? "localhost";
  const formattedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const username = encodeURIComponent(environment.MYTODO_DB_USER ?? "todoist");
  const password = encodeURIComponent(environment.MYTODO_DB_PASSWORD ?? "todoist");
  const database = encodeURIComponent(environment.MYTODO_DB_NAME ?? "todoist");
  const port = environment.MYTODO_DB_PORT ?? "5432";
  return `postgresql://${username}:${password}@${formattedHost}:${port}/${database}`;
};
