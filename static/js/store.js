// Single source of truth: columns[] + notes[].
// Counts are ALWAYS derived from notes[] — never stored, never incremented (R2).
import * as api from './api.js';

const state = {
  columns: [],
  notes: [],
  loaded: false,
  loading: false,
};

typeof window !== 'undefined' && (window.__todoStore = state);

const listeners = new Set();

function emit() {
  for (const listener of listeners) listener(state);
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

export function getColumns() {
  return state.columns;
}

export function getNotes() {
  return state.notes;
}

/** Notes belonging to one column. String comparison only (Q1) — no coercion. */
export function notesForColumn(columnId) {
  const id = api.toId(columnId);
  if (id === null) return [];
  return state.notes.filter((note) => note.columnId === id);
}

/**
 * R2 structural fix: counts are recomputed by filtering notes[] every time this
 * is called. Deleting the last note of a column therefore yields 0, never 1.
 */
export function getCounts() {
  const counts = new Map();
  for (const column of state.columns) counts.set(column.id, 0);
  for (const note of state.notes) {
    if (note.columnId === null) continue;
    counts.set(note.columnId, (counts.get(note.columnId) ?? 0) + 1);
  }
  return counts;
}

export function countForColumn(columnId) {
  return getCounts().get(api.toId(columnId)) ?? 0;
}

/** Load columns in API order (no client sort — UI-2 #1), then all notes. */
export async function loadBoard() {
  state.loading = true;
  emit();
  try {
    const [columns, notes] = await Promise.all([api.fetchColumns(), api.fetchNotes()]);
    state.columns = columns;
    state.notes = notes;
    state.loaded = true;
    return state;
  } finally {
    state.loading = false;
    emit();
  }
}

/** Insert or replace a note by id, keeping API order within the store. */
export function upsertNote(note) {
  const index = state.notes.findIndex((candidate) => candidate.id === note.id);
  if (index === -1) state.notes = [...state.notes, note];
  else {
    const next = state.notes.slice();
    next[index] = { ...state.notes[index], ...note };
    state.notes = next;
  }
  emit();
  return note;
}

export function removeNote(id) {
  const target = api.toId(id);
  state.notes = state.notes.filter((note) => note.id !== target);
  emit();
}

/**
 * Optimistic mutation with rollback (NFR4). The previous notes[] snapshot is
 * restored byte-for-byte if `mutate` throws, so optimistic UI can never leave
 * an orphaned card or a phantom count behind.
 */
export async function withRollback(mutate) {
  const snapshot = state.notes.slice();
  try {
    return await mutate();
  } catch (error) {
    state.notes = snapshot;
    emit();
    throw error;
  }
}
