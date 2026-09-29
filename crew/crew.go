package crew

import (
	"fmt"
	"time"
)

// CrewMember represents a member of the BMAD crew
type CrewMember struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	Active    bool      `json:"active"`
	JoinedAt  time.Time `json:"joined_at"`
}

// Crew manages a collection of crew members
type Crew struct {
	Members []CrewMember `json:"members"`
}

// NewCrew creates a new empty crew
func NewCrew() *Crew {
	return &Crew{
		Members: make([]CrewMember, 0),
	}
}

// AddMember adds a crew member to the crew
func (c *Crew) AddMember(member CrewMember) {
	if member.ID == "" {
		member.ID = fmt.Sprintf("crew-%d", time.Now().UnixNano())
	}
	if member.JoinedAt.IsZero() {
		member.JoinedAt = time.Now()
	}
	c.Members = append(c.Members, member)
}

// RemoveMember removes a crew member by ID
func (c *Crew) RemoveMember(id string) bool {
	for i, m := range c.Members {
		if m.ID == id {
			c.Members = append(c.Members[:i], c.Members[i+1:]...)
			return true
		}
	}
	return false
}

// GetMember returns a crew member by ID
func (c *Crew) GetMember(id string) (*CrewMember, bool) {
	for _, m := range c.Members {
		if m.ID == id {
			return &m, true
		}
	}
	return nil, false
}

// ActiveMembers returns only active crew members
func (c *Crew) ActiveMembers() []CrewMember {
	active := make([]CrewMember, 0)
	for _, m := range c.Members {
		if m.Active {
			active = append(active, m)
		}
	}
	return active
}
