"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./app-shell";
import { initialVehicleData } from "./mock-fleet-data";

const maintenanceTypes = [
  "Oil change",
  "Tire rotation",
  "Brake inspection",
  "General servicing",
  "Other",
];
const maintenanceStatuses = ["Upcoming", "Overdue", "Completed"];
const maximumOdometerKm = 2_000_000;

const sampleMaintenanceData = [
  {
    id: "maintenance-001",
    vehicleId: "vehicle-001",
    type: "Oil change",
    description: "Scheduled engine oil and filter replacement.",
    maintenanceDate: "2026-11-12",
    odometerKm: 48210,
    status: "Upcoming",
  },
  {
    id: "maintenance-002",
    vehicleId: "vehicle-002",
    type: "Tire rotation",
    description: "Rotate tires and check tread wear.",
    maintenanceDate: "2026-10-20",
    odometerKm: 76240,
    status: "Overdue",
  },
  {
    id: "maintenance-003",
    vehicleId: "vehicle-003",
    type: "Brake inspection",
    description: "Inspect pads, rotors, and brake fluid.",
    maintenanceDate: "2026-10-24",
    odometerKm: 184520,
    status: "Completed",
  },
  {
    id: "maintenance-004",
    vehicleId: "vehicle-004",
    type: "General servicing",
    description: "Routine service and multi-point vehicle check.",
    maintenanceDate: "2026-11-02",
    odometerKm: 21680,
    status: "Upcoming",
  },
  {
    id: "maintenance-005",
    vehicleId: "vehicle-005",
    type: "Oil change",
    description: "Replace engine oil and inspect fluid levels.",
    maintenanceDate: "2026-10-18",
    odometerKm: 236840,
    status: "Completed",
  },
];

const emptyMaintenanceForm = {
  vehicleId: "",
  type: "",
  description: "",
  maintenanceDate: "",
  odometerKm: "",
  status: "",
};

const requiredFields = {
  vehicleId: "Vehicle",
  type: "Maintenance type",
  description: "Description",
  maintenanceDate: "Maintenance date",
  odometerKm: "Odometer reading",
  status: "Status",
};

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentStatus(record, today) {
  if (record.status === "Completed") return "Completed";
  if (!today) return record.status;
  return record.maintenanceDate < today ? "Overdue" : "Upcoming";
}

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

function MaintenanceStatusBadge({ status }) {
  return (
    <span
      className={`maintenance-status-badge maintenance-status-${status.toLowerCase()}`}
    >
      <span className="diagnostic-badge-dot" aria-hidden="true" />
      {status}
    </span>
  );
}

