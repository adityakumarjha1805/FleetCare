# FleetCare API Documentation

This document describes the behavior implemented in the current repository. It
is not a proposal for endpoints that do not yet exist.

## Conventions and setup

- The API is mounted at `/api`; there is no version prefix.
- Requests with bodies use JSON (`Content-Type: application/json`).
- JSON responses normally use `{ "success": true, "data": ... }` on success
  and `{ "success": false, "error": { "code": "...", "message": "..." } }`
  on failure. The health endpoint's degraded response is an exception.
- Protected routes accept the frontend's `fleetcareAccessToken` HttpOnly cookie
  or an explicit `Authorization: Bearer <JWT>` header for non-browser clients.
- Authentication endpoints are rate-limited per client IP: registration allows
  10 requests per hour and login allows 10 requests per 15 minutes.
- The JWT is signed with HS256, issued by `fleetcare-api`, intended for
  `fleetcare-client`, and expires after one hour. Protected requests also
  resolve the token subject to an existing user.
- The backend reads `MONGODB_URI`, `FRONTEND_ORIGIN`, `JWT_SECRET`, and
  optional `PORT` and `AUTH_COOKIE_SAME_SITE` from its environment. `PORT`
  defaults to `5000`; cookie SameSite defaults to `Lax` in development and
  `None` in production to support separately hosted frontend and API projects.
  Production cookies remain `Secure` and `HttpOnly`; unsafe cookie-authenticated
  requests require the configured frontend origin.
- The frontend API uses `NEXT_PUBLIC_API_URL`, defaulting to
  `http://localhost:5000` in development. Production requires this variable
  and an HTTPS URL.
- In production, `FRONTEND_ORIGIN` must use HTTPS. `mongodb://` connection
  strings must explicitly enable TLS; `mongodb+srv://` uses TLS unless
  explicitly disabled.
- Express accepts JSON request bodies up to 1 MB. CORS allows the configured
  frontend origin, credentials, and the `Content-Type` and `Authorization`
  headers.

## Endpoint summary

| Method | Path | Authentication | Current behavior |
|---|---|---|---|
| `GET` | `/api/health` | None | Reports API/database readiness |
| `POST` | `/api/auth/register` | None | Creates an account without starting a session |
| `POST` | `/api/auth/login` | None | Verifies credentials and sets an HttpOnly JWT cookie |
| `POST` | `/api/auth/logout` | Configured frontend origin | Clears the authentication cookie |
| `GET` | `/api/auth/me` | JWT cookie or bearer token | Returns the authenticated user's profile |
| `POST` | `/api/vehicles` | Bearer JWT | Creates a vehicle owned by the authenticated user |
| `GET` | `/api/vehicles` | Bearer JWT | Lists the authenticated user's vehicles |
| `GET` | `/api/vehicles/:id` | Bearer JWT | Gets one vehicle owned by the authenticated user |
| `PUT` | `/api/vehicles/:id` | Bearer JWT | Partially updates one owned vehicle |
| `DELETE` | `/api/vehicles/:id` | Bearer JWT | Permanently deletes one owned vehicle |
| `POST` | `/api/diagnostics` | Bearer JWT | Records a trouble code for an owned vehicle |
| `GET` | `/api/diagnostics` | Bearer JWT | Lists the authenticated user's diagnostic records |
| `GET` | `/api/diagnostics/:id` | Bearer JWT | Gets one owned diagnostic record |
| `PATCH` | `/api/diagnostics/:id` | Bearer JWT | Marks an active diagnostic record as resolved |
| `POST` | `/api/diagnostics/:id/analyze` | Bearer JWT | Returns a non-persisted development analysis |
| `POST` | `/api/maintenance` | Bearer JWT | Creates a maintenance record |
| `GET` | `/api/maintenance` | Bearer JWT | Lists the authenticated user's maintenance records |
| `GET` | `/api/maintenance/:id` | Bearer JWT | Gets one owned maintenance record |
| `PATCH` | `/api/maintenance/:id` | Bearer JWT | Marks scheduled maintenance as completed |
| `POST` | `/api/service-requests` | Bearer JWT | Creates a pending request |
| `GET` | `/api/service-requests` | Bearer JWT | Lists the authenticated user's service requests |
| `GET` | `/api/service-requests/:id` | Bearer JWT | Gets one owned service request |
| `PUT` | `/api/service-requests/:id` | Bearer JWT | Replaces editable fields on a pending request |
| `PATCH` | `/api/service-requests/:id` | Bearer JWT | Applies a permitted status transition |
| `DELETE` | `/api/service-requests/:id` | Bearer JWT | Permanently deletes a pending request |

