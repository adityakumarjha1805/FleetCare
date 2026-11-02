"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./app-shell";
import { initialVehicleData } from "./mock-fleet-data";

const severityOptions = ["Critical", "High", "Medium", "Low"];
const severityFilters = ["All", ...severityOptions];
const statusFilters = ["All", "Active", "Resolved"];
const maximumOdometerKm = 2_000_000;

const diagnosticExplanations = {
  P0301: {
    title: "Cylinder 1 Misfire Detected",
    explanation:
      "The engine control system has detected a misfire associated with cylinder 1.",
    possibleCauses: [
      "Faulty spark plug.",
      "Ignition coil issue.",
      "Fuel delivery problem.",
    ],
    recommendedAction: "Arrange a qualified mechanic inspection.",
  },
};

const sampleDiagnosticData = [
  {
    id: "diagnostic-001",
    vehicleId: "vehicle-003",
    code: "P0301",
    issueDescription: "Cylinder 1 misfire detected",
    severity: "Critical",
    dateDetected: "2026-10-30",
    odometerKm: 184520,
    notes: "Driver reported intermittent engine vibration.",
    status: "Active",
  },
  {
    id: "diagnostic-002",
    vehicleId: "vehicle-001",
    code: "P0420",
    issueDescription: "Catalyst system efficiency below threshold",
    severity: "High",
    dateDetected: "2026-10-28",
    odometerKm: 48210,
    notes: "",
    status: "Active",
  },
  {
    id: "diagnostic-003",
    vehicleId: "vehicle-005",
    code: "SPN 3251",
    issueDescription: "Diesel particulate filter soot level high",
    severity: "Medium",
    dateDetected: "2026-10-26",
    odometerKm: 236840,
    notes: "Sample telematics event.",
    status: "Active",
  },
  {
    id: "diagnostic-004",
    vehicleId: "vehicle-002",
    code: "P0171",
    issueDescription: "System too lean, bank 1",
    severity: "Low",
    dateDetected: "2026-10-22",
    odometerKm: 76240,
    notes: "",
    status: "Resolved",
  },
  {
    id: "diagnostic-005",
    vehicleId: "vehicle-004",
    code: "P0301",
    issueDescription: "Cylinder 1 misfire detected",
    severity: "High",
    dateDetected: "2026-10-20",
    odometerKm: 21680,
    notes: "Previously recorded sample diagnostic.",
    status: "Resolved",
  },
];

const emptyDiagnosticForm = {
  vehicleId: "",
  code: "",
  odometerKm: "",
  dateDetected: "",
  severity: "",
  notes: "",
};

