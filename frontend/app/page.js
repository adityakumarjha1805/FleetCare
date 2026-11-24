"use client";

import Link from "next/link";
import { useState } from "react";

function BrandMark({ small = false }) {
  return <span className={`new-brand-mark${small ? " new-brand-mark-small" : ""}`} aria-hidden="true" />;
}

const storyStages = [
  {
    time: "06:12 AM",
    label: "TELEMETRY TRIGGER",
    title: "Dawn sensor anomaly detected",
    copy: "Before morning dispatch begins, vehicle KA-01-MX-3434 flags a hydraulic line pressure drop during warm-up.",
  },
  {
    time: "06:18 AM",
    label: "DIAGNOSTIC ENGINE",
    title: "Instant CAN bus diagnostic triage",
    copy: "telfay translates fault code P0552 into plain operational severity and links it to the vehicle record.",
  },
  {
    time: "06:35 AM",
    label: "WORKSHOP ROUTING",
    title: "Automated Bay 2 work order dispatch",
    copy: "A work order opens, reserves brake inventory, and assigns the lead technician before the driver arrives.",
  },
  {
    time: "09:10 AM",
    label: "COMPLIANCE LEDGER",
    title: "Verified repair and compliance ledger",
    copy: "Post-repair telemetry confirms nominal pressure and permanently locks the repair into the asset record.",
  },
];

