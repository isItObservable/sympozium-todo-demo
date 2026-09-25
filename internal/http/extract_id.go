package http

import (
	"strings"
)

// extractIDFromPath extracts the ID from URLs like /api/columns/123 or /api/notes/456.
func extractIDFromPath(path string) string {
	dirPath := strings.TrimPrefix(path, "/")
	segments := strings.Split(dirPath, "/")
	// We expect at least 2 segments after removing leading slash: api/columns/:id
	if len(segments) >= 3 {
		return segments[2]
	}
	return ""
}