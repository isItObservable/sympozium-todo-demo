package crew

import (
	"encoding/json"
	"testing"
)

func TestCrewMemberJSON(t *testing.T) {
	member := CrewMember{
		ID:     "test-1",
		Name:   "Test Member",
		Role:   "Commander",
		Active: true,
	}
	data, err := json.Marshal(member)
	if err != nil {
		t.Fatalf("unexpected error marshaling: %v", err)
	}
	var decoded CrewMember
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("unexpected error unmarshaling: %v", err)
	}
	if decoded.ID != member.ID {
		t.Errorf("expected ID '%s', got '%s'", member.ID, decoded.ID)
	}
	if decoded.Name != member.Name {
		t.Errorf("expected Name '%s', got '%s'", member.Name, decoded.Name)
	}
}

func TestCrewJSON(t *testing.T) {
	c := NewCrew()
	c.AddMember(CrewMember{ID: "1", Name: "A"})
	data, err := json.Marshal(c)
	if err != nil {
		t.Fatalf("unexpected error marshaling: %v", err)
	}
	var decoded Crew
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("unexpected error unmarshaling: %v", err)
	}
	if len(decoded.Members) != 1 {
		t.Errorf("expected 1 member after JSON round-trip, got %d", len(decoded.Members))
	}
}
