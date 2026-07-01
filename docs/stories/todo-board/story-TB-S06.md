---
story-id: TB-S06
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coder
parent-epic: EPIC-TB-6
created-by: Story Writer (John)
trace-from-prd: FR3, AC2, G1
source-epics-file: epics-and-stories.todo-board.md
---

# Story TB-S06 — Drag-and-Drop, Edit & Delete Notes in UI

As a user, I want to drag note cards between columns, click to edit them, and delete stale items so my board reflects reality.

> **Maps to PRD AC2, G1, FR3**  
> **Maps to Architecture:** ADR-001 (vanilla HTML/CSS/JS frontend — NO dnd-kit dependency per ADR-001 principle of boring tech)  
> **Previous Epic Story:** "Drag-and-drop notes between columns; edit and delete notes in UI"

---

## Context

This story adds three critical Kanban board interactions to the vanilla JS frontend:

1. **Dragging** note cards between columns via native HTML5 Drag-and-Drop API (not dnd-kit — ADR-001 says "boring tech," vanilla DnD is fine for this demo scale).
2. **Inline edit** of note title/body when clicking a card.
3. **Delete with confirmation** before removing a note.

---

## Acceptance Criteria (Given/When/Then)

### AC1: Note cards are draggable between columns using native HTML5 DnD

**Given** the board is loaded and displaying multiple columns with notes  
**WHEN** the user clicks and holds a note card in column `col-A`
**AND**: drags it to column `col-B`'s drop area  
**THEN**: at least during drag, the dragged card visually follows the cursor (drag image visible)
**AND**: the drop target column highlights with a visual highlight (`border: 3px solid #4CAF50; background-color: rgba(76,175,80,0.1)` to indicate valid drop zone)

### AC2: Visual highlight indicates valid drop zones during drag

**Given** a user is dragging a note card  
**WHEN** the dragged card hovers over a non-empty column  
**THEN**: that column's border highlights green with background tint
**AND**: when it hovers over an invalid area (outside any column) the highlights disappear

### AC3: On drop in a different column, frontend fires POST /api/notes/:id/move with new columnId

**Given** a note `note-1` currently belongs to column `col-A`  
**WHEN** the user drags `note-1` to column `col-B` and releases (drops)
**THEN**: a `POST /api/notes/note-1/move` request is sent with body `{"column_id":"<col-B-uuid>"}`
**AND**: if the response is 200, the board re-renders showing `note-1` now inside `col-B`
**AND**: if the response is 4xx/5xx, a toast notification appears "Could not move note — try again"

### AC4: Clicking a card opens inline edit form for title/body; save posts to PUT /api/notes/:id

**Given** a note `note-1` exists on the board  
**WHEN** the user clicks once (not drag) on the note card
**THEN**: an inline edit form replaces the card in-place with editable fields for:
 - Title input (prefilled with current title)
 - Body textarea (prefilled with current body, or empty if null)
 - A "Save" button and a "Cancel" button
**WHEN** the user edits both fields and clicks "Save"
**THEN**: a `PUT /api/notes/note-1` request is sent with the updated title and body
**AND**: on 200 response, the card re-renders with the new values displayed

### AC5: Edit button shows confirmation dialog that posts to DELETE /api/notes/:id

**Given** a note `note-1` exists on the board  
**WHEN** the user clicks the "🗑️" delete button on the note card
**THEN**: a browser confirm() dialog appears with message: "Delete this note?"
**AND**: if the user clicks "Cancel", no request is sent and the note remains visible
**AND**: if the user clicks "OK", a `DELETE /api/notes/note-1` request is sent
**AND**: on 204 response, the card is removed from the UI immediately without a full page reload
**AND**: if the response is 4xx/5xx, an inline error message appears ("Could not delete — try again")

---

## Implementation Notes

- Use native HTML5 DnD API: `draggable="true"`, event listeners for `dragstart`, `dragover`, `drop`, `dragend`.
- In `app.js`, add functions:
  - `setupDragDrop(cardEl, columnUUID)` — attaches dragend handler.
  - `openInlineEdit(noteId, currentTitle, currentBody)` — mutates DOM to show edit form.
  - `showDeleteConfirm(noteId)` — calls `confirm()` and handles the async result.
- Prevent text selection during drag: add `user-select: none` to cards during dragstart.
- Keep visual feedback snappy: animations ≤200ms (CSS transitions).
- The column highlight class should toggle on `dragover`/`dragleave`, not continuously — only change state on actual enter/exit of the drop zone element.

---

## Dependencies

Requires: **TB-S05** (board must exist and display cards), **TB-S01-TB-S04** (backend endpoints)  
Must be implemented after board rendering story because cards don't exist without it.

## Estimate

M (3–5 hours for frontend developer with strong CSS/DnD experience)
