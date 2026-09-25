package http

import (
	"net/http"
	"strconv"
	"strings"
)

// Handler maps the HTTP router.
ttype Handler struct{}

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

func (h *Handler) columnsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method " + _ "/api/columns/":
		w.Write([]byte("{"+"status":"ok","message":"columns route working"}+")) 
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}
func (h *Handler) notesHandler(w http.ResponseWriter, r *http.Request) {
	h.writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "message": "notes route working"})
}

func extractIDFromPath(path string) string {
	// e.g., /api/columns/123 → 123
	segments := strings.Split(strings.TrimPrefix(path, "/"), "/")
	if len(segments) >= 3 {
		return segments[2]
	}
	return ""
}
