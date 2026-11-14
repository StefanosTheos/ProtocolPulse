from alembic import context

from backend.app import models  # noqa: F401
from backend.app.core.config import get_settings
from backend.app.db.base import Base
from backend.app.db.session import make_engine

if context.is_offline_mode():
    context.configure(url=get_settings().database_url, target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    with make_engine(get_settings().database_url).connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()
