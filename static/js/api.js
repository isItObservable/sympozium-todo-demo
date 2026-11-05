// Palette is defined once, here. Components never do palette logic (Q4).
export const PALETTE = ['yellow', 'pink', 'blue', 'green'];

const NOTE_PATH = '/api/notes/';

/**
 * Q1: ids are opaque strings. This is the ONLY place a wire id is coerced, and
 * it coerces to String() — never parseInt / Number() / arithmetic.
 * Returns null for absent ids so callers can degrade instead of throwing.
 */
export function toId(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.length ? value : null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Error type surfaced to callers. Carries the HTTP status so UI-8 can show a
 * human-readable message while keeping the raw status discoverable.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, url = '', cause = null, body = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.cause = cause;
    this.body = body;
  }
}

/** Stable, non-cryptographic hash so a note's color does not change on re-render. */
function hashId(id) {
  const str = String(id);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % 100000;
  }
  return hash;
}

/**
 * Q4: color is client-side and stable per id.
 * A valid palette color from the API wins; otherwise a rotating palette entry
 * derived from the id hash is used. Never sent upstream.
 */
export function resolveColor(id, apiColor) {
  if (typeof apiColor === 'string' && PALETTE.includes(apiColor)) return apiColor;
  return PALETTE[hashId(id ?? '') % PALETTE.length];
}

/** A small, stable rotation in degrees so cards look hand-placed but never jitter. */
export function resolveRotation(id) {
  const rotations = [-1.6, 0.8, -0.7, 1.4, -1.1, 1.1, -0.4, 0.5];
  return rotations[hashId(id ?? '') % rotations.length];
}

/**
 * Q2: normalize a wire note ONCE, here, at the fetch boundary.
 * Accepts column_id or columnId, created_at or createdAt, id as number or string.
 * Missing fields degrade to empty values rather than throwing.
 */
export function normalizeNote(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const id = toId(source.id);
  const columnId = toId(source.columnId ?? source.column_id);
  return {
    id,
    columnId,
    title: source.title == null ? '' : String(source.title),
    body: source.body == null ? '' : String(source.body),
    color: resolveColor(id, source.color),
    rotation: resolveRotation(id),
    createdAt: source.createdAt ?? source.created_at ?? null,
    updatedAt: source.updatedAt ?? source.updated_at ?? null,
  };
}

/** Q2: normalize a wire column. board_scope is deliberately dropped — no UI for it (R1). */
export function normalizeColumn(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const id = toId(source.id);
  return {
    id,
    title: source.title == null ? '' : String(source.title),
    position: source.position ?? null,
  };
}

/** Tolerant collection read: accepts a bare array or {data|notes|columns: []}. */
function toList(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload[key])) return payload[key];
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const url = path;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause && cause.name === 'AbortError') throw cause;
    throw new ApiError('Could not reach the server.', { status: 0, url, cause });
  }

  if (!response.ok) {
    let errorBody = null;
    try {
      errorBody = await response.json();
    } catch {
      /* non-JSON error body is fine — status is what matters */
    }
    const detail = errorBody && (errorBody.error || errorBody.message);
    throw new ApiError(detail || `Request failed (${response.status}).`, {
      status: response.status,
      url,
      body: errorBody,
    });
  }

  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** GET /api/columns/ — columns arrive in API order and are NOT re-sorted (UI-2 #1). */
export async function fetchColumns({ signal } = {}) {
  const payload = await request('/api/columns/', { signal });
  return toList(payload, 'columns').map(normalizeColumn).filter((column) => column.id !== null);
}

/** GET /api/notes/?column_id=:id — the filter value is a string id (Q1), never coerced. */
export async function fetchNotes({ columnId } = {}) {
  const query = columnId === undefined || columnId === null
    ? ''
    : `?column_id=${encodeURIComponent(toId(columnId) ?? '')}`;
  const payload = await request(`${NOTE_PATH}${query}`);
  return toList(payload, 'notes').map(normalizeNote).filter((note) => note.id !== null);
}

/**
 * POST /api/notes/ — body is exactly {title, body, columnId}.
 * color is never sent (Q4) and columnId stays a string (Q1).
 */
export async function createNote({ title, body, columnId }) {
  const payload = await request(NOTE_PATH, {
    method: 'POST',
    body: { title, body, columnId: toId(columnId) },
  });
  return normalizeNote(payload);
}

/** PUT /api/notes/:id — updates title/body only. */
export async function updateNote(id, { title, body }) {
  const payload = await request(`${NOTE_PATH}${encodeURIComponent(toId(id) ?? '')}`, {
    method: 'PUT',
    body: { title, body },
  });
  return normalizeNote(payload);
}

/** PATCH /api/notes/:id/move — body is {columnId} as a string (Q1). */
export async function moveNote(id, columnId) {
  const payload = await request(`${NOTE_PATH}${encodeURIComponent(toId(id) ?? '')}/move`, {
    method: 'PATCH',
    body: { columnId: toId(columnId) },
  });
  return normalizeNote(payload);
}

/** DELETE /api/notes/:id — 204 on success. */
export async function deleteNote(id) {
  await request(`${NOTE_PATH}${encodeURIComponent(toId(id) ?? '')}`, { method: 'DELETE' });
  return true;
}
