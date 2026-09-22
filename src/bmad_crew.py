"""BMAD Crew — task management for the BMAD (Build-Merge-Audit-Deliver) workflow.

This module provides a simple crew-based task tracker that supports:
  - Creating and managing crew members
  - Assigning tasks to crew members
  - Tracking task status through the BMAD pipeline stages
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class TaskStatus(Enum):
    """Pipeline stage for a BMAD task."""
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"


@dataclass
class CrewMember:
    """A member of the BMAD crew."""

    name: str
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    role: str = "developer"

    def __repr__(self) -> str:
        return f"CrewMember(name={self.name!r}, role={self.role!r})"


@dataclass
class Task:
    """A single BMAD task assigned to a crew member."""

    title: str
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    status: TaskStatus = TaskStatus.TODO
    assignee: Optional[CrewMember] = None
    description: str = ""

    def __repr__(self) -> str:
        return f"Task(id={self.id!r}, title={self.title!r}, status={self.status.value!r})"


class BMADCrew:
    """Manages a crew of members and their tasks through the BMAD pipeline."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.members: list[CrewMember] = []
        self.tasks: list[Task] = []

    # -- member management ---------------------------------------------------

    def add_member(self, name: str, role: str = "developer") -> CrewMember:
        """Add a new crew member and return it."""
        member = CrewMember(name=name, role=role)
        self.members.append(member)
        return member

    def remove_member(self, member_id: str) -> None:
        """Remove a crew member by ID. Tasks remain but become unassigned."""
        self.members = [m for m in self.members if m.id != member_id]

    # -- task management -----------------------------------------------------

    def create_task(
        self,
        title: str,
        assignee: Optional[CrewMember] = None,
        description: str = "",
    ) -> Task:
        """Create a new task in TODO status."""
        task = Task(title=title, assignee=assignee, description=description)
        self.tasks.append(task)
        return task

    def assign_task(self, task_id: str, member: CrewMember) -> None:
        """Assign an existing task to a crew member."""
        for task in self.tasks:
            if task.id == task_id:
                task.assignee = member
                return
        raise ValueError(f"Task {task_id!r} not found")

    def advance_task(self, task_id: str) -> TaskStatus:
        """Advance a task to the next BMAD stage. Returns the new status."""
        for task in self.tasks:
            if task.id == task_id:
                stage_order = list(TaskStatus)
                current_idx = stage_order.index(task.status)
                if current_idx < len(stage_order) - 1:
                    task.status = stage_order[current_idx + 1]
                return task.status
        raise ValueError(f"Task {task_id!r} not found")

    # -- queries -------------------------------------------------------------

    def get_tasks_by_status(self, status: TaskStatus) -> list[Task]:
        """Return all tasks matching the given status."""
        return [t for t in self.tasks if t.status == status]

    def get_member_tasks(self, member: CrewMember) -> list[Task]:
        """Return all tasks assigned to a specific crew member."""
        return [t for t in self.tasks if t.assignee and t.assignee.id == member.id]

    def summary(self) -> dict[str, int]:
        """Return a count of tasks per status."""
        counts: dict[str, int] = {s.value: 0 for s in TaskStatus}
        for task in self.tasks:
            counts[task.status.value] += 1
        return counts
