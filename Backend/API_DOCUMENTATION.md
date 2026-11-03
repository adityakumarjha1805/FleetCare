# FleetCare API Documentation

This document describes the behavior implemented in the current repository. It
is not a proposal for endpoints that do not yet exist.

## Conventions and setup

- The API is mounted at `/api`; there is no version prefix.
- Requests with bodies use JSON (`Content-Type: application/json`).
- JSON responses normally use `{ "success": true, "data": ... }` on success
  and `{ "success": false, "error": { "code": "...", "message": "..." } }`
  on failure. The health endpoint's degraded response is an exception.
- Protected routes accept `Authorization: Bearer <JWT>`.
- The JWT is signed with HS256, issued by `fleetcare-api`, intended for
  `fleetcare-client`, and expires after one hour. Protected requests also
  resolve the token subject to an existing user.
- The backend reads `MONGODB_URI`, `FRONTEND_ORIGIN`, `JWT_SECRET`, and
  optional `PORT` from its environment. `PORT` defaults to `5000`.
- The frontend vehicle API uses `NEXT_PUBLIC_API_URL`, defaulting to
  `http://localhost:5000`, and reads the token from
  `localStorage.accessToken`.
- Express accepts JSON request bodies up to 1 MB. CORS allows the configured
  frontend origin and the `Content-Type` and `Authorization` headers.

## Endpoint summary

| Method | Path | Authentication | Current behavior |
|---|---|---|---|
| `GET` | `/api/health` | None | Reports API/database readiness |
| `POST` | `/api/auth/register` | None | Creates a user |
| `POST` | `/api/auth/login` | None | Verifies credentials and issues a JWT |
| `GET` | `/api/auth/me` | Bearer JWT | Returns the authenticated user's profile |
| `POST` | `/api/vehicles` | Bearer JWT | Creates a vehicle owned by the authenticated user |
| `GET` | `/api/vehicles` | Bearer JWT | Lists the authenticated user's vehicles |
| `GET` | `/api/vehicles/:id` | Bearer JWT | Gets one vehicle owned by the authenticated user |
| `PUT` | `/api/vehicles/:id` | Bearer JWT | Partially updates one owned vehicle |
| `DELETE` | `/api/vehicles/:id` | Bearer JWT | Permanently deletes one owned vehicle |

No separate controller layer currently exists. Route handlers live in
`routes/auth.js` and `routes/vehicles.js`; `routes/api.js` mounts them.

## Authentication

### `POST /api/auth/register`

Creates a user. The password is hashed in the User model's save hook and is
never included in the response.

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
- Extra request fields are currently ignored.

Success: `201 Created`

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

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "token": "<signed JWT>",
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

Requires a valid bearer JWT. Returns the current database-backed profile:

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

## Vehicles

All vehicle routes require a bearer JWT. The server derives `owner` from the
authenticated user; callers must not send an owner ID. List, get, update, and
delete queries are scoped to that user. An inaccessible vehicle is reported as
not found.

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
| `400` | Invalid request/body/vehicle ID | `INVALID_INPUT`, `INVALID_VEHICLE`, `INVALID_VEHICLE_ID`, `INVALID_JSON` |
| `401` | Missing/invalid token or invalid credentials | `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| `404` | Unknown API route or inaccessible/missing vehicle | `NOT_FOUND` |
| `409` | Duplicate email or owner-scoped vehicle registration | `EMAIL_ALREADY_REGISTERED`, `REGISTRATION_NUMBER_IN_USE` |
| `500` | Unhandled errors, including errors without an explicit route mapping | `INTERNAL_SERVER_ERROR` |
| `503` | MongoDB is not ready at the health endpoint | Degraded health body described below |

Most errors use `{ success: false, error: { code, message } }`. Messages are
not fully uniform: vehicle validation returns field-specific text, generic
request errors return `Request failed`, and auth distinguishes missing from
invalid/expired tokens.

Malformed JSON is handled by centralized middleware as `400 INVALID_JSON`.
Unhandled server errors are logged server-side and return a generic
`500 INTERNAL_SERVER_ERROR`; stack traces are not sent in the response.

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

`frontend/lib/vehicles-api.js` calls only:

- `GET /api/vehicles` when the vehicle page loads or is retried.
- `POST /api/vehicles` when the Add Vehicle form is submitted.

Both use the bearer token from `localStorage.accessToken`. The form maps its
UI fields to the backend contract (`name` to `vehicleName`, `manufacturer` to
`make`, and `odometerKm` to `odometer` with `odometerUnit: "km"`). The client
uses the `data.vehicles` and `data.vehicle` success properties and displays
backend error messages. It removes the stored token after a `401`.

The frontend does not currently call the login/register/current-user, vehicle
detail, update, or delete endpoints. There is no frontend diagnostic,
maintenance, service-request, AI, parts, or dashboard API client in the
current code.

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
   deleted object with `200`; the PRD describes archiving profiles. No
   archived state exists.
5. **Ownership scope:** vehicles are scoped to individual users. The PRD
   proposes organization-scoped data and organization-wide access, but there
   is no Organization model or organization authorization yet.
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
10. **Authentication API not connected in frontend:** a client can call
    auth endpoints, but the current frontend has no auth API integration
    documented here; the vehicle client expects a token already stored as
    `accessToken`.
11. **Error codes are not centrally specified:** codes are defined inline in
    route/middleware code. There is no shared error-code registry or formal
    OpenAPI schema.
12. **No diagnostic, maintenance, service-request, or parts APIs:** their
    current frontend features use local/sample data and do not have backend
    contracts in this repository.

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
- Authenticate protected routes consistently and derive user/organization
  scope server-side; never accept ownership scope from request bodies.
- Document validation constraints, enums, defaults, pagination, sorting,
  ownership behavior, and whether deletion is archival or permanent for each
  resource.
- Keep error translation centralized and map validation, conflict, not-found,
  and internal failures to the appropriate status without leaking internals.

## Source map

- Route registration: `routes/api.js`
- Authentication handlers: `routes/auth.js`
- Vehicle handlers: `routes/vehicles.js`
- Authentication and error middleware: `middleware/authenticate.js`,
  `middleware/errorHandler.js`, `middleware/notFound.js`
- Models: `models/User.js`, `models/Vehicle.js`
- Express and JSON/CORS configuration: `app.js`, `config/env.js`
- Frontend vehicle calls: `../frontend/lib/vehicles-api.js`
