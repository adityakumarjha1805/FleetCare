import Link from "next/link";
import AppShell from "../components/app-shell";

const dashboardMockData = {
  overview: [
    {
      label: "Total Vehicles",
      value: "50",
      detail: "Across your fleet",
      icon: "vehicles",
      tone: "blue",
    },
    {
      label: "Vehicles Requiring Attention",
      value: "8",
      detail: "2 critical issues",
      icon: "attention",
      tone: "amber",
    },
    {
      label: "Maintenance Due",
      value: "5",
      detail: "Within the next 7 days",
      icon: "maintenance",
      tone: "violet",
    },
    {
      label: "Pending Service Requests",
      value: "3",
      detail: "Awaiting review",
      icon: "requests",
      tone: "teal",
    },
  ],
  health: {
    healthy: 42,
    attention: 6,
    critical: 2,
  },
  recentDiagnostics: [
    {
      id: "diag-204",
      vehicle: "Ford Transit 350",
      code: "P0420",
      issue: "Catalyst system efficiency below threshold",
      date: "Oct 31, 2026",
      dateTime: "2026-10-31",
    },
    {
      id: "diag-118",
      vehicle: "Freightliner M2",
      code: "SPN 3251",
      issue: "Diesel particulate filter soot level high",
      date: "Oct 30, 2026",
      dateTime: "2026-10-30",
    },
    {
      id: "diag-087",
      vehicle: "Volvo VNL 760",
      code: "P0087",
      issue: "Fuel rail pressure below expected range",
      date: "Oct 29, 2026",
      dateTime: "2026-10-29",
    },
  ],
  upcomingMaintenance: [
    {
      id: "maint-312",
      vehicle: "Toyota Tacoma",
      item: "Oil and filter service",
      dueDate: "Nov 5, 2026",
      dueDateTime: "2026-11-05",
    },
    {
      id: "maint-225",
      vehicle: "Ford Transit 350",
      item: "Tire rotation",
      dueDate: "Nov 7, 2026",
      dueDateTime: "2026-11-07",
    },
    {
      id: "maint-091",
      vehicle: "Volvo VNL 760",
      item: "Brake inspection",
      dueDate: "Nov 9, 2026",
      dueDateTime: "2026-11-09",
    },
  ],
};

const healthSegments = [
  { key: "healthy", label: "Healthy", tone: "healthy" },
  { key: "attention", label: "Needs attention", tone: "attention" },
  { key: "critical", label: "Critical", tone: "critical" },
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

export default function Home() {
  const totalVehicles = healthSegments.reduce(
    (total, segment) => total + dashboardMockData.health[segment.key],
    0,
  );

  return (
    <AppShell title="Fleet Dashboard" showPageHeading={false}>
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
            <p className="mock-data-note">Sample data shown for preview</p>
          </div>
          <Link className="primary-action" href="/vehicles" prefetch={false}>
            <DashboardIcon name="plus" />
            <span>Add Vehicle</span>
          </Link>
        </section>

        <section className="dashboard-overview" aria-labelledby="overview-title">
          <div className="dashboard-section-heading">
            <h2 id="overview-title">Fleet overview</h2>
          </div>
          <div className="overview-grid">
            {dashboardMockData.overview.map((item) => (
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
                  <p>Latest vehicle issues detected by your fleet</p>
                </div>
                <Link
                  className="text-action"
                  href="/diagnostics"
                  prefetch={false}
                >
                  View diagnostics
                </Link>
              </div>
              <ul className="diagnostic-list" aria-label="Recent diagnostics">
                {dashboardMockData.recentDiagnostics.map((diagnostic) => (
                  <li className="diagnostic-row" key={diagnostic.id}>
                    <div className="diagnostic-vehicle">
                      <span className="row-label">Vehicle</span>
                      <span className="row-value">{diagnostic.vehicle}</span>
                    </div>
                    <div className="diagnostic-code-cell">
                      <span className="row-label">Code</span>
                      <span className="diagnostic-code">{diagnostic.code}</span>
                    </div>
                    <div className="diagnostic-issue">
                      <span className="row-label">Issue</span>
                      <span className="row-value">{diagnostic.issue}</span>
                    </div>
                    <time
                      className="diagnostic-date"
                      dateTime={diagnostic.dateTime}
                    >
                      <span className="row-label">Date</span>
                      {diagnostic.date}
                    </time>
                  </li>
                ))}
              </ul>
            </section>

            <section
              className="dashboard-panel"
              aria-labelledby="maintenance-title"
            >
              <div className="dashboard-panel-heading">
                <div>
                  <h2 id="maintenance-title">Upcoming maintenance</h2>
                  <p>Keep scheduled work on track</p>
                </div>
                <Link
                  className="text-action"
                  href="/maintenance"
                  prefetch={false}
                >
                  View schedule
                </Link>
              </div>
              <ul
                className="maintenance-list"
                aria-label="Upcoming maintenance items"
              >
                {dashboardMockData.upcomingMaintenance.map((maintenance) => (
                  <li className="maintenance-row" key={maintenance.id}>
                    <div className="maintenance-vehicle">
                      <span className="row-label">Vehicle</span>
                      <span className="row-value">{maintenance.vehicle}</span>
                    </div>
                    <div className="maintenance-item">
                      <span className="row-label">Maintenance</span>
                      <span className="row-value">{maintenance.item}</span>
                    </div>
                    <time
                      className="maintenance-date"
                      dateTime={maintenance.dueDateTime}
                    >
                      <span className="row-label">Due date</span>
                      {maintenance.dueDate}
                    </time>
                  </li>
                ))}
              </ul>
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
                aria-label={`Fleet health distribution: ${dashboardMockData.health.healthy} healthy, ${dashboardMockData.health.attention} needing attention, ${dashboardMockData.health.critical} critical out of ${totalVehicles} vehicles.`}
              >
                {healthSegments.map((segment) => (
                  <span
                    className={`health-segment health-segment-${segment.tone}`}
                    key={segment.key}
                    style={{
                      width: `${(dashboardMockData.health[segment.key] / totalVehicles) * 100}%`,
                    }}
                  />
                ))}
              </div>
              <p className="health-summary">
                {totalVehicles} vehicles in your fleet
              </p>
              <ul className="health-legend">
                {healthSegments.map((segment) => (
                  <li key={segment.key}>
                    <span
                      className={`health-dot health-dot-${segment.tone}`}
                      aria-hidden="true"
                    />
                    <span>{segment.label}</span>
                    <strong>{dashboardMockData.health[segment.key]}</strong>
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
