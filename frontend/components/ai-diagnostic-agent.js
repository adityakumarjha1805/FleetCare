"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./app-shell";
import { initialVehicleData } from "./mock-fleet-data";
import { sampleDiagnosticData } from "./mock-diagnostic-data";
import { analyzeSampleDiagnostic } from "../lib/diagnostic-sample-analysis";

function formatOdometer(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function AnalysisSection({ title, children, className = "" }) {
  return (
    <section className={`agent-result-section ${className}`}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export default function AIDiagnosticAgent() {
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDiagnosticId, setSelectedDiagnosticId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const timerRef = useRef(null);
  const diagnosticSelectRef = useRef(null);

  const availableDiagnostics = useMemo(
    () =>
      sampleDiagnosticData.filter(
        (record) => record.vehicleId === selectedVehicleId,
      ),
    [selectedVehicleId],
  );

  const selectedVehicle = initialVehicleData.find(
    (vehicle) => vehicle.id === selectedVehicleId,
  );
  const selectedDiagnostic = availableDiagnostics.find(
    (record) => record.id === selectedDiagnosticId,
  );
  const analyzedVehicle = analysis
    ? initialVehicleData.find(
        (vehicle) => vehicle.id === analysis.record.vehicleId,
      )
    : null;

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  function resetAnalysis() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setAnalysis(null);
    setIsLoading(false);
    setErrorMessage("");
    setSelectedDiagnosticId("");
    window.setTimeout(() => diagnosticSelectRef.current?.focus(), 0);
  }

  function handleVehicleChange(event) {
    setSelectedVehicleId(event.target.value);
    setSelectedDiagnosticId("");
    setAnalysis(null);
    setErrorMessage("");
  }

  function handleDiagnosticChange(event) {
    setSelectedDiagnosticId(event.target.value);
    setAnalysis(null);
    setErrorMessage("");
  }

  function handleAnalyze() {
    if (!selectedVehicle || !selectedDiagnostic) {
      setErrorMessage("Select a vehicle and diagnostic record to continue.");
      return;
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);
    setIsLoading(true);
    setAnalysis(null);
    setErrorMessage("");

    timerRef.current = window.setTimeout(() => {
      try {
        setAnalysis({
          record: selectedDiagnostic,
          result: analyzeSampleDiagnostic(selectedDiagnostic),
        });
      } catch {
        setErrorMessage(
          "The sample analysis could not be completed. Please try again.",
        );
      } finally {
        setIsLoading(false);
        timerRef.current = null;
      }
    }, 650);
  }

  const analysisReady = Boolean(selectedVehicle && selectedDiagnostic);

  return (
    <AppShell title="AI Diagnostic Agent" showPageHeading={false}>
      <div className="ai-agent-page">
        <header className="ai-agent-header">
          <div>
            <p className="eyebrow">FLEETCARE ASSISTANT</p>
            <h1 className="page-heading ai-agent-title">
              AI Diagnostic Agent
            </h1>
            <p className="ai-agent-description">
              Review a recorded trouble code with a simple, guided sample
              explanation and mechanic-confirmed next steps.
            </p>
          </div>
        </header>

        <aside className="ai-agent-prototype-note" aria-label="Prototype notice">
          <span className="ai-agent-note-icon" aria-hidden="true">
            i
          </span>
          <p>
            <strong>Prototype — no AI model is connected.</strong> Results are
            predefined sample responses. A DTC indicates a possible issue, not
            a confirmed faulty component or a prediction of vehicle failure.
          </p>
        </aside>

        <section
          className="ai-agent-workspace"
          aria-labelledby="analysis-input-title"
        >
          <div className="ai-agent-form-heading">
            <div className="ai-agent-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3.5v3m-6.1 1.1L3.8 5.5m14.1 2.1 2.1-2.1M4 13h3l1.5-3 3 7 1.5-4h7"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 19.5h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h2 id="analysis-input-title">Start a diagnostic review</h2>
              <p>
                Choose a vehicle and one of its existing diagnostic records.
              </p>
            </div>
          </div>

          <div className="ai-agent-selectors">
            <div className="form-field">
              <label htmlFor="agent-vehicle">
                Vehicle <span aria-hidden="true">*</span>
              </label>
              <select
                id="agent-vehicle"
                value={selectedVehicleId}
                onChange={handleVehicleChange}
                disabled={isLoading}
              >
                <option value="">Select a vehicle</option>
                {initialVehicleData.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} ({vehicle.registrationNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="agent-diagnostic">
                Diagnostic record <span aria-hidden="true">*</span>
              </label>
              <select
                id="agent-diagnostic"
                ref={diagnosticSelectRef}
                value={selectedDiagnosticId}
                onChange={handleDiagnosticChange}
                disabled={
                  !selectedVehicleId ||
                  availableDiagnostics.length === 0 ||
                  isLoading
                }
                aria-describedby="agent-diagnostic-help"
              >
                <option value="">
                  {selectedVehicleId
                    ? availableDiagnostics.length
                      ? "Select a diagnostic record"
                      : "No diagnostic records for this vehicle"
                    : "Select a vehicle first"}
                </option>
                {availableDiagnostics.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.code} — {record.issueDescription} (
                    {record.severity}, {record.status})
                  </option>
                ))}
              </select>
              <span className="field-help" id="agent-diagnostic-help">
                Only records for the selected vehicle are shown.
              </span>
            </div>

            <button
              className="primary-action ai-agent-analyze-button"
              type="button"
              onClick={handleAnalyze}
              disabled={!analysisReady || isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="agent-loading-spinner" aria-hidden="true" />
                  Analyzing sample…
                </>
              ) : (
                <>
                  <span aria-hidden="true">✦</span>
                  Analyze Diagnostic
                </>
              )}
            </button>
          </div>

          <p className="ai-agent-form-note" id="agent-diagnostic-help-note">
            Analysis uses sample code references only and does not change
            diagnostic or maintenance records.
          </p>
        </section>

        {errorMessage && (
          <p className="ai-agent-error" role="alert">
            {errorMessage}
          </p>
        )}

        {isLoading && (
          <div className="ai-agent-loading" role="status" aria-live="polite">
            <span className="agent-loading-spinner" aria-hidden="true" />
            <div>
              <strong>Preparing sample analysis…</strong>
              <span>
                Checking the selected record against local sample knowledge.
              </span>
            </div>
          </div>
        )}

        {!analysis && !isLoading && (
          <section
            className="ai-agent-empty-state"
            aria-label="Analysis status"
            aria-live="polite"
          >
            <span className="ai-agent-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3.5v3m-6.1 1.1L3.8 5.5m14.1 2.1 2.1-2.1M4 13h3l1.5-3 3 7 1.5-4h7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 19.5h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2>No analysis yet</h2>
            <p>
              Select a vehicle and diagnostic record above, then analyze to see
              its sample explanation and suggested next steps.
            </p>
          </section>
        )}

        {analysis && analyzedVehicle && (
          <section
            className="ai-agent-results"
            aria-labelledby="analysis-results-title"
            aria-live="polite"
          >
            <div className="ai-agent-results-header">
              <div>
                <p className="eyebrow">SAMPLE AI ANALYSIS</p>
                <h2 id="analysis-results-title">Diagnostic review</h2>
                <p>
                  {analyzedVehicle.name} · {analyzedVehicle.registrationNumber}
                </p>
              </div>
              <button
                className="secondary-button ai-agent-another-button"
                type="button"
                onClick={resetAnalysis}
              >
                Analyze another record
              </button>
            </div>

            <div className="ai-agent-result-grid">
              <div className="ai-agent-result-main">
                <AnalysisSection
                  title="Diagnostic information"
                  className="agent-diagnostic-information"
                >
                  <div className="agent-record-facts">
                    <div>
                      <span>Diagnostic trouble code</span>
                      <strong>{analysis.record.code}</strong>
                    </div>
                    <div>
                      <span>Recorded issue</span>
                      <strong>{analysis.record.issueDescription}</strong>
                    </div>
                    <div>
                      <span>Vehicle</span>
                      <strong>
                        {analyzedVehicle.manufacturer} {analyzedVehicle.model}{" "}
                        ({analyzedVehicle.year})
                      </strong>
                    </div>
                    <div>
                      <span>Record details</span>
                      <strong>
                        {formatDate(analysis.record.dateDetected)} ·{" "}
                        {formatOdometer(analysis.record.odometerKm)} km ·{" "}
                        {analysis.record.status}
                      </strong>
                    </div>
                  </div>
                  <div className="agent-code-explanation">
                    <h4>{analysis.result.title}</h4>
                    <p>{analysis.result.explanation}</p>
                  </div>
                </AnalysisSection>

                <AnalysisSection title="Possible causes">
                  {analysis.result.possibleCauses.length > 0 ? (
                    <ul className="agent-result-list">
                      {analysis.result.possibleCauses.map((cause) => (
                        <li key={cause}>{cause}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="agent-result-copy">
                      No causes are suggested because this code is not covered
                      by the sample references.
                    </p>
                  )}
                  <p className="agent-section-caveat">
                    These are possibilities only, not confirmed component
                    failures.
                  </p>
                </AnalysisSection>

                <AnalysisSection title="Suggested maintenance">
                  {analysis.result.suggestedMaintenance.length > 0 ? (
                    <ul className="agent-result-list">
                      {analysis.result.suggestedMaintenance.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="agent-result-copy">
                      No code-specific maintenance suggestions are available
                      for this sample.
                    </p>
                  )}
                  <p className="agent-section-caveat">
                    Suggestions require mechanic confirmation. No maintenance
                    record has been created.
                  </p>
                </AnalysisSection>
              </div>

              <aside className="ai-agent-result-aside">
                <AnalysisSection title="Severity assessment">
                  <span
                    className={`agent-severity-badge agent-severity-${analysis.record.severity.toLowerCase()}`}
                  >
                    {analysis.record.severity} — sample record
                  </span>
                  <p className="agent-result-copy">
                    {analysis.result.severityAssessment}
                  </p>
                </AnalysisSection>

                <AnalysisSection title="Recommended next steps">
                  <ol className="agent-result-list agent-ordered-list">
                    {analysis.result.recommendedNextSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </AnalysisSection>

                <AnalysisSection title="Mechanic inspection">
                  <p className="agent-inspection-recommendation">
                    {analysis.result.mechanicInspectionRecommended
                      ? "Recommended"
                      : "Not specified"}
                  </p>
                  <p className="agent-result-copy">
                    Have a qualified mechanic confirm findings before any
                    repair or maintenance decision.
                  </p>
                </AnalysisSection>
              </aside>
            </div>

            <p className="agent-results-disclaimer">
              Sample response only; no live AI analysis was performed. A
              diagnostic trouble code indicates a possible issue and does not
              confirm a faulty component or predict failure. A qualified
              mechanic must approve any action. FleetCare will not book services
              or order parts from these suggestions.
            </p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
