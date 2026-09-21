"""BMAD Crew – highest-priority story implementation.

This module provides the core crew management functionality for the
sympozium-todo-demo application.  It defines the BMAD (Battle-Mapped
Action Driver) crew model and its lifecycle methods.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class CrewRole(Enum):
    """Roles within a BMAD crew."""

    LEADER = "leader"
    SCOUT = "scout"
    ENGINEER = "engineer"
    MEDIC = "medic"
    DOCTOR = "doctor"


@dataclass
class CrewMember:
    """A single member of a BMAD crew."""

    name: str
    role: CrewRole
    is_active: bool = True

    def __repr__(self) -> str:
        status = "active" if self.is_active else "inactive"
        return f"CrewMember(name={self.name!r}, role={self.role.value}, {status})"


@dataclass
class BMADCrew:
    """A BMAD crew containing a set of members.

    Acceptance criteria:
    - A crew can be created with an optional name (defaults to "unnamed").
    - Members can be added and removed by name.
    - The crew reports its roster as a list of active members.
    - The crew exposes the total, active, and inactive member counts.
    """

    name: str = "unnamed"
    _members: list[CrewMember] = field(default_factory=list)

    # -- public API --------------------------------------------------------

    def add_member(self, name: str, role: CrewRole) -> None:
        """Add a new member to the crew (no-op if already present)."""
        if any(m.name == name for m in self._members):
            logger.info("Member %s already in crew %s", name, self.name)
            return
        self._members.append(CrewMember(name=name, role=role))
        logger.info("Added %s (%s) to crew %s", name, role.value, self.name)

    def remove_member(self, name: str) -> bool:
        """Remove a member by name.  Returns True if the member was found."""
        before = len(self._members)
        self._members = [m for m in self._members if m.name != name]
        removed = len(self._members) < before
        if removed:
            logger.info("Removed %s from crew %s", name, self.name)
        return removed

    def activate_member(self, name: str) -> bool:
        """Activate a previously inactive member.  Returns True if found."""
        for m in self._members:
            if m.name == name:
                m.is_active = True
                logger.info("Activated %s in crew %s", name, self.name)
                return True
        return False

    def deactivate_member(self, name: str) -> bool:
        """Deactivate a member.  Returns True if found."""
        for m in self._members:
            if m.name == name:
                m.is_active = False
                logger.info("Deactivated %s in crew %s", name, self.name)
                return True
        return False

    @property
    def active_members(self) -> list[CrewMember]:
        """Return only the currently active members."""
        return [m for m in self._members if m.is_active]

    @property
    def total_count(self) -> int:
        return len(self._members)

    @property
    def active_count(self) -> int:
        return len(self.active_members)

    @property
    def inactive_count(self) -> int:
        return self.total_count - self.active_count

    # -- helpers -----------------------------------------------------------

    def __repr__(self) -> str:
        return (
            f"BMADCrew(name={self.name!r}, "
            f"total={self.total_count}, active={self.active_count})"
        )


# ------------------------------------------------------------------ main

def create_default_crew() -> BMADCrew:
    """Return a pre-seeded default crew for quick demos."""
    crew = BMADCrew(name="default")
    crew.add_member("Alpha", CrewRole.LEADER)
    crew.add_member("Bravo", CrewRole.SCOUT)
    crew.add_member("Charlie", CrewRole.ENGINEER)
    return crew


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    crew = create_default_crew()
    print(crew)
    print(f"Active: {[m.name for m in crew.active_members]}")