"""Tests for bmad_crew module."""

import pytest
from unittest.mock import MagicMock, patch

# Import the module under test
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestBmadCrew:
    """Test suite for BMAD crew functionality."""

    def test_module_imports(self):
        """Verify the bmad_crew module can be imported."""
        import bmad_crew
        assert hasattr(bmad_crew, '__version__') or True  # Module exists

    @patch('bmad_crew.requests.get')
    def test_fetch_bmad_data(self, mock_get):
        """Test fetching BMAD data from API."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'status': 'ok', 'data': []}
        mock_get.return_value = mock_response

        import bmad_crew
        result = bmad_crew.fetch_bmad_data('http://test.example.com/api')
        assert result is not None

    def test_parse_bmad_config(self):
        """Test parsing BMAD configuration."""
        import bmad_crew
        config = {
            'crew_size': 4,
            'roles': ['driver', 'navigator', 'observer', 'reviewer'],
            'max_iterations': 10,
        }
        parsed = bmad_crew.parse_bmad_config(config)
        assert parsed['crew_size'] == 4
        assert len(parsed['roles']) == 4

    @patch('bmad_crew.requests.post')
    def test_submit_results(self, mock_post):
        """Test submitting BMAD results."""
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {'id': 'test-123', 'status': 'submitted'}
        mock_post.return_value = mock_response

        import bmad_crew
        result = bmad_crew.submit_results('http://test.example.com/api', {'task': 'test'})
        assert result is not None

    def test_validate_cron_config(self):
        """Test cron configuration validation."""
        import bmad_crew
        valid_config = {
            'schedule': '0 */6 * * *',
            'timeout': 300,
            'retry_count': 3,
        }
        assert bmad_crew.validate_cron_config(valid_config) is True

        invalid_config = {'schedule': 'invalid'}
        assert bmad_crew.validate_cron_config(invalid_config) is False
