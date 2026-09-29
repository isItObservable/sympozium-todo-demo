package crew

import (
	"testing"
)

func TestNewCrew(t *testing.T) {
	c := NewCrew()
	if c == nil {
		t.Fatal("expected non-nil crew")
	}
	if len(c.Members) != 0 {
		t.Errorf("expected empty crew, got %d members", len(c.Members))
	}
}

func TestAddMember(t *testing.T) {
	c := NewCrew()
	member := CrewMember{
		ID:   "test-1",
		Name: "Test Member",
		Role: "Commander",
		Active: true,
	}
	c.AddMember(member)
	if len(c.Members) != 1 {
		t.Errorf("expected 1 member, got %d", len(c.Members))
	}
	if c.Members[0].Name != "Test Member" {
		t.Errorf("expected name 'Test Member', got '%s'", c.Members[0].Name)
	}
}

func TestRemoveMember(t *testing.T) {
	c := NewCrew()
	member := CrewMember{ID: "test-1", Name: "Test"}
	c.AddMember(member)
	if !c.RemoveMember("test-1") {
		t.Error("expected RemoveMember to return true")
	}
	if len(c.Members) != 0 {
		t.Errorf("expected 0 members after removal, got %d", len(c.Members))
	}
}

func TestGetMember(t *testing.T) {
	c := NewCrew()
	member := CrewMember{ID: "test-1", Name: "Test"}
	c.AddMember(member)
	found, ok := c.GetMember("test-1")
	if !ok {
		t.Error("expected GetMember to find the member")
	}
	if found.Name != "Test" {
		t.Errorf("expected name 'Test', got '%s'", found.Name)
	}
	_, ok = c.GetMember("nonexistent")
	if ok {
		t.Error("expected GetMember to return false for nonexistent member")
	}
}

func TestActiveMembers(t *testing.T) {
	c := NewCrew()
	c.AddMember(CrewMember{ID: "1", Name: "A", Active: true})
	c.AddMember(CrewMember{ID: "2", Name: "B", Active: false})
	c.AddMember(CrewMember{ID: "3", Name: "C", Active: true})
	active := c.ActiveMembers()
	if len(active) != 2 {
		t.Errorf("expected 2 active members, got %d", len(active))
	}
}
