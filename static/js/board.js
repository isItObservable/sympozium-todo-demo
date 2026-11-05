// Board rendering: columns left→right in API order, notes filtered per column,
// derived "Title (n)" headers, empty states, post-it cards, the inline
// "+ Note" create form, native HTML5 drag & drop, inline edit, and delete with
// confirmation. Every mutation is optimistic and rolls back on failure (NFR4).
import {
  getState,
  getColumns,
  notesForColumn,
  countForColumn,
  upsertNote,
  removeNote,
  withRollback,
} from './store.js';
import { createNote, moveNote, updateNote, deleteNote } from './api.js';

// UI-8 installs the error sink; until then failures are only logged.
let reportError = (error) => {
  if (typeof console !== 'undefined') console.error(error);
};

export function setErrorReporter(reporter) {
  reportError = reporter;
}

// Drag payload for the current gesture. Holds string ids only (Q1).
const dragState = { noteId: null, fromColumnId: null };

// In-progress edit draft, kept in memory so a board re-render cannot discard
// the user's typing mid-edit.
let editDraft = null;

// Note id awaiting delete confirmation (string id, or null).
let pendingDeleteId = null;

// Notes removed optimistically, retained so a failed DELETE can put them back
// in their original position (NFR4: no orphaned removals, no phantom counts).
const pendingDeletes = new Map();

/** R1: render every column returned; board_scope is never read. */
export function renderBoard(root) {
  const columns = getColumns();
  root.innerHTML = '';
  root.setAttribute('aria-busy', 'false');

  if (!columns.length) {
    const message = document.createElement('p');
    message.className = 'board__empty';
    message.textContent = 'No columns yet. Add a column to start your board.';
    root.append(message);
    return;
  }

  const focusId = editDraft ? editDraft.noteId : null;

  for (const column of columns) {
    root.append(renderColumn(column));
  }

  // Restore focus + caret to the edit form after a re-render.
  if (focusId !== null) {
    const field = root.querySelector(`[data-note-id="${CSS.escape(focusId)}"] .note-edit__title`);
    if (field) {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }
  }

  // Move focus onto a freshly opened confirmation (NFR2: keyboard path).
  if (pendingDeleteId !== null) {
    const confirmButton = root.querySelector(
      `[data-note-id="${CSS.escape(pendingDeleteId)}"] .note-confirm__yes`,
    );
    if (confirmButton) confirmButton.focus();
  }
}

export function renderColumn(column) {
  const section = document.createElement('section');
  section.className = 'column';
  section.dataset.columnId = column.id;
  section.setAttribute('aria-label', column.title || 'Column');

  const header = document.createElement('h2');
  header.className = 'column__header';

  const title = document.createElement('span');
  title.className = 'column__title';
  title.textContent = column.title || 'Untitled';

  // #3: count derived from local notes[] on every render — never stored (R2).
  const count = document.createElement('span');
  count.className = 'column__count';
  count.textContent = `(${countForColumn(column.id)})`;

  header.append(title, count);

  const notes = document.createElement('div');
  notes.className = 'column__notes';

  const columnNotes = notesForColumn(column.id);
  if (!columnNotes.length) {
    // NFR6: explicit zero-notes state.
    const empty = document.createElement('p');
    empty.className = 'column__empty';
    empty.textContent = 'No notes yet.';
    notes.append(empty);
  } else {
    for (const note of columnNotes) notes.append(renderNote(note));
  }

  section.append(header, notes, renderAddNote(column));
  attachDropZone(section, column);
  return section;
}

/* ------------------------------ Delete (UI-7) ------------------------------ */

/**
 * Delete with a confirmation gate. Cancel closes the prompt and issues NO
 * request; confirming removes the card optimistically and restores it on
 * failure.
 *
 * R2: the column count is never decremented — removeNote() drops the note from
 * notes[] and the header re-derives its count, so deleting the last note leaves
 * the header at (0), not (1).
 */
