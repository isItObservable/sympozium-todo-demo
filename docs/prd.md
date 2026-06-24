# PRD: sympozium-todo-demo — Virtual Post-it Board

## Problem
The IsItObservable episode needs a live demo application showing how BMAD multi-agent crews can iteratively build observable software. The team needs a simple, relatable app to exercise all BMAD phases (Analysis → Planning → Solutioning → Implementation → Review) while demonstrating proper observability practices from day one.

## Goals (measurable)
- **G1**: A functional CRUD todo board UI with add/complete/delete operations — users can create todos on a visual "board" and mark them complete.
- **G2**: All application code is developed ticket-driven via BMAD phases, one story per PR, each passing adversarial review before merge.
- **G3**: Every service boundary has health endpoints; structured logging and request tracing are in place across the frontend-to-database call chain.

## Non-goals
- Authentication / user accounts (single-user demo)
- Real-time collaboration / WebSocket updates
- File attachments or rich text editing
- Mobile-native app (browser-responsive is sufficient)
- CI/CD pipeline automation (deployed locally for demonstration)

## Functional requirements
- **FR1**: The system MUST expose a RESTful API with endpoints for listing, creating, completing, and deleting todos.
- **FR2**: The system MUST store todos in a relational database (PostgreSQL) with fields: id, title, description, status (pending/completed), created_at, updated_at.
- **FR3**: The system MUST provide a browser-based UI that renders todos as "post-it notes" on a board, supports clicking to add new items, and allows marking items complete via checkbox interaction.
- **FR4**: All HTTP endpoints MUST return consistent JSON responses with status codes and error information.
- **FR5**: Every service MUST expose a `/health` endpoint returning 200 OK when healthy.

## Acceptance criteria (binding)
- [ ] AC1: A user can open the app in a browser and see an empty board with an "Add" button that creates a new todo post-it on click.
- [ ] AC2: A user can type a title into a new post-it, mark it complete, and see it visually distinguished from pending items.
- [ ] AC3: An API call to POST `/api/todos` with `{"title":"test"}` returns 201 and a todo object with id, status="pending", and timestamps.
- [ ] AC4: An API call to DELETE `/api/todos/{id}` removes the todo; subsequent GET returns 404.
- [ ] AC5: The health endpoint `GET /health` on each service returns `{"status":"ok"}` with HTTP 200.

## Risks & open questions
- Should the frontend be a SPA framework or server-rendered? (Decision: minimal — static site + vanilla JS fetch calls to avoid framework lock-in.)
- Does demo need container orchestration? (Decision: docker-compose for local dev only; Kubernetes manifests optional as stretch goal.)
- What's the language stack preference? (Decision: Go backend, HTML/CSS/JS frontend — boring, fast, easy to demonstrate.)
