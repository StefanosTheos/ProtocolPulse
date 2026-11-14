from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import TypeDecorator


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex}"


class UTCDateTime(TypeDecorator):
    impl = String(32)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Naive datetime is forbidden")
        return value.astimezone(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")

    def process_result_value(self, value, dialect):
        return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


class Base(DeclarativeBase):
    pass
