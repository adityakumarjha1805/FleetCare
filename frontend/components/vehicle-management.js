"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./app-shell";
import {
  createVehicle as createVehicleRequest,
  fetchVehicles,
} from "../lib/vehicles-api";

const statusOptions = ["All", "Healthy", "Needs Attention", "Critical"];
const vehicleTypes = ["Car", "Van", "Pickup", "Truck", "Other"];
const maxOdometerKm = 2_000_000;

const emptyForm = {
  name: "",
  registrationNumber: "",
  manufacturer: "",
  model: "",
  year: "",
  odometerKm: "",
  vehicleType: "",
};

const fieldLabels = {
  name: "Vehicle name",
  registrationNumber: "Registration number",
  manufacturer: "Manufacturer",
  model: "Model",
  year: "Manufacturing year",
  odometerKm: "Odometer reading",
  vehicleType: "Vehicle type",
};

const fieldInputIds = {
  name: "vehicle-name",
  registrationNumber: "vehicle-registration",
  manufacturer: "vehicle-manufacturer",
  model: "vehicle-model",
  year: "vehicle-year",
  odometerKm: "vehicle-odometer",
  vehicleType: "vehicle-type",
};

function normalizeRegistration(value) {
  return value.trim().replace(/[\s-]/g, "").toUpperCase();
}

