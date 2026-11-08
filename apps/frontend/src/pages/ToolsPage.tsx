import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Code2, Database } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import type { ToolsApi } from "../api";
import { useQuickAddShortcut } from "../hooks/useQuickAddShortcut";
import { tablesQueryKey } from "../queryKeys";

const toolsEnabled = import.meta.env.DEV || import.meta.env.MODE === "test";

export const ToolsPage = ({ api, sidebar }: Readonly<{ api: ToolsApi; sidebar?: ReactNode }>) => {
  useQuickAddShortcut();
  const [selectedTable, setSelectedTable] = useState("");
  const [sql, setSql] = useState("SELECT * FROM tasks ORDER BY lexical_order;");
  const [result, setResult] = useState<unknown>(Object.freeze({ ready: true }));
  const [recordsLimit, setRecordsLimit] = useState<"10" | "100" | "all">("10");
  const queryClient = useQueryClient();
  const tables = useQuery({
    queryKey: tablesQueryKey,
    queryFn: api.listTables,
  });

  const runAction = (action: () => Promise<unknown>) => async () => {
    const data = await action();

    setResult(data);
    await queryClient.invalidateQueries({ queryKey: tablesQueryKey });
  };

  const clearTable = useMutation({
    mutationFn: (table: string) => api.clearTable(table),
    onSuccess: async (data) => {
      setResult(data);
      await queryClient.invalidateQueries({ queryKey: tablesQueryKey });
    },
  });

  const runQuery = useMutation({
    mutationFn: (nextSql: string) => api.runQuery(nextSql),
    onSuccess: (data) => setResult(data),
  });

  const viewRecords = useMutation({
    mutationFn: () => api.listRecords(tableValue, recordsLimit),
    onSuccess: setResult,
  });

  if (!toolsEnabled) {
    return (
      <main className="shell app-layout">
        {sidebar}
        <section className="workspace card shadow-sm" aria-label="Developer tools disabled">
          <h1>Not found</h1>
        </section>
      </main>
    );
  }

  const tableOptions = tables.data ?? Object.freeze([]);
  const tableValue = selectedTable || tableOptions[0] || "";

  return (
    <main className="shell app-layout">
      {sidebar}
      <section className="workspace card shadow-sm tools-panel" aria-label="Database tools">
        <header className="header">
          <div>
            <p className="eyebrow">Development tools</p>
            <h1>Database Tools</h1>
            <p className="tools-description">Browse table data, run SQL, and maintain the local database.</p>
          </div>
        </header>

        <section className="card tools-card" aria-label="Browse table records">
          <div className="card-body">
            <div className="tools-card-heading">
              <Database size={20} />
              <div>
                <h2>Browse table records</h2>
                <p>Select a table and choose how many recent rows to inspect.</p>
              </div>
            </div>
            <div className="tools-grid">
              <label className="input-label" htmlFor="table-select">
                Table
              </label>
              <select
                id="table-select"
                value={tableValue}
                onChange={(event) => setSelectedTable(event.target.value)}
              >
                {tableOptions.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
              <label className="input-label" htmlFor="record-limit">
                Rows to view
              </label>
              <select
                id="record-limit"
                value={recordsLimit}
                onChange={(event) => setRecordsLimit(event.target.value as "10" | "100" | "all")}
              >
                <option value="10">Last 10</option>
                <option value="100">Last 100</option>
                <option value="all">All rows</option>
              </select>
              <button
                type="button"
                className="btn btn-primary"
                disabled={tableValue.length === 0 || viewRecords.isPending}
                onClick={() => viewRecords.mutate()}
              >
                {viewRecords.isPending ? "Loading records…" : "View records"}
              </button>
              <button
                type="button"
                className="btn btn-outline-danger"
                disabled={tableValue.length === 0}
                onClick={() => clearTable.mutate(tableValue)}
              >
                Clear selected table
              </button>
            </div>
          </div>
        </section>

        <section className="card tools-card tools-maintenance" aria-label="Database maintenance">
          <div className="card-body">
            <div className="tools-card-heading">
              <Archive size={20} />
              <div>
                <h2>Database maintenance</h2>
                <p>Run migrations or manage development data.</p>
              </div>
            </div>
            <div className="tools-maintenance-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={runAction(api.migrate)}>
                Run migrations
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={runAction(api.seed)}>
                Seed test data
              </button>
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={runAction(api.clearAllTables)}
              >
                Clear all tables
              </button>
              <button type="button" className="btn btn-danger" onClick={runAction(api.dropAllTables)}>
                Drop all tables
              </button>
            </div>
          </div>
        </section>

        <form
          className="sql-form card p-3"
          onSubmit={(event) => {
            event.preventDefault();
            runQuery.mutate(sql);
          }}
        >
          <label className="input-label" htmlFor="sql-query">
            <span>
              <Code2 size={16} aria-hidden="true" /> PostgreSQL query
            </span>
          </label>
          <textarea id="sql-query" value={sql} onChange={(event) => setSql(event.target.value)} />
          <button type="submit">Run query</button>
        </form>

        <section className="card tools-result-card">
          <header>
            <h2>Result</h2>
            <span>{runQuery.isPending || viewRecords.isPending ? "Loading" : "Ready"}</span>
          </header>
          <pre className="query-result">{JSON.stringify(result, null, 2)}</pre>
        </section>
      </section>
    </main>
  );
};
