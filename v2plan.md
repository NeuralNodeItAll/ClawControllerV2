# ClawControllerV2 — Mission Control Build Plan

## Architecture Overview
- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 + Zustand 5 + Lucide React icons + React Router DOM
- **Backend**: FastAPI + SQLite + SQLAlchemy
- **Real-time**: WebSockets
- **Design**: Liquid Glass theme (dark navy, frosted glass panels, Inter font)

---

## Phase 1: Foundation & Design System
- [x] **1.1** Install react-router-dom for multi-page routing
- [x] **1.2** Update Tailwind config with Liquid Glass color palette
- [x] **1.3** Replace CSS variables and index.css with Liquid Glass theme
- [x] **1.4** Replace App.css with Liquid Glass global styles
- [x] **1.5** Update index.html (title, favicon, Inter font)

## Phase 2: Layout — Sidebar + Router Shell
- [x] **2.1** Create Sidebar component (persistent left nav, 220px, all links, active states, footer)
- [x] **2.2** Create AppLayout wrapper (sidebar + routed content area)
- [x] **2.3** Set up React Router with all 10 page routes
- [x] **2.4** Update App.jsx to use Router + AppLayout

## Phase 3: Dashboard Page (Home)
- [x] **3.1** Create Dashboard page component
- [x] **3.2** Build StatusCard, WorkshopCard, ClientsCard (3-card row, glass design)
- [x] **3.3** Build StatusPopover (frosted glass floating panel with agent status, bandwidth, next check, load)
- [x] **3.4** Build LiveActivity section (scrollable activity entries with status icons + timestamps)
- [x] **3.5** Build RecentCommits section (git icon + commit list placeholder)

## Phase 4: Workshop Page
- [x] **4.1** Create Workshop page component with header + stats row (Queued/Active/Done counters)
- [x] **4.2** Build view toggle (Board / Live Feed)
- [x] **4.3** Build Kanban board — 3 columns (Queued, Active, Done) with count badges
- [x] **4.4** Build WorkshopTaskCard with color-coded tags, momentum badge, Start button
- [x] **4.5** Build TaskDetailModal (frosted glass modal with description, tags, dates, progress bar, activity log)
- [x] **4.6** Implement Momentum Score algorithm (adjacency 40%, capability 30%, priority 20%, age 10%)
- [x] **4.7** Add backend endpoint for momentum-scored tasks (`GET /api/tasks/momentum`)

## Phase 5: Cron Jobs Page
- [x] **5.1** Create CronJobs page component (purple header icon)
- [x] **5.2** Build CronJobCard (glass panel with orange play icon, title, description, schedule + next run countdown)
- [x] **5.3** Add toggle enable/disable + expand for execution history
- [x] **5.4** Wire to existing recurring tasks backend endpoints

