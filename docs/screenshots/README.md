# Screenshot Capture Checklist

Drop the captured PNGs in this folder using the **exact** filenames below — the
root [README](../../README.md) references them in this order. Capture at a desktop
viewport (the UI is desktop-first).

| # | Page | Viewport | Recommended content to show | Filename |
|---|---|---|---|---|
| 1 | Dashboard | 1440×900 | KPI cards + Alert Type bar + IOC Type donut + "Dashboard updated Ns ago" | `dashboard.png` |
| 2 | AI Investigation | 1440×900 | A completed query: analysis + Sources/citations panel | `ai-investigation.png` |
| 3 | IOC Explorer | 1440×900 | Correlated-indicator table with an enriched public-IP verdict | `ioc-explorer.png` |
| 4 | MITRE Mapping | 1440×900 | Mapped techniques with tactic + confidence | `mitre-mapping.png` |
| 5 | Timeline | 1440×900 | Chronological events with severity indicators | `timeline.png` |
| 6 | Attack Graph | 1440×900 | React Flow graph for one upload (nodes + edges + legend) | `attack-graph.png` |
| 7 | Case Management | 1440×900 | Case detail drawer: status + notes + audit trail | `case-management.png` |
| 8 | Live Monitoring | 1440×900 | Alert stream + filters + "next refresh in Ns" / Connected | `live-monitoring.png` |
| 9 | RAG Evaluation | 1440×900 | Live latency cards + ranked chunks + offline benchmark table | `rag-evaluation.png` |

Tip: log in as `admin` and ingest the `demo/sample_logs/` files first so every page
has real data to display.
