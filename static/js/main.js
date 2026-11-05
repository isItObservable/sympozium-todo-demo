// Entry point: load state, render the board, own the non-blocking error surface
// (NFR4), and keep the view in sync.
import { loadBoard, subscribe, getState } from './store.js';
import { renderBoard, setErrorReporter } from './board.js';

const boardRoot = document.getElementById('board');
const banner = document.getElementById('error-banner');
const bannerMessage = banner ? banner.querySelector('.error-banner__message') : null;
const bannerDismiss = banner ? banner.querySelector('.error-banner__dismiss') : null;

/**
 * NFR4: a visible but non-blocking error surface. It announces politely, never
 * traps focus, never prevents interaction with the board, and is dismissible
 * from the keyboard (Escape or Enter/Space on the Dismiss button). The raw HTTP
 * status is appended in brackets and also logged so it stays discoverable.
 */
export function showError(error) {
  if (!banner || !bannerMessage) {
    if (typeof console !== 'undefined') console.error(error);
    return;
  }

  const status = error && typeof error.status === 'number' && error.status > 0
    ? error.status
    : null;
  const base = (error && error.message) || 'Something went wrong.';
  bannerMessage.textContent = status ? `${base} [HTTP ${status}]` : base;
  banner.hidden = false;

  if (typeof console !== 'undefined') {
    console.error(status ? `[HTTP ${status}]` : '[network]', error);
  }
}

export function clearError() {
  if (!banner) return;
  banner.hidden = true;
  if (bannerMessage) bannerMessage.textContent = '';
}

// Board-level mutation failures route here.
setErrorReporter(showError);

if (bannerDismiss) {
  bannerDismiss.addEventListener('click', clearError);
}

// Escape dismisses the banner without moving focus back into it.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && banner && !banner.hidden) clearError();
});

function paint() {
  renderBoard(boardRoot);
}

subscribe(paint);

async function init() {
  try {
    await loadBoard();
    clearError();
  } catch (error) {
    boardRoot.setAttribute('aria-busy', 'false');
    boardRoot.innerHTML = '';
    const message = document.createElement('p');
    message.className = 'board__empty';
    message.textContent = 'Could not load the board.';
    boardRoot.append(message);
    showError(error);
    return;
  }
  if (!getState().loaded) paint();
}

init();
