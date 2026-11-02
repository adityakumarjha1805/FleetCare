"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./app-shell";
import { initialVehicleData } from "./mock-fleet-data";

const serviceTypes = [
  "General inspection",
  "Engine repair",
  "Oil change",
  "Brake inspection",
  "Tire service",
  "Other",
];
const requestStatuses = [
  "Pending",
  "Approved",
  "In Progress",
  "Completed",
  "Rejected",
];
const priorities = ["Low", "Medium", "High", "Critical"];
const allowedStatusTransitions = {
  Pending: ["Approved", "Rejected"],
  Approved: ["In Progress", "Rejected"],
  "In Progress": ["Completed"],
  Completed: [],
  Rejected: [],
};
const emptyRequestForm = {
  vehicleId: "",
  serviceType: "",
  description: "",
  priority: "",
  preferredDate: "",
  notes: "",
};
const requiredFields = {
  vehicleId: "Vehicle",
  serviceType: "Service type",
  description: "Description",
  priority: "Priority",
  preferredDate: "Preferred service date",
};

const sampleServiceRequestData = [
  {
    id: "request-001",
    requestId: "SR-2026-001",
    vehicleId: "vehicle-003",
    serviceType: "Engine repair",
    description: "Investigate engine misfire and intermittent vibration.",
    requestedDate: "2026-10-30",
    preferredDate: "2026-11-06",
    priority: "Critical",
    status: "Pending",
    notes: "Driver reported vibration under load.",
  },
  {
    id: "request-002",
    requestId: "SR-2026-002",
    vehicleId: "vehicle-002",
    serviceType: "Tire service",
    description: "Inspect tire wear and complete a tire rotation.",
    requestedDate: "2026-10-28",
    preferredDate: "2026-11-10",
    priority: "Medium",
    status: "Approved",
    notes: "Please check all tire pressures.",
  },
  {
    id: "request-003",
    requestId: "SR-2026-003",
    vehicleId: "vehicle-001",
    serviceType: "Oil change",
    description: "Replace engine oil and filter.",
    requestedDate: "2026-10-26",
    preferredDate: "2026-11-04",
    priority: "Low",
    status: "In Progress",
    notes: "",
  },
  {
    id: "request-004",
    requestId: "SR-2026-004",
    vehicleId: "vehicle-005",
    serviceType: "General inspection",
    description: "Inspect warning indicator and review vehicle condition.",
    requestedDate: "2026-10-22",
    preferredDate: "2026-10-29",
    priority: "High",
    status: "Completed",
    notes: "Sample request marked complete.",
  },
  {
    id: "request-005",
    requestId: "SR-2026-005",
    vehicleId: "vehicle-004",
    serviceType: "Brake inspection",
    description: "Check brake pads and braking performance.",
    requestedDate: "2026-10-20",
    preferredDate: "2026-11-12",
    priority: "High",
    status: "Rejected",
    notes: "Sample request declined pending more information.",
  },
];

function getLocalDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function RequestStatusBadge({ status }) {
  return (
    <span
      className={`service-request-badge service-request-status-${status.toLowerCase().replaceAll(" ", "-")}`}
    >
      <span className="service-request-badge-dot" aria-hidden="true" />
      {status}
    </span>
  );
}

function RequestPriorityBadge({ priority }) {
  return (
    <span
      className={`service-request-badge service-request-priority-${priority.toLowerCase()}`}
    >
      <span className="service-request-badge-dot" aria-hidden="true" />
      {priority}
    </span>
  );
}