export default function HomePage() {
  const [managerTab, setManagerTab] = useState("vehicles");
  const [role, setRole] = useState("manager");
  const [issue, setIssue] = useState("Brake Pad Wear");
  const [plate, setPlate] = useState("KA-01-MX-3434");
  const [storyStage, setStoryStage] = useState(0);
  const [activeOnboard, setActiveOnboard] = useState(0);

  return (
    <main className="telfay-new-home">
      <header className="new-topbar">
        <nav className="new-nav" aria-label="Primary navigation">
          <Link href="/" className="new-brand" aria-label="telfay homepage">
            <BrandMark />
            <span className="new-brand-wordmark"><b>tel</b><i>fay</i></span>
          </Link>
          <div className="new-nav-links">
            <a href="#features">Features</a>
            <a href="#workflow-story">How it works</a>
          </div>
          <div className="new-nav-actions">
            <Link href="/login" className="new-signin">Sign In</Link>
            <Link href="/signup" className="new-primary new-primary-small">Get Started <span>→</span></Link>
          </div>
        </nav>
      </header>

      <section className="new-hero" id="top">
        <div className="new-hero-inner">
          <div className="new-hero-copy">
            <div className="new-eyebrow"><span />FLEET OPERATIONS WORKSPACE</div>
            <h1>Keep your fleet moving,<br /> with everything in view.</h1>
            <p>telfay unifies vehicle records, live CAN bus diagnostics, maintenance schedules, and service requests into one flat operational workspace.</p>
            <div className="new-hero-actions">
              <Link href="/signup" className="new-primary">Get Started <span>→</span></Link>
              <button type="button" className="new-secondary" onClick={() => setRole("driver")}><b>+</b> Driver Report (&lt; 30s)</button>
            </div>
            <div className="new-hero-note">
              <span>Built for fleet managers, coordinators &amp; drivers.</span>
              <span className="new-live"><i />Live Telemetry</span>
            </div>
          </div>

          <div className="new-operational-desk">
            <div className="new-desk-bar">
              <div className="new-desk-id"><b>OPERATIONAL DESK</b><span>/</span><code>HUB-BLR-01</code></div>
              <div className="new-role-switch" role="tablist">
                <button type="button" className={role === "manager" ? "active" : ""} onClick={() => setRole("manager")}>Fleet Manager View</button>
                <button type="button" className={role === "driver" ? "active" : ""} onClick={() => setRole("driver")}>Driver Report (&lt; 30s)</button>
              </div>
            </div>

            {role === "manager" ? (
              <div className="new-desk-content">
                <div className="new-desk-heading">
                  <div><span>LIVE FLEET TELEMETRY</span><h2>Everything in one place</h2></div>
                  <div className="new-subtabs" role="tablist">
                    {[
                      ["vehicles", "Vehicles"],
                      ["diagnostics", "Diagnostics"],
                      ["requests", "Requests (2)"],
                    ].map(([key, label]) => (
                      <button type="button" key={key} className={managerTab === key ? "active" : ""} onClick={() => setManagerTab(key)}>{label}</button>
                    ))}
                  </div>
                </div>

                {managerTab === "vehicles" && (
                  <div className="new-desk-panel">
                    <div className="new-kpis">
                      <div className="new-kpi">
                        <div className="new-kpi-head"><span>ACTIVE FLEET STATUS</span><b className="online">Online</b></div>
                        <strong><code>18</code> <small>Active Vehicles</small></strong>
                        <div className="new-kpi-breakdown"><b className="healthy">15 Healthy</b><i>·</i><b className="due">2 Due</b><i>·</i><b className="critical">1 Critical</b></div>
                      </div>
                      <div className="new-kpi">
                        <div className="new-kpi-head"><span>ROUTE AVAILABILITY</span><code>SHIFT A</code></div>
                        <strong><code>83.3%</code> <small>Dispatched</small></strong>
                        <div className="new-progress"><span><i /></span><b><code>3</code> Idle</b></div>
                      </div>
                    </div>
                    <div className="new-feed">
                      <div className="new-feed-head"><span>LIVE DISPATCH &amp; TRIAGE FEED</span><span>Real-time sync</span></div>
                      <div className="new-feed-row critical">
                        <div><code>KA-01-MX-3434</code><i>·</i><span>Brake Pad Wear Alert (<code>P0552</code>)</span></div><b className="attention">In Progress</b>
                      </div>
                      <div className="new-feed-row">
                        <div><code>MH-02-EA-9081</code><i>·</i><span>Freightline Express · <code>64 km/h</code></span></div><b className="healthy-badge">Healthy</b>
                      </div>
                      <div className="new-feed-row">
                        <div><code>DL-09-CP-1190</code><i>·</i><span>Scheduled <code>40,000 km</code> Service Complete</span></div><b className="healthy-badge">Healthy</b>
                      </div>
                    </div>
                  </div>
                )}

                {managerTab === "diagnostics" && (
                  <div className="new-desk-panel">
                    <div className="new-kpis">
                      <div className="new-kpi"><div className="new-kpi-head"><span>TELEMETRY HEALTH INDEX</span></div><strong><code>94.8%</code> <small>Nominal</small></strong><p><code>1</code> active fault code (<code>P0552</code>) isolated</p></div>
                      <div className="new-kpi"><div className="new-kpi-head"><span>CAN BUS SYNC LATENCY</span></div><strong><code>124 ms</code> <small>Polling</small></strong><p className="healthy">OBD-II / J1939 gateway active</p></div>
                    </div>
                    <div className="new-chart">
                      <div><b>Hydraulic Line Pressure (<code>KA-01-MX-3434</code>)</b><span>Critical Dip</span></div>
                      <div className="new-bars">{[72,76,74,70,34,48,82,85].map((height, index) => <i key={index} style={{ height: `${height}%` }} className={index === 4 ? "red" : index > 4 ? "green" : ""} />)}</div>
                      <div className="new-chart-axis"><code>05:30 AM</code><code>06:12 AM</code><code>07:45 AM</code><code>NOW</code></div>
                    </div>
                  </div>
                )}

                {managerTab === "requests" && (
                  <div className="new-desk-panel">
                    <div className="new-request-head"><span>ACTIVE WORKSHOP QUEUE</span><button type="button" onClick={() => setRole("driver")}>+ Log New Request</button></div>
                    <div className="new-request-list">
                      <div><span><code>#WO-8821</code> <code>KA-01-MX-3434</code><b>Front Brake Pad &amp; Rotor Service · Bay 2</b></span><i className="attention">In Progress</i></div>
                      <div><span><code>#WO-8820</code> <code>DL-09-CP-1190</code><b>40,000 km Oil, Filter &amp; Alignment Check</b></span><i className="healthy-badge">Completed</i></div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="new-desk-content new-driver">
                <div className="new-driver-notice"><span>Select a vehicle and issue tag to dispatch a work order.</span><code>GPS LOCKED</code></div>
                <div className="new-driver-grid">
                  <label>Vehicle Plate *
                    <select value={plate} onChange={(event) => setPlate(event.target.value)}>
                      <option>KA-01-MX-3434 · Van #04</option>
                      <option>MH-02-EA-9081 · Truck #11</option>
                      <option>TN-07-BR-5502 · Pickup #02</option>
                    </select>
                  </label>
                  <div><span>1-Tap Issue Selector *</span><div className="new-issue-tags">
                    {["Brake Pad Wear", "Low Tire PSI", "Oil Temp Alert"].map((label) => <button type="button" key={label} className={issue === label ? "active" : ""} onClick={() => setIssue(label)}>{label}</button>)}
                  </div></div>
                </div>
                <label>Quick Field Observation<input defaultValue="Metallic squeak on front-left axle during braking" /></label>
                <div className="new-driver-actions"><button type="button" className="new-secondary" onClick={() => setRole("manager")}>Cancel</button><button type="button" className="new-primary" onClick={() => setRole("manager")}>Dispatch Work Order <span>→</span></button></div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="new-benchmarks" aria-label="Operational benchmarks">
        <div className="new-metric"><div><span>INCIDENT INTAKE</span><b>98% Faster</b></div><strong>&lt; 30 sec</strong><p>Structured driver reporting versus manual paper inspection logs.</p></div>
        <div className="new-metric"><div><span>AUDIT TRAIL</span><b className="verified">Verifiable</b></div><strong>100%</strong><p>Every fault, technician assignment, and parts allocation indexed per asset.</p></div>
        <div className="new-metric"><div><span>DATA SILOS</span><b className="verified">Synchronized</b></div><strong>0</strong><p>Replace scattered spreadsheets and lost chats with one operational board.</p></div>
      </section>

      <section className="new-story" id="workflow-story">
        <div className="new-story-inner">
          <div className="new-story-heading"><div className="new-eyebrow"><span />WORKFLOW STORY · END-TO-END TRACEABILITY</div><h2>From dawn alert to audit sign-off.</h2><p>Follow a single vehicle event across four operational stages—from early sensor detection to verified workshop sign-off.</p></div>
          <div className="new-story-grid">
            <div className="new-story-chapters">
              {storyStages.map((stage, index) => (
                <button type="button" key={stage.title} className={storyStage === index ? "active" : ""} onClick={() => setStoryStage(index)}>
                  <code>{String(index + 1).padStart(2, "0")} · {stage.time}</code><span>{stage.label}</span>
                  <h3>{stage.title}</h3><p>{stage.copy}</p>
                </button>
              ))}
            </div>
            <div className="new-story-frame">
              <div className="new-story-frame-head"><span><i />Stage <code>{String(storyStage + 1).padStart(2, "0")}</code> · {storyStages[storyStage].label}</span><code>KA-01-MX-3434</code></div>
              <div className="new-story-view">
                <div><span>{storyStages[storyStage].time} · {storyStages[storyStage].label}</span><b>{storyStage === 3 ? "Healthy" : storyStage === 2 ? "In Progress" : "Attention"}</b></div>
                <h3>{storyStages[storyStage].title}</h3>
                <div className="new-story-detail"><strong>{storyStage === 0 ? "Hydraulic pressure dropped 14.2% below safe baseline." : storyStage === 1 ? "Fault code P0552 decoded and linked to brake history." : storyStage === 2 ? "Bay 2 is assigned with brake caliper parts reserved." : "Repair closed; hydraulic pressure restored to 960 kPa."}</strong><p>{storyStages[storyStage].copy}</p></div>
              </div>
              <div className="new-story-controls"><span>Select stage:</span><div>{storyStages.map((stage, index) => <button type="button" key={stage.title} className={storyStage === index ? "active" : ""} onClick={() => setStoryStage(index)}>{String(index + 1).padStart(2, "0")}</button>)}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="new-onboarding" id="features">
        <div className="new-onboard-copy"><span>GET STARTED AT YOUR PACE</span><h2>Simple to start. Ready for the day-to-day.</h2><p>Bring your fleet records into one structured board in minutes—without complex hardware retrofits or week-long training.</p><Link href="/signup">Create your telfay account →</Link></div>
        <div className="new-onboard-list">
          {[
            ["Set up your workspace", "Create an account and import vehicle numbers, odometer baselines, and team roles.", "Supports bulk CSV upload or instant single-plate entry."],
            ["See the full picture", "Review vehicle health, active fault codes, and preventive service intervals.", "Healthy, due-soon, and critical assets are highlighted at a glance."],
            ["Keep work moving", "Dispatch requests, assign workshop bays, and close repairs with an audit log.", "Track the full lifecycle from report to road-ready sign-off."],
          ].map(([title, copy, detail], index) => (
            <button type="button" key={title} className={activeOnboard === index ? "active" : ""} onClick={() => setActiveOnboard(index)}><code>{String(index + 1).padStart(2, "0")}</code><span><h3>{title}</h3><p>{copy}</p>{activeOnboard === index && <b>{detail}</b>}</span></button>
          ))}
        </div>
      </section>

      <section className="new-cta">
        <div><span>YOUR TELFAY WORKSPACE</span><h2>Bring your fleet into clearer view.</h2><p>Start organizing vehicle records, diagnostics, and maintenance workflows in one flat operational board.</p></div>
        <div><Link href="/signup" className="new-primary">Get Started <span>→</span></Link><Link href="/login" className="new-cta-signin">Sign In</Link></div>
      </section>

      <footer className="new-footer">
        <div><Link href="/" className="new-brand"><BrandMark small /><span className="new-brand-wordmark"><b>tel</b><i>fay</i></span></Link><p>Clearer fleet operations, all in one place.</p><span>© <code>2026</code> telfay</span></div>
      </footer>
    </main>
  );
}
