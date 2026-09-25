package http

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/isItObservable/sympozium-todo-demo/internal/store"
)

// NotesHandler handles HTTP requests for the notes resource.
type NotesHandler struct {
	noteStore *store.NotesStore
	colStore  *store.ColumnsStore
}

func NewNotesHandler(ns *store.NotesStore, cs *store.ColumnsStore) *NotesHandler {
	return &NotesHandler{noteStore: ns, colStore: cs}
}

type createNoteRequest struct {
	ColumnID int64  `json:"columnId"`
	Title    string `json:"title"`
	Body     string `json:"body,omitempty"`
	Color    string `json:"color,omitempty"`
}

type updateNoteRequest struct {
	Title string `json:"title"`
	Body  string `json:"body,omitempty"`
}

type moveNoteRequest struct {
	ColumnID int64 `json:"columnId"`
}

// CreateNote handles POST /api/notes/
func (h *NotesHandler) CreateNote(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Only POST is allowed"})
		return
	}

	var req createNoteRequest
	body, _ := io.ReadAll(r.Body)
	defer r.Body.Close()
	if err := json.Unmarshal(body, &req); err != nil {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Malformed request body"})
		return
	}

	if req.Title == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
		return
	}
	if req.ColumnID == 0 {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "columnId is required"})
		return
	}

	// Validate color
	if req.Color != "" {
		validColors := map[string]bool{"yellow": true, "pink": true, "blue": true, "green": true, "orange": true}
		if !validColors[req.Color] {
			req.Color = ""
		}
	} else {
		req.Color = "yellow"
	}

	note, err := h.noteStore.Create(r.Context(), req.ColumnID, req.Title, req.Body, req.Color)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create note"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(note)
}

// ListNotes handles GET /api/notes/?column_id=:id
func (h *NotesHandler) ListNotes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Only GET is allowed"})
		return
	}

	var filterByColumn *int64
	colIDStr := r.URL.Query().Get("column_id")
	if colIDStr != "" {
		cid, err := strconv.ParseInt(colIDStr, 10, 64)
		if err == nil {
			filterByColumn = &cid
		}
	}

	notes, err := h.noteStore.List(r.Context(), filterByColumn)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to list notes"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notes)
}

// UpdateNote handles PUT /api/notes/:id
func (h *NotesHandler) UpdateNote(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Only PUT is allowed"})
		return
	}

	idStr := extractIDFromPath(r.URL.Path)
	if idStr == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing note id"})
		return
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid note id"})
		return
	}

	var req updateNoteRequest
	body, _ := io.ReadAll(r.Body)
	defer r.Body.Close()
	if err := json.Unmarshal(body, &req); err != nil {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Malformed request body"})
		return
	}

	ctx, cancel := contextWithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err = h.noteStore.Get(ctx, id)
	if err != nil {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "Note not found"})
		return
	}

	updatedNote, err := h.noteStore.Update(ctx, id, req.Title, req.Body)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to update note"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedNote)
}

// DeleteNote handles DELETE /api/notes/:id
func (h *NotesHandler) DeleteNote(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Only DELETE is allowed"})
		return
	}

	idStr := extractIDFromPath(r.URL.Path)
	if idStr == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing note id"})
		return
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid note id"})
		return
	}

	ctx, cancel := contextWithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err = h.noteStore.Get(ctx, id)
	if err != nil {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "Note not found"})
		return
	}

	err = h.noteStore.Delete(ctx, id)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to delete note"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// MoveNote handles PATCH /api/notes/:id/move
func (h *NotesHandler) MoveNote(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Only PATCH is allowed"})
		return
	}

	idStr := extractIDFromPath(r.URL.Path)
	if idStr == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing note id"})
		return
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid note id"})
		return
	}

	var req moveNoteRequest
	body, _ := io.ReadAll(r.Body)
	defer r.Body.Close()
	if err := json.Unmarshal(body, &req); err != nil {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Malformed request body"})
		return
	}

	if req.ColumnID == 0 {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "columnId is required"})
		return
	}

	ctx, cancel := contextWithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err = h.noteStore.Get(ctx, id)
	if err != nil {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "Note not found"})
		return
	}

	err = h.noteStore.Move(ctx, id, req.ColumnID)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to move note"})
		return
	}

	// Return full note after move
	note, err := h.noteStore.Get(ctx, id)
	if err != nil {
		h.writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Note disappeared after move"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(note)
}

func (h *NotesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method +" "+ r.URL.Path {
	case "GET /api/notes/":
		h.ListNotes(w, r)
	case "POST /api/notes/":
		h.CreateNote(w, r)
	default:
		// Check for /api/notes/:id or /api/notes/:id/move
		if idStr := extractIDFromPath(r.URL.Path); idStr != "" {
			if r.URL.Path == "/api/notes/"+idStr+"/move" || (len(r.URL.Path) - len(idStr)) == 4 && r.URL.Path[len("/api/notes/")+(len(idStr)+1):] == "/move" {
				h.MoveNote(w, r)
			} else if r.Method == http.MethodPut {
				h.UpdateNote(w, r)
			} else if r.Method == http.MethodDelete {
				h.DeleteNote(w, r)
			}
		} else {
			h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		}
	}
}

// Simple routing helper since we keep it simple
func (h *NotesHandler) ServeHTTPRoute(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	method := r.Method

	switch {
	case method == "GET" && path == "/api/notes/":
		h.ListNotes(w, r)
		return
	case method == "POST" && path == "/api/notes/":
		h.CreateNote(w, r)
		return
	case method == "PUT" && len(path) > 12 && path[:12] == "/api/notes/":
		idStr := extractIDFromPath(path)
		if idStr != "" {
			h.UpdateNote(w, r)
			return
		}
	case method == "DELETE" && len(path) > 12 && path[:12] == "/api/notes/":
		idStr := extractIDFromPath(path)
		if idStr != "" {
			h.DeleteNote(w, r)
			return
		}
	case method == "PATCH" && len(path) > 17 && path[:12] == "/api/notes/":
		idStr := extractIDFromPath(path)
		if idStr != "" {
			h.MoveNote(w, r)
			return
		}
	default:
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
}

func (h *NotesHandler) writeJSON(w http.ResponseWriter, status int, data map[string]string) {
	w.Header().Set("Content-Type", "application/json")
	statusText := http.StatusText(status)
	if statusText == "" {
		statusText = "error"
	}
	response := map[string]string{"status": statusText, "error": data["error"]}
	json.NewEncoder(w).Encode(response)
	w.WriteHeader(status)
}
