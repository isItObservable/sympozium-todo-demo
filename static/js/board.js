// Board rendering: columns left→right in API order, notes filtered per column,
// derived "Title (n)" headers, and honest empty states.
import { getColumns, notesForColumn, countForColumn } from './store.js';

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

  for (const column of columns) {
    root.append(renderColumn(column));
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

  section.append(header, notes);
  return section;
}

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

  return card;
}
