from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from backend.app.core.config import get_settings


def make_engine(url: str):
    if not url.startswith("sqlite:///"):
        raise ValueError("This demo requires SQLite")
    path = url.removeprefix("sqlite:///")
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 5})

    @event.listens_for(engine, "connect")
    def pragmas(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA busy_timeout=5000")

    return engine


def session_factory(engine=None):
    return sessionmaker(bind=engine or make_engine(get_settings().database_url), expire_on_commit=False)
