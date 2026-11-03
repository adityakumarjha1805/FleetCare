# FleetCare

FleetCare is a fleet maintenance and diagnostic MVP for managing vehicles,
recording diagnostics, tracking maintenance, and submitting service requests.
The AI diagnostic workflow is a limited development mock, not a live AI
integration. This project is not production-ready.

## Architecture and technology

- `frontend/`: Next.js App Router with JavaScript and React.
- `Backend/`: Node.js, Express, and JavaScript.
- Persistence: MongoDB through Mongoose.
- Authentication: JWT in an HttpOnly cookie for browser sessions; bearer
  tokens are also accepted for non-browser API clients.

The frontend calls the Express API under `/api`. Protected API records are
scoped to the authenticated user. Organization memberships and organization-
wide access are not implemented.

## Local development

Requirements: Node.js/npm and a MongoDB instance accessible to the backend.

### Backend

In PowerShell, from the repository root:

```powershell
Copy-Item Backend\.env.example Backend\.env
cd Backend
npm install
npm run dev
```

Set these variables in `Backend\.env`:

| Variable | Requirement | Purpose |
|---|---|---|
| `MONGODB_URI` | Required | MongoDB connection URI |
| `FRONTEND_ORIGIN` | Required | Exact frontend origin allowed by CORS |
| `JWT_SECRET` | Required | JWT signing secret; provide a random secret of at least 32 bytes |
| `PORT` | Optional; defaults to `5000` | Backend listening port |
| `AUTH_COOKIE_SAME_SITE` | Optional; defaults to `Lax` | Cookie SameSite policy; `None` is allowed only with production HTTPS |

`Backend\.env.example` provides placeholders for local development. Do not
commit `.env` or put secrets in frontend variables.

### Frontend

In a second terminal, from the repository root:

```powershell
cd frontend
npm install
npm run dev
```

The frontend is served at `http://localhost:3000`. In development,
`NEXT_PUBLIC_API_URL` defaults to `http://localhost:5000`. Production requires
this variable to be set to an HTTPS API URL at build time. It is public client
configuration, not a place for secrets.

## Implemented workflows

- **Authentication:** `/signup` registers an account and then signs in;
  `/login` signs in. Protected pages check the session through `/api/auth/me`.
  The JWT is stored in an HttpOnly cookie, inaccessible to frontend
  JavaScript. Sign out clears the cookie; there is no server-side token
  revocation endpoint, so a copied JWT remains valid until expiry.
- **Vehicles:** authenticated users can create and list their own vehicle
  records persisted in MongoDB. The backend also has vehicle detail, update,
  and delete endpoints; the current frontend vehicle screen does not expose
  those operations.
- **Diagnostics:** users can record and resolve diagnostic records for their
  own vehicles. A trouble code is recorded information, not a confirmed
  component failure.
- **AI diagnostic analysis:** a backend provider-independent boundary uses a
  limited mock adapter. No live AI provider/model or external AI credentials
  are configured, and analysis is not persisted.
- **Maintenance:** maintenance records are persisted and can be marked
  completed as a user-reported action.
- **Service requests:** requests are persisted and have owner-scoped status
  transitions. They do not contact or book an external provider.
- **Dashboard:** displayed fleet, diagnostic, and maintenance summaries use
  saved records; they are not telematics-derived analytics.

See [Backend/API_DOCUMENTATION.md](Backend/API_DOCUMENTATION.md) for endpoint
methods, authentication, request/response formats, validation, and errors.

## Checks and tests

From the repository root:

```powershell
npm --prefix Backend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

The backend uses Node's built-in test runner (`node --test`). Its test suite
includes a MongoDB integration test that inserts temporary user, vehicle,
diagnostic, maintenance, and service-request records and removes them during
cleanup. Configure `MONGODB_URI` to use a disposable development/test database
before running the suite; the test command is not read-only.

## Security notes and limitations

- Cookie-authenticated writes require the exact configured frontend `Origin`
  to mitigate CSRF. The browser cookie uses `HttpOnly`, `SameSite=Lax` by
  default, and `Secure` in production. Cross-site deployments may set
  `AUTH_COOKIE_SAME_SITE=None` only in production HTTPS.
- Backend auth rate limits use in-memory counters and are not shared across
  instances; configure a shared store before multi-instance deployment.
- Production backend startup requires an HTTPS frontend origin and a TLS-
  enabled MongoDB URI. The frontend refuses to send API requests without a
  configured HTTPS `NEXT_PUBLIC_API_URL` in production.
- The application sets baseline security headers, but hosting-specific HTTPS
  termination, HSTS, database network restrictions, and secret management
  still require deployment configuration.
- There is no live AI provider, telematics hardware integration, external
  service-provider booking, spare-parts ordering, or organization-wide access.
- Service request statuses are owner-managed workflow values, not provider
  approval or booking confirmation.

### Development observation

A local Next.js development session previously reported that it could not
validate instant navigation for the protected `/vehicles` route. That page now
opts out of instant-navigation validation with `instant = false`; verify the
warning is absent in the development server before staging. The observed
redirect worked, and production impact was not established.
