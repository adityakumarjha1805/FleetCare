"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./app-shell";
import { analyzeDiagnostic, fetchDiagnostics } from "../lib/diagnostics-api";
import { fetchVehicles } from "../lib/vehicles-api";

function formatOdometer(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
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
  const [vehicles, setVehicles] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDiagnosticId, setSelectedDiagnosticId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const diagnosticSelectRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setIsLoading(true);
      setLoadError("");
      try {
        const [loadedVehicles, loadedDiagnostics] = await Promise.all([
          fetchVehicles({ signal: controller.signal }),
          fetchDiagnostics({ signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) {
          setVehicles(loadedVehicles);
          setDiagnostics(loadedDiagnostics);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error.message || "Unable to load saved diagnostic records.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadData();
    return () => controller.abort();
  }, [refreshKey]);

  const availableDiagnostics = useMemo(
    () => diagnostics.filter((record) => record.vehicleId === selectedVehicleId),
    [diagnostics, selectedVehicleId],
  );

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId,
  );
  const selectedDiagnostic = availableDiagnostics.find(
    (record) => record.id === selectedDiagnosticId,
  );
  const analyzedVehicle = analysis?.vehicle;

  function resetAnalysis() {
    setAnalysis(null);
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

  async function handleAnalyze() {
    if (!selectedVehicle || !selectedDiagnostic) {
      setErrorMessage("Select a vehicle and diagnostic record to continue.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);
    setErrorMessage("");

    try {
      const result = await analyzeDiagnostic(selectedDiagnostic.id);
      setAnalysis({
        record: selectedDiagnostic,
        result,
        vehicle: selectedVehicle,
      });
    } catch (error) {
      setErrorMessage(
        error.message || "Diagnostic analysis is unavailable. Please retry.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  const analysisReady = Boolean(
    selectedVehicle && selectedDiagnostic && !isLoading,
  );

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
              Review a saved trouble code with a provider-independent
              development analysis and mechanic-review guidance.
            </p>
          </div>
        </header>

        <aside className="ai-agent-prototype-note" aria-label="Prototype notice">
          <span className="ai-agent-note-icon" aria-hidden="true">
            i
          </span>
          <p>
            <strong>No AI provider is approved.</strong> The backend currently
            uses a safe mock adapter. Results are not AI diagnoses, and a DTC
            does not confirm a faulty component or predict vehicle failure.
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
                disabled={isLoading || isAnalyzing}
              >
                <option value="">Select a vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicleName} ({vehicle.registrationNumber})
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
                  isLoading ||
                  isAnalyzing
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
              disabled={!analysisReady || isAnalyzing}
              aria-busy={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <span className="agent-loading-spinner" aria-hidden="true" />
                  Analyzing…
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
            Analysis uses the development mock adapter and does not create
            maintenance records or perform external actions.
          </p>
        </section>

        {loadError && (
          <p className="ai-agent-error" role="alert">
            {loadError}{" "}
            <button
              className="text-action"
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              Retry
            </button>
          </p>
        )}
        {errorMessage && (
          <p className="ai-agent-error" role="alert">
            {errorMessage}
          </p>
        )}

        {(isLoading || isAnalyzing) && (
          <div className="ai-agent-loading" role="status" aria-live="polite">
            <span className="agent-loading-spinner" aria-hidden="true" />
            <div>
              <strong>
                {isLoading ? "Loading saved records…" : "Preparing analysis…"}
              </strong>
              <span>
                {isLoading
                  ? "Retrieving your authenticated fleet data."
                  : "Reviewing the selected diagnostic record."}
              </span>
            </div>
          </div>
        )}

        {!analysis && !isLoading && !isAnalyzing && (
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
              Select a vehicle and saved diagnostic record above, then analyze
              to see a development response and recommended checks.
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
                <p className="eyebrow">DEVELOPMENT MOCK RESPONSE</p>
                <h2 id="analysis-results-title">Diagnostic review</h2>
                <p>
                  {analyzedVehicle.vehicleName} ·{" "}
                  {analyzedVehicle.registrationNumber}
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
                        {analyzedVehicle.make} {analyzedVehicle.model}{" "}
                        ({analyzedVehicle.year})
                      </strong>
                    </div>
                    <div>
                      <span>Record details</span>
                      <strong>
                        {formatDate(analysis.record.dateDetected)} ·{" "}
                        {formatOdometer(analysis.record.odometer)}{" "}
                        {analysis.record.odometerUnit} ·{" "}
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
                    failures. {analysis.result.uncertainty}
                  </p>
                </AnalysisSection>

                <AnalysisSection title="Recommended checks">
                  {analysis.result.recommendedChecks.length > 0 ? (
                    <ul className="agent-result-list">
                      {analysis.result.recommendedChecks.map((check) => (
                        <li key={check}>{check}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="agent-result-copy">
                      No code-specific checks are available from the mock
                      adapter.
                    </p>
                  )}
                  <p className="agent-section-caveat">
                    A qualified mechanic must confirm checks. No maintenance
                    record has been created.
                  </p>
                </AnalysisSection>
              </div>

              <aside className="ai-agent-result-aside">
                <AnalysisSection title="Severity assessment">
                  <span
                    className={`agent-severity-badge agent-severity-${analysis.record.severity.toLowerCase()}`}
                  >
                    {analysis.result.recordedSeverity} — recorded
                  </span>
                  <p className="agent-result-copy">
                    {analysis.result.severityAssessment}
                  </p>
                </AnalysisSection>

                <AnalysisSection title="Recommended next steps">
                  <ol className="agent-result-list agent-ordered-list">
                    {analysis.result.recommendedChecks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ol>
                </AnalysisSection>

                <AnalysisSection title="Mechanic inspection">
                  <p className="agent-inspection-recommendation">
                    {analysis.result.mechanicReviewRequired
                      ? "Recommended"
                      : "Not specified"}
                  </p>
                  <p className="agent-result-copy">
                    A qualified mechanic must review the code before any
                    diagnosis or repair decision.
                  </p>
                </AnalysisSection>
                <AnalysisSection title="Human approval">
                  <p className="agent-result-copy">
                    {analysis.result.humanApprovalRequired
                      ? "Required before any booking, purchase, or external action."
                      : "No external action is available from this workflow."}
                  </p>
                </AnalysisSection>
              </aside>
            </div>

            <p className="agent-results-disclaimer">
              Safe mock response only; no live AI model was called. A
              diagnostic trouble code indicates a possible issue and does not
              confirm a faulty component or predict failure. A qualified
              mechanic must review findings and a human must approve any
              external action. This workflow does not book services or order
              parts.
            </p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
