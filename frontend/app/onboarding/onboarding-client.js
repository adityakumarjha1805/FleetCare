"use client";

import { useState } from "react";
import Link from "next/link";
import AppShell from "../../components/app-shell";
import { completeOnboarding } from "../../lib/auth-api";

const steps = [
  {
    title: "Register your first vehicle",
    description:
      "Start your fleet by adding a vehicle. You can do this whenever you are ready.",
    href: "/vehicles",
    linkLabel: "Open Vehicles",
  },
  {
    title: "Add vehicle information",
    description:
      "Record details such as the vehicle name, make, model, and other available information.",
    href: "/vehicles",
    linkLabel: "Manage vehicle information",
  },
  {
    title: "Explore vehicle diagnostics",
    description:
      "Review diagnostic information and learn where vehicle health details appear.",
    href: "/diagnostics",
    linkLabel: "Open Diagnostics",
  },
  {
    title: "Set up maintenance",
    description:
      "Explore maintenance planning so upcoming service needs are easy to track.",
    href: "/maintenance",
    linkLabel: "Open Maintenance",
  },
  {
    title: "Learn to manage service requests",
    description:
      "See how to review and manage service requests for your fleet.",
    href: "/service-requests",
    linkLabel: "Open Service Requests",
  },
];

export default function OnboardingPage() {
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const completedCount = completedSteps.length;
  const progress = Math.round((completedCount / steps.length) * 100);

  function continueToModule() {
    window.dispatchEvent(new Event("fleetcare:onboarding-started"));
  }

  function toggleStep(index) {
    setCompletedSteps((current) =>
      current.includes(index)
        ? current.filter((step) => step !== index)
        : [...current, index].sort((a, b) => a - b),
    );
    setError("");
  }

  async function finishOnboarding() {
    if (completedCount !== steps.length || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    try {
      await completeOnboarding();
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to save your onboarding progress. Please try again.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Getting started"
      showPageHeading={false}
      onNavigate={continueToModule}
    >
      <div className="onboarding-page">
        <section className="onboarding-welcome" aria-labelledby="welcome-title">
          <div className="onboarding-welcome-copy">
            <p className="eyebrow">YOUR FLEETCARE WORKSPACE</p>
            <h1 id="welcome-title">Welcome to FleetCare!</h1>
            <p>
              FleetCare helps you manage your vehicle fleet, diagnostics, and
              maintenance in one place. Follow these steps to get familiar with
              your workspace.
            </p>
            <a className="onboarding-primary-link" href="#onboarding-checklist">
              Get Started
            </a>
          </div>
          <div className="onboarding-welcome-art" aria-hidden="true">
            <span className="onboarding-art-orbit onboarding-art-orbit-one" />
            <span className="onboarding-art-orbit onboarding-art-orbit-two" />
            <svg viewBox="0 0 120 90" fill="none">
              <path
                d="M17 56h86l-8-27a8 8 0 0 0-7.7-5.8H39.7A8 8 0 0 0 32 29l-15 27Z"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <path
                d="M18 56v12h11m74-12v12H92M35 68h56M36 42h53"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="35" cy="68" r="7" fill="currentColor" />
              <circle cx="91" cy="68" r="7" fill="currentColor" />
            </svg>
          </div>
        </section>

        <section
          className="onboarding-checklist"
          id="onboarding-checklist"
          aria-labelledby="checklist-title"
        >
          <div className="onboarding-checklist-header">
            <div>
              <p className="eyebrow">A QUICK TOUR</p>
              <h2 id="checklist-title">Your getting-started checklist</h2>
              <p>
                Explore each area and mark a step complete when you are ready.
                No vehicles or service records are created for you.
              </p>
            </div>
            <div
              className="onboarding-progress"
              role="progressbar"
              aria-label="Onboarding checklist progress"
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-valuenow={completedCount}
              aria-valuetext={`${completedCount} of ${steps.length} steps completed`}
            >
              <span className="onboarding-progress-count">
                {completedCount}
                <span>/{steps.length}</span>
              </span>
              <span>steps complete</span>
            </div>
          </div>

          <div className="onboarding-progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>

          <ol className="onboarding-step-list">
            {steps.map((step, index) => {
              const isComplete = completedSteps.includes(index);
              return (
                <li
                  className={`onboarding-step${isComplete ? " is-complete" : ""}`}
                  key={step.title}
                >
                  <span className="onboarding-step-number" aria-hidden="true">
                    {isComplete ? "✓" : index + 1}
                  </span>
                  <div className="onboarding-step-content">
                    <div className="onboarding-step-heading">
                      <h3>{step.title}</h3>
                      <span
                        className={`onboarding-step-status${isComplete ? " is-complete" : ""}`}
                      >
                        {isComplete ? "Completed" : "Pending"}
                      </span>
                    </div>
                    <p>{step.description}</p>
                    <div className="onboarding-step-actions">
                      <Link href={step.href} onClick={continueToModule}>
                        {step.linkLabel}
                      </Link>
                      <button
                        type="button"
                        aria-pressed={isComplete}
                        onClick={() => toggleStep(index)}
                      >
                        {isComplete ? "Mark as pending" : "Mark as complete"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {error && (
            <p className="onboarding-error" role="alert">
              {error}
            </p>
          )}

          <div className="onboarding-finish">
            <p>
              Your checklist only updates when you mark a step. Finish when
              you are ready to start using your dashboard.
            </p>
            <button
              className="onboarding-primary-link"
              type="button"
              disabled={completedCount !== steps.length || isSubmitting}
              onClick={finishOnboarding}
            >
              {isSubmitting ? "Saving your progress…" : "Finish onboarding"}
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
