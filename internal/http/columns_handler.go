package http

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/isItObservable/sympozium-todo-demo/internal/store"
)

// ColumnsHandler handles HTTP requests for the columns resource.
type ColumnsHandler struct {
	store *store.ColumnsStore
}

func NewColumnsHandler(db *store.ColumnsStore) *ColumnsHandler {
	return &ColumnsHandler{store: db}
}

type createColumnRequest struct {
	Title string `json:"title"`
}

// CreateColumn handles POST /api/columns/ — creates a new column.
func (h *ColumnsHandler) CreateColumn(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Only POST is allowed"})
		return
	}

	var req createColumnRequest
	body, _ := io.ReadAll(r.Body)
	defer r.Body.Close()
	if err := json.Unmarshal(body, &req); err != nil {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Malformed request body"})
		return
	}

	if req.Title == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required and must be between 1 and 128 characters"})
		return
	}
	if len(req.Title) > 128 {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title must be at most 128 characters"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	col, err := h.store.Create(ctx, req.Title)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create column"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(col)
}

// ListColumns handles GET /api/columns/ — returns all columns newest-first.
func (h *ColumnsHandler) ListColumns(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Only GET is allowed"})
		return
	}

	cols, err := h.store.List(r.Context())
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to list columns"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cols)
}

// UpdateColumn handles PUT /api/columns/:id — updates column title.
func (h *ColumnsHandler) UpdateColumn(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Only PUT is allowed"})
		return
	}

	idStr := extractIDFromPath(r.URL.Path)
	if idStr == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing column id"})
		return
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid column id"})
		return
	}

	var req createColumnRequest
	body, _ := io.ReadAll(r.Body)
	defer r.Body.Close()
	if err := json.Unmarshal(body, &req); err != nil {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Malformed request body"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err = h.store.Get(ctx, id)
	if err != nil {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "Column not found"})
		return
	}

	updatedCol, err := h.store.Update(ctx, id, req.Title)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to update column"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedCol)
}

// DeleteColumn handles DELETE /api/columns/:id — deletes column.
func (h *ColumnsHandler) DeleteColumn(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Only DELETE is allowed"})
		return
	}

	idStr := extractIDFromPath(r.URL.Path)
	if idStr == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing column id"})
		return
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid column id"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err = h.store.Get(ctx, id)
	if err != nil {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "Column not found"})
		return
	}

	err = h.store.Delete(ctx, id)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to delete column"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ColumnsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/api/columns/":
		h.ListColumns(w, r)
	case r.Method == http.MethodPost && r.URL.Path == "/api/columns/":
		h.CreateColumn(w, r)
	default:
		// Check for /api/columns/:id
		if p := extractIDFromPath(r.URL.Path); p != "" {
			switch r.Method {
			case http.MethodPut:
				h.UpdateColumn(w, r)
			case http.MethodDelete:
				h.DeleteColumn(w, r)
			default:
				h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			}
		} else {
			h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found - try /api/columns/ or /api/columns/:id"})
		}
	}
}

func (h *ColumnsHandler) writeJSON(w http.ResponseWriter, status int, data map[string]string) {
	w.Header().Set("Content-Type", "application/json")
	statusText := http.StatusText(status)
	if statusText == "" {
		statusText = "error"
	}
	response := map[string]string{"status": statusText, "error": data["error"]}
	json.NewEncoder(w).Encode(response)
	w.WriteHeader(status)
}
