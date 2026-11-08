import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import type { ApplicationApi } from "../api";
import { authStatusQueryKey, settingsQueryKey } from "../queryKeys";
import { useQuickAddShortcut } from "../hooks/useQuickAddShortcut";

export const SettingsPage = ({ api, sidebar }: Readonly<{ api: ApplicationApi; sidebar?: ReactNode }>) => {
  useQuickAddShortcut();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: settingsQueryKey, queryFn: api.getSettings });
  const authStatus = useQuery({ queryKey: authStatusQueryKey, queryFn: api.getAuthStatus });
  const [confirmDelete, setConfirmDelete] = useState(true);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  useEffect(() => {
    if (settings.data !== undefined) {
      setConfirmDelete(settings.data.confirmDelete);
      setAccountUsername(settings.data.username);
    }
  }, [settings.data]);

  const saveSettings = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: async (nextSettings) => {
      queryClient.setQueryData(settingsQueryKey, nextSettings);
    },
  });

  const updateAccount = useMutation({
    mutationFn: api.updateOwnAccount,
    onSuccess: async (user) => {
      setAccountPassword("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
        queryClient.invalidateQueries({ queryKey: authStatusQueryKey }),
      ]);
      setAccountUsername(user.username);
    },
  });

  const logOut = async () => {
    await api.logout();
    await queryClient.invalidateQueries({ queryKey: authStatusQueryKey });
  };

  return (
    <main className="shell app-layout">
      {sidebar}
      <section className="workspace card shadow-sm settings-panel" aria-label="Settings">
        <header className="header">
          <h1>Settings</h1>
          <p className="settings-intro">Manage your preferences and your account.</p>
        </header>

        {settings.isLoading ? <p className="muted">Loading settings…</p> : null}
        {settings.isError ? <p className="error">Unable to load settings.</p> : null}
        {settings.data !== undefined ? (
          <form
            className="settings-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveSettings.mutate({ confirmDelete });
            }}
          >
            <fieldset className="settings-group">
              <legend>Deletion</legend>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={confirmDelete}
                  onChange={(event) => setConfirmDelete(event.target.checked)}
                />
                Ask for confirmation before deleting tasks, projects, or sections
              </label>
              <p className="settings-help">Enabled by default. This applies to your delete actions.</p>
            </fieldset>

            {saveSettings.isError ? (
              <p className="error" role="alert">
                Unable to save settings. Check the login and password requirements.
              </p>
            ) : null}
            {saveSettings.isSuccess ? (
              <p className="settings-success" role="status">
                Settings saved.
              </p>
            ) : null}
            <div className="settings-actions">
              <button className="settings-save" type="submit" disabled={saveSettings.isPending}>
                Save settings
              </button>
              {authStatus.data?.authenticated ? (
                <button className="settings-logout" type="button" onClick={() => void logOut()}>
                  <KeyRound size={16} aria-hidden="true" />
                  Log out
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
        {authStatus.data?.authenticated ? (
          <section className="account-settings card border shadow-sm mt-4" aria-label="Your account">
            <div className="card-header bg-light">
              <h2 className="h5 mb-0">Your account</h2>
            </div>
            <div className="card-body">
              <form
                className="settings-credentials"
                onSubmit={(event) => {
                  event.preventDefault();
                  updateAccount.mutate({
                    username: accountUsername.trim().toLowerCase(),
                    ...(accountPassword.length > 0 ? { password: accountPassword } : {}),
                  });
                }}
              >
                <label>
                  Username
                  <input
                    required
                    maxLength={64}
                    autoComplete="username"
                    value={accountUsername}
                    onChange={(event) => setAccountUsername(event.target.value)}
                  />
                </label>
                <label>
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Leave blank to keep"
                    value={accountPassword}
                    onChange={(event) => setAccountPassword(event.target.value)}
                  />
                </label>
                <p className="form-text text-muted mt-0 mb-0">
                  Changing your password signs out other sessions.
                </p>
                <button className="settings-save" type="submit" disabled={updateAccount.isPending}>
                  Save account
                </button>
              </form>
              {updateAccount.isError ? (
                <p className="error mt-3 mb-0" role="alert">
                  Unable to update account. The username may already be in use.
                </p>
              ) : null}
              {updateAccount.isSuccess ? (
                <p className="settings-success mt-3 mb-0" role="status">
                  Account updated.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
};