For protected resource rows, the `Bearer JWT` label describes the explicit
Authorization-header option; browser requests can instead use the
`fleetcareAccessToken` HttpOnly cookie.

No separate controller layer currently exists. Route handlers live in
`routes/auth.js`, `routes/vehicles.js`, `routes/diagnostics.js`,
`routes/maintenance.js`, and `routes/serviceRequests.js`; `routes/api.js`
mounts them. The additional resource endpoint details are listed below.

## Authentication

### `POST /api/auth/register`

Creates a user and hashes the password in the User model's save hook. It does
not issue a JWT; the frontend directs the user to sign in.

Request:

```json
{
  "name": "Fleet Manager",
  "email": "manager@example.com",
  "password": "FleetCare123"
}
```

Validation and normalization:

- All three fields are required; the body must be a JSON object.
- `name` is trimmed, must not be empty or contain control characters, and is
  limited to 100 characters.
- `email` is trimmed, lowercased, checked against a basic email pattern, and
  limited to 254 characters.
- `password` must be a string of 8 to 72 UTF-8 bytes.
- Duplicate normalized emails return `409`.
- Registration rate limiting counts all requests, including malformed requests
  and duplicate-email attempts.
- Extra request fields are currently ignored.

Success: `201 Created`.

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "665f00000000000000000001",
      "name": "Fleet Manager",
      "email": "manager@example.com",
      "role": "user",
      "createdAt": "2026-11-03T10:00:00.000Z",
      "updatedAt": "2026-11-03T10:00:00.000Z"
    }
  }
}
```

### `POST /api/auth/login`

Request:

```json
{
  "email": "manager@example.com",
  "password": "FleetCare123"
}
```

Email is trimmed and lowercased. Missing/wrongly typed email or password
returns `400`; malformed email and incorrect credentials return the same
generic `401` credentials error. Passwords over 72 UTF-8 bytes also return
that generic `401`.

Login is limited to 10 attempts per client IP per 15 minutes. Requests rejected
by the limit return `429 Too Many Requests`, code `RATE_LIMIT_EXCEEDED`, and a
`Retry-After` header.

Valid credentials issue a JWT in the `fleetcareAccessToken` HttpOnly cookie and
return the safe user profile. This includes legacy accounts whose stored
`emailVerified` field is false; email verification is no longer required.
Unknown users and incorrect passwords return the same generic credentials
error.

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "665f00000000000000000001",
      "name": "Fleet Manager",
      "email": "manager@example.com",
      "role": "user",
      "createdAt": "2026-11-03T10:00:00.000Z",
      "updatedAt": "2026-11-03T10:00:00.000Z"
    }
  }
}
```

### `GET /api/auth/me`

