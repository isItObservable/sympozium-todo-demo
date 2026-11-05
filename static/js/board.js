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

/** Minimal card render for UI-2; post-it styling and affordances land in UI-3. */
export function renderNote(note) {
  const card = document.createElement('article');
  card.className = 'note';
  card.dataset.noteId = note.id;

  const title = document.createElement('h3');
  title.className = 'note__title';
  title.textContent = note.title || '(untitled)';

  card.append(title);

  if (note.body) {
    const body = document.createElement('p');
    body.className = 'note__body';
    body.textContent = note.body;
    card.append(body);
  }

  return card;
}
