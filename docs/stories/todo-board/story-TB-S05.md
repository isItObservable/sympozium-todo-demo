---
story-id: TB-S05
phase: 4
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coding-agent
created: 2026-07-03
---

# Story TB-S05 — Frontend Board Rendering & Note Creation

## As a user, I want to see all columns with their sticky-note cards displayed in a horizontal Kanban layout so I can view and interact with my todo items.

**Maps to**: PRD FR6 (Frontend — Single-Page Board View), AC3 (frontend renders and updates via API)  
**Traces to PRD AC**: AC3 (board rendering + CRUD actions update data via API), G3 (`docker-compose up`, board accessible at `http://localhost`)  
**ADR References**: ADR-001 (vanilla HTML/CSS/JS — no build step, no npm), ADR-004 (frontend structure)

## Background / Context

Per ADR-001, the frontend uses vanilla HTML/CSS/JS with zero build step. No webpack, no React, no npm. The backend itself serves the static frontend files (single binary serving both API routes and `/` which returns `index.html`).

**Files**:
- `frontend/index.html` — Kanban board layout with 3 empty column placeholders
- `frontend/styles.css` — sticky-note post-it visual styling, horizontal flexbox layout
- `frontend/app.js` — DOM manipulation: fetch columns, render them as vertical lanes, render notes as cards within each lane

The backend serves `/` → `index.html`, `/styles.css`, `/app.js`, and all API routes under `/api/*`.

## Acceptance Criteria (Given/When/Then)

### AC1: The board UI renders a horizontal Kanban layout with columns fetched from the backend API

**Given** the full stack is running via `docker-compose up`  
**When** a user opens `http://localhost:80` in their browser or `curl -s http://localhost/` locally  
**THEN**:
- The response is valid HTML (`Content-Type: text/html`)
- The page contains three default column placeholders in a horizontal flexbox row (not vertical)
- At least "To Do", "Doing", and "Done" columns exist as headers

### AC2: Each column displays notes as sticky-note cards fetched from the backend API

**Given** one or more columns with associated notes exist in the database  
**When** a user loads `http://localhost` in their browser after the page renders  
**THEN**:
- Column headers display the exact titles stored in the database (not hardcoded)
- Each note appears as a card with: visible title text, body preview (truncated if long), and a post-it visual style (yellow background, slight rotation or shadow effect)
- The notes are displayed inside their correct column div

**Scenario 2.1: Empty columns**
- **Given** a column has zero notes  
- **When** the board renders that column  
- **THEN** the column header is still visible with no card elements beneath it (just a blank lane)

### AC3: A "+" button per column creates a new note from the UI

**Given** the board page is loaded in the browser  
**When** a user clicks the "+" button inside any specific column header  
**THEN**:
- An inline form appears with `title` and optional `body` input fields within that column
- The user can type a title and click "Add"
- A `POST /api/notes/` request is sent (not mocked/static data) with the form values + the column's UUID

### AC4: After creating a new note from the UI, the display refreshes (new card appears) without full page reload

**Given** a note was just created via the "+" button in some column  
**When** the `POST /api/notes/` request succeeds with status 201  
**THEN**:
- The newly created note's card is rendered into the correct column visually (the DOM is updated)
- No full-page reload occurs (only the relevant column's content changes via JavaScript — no `location.reload()`)

## Technical Implementation Notes

- `index.html` has a `<div id="board">` container with three empty `<div class="column">` elements:
  ```html
  <div class="board" id="board"></div>
  ```
- `app.js` on DOMContentLoaded calls `fetch('/api/columns/')`, then for each column: creates a column div, fetches notes via `/api/notes/?column_id=X`, and renders card elements
- Cards are `<div class="card">` elements with the note's title and body preview
- The "+" button is appended to each column header: `<button class="add-note-btn">+</button>`
- No external dependencies — everything is vanilla JS `fetch()` + DOM API

## Output / Deliverables

1. `frontend/index.html` — HTML structure with board layout, column containers, and note forms (hidden by default)
2. `frontend/styles.css` — horizontal flexbox layout for columns, post-it card styling for notes, hover/active states for the add button
3. `frontend/app.js` — fetches columns → renders columns → fetches notes per column → renders cards → handles "+" button submit via `fetch` POST

## Dependencies: TB-S02+TB-S03+TB-S04 (all backend CRUD endpoints must be implemented and running)

## Estimate: M

---

*Written by Story Writer — traces to PRD FR6/AC3/G3, Architecture ADR-001/ADR-004*
