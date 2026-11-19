import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { ApplicationApi } from "../api";
import { authStatusQueryKey } from "../queryKeys";

/**
 * Editable values shown for an account row.
 *
 * @typedef {Object} UserDraft
 * @property {string} username - Draft login name for the user row.
 * @property {string} password - New password, or an empty string to keep the current one.
 * @property {boolean} isAdmin - Draft administrator role.
 */
type UserDraft = {
  username: string;
  password: string;
  isAdmin: boolean;
};

/**
 * API and sidebar for the account administration page.
 *
 * @typedef {Object} AdminUsersPageProps
 * @property {ApplicationApi} api - API operations for server data.
 * @property {ReactNode} [sidebar] - Navigation sidebar.
 */
type AdminUsersPageProps = {
  api: ApplicationApi;

  sidebar?: ReactNode;
};

/**
 * Allows administrators to create, update, and delete accounts.
 *
 * @param {AdminUsersPageProps} parameter1
 * @returns The account administration page.
 */
export const AdminUsersPage = ({ api, sidebar }: AdminUsersPageProps) => {
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [userDrafts, setUserDrafts] = useState<Record<string, UserDraft>>({});
  useEffect(() => {
    /** Create a separate editable draft for each user row. */
    if (users.data !== undefined)
      setUserDrafts(
        Object.fromEntries(
          users.data.map((user) => [
            user.id,
            { username: user.username, password: "", isAdmin: user.isAdmin },
          ]),
        ),
      );
  }, [users.data]);

  /**
   * Invalidation refreshes both the account table and the current user's status.
   */
  const refreshUsers = async () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["users"] }),
      queryClient.invalidateQueries({ queryKey: authStatusQueryKey }),
    ]);
  const createUser = useMutation({
    mutationFn: api.createUser,
    onSuccess: async () => {
      setNewUsername("");
      setNewPassword("");
      setNewIsAdmin(false);
      await refreshUsers();
    },
  });
  const updateUser = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { username?: string; password?: string; isAdmin?: boolean };
    }) => api.updateUser(id, patch),
    onSuccess: refreshUsers,
  });
  const deleteUser = useMutation({ mutationFn: api.deleteUser, onSuccess: refreshUsers });
  const adminCount = (users.data ?? []).filter((user) => user.isAdmin).length;

  return (
    <main className="shell app-layout">
      {sidebar}
      <section className="workspace card shadow-sm settings-panel" aria-label="User management">
        <header className="header">
          <h1>User management</h1>
          <p className="settings-intro">Create and manage workspace accounts.</p>
        </header>
        <section className="settings-group user-management" aria-label="Manage users">
          <h2>Create user</h2>
          <form
            className="settings-credentials"
            onSubmit={(event) => {
              event.preventDefault();
              /** Normalize the username on submit so uniqueness does not depend on letter case. */
              createUser.mutate({
                username: newUsername.trim().toLowerCase(),
                password: newPassword,
                isAdmin: newIsAdmin,
              });
            }}
          >
            <label>
              Username
              <input
                required
                maxLength={64}
                autoComplete="username"
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={newIsAdmin}
                onChange={(event) => setNewIsAdmin(event.target.checked)}
              />
              Administrator
            </label>
            <button className="settings-save" type="submit" disabled={createUser.isPending}>
              Create user
            </button>
          </form>
          {createUser.isError ? (
            <p className="error" role="alert">
              Could not create user. Usernames must be unique and passwords cannot be empty.
            </p>
          ) : null}
          {users.isLoading ? <p className="muted">Loading users…</p> : null}
          {users.isError ? (
            <p className="error" role="alert">
              Unable to load users.
            </p>
          ) : null}
          <h2>Accounts</h2>
          <div className="managed-users">
            {(users.data ?? []).map((user) => {
              const draft = userDrafts[user.id] ?? {
                username: user.username,
                password: "",
                isAdmin: user.isAdmin,
              };
              return (
                <form
                  className="managed-user"
                  key={user.id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    /** An empty password means the account password remains unchanged. */
                    updateUser.mutate({
                      id: user.id,
                      patch: {
                        username: draft.username.trim().toLowerCase(),
                        isAdmin: draft.isAdmin,
                        ...(draft.password ? { password: draft.password } : {}),
                      },
                    });
                  }}
                >
                  <label>
                    Username
                    <input
                      required
                      maxLength={64}
                      autoComplete="username"
                      value={draft.username}
                      onChange={(event) =>
                        setUserDrafts((current) => ({
                          ...current,
                          [user.id]: { ...draft, username: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    New password
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Leave blank to keep"
                      value={draft.password}
                      onChange={(event) =>
                        setUserDrafts((current) => ({
                          ...current,
                          [user.id]: { ...draft, password: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={draft.isAdmin}
                      onChange={(event) =>
                        setUserDrafts((current) => ({
                          ...current,
                          [user.id]: { ...draft, isAdmin: event.target.checked },
                        }))
                      }
                    />
                    Administrator
                  </label>
                  <button type="submit" disabled={updateUser.isPending}>
                    Save
                  </button>
                  {/** Prevents deleting the last administrator account. */}
                  <button
                    type="button"
                    className="danger"
                    disabled={deleteUser.isPending || (user.isAdmin && adminCount < 2)}
                    onClick={() => {
                      /** Require confirmation before cascading deletion of user data. */
                      if (window.confirm(`Delete user ${user.username} and all their task data?`))
                        deleteUser.mutate(user.id);
                    }}
                  >
                    Delete
                  </button>
                </form>
              );
            })}
          </div>
          {updateUser.isError || deleteUser.isError ? (
            <p className="error" role="alert">
              Unable to update users. Keep at least one administrator and use unique usernames.
            </p>
          ) : null}
        </section>
      </section>
    </main>
  );
};
