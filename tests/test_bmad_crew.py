"""Tests for the BMAD crew module."""

import pytest
from bmad_crew.crew import Crew, CrewMember, CrewStatus


class TestCrewMember:
    def test_str_representation(self):
        member = CrewMember("Alice", "lead")
        assert str(member) == "Alice (lead)"


class TestCrew:
    def test_create_crew_default_status(self):
        crew = Crew(name="BMAD")
        assert crew.name == "BMAD"
        assert crew.status == CrewStatus.INACTIVE
        assert crew.roster() == []

    def test_add_member(self):
        crew = Crew(name="BMAD")
        crew.add_member(CrewMember("Alice", "lead"))
        assert len(crew.roster()) == 1
        assert "Alice" in crew.roster()

    def test_add_duplicate_member_ignored(self):
        crew = Crew(name="BMAD")
        alice = CrewMember("Alice", "lead")
        crew.add_member(alice)
        crew.add_member(alice)
        assert len(crew.roster()) == 1

    def test_remove_member(self):
        crew = Crew(name="BMAD")
        crew.add_member(CrewMember("Alice", "lead"))
        assert crew.remove_member("Alice") is True
        assert len(crew.roster()) == 0

    def test_remove_nonexistent_member(self):
        crew = Crew(name="BMAD")
        assert crew.remove_member("Nobody") is False

    def test_update_status(self):
        crew = Crew(name="BMAD")
        crew.update_status(CrewStatus.ACTIVE)
        assert crew.status == CrewStatus.ACTIVE

    def test_str_representation(self):
        crew = Crew(name="BMAD")
        crew.add_member(CrewMember("Alice", "lead"))
        assert "Crew(BMAD" in str(crew)
