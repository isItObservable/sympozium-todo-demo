"""
BMAD Crew - Sympozium Todo Demo

Manages a crew of BMAD agents that coordinate to track, prioritize,
and execute todo items across the system.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class CrewRole(Enum):
    """BMAD crew member roles."""
    SCRUM_MASTER = "scrum_master"
    DEVELOPER = "developer"
    ARCHITECT = "architect"
    REVIEWER = "reviewer"


class TodoStatus(Enum):
    """Status of a todo item in the BMAD crew workflow."""
    BACKLOG = "backlog"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"
    BLOCKED = "blocked"


@dataclass
class TodoItem:
    """Represents a single todo item managed by the BMAD crew."""

    title: str
    description: str = ""
    status: TodoStatus = TodoStatus.BACKLOG
    assigned_role: Optional[CrewRole] = None
    priority: int = 0  # Higher number = higher priority
    story_id: Optional[str] = None

    def __repr__(self) -> str:
        return (
            f"TodoItem(title={self.title!r}, status={self.status.value}, "
            f"priority={self.priority})"
        )


@dataclass
class CrewMember:
    """A single member of the BMAD crew."""

    name: str
    role: CrewRole
    assigned_todos: list[TodoItem] = field(default_factory=list)

    def assign(self, todo: TodoItem) -> None:
        """Assign a todo item to this crew member."""
        self.assigned_todos.append(todo)
        todo.assigned_role = self.role
        logger.info("Assigned %s to %s", todo.title, self.name)

    def unassign(self, todo: TodoItem) -> None:
        """Remove a todo item from this crew member."""
        if todo in self.assigned_todos:
            self.assigned_todos.remove(todo)
            logger.info("Unassigned %s from %s", todo.title, self.name)

    def __repr__(self) -> str:
        return f"CrewMember(name={self.name!r}, role={self.role.value})"


class BMADCrew:
    """Coordinates the BMAD crew to manage todos and execute stories."""

    def __init__(self, name: str = "BMAD Crew") -> None:
        self.name = name
        self.members: list[CrewMember] = []
        self.todos: list[TodoItem] = []
        logger.info("Created BMAD crew: %s", self.name)

    def add_member(self, member: CrewMember) -> None:
        """Add a member to the crew."""
        self.members.append(member)
        logger.info("Added %s to crew", member.name)

    def create_todo(
        self,
        title: str,
        description: str = "",
        priority: int = 0,
        story_id: Optional[str] = None,
    ) -> TodoItem:
        """Create a new todo item and add it to the backlog."""
        todo = TodoItem(
            title=title,
            description=description,
            priority=priority,
            story_id=story_id,
        )
        self.todos.append(todo)
        logger.info("Created todo: %s (priority=%d)", title, priority)
        return todo

    def prioritize_backlog(self) -> list[TodoItem]:
        """Sort todos by priority descending and return the ordered backlog."""
        self.todos.sort(key=lambda t: t.priority, reverse=True)
        logger.info("Prioritized backlog: %d items", len(self.todos))
        return self.todos

    def assign_to_role(
        self, todo: TodoItem, role: CrewRole
    ) -> Optional[CrewMember]:
        """Find a crew member with the matching role and assign the todo."""
        for member in self.members:
            if member.role == role:
                member.assign(todo)
                return member
        logger.warning("No crew member found for role: %s", role.value)
        return None

    def move_to_status(self, todo: TodoItem, status: TodoStatus) -> None:
        """Transition a todo item to a new status."""
        if todo not in self.todos:
            raise ValueError(f"Todo {todo.title!r} is not in this crew's backlog")
        old_status = todo.status
        todo.status = status
        logger.info(
            "Moved %s: %s -> %s",
            todo.title,
            old_status.value,
            status.value,
        )

    def get_by_status(self, status: TodoStatus) -> list[TodoItem]:
        """Return all todos with the given status."""
        return [t for t in self.todos if t.status == status]

    def summary(self) -> dict[str, int]:
        """Return a count of todos grouped by status."""
        counts: dict[str, int] = {s.value: 0 for s in TodoStatus}
        for todo in self.todos:
            counts[todo.status.value] += 1
        return counts

    def __repr__(self) -> str:
        return (
            f"BMADCrew(name={self.name!r}, members={len(self.members)}, "
            f"todos={len(self.todos)})"
        )