function formatOdometer(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function toDisplayVehicle(vehicle) {
  return {
    id: vehicle.id,
    name: vehicle.vehicleName,
    registrationNumber: vehicle.registrationNumber,
    manufacturer: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    odometerKm: vehicle.odometer,
    odometerUnit: vehicle.odometerUnit,
    vehicleType: vehicle.vehicleType,
    status: vehicle.healthStatus,
  };
}

function getRequestErrorMessage(error) {
  if (error.status === 401) {
    return "Your session is missing or expired. Sign in again to manage vehicles.";
  }
  if (error.status === 409) {
    return error.message || "A vehicle with this registration number already exists.";
  }
  if (!error.status) {
    return "Unable to connect to FleetCare. Check that the backend is running and try again.";
  }
  return error.message || "Unable to complete the vehicle request. Please try again.";
}

function StatusBadge({ status }) {
  const tone = status.toLowerCase().replaceAll(" ", "-");

  return (
    <span className={`vehicle-status vehicle-status-${tone}`}>
      <span className="vehicle-status-dot" aria-hidden="true" />
      {status}
    </span>
  );
}

function VehicleDialog({
  dialogRef,
  activeDialog,
  selectedVehicle,
  formValues,
  errors,
  formMessage,
  isSavingVehicle,
  onChange,
  onSubmit,
  onClose,
}) {
  return (
    <dialog
      className="vehicle-dialog"
      ref={dialogRef}
      aria-labelledby={
        activeDialog === "add" ? "add-vehicle-title" : "vehicle-details-title"
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
              <h2 id="add-vehicle-title">Add a vehicle</h2>
              <p className="dialog-description">
                Enter the details for the vehicle you want to add to your fleet.
              </p>
            </div>
            <button
              className="dialog-close"
              type="button"
              onClick={onClose}
              aria-label="Close add vehicle form"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <p className="form-data-note">
            Vehicle records are saved to your authenticated fleet.
          </p>

          {formMessage && (
            <p className="form-error-summary" role="alert">
              {formMessage}
            </p>
          )}

          <div className="vehicle-form-grid">
            <div className="form-field">
              <label htmlFor="vehicle-name">
                Vehicle name <span aria-hidden="true">*</span>
              </label>
              <input
                autoFocus
                id="vehicle-name"
                name="name"
                required
                value={formValues.name}
                onChange={onChange}
                autoComplete="off"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "vehicle-name-error" : undefined}
              />
              {errors.name && (
                <span className="field-error" id="vehicle-name-error">
                  {errors.name}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="vehicle-registration">
                Registration number <span aria-hidden="true">*</span>
              </label>
              <input
                id="vehicle-registration"
                name="registrationNumber"
                required
                value={formValues.registrationNumber}
                onChange={onChange}
                autoComplete="off"
                aria-invalid={Boolean(errors.registrationNumber)}
                aria-describedby={
                  errors.registrationNumber
                    ? "vehicle-registration-error"
                    : undefined
                }
              />
              {errors.registrationNumber && (
                <span className="field-error" id="vehicle-registration-error">
                  {errors.registrationNumber}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="vehicle-manufacturer">
                Manufacturer <span aria-hidden="true">*</span>
              </label>
              <input
                id="vehicle-manufacturer"
                name="manufacturer"
                required
                value={formValues.manufacturer}
                onChange={onChange}
                autoComplete="organization"
                aria-invalid={Boolean(errors.manufacturer)}
                aria-describedby={
                  errors.manufacturer ? "vehicle-manufacturer-error" : undefined
                }
              />
              {errors.manufacturer && (
                <span className="field-error" id="vehicle-manufacturer-error">
                  {errors.manufacturer}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="vehicle-model">
                Model <span aria-hidden="true">*</span>
              </label>
              <input
                id="vehicle-model"
                name="model"
                required
                value={formValues.model}
                onChange={onChange}
                autoComplete="off"
                aria-invalid={Boolean(errors.model)}
                aria-describedby={errors.model ? "vehicle-model-error" : undefined}
              />
              {errors.model && (
                <span className="field-error" id="vehicle-model-error">
                  {errors.model}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="vehicle-year">
                Manufacturing year <span aria-hidden="true">*</span>
              </label>
              <input
                id="vehicle-year"
                name="year"
                type="number"
                inputMode="numeric"
                min="1900"
                step="1"
                required
                value={formValues.year}
                onChange={onChange}
                aria-invalid={Boolean(errors.year)}
                aria-describedby={errors.year ? "vehicle-year-error" : undefined}
              />
              {errors.year && (
                <span className="field-error" id="vehicle-year-error">
                  {errors.year}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="vehicle-odometer">
                Odometer reading (km) <span aria-hidden="true">*</span>
              </label>
              <input
                id="vehicle-odometer"
                name="odometerKm"
                type="number"
                inputMode="numeric"
                min="0"
                max={maxOdometerKm}
                step="1"
                required
                value={formValues.odometerKm}
                onChange={onChange}
                aria-invalid={Boolean(errors.odometerKm)}
                aria-describedby={
                  errors.odometerKm ? "vehicle-odometer-error" : undefined
                }
              />
              {errors.odometerKm && (
                <span className="field-error" id="vehicle-odometer-error">
                  {errors.odometerKm}
                </span>
              )}
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="vehicle-type">
                Vehicle type <span aria-hidden="true">*</span>
              </label>
              <select
                id="vehicle-type"
                name="vehicleType"
                required
                value={formValues.vehicleType}
                onChange={onChange}
                aria-invalid={Boolean(errors.vehicleType)}
                aria-describedby={
                  errors.vehicleType ? "vehicle-type-error" : undefined
                }
              >
                <option value="">Select a vehicle type</option>
                {vehicleTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {errors.vehicleType && (
                <span className="field-error" id="vehicle-type-error">
                  {errors.vehicleType}
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
              disabled={isSavingVehicle}
            >
              {isSavingVehicle ? "Saving..." : "Add Vehicle"}
            </button>
          </div>
        </form>
      ) : (
        selectedVehicle && (
          <section
            className="vehicle-details"
            aria-labelledby="vehicle-details-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">VEHICLE RECORD</p>
                <h2 id="vehicle-details-title">{selectedVehicle.name}</h2>
                <p className="dialog-description">
                  Vehicle details saved to your fleet.
                </p>
              </div>
              <button
                className="dialog-close"
                type="button"
                onClick={onClose}
                aria-label="Close vehicle details"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <dl className="vehicle-details-grid">
              <div>
                <dt>Registration number</dt>
                <dd>{selectedVehicle.registrationNumber}</dd>
              </div>
              <div>
                <dt>Manufacturer and model</dt>
                <dd>
                  {selectedVehicle.manufacturer} {selectedVehicle.model}
                </dd>
              </div>
              <div>
                <dt>Year</dt>
                <dd>{selectedVehicle.year}</dd>
              </div>
              <div>
                <dt>Odometer</dt>
                <dd>
                  {formatOdometer(selectedVehicle.odometerKm)}{" "}
                  {selectedVehicle.odometerUnit || "km"}
                </dd>
              </div>
              <div>
                <dt>Vehicle type</dt>
                <dd>{selectedVehicle.vehicleType}</dd>
              </div>
              <div>
                <dt>Health status</dt>
                <dd>
                  <StatusBadge status={selectedVehicle.status} />
                </dd>
              </div>
            </dl>
            <div className="dialog-actions">
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

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [vehicleLoadError, setVehicleLoadError] = useState("");
  const [reloadVehicles, setReloadVehicles] = useState(0);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [pageNotice, setPageNotice] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeDialog, setActiveDialog] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [formValues, setFormValues] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [formMessage, setFormMessage] = useState("");

  const dialogRef = useRef(null);
  const lastTriggerRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchVehicles({ signal: controller.signal })
      .then((records) => {
        setVehicles(records.map(toDisplayVehicle));
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setVehicleLoadError(getRequestErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingVehicles(false);
        }
      });

    return () => controller.abort();
  }, [reloadVehicles]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (activeDialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector("input, select, button")?.focus();
    } else if (!activeDialog && dialog.open) {
      dialog.close();
    }
  }, [activeDialog]);

  useEffect(() => {
    if (!activeDialog) {
      lastTriggerRef.current?.focus();
    }
  }, [activeDialog]);

  const visibleVehicles = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();

    return vehicles.filter((vehicle) => {
      const matchesQuery =
        !query ||
        vehicle.name.toLocaleLowerCase().includes(query) ||
        vehicle.registrationNumber.toLocaleLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "All" || vehicle.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [vehicles, searchQuery, statusFilter]);

  function openAddDialog(event) {
    lastTriggerRef.current = event.currentTarget;
    setFormValues(emptyForm);
    setErrors({});
    setFormMessage("");
    setPageNotice(null);
    setSelectedVehicle(null);
    setActiveDialog("add");
  }

  function openDetailsDialog(vehicle, event) {
    lastTriggerRef.current = event.currentTarget;
    setSelectedVehicle(vehicle);
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
    setSelectedVehicle(null);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setFormValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setFormMessage("");
  }

  function validateForm() {
    const yearLimit = new Date().getFullYear() + 1;
    const nextErrors = {};
    const trimmedValues = Object.fromEntries(
      Object.entries(formValues).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ]),
    );

    for (const [field, label] of Object.entries(fieldLabels)) {
      if (!trimmedValues[field]) {
        nextErrors[field] = `${label} is required.`;
      }
    }

    if (trimmedValues.registrationNumber) {
      const normalizedRegistration = normalizeRegistration(
        trimmedValues.registrationNumber,
      );
      if (
        vehicles.some(
          (vehicle) =>
            normalizeRegistration(vehicle.registrationNumber) ===
            normalizedRegistration,
        )
      ) {
        nextErrors.registrationNumber =
          "A vehicle with this registration number already exists.";
      }
    }

    if (trimmedValues.year) {
      const year = Number(trimmedValues.year);
      if (
        !Number.isInteger(year) ||
        year < 1900 ||
        year > yearLimit
      ) {
        nextErrors.year = `Enter a year between 1900 and ${yearLimit}.`;
      }
    }

    if (trimmedValues.odometerKm !== "") {
      const odometerKm = Number(trimmedValues.odometerKm);
      if (
        !Number.isInteger(odometerKm) ||
        odometerKm < 0 ||
        odometerKm > maxOdometerKm
      ) {
        nextErrors.odometerKm = `Enter a whole number from 0 to ${formatOdometer(maxOdometerKm)} km.`;
      }
    }

    setErrors(nextErrors);
    return { nextErrors, trimmedValues };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSavingVehicle) return;
    const { nextErrors, trimmedValues } = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setFormMessage("Check the highlighted fields and try again.");
      const firstInvalidField = Object.keys(fieldLabels).find(
        (field) => nextErrors[field],
      );
      document.getElementById(fieldInputIds[firstInvalidField])?.focus();
      return;
    }

    setIsSavingVehicle(true);
    setFormMessage("");

    try {
      const createdVehicle = await createVehicleRequest({
        vehicleName: trimmedValues.name,
        registrationNumber: trimmedValues.registrationNumber,
        make: trimmedValues.manufacturer,
        model: trimmedValues.model,
        year: Number(trimmedValues.year),
        vehicleType: trimmedValues.vehicleType,
        odometer: Number(trimmedValues.odometerKm),
        odometerUnit: "km",
      });

      const displayVehicle = toDisplayVehicle(createdVehicle);
      setVehicles((current) => [
        displayVehicle,
        ...current.filter((vehicle) => vehicle.id !== displayVehicle.id),
      ]);
      setSearchQuery("");
      setStatusFilter("All");
      setPageNotice({
        type: "success",
        message: "Vehicle added to your fleet.",
      });
      closeDialog();
    } catch (error) {
      setFormMessage(getRequestErrorMessage(error));
    } finally {
      setIsSavingVehicle(false);
    }
  }

  return (
    <AppShell title="Vehicles" showPageHeading={false}>
      <div className="vehicle-management">
        <header className="vehicle-page-header">
          <div>
            <h1 className="page-heading vehicle-page-title">Vehicles</h1>
            <p className="vehicle-page-description">
              View and manage the vehicles in your fleet.
            </p>
            <p className="vehicle-data-note">
              Vehicles are loaded from your saved fleet.
            </p>
          </div>
          <button
            className="primary-action"
            type="button"
            onClick={openAddDialog}
          >
            <span aria-hidden="true">+</span>
            Add Vehicle
          </button>
        </header>

        {pageNotice && (
          <p
            className={
              pageNotice.type === "error"
                ? "form-error-summary"
                : "form-data-note"
            }
            role={pageNotice.type === "error" ? "alert" : "status"}
          >
            {pageNotice.message}
          </p>
        )}

        <section className="vehicle-list-panel" aria-labelledby="vehicle-list-title">
          <div className="vehicle-list-heading">
            <div>
              <h2 id="vehicle-list-title">Fleet vehicles</h2>
              <p>
                {vehicles.length}{" "}
                {vehicles.length === 1 ? "vehicle" : "vehicles"} total
              </p>
            </div>
            <span className="vehicle-result-count" aria-live="polite">
              Showing {visibleVehicles.length} of {vehicles.length}
            </span>
          </div>

          <div className="vehicle-toolbar">
            <div className="vehicle-search-field">
              <label className="sr-only" htmlFor="vehicle-search">
                Search vehicles by name or registration number
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
                id="vehicle-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name or registration"
              />
            </div>
            <div className="vehicle-filter-field">
              <label htmlFor="vehicle-status-filter">Health status</label>
              <select
                id="vehicle-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "All" ? "All statuses" : status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoadingVehicles ? (
            <p className="form-data-note" role="status" aria-live="polite">
              Loading your vehicles...
            </p>
          ) : vehicleLoadError ? (
            <div className="vehicle-empty-state" role="alert">
              <h3>Unable to load vehicles</h3>
              <p>{vehicleLoadError}</p>
              <button
                className="text-action"
                type="button"
                onClick={() => {
                  setIsLoadingVehicles(true);
                  setVehicleLoadError("");
                  setReloadVehicles((current) => current + 1);
                }}
              >
                Try again
              </button>
            </div>
          ) : visibleVehicles.length > 0 ? (
            <ul className="vehicle-grid" aria-label="Fleet vehicles">
              {visibleVehicles.map((vehicle) => (
                <li className="vehicle-card" key={vehicle.id}>
                  <article aria-labelledby={`vehicle-name-${vehicle.id}`}>
                    <div className="vehicle-card-heading">
                      <div className="vehicle-card-title">
                        <h3 id={`vehicle-name-${vehicle.id}`}>{vehicle.name}</h3>
                        <span className="vehicle-registration">
                          {vehicle.registrationNumber}
                        </span>
                      </div>
                      <StatusBadge status={vehicle.status} />
                    </div>
                    <dl className="vehicle-specs">
                      <div>
                        <dt>Make &amp; model</dt>
                        <dd>
                          {vehicle.manufacturer} {vehicle.model}
                        </dd>
                      </div>
                      <div>
                        <dt>Year</dt>
                        <dd>{vehicle.year}</dd>
                      </div>
                      <div>
                        <dt>Odometer</dt>
                        <dd>
                          {formatOdometer(vehicle.odometerKm)}{" "}
                          {vehicle.odometerUnit || "km"}
                        </dd>
                      </div>
                      <div>
                        <dt>Type</dt>
                        <dd>{vehicle.vehicleType}</dd>
                      </div>
                    </dl>
                    <div className="vehicle-card-footer">
                      <button
                        className="text-action"
                        type="button"
                        onClick={(event) =>
                          openDetailsDialog(vehicle, event)
                        }
                        aria-label={`View details for ${vehicle.name}`}
                      >
                        View Details
                      </button>
                      <span className="vehicle-card-footer-label">
                        Fleet record
                      </span>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
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
              <h3>No vehicles found</h3>
              <p>
                Try another search or status filter, or clear filters to see
                your full fleet.
              </p>
              <button
                className="text-action"
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("All");
                }}
              >
                Clear search and filters
              </button>
            </div>
          )}
        </section>

        <VehicleDialog
          dialogRef={dialogRef}
          activeDialog={activeDialog}
          selectedVehicle={selectedVehicle}
          formValues={formValues}
          errors={errors}
          formMessage={formMessage}
          isSavingVehicle={isSavingVehicle}
          onChange={handleFormChange}
          onSubmit={handleSubmit}
          onClose={closeDialog}
        />
      </div>
    </AppShell>
  );
}