Requires a valid JWT cookie or bearer token. Returns the current
database-backed profile:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "665f00000000000000000001",
      "name": "Fleet Manager",
      "email": "manager@example.com",
      "role": "user",
      "createdAt": "2026-11-03T10:00:00.000Z",
      "updatedAt": "2026-11-03T10:00:00.000Z"
    }
  }
}
```

Missing token returns `401` with code `UNAUTHORIZED` and message
`Authentication is required`. Invalid or expired tokens and tokens whose
subject no longer maps to a user return `401` with code `UNAUTHORIZED` and
message `Invalid or expired authentication token`.

### `POST /api/auth/logout`

Requires the exact configured `FRONTEND_ORIGIN` request origin. Success is
`200 OK` with `{ "success": true, "data": { "loggedOut": true } }` and an
expired `fleetcareAccessToken` cookie. This clears the browser cookie but does
not revoke a copied JWT; it remains valid until expiry or the user is removed.

The browser stores the JWT only in the HttpOnly cookie and sends it with
credentialed API requests. Protected pages call `/api/auth/me` before
rendering; a `401` redirects to `/login`. Sign out calls the backend logout
endpoint to clear the cookie. Cookie-authenticated state-changing requests
require the exact configured frontend `Origin`; missing or different origins
return `403 CSRF_CHECK_FAILED`. Bearer-authenticated requests do not rely on
cookies and are not subject to that cookie CSRF check.

## Vehicles

All vehicle routes require a valid JWT cookie or bearer token. The server
derives `owner` from the authenticated user; callers must not send an owner
ID. List, get, update, and delete queries are scoped to that user. An
inaccessible vehicle is reported as not found.

Vehicle response objects have this shape:

```json
{
  "id": "665f00000000000000000002",
  "vehicleName": "Delivery Truck",
  "registrationNumber": "AB123CD",
  "make": "Volvo",
  "model": "FH",
  "year": 2022,
  "vehicleType": "Truck",
  "odometer": 12000,
  "odometerUnit": "km",
  "healthStatus": "Healthy",
  "owner": "665f00000000000000000001",
  "createdAt": "2026-11-03T10:00:00.000Z",
  "updatedAt": "2026-11-03T10:00:00.000Z"
}
```

Allowed vehicle types are `Truck`, `Van`, `Car`, `Pickup`, and `Other`.
Odometer units are `km` and `miles`; health statuses are `Healthy`,
`Needs Attention`, and `Critical`.

### `POST /api/vehicles`

Creates a vehicle owned by the authenticated user.

Required JSON fields:

```json
{
  "vehicleName": "Delivery Truck",
  "registrationNumber": "AB 123 CD",
  "make": "Volvo",
  "model": "FH",
  "year": 2022,
  "vehicleType": "Truck",
  "odometer": 12000,
  "odometerUnit": "km"
}
```

`healthStatus` is optional and defaults to `Healthy`. Registration numbers are
trimmed, whitespace is removed, and letters are uppercased. They must then
match 2-20 uppercase letters, digits, or hyphens. Uniqueness is scoped to the
owner, using a unique compound index on `{ owner, registrationNumber }`.
Unknown fields (including `owner`) are rejected.

Success: `201 Created`

```json
{
  "success": true,
  "data": {
    "vehicle": {
      "id": "665f00000000000000000002",
      "vehicleName": "Delivery Truck",
      "registrationNumber": "AB123CD",
      "make": "Volvo",
      "model": "FH",
      "year": 2022,
      "vehicleType": "Truck",
      "odometer": 12000,
      "odometerUnit": "km",
      "healthStatus": "Healthy",
      "owner": "665f00000000000000000001",
      "createdAt": "2026-11-03T10:00:00.000Z",
      "updatedAt": "2026-11-03T10:00:00.000Z"
    }
  }
}
```

### `GET /api/vehicles`

Returns only vehicles whose owner is the authenticated user, sorted by
`createdAt` descending. There is no pagination or filtering contract yet.

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "vehicles": [
      {
        "id": "665f00000000000000000002",
        "vehicleName": "Delivery Truck",
        "registrationNumber": "AB123CD",
        "make": "Volvo",
        "model": "FH",
        "year": 2022,
        "vehicleType": "Truck",
        "odometer": 12000,
        "odometerUnit": "km",
        "healthStatus": "Healthy",
        "owner": "665f00000000000000000001",
        "createdAt": "2026-11-03T10:00:00.000Z",
        "updatedAt": "2026-11-03T10:00:00.000Z"
      }
    ]
  }
}
```

### `GET /api/vehicles/:id`

Returns one vehicle scoped to both the requested MongoDB ObjectId and
authenticated owner. Success: `200 OK`, with
`{ "success": true, "data": { "vehicle": { ... } } }`.

### `PUT /api/vehicles/:id`

Despite the `PUT` method, the implementation accepts a partial update. Send a
JSON object containing one or more editable fields; omitted fields are left
unchanged. For example:

```json
{
  "odometer": 13500,
  "odometerUnit": "km"
}
```

