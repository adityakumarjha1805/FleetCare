"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "./app-shell";
import { fetchReportSummary } from "../lib/reports-api";
import { maxChartValue } from "../lib/reports-utils";

const colors = ["#5278e8", "#32a58b", "#e7a842", "#d05b72", "#8d6bd1"];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function BarChart({ title, items, emptyMessage = "No records in this range." }) {
  const maximum = maxChartValue(items);
  return (
    <section className="report-card" aria-labelledby={`${title}-title`}>
      <h2 id={`${title}-title`}>{title}</h2>
      {items.length === 0 ? (
        <p className="report-empty">{emptyMessage}</p>
      ) : (
        <div className="report-bars" role="img" aria-label={`${title}: ${items.map((item) => `${item.label} ${item.count}`).join(", ")}`}>
          {items.map((item, index) => (
            <div className="report-bar-item" key={item.label}>
              <div className="report-bar-track">
                <span
                  className="report-bar-fill"
                  style={{ height: `${Math.max(8, (item.count / maximum) * 100)}%`, background: colors[index % colors.length] }}
                />
              </div>
              <strong>{item.count}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TrendChart({ trend }) {
  const maximum = Math.max(1, ...trend.map((item) => item.count));
  return (
    <section className="report-card report-trend-card" aria-labelledby="maintenance-trend-title">
      <div className="report-card-heading">
        <h2 id="maintenance-trend-title">Maintenance activity trend</h2>
        <span className="report-legend"><i /> Total <i className="report-legend-completed" /> Completed</span>
      </div>
      {trend.length === 0 ? (
        <p className="report-empty">No maintenance activity in this range.</p>
      ) : (
        <div className="report-trend" role="img" aria-label={`Maintenance trend: ${trend.map((item) => `${item.month} ${item.count} total, ${item.completed} completed`).join("; ")}`}>
          {trend.map((item) => (
            <div className="report-trend-item" key={item.month}>
              <div className="report-trend-bars">
                <span className="report-trend-total" style={{ height: `${Math.max(8, (item.count / maximum) * 100)}%` }} />
                <span className="report-trend-completed" style={{ height: `${Math.max(8, (item.completed / maximum) * 100)}%` }} />
              </div>
              <strong>{item.count}</strong>
              <span>{item.month}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryCard({ label, value, detail }) {
  return (
    <article className="report-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export default function ReportsManagement() {
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState(todayString());
  const [dateRange, setDateRange] = useState({ from: "", to: todayString() });
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setError("");
      fetchReportSummary({ ...dateRange, signal: controller.signal })
        .then(setReport)
        .catch((requestError) => {
          if (requestError.name !== "AbortError") {
            setError(requestError.message || "Unable to load reports.");
          }
        })
        .finally(() => setIsLoading(false));
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [dateRange, reloadKey]);

  const summary = useMemo(() => {
    if (!report) return [];
    return [
      { label: "Total vehicles", value: report.vehicles.total, detail: "Organization fleet" },
      { label: "Diagnostics", value: report.diagnostics.total, detail: "Records in range" },
      { label: "Maintenance", value: report.maintenance.total, detail: "Scheduled records" },
      { label: "Service requests", value: report.serviceRequests.total, detail: "Requests in range" },
      { label: "Parts requests", value: report.partsRequests.total, detail: "Requests in range" },
    ];
  }, [report]);

  function applyFilters(event) {
    event.preventDefault();
    setDateRange({ from: draftFrom, to: draftTo });
  }

  return (
    <AppShell title="Reports & analytics">
      <div className="reports-page">
        <section className="reports-hero">
          <div>
            <p className="eyebrow">ORGANIZATION REPORTING</p>
            <h1>Reports & analytics</h1>
            <p>Understand fleet health and operational activity from saved organization records.</p>
          </div>
        </section>
        <form className="reports-filters" onSubmit={applyFilters}>
          <label>
            From
            <input type="date" value={draftFrom} max={draftTo || undefined} onChange={(event) => setDraftFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={draftTo} min={draftFrom || undefined} max={todayString()} onChange={(event) => setDraftTo(event.target.value)} />
          </label>
          <button className="primary-action" type="submit">Apply date range</button>
        </form>
        {error && (
          <div className="form-error-summary" role="alert">
            <p>{error}</p>
            <button className="text-action" type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>
          </div>
        )}
        {isLoading ? (
          <p className="report-feedback" role="status">Loading organization reports…</p>
        ) : report ? (
          <>
            <section className="report-summary-grid" aria-label="Report summary">
              {summary.map((item) => <SummaryCard key={item.label} {...item} />)}
            </section>
            <div className="reports-chart-grid">
              <BarChart title="Vehicle status" items={report.vehicles.status} />
              <BarChart title="Diagnostic severity" items={report.diagnostics.severity} />
              <TrendChart trend={report.maintenance.trend} />
              <BarChart title="Service request status" items={report.serviceRequests.status} />
              <BarChart title="Parts request status" items={report.partsRequests.status} />
              <section className="report-card report-cost-card" aria-labelledby="report-costs-title">
                <h2 id="report-costs-title">Recorded costs</h2>
                <p className="report-empty">Cost reporting is unavailable because current maintenance and parts records do not store reliable cost values.</p>
              </section>
            </div>
          </>
        ) : (
          <p className="report-feedback">No report data is available.</p>
        )}
      </div>
    </AppShell>
  );
}
