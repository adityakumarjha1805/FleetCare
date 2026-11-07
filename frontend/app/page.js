import Link from "next/link";

export const metadata = {
  title: "FleetCare | Fleet operations, made clearer",
  description:
    "Manage vehicles, diagnostics, maintenance, and service requests in one clear fleet workspace.",
};

export const instant = false;

const features = [
  {
    title: "Vehicle management",
    description:
      "Keep vehicle details and fleet records organized in one easy-to-find place.",
    href: "/vehicles",
    icon: "vehicle",
  },
  {
    title: "Diagnostics & health",
    description:
      "Review diagnostic activity and get a clearer picture of vehicle health.",
    href: "/diagnostics",
    icon: "health",
  },
  {
    title: "Maintenance tracking",
    description:
      "Plan and follow upcoming maintenance to help keep your fleet moving.",
    href: "/maintenance",
    icon: "maintenance",
  },
  {
    title: "Service requests",
    description:
      "Keep service requests together so your team can follow them through.",
    href: "/service-requests",
    icon: "requests",
  },
];

function BrandMark() {
  return (
    <span className="public-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M4 16.5h16l-1.7-6.2a2 2 0 0 0-1.9-1.5H7.6a2 2 0 0 0-1.9 1.5L4 16.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M6 16.5v2m12-2v2M7.5 13h9"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function FeatureIcon({ name }) {
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
    case "vehicle":
      return (
        <svg {...props}>
          <path d="M4 14.5h16l-1.6-6a2 2 0 0 0-1.9-1.5h-9a2 2 0 0 0-1.9 1.5L4 14.5Z" />
          <path d="M4 14.5v3h2m14-3v3h-2M7 17.5h10M7 11h10" />
        </svg>
      );
    case "health":
      return (
        <svg {...props}>
          <path d="M3.5 12h4l2.2-6 4.5 12 2.2-6h4" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "maintenance":
      return (
        <svg {...props}>
          <path d="M14.2 6.1a5 5 0 0 0-6.3 6.3l-4.1 4.1a2.1 2.1 0 0 0 3 3l4.1-4.1a5 5 0 0 0 6.3-6.3l-3 3-3-3 3-3Z" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M7 3.5h7l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
          <path d="M14 3.5v4h4m-9 4h6m-6 4h6" />
        </svg>
      );
  }
}

export default function HomePage() {
  return (
    <main className="public-landing">
      <header className="public-header">
        <nav className="public-nav" aria-label="Main navigation">
          <Link className="public-brand" href="/" aria-label="FleetCare home">
            <BrandMark />
            <span>FleetCare</span>
          </Link>
          <div className="public-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
          </div>
          <div className="public-nav-actions">
            <Link className="public-signin" href="/login">
              Sign In
            </Link>
            <Link className="public-button public-button-small" href="/signup">
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <section className="public-hero">
        <div className="public-hero-inner">
          <div className="public-hero-copy">
            <p className="public-eyebrow">A CLEARER WAY TO RUN YOUR FLEET</p>
            <h1>Keep your fleet moving, with everything in view.</h1>
            <p className="public-hero-description">
              FleetCare brings vehicle management, diagnostics, maintenance,
              and service requests together in one straightforward workspace.
            </p>
            <div className="public-hero-actions">
              <Link className="public-button" href="/signup">
                Get Started
                <span aria-hidden="true">→</span>
              </Link>
              <a className="public-button-secondary" href="#features">
                Explore Features
              </a>
            </div>
            <p className="public-hero-note">
              A practical workspace for the people who keep vehicles on the
              road.
            </p>
          </div>

          <div className="public-hero-visual" aria-label="FleetCare workspace preview">
            <div className="public-preview-window">
              <div className="public-preview-top">
                <span className="public-preview-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>Fleet overview</span>
                <span className="public-preview-status">
                  <i /> Workspace
                </span>
              </div>
              <div className="public-preview-body">
                <div className="public-preview-heading">
                  <div>
                    <span>YOUR OPERATIONS</span>
                    <strong>Everything in one place</strong>
                  </div>
                  <span className="public-preview-avatar" aria-hidden="true">
                    F
                  </span>
                </div>
                <div className="public-preview-cards">
                  <div className="public-preview-card">
                    <span className="public-preview-icon public-preview-blue">
                      <FeatureIcon name="vehicle" />
                    </span>
                    <span>Vehicles</span>
                    <i className="public-preview-line public-preview-line-wide" />
                    <i className="public-preview-line" />
                  </div>
                  <div className="public-preview-card">
                    <span className="public-preview-icon public-preview-green">
                      <FeatureIcon name="health" />
                    </span>
                    <span>Vehicle health</span>
                    <i className="public-preview-line public-preview-line-wide" />
                    <i className="public-preview-line" />
                  </div>
                </div>
                <div className="public-preview-activity">
                  <div className="public-preview-activity-title">
                    <strong>Fleet activity</strong>
                    <span>Stay up to date</span>
                  </div>
                  <div className="public-preview-row">
                    <span className="public-preview-row-icon">
                      <FeatureIcon name="maintenance" />
                    </span>
                    <span>
                      <strong>Maintenance</strong>
                      <small>Keep service plans organized</small>
                    </span>
                    <i />
                  </div>
                  <div className="public-preview-row">
                    <span className="public-preview-row-icon public-preview-purple">
                      <FeatureIcon name="requests" />
                    </span>
                    <span>
                      <strong>Service requests</strong>
                      <small>Follow requests from one place</small>
                    </span>
                    <i />
                  </div>
                </div>
              </div>
            </div>
            <div className="public-hero-orb public-hero-orb-one" />
            <div className="public-hero-orb public-hero-orb-two" />
          </div>
        </div>
      </section>

      <section className="public-features" id="features">
        <div className="public-section-heading">
          <p className="public-eyebrow">YOUR FLEET, CONNECTED</p>
          <h2>One workspace for the work that keeps you moving.</h2>
          <p>
            Spend less time searching across tools and more time staying on top
            of your fleet.
          </p>
        </div>
        <div className="public-feature-grid">
          {features.map((feature) => (
            <Link
              className="public-feature-card"
              href={feature.href}
              key={feature.title}
            >
              <span className="public-feature-icon">
                <FeatureIcon name={feature.icon} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <span className="public-feature-link">
                Explore in FleetCare <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="public-how" id="how-it-works">
        <div className="public-how-intro">
          <p className="public-eyebrow">GET STARTED AT YOUR PACE</p>
          <h2>Simple to start. Ready for the day-to-day.</h2>
          <p>
            Bring your fleet into one place and build a routine that works for
            your team.
          </p>
          <Link className="public-text-link" href="/signup">
            Create your FleetCare account <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ol className="public-how-steps">
          <li>
            <span>01</span>
            <div>
              <h3>Set up your workspace</h3>
              <p>Create an account and add your fleet details when you are ready.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>See the full picture</h3>
              <p>Review vehicle health, diagnostics, and maintenance activity.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Keep work moving</h3>
              <p>Organize service requests and follow the work that needs attention.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="public-final-cta">
        <div>
          <p className="public-eyebrow">YOUR FLEETCARE WORKSPACE</p>
          <h2>Bring your fleet into clearer view.</h2>
          <p>Get started with FleetCare and organize your operations in one place.</p>
        </div>
        <div className="public-final-actions">
          <Link className="public-button public-button-light" href="/signup">
            Get Started <span aria-hidden="true">→</span>
          </Link>
          <Link className="public-cta-signin" href="/login">
            Sign In
          </Link>
        </div>
      </section>

      <footer className="public-footer">
        <Link className="public-brand" href="/" aria-label="FleetCare home">
          <BrandMark />
          <span>FleetCare</span>
        </Link>
        <p>Clearer fleet operations, all in one place.</p>
        <span>© FleetCare</span>
      </footer>
    </main>
  );
}