function renderDeleteControls(note) {
  const wrap = document.createElement('div');
  wrap.className = 'note__actions';

  if (pendingDeleteId === note.id) {
    const confirm = document.createElement('div');
    confirm.className = 'note-confirm';
    confirm.setAttribute('role', 'group');
    confirm.setAttribute('aria-label', 'Confirm delete');

    const question = document.createElement('span');
    question.className = 'note-confirm__question';
    question.textContent = 'Delete this note?';

    const yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'note-confirm__yes';
    yes.textContent = 'Delete';

    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'note-confirm__no';
    no.textContent = 'Cancel';

    // NFR2: Escape cancels the confirmation. Zero network activity.
    confirm.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        pendingDeleteId = null;
        rerender();
      }
    });

    // Cancel: clear the prompt only — zero network activity.
    no.addEventListener('click', (event) => {
      event.stopPropagation();
      pendingDeleteId = null;
      rerender();
    });

    yes.addEventListener('click', async (event) => {
      event.stopPropagation();
      yes.disabled = true;
      pendingDeleteId = null;

      const state = getState();
      const index = state.notes.findIndex((candidate) => candidate.id === note.id);
      pendingDeletes.set(note.id, { note, index });

      removeNote(note.id); // optimistic removal; count re-derives from notes[]

      try {
        await deleteNote(note.id);
        pendingDeletes.delete(note.id);
      } catch (failure) {
        // NFR4: restore the note at its original position, then re-render.
        const restore = pendingDeletes.get(note.id);
        pendingDeletes.delete(note.id);
        if (restore) {
          const notes = state.notes.slice();
          const at = restore.index >= 0 && restore.index <= notes.length
            ? restore.index
            : notes.length;
          notes.splice(at, 0, restore.note);
          state.notes = notes;
        }
        rerender();
        reportError(failure);
      }
    });

    confirm.append(question, yes, no);
    wrap.append(confirm);
    return wrap;
  }

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'note__edit';
  editButton.textContent = 'Edit';
  editButton.setAttribute('aria-label', `Edit ${note.title || 'note'}`);
  editButton.addEventListener('click', (event) => {
    event.stopPropagation();
    startEdit(note);
  });

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'note__delete';
  deleteButton.textContent = 'Delete';
  deleteButton.setAttribute('aria-label', `Delete ${note.title || 'note'}`);
  deleteButton.addEventListener('click', (event) => {
    event.stopPropagation();
    pendingDeleteId = note.id;
    rerender();
  });

  wrap.append(editButton, deleteButton);
  return wrap;
}

/* ---------------------------- Inline edit (UI-6) ---------------------------- */

function startEdit(note) {
  editDraft = { noteId: note.id, title: note.title, body: note.body };
  pendingDeleteId = null;
  rerender();
}

function cancelEdit() {
  editDraft = null;
  rerender();
}

/**
 * Inline edit form, pre-filled from the draft. Save issues PUT /api/notes/:id
 * and the card reflects the saved server values; Escape cancels with no request.
 */
