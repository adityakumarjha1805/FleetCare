import AppShell from "../components/app-shell";

export default function Home() {
  return (
    <AppShell>
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path
              d="M5 22.5h22l-2.2-9.2a3 3 0 0 0-2.9-2.3H10.1a3 3 0 0 0-2.9 2.3L5 22.5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M8 22.5v3m16-3v3M8.2 17h15.6M10 22.5h.1m11.8 0h.1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="eyebrow">YOUR FLEET WORKSPACE</p>
        <h2 id="welcome-title">Fleet operations, all in one place.</h2>
        <p className="welcome-description">
          Your workspace is ready. Fleet health, vehicle activity, and
          maintenance workflows will appear here.
        </p>
      </section>
    </AppShell>
  );
}
