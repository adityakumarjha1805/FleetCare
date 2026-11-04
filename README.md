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
| `AUTH_COOKIE_SAME_SITE` | Optional; defaults to `Lax` in development and `None` in production | Cookie SameSite policy; `None` requires production HTTPS |

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

## Deploying on Vercel

Deploy the frontend and API as **two Vercel projects** from the same
repository:

1. Import the repository for the frontend and set **Root Directory** to
   `frontend`. Use the Next.js framework preset and add
   `NEXT_PUBLIC_API_URL` as an environment variable for each environment. Its
   value is the API project's HTTPS origin only (for example,
   `https://fleetcare-api.vercel.app`), without a trailing slash or `/api`.
2. Import the repository again for the API and set **Root Directory** to
   `Backend`. Vercel deploys `api/[...path].js` as the Express API's
   serverless entry point.
3. Configure these API project environment variables:

   | Variable | Value |
   |---|---|
   | `MONGODB_URI` | A MongoDB Atlas connection string with TLS enabled |
   | `FRONTEND_ORIGIN` | The exact HTTPS origin of the frontend, with no path or trailing slash |
   | `JWT_SECRET` | A unique random secret of at least 32 bytes |
   | `AUTH_COOKIE_SAME_SITE` | Optional; defaults to `None` in production for the separately hosted frontend and API |

   Set variables for the Vercel environments you deploy (Production, Preview,
   and Development as applicable). The API allows one exact frontend origin,
   so use a stable custom or branch domain for previews and configure the
   matching frontend origin and API URL in that environment; per-commit
   preview URLs need a matching API origin before browser authentication will
   work. Keep secrets in Vercel's environment settings, not in
   `NEXT_PUBLIC_*` variables.
4. Allow the API deployment to connect to your MongoDB Atlas cluster, then
   deploy the API and set its URL as the frontend's `NEXT_PUBLIC_API_URL`.
   Check `https://<api-domain>/api/health`; a healthy deployment returns
   `{"success":true,"data":{"status":"ok","database":{"connected":true}}}`.

The API uses in-memory authentication rate-limit counters, which are not
shared across serverless instances. Use a shared rate-limit store before
relying on those limits across multiple instances.

## Implemented workflows

- **Authentication:** registration creates an account and directs the user to
  sign in. Password login issues an HttpOnly JWT cookie; protected pages check
  the session through `/api/auth/me`. Sign out clears the cookie; there is no
  server-side token revocation endpoint, so a copied JWT remains valid until
  expiry.
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
