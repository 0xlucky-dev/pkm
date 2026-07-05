"""Unit tests for download_sprite() in scripts/scraper.py."""

import os
import sys
import tempfile
from unittest.mock import MagicMock, patch

import pytest

# Add scripts dir to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from scraper import download_sprite


class TestDownloadSpriteEmptyUrl:
    """Test that empty/None URLs return empty string immediately."""

    def test_none_url_returns_empty(self):
        session = MagicMock()
        assert download_sprite(session, None, "/tmp/sprites") == ""
        session.get.assert_not_called()

    def test_empty_string_url_returns_empty(self):
        session = MagicMock()
        assert download_sprite(session, "", "/tmp/sprites") == ""
        session.get.assert_not_called()


class TestDownloadSpriteLocalCache:
    """Test that existing files are skipped (no re-download)."""

    def test_skips_existing_file(self, tmp_path):
        # Create a file that already exists
        sprite_dir = tmp_path / "sprites"
        sprite_dir.mkdir()
        existing = sprite_dir / "poke_capture_0001_000_mf_n_00000000_f_n.png"
        existing.write_bytes(b"fake png data")

        session = MagicMock()
        url = "https://raw.githubusercontent.com/bdawg1989/HomeImages/master/128x128/poke_capture_0001_000_mf_n_00000000_f_n.png"

        result = download_sprite(session, url, str(sprite_dir))

        assert result == "sprites/poke_capture_0001_000_mf_n_00000000_f_n.png"
        session.get.assert_not_called()


class TestDownloadSpriteSuccess:
    """Test successful sprite download."""

    def test_downloads_and_returns_relative_path(self, tmp_path):
        sprite_dir = tmp_path / "sprites"

        # Mock session and response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"\x89PNG\r\n\x1a\n fake png content"

        session = MagicMock()

        url = "https://raw.githubusercontent.com/bdawg1989/HomeImages/master/128x128/poke_capture_0001_000_mf_n_00000000_f_n.png"

        with patch("scraper.call_with_backoff", return_value=mock_response) as mock_backoff:
            result = download_sprite(session, url, str(sprite_dir))

        assert result == "sprites/poke_capture_0001_000_mf_n_00000000_f_n.png"
        mock_backoff.assert_called_once_with(session.get, url, timeout=30)

        # Verify file was written
        saved_file = sprite_dir / "poke_capture_0001_000_mf_n_00000000_f_n.png"
        assert saved_file.exists()
        assert saved_file.read_bytes() == b"\x89PNG\r\n\x1a\n fake png content"

    def test_creates_output_directory(self, tmp_path):
        sprite_dir = tmp_path / "new_dir" / "sprites"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"png data"

        session = MagicMock()
        url = "https://example.com/sprite.png"

        with patch("scraper.call_with_backoff", return_value=mock_response):
            result = download_sprite(session, url, str(sprite_dir))

        assert result == "sprites/sprite.png"
        assert sprite_dir.exists()


class TestDownloadSpriteFailure:
    """Test failure scenarios — should log warning and return empty string."""

    def test_non_200_returns_empty(self, tmp_path):
        sprite_dir = tmp_path / "sprites"

        mock_response = MagicMock()
        mock_response.status_code = 404

        session = MagicMock()
        url = "https://example.com/missing.png"

        with patch("scraper.call_with_backoff", return_value=mock_response):
            result = download_sprite(session, url, str(sprite_dir))

        assert result == ""

    def test_network_error_returns_empty(self, tmp_path):
        import requests

        sprite_dir = tmp_path / "sprites"
        session = MagicMock()
        url = "https://example.com/timeout.png"

        with patch("scraper.call_with_backoff", side_effect=requests.ConnectionError("timeout")):
            result = download_sprite(session, url, str(sprite_dir))

        assert result == ""

    def test_timeout_error_returns_empty(self, tmp_path):
        import requests

        sprite_dir = tmp_path / "sprites"
        session = MagicMock()
        url = "https://example.com/slow.png"

        with patch("scraper.call_with_backoff", side_effect=requests.Timeout("timed out")):
            result = download_sprite(session, url, str(sprite_dir))

        assert result == ""


class TestDownloadSpriteFilenameExtraction:
    """Test filename extraction from various URL patterns."""

    def test_extracts_filename_from_github_url(self, tmp_path):
        sprite_dir = tmp_path / "sprites"
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"png"

        session = MagicMock()
        url = "https://raw.githubusercontent.com/bdawg1989/HomeImages/master/128x128/poke_capture_0025_000_fd_n_00000000_f_n.png"

        with patch("scraper.call_with_backoff", return_value=mock_response):
            result = download_sprite(session, url, str(sprite_dir))

        assert result == "sprites/poke_capture_0025_000_fd_n_00000000_f_n.png"