function renderEditForm(note, draft) {
  const form = document.createElement('form');
  form.className = 'note-edit';
  form.noValidate = true;

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'note-edit__title';
  titleInput.value = draft.title;
  titleInput.setAttribute('aria-label', 'Edit note title');
  titleInput.maxLength = 120;

  const bodyInput = document.createElement('textarea');
  bodyInput.className = 'note-edit__body';
  bodyInput.value = draft.body;
  bodyInput.setAttribute('aria-label', 'Edit note details');
  bodyInput.rows = 3;

  const actions = document.createElement('div');
  actions.className = 'note-edit__actions';

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'note-edit__save';
  save.textContent = 'Save';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'note-edit__cancel';
  cancel.textContent = 'Cancel';

  actions.append(save, cancel);
  form.append(titleInput, bodyInput, actions);

  // Keep the draft current so a re-render preserves in-flight typing.
  const sync = () => {
    if (editDraft && editDraft.noteId === note.id) {
      editDraft.title = titleInput.value;
      editDraft.body = bodyInput.value;
    }
  };
  titleInput.addEventListener('input', sync);
  bodyInput.addEventListener('input', sync);

  cancel.addEventListener('click', () => cancelEdit());

  // NFR2: Escape cancels and discards changes without a request.
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      cancelEdit();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      return;
    }

    save.disabled = true;
    try {
      const saved = await withRollback(async () => {
        const result = await updateNote(note.id, { title, body: bodyInput.value.trim() });
        upsertNote({ ...note, ...result, id: note.id, columnId: note.columnId });
        return result;
      });
      editDraft = null;
      rerender();
      return saved;
    } catch (failure) {
      // Card keeps last-good values; withRollback already restored the snapshot.
      // The draft is kept so the user does not lose their typing.
      reportError(failure);
      save.disabled = false;
    }
  });

  return form;
}

function rerender() {
  const root = document.getElementById('board');
  if (root) renderBoard(root);
}

/* ---------------------------- Drag & drop (UI-5) ---------------------------- */

/**
 * The drop zone is the whole column, not just its cards, so dropping onto an
 * empty column works.
 */
function attachDropZone(section, column) {
  const onDragOver = (event) => {
    if (dragState.noteId === null) return;
    // Only preventDefault on a *different* column: a same-column drop is a no-op
    // and must not show a target highlight.
    if (dragState.fromColumnId === column.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    section.classList.add('column--drop-target');
  };

  const clearHighlight = () => section.classList.remove('column--drop-target');

  section.addEventListener('dragover', onDragOver);
  section.addEventListener('dragleave', (event) => {
    if (!section.contains(event.relatedTarget)) clearHighlight();
  });
  section.addEventListener('dragend', clearHighlight);

  section.addEventListener('drop', async (event) => {
    event.preventDefault();
    clearHighlight();

    const noteId = dragState.noteId;
    const fromColumnId = dragState.fromColumnId;
    resetDragState();

    if (noteId === null) return;
    // #9 no-op: dropping back into the source column issues NO request.
    if (fromColumnId === column.id) return;

    const targetColumnId = column.id; // already a string (Q1) — no coercion
    const current = getState().notes.find((note) => note.id === noteId);
    if (!current) return;

    const moved = { ...current, columnId: targetColumnId };
    upsertNote(moved); // optimistic: both header counts update immediately

    try {
      await withRollback(async () => {
        const saved = await moveNote(noteId, targetColumnId);
        // Trust the server echo; keep a coherent columnId if it was omitted.
        upsertNote({ ...moved, ...saved, columnId: saved.columnId ?? targetColumnId });
        return saved;
      });
    } catch (failure) {
      // Optimistic move rolled back to origin by withRollback (UI-8).
      reportError(failure);
    }
  });
}

function resetDragState() {
  dragState.noteId = null;
  dragState.fromColumnId = null;
  for (const card of document.querySelectorAll('.note--dragging')) {
    card.classList.remove('note--dragging');
  }
  for (const column of document.querySelectorAll('.column--drop-target')) {
    column.classList.remove('column--drop-target');
  }
}

/* ------------------------------ Create note (UI-4) ------------------------------ */

/**
 * "+ Note" control and its inline form (#4). Opens in place, submits
 * POST /api/notes/ with {title, body, columnId}, and on 201 the new card is
 * appended from store state — no page reload.
 */
function renderAddNote(column) {
  const wrap = document.createElement('div');
  wrap.className = 'column__add';

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'column__add-button';
  openButton.textContent = '+ Note';
  openButton.setAttribute('aria-expanded', 'false');

  const form = document.createElement('form');
  form.className = 'note-form';
  form.hidden = true;
  form.noValidate = true;

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'note-form__title';
  titleInput.placeholder = 'Title';
  titleInput.setAttribute('aria-label', `New note title in ${column.title || 'column'}`);
  titleInput.maxLength = 120;

  const bodyInput = document.createElement('textarea');
  bodyInput.className = 'note-form__body';
  bodyInput.placeholder = 'Details (optional)';
  bodyInput.setAttribute('aria-label', 'New note details');
  bodyInput.rows = 2;

  const actions = document.createElement('div');
  actions.className = 'note-form__actions';

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'note-form__save';
  save.textContent = 'Add';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'note-form__cancel';
  cancel.textContent = 'Cancel';

  const error = document.createElement('p');
  error.className = 'note-form__error';
  error.hidden = true;

  actions.append(save, cancel);
  form.append(titleInput, bodyInput, actions, error);
  wrap.append(openButton, form);

  const close = () => {
    form.hidden = true;
    openButton.hidden = false;
    openButton.setAttribute('aria-expanded', 'false');
    form.reset();
    error.hidden = true;
    openButton.focus();
  };

  openButton.addEventListener('click', () => {
    openButton.hidden = true;
    form.hidden = false;
    openButton.setAttribute('aria-expanded', 'true');
    titleInput.focus();
  });

  cancel.addEventListener('click', close);

  // Escape closes the inline form without a request (NFR2).
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    // Empty title is blocked client-side before any request is made (#4).
    if (!title) {
      error.textContent = 'Give the note a title first.';
      error.hidden = false;
      titleInput.focus();
      return;
    }

    error.hidden = true;
    save.disabled = true;
    try {
      const created = await withRollback(() => createNote({
        title,
        body: bodyInput.value.trim(),
        columnId: column.id,
      }));
      upsertNote(created);
      close();
    } catch (failure) {
      // Failure path delegates to UI-8; no half-added card is left behind.
      error.textContent = failure.message || 'Could not add the note.';
      error.hidden = false;
      reportError(failure);
    } finally {
      save.disabled = false;
    }
  });

  return wrap;
}

