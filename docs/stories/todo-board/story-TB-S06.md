---
story-id: TB-S06
phase: 4
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coding-agent
created: 2026-07-03
---

# Story TB-S06 — Drag-and-Drop Notes Between Columns, Inline Edit & Delete

## As a user, I want to drag note cards between columns, click cards to edit title/body inline, and delete stale notes, so my board reflects real-time task management.

**Maps to**: PRD FR6 (Frontend: draggable cards, drag-and-drop, edit/delete via UI), AC3 (all create/move/delete actions in UI successfully update data)  
**Traces to PRD AC**: AC3 (all UI actions call API — no mock/static data), G2 (tested via automated + browser verification)  
**ADR References**: ADR-001 (vanilla HTML/CSS/JS + CDN dnd-kit for drag-and-drop), ADR-002 (move and delete endpoint contracts)

## Background / Context

Per the PRD: "Use `dnd-kit` or equivalent mature library. Do not roll custom DnD logic." We'll use dnd-kit via CDN (UMD build) — no npm build step required.

The frontend already renders cards (TB-S05). This story adds:
1. **Drag-and-drop** notes between columns using dnd-kit's `useDroppable` and `useSortable`
2. **Inline edit**: clicking a card opens an inline editor with title/body fields; save → `PUT /api/notes/:id`
3. **Delete**: an "X" button on each card confirms deletion via `DELETE /api/notes/:id`

## Acceptance Criteria (Given/When/Then)

### AC1: Note cards are draggable between columns (using dnd-kit or equivalent library)

**Given** the board is loaded with notes in at least one column  
**When** a user clicks and holds on any note card, then drags it to a different column  
**THEN**:
- During the drag, the card becomes semi-transparent or visually highlighted
- When released (dropped) into a valid column's area, the drop zone highlights (e.g., background color change)
- The `column_id` in the database is updated via `POST /api/notes/<note-id>/move` with the new column's UUID
- After the API call succeeds (200), the card visually appears in the new column

### AC2: During drag operations, visual feedback indicates valid drop zones

**Given** a user is dragging a note card  
**When** the card hovers over a different column area  
**THEN**:
- The target column highlights with a distinct background color (e.g., light blue) to indicate it accepts drops
- The original source column shows the dragged card removed from its visual position (ghost placeholder or gap)

### AC3: Dropping into a different column fires `POST /api/notes/:id/move`

**Given** a note card is being dragged from column A  
**When** the user drops it on column B  
**THEN**:
A `POST` request is sent to `/api/notes/<note-id>/move` with body `{"columnId": "<column-B-UUID>"}` (not a mock call; the actual API endpoint)

**Scenario 3.1: Drop succeeds**
- **Given** `POST /api/notes/:id/move` returns 200  
- **THEN** the note's DOM element moves to column B

**Scenario 3.2: Drop fails (API error)**
- **Given** `POST /api/notes/:id/move` returns an error (e.g., network failure)  
- **THEN** the card visually reverts back to its original position in column A and a brief toast or inline message indicates the move failed

### AC4: Clicking a card opens an inline editor; save posts to `PUT /api/notes/:id`

**Given** a note card is displayed on the board  
**When** a user double-clicks (or clicks edit button) on that card  
**THEN**:
- The card transforms into an inline edit form with two text fields: `title` and `body`
- Current values from `GET /api/notes/:id` are pre-filled in both fields

**Scenario 4.1: Save edits**
- **Given** the inline editor shows the note's current data  
- **When** the user modifies title/body and clicks "Save"  
- **THEN**:
  - A `PUT /api/notes/<note-id>` request is sent with the new values
  - Upon HTTP 200, the card renders back as a regular note display showing updated content
  - The card's `updated_at` timestamp in the database is refreshed

**Scenario 4.2: Cancel edits (X button on editor)**
- **Given** the inline editor is open  
- **When** the user clicks "Cancel" or presses Escape  
- **THEN** the card returns to its normal display view without saving changes

### AC5: Delete shows confirmation dialog; posts `DELETE /api/notes/:id`

**Given** a note card is displayed on the board  
**When** a user clicks an "X" (delete) icon/button visible on the card  
**THEN**:
- A confirm() JavaScript dialog appears with text like `"Delete this note?"`

**Scenario 5.1: User confirms deletion**
- **Given** the confirm dialog is shown and the user clicks "OK"  
- **When** `DELETE /api/notes/<note-id>` succeeds (204)  
- **THEN**:
  - The card is removed from the DOM immediately
  - A subsequent `GET /api/notes/?column_id=<that-column>` does not return this note

**Scenario 5.2: User cancels deletion**
- **Given** the confirm dialog is shown and the user clicks "Cancel"  
- **THEN** nothing changes — the card remains visible in its column

## Technical Implementation Notes

- Use dnd-kit via CDN `<script src="https://unpkg.com/@dnd-kit/core/dist/index.js">` (UMD) or importmap-style ES module from CDN
- In `app.js`: after rendering notes (from TB-S05), iterate over the note cards and:
  - Make them sortable via dnd-kit's `SortableContext` + `useSortable` hooks
  - Add click-to-edit handler that swaps the card div for an `<form>` DOM structure
  - Add a delete button with `confirm()` wrapper before calling `fetch('/api/notes/' + id, { method: 'DELETE' })`
- No external CSS frameworks — all dnd-kit visual state classes are added manually (`.dnd-dragging`, `.dnd-over` etc. via the library)

## Output / Deliverables

1. Updated `frontend/app.js` with: dnd-kit drag-and-drop init, inline editor logic, delete confirmation & API call
2. If needed, additional CSS for dnd-kit visual states in `frontend/styles.css` (.card.dragging, .column.drop-hover etc.)

## Dependencies: TB-S05 (board rendering must be complete; cards must exist to be draggable)

## Estimate: M

---

*Written by Story Writer — traces to PRD FR6/AC3/G2, Architecture ADR-001*
