# Run the board (v1)

## One-liner

```bash
docker-compose up   # then open http://localhost
```

That's it — no build step, no node toolchain, no `npm install` (Q3 / NFR5). nginx
serves `static/` directly and the browser runs the ES modules in `static/js`.

> First run on a machine without the image: `docker compose up` (v2) works the
> same way if your `docker` CLI ships the compose plugin.

## What you should see

The board at <http://localhost>:

- one column per result of `GET /api/columns/`, left→right in API order;
- post-it notes per column, coloured from the `yellow/pink/blue/green` palette;
- a `Title (n)` header per column where **n is recomputed from local notes on
every render** — never a stored counter (R2);
- a `+ Note` button at the bottom of each column;
- drag a card to another column to move it; an inline form to edit or delete it.

## Smoke test

Against a running stack:

```bash
./scripts/smoke.sh
```

It walks load → create → move → edit → delete, plus the R2 count guard, using
only `bash` and `curl`. Endpoints the backend does not implement yet are
reported as **BLOCKED** rather than failed, so the ship gate stays honest
without stubbing the contract.

## Architecture

```
┌────────────┐      ┌───────────────┐      ┌────────────┐
│  Browser   │─────▶│  Board (nginx)│      │            │
│  static/   │      │  :80          │      │            │
│  ES modules│      │  static/ ro   │      │            │
└────────────┘      └───────┬───────┘      └────────────┘
                            │  /api/ + /health proxy
                            ▼
                    ┌───────────────┐      ┌────────────┐
                    │ Backend API   │─────▶│  SQLite DB │
                    │ :8080         │◀─────│  todos.db  │
                    │ REST / JSON   │      │            │
                    └───────────────┘      └────────────┘
```

The backend container is currently commented out in `docker-compose.yml`: there
is no backend `main` package in the repo yet, so a backend container would not
start. While it is absent, `/api/` returns 502 through the proxy and the board
shows its non-blocking error banner — the frontend contract is implemented as
specified and is **not** stubbed. Re-enable the block (and the nginx
`proxy_pass` targets are already wired) once the service exists.

## Running the backend tests

Go tests are the repo's only test suite; the frontend deliberately ships none
that need a node toolchain.

```bash
go test ./...
```

## Endpoint contract used by the frontend

| Method | Path | Body / query |
|---|---|---|
| GET | `/api/columns/` | — |
| GET | `/api/notes/` | `?column_id=:id` |
| POST | `/api/notes/` | `{title, body, columnId}` → 201 |
| PUT | `/api/notes/:id` | `{title, body}` |
| PATCH | `/api/notes/:id/move` | `{columnId}` |
| DELETE | `/api/notes/:id` | → 204 |

Invariants the UI guarantees: ids are treated as **opaque strings** end to end
(Q1); wire casing is normalized **once** in `static/js/api.js` (Q2); `color` is
client-side only and **never** sent upstream (Q4).

## Backlog clarification

Plan #44 / anchor #54 specified **one** PR (`feat/ui-finalization-v1`). Delivery
was split into three stacked PRs, one per epic, so each reviews against its own
epic only: PR A = Epic 5 (#39), PR B = Epic 6 (#37), PR C = this ship gate
(#53). Merge in that order.
