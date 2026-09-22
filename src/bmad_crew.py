"""BMAD Crew — Todo demo implementation.

This module provides the core BMAD crew functionality for the
sympozium-todo-demo application, implementing the highest-priority
story: 'resume our bmad crew and'.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class CrewStatus(Enum):
    """Possible states of a BMAD crew."""

    DORMANT = "dormant"
    ACTIVE = "active"
    PAUSED = "paused"


@dataclass
class CrewMember:
    """Represents a single member of the BMAD crew."""

    name: str
    role: str
    status: CrewStatus = CrewStatus.ACTIVE

    def __repr__(self) -> str:
        return f"CrewMember(name={self.name!r}, role={self.role!r}, status={self.status.value})"


@dataclass
class BMADCrew:
    """Manages a crew of members for the todo demo.

    Acceptance criteria:
    - Crew can be created with an initial set of members.
    - Crew resumes from dormant state to active.
    - Members can be added and removed dynamically.
    - Crew status transitions are validated (dormant -> active, active -> paused, etc.).
    """

    name: str
    members: list[CrewMember] = field(default_factory=list)
    status: CrewStatus = CrewStatus.DORMANT

    def resume(self) -> None:
        """Resume the crew from dormant state to active."""
        if self.status != CrewStatus.DORMANT:
            raise ValueError(
                f"Cannot resume crew '{self.name}': current status is {self.status.value}, expected 'dormant'."
            )
        self.status = CrewStatus.ACTIVE
        logger.info("Crew '%s' resumed to active state.", self.name)

    def pause(self) -> None:
        """Pause the crew (active -> paused)."""
        if self.status != CrewStatus.ACTIVE:
            raise ValueError(
                f"Cannot pause crew '{self.name}': current status is {self.status.value}, expected 'active'."
            )
        self.status = CrewStatus.PAUSED
        logger.info("Crew '%s' paused.", self.name)

    def add_member(self, name: str, role: str) -> None:
        """Add a member to the crew."""
        if any(m.name == name for m in self.members):
            raise ValueError(f"Member '{name}' already exists in crew '{self.name}'.")
        self.members.append(CrewMember(name=name, role=role))
        logger.info("Added member '%s' (role=%s) to crew '%s'.", name, role, self.name)

    def remove_member(self, name: str) -> None:
        """Remove a member from the crew by name."""
        before = len(self.members)
        self.members = [m for m in self.members if m.name != name]
        if len(self.members) == before:
            raise KeyError(f"Member '{name}' not found in crew '{self.name}'.")
        logger.info("Removed member '%s' from crew '%s'.", name, self.name)

    def get_active_members(self) -> list[CrewMember]:
        """Return all members whose status is ACTIVE."""
        return [m for m in self.members if m.status == CrewStatus.ACTIVE]

    def __repr__(self) -> str:
        return (
            f"BMADCrew(name={self.name!r}, status={self.status.value}, "
            f"members={len(self.members)})"
        )


def create_default_crew() -> BMADCrew:
    """Factory function that creates the default BMAD crew for the demo."""
    crew = BMADCrew(name="bmad-crew")
    crew.add_member("Amelia", "Senior Engineer")
    crew.add_member("Ben", "QA Lead")
    crew.add_member("Charlie", "DevOps")
    return crew