/* ------------------------------- Note card ---------------------------------- */

/**
 * Post-it card. `color` and `rotation` arrive pre-resolved from the UI-1
 * adapter (Q4) — this component does no palette logic and no randomization, so
 * a card's colour and tilt are stable across every re-render.
 */
export function renderNote(note) {
  const card = document.createElement('article');
  card.className = 'note';
  card.dataset.noteId = note.id;
  card.dataset.color = note.color;
  card.tabIndex = 0;
  // Slight rotation, stable per card (not re-randomized on render).
  if (typeof note.rotation === 'number') {
    card.style.setProperty('--note-rotation', `${note.rotation}deg`);
  }

  if (editDraft && editDraft.noteId === note.id) {
    card.classList.add('note--editing');
    card.append(renderEditForm(note, editDraft));
    return card;
  }

  const title = document.createElement('h3');
  title.className = 'note__title';
  title.textContent = note.title || '(untitled)';

  card.append(title);

  if (note.body) {
    // #6: body is clamped by default and revealed on hover / focus / click.
    const body = document.createElement('p');
    body.className = 'note__body';
    body.textContent = note.body;
    card.append(body);
  }

  card.append(renderDeleteControls(note));

  // #7: native HTML5 drag. Payload carries the string note id (Q1).
  card.draggable = true;

  card.addEventListener('dragstart', (event) => {
    if (pendingDeleteId !== null) {
      event.preventDefault();
      return;
    }
    dragState.noteId = note.id;
    dragState.fromColumnId = note.columnId;
    event.dataTransfer.effectAllowed = 'move';
    // text/plain keeps the payload readable/inspectable; the gesture itself is
    // tracked in dragState because dataTransfer is unreadable during dragover.
    event.dataTransfer.setData('text/plain', note.id);
    // #8: source card becomes semi-transparent while dragging.
    card.classList.add('note--dragging');
  });

  card.addEventListener('dragend', resetDragState);

  return card;
}