The route returns `200 OK` with the updated vehicle envelope. Empty bodies and
unsupported fields are rejected. `owner` is not editable. Updates run Mongoose
validators and use an owner-scoped query.

### `DELETE /api/vehicles/:id`

Permanently deletes the owner-scoped vehicle. Success is `200 OK` and returns
the deleted vehicle in the same `data.vehicle` envelope. This is not an
archive/soft-delete operation.

## Diagnostics

All diagnostic endpoints require a valid JWT cookie or bearer token. The owner
is always derived from the authenticated user. A diagnostic can only be
created for a vehicle owned by that user; inaccessible vehicles and records
are reported as not found. Diagnostic trouble codes and severity are recorded
information, not confirmed component failures or mechanic diagnoses.

| Method | Path | Authentication | Current behavior |
|---|---|---|---|
| `POST` | `/api/diagnostics` | Bearer JWT | Records a trouble code for an owned vehicle |
| `GET` | `/api/diagnostics` | Bearer JWT | Lists the authenticated user's diagnostic records |
| `GET` | `/api/diagnostics/:id` | Bearer JWT | Gets one owned diagnostic record |
| `PATCH` | `/api/diagnostics/:id` | Bearer JWT | Marks an active record as resolved |
| `POST` | `/api/diagnostics/:id/analyze` | Bearer JWT | Returns a non-persisted development analysis |

Diagnostic records store a vehicle reference, code, optional description,
source, severity, status, detection timestamp, odometer reading and unit,
optional notes, and timestamps. The database index supports owner/vehicle
history queries. Records are retained if their vehicle is later permanently
deleted; in that case the API returns `Vehicle unavailable` for the vehicle
name.

### `POST /api/diagnostics`

Required JSON fields:

```json
{
  "vehicleId": "665f00000000000000000002",
  "code": "P0301",
  "severity": "High",
  "dateDetected": "2026-11-03T10:00:00.000Z",
  "odometer": 12000,
  "odometerUnit": "km"
}
```

`source` is optional and defaults to `Manual`; accepted values are `Manual`,
`OBD-II`, `Telematics`, and `Other`. `description` and `notes` are optional.
Accepted severity values are `Critical`, `High`, `Medium`, and `Low`.
`odometer` must be a whole number from 0 to 2000000 and its unit must match the
selected vehicle. `dateDetected` must be an ISO timestamp with a timezone and
cannot be in the future. OBD-II and SPN/FMI codes are normalized to uppercase.
Unknown fields, including `owner` and `status`, are rejected.

Success: `201 Created`

```json
{
  "success": true,
  "data": {
    "diagnostic": {
      "id": "665f00000000000000000003",
      "vehicleId": "665f00000000000000000002",
      "vehicleName": "Delivery Truck",
      "registrationNumber": "AB123CD",
      "code": "P0301",
      "description": "",
      "issueDescription": "Description not provided",
      "source": "Manual",
      "severity": "High",
      "status": "Active",
      "dateDetected": "2026-11-03T10:00:00.000Z",
      "odometer": 12000,
      "odometerUnit": "km",
      "notes": "",
      "createdAt": "2026-11-03T10:01:00.000Z",
      "updatedAt": "2026-11-03T10:01:00.000Z"
    }
  }
}
```

### `GET /api/diagnostics`

Returns the authenticated user's records sorted by `dateDetected` descending.
The optional `vehicleId` query parameter filters the list to a valid vehicle
ID; an invalid ID returns `400 INVALID_VEHICLE_ID`. Success: `200 OK`, with
`{ "success": true, "data": { "diagnostics": [ ... ] } }`. Pagination is not
implemented.

### `GET /api/diagnostics/:id`

Returns one record belonging to the authenticated user with the same
`data.diagnostic` response shape. A malformed record ID returns
`400 INVALID_DIAGNOSTIC_ID`; a missing or inaccessible record returns
`404 NOT_FOUND`.

### `PATCH /api/diagnostics/:id`

Accepts only `{ "status": "Resolved" }` and transitions an active record to
resolved. Other body fields or status values return `400 INVALID_DIAGNOSTIC`.
The update is owner-scoped; no general-purpose edit or reopen operation exists.
Success: `200 OK` with the updated `data.diagnostic`.

