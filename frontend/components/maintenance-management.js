"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./app-shell";
import {
  completeMaintenance,
  createMaintenance,
  fetchMaintenance,
} from "../lib/maintenance-api";
import { fetchVehicles } from "../lib/vehicles-api";

const maintenanceTypes = [
  "Oil change",
  "Tire rotation",
  "Brake inspection",
  "General servicing",
  "Other",
];
const maintenanceStatuses = ["Upcoming", "Overdue", "Completed"];
const maximumOdometer = 2_000_000;

const emptyMaintenanceForm = {
  vehicleId: "",
  type: "",
  description: "",
  maintenanceDate: "",
  odometer: "",
  status: "",
};

const requiredFields = {
  vehicleId: "Vehicle",
  type: "Maintenance type",
  description: "Description",
  maintenanceDate: "Maintenance date",
  odometer: "Odometer reading",
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
  vehicles,
  formValues,
  errors,
  formMessage,
  today,
  isSaving,
  isCompleting,
  onChange,
  onSubmit,
  onClose,
  onComplete,
}) {
  const selectedVehicle = selectedRecord
    ? vehicles.find((vehicle) => vehicle.id === selectedRecord.vehicleId)
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
            Records are stored for your account. A completed entry records work
            reported as done; it is not a service booking.
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
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicleName} ({vehicle.registrationNumber})
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
                Odometer reading
                {formValues.vehicleId
                  ? ` (${vehicles.find((vehicle) => vehicle.id === formValues.vehicleId)?.odometerUnit ?? "km"})`
                  : ""}
                <span aria-hidden="true"> *</span>
              </label>
              <input
                id="maintenance-odometer"
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
                  errors.odometer ? "maintenance-odometer-error" : undefined
                }
              />
              {errors.odometer && (
                <span className="field-error" id="maintenance-odometer-error">
                  {errors.odometer}
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
            <button
              className="primary-action"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Add Maintenance Record"}
            </button>
          </div>
        </form>
      ) : (
        selectedRecord && (
          <section
            className="vehicle-details"
            aria-labelledby="maintenance-details-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">MAINTENANCE RECORD</p>
                <h2 id="maintenance-details-title">{selectedRecord.type}</h2>
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
                <dd>
                  {formatDate(
                    selectedRecord.completedAt ||
                      selectedRecord.maintenanceDate,
                  )}
                </dd>
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
            </dl>

            <div className="dialog-actions">
              {selectedRecord.status !== "Completed" && (
                <button
                  className="secondary-button resolve-button"
                  type="button"
                  disabled={isCompleting}
                  onClick={() => onComplete(selectedRecord.id)}
                >
                  {isCompleting ? "Saving..." : "Mark as completed"}
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

function MaintenanceActions({ record, onView, onComplete, isCompleting }) {
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
          disabled={isCompleting}
          onClick={() => onComplete(record.id)}
          aria-label={`Mark ${record.type} for ${record.vehicleName} as completed`}
        >
          {isCompleting ? "Saving..." : "Mark completed"}
        </button>
      )}
    </div>
  );
}

export default function MaintenanceManagement() {
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [completingRecordId, setCompletingRecordId] = useState(null);
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
    const controller = new AbortController();

    async function loadData() {
      setIsLoading(true);
      setLoadError("");
      setNotice("");
      try {
        const [loadedVehicles, loadedRecords] = await Promise.all([
          fetchVehicles({ signal: controller.signal }),
          fetchMaintenance({ signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) {
          setVehicles(loadedVehicles);
          setRecords(loadedRecords);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error.message || "Unable to load maintenance records.",
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
        return {
          ...record,
          vehicleName: record.vehicleName || "Vehicle unavailable",
          registrationNumber: record.registrationNumber || "—",
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

    if (values.odometer) {
      const odometer = Number(values.odometer);
      if (
        !Number.isInteger(odometer) ||
        odometer < 0 ||
        odometer > maximumOdometer
      ) {
        nextErrors.odometer = `Enter a whole number from 0 to ${formatOdometer(maximumOdometer)}.`;
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

  async function handleSubmit(event) {
    event.preventDefault();
    const { nextErrors, values } = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setFormMessage("Check the highlighted fields and try again.");
      const inputIds = {
        vehicleId: "maintenance-vehicle",
        type: "maintenance-type",
        description: "maintenance-description",
        maintenanceDate: "maintenance-date",
        odometer: "maintenance-odometer",
        status: "maintenance-status",
      };
      const firstInvalidField = Object.keys(requiredFields).find(
        (field) => nextErrors[field],
      );
      document.getElementById(inputIds[firstInvalidField])?.focus();
      return;
    }

    const vehicle = vehicles.find((item) => item.id === values.vehicleId);
    if (!vehicle) {
      setFormMessage("Select a vehicle that belongs to your account.");
      return;
    }

    setIsSaving(true);
    setFormMessage("");
    try {
      const createdRecord = await createMaintenance({
        vehicleId: vehicle.id,
        type: values.type,
        description: values.description,
        maintenanceDate: values.maintenanceDate,
        odometer: Number(values.odometer),
        odometerUnit: vehicle.odometerUnit,
        status: values.status,
      });
      setRecords((current) => [createdRecord, ...current]);
      setSearchQuery("");
      setStatusFilter("All");
      setTypeFilter("All");
      setNotice("Maintenance record saved.");
      closeDialog();
    } catch (error) {
      setFormMessage(
        error.message || "Unable to save the maintenance record. Please retry.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function markCompleted(recordId) {
    if (completingRecordId) return;
    setCompletingRecordId(recordId);
    setLoadError("");
    setNotice("");
    try {
      const updatedRecord = await completeMaintenance(recordId);
      setRecords((current) =>
        current.map((record) =>
          record.id === recordId ? updatedRecord : record,
        ),
      );
      setSelectedRecord((current) =>
        current?.id === recordId ? updatedRecord : current,
      );
      setNotice("Maintenance record marked as completed.");
    } catch (error) {
      setLoadError(
        error.message || "Unable to update the maintenance record.",
      );
    } finally {
      setCompletingRecordId(null);
    }
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
              Records are saved to your account. Odometer units follow the
              selected vehicle.
            </p>
          </div>
          <button
            className="primary-action"
            type="button"
            onClick={openAddDialog}
            disabled={isLoading || vehicles.length === 0}
          >
            <span aria-hidden="true">+</span>
            Add Maintenance Record
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
        {notice && (
          <p className="diagnostic-success-message" role="status">
            {notice}
          </p>
        )}
        {!isLoading && !loadError && vehicles.length === 0 && (
          <p className="diagnostic-request-message" role="status">
            Add a vehicle before recording maintenance.
          </p>
        )}

        <section
          className="maintenance-summary-grid"
          aria-label="Maintenance summaries"
        >
          <article className="maintenance-summary-card">
            <span className="maintenance-summary-label">
              Total maintenance records
            </span>
            <strong>{isLoading || loadError ? "—" : records.length}</strong>
            <span className="maintenance-summary-detail">
              Across your fleet
            </span>
          </article>
          <article className="maintenance-summary-card maintenance-summary-upcoming">
            <span className="maintenance-summary-label">
              Upcoming maintenance
            </span>
            <strong>
              {isLoading || loadError ? "—" : statusCounts.Upcoming}
            </strong>
            <span className="maintenance-summary-detail">
              Scheduled for today or later
            </span>
          </article>
          <article className="maintenance-summary-card maintenance-summary-overdue">
            <span className="maintenance-summary-label">
              Overdue maintenance
            </span>
            <strong>{isLoading || loadError ? "—" : statusCounts.Overdue}</strong>
            <span className="maintenance-summary-detail">
              Past scheduled date
            </span>
          </article>
          <article className="maintenance-summary-card maintenance-summary-completed">
            <span className="maintenance-summary-label">
              Completed maintenance
            </span>
            <strong>
              {isLoading || loadError ? "—" : statusCounts.Completed}
            </strong>
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
              {isLoading
                ? "Loading"
                : loadError
                  ? "Unavailable"
                  : `Showing ${visibleRecords.length} of ${records.length}`}
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

          {isLoading ? (
            <div className="vehicle-empty-state" role="status">
              Loading maintenance records...
            </div>
          ) : visibleRecords.length > 0 ? (
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
                          <time
                            dateTime={
                              record.completedAt || record.maintenanceDate
                            }
                          >
                            {formatDate(
                              record.completedAt || record.maintenanceDate,
                            )}
                          </time>
                        </td>
                        <td>
                          {formatOdometer(record.odometer)}{" "}
                          {record.odometerUnit}
                        </td>
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
                            isCompleting={completingRecordId === record.id}
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
                        <time
                          dateTime={
                            record.completedAt || record.maintenanceDate
                          }
                        >
                          {record.currentStatus === "Completed"
                            ? "Completed"
                            : "Scheduled"}
                          :{" "}
                          {formatDate(
                            record.completedAt || record.maintenanceDate,
                          )}
                        </time>
                        <span>
                          {formatOdometer(record.odometer)}{" "}
                          {record.odometerUnit}
                        </span>
                      </div>
                      <MaintenanceActions
                        record={record}
                        onView={openDetails}
                        onComplete={markCompleted}
                        isCompleting={completingRecordId === record.id}
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
                {records.length === 0
                  ? "No maintenance records have been saved yet."
                  : "Try another search or filter, or clear them to see all maintenance records."}
              </p>
              {records.length > 0 && (
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
              )}
            </div>
          ) : null}
        </section>

        <MaintenanceDialog
          dialogRef={dialogRef}
          activeDialog={activeDialog}
          selectedRecord={selectedRecord}
          vehicles={vehicles}
          formValues={formValues}
          errors={errors}
          formMessage={formMessage}
          today={today}
          isSaving={isSaving}
          isCompleting={completingRecordId === selectedRecord?.id}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={closeDialog}
          onComplete={markCompleted}
        />
      </div>
    </AppShell>
  );
}