function MaintenanceDialog({
  dialogRef,
  activeDialog,
  selectedRecord,
  formValues,
  errors,
  formMessage,
  today,
  onChange,
  onSubmit,
  onClose,
  onComplete,
}) {
  const selectedVehicle = selectedRecord
    ? initialVehicleData.find(
        (vehicle) => vehicle.id === selectedRecord.vehicleId,
      )
    : null;

  return (
    <dialog
      className="vehicle-dialog maintenance-dialog"
      ref={dialogRef}
      aria-labelledby={
        activeDialog === "add"
          ? "add-maintenance-title"
          : "maintenance-details-title"
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
              <p className="eyebrow">FLEET MANAGEMENT</p>
              <h2 id="add-maintenance-title">Add maintenance record</h2>
              <p className="dialog-description">
                Record scheduled or completed work for a fleet vehicle.
              </p>
            </div>
            <button
              className="dialog-close"
              type="button"
              onClick={onClose}
              aria-label="Close add maintenance form"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <p className="form-data-note">
            Sample maintenance records and new entries are temporary frontend
            data for this page session.
          </p>
          {formMessage && (
            <p className="form-error-summary" role="alert">
              {formMessage}
            </p>
          )}

          <div className="vehicle-form-grid">
            <div className="form-field form-field-full">
              <label htmlFor="maintenance-vehicle">
                Vehicle <span aria-hidden="true">*</span>
              </label>
              <select
                autoFocus
                id="maintenance-vehicle"
                name="vehicleId"
                required
                value={formValues.vehicleId}
                onChange={onChange}
                aria-invalid={Boolean(errors.vehicleId)}
                aria-describedby={
                  errors.vehicleId ? "maintenance-vehicle-error" : undefined
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
                <span className="field-error" id="maintenance-vehicle-error">
                  {errors.vehicleId}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="maintenance-type">
                Maintenance type <span aria-hidden="true">*</span>
              </label>
              <select
                id="maintenance-type"
                name="type"
                required
                value={formValues.type}
                onChange={onChange}
                aria-invalid={Boolean(errors.type)}
                aria-describedby={
                  errors.type ? "maintenance-type-error" : undefined
                }
              >
                <option value="">Select a type</option>
                {maintenanceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {errors.type && (
                <span className="field-error" id="maintenance-type-error">
                  {errors.type}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="maintenance-date">
                Maintenance date <span aria-hidden="true">*</span>
              </label>
              <input
                id="maintenance-date"
                name="maintenanceDate"
                type="date"
                required
                value={formValues.maintenanceDate}
                onChange={onChange}
                aria-invalid={Boolean(errors.maintenanceDate)}
                aria-describedby={
                  errors.maintenanceDate
                    ? "maintenance-date-error"
                    : undefined
                }
              />
              {errors.maintenanceDate && (
                <span className="field-error" id="maintenance-date-error">
                  {errors.maintenanceDate}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="maintenance-odometer">
                Odometer reading (km) <span aria-hidden="true">*</span>
              </label>
              <input
                id="maintenance-odometer"
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
                  errors.odometerKm ? "maintenance-odometer-error" : undefined
                }
              />
              {errors.odometerKm && (
                <span className="field-error" id="maintenance-odometer-error">
                  {errors.odometerKm}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="maintenance-status">
                Status <span aria-hidden="true">*</span>
              </label>
              <select
                id="maintenance-status"
                name="status"
                required
                value={formValues.status}
                onChange={onChange}
                aria-invalid={Boolean(errors.status)}
                aria-describedby={
                  errors.status
                    ? "maintenance-status-error"
                    : "maintenance-status-help"
                }
              >
                <option value="">Select status</option>
                {maintenanceStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <span className="field-help" id="maintenance-status-help">
                Scheduled status follows the date; past dates are overdue.
              </span>
              {errors.status && (
                <span className="field-error" id="maintenance-status-error">
                  {errors.status}
                </span>
              )}
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="maintenance-description">
                Description <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="maintenance-description"
                name="description"
                rows="3"
                required
                value={formValues.description}
                onChange={onChange}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description
                    ? "maintenance-description-error"
                    : undefined
                }
                placeholder="Describe the planned or completed maintenance."
              />
              {errors.description && (
                <span
                  className="field-error"
                  id="maintenance-description-error"
                >
                  {errors.description}
                </span>
              )}
            </div>
          </div>

          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-action" type="submit">
              Add Maintenance Record
            </button>
          </div>
        </form>
      ) : (
        selectedRecord &&
        selectedVehicle && (
          <section
            className="vehicle-details"
            aria-labelledby="maintenance-details-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">MAINTENANCE RECORD</p>
                <h2 id="maintenance-details-title">{selectedRecord.type}</h2>
                <p className="dialog-description">
                  {selectedVehicle.name} · {selectedVehicle.registrationNumber}
                </p>
              </div>
              <button
                className="dialog-close"
                type="button"
                onClick={onClose}
                aria-label="Close maintenance details"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="maintenance-detail-status">
              <MaintenanceStatusBadge status={getCurrentStatus(selectedRecord, today)} />
            </div>

            <dl className="vehicle-details-grid">
              <div>
                <dt>Description</dt>
                <dd>{selectedRecord.description}</dd>
              </div>
              <div>
                <dt>
                  {selectedRecord.status === "Completed"
                    ? "Completed date"
                    : "Scheduled date"}
                </dt>
                <dd>{formatDate(selectedRecord.maintenanceDate)}</dd>
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
            </dl>

            <div className="dialog-actions">
              {selectedRecord.status !== "Completed" && (
                <button
                  className="secondary-button resolve-button"
                  type="button"
                  onClick={() => onComplete(selectedRecord.id)}
                >
                  Mark as completed
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

function MaintenanceActions({ record, onView, onComplete }) {
  return (
    <div className="maintenance-record-actions">
      <button
        className="text-action"
        type="button"
        onClick={(event) => onView(record, event)}
        aria-label={`View details for ${record.type} on ${record.vehicleName}`}
      >
        View details
      </button>
      {record.status !== "Completed" && (
        <button
          className="maintenance-complete-link"
          type="button"
          onClick={() => onComplete(record.id)}
          aria-label={`Mark ${record.type} for ${record.vehicleName} as completed`}
        >
          Mark completed
        </button>
      )}
    </div>
  );
}

export default function MaintenanceManagement() {
  const [records, setRecords] = useState(sampleMaintenanceData);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [activeDialog, setActiveDialog] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [formValues, setFormValues] = useState(emptyMaintenanceForm);
  const [errors, setErrors] = useState({});
  const [formMessage, setFormMessage] = useState("");
  const [today, setToday] = useState(null);

  const dialogRef = useRef(null);
  const lastTriggerRef = useRef(null);

  useEffect(() => {
    const updateToday = () => setToday(getLocalDateString(new Date()));
    const timer = window.setTimeout(updateToday, 0);
    window.addEventListener("focus", updateToday);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", updateToday);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (activeDialog && !dialog.open) {
      dialog.showModal();
      dialog
        .querySelector(
          activeDialog === "add" ? "#maintenance-vehicle" : ".dialog-close",
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
          currentStatus: getCurrentStatus(record, today),
        };
      }),
    [records, today],
  );

  const visibleRecords = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();

    return recordsWithVehicles.filter((record) => {
      const matchesQuery =
        !query ||
        record.vehicleName.toLocaleLowerCase().includes(query) ||
        record.registrationNumber.toLocaleLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "All" || record.currentStatus === statusFilter;
      const matchesType = typeFilter === "All" || record.type === typeFilter;

      return matchesQuery && matchesStatus && matchesType;
    });
  }, [recordsWithVehicles, searchQuery, statusFilter, typeFilter]);

  const statusCounts = recordsWithVehicles.reduce(
    (counts, record) => {
      counts[record.currentStatus] += 1;
      return counts;
    },
    { Upcoming: 0, Overdue: 0, Completed: 0 },
  );

  function openAddDialog(event) {
    lastTriggerRef.current = event.currentTarget;
    setSelectedRecord(null);
    setFormValues(emptyMaintenanceForm);
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
    const values = Object.fromEntries(
      Object.entries(formValues).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ]),
    );

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!values[field]) nextErrors[field] = `${label} is required.`;
    }

    if (
      values.type &&
      !maintenanceTypes.includes(values.type)
    ) {
      nextErrors.type = "Select a maintenance type from the list.";
    }

    if (values.odometerKm) {
      const odometerKm = Number(values.odometerKm);
      if (
        !Number.isInteger(odometerKm) ||
        odometerKm < 0 ||
        odometerKm > maximumOdometerKm
      ) {
        nextErrors.odometerKm = `Enter a whole number from 0 to ${formatOdometer(maximumOdometerKm)} km.`;
      }
    }

    if (values.maintenanceDate) {
      const parsedDate = new Date(`${values.maintenanceDate}T00:00:00`);
      if (
        Number.isNaN(parsedDate.getTime()) ||
        getLocalDateString(parsedDate) !== values.maintenanceDate
      ) {
        nextErrors.maintenanceDate = "Enter a valid maintenance date.";
      } else if (
        values.status === "Completed" &&
        today &&
        values.maintenanceDate > today
      ) {
        nextErrors.maintenanceDate =
          "A completed maintenance date cannot be in the future.";
      } else if (
        today &&
        values.status &&
        values.status !== "Completed" &&
        ((values.maintenanceDate < today && values.status !== "Overdue") ||
          (values.maintenanceDate >= today && values.status !== "Upcoming"))
      ) {
        nextErrors.status =
          "Choose Upcoming for today or a future date, or Overdue for a past date.";
      }
    }

    if (values.status && !maintenanceStatuses.includes(values.status)) {
      nextErrors.status = "Select a status from the list.";
    }

    setErrors(nextErrors);
    return { nextErrors, values };
  }

  function handleSubmit(event) {
    event.preventDefault();
    const { nextErrors, values } = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setFormMessage("Check the highlighted fields and try again.");
      const inputIds = {
        vehicleId: "maintenance-vehicle",
        type: "maintenance-type",
        description: "maintenance-description",
        maintenanceDate: "maintenance-date",
        odometerKm: "maintenance-odometer",
        status: "maintenance-status",
      };
      const firstInvalidField = Object.keys(requiredFields).find(
        (field) => nextErrors[field],
      );
      document.getElementById(inputIds[firstInvalidField])?.focus();
      return;
    }

    const newRecord = {
      id: `maintenance-${globalThis.crypto.randomUUID()}`,
      vehicleId: values.vehicleId,
      type: values.type,
      description: values.description,
      maintenanceDate: values.maintenanceDate,
      odometerKm: Number(values.odometerKm),
      status: values.status,
    };

    setRecords((current) => [newRecord, ...current]);
    setSearchQuery("");
    setStatusFilter("All");
    setTypeFilter("All");
    closeDialog();
  }

  function markCompleted(recordId) {
    const completionDate = today ?? getLocalDateString(new Date());
    setRecords((current) =>
      current.map((record) =>
        record.id === recordId
          ? {
              ...record,
              status: "Completed",
              maintenanceDate: completionDate,
            }
          : record,
      ),
    );
    setSelectedRecord((current) =>
      current?.id === recordId
        ? {
            ...current,
            status: "Completed",
            maintenanceDate: completionDate,
          }
        : current,
    );
  }

  return (
    <AppShell title="Maintenance" showPageHeading={false}>
      <div className="maintenance-management">
        <header className="maintenance-page-header">
          <div>
            <h1 className="page-heading maintenance-page-title">Maintenance</h1>
            <p className="maintenance-page-description">
              Track scheduled services, follow up on overdue work, and keep
              maintenance records organized.
            </p>
            <p className="maintenance-data-note">
              Sample maintenance records; updates are temporary frontend data
              for this page session.
            </p>
          </div>
          <button
            className="primary-action"
            type="button"
            onClick={openAddDialog}
          >
            <span aria-hidden="true">+</span>
            Add Maintenance Record
          </button>
        </header>

        <section
          className="maintenance-summary-grid"
          aria-label="Maintenance summaries"
        >
          <article className="maintenance-summary-card">
            <span className="maintenance-summary-label">
              Total maintenance records
            </span>
            <strong>{records.length}</strong>
            <span className="maintenance-summary-detail">
              Across your fleet
            </span>
          </article>
          <article className="maintenance-summary-card maintenance-summary-upcoming">
            <span className="maintenance-summary-label">
              Upcoming maintenance
            </span>
            <strong>{statusCounts.Upcoming}</strong>
            <span className="maintenance-summary-detail">
              Scheduled for today or later
            </span>
          </article>
          <article className="maintenance-summary-card maintenance-summary-overdue">
            <span className="maintenance-summary-label">
              Overdue maintenance
            </span>
            <strong>{statusCounts.Overdue}</strong>
            <span className="maintenance-summary-detail">
              Past scheduled date
            </span>
          </article>
          <article className="maintenance-summary-card maintenance-summary-completed">
            <span className="maintenance-summary-label">
              Completed maintenance
            </span>
            <strong>{statusCounts.Completed}</strong>
            <span className="maintenance-summary-detail">
              Work marked complete
            </span>
          </article>
        </section>

        <section
          className="maintenance-list-panel"
          aria-labelledby="maintenance-records-title"
        >
          <div className="maintenance-list-heading">
            <div>
              <h2 id="maintenance-records-title">Maintenance records</h2>
              <p>Search and filter your fleet maintenance activity.</p>
            </div>
            <span className="maintenance-result-count" aria-live="polite">
              Showing {visibleRecords.length} of {records.length}
            </span>
          </div>

          <div className="maintenance-toolbar">
            <div className="vehicle-search-field maintenance-search-field">
              <label className="sr-only" htmlFor="maintenance-search">
                Search by vehicle name or registration number
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
                id="maintenance-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search vehicle or registration"
              />
            </div>
            <div className="vehicle-filter-field">
              <label htmlFor="maintenance-status-filter">Status</label>
              <select
                id="maintenance-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="All">All statuses</option>
                {maintenanceStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="vehicle-filter-field">
              <label htmlFor="maintenance-type-filter">Maintenance type</label>
              <select
                id="maintenance-type-filter"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="All">All types</option>
                {maintenanceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {visibleRecords.length > 0 ? (
            <>
              <div className="maintenance-table-wrap">
                <table className="maintenance-table">
                  <caption className="sr-only">
                    Maintenance records for fleet vehicles
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Vehicle</th>
                      <th scope="col">Maintenance type</th>
                      <th scope="col">Description</th>
                      <th scope="col">Date</th>
                      <th scope="col">Odometer</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <span className="maintenance-vehicle-name">
                            {record.vehicleName}
                          </span>
                          <span className="diagnostic-registration">
                            {record.registrationNumber}
                          </span>
                        </td>
                        <td>{record.type}</td>
                        <td className="maintenance-table-description">
                          {record.description}
                        </td>
                        <td>
                          <time dateTime={record.maintenanceDate}>
                            {formatDate(record.maintenanceDate)}
                          </time>
                        </td>
                        <td>{formatOdometer(record.odometerKm)} km</td>
                        <td>
                          <MaintenanceStatusBadge
                            status={record.currentStatus}
                          />
                        </td>
                        <td>
                          <MaintenanceActions
                            record={record}
                            onView={openDetails}
                            onComplete={markCompleted}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul
                className="maintenance-mobile-list"
                aria-label="Maintenance records"
              >
                {visibleRecords.map((record) => (
                  <li className="maintenance-mobile-card" key={record.id}>
                    <article aria-labelledby={`maintenance-${record.id}`}>
                      <div className="maintenance-mobile-heading">
                        <div>
                          <h3 id={`maintenance-${record.id}`}>
                            {record.vehicleName}
                          </h3>
                          <span className="diagnostic-registration">
                            {record.registrationNumber}
                          </span>
                        </div>
                        <MaintenanceStatusBadge
                          status={record.currentStatus}
                        />
                      </div>
                      <p className="maintenance-mobile-type">{record.type}</p>
                      <p className="maintenance-mobile-description">
                        {record.description}
                      </p>
                      <div className="maintenance-mobile-meta">
                        <time dateTime={record.maintenanceDate}>
                          {record.currentStatus === "Completed"
                            ? "Completed"
                            : "Scheduled"}
                          : {formatDate(record.maintenanceDate)}
                        </time>
                        <span>{formatOdometer(record.odometerKm)} km</span>
                      </div>
                      <MaintenanceActions
                        record={record}
                        onView={openDetails}
                        onComplete={markCompleted}
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
                  <path
                    d="M7 3v3m10-3v3M4.5 9h15M6 5h12a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 6 5Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h3>No maintenance records found</h3>
              <p>
                Try another search or filter, or clear them to see all
                maintenance records.
              </p>
              <button
                className="text-action"
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("All");
                  setTypeFilter("All");
                }}
              >
                Clear search and filters
              </button>
            </div>
          )}
        </section>

        <MaintenanceDialog
          dialogRef={dialogRef}
          activeDialog={activeDialog}
          selectedRecord={selectedRecord}
          formValues={formValues}
          errors={errors}
          formMessage={formMessage}
          today={today}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={closeDialog}
          onComplete={markCompleted}
        />
      </div>
    </AppShell>
  );
}
