import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApplicationApi } from "../api";
import { authStatusQueryKey } from "../queryKeys";

export const LoginPage = ({ api }: Readonly<{ api: ApplicationApi }>) => {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => api.login(username, password),
    onSuccess: async () => {
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: authStatusQueryKey });
    },
  });

  return (
    <main className="shell auth-shell">
      <section className="workspace card auth-panel" aria-label="Sign in">
        <div className="sidebar-brand">
          <span className="brand-mark">mt</span>
          <strong>mytodo</strong>
        </div>
        <h1>Sign in</h1>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate();
          }}
        >
          <label>
            Login
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {login.isError ? (
            <p className="error" role="alert">
              Login or password is incorrect.
            </p>
          ) : null}
          <button className="settings-save" type="submit" disabled={login.isPending}>
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
};
