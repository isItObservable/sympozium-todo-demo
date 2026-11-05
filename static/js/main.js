// Entry point: load state, render the board, keep the view in sync.
import { loadBoard, subscribe, getState } from './store.js';
import { renderBoard } from './board.js';

const boardRoot = document.getElementById('board');

function paint() {
  renderBoard(boardRoot);
}

subscribe(paint);

async function init() {
  try {
    await loadBoard();
  } catch (error) {
    boardRoot.setAttribute('aria-busy', 'false');
    boardRoot.innerHTML = '';
    const message = document.createElement('p');
    message.className = 'board__empty';
    message.textContent = `Could not load the board. ${error.message}`;
    boardRoot.append(message);
    if (typeof console !== 'undefined') console.error(error);
    return;
  }
  if (!getState().loaded) paint();
}

init();