### `POST /api/diagnostics/:id/analyze`

Analyzes an owner-scoped diagnostic record without changing it. The request
does not require a body. Success: `200 OK`, with
`{ "success": true, "data": { "analysis": { ... } } }`. The response contains
the provider name, whether the code is supported, possible causes,
recommended checks, the user-recorded severity, uncertainty, required
mechanic review, and a human-approval requirement for external actions.

No AI provider or model has been approved. The current backend uses a
provider-independent service interface with a safe mock adapter; no external
AI service or API key is configured. The mock adapter contains only a limited
reference for `P0301`. Other codes return an explicit unsupported result with
no inferred causes. Provider failures are propagated to centralized error
handling and do not produce a success-shaped fallback. The frontend displays
this as a development mock response and no analysis result is persisted.
Bookings, purchases, and other external actions are not available.

## Maintenance

All maintenance endpoints require a valid JWT cookie or bearer token and are
scoped to the authenticated user. The owner is not accepted from the request
body. Each record references a vehicle owned by that user.

| Method | Path | Authentication | Current behavior |
|---|---|---|---|
| `POST` | `/api/maintenance` | Bearer JWT | Creates a maintenance record |
| `GET` | `/api/maintenance` | Bearer JWT | Lists the user's maintenance records |
| `GET` | `/api/maintenance/:id` | Bearer JWT | Gets one owned maintenance record |
| `PATCH` | `/api/maintenance/:id` | Bearer JWT | Marks scheduled work completed |

### `POST /api/maintenance`

Required JSON fields are `vehicleId`, `type`, `description`,
`maintenanceDate`, `odometer`, `odometerUnit`, and `status`.

```json
{
  "vehicleId": "665f00000000000000000002",
  "type": "Oil change",
  "description": "Replace engine oil and inspect fluid levels.",
  "maintenanceDate": "2026-11-12",
  "odometer": 12000,
  "odometerUnit": "km",
  "status": "Upcoming"
}
```

Accepted types are `Oil change`, `Tire rotation`, `Brake inspection`,
`General servicing`, and `Other`. Status is `Upcoming`, `Overdue`, or
`Completed`; scheduled status must agree with the date, and completed dates
cannot be in the future. Odometer must be a whole number from 0 to 2000000 and
its unit must match the vehicle. Success: `201 Created`, with
`{ "success": true, "data": { "maintenance": { ... } } }`.

### `GET /api/maintenance` and `GET /api/maintenance/:id`

The list is owner-scoped and sorted by scheduled date ascending. The optional
`vehicleId` query parameter filters by a valid vehicle ID. Both list and detail
responses use a `maintenance` object/list containing the record ID, vehicle
summary, type, description, scheduled date, completion date when applicable,
odometer and unit, status, and timestamps.

### `PATCH /api/maintenance/:id`

Accepts only `{ "status": "Completed" }`. The completion timestamp is set by
the server. Only owner-scoped `Upcoming` or `Overdue` records can be completed;
completed records cannot be transitioned again. This operation records a
user-reported completion and is not confirmation from a service provider.

## Service requests

All service-request endpoints require a valid JWT cookie or bearer token and
are scoped to the authenticated user. A request is not a service booking;
preferred dates do not indicate availability or confirmation.

| Method | Path | Authentication | Current behavior |
|---|---|---|---|
| `POST` | `/api/service-requests` | Bearer JWT | Creates a Pending request |
| `GET` | `/api/service-requests` | Bearer JWT | Lists the user's requests |
| `GET` | `/api/service-requests/:id` | Bearer JWT | Gets one owned request |
| `PUT` | `/api/service-requests/:id` | Bearer JWT | Replaces editable fields on a Pending request |
| `PATCH` | `/api/service-requests/:id` | Bearer JWT | Applies a permitted status transition |
| `DELETE` | `/api/service-requests/:id` | Bearer JWT | Permanently removes a Pending request |

### `POST /api/service-requests`

Required JSON fields are `vehicleId`, `serviceType`, `description`, `priority`,
and `preferredDate`. `notes` is optional.

