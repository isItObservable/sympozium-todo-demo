"""BMAD Crew — todo-demo crew management for resume operations."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class CrewRole(str, Enum):
    """Roles available in the BMAD crew."""

    LEADER = "leader"
    DEVELOPER = "developer"
    REVIEWER = "reviewer"
    OBSERVER = "observer"


@dataclass
class CrewMember:
    """A single member of the BMAD crew."""

    name: str
    role: CrewRole
    active: bool = True
    tasks_completed: int = 0

    def complete_task(self) -> None:
        """Mark a task as completed by this member."""
        if not self.active:
            logger.warning("Cannot complete task: %s is inactive", self.name)
            return
        self.tasks_completed += 1
        logger.info(
            "%s (%s) completed task — total: %d",
            self.name,
            self.role.value,
            self.tasks_completed,
        )

    def deactivate(self) -> None:
        """Deactivate this crew member."""
        self.active = False
        logger.info("%s (%s) deactivated", self.name, self.role.value)


@dataclass
class BMADCrew:
    """The BMAD crew that manages todo-demo resume operations."""

    name: str
    members: list[CrewMember] = field(default_factory=list)
    _resume_state: dict[str, str] = field(default_factory=dict)

    def add_member(self, member: CrewMember) -> None:
        """Add a member to the crew."""
        self.members.append(member)
        logger.info("Added %s (%s) to crew '%s'", member.name, member.role.value, self.name)

    def resume_crew(self) -> list[str]:
        """Resume all active crew members and return their names."""
        resumed: list[str] = []
        for member in self.members:
            if not member.active:
                logger.debug("Skipping inactive member: %s", member.name)
                continue
            member.active = True
            resumed.append(member.name)
            logger.info("Resumed crew member: %s (%s)", member.name, member.role.value)
        self._resume_state["last_resumed"] = ", ".join(resumed) if resumed else "none"
        return resumed

    def get_active_count(self) -> int:
        """Return the number of active crew members."""
        return sum(1 for m in self.members if m.active)

    def get_summary(self) -> dict[str, str | int]:
        """Return a summary of the current crew state."""
        return {
            "crew_name": self.name,
            "total_members": len(self.members),
            "active_members": self.get_active_count(),
            "last_resumed": self._resume_state.get("last_resumed", "never"),
        }
