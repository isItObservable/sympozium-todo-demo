package http

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

// extractIDFromPath extracts the ID from URLs like /api/columns/123 or /api/notes/456.
func extractIDFromPath(path string) string {
	// Remove leading slash and split by /
	segments := strings.Split(strings.TrimPrefix(path, "/"), "/")
	if len(segments) >= 3 {
		return segments[2]
	}
	return ""
}

// routeEntry is a simple handler that routes to different methods.
type Handler struct{}

func (h *Handler) columnsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path + r.Method {
	case "/api/columns/":
		w.Write([]byte("{"+"status":"ok","message":"columns route working"}}"))
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (h *Handler) notesHandler(w http.ResponseWriter, r *http.Request) {
	h.writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "message": "notes route working"})
}

func (h *Handler) initRouter() *http.ServeMux {
	router := http.NewServeMux()

	// healthcheck
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// API routes
	router.HandleFunc("/api/columns/", h.columnsHandler)
	router.HandleFunc("/api/notes/", h.notesHandler)
}