```json
{
  "vehicleId": "665f00000000000000000002",
  "serviceType": "General inspection",
  "description": "Inspect the warning indicator.",
  "priority": "High",
  "preferredDate": "2026-11-12",
  "notes": "Driver reported an intermittent warning."
}
```

Accepted service types are `General inspection`, `Engine repair`, `Oil change`,
`Brake inspection`, `Tire service`, and `Other`; priorities are `Low`,
`Medium`, `High`, and `Critical`. Preferred dates must be valid and not in the
past. `requestedDate` and initial `Pending` status are set by the server.
Success: `201 Created`, with
`{ "success": true, "data": { "request": { ... } } }`. Request IDs are
generated from the creation year and database ID.

### `GET /api/service-requests` and `GET /api/service-requests/:id`

The list is owner-scoped, sorted by request date descending, and accepts an
optional valid `vehicleId` filter. Response objects include `id`, generated
`requestId`, vehicle summary, service type, description, requested and
preferred dates, priority, status, notes, and timestamps.

### `PUT /api/service-requests/:id`

Replaces the editable request fields. It is allowed only while the
owner-scoped request is `Pending`; all editable fields are required. The
vehicle must also belong to the authenticated user.

### `PATCH /api/service-requests/:id`

Accepts only `{ "status": "<next status>" }`. The allowed transitions are:

| Current status | Allowed next status |
|---|---|
| `Pending` | `Approved`, `Rejected` |
| `Approved` | `In Progress`, `Rejected` |
| `In Progress` | `Completed` |
| `Completed` | None |
| `Rejected` | None |

There is no role or organization membership model, so these transitions are
currently available to any authenticated owner of the record. Invalid
transitions return `400 INVALID_STATUS_TRANSITION`.

### `DELETE /api/service-requests/:id`

Permanently deletes only a `Pending` request belonging to the authenticated
user. Missing, inaccessible, or non-pending requests return `404 NOT_FOUND`.
No service provider, booking, or external integration is contacted.

## Errors and status codes

Typical error body:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_VEHICLE",
    "message": "All required vehicle fields must be provided"
  }
}
```

| Status | Current use | Example codes/messages |
|---|---|---|
| `400` | Invalid request/body/resource ID or status transition | `INVALID_INPUT`, `INVALID_VEHICLE`, `INVALID_DIAGNOSTIC`, `INVALID_MAINTENANCE`, `INVALID_SERVICE_REQUEST`, `INVALID_STATUS_TRANSITION`, `INVALID_DIAGNOSTIC_ID`, `INVALID_MAINTENANCE_ID`, `INVALID_SERVICE_REQUEST_ID`, `INVALID_VEHICLE_ID`, `INVALID_JSON` |
| `401` | Missing/invalid token or invalid credentials | `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| `403` | Cookie-authenticated write has missing/untrusted Origin, or logout origin is not configured | `CSRF_CHECK_FAILED` |
| `404` | Unknown API route or inaccessible/missing resource | `NOT_FOUND`, `VEHICLE_NOT_FOUND` |
| `409` | Duplicate registration or concurrent status transition | `EMAIL_ALREADY_REGISTERED`, `REGISTRATION_NUMBER_IN_USE`, `INVALID_STATUS_TRANSITION` |
| `429` | Authentication request limit exceeded | `RATE_LIMIT_EXCEEDED` |
| `500` | Unhandled errors, including errors without an explicit route mapping | `INTERNAL_SERVER_ERROR` |
| `503` | MongoDB is not ready at the health endpoint | Degraded health body described below |

Most errors use `{ success: false, error: { code, message } }`. Messages are
not fully uniform: vehicle validation returns field-specific text, generic
request errors return `Request failed`, and auth distinguishes missing from
invalid/expired tokens.

Malformed JSON is handled by centralized middleware as `400 INVALID_JSON`.
Unhandled server errors are logged server-side and return a generic
`500 INTERNAL_SERVER_ERROR`; stack traces are not sent in the response.
The API disables Express's `X-Powered-By` header and sets
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and
`Permissions-Policy`. HTTPS termination and HSTS remain deployment
responsibilities because no hosting/proxy environment is specified.

