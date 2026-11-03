# FleetCare frontend

This directory contains FleetCare's Next.js App Router frontend, implemented
with JavaScript and React. For full project architecture, backend setup,
authentication, data workflows, limitations, and tests, see the
[repository README](../README.md).

## Local development

Install dependencies and start the frontend:

```powershell
npm install
npm run dev
```

The frontend defaults to `http://localhost:3000` and the backend API defaults
to `http://localhost:5000`. Set `NEXT_PUBLIC_API_URL` when the backend uses a
different base URL. This public environment variable must not contain secrets.

Main App Router pages:

- `/` — dashboard
- `/vehicles` — vehicle management
- `/diagnostics` — diagnostic records
- `/ai-diagnostic-agent` — limited mock diagnostic analysis workflow
- `/maintenance` — maintenance records
- `/service-requests` — service requests
- `/login` and `/signup` — authentication

## Checks

```powershell
npm run lint
npm run build
```
