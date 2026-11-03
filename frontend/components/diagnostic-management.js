"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./app-shell";
import { getSampleCodeKnowledge } from "../lib/diagnostic-sample-analysis";
import {
  createDiagnostic,
  fetchDiagnostics,
  resolveDiagnostic,
} from "../lib/diagnostics-api";
import { fetchVehicles } from "../lib/vehicles-api";

const severityOptions = ["Critical", "High", "Medium", "Low"];
const severityFilters = ["All", ...severityOptions];
const statusFilters = ["All", "Active", "Resolved"];
const sourceOptions = ["Manual", "OBD-II", "Telematics", "Other"];
const maximumOdometer = 2_000_000;

const emptyDiagnosticForm = {
  vehicleId: "",
  code: "",
  odometer: "",
  dateDetected: "",
  source: "Manual",
  severity: "",
  notes: "",
};

const requiredFields = {
  vehicleId: "Vehicle",
  code: "Diagnostic trouble code",
  odometer: "Odometer reading",
  dateDetected: "Date and time detected",
  severity: "Severity",
};

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

function toLocalDateTimeValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function normalizeCode(value) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function StatusBadge({ children, tone }) {
  return (
    <span className={`diagnostic-badge diagnostic-badge-${tone.toLowerCase()}`}>
      <span className="diagnostic-badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

function DiagnosticDialog({
  dialogRef,
  activeDialog,
  selectedRecord,
  vehicles,
  formValues,
  errors,
  formMessage,
  isSaving,
  isResolving,
  onChange,
  onSubmit,
  onClose,
  onResolve,
}) {
  const selectedVehicle = selectedRecord
    ? vehicles.find((vehicle) => vehicle.id === selectedRecord.vehicleId)
    : null;
  const explanation = selectedRecord
    ? getSampleCodeKnowledge(selectedRecord.code)
    : null;

  return (
    <dialog
      className="vehicle-dialog diagnostic-dialog"
      ref={dialogRef}
      aria-labelledby={
        activeDialog === "add"
          ? "add-diagnostic-title"
          : "diagnostic-details-title"
      }
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {activeDialog === "add" ? (
        <form className="vehicle-form" noValidate onSubmit={onSubmit}>
          <div className="dialog-heading">
            <div>
              <p className="eyebrow">FLEET DIAGNOSTICS</p>
              <h2 id="add-diagnostic-title">Add a diagnostic</h2>
              <p className="dialog-description">
                Record a trouble code for a vehicle. A code can indicate a
                possible issue; it does not confirm a faulty component.
              </p>
            </div>
            <button
              className="dialog-close"
              type="button"
              onClick={onClose}
              aria-label="Close add diagnostic form"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <p className="form-data-note">
            Records are saved to your account. A code is not confirmation of a
            faulty component.
          </p>
          {formMessage && (
            <p className="form-error-summary" role="alert">
              {formMessage}
            </p>
          )}

          <div className="vehicle-form-grid">
            <div className="form-field form-field-full">
              <label htmlFor="diagnostic-vehicle">
                Vehicle <span aria-hidden="true">*</span>
              </label>
              <select
                id="diagnostic-vehicle"
                name="vehicleId"
                required
                value={formValues.vehicleId}
                onChange={onChange}
                aria-invalid={Boolean(errors.vehicleId)}
                aria-describedby={
                  errors.vehicleId ? "diagnostic-vehicle-error" : undefined
                }
              >
                <option value="">Select a vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicleName} ({vehicle.registrationNumber})
                  </option>
                ))}
              </select>
              {errors.vehicleId && (
                <span className="field-error" id="diagnostic-vehicle-error">
                  {errors.vehicleId}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="diagnostic-code">
                Diagnostic trouble code (DTC){" "}
                <span aria-hidden="true">*</span>
              </label>
              <input
                id="diagnostic-code"
                name="code"
                required
                value={formValues.code}
                onChange={onChange}
                placeholder="Example: P0301 or SPN 3251"
                autoComplete="off"
                aria-invalid={Boolean(errors.code)}
                aria-describedby={
                  errors.code ? "diagnostic-code-error" : "diagnostic-code-help"
                }
              />
              <span className="field-help" id="diagnostic-code-help">
                Enter an OBD-II code (such as P0301) or an SPN code.
              </span>
              {errors.code && (
                <span className="field-error" id="diagnostic-code-error">
                  {errors.code}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="diagnostic-severity">
                Severity <span aria-hidden="true">*</span>
              </label>
              <select
                id="diagnostic-severity"
                name="severity"
                required
                value={formValues.severity}
                onChange={onChange}
                aria-invalid={Boolean(errors.severity)}
                aria-describedby={
                  errors.severity
                    ? "diagnostic-severity-error"
                    : undefined
                }
              >
                <option value="">Select severity</option>
                {severityOptions.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
              {errors.severity && (
                <span className="field-error" id="diagnostic-severity-error">
                  {errors.severity}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="diagnostic-odometer">
                Odometer reading
                {formValues.vehicleId
                  ? ` (${vehicles.find((vehicle) => vehicle.id === formValues.vehicleId)?.odometerUnit ?? "km"})`
                  : ""}
                <span aria-hidden="true"> *</span>
              </label>
              <input
                id="diagnostic-odometer"
                name="odometer"
                type="number"
                inputMode="numeric"
                min="0"
                max={maximumOdometer}
                step="1"
                required
                value={formValues.odometer}
                onChange={onChange}
                aria-invalid={Boolean(errors.odometer)}
                aria-describedby={
                  errors.odometer
                    ? "diagnostic-odometer-error"
                    : undefined
                }
              />
              {errors.odometer && (
                <span className="field-error" id="diagnostic-odometer-error">
                  {errors.odometer}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="diagnostic-date">
                Date and time detected <span aria-hidden="true">*</span>
              </label>
              <input
                id="diagnostic-date"
                name="dateDetected"
                type="datetime-local"
                max={toLocalDateTimeValue(new Date())}
                required
                value={formValues.dateDetected}
                onChange={onChange}
                aria-invalid={Boolean(errors.dateDetected)}
                aria-describedby={
                  errors.dateDetected ? "diagnostic-date-error" : undefined
                }
              />
              {errors.dateDetected && (
                <span className="field-error" id="diagnostic-date-error">
                  {errors.dateDetected}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="diagnostic-source">Source</label>
              <select
                id="diagnostic-source"
                name="source"
                value={formValues.source}
                onChange={onChange}
              >
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="diagnostic-notes">Notes (optional)</label>
              <textarea
                id="diagnostic-notes"
                name="notes"
                rows="3"
                value={formValues.notes}
                onChange={onChange}
                placeholder="Add any context provided by the driver or telematics system."
              />
            </div>
          </div>

          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-action" type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Add Diagnostic"}
            </button>
          </div>
        </form>
      ) : (
        selectedRecord && (
          <section
            className="vehicle-details"
            aria-labelledby="diagnostic-details-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">DIAGNOSTIC RECORD</p>
                <h2 id="diagnostic-details-title">{selectedRecord.code}</h2>
                <p className="dialog-description">
                  {selectedRecord.vehicleName || selectedVehicle?.vehicleName} ·{" "}
                  {selectedRecord.registrationNumber ||
                    selectedVehicle?.registrationNumber}
                </p>
              </div>
              <button
                className="dialog-close"
                type="button"
                onClick={onClose}
                aria-label="Close diagnostic details"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="diagnostic-detail-status">
              <StatusBadge tone={selectedRecord.severity}>
                {selectedRecord.severity} severity
              </StatusBadge>
              <StatusBadge tone={selectedRecord.status}>
                {selectedRecord.status}
              </StatusBadge>
            </div>

            <dl className="vehicle-details-grid">
              <div>
                <dt>Issue summary</dt>
                <dd>{selectedRecord.issueDescription}</dd>
              </div>
              <div>
                <dt>Date detected</dt>
                <dd>{formatDate(selectedRecord.dateDetected)}</dd>
              </div>
              <div>
                <dt>Odometer</dt>
                <dd>
                  {formatOdometer(selectedRecord.odometer)}{" "}
                  {selectedRecord.odometerUnit}
                </dd>
              </div>
              <div>
                <dt>Vehicle</dt>
                <dd>
                  {selectedRecord.vehicleName || selectedVehicle?.vehicleName} (
                  {selectedRecord.registrationNumber ||
                    selectedVehicle?.registrationNumber}
                  )
                </dd>
              </div>
              {selectedRecord.notes && (
                <div className="vehicle-detail-full">
                  <dt>Notes</dt>
                  <dd>{selectedRecord.notes}</dd>
                </div>
              )}
              <div>
                <dt>Source</dt>
                <dd>{selectedRecord.source}</dd>
              </div>
            </dl>

            {explanation ? (
              <section
                className="code-explanation"
                aria-labelledby="code-explanation-title"
              >
                <p className="eyebrow">SAMPLE CODE REFERENCE</p>
                <h3 id="code-explanation-title">{explanation.title}</h3>
                <p>{explanation.explanation}</p>
                <p className="diagnostic-caveat">
                  A diagnostic code indicates a possible issue, not a confirmed
                  faulty component. This sample explanation is not a mechanic
                  diagnosis.
                </p>
                <h4>Possible causes</h4>
                <ul>
                  {explanation.possibleCauses.map((cause) => (
                    <li key={cause}>{cause}</li>
                  ))}
                </ul>
                <h4>Recommended action</h4>
                <p>
                  {explanation.recommendedNextSteps?.[0] ??
                    "Have a qualified mechanic inspect the vehicle before repairs."}
                </p>
              </section>
            ) : (
              <p className="diagnostic-caveat">
                A diagnostic code indicates a possible issue, not a confirmed
                faulty component. Have a qualified mechanic inspect the vehicle
                before deciding on repairs.
              </p>
            )}

            <div className="dialog-actions">
              {selectedRecord.status === "Active" && (
                <button
                  className="secondary-button resolve-button"
                  type="button"
                  disabled={isResolving}
                  onClick={() => onResolve(selectedRecord.id)}
                >
                  {isResolving ? "Saving..." : "Mark as resolved"}
                </button>
              )}
              <button
                className="primary-action"
                type="button"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </section>
        )
      )}
    </dialog>
  );
}

function RecordActions({
  record,
  onView,
  onResolve,
  isResolving,
}) {
  return (
    <div className="diagnostic-record-actions">
      <button
        className="text-action"
        type="button"
        onClick={(event) => onView(record, event)}
        aria-label={`View details for ${record.code} on ${record.vehicleName}`}
      >
        View details
      </button>
      {record.status === "Active" && (
        <button
          className="diagnostic-resolve-link"
          type="button"
          disabled={isResolving}
          onClick={() => onResolve(record.id)}
          aria-label={`Mark ${record.code} for ${record.vehicleName} as resolved`}
        >
          {isResolving ? "Saving..." : "Mark resolved"}
        </button>
      )}
    </div>
  );
}

export default function DiagnosticManagement() {
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [resolvingRecordId, setResolvingRecordId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeDialog, setActiveDialog] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [formValues, setFormValues] = useState(emptyDiagnosticForm);
  const [errors, setErrors] = useState({});
  const [formMessage, setFormMessage] = useState("");

  const dialogRef = useRef(null);
  const lastTriggerRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setIsLoading(true);
      setLoadError("");
      setPageNotice("");
      try {
        const [loadedVehicles, loadedRecords] = await Promise.all([
          fetchVehicles({ signal: controller.signal }),
          fetchDiagnostics({ signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) {
          setVehicles(loadedVehicles);
          setRecords(loadedRecords);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error.message || "Unable to load diagnostics. Please try again.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadData();
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (activeDialog && !dialog.open) {
      dialog.showModal();
      dialog
        .querySelector(
          activeDialog === "add" ? "#diagnostic-vehicle" : ".dialog-close",
        )
        ?.focus();
    } else if (!activeDialog && dialog.open) {
      dialog.close();
    }
  }, [activeDialog]);

  useEffect(() => {
    if (!activeDialog) lastTriggerRef.current?.focus();
  }, [activeDialog]);

  const visibleRecords = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();

    return records.filter((record) => {
      const matchesQuery =
        !query ||
        (record.vehicleName || "Unknown vehicle")
          .toLocaleLowerCase()
          .includes(query) ||
        (record.registrationNumber || "")
          .toLocaleLowerCase()
          .includes(query) ||
        record.code.toLocaleLowerCase().includes(query);
      const matchesSeverity =
        severityFilter === "All" || record.severity === severityFilter;
      const matchesStatus =
        statusFilter === "All" || record.status === statusFilter;

      return matchesQuery && matchesSeverity && matchesStatus;
    });
  }, [records, searchQuery, severityFilter, statusFilter]);

  const criticalCount = records.filter(
    (record) => record.severity === "Critical",
  ).length;
  const activeCount = records.filter(
    (record) => record.status === "Active",
  ).length;

  function openAddDialog(event) {
    lastTriggerRef.current = event.currentTarget;
    setSelectedRecord(null);
    setFormValues(emptyDiagnosticForm);
    setErrors({});
    setFormMessage("");
    setActiveDialog("add");
  }

  function openDetails(record, event) {
    lastTriggerRef.current = event.currentTarget;
    setSelectedRecord(record);
    setActiveDialog("details");
  }

  function closeDialog() {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    } else {
      setActiveDialog(null);
    }
  }

  function handleDialogClose() {
    setActiveDialog(null);
    setSelectedRecord(null);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setFormMessage("");
  }

  function validateForm() {
    const nextErrors = {};
    const trimmedValues = Object.fromEntries(
      Object.entries(formValues).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ]),
    );

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!trimmedValues[field]) nextErrors[field] = `${label} is required.`;
    }

    if (
      trimmedValues.code &&
      !/^(?:[PBCU][0-3][0-9A-F]{3}|SPN\s?\d{1,5}(?:\s+FMI\s?\d{1,2})?)$/i.test(
        trimmedValues.code,
      )
    ) {
      nextErrors.code =
        "Enter a valid OBD-II code (for example P0301) or SPN code (for example SPN 3251).";
    }

    if (trimmedValues.odometer) {
      const odometer = Number(trimmedValues.odometer);
      if (
        !Number.isInteger(odometer) ||
        odometer < 0 ||
        odometer > maximumOdometer
      ) {
        nextErrors.odometer = `Enter a whole number from 0 to ${formatOdometer(maximumOdometer)}.`;
      }
    }

    if (trimmedValues.dateDetected) {
      const detectedAt = new Date(trimmedValues.dateDetected);
      if (Number.isNaN(detectedAt.getTime()) || detectedAt > new Date()) {
        nextErrors.dateDetected =
          "Date and time detected must be valid and cannot be in the future.";
      }
    }

    setErrors(nextErrors);
    return { nextErrors, trimmedValues };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const { nextErrors, trimmedValues } = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setFormMessage("Check the highlighted fields and try again.");
      const inputIds = {
        vehicleId: "diagnostic-vehicle",
        code: "diagnostic-code",
        odometer: "diagnostic-odometer",
        dateDetected: "diagnostic-date",
        severity: "diagnostic-severity",
      };
      const firstInvalidField = Object.keys(requiredFields).find((field) =>
        nextErrors[field],
      );
      document.getElementById(inputIds[firstInvalidField])?.focus();
      return;
    }

    const code = normalizeCode(trimmedValues.code);
    const vehicle = vehicles.find(
      (item) => item.id === trimmedValues.vehicleId,
    );
    if (!vehicle) {
      setFormMessage("Select a vehicle that belongs to your account.");
      return;
    }

    setIsSaving(true);
    setFormMessage("");
    try {
      const createdRecord = await createDiagnostic({
        vehicleId: vehicle.id,
        code,
        severity: trimmedValues.severity,
        dateDetected: new Date(trimmedValues.dateDetected).toISOString(),
        odometer: Number(trimmedValues.odometer),
        odometerUnit: vehicle.odometerUnit,
        source: trimmedValues.source,
        notes: trimmedValues.notes,
      });
      setRecords((current) => [createdRecord, ...current]);
      setSearchQuery("");
      setSeverityFilter("All");
      setStatusFilter("All");
      setPageNotice("Diagnostic record saved.");
      closeDialog();
    } catch (error) {
      setFormMessage(
        error.message || "Unable to save the diagnostic record. Please retry.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function markResolved(recordId) {
    if (resolvingRecordId) return;
    setResolvingRecordId(recordId);
    setLoadError("");
    setPageNotice("");
    try {
      const updatedRecord = await resolveDiagnostic(recordId);
      setRecords((current) =>
        current.map((record) =>
          record.id === recordId ? updatedRecord : record,
        ),
      );
      setSelectedRecord((current) =>
        current?.id === recordId ? updatedRecord : current,
      );
      setPageNotice("Diagnostic record marked as resolved.");
    } catch (error) {
      setLoadError(
        error.message || "Unable to update the diagnostic record. Please retry.",
      );
    } finally {
      setResolvingRecordId(null);
    }
  }

  return (
    <AppShell title="Diagnostics" showPageHeading={false}>
      <div className="diagnostic-management">
        <header className="diagnostic-page-header">
          <div>
            <h1 className="page-heading diagnostic-page-title">Diagnostics</h1>
            <p className="diagnostic-page-description">
              Review vehicle trouble codes and keep a clear record of issues for
              mechanic follow-up.
            </p>
            <p className="diagnostic-data-note">
              Records are stored for your account. Severity is a recorded
              assessment, not a confirmed mechanical fault.
            </p>
          </div>
          <button
            className="primary-action"
            type="button"
            onClick={openAddDialog}
            disabled={isLoading || vehicles.length === 0}
          >
            <span aria-hidden="true">+</span>
            Add Diagnostic
          </button>
        </header>

        {loadError && (
          <div className="diagnostic-request-message" role="alert">
            <span>{loadError}</span>
            <button
              className="text-action"
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              Retry
            </button>
          </div>
        )}
        {pageNotice && (
          <p className="diagnostic-success-message" role="status">
            {pageNotice}
          </p>
        )}
        {!isLoading && !loadError && vehicles.length === 0 && (
          <p className="diagnostic-request-message" role="status">
            Add a vehicle before recording a diagnostic.
          </p>
        )}

        <section
          className="diagnostic-summary-grid"
          aria-label="Diagnostic summaries"
        >
          <article className="diagnostic-summary-card">
            <span className="diagnostic-summary-label">Total records</span>
            <strong>{records.length}</strong>
            <span className="diagnostic-summary-detail">
              Across your fleet
            </span>
          </article>
          <article className="diagnostic-summary-card diagnostic-summary-critical">
            <span className="diagnostic-summary-label">Critical issues</span>
            <strong>{criticalCount}</strong>
            <span className="diagnostic-summary-detail">
              {criticalCount === 1 ? "Record" : "Records"} marked critical
            </span>
          </article>
          <article className="diagnostic-summary-card diagnostic-summary-active">
            <span className="diagnostic-summary-label">Active issues</span>
            <strong>{activeCount}</strong>
            <span className="diagnostic-summary-detail">
              Awaiting mechanic review
            </span>
          </article>
        </section>

        <section
          className="diagnostic-list-panel"
          aria-labelledby="diagnostic-records-title"
        >
          <div className="diagnostic-list-heading">
            <div>
              <h2 id="diagnostic-records-title">Diagnostic records</h2>
              <p>Search and filter the recorded vehicle issues.</p>
            </div>
            <span className="diagnostic-result-count" aria-live="polite">
              Showing {visibleRecords.length} of {records.length}
            </span>
          </div>

          <div className="diagnostic-toolbar">
            <div className="vehicle-search-field diagnostic-search-field">
              <label className="sr-only" htmlFor="diagnostic-search">
                Search by vehicle name, registration number, or diagnostic code
              </label>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                focusable="false"
              >
                <circle
                  cx="10.8"
                  cy="10.8"
                  r="6.8"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path
                  d="m16 16 4 4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
              <input
                id="diagnostic-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search vehicle or diagnostic code"
              />
            </div>
            <div className="vehicle-filter-field">
              <label htmlFor="diagnostic-severity-filter">Severity</label>
              <select
                id="diagnostic-severity-filter"
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
              >
                {severityFilters.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity === "All" ? "All severities" : severity}
                  </option>
                ))}
              </select>
            </div>
            <div className="vehicle-filter-field">
              <label htmlFor="diagnostic-status-filter">Status</label>
              <select
                id="diagnostic-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                {statusFilters.map((status) => (
                  <option key={status} value={status}>
                    {status === "All" ? "All statuses" : status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="vehicle-empty-state" role="status">
              Loading diagnostic records...
            </div>
          ) : visibleRecords.length > 0 ? (
            <>
              <div className="diagnostic-table-wrap">
                <table className="diagnostic-table">
                  <caption className="sr-only">
                    Diagnostic records for fleet vehicles
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Vehicle</th>
                      <th scope="col">Diagnostic code</th>
                      <th scope="col">Issue summary</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Date detected</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <span className="diagnostic-vehicle-name">
                            {record.vehicleName}
                          </span>
                          <span className="diagnostic-registration">
                            {record.registrationNumber}
                          </span>
                        </td>
                        <td>
                          <span className="diagnostic-code">
                            {record.code}
                          </span>
                        </td>
                        <td className="diagnostic-table-issue">
                          {record.issueDescription}
                        </td>
                        <td>
                          <StatusBadge tone={record.severity}>
                            {record.severity}
                          </StatusBadge>
                        </td>
                        <td>
                          <time dateTime={record.dateDetected}>
                            {formatDate(record.dateDetected)}
                          </time>
                        </td>
                        <td>
                          <StatusBadge tone={record.status}>
                            {record.status}
                          </StatusBadge>
                        </td>
                        <td>
                          <RecordActions
                            record={record}
                            onView={openDetails}
                            onResolve={markResolved}
                            isResolving={resolvingRecordId === record.id}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul
                className="diagnostic-mobile-list"
                aria-label="Diagnostic records"
              >
                {visibleRecords.map((record) => (
                  <li className="diagnostic-mobile-card" key={record.id}>
                    <article
                      aria-labelledby={`mobile-diagnostic-${record.id}`}
                    >
                      <div className="diagnostic-mobile-card-heading">
                        <div>
                          <h3 id={`mobile-diagnostic-${record.id}`}>
                            {record.vehicleName}
                          </h3>
                          <span className="diagnostic-registration">
                            {record.registrationNumber}
                          </span>
                        </div>
                        <StatusBadge tone={record.severity}>
                          {record.severity}
                        </StatusBadge>
                      </div>
                      <p className="diagnostic-mobile-code">
                        <span className="diagnostic-code">{record.code}</span>
                        <StatusBadge tone={record.status}>
                          {record.status}
                        </StatusBadge>
                      </p>
                      <p className="diagnostic-mobile-issue">
                        {record.issueDescription}
                      </p>
                      <time
                        className="diagnostic-mobile-date"
                        dateTime={record.dateDetected}
                      >
                        Detected {formatDate(record.dateDetected)}
                      </time>
                      <RecordActions
                        record={record}
                        onView={openDetails}
                        onResolve={markResolved}
                        isResolving={resolvingRecordId === record.id}
                      />
                    </article>
                  </li>
                ))}
              </ul>
            </>
          ) : !loadError ? (
            <div className="vehicle-empty-state" role="status">
              <span className="empty-state-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="10.8"
                    cy="10.8"
                    r="6.8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="m16 16 4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <h3>No diagnostic records found</h3>
              <p>
                {records.length === 0
                  ? "No diagnostic records have been saved yet."
                  : "Try another search or filter, or clear them to see all diagnostic records."}
              </p>
              {records.length > 0 && (
                <button
                  className="text-action"
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSeverityFilter("All");
                    setStatusFilter("All");
                  }}
                >
                  Clear search and filters
                </button>
              )}
            </div>
          ) : null}
        </section>

        <p className="diagnostic-safety-note">
          Diagnostic trouble codes indicate possible issues and do not confirm a
          faulty component. Sample explanations are general references, not
          mechanic diagnoses. Have a qualified mechanic inspect the vehicle.
        </p>

        <DiagnosticDialog
          dialogRef={dialogRef}
          activeDialog={activeDialog}
          selectedRecord={selectedRecord}
          vehicles={vehicles}
          formValues={formValues}
          errors={errors}
          formMessage={formMessage}
          isSaving={isSaving}
          isResolving={resolvingRecordId === selectedRecord?.id}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={closeDialog}
          onResolve={markResolved}
        />
      </div>
    </AppShell>
  );
}
