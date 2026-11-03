"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "../components/app-shell";
import { fetchDiagnostics } from "../lib/diagnostics-api";
import { fetchMaintenance } from "../lib/maintenance-api";
import { fetchVehicles } from "../lib/vehicles-api";


const healthSegments = [
  { key: "healthy", label: "Healthy", tone: "healthy", status: "Healthy" },
  {
    key: "attention",
    label: "Needs attention",
    tone: "attention",
    status: "Needs Attention",
  },
  { key: "critical", label: "Critical", tone: "critical", status: "Critical" },
];

const quickActions = [
  {
    label: "Add Vehicle",
    description: "Register a vehicle to your fleet",
    href: "/vehicles",
    icon: "plus",
  },
  {
    label: "View Diagnostics",
    description: "Review vehicle fault codes",
    href: "/diagnostics",
    icon: "diagnostics",
  },
  {
    label: "View Service Requests",
    description: "Review open service requests",
    href: "/service-requests",
    icon: "requests",
  },
];

function DashboardIcon({ name }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (name) {
    case "vehicles":
      return (
        <svg {...props}>
          <path d="M4 14.5h16l-1.6-6a2 2 0 0 0-1.9-1.5h-9a2 2 0 0 0-1.9 1.5L4 14.5Z" />
          <path d="M4 14.5v3h2m14-3v3h-2M7 17.5h10M7 11h10" />
          <circle cx="7.5" cy="17.5" r="1" />
          <circle cx="16.5" cy="17.5" r="1" />
        </svg>
      );
    case "attention":
      return (
        <svg {...props}>
          <path d="M12 3.8 21 20H3l9-16.2Z" />
          <path d="M12 9v4.5m0 3h.01" />
        </svg>
      );
    case "maintenance":
      return (
        <svg {...props}>
          <path d="M14.2 6.1a5 5 0 0 0-6.3 6.3l-4.1 4.1a2.1 2.1 0 0 0 3 3l4.1-4.1a5 5 0 0 0 6.3-6.3l-3 3-3-3 3-3Z" />
        </svg>
      );
    case "requests":
      return (
        <svg {...props}>
          <path d="M7 3.5h7l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
          <path d="M14 3.5v4h4m-9 4h6m-6 4h6" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14m-7-7h14" />
        </svg>
      );
    case "diagnostics":
      return (
        <svg {...props}>
          <path d="M3.5 12h4l2.2-6 4.5 12 2.2-6h4" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    default:
      return null;
  }
}

function OverviewCard({ item }) {
  return (
    <article className="overview-card" aria-label={item.label}>
      <div className="overview-card-top">
        <span className={`overview-icon overview-icon-${item.tone}`}>
          <DashboardIcon name={item.icon} />
        </span>
        <span className="overview-card-detail">{item.detail}</span>
      </div>
      <p className="overview-value">{item.value}</p>
      <h2 className="overview-label">{item.label}</h2>
    </article>
  );
}

function formatDashboardDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function Home() {
  const [vehicles, setVehicles] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [maintenance, setMaintenance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState({
    vehicles: "",
    diagnostics: "",
    maintenance: "",
  });
  const [reloadVersion, setReloadVersion] = useState(0);

  function retryDashboardLoad() {
    setIsLoading(true);
    setReloadVersion((version) => version + 1);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardData() {
      setIsLoading(true);
      setLoadErrors({ vehicles: "", diagnostics: "", maintenance: "" });

      const results = await Promise.allSettled([
        fetchVehicles({ signal: controller.signal }),
        fetchDiagnostics({ signal: controller.signal }),
        fetchMaintenance({ signal: controller.signal }),
      ]);

      if (controller.signal.aborted) return;

      const [vehicleResult, diagnosticResult, maintenanceResult] = results;
      setVehicles(
        vehicleResult.status === "fulfilled" ? vehicleResult.value : null,
      );
      setDiagnostics(
        diagnosticResult.status === "fulfilled"
          ? diagnosticResult.value
          : null,
      );
      setMaintenance(
        maintenanceResult.status === "fulfilled"
          ? maintenanceResult.value
          : null,
      );
      setLoadErrors({
        vehicles:
          vehicleResult.status === "rejected"
            ? vehicleResult.reason?.message ||
              "Unable to load your saved vehicles."
            : "",
        diagnostics:
          diagnosticResult.status === "rejected"
            ? diagnosticResult.reason?.message ||
              "Unable to load diagnostic records."
            : "",
        maintenance:
          maintenanceResult.status === "rejected"
            ? maintenanceResult.reason?.message ||
              "Unable to load maintenance records."
            : "",
      });
      setIsLoading(false);
    }

    loadDashboardData();

    return () => controller.abort();
  }, [reloadVersion]);

  const healthCounts = useMemo(() => {
    if (!vehicles) return null;

    return vehicles.reduce(
      (counts, vehicle) => {
        const segment = healthSegments.find(
          (item) => item.status === vehicle.healthStatus,
        );
        if (segment) counts[segment.key] += 1;
        return counts;
      },
      { healthy: 0, attention: 0, critical: 0 },
    );
  }, [vehicles]);

  const totalVehicles = vehicles?.length ?? null;
  const recentDiagnostics = diagnostics?.slice(0, 3) ?? [];
  const upcomingMaintenance =
    maintenance
      ?.filter((record) => record.status === "Upcoming")
      .slice(0, 3) ?? [];
  const overviewItems = [
    {
      label: "Total Vehicles",
      value: totalVehicles === null ? "—" : String(totalVehicles),
      detail: "Saved fleet vehicles",
      icon: "vehicles",
      tone: "blue",
    },
    ...healthSegments.map((segment) => ({
      label: segment.label,
      value: healthCounts === null ? "—" : String(healthCounts[segment.key]),
      detail: "Saved vehicle status",
      icon: segment.key === "healthy" ? "vehicles" : "attention",
      tone:
        segment.key === "healthy"
          ? "teal"
          : segment.key === "attention"
            ? "amber"
            : "violet",
    })),
  ];

  return (
    <AppShell title="Fleet overview" showPageHeading={false}>
      <div className="dashboard-page">
        <section className="dashboard-intro" aria-labelledby="dashboard-title">
          <div>
            <h1 className="page-heading dashboard-title" id="dashboard-title">
              Fleet Dashboard
            </h1>
            <p className="eyebrow">YOUR FLEET WORKSPACE</p>
            <p className="dashboard-description">
              Monitor fleet health, stay ahead of maintenance, and keep every
              vehicle moving.
            </p>
            <p className="mock-data-note">
              Fleet metrics and activity reflect your saved vehicle,
              diagnostic, and maintenance records.
            </p>
          </div>
          <Link className="primary-action" href="/vehicles" prefetch={false}>
            <DashboardIcon name="plus" />
            <span>Add Vehicle</span>
          </Link>
        </section>

        {isLoading && (
          <p className="dashboard-feedback" role="status" aria-live="polite">
            Loading your saved fleet and activity…
          </p>
        )}
        {loadErrors.vehicles && (
          <div className="dashboard-load-error" role="alert">
            <p>{loadErrors.vehicles}</p>
            <button
              className="text-action"
              type="button"
              onClick={retryDashboardLoad}
            >
              Try again
            </button>
          </div>
        )}

        <section className="dashboard-overview" aria-labelledby="overview-title">
          <div className="dashboard-section-heading">
            <h2 id="overview-title">Fleet overview</h2>
          </div>
          <div className="overview-grid">
            {overviewItems.map((item) => (
              <OverviewCard item={item} key={item.label} />
            ))}
          </div>
        </section>

        <div className="dashboard-content-grid">
          <div className="dashboard-main-column">
            <section
              className="dashboard-panel"
              aria-labelledby="diagnostics-title"
            >
              <div className="dashboard-panel-heading">
                <div>
                  <h2 id="diagnostics-title">Recent diagnostic activity</h2>
                  <p>Latest diagnostic records saved to your fleet.</p>
                </div>
                <Link
                  className="text-action"
                  href="/diagnostics"
                  prefetch={false}
                >
                  View diagnostics
                </Link>
              </div>
              {loadErrors.diagnostics ? (
                <div className="dashboard-load-error" role="alert">
                  <p>{loadErrors.diagnostics}</p>
                  <button
                    className="text-action"
                    type="button"
                    onClick={retryDashboardLoad}
                  >
                    Try again
                  </button>
                </div>
              ) : isLoading || diagnostics === null ? (
                <p className="dashboard-empty-state" role="status">
                  Loading diagnostic records…
                </p>
              ) : recentDiagnostics.length === 0 ? (
                <p className="dashboard-empty-state">
                  No diagnostic records have been saved yet.
                </p>
              ) : (
                <ul className="diagnostic-list" aria-label="Recent diagnostic records">
                  {recentDiagnostics.map((record) => (
                    <li className="diagnostic-row" key={record.id}>
                      <span className="diagnostic-vehicle">
                        <span className="row-label">Vehicle</span>
                        <span className="row-value">
                          {record.vehicleName || "Vehicle unavailable"}
                        </span>
                      </span>
                      <span className="diagnostic-code-cell">
                        <span className="row-label">Code</span>
                        <span className="diagnostic-code">{record.code}</span>
                      </span>
                      <span className="diagnostic-issue">
                        <span className="row-label">Description</span>
                        <span className="row-value">
                          {record.issueDescription ||
                            record.description ||
                            "Description not provided"}
                        </span>
                      </span>
                      <time
                        className="diagnostic-date"
                        dateTime={record.dateDetected}
                      >
                        <span className="row-label">Detected</span>
                        {formatDashboardDate(record.dateDetected)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className="dashboard-panel"
              aria-labelledby="maintenance-title"
            >
              <div className="dashboard-panel-heading">
                <div>
                  <h2 id="maintenance-title">Upcoming maintenance</h2>
                  <p>Scheduled work for your vehicles.</p>
                </div>
                <Link
                  className="text-action"
                  href="/maintenance"
                  prefetch={false}
                >
                  View schedule
                </Link>
              </div>
              {loadErrors.maintenance ? (
                <div className="dashboard-load-error" role="alert">
                  <p>{loadErrors.maintenance}</p>
                  <button
                    className="text-action"
                    type="button"
                    onClick={retryDashboardLoad}
                  >
                    Try again
                  </button>
                </div>
              ) : isLoading || maintenance === null ? (
                <p className="dashboard-empty-state" role="status">
                  Loading maintenance records…
                </p>
              ) : upcomingMaintenance.length === 0 ? (
                <p className="dashboard-empty-state">
                  No upcoming maintenance is scheduled.
                </p>
              ) : (
                <ul className="maintenance-list" aria-label="Upcoming maintenance records">
                  {upcomingMaintenance.map((record) => (
                    <li className="maintenance-row" key={record.id}>
                      <span className="maintenance-vehicle">
                        <span className="row-label">Vehicle</span>
                        <span className="row-value">
                          {record.vehicleName || "Vehicle unavailable"}
                        </span>
                      </span>
                      <span className="maintenance-item">
                        <span className="row-label">Maintenance</span>
                        <span className="row-value">{record.type}</span>
                      </span>
                      <time
                        className="maintenance-date"
                        dateTime={record.maintenanceDate}
                      >
                        <span className="row-label">Scheduled</span>
                        {formatDashboardDate(record.maintenanceDate)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="dashboard-side-column">
            <section
              className="dashboard-panel health-panel"
              aria-labelledby="health-title"
            >
              <div className="dashboard-panel-heading">
                <div>
                  <h2 id="health-title">Fleet health</h2>
                  <p>Current status across your fleet</p>
                </div>
              </div>
              <div
                className="health-bar"
                role="img"
                aria-label={
                  totalVehicles === null
                    ? "Fleet health data is unavailable."
                    : totalVehicles === 0
                      ? "No vehicles are available to assess."
                    : `Fleet health distribution: ${healthCounts.healthy} healthy, ${healthCounts.attention} needing attention, ${healthCounts.critical} critical out of ${totalVehicles} vehicles.`
                }
              >
                {totalVehicles > 0 &&
                  healthSegments.map(
                    (segment) =>
                      healthCounts[segment.key] > 0 && (
                        <span
                          className={`health-segment health-segment-${segment.tone}`}
                          key={segment.key}
                          style={{
                            width: `${(healthCounts[segment.key] / totalVehicles) * 100}%`,
                          }}
                        />
                      ),
                  )}
              </div>
              <p className="health-summary">
                {totalVehicles === null
                  ? "Fleet health data is unavailable."
                  : totalVehicles === 0
                    ? "No vehicles in your fleet yet."
                    : `${totalVehicles} vehicles in your fleet`}
              </p>
              <ul className="health-legend">
                {healthSegments.map((segment) => (
                  <li key={segment.key}>
                    <span
                      className={`health-dot health-dot-${segment.tone}`}
                      aria-hidden="true"
                    />
                    <span>{segment.label}</span>
                    <strong>
                      {healthCounts === null
                        ? "—"
                        : healthCounts[segment.key]}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>

            <section
              className="dashboard-panel quick-actions-panel"
              aria-labelledby="quick-actions-title"
            >
              <div className="dashboard-panel-heading">
                <div>
                  <h2 id="quick-actions-title">Quick actions</h2>
                  <p>Common fleet tasks</p>
                </div>
              </div>
              <nav className="quick-actions" aria-label="Quick actions">
                {quickActions.map((action) => (
                  <Link
                    className="quick-action"
                    href={action.href}
                    key={action.label}
                    prefetch={false}
                  >
                    <span className="quick-action-icon">
                      <DashboardIcon name={action.icon} />
                    </span>
                    <span className="quick-action-copy">
                      <span className="quick-action-title">{action.label}</span>
                      <span className="quick-action-description">
                        {action.description}
                      </span>
                    </span>
                    <span className="quick-action-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </nav>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