The authentication rate limit counters are stored in process memory. Limits
reset when the backend process restarts and are not shared across multiple
instances, so production deployments with multiple workers/replicas need a
shared rate-limit store. The limiter uses Express's `req.ip`; `trust proxy` is
not enabled in the current app. A deployment behind a reverse proxy must
configure only its trusted proxy hops if the originating client IP is needed.

### Health response

`GET /api/health` returns `200` when Mongoose reports a connected state:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": { "connected": true }
  }
}
```

When disconnected, it returns `503` with `success: false` and the same `data`
shape using `"status": "degraded"` and `"connected": false`. This response
does not use the normal `error` envelope.

### Unknown API routes

Unknown routes under `/api` return `404`:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found"
  }
}
```

## Current frontend API usage

`frontend/lib/api-client.js` provides the shared credentialed request helper.
It sends the HttpOnly auth cookie with API requests and uses
`NEXT_PUBLIC_API_URL` (development default `http://localhost:5000`; required
and HTTPS-only in production). The authenticated frontend clients currently
call:

- `GET /api/vehicles`, `GET /api/diagnostics`, and
  `GET /api/maintenance` when the dashboard loads or is retried.
- `GET /api/vehicles` when the vehicle page loads or is retried.
- `POST /api/vehicles` when the Add Vehicle form is submitted.
- `GET /api/diagnostics` and `GET /api/vehicles` when the diagnostics page loads.
- `POST /api/diagnostics` when a diagnostic is recorded.
- `PATCH /api/diagnostics/:id` when an active record is marked resolved.
- `POST /api/diagnostics/:id/analyze` when the AI workflow analyzes a saved record.
- `GET /api/maintenance` and `GET /api/vehicles` when maintenance loads.
- `POST /api/maintenance` when a maintenance record is added.
- `PATCH /api/maintenance/:id` when scheduled maintenance is completed.
- `GET /api/service-requests` and `GET /api/vehicles` when requests load.
- `POST /api/service-requests` when a request is submitted.
- `PUT /api/service-requests/:id` when a pending request is edited.
- `PATCH /api/service-requests/:id` when its status changes.
- `DELETE /api/service-requests/:id` when a pending request is cancelled.

Browser requests include credentials so the HttpOnly cookie is sent. The
vehicle form maps its UI fields to the backend contract (`name` to `vehicleName`,
`manufacturer` to `make`, and `odometerKm` to `odometer` with
`odometerUnit: "km"`). Diagnostic creation uses the selected vehicle's
odometer unit and sends a timezone-qualified timestamp. Maintenance and
service-request flows send the authenticated vehicle ID and validated form
fields. Clients use their resource-specific `data` properties and display API
errors. On `401`, the route guard redirects to `/login`. The frontend calls
registration, login, `/api/auth/me`, and `/api/auth/logout` for signup,
sign-in, protected-route verification, and sign-out. It does not currently
call the vehicle detail, update, or delete endpoints. Diagnostic capture, AI
mock analysis, maintenance, and service requests are connected to backend APIs.
Parts, telematics hardware, and external booking/provider integrations do not
exist. Dashboard vehicle totals and health distribution use saved vehicles;
recent diagnostic activity and upcoming maintenance use their persisted
records.

## Inconsistencies and incomplete contracts

These are observations, not runtime changes:

1. **Health error shape:** degraded health returns `success: false` with
   `data`, unlike other errors, which return an `error` object.
2. **Duplicate-key fallback:** the centralized handler maps any uncaught
   MongoDB duplicate-key error to `EMAIL_ALREADY_REGISTERED`. Vehicle create
   and update currently catch duplicate registration errors themselves and
   return `REGISTRATION_NUMBER_IN_USE`, but the global fallback is misleading
   for other collections.
3. **PUT semantics:** vehicle `PUT` is partial-update behavior. Future
   contracts should either document and retain this behavior deliberately or
   reserve `PUT` for replacement and use `PATCH` for partial changes.
4. **Delete semantics:** vehicle deletion is permanent and returns the
   deleted object with `200`; no archived state exists.
5. **Ownership scope:** records are scoped to individual users. There is no
   Organization model or organization-wide access. Any future shared-access
   behavior requires explicit product approval and a defined data/authorization
   model.