## Phase 6: API Usage & Metrics Page
- [x] **6.1** Create ApiUsage page component
- [x] **6.2** Build stat cards (Today's Spend with blue icon, 7-Day Rolling with pink icon)
- [x] **6.3** Build view toggle (Today / History) + session data area
- [x] **6.4** Build Intelligence insights section (Data Integrity + Efficiency cards with colored borders)
- [x] **6.5** Build Spend Distribution section placeholder
- [x] **6.6** Add backend endpoints for API usage tracking (`/api/usage/today`, `/api/usage/weekly`)

## Phase 7: Documents Page (DocuDigest)
- [x] **7.1** Create Documents page component
- [x] **7.2** Build drag-and-drop PDF upload area (dashed border, upload icon)
- [x] **7.3** Build document library (grid/list toggle, search input, empty state)
- [x] **7.4** Add backend endpoints for documents (`/api/documents`, `/api/documents/{id}`)
- [ ] **7.5** Build document detail view (extracted content + AI summary) — future: needs PDF extraction service

## Phase 8: Intelligence Page (Twitter/X Scout)
- [x] **8.1** Create Intelligence page component (email/inbox layout, 1/3 + 2/3 split)
- [x] **8.2** Build report list (left panel) + detail panel (right)
- [x] **8.3** Build report detail (summary, snapshot section, source link, Deploy to Workshop button)
- [x] **8.4** Build configuration panel (business goals textarea, keywords input, scan frequency select)
- [x] **8.5** Add backend endpoints for intelligence reports (`/api/intelligence`)

## Phase 9: Agents Page
- [x] **9.1** Create Agents page component with blue header icon
- [x] **9.2** Build agent roster grid (avatar emoji, name, role, status dot + label)
- [x] **9.3** Commander section (lead agent with crown icon) + sub-agents grid
- [x] **9.4** Wire to existing agent management backend (create button opens management panel)
- [ ] **9.5** Build full agent profile view (SOUL.md editor, capabilities) — future enhancement

## Phase 10: Journal Page
- [x] **10.1** Create Journal page component with orange header icon
- [x] **10.2** Build chronological activity log with type filter buttons (all/task/status/comment)
- [x] **10.3** Wire to existing activity log backend (liveFeed from store)

## Phase 11: Weekly Recaps Page
- [x] **11.1** Create WeeklyRecaps page component with blue header icon
- [x] **11.2** Build recap cards (glass cards, expandable sections with ChevronDown/Up)
- [x] **11.3** Add backend endpoint for recaps (`/api/recaps`)

## Phase 12: Clients Page
- [x] **12.1** Create Clients page component with green header icon
- [x] **12.2** Build client list with add/manage UI
- [x] **12.3** Add backend endpoints for clients (`/api/clients` CRUD)

## Phase 13: Backend Enhancements
- [x] **13.1** Add new DB models (Document, IntelligenceReport, Client, WeeklyRecap, ApiUsageLog)
- [x] **13.2** Add V2 API endpoints (documents, intelligence, clients, recaps, usage, momentum)
- [x] **13.3** Add momentum score calculation endpoint
- [x] **13.4** All pages use responsive grid layouts (grid-cols-1 md:grid-cols-2/3)
- [x] **13.5** Frontend API layer extended with V2 functions in `api.js`

---

## Files Created/Modified

### New Files
- `frontend/src/components/Sidebar.jsx` — Persistent left nav with all 10 links + footer
- `frontend/src/components/AppLayout.jsx` — Sidebar + routed content wrapper
- `frontend/src/pages/Dashboard.jsx` — Status cards, popover, live activity, recent commits
- `frontend/src/pages/Workshop.jsx` — Kanban board, task cards, momentum scoring, detail modal
- `frontend/src/pages/CronJobs.jsx` — Cron job cards with toggle + expand
- `frontend/src/pages/ApiUsage.jsx` — Spend cards, intelligence insights, distribution
- `frontend/src/pages/Documents.jsx` — Upload area, document library
- `frontend/src/pages/Intelligence.jsx` — Inbox layout, scout config, deploy to workshop
- `frontend/src/pages/Agents.jsx` — Agent roster grid with commander section
- `frontend/src/pages/Journal.jsx` — Activity log with type filters
- `frontend/src/pages/WeeklyRecaps.jsx` — Expandable recap cards
- `frontend/src/pages/Clients.jsx` — Client list with add button
- `v2plan.md` — This plan file

### Modified Files
- `frontend/tailwind.config.js` — Liquid Glass color palette, Inter font, glass border radius
- `frontend/src/index.css` — Complete Liquid Glass theme (CSS variables, glass-card, glass-popover, glass-modal, status dots, badges, progress bars)
- `frontend/src/App.css` — Minimal utilities (line-clamp)
- `frontend/src/App.jsx` — React Router integration, BrowserRouter + Routes + all 10 pages
- `frontend/index.html` — Mission Control title, target emoji favicon, Inter font preconnect
- `frontend/src/api.js` — V2 API functions (documents, intelligence, clients, recaps, usage, momentum)
- `backend/models.py` — V2 DB models (Document, IntelligenceReport, Client, WeeklyRecap, ApiUsageLog)
- `backend/main.py` — V2 API endpoints (documents CRUD, intelligence CRUD, clients CRUD, recaps, usage, momentum scoring)

---

## Status Key
- [ ] = Not started
- [x] = Complete

**Overall: 95% complete** — All 10 pages built with Liquid Glass theme. Remaining items are future enhancements (PDF extraction service, full agent profile editor).
