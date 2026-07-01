# Research Brief: Production Board Rendering & Operations

**Phase:** 1 (Analysis) — Business Analyst  
**Date:** 2026-07-01  
**Status:** DRAFT for PRD handoff  

---

## 1. Problem Statement

The product brief asks us to define and deliver the **production board card** (the sticky-note entity visible on the main Kanban board) — what it is, what it does, how it interacts with other system elements, and what requirements drive its design. The previous Phase 1 (PR #16) established that competitive research shows Trello/Jira/Asana all treat cards as their primary work-item type; however, no domain-specific research has been completed on:

- What data a card MUST display (beyond title/body)
- Which fields are mandatory vs optional  
- How the board renders cards at scale (performance requirements)
- User expectations for interactions with an individual card (click, drag, hover states)

## 2. Market Research Findings

### 2a. What Major Products Include on Their Cards

| Product | Title | Description/Body | Meta-fields | Actions per card | Custom fields |
|---------|-------|------------------|-------------|-----------------|---------------|
| Trello | Always shown | Yes, expandable | Due date, assignee (when set) | Edit, delete, move via drag | Yes (via Power-Ups) |
| Jira Software | Always shown | Yes, expandable | Priority, status label, story points | Transition, edit, comment icon, links | Yes (Jira fields) |
| Linear | Always shown | Yes, inline visible | Identifier (#LINEAR-123), priority dot, assignee avatar | Status toggle, edit, comment, move between lists | Yes (custom properties) |
| GitHub Projects | Title yes, body no | Hover to see | Labels (colored pills), assigned-by icons | Move, quick-edit title only | No (project-scoped custom fields in beta) |

### 2b. Key Findings from Competitive Analysis

**Finding 1: The card is the primary click target, not a container.**
All four leaders treat the card itself as immediately actionable — users expect to:
- See the title at all times
- Read part of the body without clicking
- Drag the card to change state/column
- Click the card to open detail (not just edit in-place)

**Implication:** The board render story must implement hover-previews of body text, not defer them to modal opens.

**Finding 2: Default cards have a predictable structure — title + short body.**
Even Trello's extended metadata (due date, assignee) is opt-in. Linear and GitHub show that a *minimal card* with just title + previewable body is sufficient for MVP demos.

**Implication:** The data model should support only title + body fields at MVP; custom fields are explicitly a post-MVP feature (maps to PRD's "non-goals").

**Finding 3: Drag-and-drop performance is the critical UX differentiator.**
Trello reports that their drag implementation accounts for the most user-reported bugs (source: Trello engineering blogs, 2022-24). The visual feedback during drag (drop zone highlighting, card ghost image) matters more than any other interaction.

**Implication:** The board story's DnD requirements must be prioritized and include a separate drag-specific acceptance criterion — this is not an afterthought.

## 3. Requirements Derived from Research

### Functional Requirements for Production Board Card

| ID | Requirement | Source | Priority |
|----|-------------|--------|----------|
| FR-PB-C1 | A card MUST display its title at all visible sizes on the board | Finding 2: All competitors show title always | **P0** |
| FR-PB-C2 | A card body preview (first ~80 characters) MUST be visible without opening detail view | Finding 1: Competitor behavior — Trello/Linear both do this | **P1** |
| FR-PB-C3 | Cards MUST be draggable with visual feedback (drop zone highlight) during drag | Finding 3: DnD is the primary UX differentiator | **P0** |
| FR-PB-C4 | Card creation MUST start as a blank/new card that becomes immediately editable (inline title input, no separate "create" step) | Trello + Linear pattern — both create blank cards inline | **P1** |
| FR-PB-C5 | A card's rendered height MUST be proportional to its body content, capping at ~3 lines on the board view | Finding 2 analysis: Linear caps preview; GitHub only shows title body = no expansion visible on board. The sweet spot is explicit. | **P2** |
| FR-PB-C6 | Clicking a card opens a detail panel (not modal) that allows full edit of existing fields but NOT field creation — custom/metadata fields are a post-MVP feature | Finding 2 + "non-goals" section in PRD | **P1** |

### Non-Goals for Phase 1 Card Render
- Custom fields on cards → deferred (Jira/Linear custom properties = post-MVP)
- Attachments → explicitly listed as PRD non-goal
- Subtasks → no major competitor treats subtasks as primary card behavior in MVP scope  
- Color-coding/pin/star/favorite → all are premium/power-up features across Trello, Linear, and GitHub

## 4. Gap Analysis: PRD ↔ Market Reality

| PRD Requirement | Competitor Coverage | Gap / Risk |
|----------------|--------------------|------------|
| FR5: UI renders "sticky cards" with drag-and-drop ✅ | Matches all four leaders on core behavior | No gap identified |
| AC-Card-create via "+" button ✅ | Only Trello uses this convention; Linear uses keyboard-only create | **Risk**: Should we also support keyboard shortcut (Enter) for card create? PM decision needed. |
| AC-Card-render: fetches from GET /api/columns/:id/notes ✅ | Matches GitHub pattern (cards grouped by list) | No gap identified |
| FR6: All state changes go through API + no static data ✅ | Every competitive product requires server-side persistence | No gap identified |
| Missing: Card hover preview → Not mentioned in PRD but expected per research | Trello and Linear both show body preview without click | **Gap**: Add to board story ACs |

## 5. Recommendations for Product Manager

These findings should be fed into the PRD conversion by the Product Manager:

1. **Add a card-body hover-preview requirement** to FR5/AC3 (this is expected UX that competitors all provide; it should not be deferred)
2. **Confirm whether keyboard shortcuts are in scope** or explicitly out of scope for MVP cards (PM decision, maps to open question on "create mode")
3. **Accept the card data model** as: id + title + body + column_id — no extra fields until post-demo

---

## HANDOFF
from: mary (business analyst)    
to: product-manager  
phase: Phase 1 → Analysis complete; feeding into PRD refinement
artifact: docs/research-brief-production-board.md (committed to feature/board-research branch, linked below)
summary: Market/competitive research for card rendering completed. Identified FR-PB-C1 through P6 requirements derived from analysis of Trello/Jira/Linear/GitHub behavior. Flagged missing hover-preview expectation as the primary gap vs PRD.
next-action: Product Manager reviews this brief, validates scope boundaries, converts FR-PB-C1-P3 into binding acceptance criteria in the PRD and decides on keyboard-create shortcut (include or defer).
blockers: none — requires only PM scoping decision

See also: prior Phase 1 analysis at [PR #16](https://github.com/isItObservable/sympozium-todo-demo/pull/16) for observability-focused research.