const requiredFields = {
  vehicleId: "Vehicle",
  code: "Diagnostic trouble code",
  odometerKm: "Odometer reading",
  dateDetected: "Date detected",
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
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
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
  formValues,
  errors,
  formMessage,
  onChange,
  onSubmit,
  onClose,
  onResolve,
}) {
  const selectedVehicle = selectedRecord
    ? initialVehicleData.find(
        (vehicle) => vehicle.id === selectedRecord.vehicleId,
      )
    : null;
  const explanation = selectedRecord
    ? diagnosticExplanations[selectedRecord.code]
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
            Sample records are temporary frontend data and are not mechanic
            diagnoses.
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
                {initialVehicleData.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} ({vehicle.registrationNumber})
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
                Odometer reading (km) <span aria-hidden="true">*</span>
              </label>
              <input
                id="diagnostic-odometer"
                name="odometerKm"
                type="number"
                inputMode="numeric"
                min="0"
                max={maximumOdometerKm}
                step="1"
                required
                value={formValues.odometerKm}
                onChange={onChange}
                aria-invalid={Boolean(errors.odometerKm)}
                aria-describedby={
                  errors.odometerKm
                    ? "diagnostic-odometer-error"
                    : undefined
                }
              />
              {errors.odometerKm && (
                <span className="field-error" id="diagnostic-odometer-error">
                  {errors.odometerKm}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="diagnostic-date">
                Date detected <span aria-hidden="true">*</span>
              </label>
              <input
                id="diagnostic-date"
                name="dateDetected"
                type="date"
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
            <button className="primary-action" type="submit">
              Add Diagnostic
            </button>
          </div>
        </form>
      ) : (
        selectedRecord &&
        selectedVehicle && (
          <section
            className="vehicle-details"
            aria-labelledby="diagnostic-details-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">DIAGNOSTIC RECORD</p>
                <h2 id="diagnostic-details-title">{selectedRecord.code}</h2>
                <p className="dialog-description">
                  {selectedVehicle.name} · {selectedVehicle.registrationNumber}
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
                <dd>{formatOdometer(selectedRecord.odometerKm)} km</dd>
              </div>
              <div>
                <dt>Vehicle</dt>
                <dd>
                  {selectedVehicle.name} ({selectedVehicle.registrationNumber})
                </dd>
              </div>
              {selectedRecord.notes && (
                <div className="vehicle-detail-full">
                  <dt>Notes</dt>
                  <dd>{selectedRecord.notes}</dd>
                </div>
              )}
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
                <p>{explanation.recommendedAction}</p>
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
                  onClick={() => onResolve(selectedRecord.id)}
                >
                  Mark as resolved
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

function RecordActions({ record, onView, onResolve }) {
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
          onClick={() => onResolve(record.id)}
          aria-label={`Mark ${record.code} for ${record.vehicleName} as resolved`}
        >
          Mark resolved
        </button>
      )}
    </div>
  );
}

export default function DiagnosticManagement() {
  const [records, setRecords] = useState(sampleDiagnosticData);
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

  const recordsWithVehicles = useMemo(
    () =>
      records.map((record) => {
        const vehicle = initialVehicleData.find(
          (item) => item.id === record.vehicleId,
        );

        return {
          ...record,
          vehicleName: vehicle?.name ?? "Unknown vehicle",
          registrationNumber: vehicle?.registrationNumber ?? "—",
        };
      }),
    [records],
  );

  const visibleRecords = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();

    return recordsWithVehicles.filter((record) => {
      const matchesQuery =
        !query ||
        record.vehicleName.toLocaleLowerCase().includes(query) ||
        record.registrationNumber.toLocaleLowerCase().includes(query) ||
        record.code.toLocaleLowerCase().includes(query);
      const matchesSeverity =
        severityFilter === "All" || record.severity === severityFilter;
      const matchesStatus =
        statusFilter === "All" || record.status === statusFilter;

      return matchesQuery && matchesSeverity && matchesStatus;
    });
  }, [recordsWithVehicles, searchQuery, severityFilter, statusFilter]);

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
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

    if (trimmedValues.odometerKm) {
      const odometerKm = Number(trimmedValues.odometerKm);
      if (
        !Number.isInteger(odometerKm) ||
        odometerKm < 0 ||
        odometerKm > maximumOdometerKm
      ) {
        nextErrors.odometerKm = `Enter a whole number from 0 to ${formatOdometer(maximumOdometerKm)} km.`;
      }
    }

    if (
      trimmedValues.dateDetected &&
      trimmedValues.dateDetected > today
    ) {
      nextErrors.dateDetected = "Date detected cannot be in the future.";
    }

    setErrors(nextErrors);
    return { nextErrors, trimmedValues };
  }

  function handleSubmit(event) {
    event.preventDefault();
    const { nextErrors, trimmedValues } = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setFormMessage("Check the highlighted fields and try again.");
      const inputIds = {
        vehicleId: "diagnostic-vehicle",
        code: "diagnostic-code",
        odometerKm: "diagnostic-odometer",
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
    const newRecord = {
      id: `diagnostic-${globalThis.crypto.randomUUID()}`,
      vehicleId: trimmedValues.vehicleId,
      code,
      issueDescription:
        diagnosticExplanations[code]?.title ??
        "Diagnostic code recorded for mechanic review",
      severity: trimmedValues.severity,
      dateDetected: trimmedValues.dateDetected,
      odometerKm: Number(trimmedValues.odometerKm),
      notes: trimmedValues.notes,
      status: "Active",
    };

    setRecords((current) => [newRecord, ...current]);
    setSearchQuery("");
    setSeverityFilter("All");
    setStatusFilter("All");
    closeDialog();
  }

  function markResolved(recordId) {
    setRecords((current) =>
      current.map((record) =>
        record.id === recordId ? { ...record, status: "Resolved" } : record,
      ),
    );
    setSelectedRecord((current) =>
      current?.id === recordId ? { ...current, status: "Resolved" } : current,
    );
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
              Sample diagnostic records; updates are temporary frontend data
              for this page session.
            </p>
          </div>
          <button
            className="primary-action"
            type="button"
            onClick={openAddDialog}
          >
            <span aria-hidden="true">+</span>
            Add Diagnostic
          </button>
        </header>

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

          {visibleRecords.length > 0 ? (
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
                      />
                    </article>
                  </li>
                ))}
              </ul>
            </>
          ) : (
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
                Try another search or filter, or clear them to see all
                diagnostic records.
              </p>
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
            </div>
          )}
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
          formValues={formValues}
          errors={errors}
          formMessage={formMessage}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={closeDialog}
          onResolve={markResolved}
        />
      </div>
    </AppShell>
  );
}
