"""Test-wide fixtures.

Force run-history persistence onto a throwaway SQLite file so the suite never
touches a real DATABASE_URL (e.g. the developer's Supabase project). An empty
env var takes priority over the value in .env inside pydantic-settings.
"""
from __future__ import annotations

import os

os.environ["DATABASE_URL"] = ""
