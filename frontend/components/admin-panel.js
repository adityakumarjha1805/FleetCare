"use client";

import { useEffect, useState } from "react";
import AppShell from "./app-shell";
import { fetchAdminSummary, fetchAdminUsers, updateAdminUserRole } from "../lib/admin-api.js";

const metrics = [
  ["users", "Users"],
  ["admins", "Admins"],
  ["vehicles", "Vehicles"],
  ["diagnostics", "Diagnostics"],
  ["maintenance", "Maintenance"],
  ["serviceRequests", "Service requests"],
  ["partsRequests", "Parts requests"],
  ["notifications", "Notifications"],
];

export default function AdminPanel() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetchAdminSummary(), fetchAdminUsers()])
      .then(([nextSummary, nextUsers]) => {
        if (!active) return;
        setSummary(nextSummary);
        setUsers(nextUsers);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load admin data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function changeRole(user, role) {
    setError("");
    setStatus("");
    try {
      const updated = await updateAdminUserRole(user.id, role);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setStatus(`${user.name}'s role was updated.`);
    } catch (requestError) {
      setError(requestError.message || "Unable to update the user role.");
    }
  }

  return (
    <AppShell title="Admin panel">
      <div className="admin-page">
        <section className="admin-hero">
          <p className="eyebrow">PLATFORM ADMINISTRATION</p>
          <h1>FleetCare Admin Panel</h1>
          <p>Manage platform users and monitor all saved FleetCare records.</p>
        </section>
        {error && <p className="form-error-summary" role="alert">{error}</p>}
        {status && <p className="form-success-summary" role="status">{status}</p>}
        {loading ? (
          <p className="admin-feedback" role="status">Loading platform data…</p>
        ) : (
          <>
            <section className="admin-metric-grid" aria-label="Platform statistics">
              {metrics.map(([key, label]) => (
                <article className="admin-metric-card" key={key}>
                  <span>{label}</span>
                  <strong>{summary?.[key] ?? 0}</strong>
                </article>
              ))}
            </section>
            <section className="admin-panel-card" aria-labelledby="admin-users-title">
              <h2 id="admin-users-title">User management</h2>
              {users.length === 0 ? (
                <p className="admin-feedback">No users found.</p>
              ) : (
                <div className="admin-user-list">
                  {users.map((user) => (
                    <div className="admin-user-row" key={user.id}>
                      <div>
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                      </div>
                      <select
                        aria-label={`Role for ${user.name}`}
                        value={user.role}
                        onChange={(event) => changeRole(user, event.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="admin-panel-card">
              <h2>Platform modules</h2>
              <p className="admin-feedback">
                Use the existing Vehicles, Diagnostics, Maintenance, Service
                Requests, Parts, Notifications, and Reports pages to inspect
                the corresponding platform records. Admin APIs provide global
                access while regular users remain owner-scoped.
              </p>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
