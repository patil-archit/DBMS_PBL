import os
from contextlib import contextmanager
from contextvars import ContextVar

import psycopg2
import psycopg2.extensions
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/booklog")

# Return NUMERIC columns (ratings, averages) as float instead of Decimal
DEC2FLOAT = psycopg2.extensions.new_type(
    psycopg2.extensions.DECIMAL.values,
    "DEC2FLOAT",
    lambda value, cur: float(value) if value is not None else None,
)
psycopg2.extensions.register_type(DEC2FLOAT)

# Who is making the current API request. Set by app.deps for every request;
# None outside a request (background worker, scripts).
# Value: (user_id, role) -- anonymous visitors are (0, "anon").
current_viewer: ContextVar = ContextVar("current_viewer", default=None)


class Database:
    def __init__(self):
        self._pool = None

    def connect(self):
        if not self._pool:
            self._pool = ThreadedConnectionPool(1, 15, DATABASE_URL)

    def close(self):
        if self._pool:
            self._pool.closeall()
            self._pool = None

    @contextmanager
    def cursor(self, system: bool = False):
        """
        Yields a dict cursor inside a transaction; commits on success, rolls back on error.

        Inside an API request the viewer is written to app.user_id / app.role for this
        transaction only, so PostgreSQL row-level security (private diaries) and the
        audit log know who is acting. system=True skips that (background jobs).
        """
        if not self._pool:
            self.connect()
        conn = self._pool.getconn()
        try:
            with conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    viewer = None if system else current_viewer.get()
                    if viewer is not None:
                        cur.execute(
                            "SELECT set_config('app.user_id', %s, true), set_config('app.role', %s, true)",
                            (str(viewer[0]), viewer[1]),
                        )
                    yield cur
        finally:
            self._pool.putconn(conn)


# Global DB instance
db = Database()
