"""BMAD Crew management module."""

from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class CrewStatus(Enum):
    """Possible states for a crew."""
    INACTIVE = "inactive"
    ACTIVE = "active"
    ON_HOLIDAY = "on_holiday"
    DISBANDED = "disbanded"


@dataclass
class CrewMember:
    """Represents a single member of a BMAD crew."""
    name: str
    role: str

    def __str__(self) -> str:
        return f"{self.name} ({self.role})"


@dataclass
class Crew:
    """Manages a BMAD crew with members and status."""
    name: str
    status: CrewStatus = CrewStatus.INACTIVE
    _members: List[CrewMember] = field(default_factory=list, repr=False)

    def add_member(self, member: CrewMember) -> None:
        """Add a member to the crew."""
        if member not in self._members:
            self._members.append(member)

    def remove_member(self, name: str) -> bool:
        """Remove a member by name. Returns True if found and removed."""
        for i, m in enumerate(self._members):
            if m.name == name:
                self._members.pop(i)
                return True
        return False

    def update_status(self, status: CrewStatus) -> None:
        """Update the crew's status."""
        self.status = status

    def roster(self) -> List[str]:
        """Return a list of member names in the crew."""
        return [m.name for m in self._members]

    def __str__(self) -> str:
        return f"Crew({self.name}, status={self.status.value}, members={len(self._members)})"
