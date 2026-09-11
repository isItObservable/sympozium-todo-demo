package http

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/isItObservable/sympozium-todo-demo/internal/store"
)

// ColumnsHandler handles HTTP requests for the columns resource.
type ColumnsHandler struct {
	store *store.ColumnStore
}

// NewColumnsHandler creates a new ColumnsHandler.
func NewColumnsHandler(db *store.ColumnStore) *ColumnsHandler {
	return &ColumnsHandler{store: db}
}

// CreateColumnRequest is the expected JSON body for creating a column.
type CreateColumnRequest struct {
	Title string `json:"title"`
}

// CreateColumn handles POST /api/columns/ — creates a new column.
func (h *ColumnsHandler) CreateColumn(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeProblem(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is allowed")
		return
	}

	var req CreateColumnRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeProblem(w, http.StatusBadRequest, "invalid_request", "Malformed request body")
		return
	}

	if req.Title == "" {
		writeProblem(w, http.StatusBadRequest, "validation_error", "title is required and must be between 1 and 128 characters")
		return
	}
	if len(req.Title) > 128 {
		writeProblem(w, http.StatusBadRequest, "validation_error", "title must be at most 128 characters")
		return
	}

	col, err := h.store.Create(r.Context(), req.Title)
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "internal_error", "Failed to create column")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(col)
}

// ListColumns handles GET /api/columns/ — returns all columns newest-first.
func (h *ColumnsHandler) ListColumns(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeProblem(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is allowed")
		return
	}

	cols, err := h.store.List(r.Context())
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "internal_error", "Failed to list columns")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(cols)
}

// ProblemDetails is an RFC 7807 compliant error response.
type ProblemDetails struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Status int    `json:"status"`
	Detail string `json:"detail,omitempty"`
}

// writeProblem writes an RFC 7807 Problem Details response.
func writeProblem(w http.ResponseWriter, status int, typ, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ProblemDetails{
		Type:   typ,
		Title:  http.StatusText(status),
		Status: status,
		Detail: detail,
	})
}

// Ensure ColumnStore is used to avoid unused import.
var _ = store.ColumnStore{}

// Ensure time is used to avoid unused import.
var _ = time.Now
