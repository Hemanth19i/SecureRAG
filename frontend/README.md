# SecureRAG — Frontend

React 19 + TypeScript single-page app (Vite) for the SecureRAG SOC console. It
talks to the Flask backend over a JWT-secured REST API.

## Stack

- **React 19 + TypeScript**, **Vite** (dev server + build)
- **Tailwind CSS** + **shadcn/ui** components
- **React Router** (`react-router`)
- **@xyflow/react** (React Flow) — Attack Graph
- **Recharts** — dashboard distribution charts
- **three.js** — dashboard hero canvas

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
```

The dev server proxies `/api` → `http://localhost:5000` (see `vite.config.ts`), so
the app talks to the backend **same-origin** — no `VITE_API_BASE_URL` and no CORS
config are needed in development. Start the backend (`server/`, port 5000) first.

```bash
npm run build    # tsc -b && vite build  → dist/
npm run lint     # eslint
```

For production builds set `VITE_API_BASE_URL` to the deployed API origin; serve
`dist/` behind nginx/Caddy with SPA fallback. See [../DEPLOYMENT.md](../DEPLOYMENT.md).

## Structure

```
src/
  pages/         one component per SOC view (Dashboard, Query, Upload,
                 Investigations, IOCExplorer, MITEMapping, TimelineAnalysis,
                 AttackGraph, CaseManagement, ThreatIntelligence, Reports,
                 LiveMonitoring, RetrievalEval, Settings)
  components/    Sidebar, TopBar, LoginScreen, HeroCanvas, charts/, ui/ (shadcn)
  lib/           api.ts (JWT client + silent refresh), backend.ts (response types,
                 mirrors server/tests/CONTRACT.md), auth.tsx, format.ts, useApi.ts
  App.tsx        routes + auth gate
  main.tsx       entry point
```

The backend response shapes in `src/lib/backend.ts` mirror
[`server/tests/CONTRACT.md`](../server/tests/CONTRACT.md) — the UI adapts to the
backend, never the reverse.
