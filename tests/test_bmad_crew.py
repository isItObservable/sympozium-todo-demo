"""Tests for bmad_crew module."""

import unittest
from src.bmad_crew import BMADCrew, CrewMember


class TestBMADCrew(unittest.TestCase):
    """Test suite for BMADCrew class."""

    def setUp(self):
        """Set up test fixtures."""
        self.crew = BMADCrew("test-crew")

    def test_crew_initialization(self):
        """Verify crew initializes with correct name."""
        self.assertEqual(self.crew.name, "test-crew")
        self.assertEqual(len(self.crew.members), 0)

    def test_add_member(self):
        """Test adding a member to the crew."""
        member = CrewMember("alice", "engineer")
        self.crew.add_member(member)
        self.assertEqual(len(self.crew.members), 1)
        self.assertEqual(self.crew.members[0].name, "alice")

    def test_add_duplicate_member(self):
        """Test that adding a duplicate member raises ValueError."""
        member = CrewMember("bob", "designer")
        self.crew.add_member(member)
        with self.assertRaises(ValueError):
            self.crew.add_member(CrewMember("bob", "developer"))

    def test_remove_member(self):
        """Test removing a member from the crew."""
        member = CrewMember("carol", "analyst")
        self.crew.add_member(member)
        self.crew.remove_member("carol")
        self.assertEqual(len(self.crew.members), 0)

    def test_remove_nonexistent_member(self):
        """Test removing a non-existent member raises KeyError."""
        with self.assertRaises(KeyError):
            self.crew.remove_member("ghost")

    def test_crew_size(self):
        """Test crew size calculation."""
        self.assertEqual(self.crew.size, 0)
        self.crew.add_member(CrewMember("dave", "lead"))
        self.crew.add_member(CrewMember("eve", "contributor"))
        self.assertEqual(self.crew.size, 2)

    def test_crew_roles(self):
        """Test retrieving unique roles in the crew."""
        self.crew.add_member(CrewMember("frank", "engineer"))
        self.crew.add_member(CrewMember("grace", "engineer"))
        self.crew.add_member(CrewMember("hank", "designer"))
        roles = self.crew.roles
        self.assertIn("engineer", roles)
        self.assertIn("designer", roles)
        self.assertEqual(len(roles), 2)

    def test_crew_to_dict(self):
        """Test crew serialization to dict."""
        self.crew.add_member(CrewMember("ivan", "qa"))
        crew_dict = self.crew.to_dict()
        self.assertIn("name", crew_dict)
        self.assertIn("members", crew_dict)
        self.assertEqual(crew_dict["name"], "test-crew")

    def test_crew_from_dict(self):
        """Test crew deserialization from dict."""
        data = {
            "name": "restored-crew",
            "members": [
                {"name": "judy", "role": "pm"},
                {"name": "kyle", "role": "devops"}
            ]
        }
        restored = BMADCrew.from_dict(data)
        self.assertEqual(restored.name, "restored-crew")
        self.assertEqual(len(restored.members), 2)

    def test_crew_is_empty(self):
        """Test empty crew check."""
        self.assertTrue(self.crew.is_empty())
        self.crew.add_member(CrewMember("lisa", "tester"))
        self.assertFalse(self.crew.is_empty())


if __name__ == "__main__":
    unittest.main()