function ServiceRequestDialog({
  dialogRef,
  activeDialog,
  request,
  formValues,
  errors,
  formMessage,
  today,
  isCancelling,
  onChange,
  onSubmit,
  onClose,
  onEdit,
  onCancelRequest,
  onKeepRequest,
  onTransition,
}) {
  const selectedVehicle = request
    ? initialVehicleData.find((vehicle) => vehicle.id === request.vehicleId)
    : null;
  const allowedTransitions = request
    ? allowedStatusTransitions[request.status] ?? []
    : [];

  return (
    <dialog
      className="vehicle-dialog service-request-dialog"
      ref={dialogRef}
      aria-labelledby={
        activeDialog === "add" || activeDialog === "edit"
          ? "service-request-form-title"
          : isCancelling
            ? "cancel-request-title"
            : "service-request-details-title"
      }
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {activeDialog === "add" || activeDialog === "edit" ? (
        <form className="vehicle-form" noValidate onSubmit={onSubmit}>
          <div className="dialog-heading">
            <div>
              <p className="eyebrow">FLEET OPERATIONS</p>
              <h2 id="service-request-form-title">
                {activeDialog === "edit"
                  ? "Edit service request"
                  : "Create service request"}
              </h2>
              <p className="dialog-description">
                {activeDialog === "edit"
                  ? "Update this pending request. It will remain pending."
                  : "Describe the vehicle service you are requesting."}
              </p>
            </div>
            <button
              className="dialog-close"
              type="button"
              onClick={onClose}
              aria-label="Close service request form"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {activeDialog === "add" && (
            <p className="form-data-note">
              Sample request records and new entries are temporary frontend
              data. Submitting a request does not book or confirm a service
              slot.
            </p>
          )}
          {formMessage && (
            <p className="form-error-summary" role="alert">
              {formMessage}
            </p>
          )}

          <div className="vehicle-form-grid">
            <div className="form-field form-field-full">
              <label htmlFor="service-request-vehicle">
                Vehicle <span aria-hidden="true">*</span>
              </label>
              <select
                autoFocus
                id="service-request-vehicle"
                name="vehicleId"
                required
                value={formValues.vehicleId}
                onChange={onChange}
                aria-invalid={Boolean(errors.vehicleId)}
                aria-describedby={
                  errors.vehicleId ? "service-request-vehicle-error" : undefined
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
                <span
                  className="field-error"
                  id="service-request-vehicle-error"
                >
                  {errors.vehicleId}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="service-request-type">
                Service type <span aria-hidden="true">*</span>
              </label>
              <select
                id="service-request-type"
                name="serviceType"
                required
                value={formValues.serviceType}
                onChange={onChange}
                aria-invalid={Boolean(errors.serviceType)}
                aria-describedby={
                  errors.serviceType ? "service-request-type-error" : undefined
                }
              >
                <option value="">Select a service type</option>
                {serviceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {errors.serviceType && (
                <span className="field-error" id="service-request-type-error">
                  {errors.serviceType}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="service-request-priority">
                Priority <span aria-hidden="true">*</span>
              </label>
              <select
                id="service-request-priority"
                name="priority"
                required
                value={formValues.priority}
                onChange={onChange}
                aria-invalid={Boolean(errors.priority)}
                aria-describedby={
                  errors.priority
                    ? "service-request-priority-error"
                    : undefined
                }
              >
                <option value="">Select priority</option>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
              {errors.priority && (
                <span
                  className="field-error"
                  id="service-request-priority-error"
                >
                  {errors.priority}
                </span>
              )}
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="service-request-description">
                Description of the problem{" "}
                <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="service-request-description"
                name="description"
                rows="3"
                required
                value={formValues.description}
                onChange={onChange}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description
                    ? "service-request-description-error"
                    : undefined
                }
                placeholder="Describe the service or inspection needed."
              />
              {errors.description && (
                <span
                  className="field-error"
                  id="service-request-description-error"
                >
                  {errors.description}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="service-request-date">
                Preferred service date <span aria-hidden="true">*</span>
              </label>
              <input
                id="service-request-date"
                name="preferredDate"
                type="date"
                min={today}
                required
                value={formValues.preferredDate}
                onChange={onChange}
                aria-invalid={Boolean(errors.preferredDate)}
                aria-describedby={
                  errors.preferredDate
                    ? "service-request-date-error"
                    : undefined
                }
              />
              {errors.preferredDate && (
                <span className="field-error" id="service-request-date-error">
                  {errors.preferredDate}
                </span>
              )}
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="service-request-notes">Notes (optional)</label>
              <textarea
                id="service-request-notes"
                name="notes"
                rows="2"
                value={formValues.notes}
                onChange={onChange}
                placeholder="Add helpful context for the request."
              />
            </div>
          </div>

          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-action" type="submit">
              {activeDialog === "edit"
                ? "Save Changes"
                : "Submit Service Request"}
            </button>
          </div>
        </form>
      ) : (
        request &&
        selectedVehicle && (
          <section
            className="vehicle-details"
            aria-labelledby="service-request-details-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">SERVICE REQUEST</p>
                <h2 id="service-request-details-title">{request.requestId}</h2>
                <p className="dialog-description">
                  {selectedVehicle.name} · {selectedVehicle.registrationNumber}
                </p>
              </div>
              <button
                className="dialog-close"
                type="button"
                onClick={onClose}
                aria-label="Close service request details"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="service-request-detail-badges">
              <RequestStatusBadge status={request.status} />
              <RequestPriorityBadge priority={request.priority} />
            </div>

            <dl className="vehicle-details-grid">
              <div>
                <dt>Service type</dt>
                <dd>{request.serviceType}</dd>
              </div>
              <div>
                <dt>Requested date</dt>
                <dd>{formatDate(request.requestedDate)}</dd>
              </div>
              <div>
                <dt>Preferred service date</dt>
                <dd>{formatDate(request.preferredDate)}</dd>
              </div>
              <div>
                <dt>Vehicle</dt>
                <dd>
                  {selectedVehicle.name} ({selectedVehicle.registrationNumber})
                </dd>
              </div>
              <div className="vehicle-detail-full">
                <dt>Description</dt>
                <dd>{request.description}</dd>
              </div>
              {request.notes && (
                <div className="vehicle-detail-full">
                  <dt>Notes</dt>
                  <dd>{request.notes}</dd>
                </div>
              )}
            </dl>

            <p className="service-request-booking-note">
              This request is not a booking. A preferred date is a request only
              and does not indicate provider availability or confirmation.
            </p>

            {isCancelling ? (
              <section
                className="service-request-cancel-confirm"
                aria-labelledby="cancel-request-title"
              >
                <h3 id="cancel-request-title">Cancel this pending request?</h3>
                <p>
                  {request.requestId} will be removed from this temporary
                  request list. This cannot be undone.
                </p>
                <div className="dialog-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={onKeepRequest}
                  >
                    Keep request
                  </button>
                  <button
                    className="danger-action"
                    type="button"
                    onClick={() => onCancelRequest(request.id)}
                  >
                    Confirm cancellation
                  </button>
                </div>
              </section>
            ) : (
              <div className="dialog-actions service-request-actions">
                {request.status === "Pending" && (
                  <>
                    <button
                      className="secondary-button service-request-cancel-button"
                      type="button"
                      onClick={onCancelRequest}
                    >
                      Cancel request
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => onEdit(request)}
                    >
                      Edit request
                    </button>
                  </>
                )}
                {allowedTransitions.map((status) => (
                  <button
                    className={
                      status === "Rejected"
                        ? "secondary-button service-request-reject-button"
                        : "secondary-button"
                    }
                    key={status}
                    type="button"
                    onClick={() => onTransition(request.id, status)}
                  >
                    {status === "In Progress"
                      ? "Mark in progress"
                      : status === "Completed"
                        ? "Mark completed"
                        : status === "Approved"
                          ? "Approve request"
                          : status === "Rejected"
                            ? "Reject request"
                            : `${status} request`}
                  </button>
                ))}
                <button
                  className="primary-action"
                  type="button"
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            )}
          </section>
        )
      )}
    </dialog>
  );
}

function ServiceRequestActions({ request, onView }) {
  return (
    <button
      className="text-action"
      type="button"
      onClick={(event) => onView(request, event)}
      aria-label={`View details for ${request.requestId}`}
    >
      View details
    </button>
  );
}

export default function ServiceRequestManagement() {
  const [requests, setRequests] = useState(sampleServiceRequestData);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [activeDialog, setActiveDialog] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [formValues, setFormValues] = useState(emptyRequestForm);
  const [errors, setErrors] = useState({});
  const [formMessage, setFormMessage] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [today, setToday] = useState(null);
  const [notice, setNotice] = useState("");

  const dialogRef = useRef(null);
  const lastTriggerRef = useRef(null);
  const nextRequestNumberRef = useRef(
    sampleServiceRequestData.reduce((max, request) => {
      const match = request.requestId.match(/-(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1,
  );

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
          activeDialog === "add" || activeDialog === "edit"
            ? "#service-request-vehicle"
            : ".dialog-close",
        )
        ?.focus();
    } else if (!activeDialog && dialog.open) {
      dialog.close();
    }
  }, [activeDialog]);

  useEffect(() => {
    if (!activeDialog) lastTriggerRef.current?.focus();
  }, [activeDialog]);

  const requestsWithVehicles = useMemo(
    () =>
      requests.map((request) => {
        const vehicle = initialVehicleData.find(
          (item) => item.id === request.vehicleId,
        );

        return {
          ...request,
          vehicleName: vehicle?.name ?? "Unknown vehicle",
          registrationNumber: vehicle?.registrationNumber ?? "—",
        };
      }),
    [requests],
  );

  const visibleRequests = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return requestsWithVehicles.filter((request) => {
      const matchesSearch =
        !query ||
        request.vehicleName.toLocaleLowerCase().includes(query) ||
        request.registrationNumber.toLocaleLowerCase().includes(query) ||
        request.requestId.toLocaleLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "All" || request.status === statusFilter;
      const matchesPriority =
        priorityFilter === "All" || request.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [requestsWithVehicles, searchQuery, statusFilter, priorityFilter]);

  const requestCounts = requests.reduce(
    (counts, request) => {
      if (request.status === "Pending") counts.pending += 1;
      if (request.status === "Approved") counts.approved += 1;
      if (request.status === "Completed") counts.completed += 1;
      return counts;
    },
    { pending: 0, approved: 0, completed: 0 },
  );
  const selectedRequest = requestsWithVehicles.find(
    (request) => request.id === selectedRequestId,
  );

  function openAddDialog(event) {
    lastTriggerRef.current = event.currentTarget;
    setSelectedRequestId(null);
    setFormValues(emptyRequestForm);
    setErrors({});
    setFormMessage("");
    setIsCancelling(false);
    setActiveDialog("add");
  }

  function openDetails(request, event) {
    lastTriggerRef.current = event.currentTarget;
    setSelectedRequestId(request.id);
    setIsCancelling(false);
    setActiveDialog("details");
  }

  function openEdit(request) {
    if (request.status !== "Pending") return;
    setFormValues({
      vehicleId: request.vehicleId,
      serviceType: request.serviceType,
      description: request.description,
      priority: request.priority,
      preferredDate: request.preferredDate,
      notes: request.notes,
    });
    setErrors({});
    setFormMessage("");
    setIsCancelling(false);
    setActiveDialog("edit");
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
    setSelectedRequestId(null);
    setIsCancelling(false);
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

    if (values.serviceType && !serviceTypes.includes(values.serviceType)) {
      nextErrors.serviceType = "Select a service type from the list.";
    }

    if (values.priority && !priorities.includes(values.priority)) {
      nextErrors.priority = "Select a priority from the list.";
    }

    if (values.preferredDate && today) {
      const selectedDate = new Date(`${values.preferredDate}T00:00:00`);
      if (
        Number.isNaN(selectedDate.getTime()) ||
        getLocalDateString(selectedDate) !== values.preferredDate
      ) {
        nextErrors.preferredDate = "Enter a valid preferred service date.";
      } else if (values.preferredDate < today) {
        nextErrors.preferredDate = "Preferred service date cannot be in the past.";
      }
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
        vehicleId: "service-request-vehicle",
        serviceType: "service-request-type",
        description: "service-request-description",
        priority: "service-request-priority",
        preferredDate: "service-request-date",
      };
      const firstInvalidField = Object.keys(requiredFields).find(
        (field) => nextErrors[field],
      );
      document.getElementById(inputIds[firstInvalidField])?.focus();
      return;
    }

    const requestedDate = today ?? getLocalDateString(new Date());
    if (activeDialog === "edit" && selectedRequestId) {
      setRequests((current) =>
        current.map((request) =>
          request.id === selectedRequestId && request.status === "Pending"
            ? {
                ...request,
                vehicleId: values.vehicleId,
                serviceType: values.serviceType,
                description: values.description,
                priority: values.priority,
                preferredDate: values.preferredDate,
                notes: values.notes,
              }
            : request,
        ),
      );
      setNotice("Pending service request updated.");
    } else {
      const year = requestedDate.slice(0, 4);
      const newRequest = {
        id: `request-${globalThis.crypto.randomUUID()}`,
        requestId: `SR-${year}-${String(nextRequestNumberRef.current).padStart(3, "0")}`,
        vehicleId: values.vehicleId,
        serviceType: values.serviceType,
        description: values.description,
        requestedDate,
        preferredDate: values.preferredDate,
        priority: values.priority,
        status: "Pending",
        notes: values.notes,
      };
      nextRequestNumberRef.current += 1;
      setRequests((current) => [newRequest, ...current]);
      setNotice(
        "Service request submitted as Pending. No service booking was made.",
      );
    }

    setSearchQuery("");
    setStatusFilter("All");
    setPriorityFilter("All");
    closeDialog();
  }

  function startCancellation() {
    setIsCancelling(true);
  }

  function keepRequest() {
    setIsCancelling(false);
  }

  function cancelRequest(requestId) {
    if (typeof requestId === "string") {
      setRequests((current) =>
        current.filter(
          (request) =>
            request.id !== requestId || request.status !== "Pending",
        ),
      );
      setNotice("Pending service request cancelled and removed.");
      closeDialog();
    } else {
      setIsCancelling(true);
    }
  }

  function transitionRequest(requestId, nextStatus) {
    const request = requests.find((item) => item.id === requestId);
    if (
      !request ||
      !(allowedStatusTransitions[request.status] ?? []).includes(nextStatus)
    ) {
      return;
    }

    setRequests((current) =>
      current.map((request) => {
        if (request.id !== requestId) return request;
        const allowed = allowedStatusTransitions[request.status] ?? [];
        if (!allowed.includes(nextStatus)) return request;
        return { ...request, status: nextStatus };
      }),
    );
    setNotice(`Request status updated to ${nextStatus}.`);
  }

  return (
    <AppShell title="Service Requests" showPageHeading={false}>
      <div className="service-request-management">
        <header className="service-request-page-header">
          <div>
            <h1 className="page-heading service-request-page-title">
              Service Requests
            </h1>
            <p className="service-request-page-description">
              Create and track requests for vehicle maintenance, repairs, and
              inspections.
            </p>
            <p className="service-request-data-note">
              Sample request data; changes are temporary and stay in this page
        session. A request is not a confirmed service booking.
            </p>
          </div>
          <button
            className="primary-action"
            type="button"
            onClick={openAddDialog}
          >
            <span aria-hidden="true">+</span>
            Create Service Request
          </button>
        </header>

        {notice && (
          <p className="service-request-notice" role="status" aria-live="polite">
            {notice}
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </p>
        )}

        <section
          className="service-request-summary-grid"
          aria-label="Service request summaries"
        >
          <article className="service-request-summary-card">
            <span>Total requests</span>
            <strong>{requests.length}</strong>
            <small>Across your fleet</small>
          </article>
          <article className="service-request-summary-card service-request-summary-pending">
            <span>Pending requests</span>
            <strong>{requestCounts.pending}</strong>
            <small>Awaiting review</small>
          </article>
          <article className="service-request-summary-card service-request-summary-approved">
            <span>Approved requests</span>
            <strong>{requestCounts.approved}</strong>
            <small>Approved for next steps</small>
          </article>
          <article className="service-request-summary-card service-request-summary-completed">
            <span>Completed requests</span>
            <strong>{requestCounts.completed}</strong>
            <small>Marked as completed</small>
          </article>
        </section>

        <section
          className="service-request-list-panel"
          aria-labelledby="service-request-list-title"
        >
          <div className="service-request-list-heading">
            <div>
              <h2 id="service-request-list-title">Request list</h2>
              <p>Review request details and update their workflow status.</p>
            </div>
            <span className="service-request-result-count" aria-live="polite">
              Showing {visibleRequests.length} of {requests.length}
            </span>
          </div>

          <div className="service-request-toolbar">
            <div className="vehicle-search-field service-request-search">
              <label className="sr-only" htmlFor="service-request-search">
                Search by vehicle name, registration number, or request ID
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
                id="service-request-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search vehicle or request ID"
              />
            </div>
            <div className="vehicle-filter-field">
              <label htmlFor="service-request-status-filter">Status</label>
              <select
                id="service-request-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="All">All statuses</option>
                {requestStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="vehicle-filter-field">
              <label htmlFor="service-request-priority-filter">Priority</label>
              <select
                id="service-request-priority-filter"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="All">All priorities</option>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {visibleRequests.length > 0 ? (
            <>
              <div className="service-request-table-wrap">
                <table className="service-request-table">
                  <caption className="sr-only">
                    Service requests for fleet vehicles
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Request ID</th>
                      <th scope="col">Vehicle</th>
                      <th scope="col">Service type</th>
                      <th scope="col">Description</th>
                      <th scope="col">Requested date</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRequests.map((request) => (
                      <tr key={request.id}>
                        <td>
                          <span className="service-request-id">
                            {request.requestId}
                          </span>
                        </td>
                        <td>
                          <span className="service-request-vehicle-name">
                            {request.vehicleName}
                          </span>
                          <span className="diagnostic-registration">
                            {request.registrationNumber}
                          </span>
                        </td>
                        <td>{request.serviceType}</td>
                        <td className="service-request-table-description">
                          {request.description}
                        </td>
                        <td>
                          <time dateTime={request.requestedDate}>
                            {formatDate(request.requestedDate)}
                          </time>
                        </td>
                        <td>
                          <RequestPriorityBadge priority={request.priority} />
                        </td>
                        <td>
                          <RequestStatusBadge status={request.status} />
                        </td>
                        <td>
                          <ServiceRequestActions
                            request={request}
                            onView={openDetails}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul
                className="service-request-mobile-list"
                aria-label="Service requests"
              >
                {visibleRequests.map((request) => (
                  <li
                    className="service-request-mobile-card"
                    key={request.id}
                  >
                    <article
                      aria-labelledby={`mobile-${request.requestId}`}
                    >
                      <div className="service-request-mobile-heading">
                        <div>
                          <h3 id={`mobile-${request.requestId}`}>
                            {request.requestId}
                          </h3>
                          <span className="service-request-vehicle-name">
                            {request.vehicleName}
                          </span>
                          <span className="diagnostic-registration">
                            {request.registrationNumber}
                          </span>
                        </div>
                        <RequestStatusBadge status={request.status} />
                      </div>
                      <p className="service-request-mobile-type">
                        {request.serviceType}
                      </p>
                      <p className="service-request-mobile-description">
                        {request.description}
                      </p>
                      <div className="service-request-mobile-meta">
                        <time dateTime={request.requestedDate}>
                          Requested {formatDate(request.requestedDate)}
                        </time>
                        <RequestPriorityBadge priority={request.priority} />
                      </div>
                      <ServiceRequestActions
                        request={request}
                        onView={openDetails}
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
              <h3>No service requests found</h3>
              <p>
                Try a different search or filter, or clear them to view all
                service requests.
              </p>
              <button
                className="text-action"
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("All");
                  setPriorityFilter("All");
                }}
              >
                Clear search and filters
              </button>
            </div>
          )}
        </section>

        <p className="service-request-booking-footnote">
          Service requests are not bookings. Preferred dates are requests only;
          provider availability, service slots, and completion must be confirmed
          separately.
        </p>

        <ServiceRequestDialog
          dialogRef={dialogRef}
          activeDialog={activeDialog}
          request={selectedRequest}
          formValues={formValues}
          errors={errors}
          formMessage={formMessage}
          today={today ?? ""}
          isCancelling={isCancelling}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={closeDialog}
          onEdit={openEdit}
          onCancelRequest={cancelRequest}
          onKeepRequest={keepRequest}
          onTransition={transitionRequest}
        />
      </div>
    </AppShell>
  );
}
