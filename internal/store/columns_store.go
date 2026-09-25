package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type ColumnsStore struct {
	db *sql.DB
}

func NewColumnsStore(db *sql.DB) *ColumnsStore {
	return &ColumnsStore{db: db}
}

type Column struct {
	ID         int64  `json:"id"`
	Title      string `json:"title"`
	BoardScope string `json:"board_scope"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}

func (s *ColumnsStore) Create(ctx context.Context, title string) (*Column, error) {
	if title == "" {
		return nil, fmt.Errorf("title cannot be empty")
	}

	now := time.Now().Format(time.RFC3339)
	result, err := s.db.ExecContext(ctx,
		"INSERT INTO columns (title, board_scope, created_at, updated_at) VALUES (?, 'default', ?, ?)",
		title, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create column: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
	}

	col := &Column{
		ID:         id,
		Title:      title,
		BoardScope: "default",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	return col, nil
}

func (s *ColumnsStore) List(ctx context.Context) ([]Column, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT id, title, board_scope, created_at, updated_at FROM columns ORDER BY created_at DESC")
	if err != nil {
		return nil, fmt.Errorf("failed to list columns: %w", err)
	}
	defer rows.Close()

	var cols []Column
	for rows.Next() {
		var col Column
		err := rows.Scan(&col.ID, &col.Title, &col.BoardScope, &col.CreatedAt, &col.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan column: %w", err)
		}
		cols = append(cols, col)
	}

	return cols, rows.Err()
}

func (s *ColumnsStore) Get(ctx context.Context, id int64) (*Column, error) {
	var col Column
	err := s.db.QueryRowContext(ctx,
		"SELECT id, title, board_scope, created_at, updated_at FROM columns WHERE id = ?",
		id).Scan(&col.ID, &col.Title, &col.BoardScope, &col.CreatedAt, &col.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("column not found: %d", id)
		}
		return nil, fmt.Errorf("failed to get column: %w", err)
	}

	return &col, nil
}

func (s *ColumnsStore) Update(ctx context.Context, id int64, title string) (*Column, error) {
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx,
		"UPDATE columns SET title = ?, updated_at = ? WHERE id = ?",
		title, now, id)
	if err != nil {
		return nil, fmt.Errorf("failed to update column: %w", err)
	}

	// Get the updated row
	col, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	col.Title = title
	col.UpdatedAt = now

	return col, nil
}

func (s *ColumnsStore) Delete(ctx context.Context, id int64) error {
	// Check if column exists first
	_, err := s.Get(ctx, id)
	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(ctx, "DELETE FROM columns WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete column: %w", err)
	}

	return nil
}