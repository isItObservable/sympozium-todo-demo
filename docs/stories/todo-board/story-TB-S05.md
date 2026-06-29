---
story-id: TB-S05
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coder
parent-epic: EPIC-TB-5
created-by: Story Writer (John)
trace-from-prd: FR3, AC1, G1
source-epics-file: epics-and-stories.todo-board.md
---

# Story TB-S05 — Render Kanban Board UI and Create Notes via Frontend

As a user, I want to see all columns with their sticky-note cards rendered on a visual board so I can view and interact with my todo items.

> **Maps to PRD AC1, G1, FR3**  
> **Maps to Architecture:** ADR-001 (vanilla HTML/CSS/JS frontend), ADR-002 (API contract)  
> **Previous Epic Story:** "Render Kanban board and create notes via frontend"

---

## Context

The frontend is a single-page app built with vanilla HTML/CSS/JS — no frameworks, no build step. The board renders columns fetched from the backend API in a horizontal layout. Each column displays sticky-note cards (fetched from `/api/notes/?column_id=`). A "+" button in each column opens an inline form to create new notes.

**File structure:**
```
frontend/
├── index.html       # Board HTML skeleton
├── styles.css       # Kanban + post-it styling
└── app.js           # Fetch calls, DOM manipulation
```

The board uses CSS Grid or Flexbox for the horizontal column layout. Each column is a card stack where notes are positioned absolutely (stacked with slight offset to simulate real post-its).

---

## Acceptance Criteria (Given/When/Then)

### AC1: Board renders horizontal column layout fetched from GET /api/columns/

**Given** the backend server is running and contains at least 3 columns  
**AND** the user opens `http://localhost` in a browser  
**THEN** the page loads without JavaScript errors (console shows no errors)
**AND**: three column cards appear horizontally across the viewport, matching the number of columns returned by `/api/columns/`
**AND**: each column displays its title at the top of the card
**AND**: if no columns exist, a message "No columns yet — add one below" is shown

### AC2: Each column displays notes as draggable card components fetched from GET /api/notes/?column_id=:id

**Given** the board has loaded with one or more columns  
**AND** each column contains multiple notes (fetched via `GET /api/notes/?column_id=<col-uuid>`)
**WHEN** the page renders  
**THEN**: note cards appear as visual sticky-note rectangles inside their respective columns, stacked vertically with slight offset
**AND**: each card displays the note's title prominently
**AND**: if a note has body text, it appears in smaller text below the title
**AND**: visually distinguished pending vs completed notes exist (see AC2 of TB-S07)

### AC3: New-note form per column (click "+" button) posts to POST /api/notes/ and refreshes display

**Given** the board is loaded with at least one column  
**WHEN** the user clicks the "+" button in column `col-A`  
**THEN** an inline input form appears at the top of that column
**AND**: entering a title "Test Note" and clicking "Create" sends a POST request to `/api/notes/` with body `{"column_id":"<col-A-uuid>","title":"Test Note"}`
**AND**: on successful response (201), the board re-renders and the new note appears visually in column `col-A`
**AND**: if the title is empty, validation shows an error message "Title cannot be empty"

### AC4: Board auto-refreshes after new note creation

**Given** a new note has been created via the "+" form  
**WHEN** the POST /api/notes/ response returns 201
**THEN**: the UI updates within 1 second to show the new note in its column without requiring a full page refresh
**AND**: no duplicate notes appear (idempotent create — if user double-clicks create, only one note is added)

---

## Implementation Notes

- `frontend/index.html`: minimal HTML skeleton with a `<div id="board">` container and each column rendered dynamically by JS.
- `frontend/styles.css`: use CSS Grid (`display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))`) for responsive columns. Post-it styling: yellow background (`#FFF9C4`), box-shadow, slight rotation (`transform: rotate(-0.5deg)`).
- `frontend/app.js`: core functions:
  - `async function loadBoard()` — fetches columns and notes, renders DOM.
  - `async function createNote(columnUUID, title)` — POST to `/api/notes/`, then call `loadBoard()`.
  - Use `document.getElementById(...)` for all DOM manipulation. No library dependencies.
- Handle empty states gracefully (no columns → show "Add your first column below" button).
- Error handling: if API returns 401/500, show inline toast notification "Could not connect to server".

---

## Dependencies

**Requires:** TB-S01 (DB), TB-S02 (columns CRUD), TB-S03 (notes CRUD)  
The backend must expose `GET /api/columns/`, `POST /api/notes/`, and related endpoints before this frontend story is meaningful.

## Estimate

M (3–5 hours for HTML/CSS/JS developer who understands the board UX well)
