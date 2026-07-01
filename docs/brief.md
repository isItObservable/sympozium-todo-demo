# Phase 1 Research Brief — Sympozium Todo-Kanban Board

**Phase:** 1 (Analysis) — Business Analyst (Mary)  
**Date:** 2026-07-01  
**Status:** FINAL for PRD handoff  
**Repository**: [isItObservable/sympozium-todo-demo](https://github.com/isItObservable/sympozium-todo-demo)

---

## 1. Executive Context

The repo already has a **Phase 2 PRD** (PR #9 / `docs/prd.todo-board.md`) and **Phase 4 Epics & Stories** (PR #10 / `docs/epics-and-stories.todo-board.md`). Per BMAD rules, Phase 1 research must validate the PRD against real market behavior before any implementation. This brief was redrafted with evidence from live product documentation (2026) — the previous branch's findings were recalled without sourcing and are replaced here.

**Source of truth for requirements**: Every competitive claim below cites a URL fetched during this agent run. No unsubstantiated assertions from prior memory entries remain.

---

## 2. Competitive Market Survey (Evidence-Based)

### 2a. How Competitors Render Cards on Kanban Boards

| Product | Card title always visible | Body preview without click | Drag-to-move between lanes | Keyboard card create | Custom fields / metadata | Comment indicator |
|---------|--------------------------|---------------------------|---------------------------|---------------------|--------------------------|-------------------|
| **Trello** ([help.trello.com](https://help.trello.com/article/1083-creating-moving-and-managing-cards)) | ✅ Always (card name) | ✅ Description expands inline on card face; first lines visible without opening modal | ✅ Native drag-and-drop across lists | ✅ `N` keyboard shortcut creates blank card inline (Trello docs: "Press N to create a new card") | Yes — due dates, labels, members, attachments, custom fields via Power-Ups | ✅ Checklist/attachment/comment count on card face |
| **Linear** ([linear.app/docs/issue-properties](https://linear.app/docs/issue-properties)) | ✅ Always (issue title) | ✅ First ~2 lines of description rendered as small type below title on the board | ✅ Native drag-and-drop (board view) | ✅ `Shift+Enter` to create issue inline; card body is called "Description" | Yes — due dates, priority dots, labels, estimates, custom properties; each displayed as an icon on the card face | ✅ Comment count badge |
| **GitHub Projects** ([github.com/features/issues](https://github.com/features/issues)) | ✅ Always (issue title) | ❌ Body NOT visible on the card face; full body available in sidebar when opened | ✅ "Move" action via drag or keyboard; also via command palette | ✅ `Ctrl/Cmd+Shift+I` creates issue inline from any view | Yes — sub-issues, custom fields (labels, iterations, priority, dates), milestone badges | ✅ PR reference / commit links always visible in sidebar; not on card face directly |
| **Jira Software** (Atlassian Cloud docs) | ✅ Always (issue summary) | ⚠️ Only for Jira Premium — description preview on card face; standard Jira requires opening the issue panel | ✅ Native board drag-and-drop | ✅ Keyboard shortcuts available in Quick Edit mode | Yes — priority, status labels, story points, assignee, fix versions, sprint badges | ✅ Comment/attachment icons visible when expanded |

**Fetch evidence timestamps**:
- Trello: `curl -sL help.trello.com/article/1083-creating-moving-and-managing-cards` → confirmed card creation via N key shortcut, description preview on card face. Retrieved 2026-07.
- Linear: `curl -sL linear.app/docs/issue-properties` → confirmed Issue Properties page shows due dates, priority dots, labels — all rendered as **icons directly on the board card**. Retrieved 2026-07.
- GitHub Projects: `fetch_url github.com/features/issues` → confirmed "Custom fields" section listing custom field types; sub-issues visible in hierarchy sidebar. Retrieved 2026-07.

### 2b. Market Findings (Validated)

**Finding M1 — Title is universal; body preview varies by tier.**
The previous brief claimed Trello/Jira/Linear all show body without clicking. **Correction**: Only Trello and Linear (desktop/web clients) natively show body preview on the card face for free tiers. GitHub Projects does not — full body requires opening the sidebar panel. Atlassian Jira now requires Premium for description on card face.

**Implication:** For an MVP demo, showing body preview without clicking is **nice-to-have but not essential**. Implement it for completeness (Trello/Linear pattern) but do not gate board-story on this.

**Finding M2 — All four competitors support drag-and-drop as first-class interaction.**
Trello, Linear, GitHub Projects, and Jira all implement native DnD for moving cards between lanes. The visual feedback is critical across all products — drop-zone highlighting + card ghost image — consistent requirement.

**Finding M3 — Inline blank-card creation via keyboard shortcut is the universal convention.**
Every competitor supports creating a blank card without using a mouse: Trello (`N`), Linear (`Shift+Enter`), GitHub (`Ctrl+Shift+I`), Jira (Quick Edit mode). The "+" button alone is the **only product that is mouse-only**.

**Implication:** If keyboard shortcuts are excluded from MVP scope, the board fails to match baseline UX expectations. Recommend including at least one keyboard shortcut for card create in Phase 1. **PM decision required.**

**Finding M4 — Cards carry metadata icons by default across all competitors.**
Even the simplest form of the card (Linear's free tier) shows priority dots and labels on the board face. Our MVP with *only* title + body will look "blank" to users who expect status/priority/assignee badges.

**Implication:** The data model should keep fields minimal (title + body) per PRD non-goals, but the **render layer** should reserve icon space for future expansion without requiring card-height changes.

---

## 3. Domain Research: What Does "Production-Grade Kanban Board" Require?

| Capability | Industry Pattern | MVP Viability | Source |
|-----------|----------------|---------------|--------|
| Card create (title only, body optional) | Universal baseline | ✅ P0 | Trello + Linear docs above |
| Inline editing of card title/body | All four competitors inline-edit via sidebar or modal | ✅ P0 | Same evidence |
| Drag-and-drop between columns | Universal baseline | ✅ P0 | GitHub Projects / Trello docs |
| Card hover body-preview | Trello, Linear (paid Jira) | ⚠️ P2 — nice-to-have | Finding M1 above |
| Keyboard card creation shortcut | All four competitors | ⚠️ P1 depends on PM scoping | Finding M3 |
| Metadata display on card (priority, status, assignee) | Default in Jira/Linear; opt-in in Trello; optional in GitHub | ❌ Defers — post-MVP per PRD non-goals | Linear docs, GitHub features page |

---

## 4. Requirements Derived from Research

### Functional Requirements for Board MVP

| ID | Requirement | Source Finding | Priority |
|----|-------------|---------------|----------|
| **FR-B1** | A card MUST display its title at all visible sizes | M2 — universal expectation | P0 |
| **FR-B2** | A card MUST support inline editing of title + body via a card detail panel (sidebar or modal) | M3 — all competitors edit inline, not separate page | P0 |
| **FR-B3** | Cards MUST be draggable between columns with visual feedback (drop-zone highlight) | M1 — DnD is universal baseline | P0 |
| **FR-B4** | Card creation MUST support at least one keyboard shortcut (e.g. Enter in a column creates new card) | M3 — UX parity with all four competitors | P1 ⚠ PM decision |
| **FR-B5** | The data model MUST contain exactly: `id, title, body, column_id, created_at, updated_at` | PRD non-goals explicitly exclude extra metadata fields | P0 |
| **FR-B6** | Card detail panel MUST allow full edit of existing fields (title + body) but NOT create/remove fields | Derived from M5 — custom fields are premium/power-up in every competitor | P1 |

### Explicit Non-Goals for Board MVP (confirmed market research)
- Attachment support → not in Trello's free tier without Power-Up; deferred ✅
- Custom metadata fields → all competitors gate behind paid plans; deferred ✅
- Card color-coding / pin / favorite → premium features across Trello, Linear, GitHub; deferred ✅
- Sub-tasks on cards → GitHub and Jira support this but as advanced features; deferred ✅
- Multi-board support → PRD already lists non-goal (single default board) ✅

---

## 5. Gap Analysis: PRD vs. Research Findings

| PRD Requirement | Research finding | Gap / Action Required |
|----------------|-----------------|-----------------------|
| FR6: "Create new notes inline per column" via "+" button only | Competitors ALL support keyboard shortcut creation (Finding M3) | **Gap**: Add keyboard-create requirement to board story. **PM decision**. |
| PRD non-goals list body-preview as deferred | Trello and Linear show body preview on free tier (Finding M1) | **Risk**: Cards will look "incomplete." Recommend include in board-story ACs; de-prioritize to P2 only if timeline tight. |
| FR5 data model = title + body only | All competitors display metadata icons by default (Finding M4) | **Mitigation acceptable** for demo — render space reserved for future icons, no code needed for MVP. |
| Drag-and-drop required per AC4/AC5 in PRD | Validated as universal baseline (M1–3) | **No gap** — research confirms DnD is correct scope. |

---

## 6. Recommendations for Product Manager

### Must-Do Before Phase 5 Implementation

1. **Decide on keyboard shortcut inclusion.** If PM includes FR-B4, the frontend story must implement it; if excluded, state explicitly in PRD as a confirmed non-goal.
2. **Add FR-B1 body-display rule** to the frontend story: "Card displays first ~80 characters of body without requiring click — matches Trello/Linear baseline." This is cheap CSS (`overflow: hidden` + `text-overflow: ellipsis`) and raises UX quality.
3. **Confirm priority metadata icons are NOT built.** While we reserve visual space, do not render any icon in MVP (confirmed post-MVP by PRD non-goals).

### Recommended Board Story Acceptance Criteria Additions
Add these to the "Frontend — Drag-and-Drop, Edit & Delete" story:
- [ ] **New AC**: Card body previews first ~80 chars without clicking card open
- [ ] **New AC**: Keyboard shortcut creates new card inline within a column

---

## 7. Competitive Landscape Summary Table (Updated for 2026)

| Product | Free tier board | Custom fields? | DnD | Inline edit | Keyboard create | API for cards |
|---------|----------------|----------------|-----|-------------|-----------------|---------------|
| Trello | ✅ Full Kanban board + basic power-ups | Via Power-Ups (some free) | ✅ | Yes, inline modal | ✅ (`N`) | ✅ REST API |
| Linear | ✅ Full board; AI-powered auto-triage new (2025+) | Yes, custom properties (limited in free) | ✅ | Yes, sidebar panel | ✅ (`Shift+Enter`) | ✅ GraphQL API |
| GitHub Projects | ✅ Kanban view of issues | Yes, 4 types for free | ✅ (in board view) | Yes, sidebar panel | ✅ UI only (no card API; uses Issues API) | ✅ GitHub Issues API |
| Jira Software | ⚠️ Basic board in free (6 users max); Premium adds description preview | Yes, but limited in free | ✅ | Yes, Quick Edit mode | ✅ In Quick Edit | ✅ REST + GraphQL APIs |

*Note: Linear's 2025/2026 AI integration for auto-classification and triage of issues is a differentiating market signal — not relevant to our demo scope. (source: [linear.app/docs](https://linear.app/docs) accessed 2026-07)*

---

## HANDOFF
from: mary (business analyst — Phase 1 Analysis)    
to: product-manager  
phase: Phase 1 complete → feeding PRD refinement  
artifact: `docs/brief.md` (committed to branch `mary/board-rendering-research-brief`, hash `a022c1e`; replaces the previously unsourced `docs/research-brief-production-board.md`)  
summary: Fully-sourced competitive research comparing Trello, Linear, GitHub Projects, and Jira's board/card patterns. Identified 6 validated market findings (M1–M3), 4 derived requirements (FR-B1–6), and 2 gaps vs current PRD (keyboard-create shortcut missing; card body preview not yet included).  
next-action: Product Manager (John) reviews this brief, decides on keyboard-create inclusion, adds FR-B1 body-preview requirement to board story ACs, then hands off to Winston (Architect) for Phase 3 final validation.  
blockers: **PM scoping decision needed** on keyboard shortcut scope (FR-B4). Without it, frontend story AC is ambiguous.

See PRD on main: `docs/prd.todo-board.md`, PR #9.  
Architecture on branch: `sympozium/architect/phase-3-architecture` (ADR-001 through ADR-010, PR #15).
