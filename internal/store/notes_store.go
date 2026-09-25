package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type NotesStore struct {
	db *sql.DB
}

func NewNotesStore(db *sql.DB) *NotesStore {
	return &NotesStore{db: db}
}

type Note struct {
	ID        int64  `json:"id"`
	ColumnID  int64  `json:"columnId"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	Color     string `json:"color"` // yellow, pink, blue, green, orange
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

func (s *NotesStore) Create(ctx context.Context, colID int64, title string, body string, color string) (*Note, error) {
	if title == "" {
		return nil, fmt.Errorf("title cannot be empty")
	}
	if colID == 0 {
		return nil, fmt.Errorf("columnId is required")
	}

	// Default to yellow if no color specified
	validColors := map[string]bool{
		"":       true,
		"yellow": true,
		"pink":   true,
		"blue":   true,
		"green":  true,
		"orange": true,
	}
	if !validColors[color] {
		color = "yellow"
	}

	now := time.Now().Format(time.RFC3339)
	result, err := s.db.ExecContext(ctx,
		"INSERT INTO notes (column_id, title, body, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		colID, title, body, color, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create note: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
	}

	return &Note{
		ID:        id,
		ColumnID:  colID,
		Title:     title,
		Body:      body,
		Color:     color,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

// List returns all notes, optionally filtered by column_id query param.
func (s *NotesStore) List(ctx context.Context, filterByColumn *int64) ([]Note, error) {
	var rows *sql.Rows
	var err error

	if filterByColumn != nil {
		rows, err = s.db.QueryContext(ctx,
			"SELECT id, column_id, title, body, color, created_at, updated_at FROM notes WHERE column_id = ? ORDER BY created_at DESC",
			*filterByColumn)
	} else {
		rows, err = s.db.QueryContext(ctx,
			"SELECT id, column_id, title, body, color, created_at, updated_at FROM notes ORDER BY column_id ASC, created_at DESC")
	}

	if err != nil {
		return nil, fmt.Errorf("failed to list notes: %w", err)
	}
	defer rows.Close()

	var notes []Note
	for rows.Next() {
		var n Note
		err := rows.Scan(&n.ID, &n.ColumnID, &n.Title, &n.Body, &n.Color, &n.CreatedAt, &n.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}
		notes = append(notes, n)
	}

	return notes, rows.Err()
}

func (s *NotesStore) Get(ctx context.Context, id int64) (*Note, error) {
	var n Note
	err := s.db.QueryRowContext(ctx,
		"SELECT id, column_id, title, body, color, created_at, updated_at FROM notes WHERE id = ?",
		id).Scan(&n.ID, &n.ColumnID, &n.Title, &n.Body, &n.Color, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("note not found: %d", id)
		}
		return nil, fmt.Errorf("failed to get note: %w", err)
	}

	return &n, nil
}

func (s *NotesStore) Update(ctx context.Context, id int64, title string, body string) (*Note, error) {
	now := time.Now().Format(time.RFC3339)

	// Get the note first to see its current color
	note, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	_, err = s.db.ExecContext(ctx,
		"UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?",
		title, body, now, id)
	if err != nil {
		return nil, fmt.Errorf("failed to update note: %w", err)
	}

	note.Title = title
	note.Body = body
	note.UpdatedAt = now

	return note, nil
}

func (s *NotesStore) Delete(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM notes WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete note: %w", err)
	}

	return nil
}

func (s *NotesStore) Move(ctx context.Context, id int64, newColID int64) error {
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx,
		"UPDATE notes SET column_id = ?, updated_at = ? WHERE id = ?",
		newColID, now, id)
	if err != nil {
		return fmt.Errorf("failed to move note: %w", err)
	}

	return nil
}