# NetGuard

NetGuard is a defensive network-monitoring project with a mobile Expo app, Vercel API functions, and a Python gateway backend.

## Structure

- `app/` - Expo Router entry routes
- `src/mobile/` - React Native screens, hooks, components, and services
- `src/features/` - SIM, reports, Wi-Fi, security, and vault feature code
- `api/` - Vercel serverless API handlers
- `src/cloud/` - Cloud and gateway integration code

## Requirements

- Node.js 20 or newer
- pnpm
- Expo CLI through the project dependencies

## Setup

```bash
corepack pnpm install
```

Create a local `.env` file for Expo API configuration:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://your-vercel-deployment.example
EXPO_PUBLIC_NETGUARD_API_KEY=your-public-api-key
```

Do not commit real credentials or private keys.

## Run

```bash
corepack pnpm start
corepack pnpm android
corepack pnpm ios
corepack pnpm web
```

## Validation

```bash
corepack pnpm typecheck
corepack pnpm exec expo install --check
corepack pnpm exec expo export --platform web --clear --output-dir dist
```

## API

The files in `api/` are Vercel JavaScript handlers. They support CORS and `OPTIONS` preflight requests for browser and Expo web clients.

Production API configuration requires the deployment environment variables used by the handlers, including `NETGUARD_API_KEY`, `NETGUARD_GATEWAY_URL`, and `NETGUARD_GATEWAY_TOKEN`.
