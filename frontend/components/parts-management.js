"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "./app-shell";
import { fetchCurrentUser } from "../lib/auth-api";
import { fetchVehicles } from "../lib/vehicles-api";
import {
  createPartsRequest,
  fetchParts,
  fetchPartsRequests,
  reviewPartsRequest,
} from "../lib/parts-api";

const initialForm = { vehicleId: "", partId: "", quantity: "1", notes: "" };
const reviewStatuses = ["Approved", "Rejected"];

function formatPrice(value) {
  return typeof value === "number"
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value)
    : "Price not provided";
}

function formatDate(value) {
  if (!value) return "Not reviewed";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
}

function StatusBadge({ status }) {
  return (
    <span className={`parts-status parts-status-${status.toLowerCase()}`}>
      {status}
    </span>
  );
}

function PartsCatalog({ parts, query, category, onQueryChange, onCategoryChange }) {
  const categories = useMemo(
    () => [...new Set(parts.map((part) => part.category))].sort(),
    [parts],
  );
  const visibleParts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return parts.filter((part) => {
      const matchesCategory = !category || part.category === category;
      const searchable = [
        part.name,
        part.partNumber,
        part.category,
        part.description,
        ...(part.compatibility || []),
      ]
        .join(" ")
        .toLowerCase();
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [category, parts, query]);

  return (
    <section className="parts-panel" aria-labelledby="parts-catalog-title">
      <div className="parts-section-heading">
        <div>
          <p className="eyebrow">PARTS CATALOG</p>
          <h2 id="parts-catalog-title">Available parts</h2>
        </div>
        <div className="parts-filters">
          <label>
            <span className="sr-only">Search parts</span>
            <input
              type="search"
              placeholder="Search name or SKU"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Filter by category</span>
            <select
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {visibleParts.length === 0 ? (
        <p className="parts-feedback">No parts match the current filters.</p>
      ) : (
        <div className="parts-catalog-grid">
          {visibleParts.map((part) => (
            <article className="part-card" key={part.id}>
              <div className="part-card-heading">
                <div>
                  <p className="part-category">{part.category}</p>
                  <h3>{part.name}</h3>
                </div>
                <span className="part-availability">{part.availability.replaceAll("_", " ")}</span>
              </div>
              <p className="part-number">SKU {part.partNumber}</p>
              <p className="part-description">{part.description || "No description provided."}</p>
              {part.compatibility?.length > 0 && (
                <p className="part-detail">
                  <strong>Compatibility:</strong> {part.compatibility.join(", ")}
                </p>
              )}
              <div className="part-card-footer">
                <span>{part.stockQuantity} in stock</span>
                <strong>{formatPrice(part.price)}</strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RequestForm({ vehicles, parts, form, setForm, onSubmit, isSaving }) {
  return (
    <section className="parts-panel" aria-labelledby="parts-request-title">
      <p className="eyebrow">INTERNAL REQUEST</p>
      <h2 id="parts-request-title">Request parts</h2>
      <p className="panel-description">
        Requests are routed to your organization administrator for review. No supplier order is placed.
      </p>
      <form className="parts-request-form" onSubmit={onSubmit}>
        <label>
          Vehicle
          <select
            required
            value={form.vehicleId}
            onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}
          >
            <option value="">Select a vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.vehicleName} ({vehicle.registrationNumber})
              </option>
            ))}
          </select>
        </label>
        <label>
          Part
          <select
            required
            value={form.partId}
            onChange={(event) => setForm({ ...form, partId: event.target.value })}
          >
            <option value="">Select a part</option>
            {parts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.name} ({part.partNumber})
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantity
          <input
            required
            type="number"
            min="1"
            max="100"
            step="1"
            value={form.quantity}
            onChange={(event) => setForm({ ...form, quantity: event.target.value })}
          />
        </label>
        <label className="parts-form-wide">
          Notes <span className="label-optional">(optional)</span>
          <textarea
            maxLength="1000"
            rows="3"
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </label>
        <button className="primary-action" type="submit" disabled={isSaving || !vehicles.length || !parts.length}>
          {isSaving ? "Submitting request…" : "Submit parts request"}
        </button>
      </form>
    </section>
  );
}

function RequestList({ requests, isAdmin, onReview, reviewId, reviewNotes, setReviewNotes }) {
  return (
    <section className="parts-panel" aria-labelledby="parts-requests-title">
      <div className="parts-section-heading">
        <div>
          <p className="eyebrow">REQUEST TRACKING</p>
          <h2 id="parts-requests-title">Parts requests</h2>
        </div>
        <span className="parts-request-count">{requests.length} total</span>
      </div>
      {requests.length === 0 ? (
        <p className="parts-feedback">No parts requests have been submitted yet.</p>
      ) : (
        <div className="parts-request-list">
          {requests.map((request) => (
            <article className="parts-request-card" key={request.id}>
              <div className="parts-request-main">
                <div>
                  <h3>{request.requestedParts.map((part) => `${part.name} × ${part.quantity}`).join(", ")}</h3>
                  <p>{request.vehicleName} ({request.registrationNumber}) · Submitted {formatDate(request.createdAt)}</p>
                </div>
                <StatusBadge status={request.status} />
              </div>
              {request.notes && <p className="part-detail"><strong>Notes:</strong> {request.notes}</p>}
              {request.reviewNotes && (
                <p className="part-detail"><strong>Review:</strong> {request.reviewNotes} · {formatDate(request.reviewedAt)}</p>
              )}
              {isAdmin && request.status === "Pending" && (
                <div className="parts-review">
                  <label>
                    <span className="sr-only">Review notes for request</span>
                    <input
                      placeholder="Optional review note"
                      value={reviewId === request.id ? reviewNotes : ""}
                      onChange={(event) => setReviewNotes(event.target.value)}
                    />
                  </label>
                  {reviewStatuses.map((status) => (
                    <button
                      className={status === "Approved" ? "secondary-action" : "danger-action"}
                      type="button"
                      key={status}
                      disabled={reviewId === request.id}
                      onClick={() => onReview(request.id, status)}
                    >
                      {reviewId === request.id ? "Updating…" : status}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function PartsManagement() {
  const [user, setUser] = useState(null);
  const [parts, setParts] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [form, setForm] = useState(initialForm);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewId, setReviewId] = useState("");
  const [feedback, setFeedback] = useState({ error: "", success: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadPartsManagement() {
      const [currentUser, catalog, vehicleList, requestList] = await Promise.all([
        fetchCurrentUser(),
        fetchParts({ signal: controller.signal }),
        fetchVehicles({ signal: controller.signal }),
        fetchPartsRequests({ signal: controller.signal }),
      ]);
      setUser(currentUser);
      setParts(catalog);
      setVehicles(vehicleList);
      setRequests(requestList);
    }

    loadPartsManagement()
      .catch((error) => {
        if (error.name !== "AbortError") {
          setFeedback({ error: error.message || "Unable to load parts management.", success: "" });
        }
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, []);

  async function submitRequest(event) {
    event.preventDefault();
    setIsSaving(true);
    setFeedback({ error: "", success: "" });
    try {
      const request = await createPartsRequest({
        ...form,
        quantity: Number(form.quantity),
      });
      setRequests((current) => [request, ...current]);
      setForm(initialForm);
      setFeedback({ error: "", success: "Parts request submitted for organization review." });
    } catch (error) {
      setFeedback({ error: error.message || "Unable to submit parts request.", success: "" });
    } finally {
      setIsSaving(false);
    }
  }

  async function updateRequest(id, status) {
    setReviewId(id);
    setFeedback({ error: "", success: "" });
    try {
      const updated = await reviewPartsRequest(id, { status, reviewNotes });
      setRequests((current) => current.map((request) => (request.id === id ? updated : request)));
      setReviewNotes("");
      setFeedback({ error: "", success: `Request ${status.toLowerCase()}.` });
    } catch (error) {
      setFeedback({ error: error.message || "Unable to update parts request.", success: "" });
    } finally {
      setReviewId("");
    }
  }

  const canRequest = Boolean(user);
  const isAdmin = user?.role === "admin";

  return (
    <AppShell title="Parts management">
      <div className="parts-page">
        <section className="parts-hero">
          <div>
            <p className="eyebrow">FLEET OPERATIONS</p>
            <h1>Parts management</h1>
            <p>Find catalog parts and track your internal requests.</p>
          </div>
        </section>
        {feedback.error && <p className="form-error-summary" role="alert">{feedback.error}</p>}
        {feedback.success && <p className="form-success-summary" role="status">{feedback.success}</p>}
        {isLoading ? (
          <p className="parts-feedback" role="status">Loading parts management…</p>
        ) : (
          <>
            <PartsCatalog
              parts={parts}
              query={query}
              category={category}
              onQueryChange={setQuery}
              onCategoryChange={setCategory}
            />
            {canRequest && (
              <RequestForm
                vehicles={vehicles}
                parts={parts}
                form={form}
                setForm={setForm}
                onSubmit={submitRequest}
                isSaving={isSaving}
              />
            )}
            <RequestList
              requests={requests}
              isAdmin={isAdmin}
              onReview={updateRequest}
              reviewId={reviewId}
              reviewNotes={reviewNotes}
              setReviewNotes={setReviewNotes}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
