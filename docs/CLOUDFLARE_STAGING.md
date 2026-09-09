# Temporary Cloudflare Staging/Demo

This deployment keeps the existing application architecture:

```text
Cloudflare Pages (React/Vite static assets)
                  |
                  | VITE_API_URL
                  v
Cloudflare Quick Tunnel (temporary trycloudflare.com URL)
                  |
                  v
NestJS API container -> private PostgreSQL + Prisma
```

This is suitable for temporary staging/UAT only. Quick Tunnel URLs are
ephemeral, unauthenticated tunnel infrastructure with no uptime guarantee.
Do not use them for production or real patient data.

## Current status

The Pages project is deployed from canonical `main` at commit
`c033932fb16cc743c161964495cda3f275143f3e`.

- Pages project: `clinic-staging`
- Stable Pages URL: https://clinic-staging-e0d.pages.dev
- Deployment URL: https://219b3cbd.clinic-staging-e0d.pages.dev
- API Quick Tunnel: https://programmers-casino-occasion-browsers.trycloudflare.com
- Pages deployment source: `c033932`

The local API Quick Tunnel was started for verification:

Verified:

```text
GET https://programmers-casino-occasion-browsers.trycloudflare.com/api/health
-> 200, database connected
```

The Quick Tunnel URL is temporary and may stop working when the local
`cloudflared` process exits. The Pages URL is a staging/demo hostname and is
not a production hostname.

## Cloudflare Pages configuration

Create a Pages project from the GitHub repository
`mohameddataengineer7-eng/Clinic`:

- Production branch: `main`
- Framework preset: `Vite`
- Root directory: `/`
- Build command: `npm run build --workspace=apps/web`
- Build output directory: `apps/web/dist`
- Node.js version: `20`
- Environment variable:
  - `VITE_API_URL=https://programmers-casino-occasion-browsers.trycloudflare.com`

The repository root is required because the build command uses the npm
workspace. The `apps/web/public/_redirects` file preserves React Router deep
links on Pages.

The deployed build was produced from a clean checkout of remote `main` at
`c033932fb16cc743c161964495cda3f275143f3e`.
The Pages SPA fallback was supplied as the deployment artifact
`apps/web/dist/_redirects`; it contains:

```text
/* /index.html 200
```

Verified direct navigation returned HTTP 200 for:

```text
/login
/dashboard
/patients
/appointments
/visits
/invoices
/reports
/settings
```

## Local API and Quick Tunnel

Start the existing local stack without exposing PostgreSQL:

```powershell
docker compose up -d postgres api web
```

Confirm the local API:

```powershell
Invoke-WebRequest http://localhost:3001/api/health
```

Start a new temporary tunnel:

```powershell
cloudflared tunnel --url http://localhost:3001
```

Use the printed URL as the Pages `VITE_API_URL` value and redeploy Pages. The frontend
configuration normalizes a host URL to the `/api` base automatically, so both
the tunnel root and a URL ending in `/api` are accepted.

The API's production CORS configuration must use the actual Pages origin:

```text
FRONTEND_URL=https://clinic-staging-e0d.pages.dev
```

Restart the API after changing this value. Do not use `*`, localhost, or a
production database for staging.

## Required local API variables

The existing API container requires:

```text
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=<local-only-secret>
JWT_REFRESH_SECRET=<different-local-only-secret>
FRONTEND_URL=<Pages-origin-when-known>
```

Production-like containers additionally require:

```text
BACKUP_ENCRYPTION_KEY=<out-of-band-32-byte-key>
```

Never commit these values or place them in Pages source files. `VITE_API_URL`
is public configuration, but it must still contain only the temporary API URL,
never credentials.

## Security and data boundaries

- PostgreSQL remains private on the Docker network.
- Do not publish port 5432.
- The Quick Tunnel exposes only the API HTTP service.
- Do not use production credentials, backups, or patient data.
- Do not cache authenticated API responses or financial pages.
- Pages static assets may be cached; API responses must remain uncached.
- Quick Tunnel has no stable hostname, access policy, SLA, or production
  suitability.

## Verification checklist

After Pages deployment and API CORS configuration, verify:

1. Pages `/login` loads directly.
2. Login succeeds through the tunnel.
3. Dashboard and patients load through authenticated API calls.
4. Patient edit persisted a staging-only English-name update.
5. Visit creation succeeded and returned to the patient profile with a success
   notification.
6. Invoice context showed the expected 50.00 KD total, 30.00 KD paid, and
   20.00 KD remaining balance.
7. A 1.00 KD payment succeeded; the displayed balance changed to 19.00 KD.
8. Arabic/English switching, RTL, and 390px mobile layout were verified with
   no horizontal overflow.
9. `GET /api/health` reports a connected database.

Payment reversal was not repeated in this deployment; it was verified in the
previous local release gate. The remaining financial and responsive workflows
must be re-run whenever the Quick Tunnel URL changes or when a different Pages
deployment is promoted.

## Stop, restart, and rollback

Stop the tunnel with `Ctrl+C` in its running terminal. Starting it again
generates a new URL; update the Pages `VITE_API_URL` variable and redeploy.

To remove the demo:

1. Delete or disable the Pages project.
2. Stop `cloudflared`.
3. Stop the local API/container stack if it is no longer needed.
4. Remove temporary Pages environment variables.

No database rollback is required for this frontend/tunnel setup. If staging
data was created, remove it only through the application's supported local
maintenance workflow after taking any required local backup.

## Moving to a real deployment

For production, replace the Quick Tunnel with a named Cloudflare Tunnel and a
custom hostname. Configure DNS and TLS through Cloudflare, set the API
`FRONTEND_URL` to the stable HTTPS frontend origin, keep PostgreSQL private,
and retain the existing Docker production/Nginx deployment as the origin
fallback. Re-run the complete release and backup/restore gates before using
real data.
