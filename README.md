# NetGuard

NetGuard is a defensive network-monitoring app for the user's own network and devices. It combines an Expo app, Vercel API handlers, and gateway telemetry. It must not invent devices, traffic totals, reports, or verification results.

## Project layout

- `app/` - Active Expo Router routes used by `expo-router/entry`.
- `assets/icon.png` - NetGuard launcher icon.
- `src/features/wifi-monitor/` - Wi-Fi monitoring and local usage-alert logic.
- `src/mobile/` - Additional/older mobile screens, hooks, and services; it is not the active root route tree.
- `api/` - Vercel serverless API handlers.
- `src/cloud/` - Gateway and cloud integration code.
- `src/features/sim-monitor/` and `src/features/reports/` - SIM and report feature code.

The Stage 5 instructions also refer to `src/mobile/app/`; the active app in this checkout is the root `app/` directory. Keep that distinction in mind when adding routes.

## Current stage status

| Stage | Status |
| --- | --- |
| 1 · Wi-Fi monitoring | Device discovery and real Uno `wlan0` counters are surfaced. Since the Uno is a Wi-Fi client, those counters do not measure other phones or laptops. Per-device totals require router telemetry or a device-side agent. |
| 2 · Reports and signing | Not complete end-to-end. The active Reports screen shows recent in-memory snapshots and labels them unsigned; signature generation and verification are not wired through that screen. |
| 3 · SIM monitoring | Future scope. This build does not collect real SIM usage. The screen only offers manual Android mobile-data settings; mobile data is never disabled automatically. |
| 4 · Vercel API | Status, discovery, and usage handlers proxy gateway data, reject invalid/missing telemetry, and identify discovery-only versus interface-only measurements. Configure the Vercel environment before use. |
| 5 · Mobile app | The active Expo app includes dashboard, graph, reports, status, settings, and usage-alert screens. Native notification/background behavior still needs validation on real Android/iOS builds. |

Signed GitHub integrity recovery is not configured. The self-healing endpoint reports that state explicitly; it does not pull, replace, or execute source code.

## Run locally (development computer)

Use a Node.js release supported by Expo SDK 58 (`^22.13.0`, `^24.3.0`, `^26.0.0`, or `>=27.0.0`) and `pnpm`. Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test:usage
pnpm run start
```

`pnpm run start` opens the Expo development server. To start a platform directly, use `pnpm run android`, `pnpm run ios`, or `pnpm run web`. Local notifications and scheduled background sampling require a native app build; they are not fully testable in a browser.

Create `.env` in the repository root for the app's API connection:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://avishkarsms.vercel.app
EXPO_PUBLIC_NETGUARD_API_KEY=<your-client-api-key>
```

Replace the placeholder locally; do not commit a real key. `EXPO_PUBLIC_` variables are bundled into the app and are not confidential.

## Deploy the Vercel API

The current configured API base URL is [`https://avishkarsms.vercel.app`](https://avishkarsms.vercel.app). It serves API routes, not a website; a 404 at `/` is expected. API routes require the `x-api-key` header. An unauthenticated request returning 401 only confirms that the route is reachable; it does not confirm gateway data is working.

Before deploying, configure these server-side variables in the Vercel project settings. Never put the gateway token in the app's `EXPO_PUBLIC_` variables:

```text
NETGUARD_API_KEY=<server-api-key>
NETGUARD_GATEWAY_URL=<public-https-url-of-the-running-uno-monitor>
NETGUARD_GATEWAY_TOKEN=<gateway-api-token>
```

To deploy manually from this repository, first authenticate and link it to the correct Vercel project, then deploy production:

```bash
pnpm dlx vercel login
pnpm dlx vercel link
pnpm dlx vercel --prod
```

If Vercel is connected to the GitHub repository, push the reviewed changes to its production branch to trigger the configured deployment. Review `git status` before staging so unrelated files are not included:

```bash
git status --short
git add <reviewed-files>
git commit -m "Finalize NetGuard usage monitoring"
git push origin main
```

Verify with an authenticated `GET` request to `https://avishkarsms.vercel.app/api/status` and `https://avishkarsms.vercel.app/api/usage`. A successful status response and real interface counters confirm the gateway connection; do not treat an unauthenticated 401 as a successful data check.

## Get the latest code on Uno Q

The Uno Q needs Git, Docker Engine, and the Docker Compose plugin. Clone the repository once:

```bash
git clone https://github.com/HYDRA143/Avishkar.git ~/Avishkar
cd ~/Avishkar
```

Create a local `.env` in that checkout using the API URL and client key shown above. Keep this file private and do not commit it. The repository's `scripts/setup_uno.sh` is only a placeholder; use Docker Compose directly.

After the reviewed changes have been pushed to `main`, update and rebuild the Wi-Fi monitor on the Uno:

```bash
cd ~/Avishkar
git pull --ff-only origin main
docker compose --env-file .env -f docker/docker-compose.yml up -d --build wifi-monitor cloudflared
docker compose --env-file .env -f docker/docker-compose.yml logs -f cloudflared
```

The last command prints the Cloudflare Quick Tunnel URL. Set that HTTPS URL as `NETGUARD_GATEWAY_URL` in Vercel, then redeploy the Vercel project so its server-side configuration is active. Quick Tunnel URLs can change when the tunnel restarts; update the Vercel variable and redeploy again if that happens. A stable named tunnel needs separate Cloudflare tunnel credentials and is not configured by this repository.

Check the monitor directly on the Uno:

```bash
curl -fsS http://127.0.0.1:8080/status
```

The result should contain the real monitor guard, discovered devices, and interface counters. If the device is not running on Uno Q/Linux or telemetry is unavailable, the monitor reports that state; it does not generate sample devices or traffic.

The Vercel project must be configured with the current tunnel URL and a valid server-side gateway token before its authenticated usage endpoint can return data. Per-device traffic remains unavailable: this monitor measures the Uno's own interface, not traffic for other Wi-Fi clients.

## Run the app

The active routes include `/`, `/graph`, `/reports`, `/status`, `/settings`, `/alerts`, and `/sim_bypass`.

## Usage measurements and alerts

The dashboard can show discovered devices, but discovery is not per-device traffic accounting. All bandwidth totals and caps refer only to the Uno's `wlan0` interface. If the gateway does not return valid counters, the API reports an error rather than substituting zeroes or sample data.

The Usage Alerts screen supports locally stored hourly, daily, and weekly caps, local device notifications, and a daily anomaly reminder at 2× the previous day's observed usage. Caps are checked once per period; the hourly cap applies overnight too. Anomaly alerts are withheld when there is no measured prior-day baseline.

Usage history begins after monitoring is enabled and the initial counter baseline is collected; there is no retroactive history. Counter resets can leave an interval uncounted. Sampling runs about once per minute while the app is open. OS background tasks have a 15-minute minimum and may be delayed, so background totals and alerts are approximate and may arrive late. Data and alert history are stored locally on the phone.

## Reports, SIM, and recovery limitations

- Reports in the active app are recent in-memory telemetry snapshots, not signed or durable audit records.
- SIM usage is unavailable until a supported Android data source and permissions are implemented.
- GitHub integrity checks require a trusted signed baseline before verification or manual restoration can be implemented safely. No automatic source replacement is enabled.

## Validation

```bash
pnpm run typecheck
pnpm run test:usage
pnpm exec expo install --check
pnpm exec expo export --platform web --output-dir dist
```

The metrics tests exercise calculations only; their test inputs are isolated from the app and are never used as operational telemetry.
