package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Column represents a single column on the todo board.
type Column struct {
	ID        uuid.UUID `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ColumnStore handles persistence of columns.
type ColumnStore struct {
	db *sql.DB
}

// NewColumnStore creates a new ColumnStore backed by the given database.
func NewColumnStore(db *sql.DB) *ColumnStore {
	return &ColumnStore{db: db}
}

// Create inserts a new column and returns it with generated ID and timestamps.
func (s *ColumnStore) Create(ctx context.Context, title string) (*Column, error) {
	id := uuid.New()
	now := time.Now().UTC()

	query := `INSERT INTO columns (id, title, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING id, title, created_at, updated_at`
	var col Column
	err := s.db.QueryRowContext(ctx, query, id, title, now, now).Scan(&col.ID, &col.Title, &col.CreatedAt, &col.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("store: create column: %w", err)
	}
	return &col, nil
}

// List returns all columns ordered newest-first (created_at DESC).
func (s *ColumnStore) List(ctx context.Context) ([]Column, error) {
	query := `SELECT id, title, created_at, updated_at FROM columns ORDER BY created_at DESC`
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("store: list columns: %w", err)
	}
	defer rows.Close()

	var cols []Column
	for rows.Next() {
		var col Column
		if err := rows.Scan(&col.ID, &col.Title, &col.CreatedAt, &col.UpdatedAt); err != nil {
			return nil, fmt.Errorf("store: scan column: %w", err)
		}
		cols = append(cols, col)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("store: list columns iteration: %w", err)
	}
	return cols, nil
}