6. **Validation failures:** route-level vehicle input checks return `400`.
   A Mongoose validation error that escapes those checks (for example during
   an update) has no explicit mapping in the central middleware and can become
   a generic `500` instead of a client validation response.
7. **Frontend/backend validation differs:** the frontend removes hyphens when
   checking for duplicate registrations, while the backend removes
   whitespace but retains hyphens. The frontend also requires whole-number
   odometers and a minimum year of 1900; backend validation accepts finite
   non-negative decimal odometers and years from 1886. Server validation
   remains authoritative.
8. **Response status detail:** registration and vehicle creation return
   `201`; login, reads, update, and delete return `200`. The API does not use
   `204`, including on deletion.
9. **No pagination/query contract:** vehicle listing returns the full
   owner-scoped collection and supports no query parameters.
10. **Frontend resource scope:** registration, login, and current-user
    verification are connected. The frontend does not currently call the
    vehicle detail, update, or delete endpoints.
11. **Error codes are not centrally specified:** codes are defined inline in
    route/middleware code. There is no shared error-code registry or formal
    OpenAPI schema.
12. **Remaining integrations:** diagnostics, maintenance, and service
    requests are persisted. AI responses use only a bounded mock adapter
    because no provider is approved. Telematics hardware, external
    service-provider booking, and spare-parts ordering are not implemented.

## Product and development limitations

- No live AI provider/model is configured. The analysis route uses a limited
  development mock and does not persist analysis results.
- No telematics hardware integration, external service-provider booking,
  spare-parts ordering, or organization-wide access is implemented.
- Service-request statuses are owner-managed workflow state; they do not
  represent provider approval or booking confirmation.
- A local Next.js development session previously reported that instant
  navigation could not be validated for a protected route segment and dropped
  it from instant-navigation validation. The observed redirect still worked;
  the warning remains an unresolved development observation, and production
  impact has not been established.

## Recommended convention for future modules

This is a recommendation only; existing runtime behavior above is unchanged.

- Use the `/api/<resource>` pattern and plural resource names.
- Use JSON request/response bodies with camelCase field names.
- Return success as `{ "success": true, "data": ... }`.
- Return all errors, including unavailable/degraded service errors, as
  `{ "success": false, "error": { "code": "...", "message": "..." } }`.
- Use stable, documented error codes; keep safe client messages generic where
  details are sensitive.
- Use `201` for resource creation, `200` for successful reads/updates, and
  consistently choose `204` or a documented `200` representation for
  deletion.
- Choose `PUT` for full replacement and `PATCH` for partial updates, or
  explicitly document a different established convention.
- Authenticate protected routes consistently and derive the existing
  authenticated-user ownership scope server-side; never accept ownership
  scope from request bodies. Add organization scope only after product
  approval and an explicit authorization design.
- Document validation constraints, enums, defaults, pagination, sorting,
  ownership behavior, and whether deletion is archival or permanent for each
  resource.
- Keep error translation centralized and map validation, conflict, not-found,
  and internal failures to the appropriate status without leaking internals.

## Source map

- Route registration: `routes/api.js`
- Authentication handlers: `routes/auth.js`
- Resource handlers: `routes/vehicles.js`, `routes/diagnostics.js`,
  `routes/maintenance.js`, `routes/serviceRequests.js`
- Authentication and error middleware: `middleware/authenticate.js`,
  `middleware/authRateLimit.js`, `middleware/errorHandler.js`,
  `middleware/notFound.js`
- Models: `models/User.js`, `models/Vehicle.js`,
  `models/DiagnosticRecord.js`, `models/MaintenanceRecord.js`,
  `models/ServiceRequest.js`
- Diagnostic analysis: `services/diagnosticAnalysisService.js` and
  `services/diagnosticAnalysis/providers/mockProvider.js`
- Express and JSON/CORS configuration: `app.js`, `config/env.js`
- Frontend auth and API clients: `../frontend/lib/auth-api.js`,
  `../frontend/lib/api-client.js`, and the resource clients under
  `../frontend/lib/`
- Frontend route protection and auth UI:
  `../frontend/components/auth-guard.js` and
  `../frontend/components/auth-page.js`
