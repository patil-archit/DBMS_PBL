"""
Request authentication.

Every request passes through `viewer_optional`, which verifies the Firebase
token (if any), finds or creates the matching `users` row, and stores the
viewer in a context variable so database transactions run as that user.
"""
import re
import uuid
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth

import app.auth  # noqa: F401  (initialises the Firebase Admin SDK)
from app.database import current_viewer, db

bearer = HTTPBearer(auto_error=False)


@dataclass
class Viewer:
    user_id: int
    uid: str
    username: str
    role: str

    @property
    def is_staff(self) -> bool:
        return self.role in ("moderator", "admin")


def _username_base(name: Optional[str], email: Optional[str]) -> str:
    base = name or (email.split("@")[0] if email else "") or "reader"
    base = re.sub(r"[^a-z0-9_]+", "_", base.lower()).strip("_")[:24]
    return base if len(base) >= 3 else f"reader_{base}".strip("_")


def ensure_user(uid: str, name: Optional[str] = None, email: Optional[str] = None) -> dict:
    """Returns the users row for a Firebase uid, creating it on first sign-in."""
    with db.cursor(system=True) as cur:
        cur.execute("SELECT user_id, username, role FROM users WHERE firebase_uid = %s", (uid,))
        row = cur.fetchone()
        if row:
            return row
        base = _username_base(name, email)
        cur.execute("SELECT username FROM users WHERE username LIKE %s", (base + "%",))
        taken = {r["username"] for r in cur.fetchall()}
        username, n = base, 1
        while username in taken:
            n += 1
            username = f"{base}{n}"
        cur.execute(
            """
            INSERT INTO users (firebase_uid, friend_code, username, email)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (firebase_uid) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid
            RETURNING user_id, username, role
            """,
            (uid, uuid.uuid4().hex[:8], username,
             email if email and not _email_taken(cur, email) else None),
        )
        return cur.fetchone()


def _email_taken(cur, email):
    cur.execute("SELECT 1 FROM users WHERE email = %s", (email,))
    return cur.fetchone() is not None


async def viewer_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> Optional[Viewer]:
    viewer = None
    if credentials:
        try:
            token = await run_in_threadpool(firebase_auth.verify_id_token, credentials.credentials)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid or expired sign-in token")
        row = await run_in_threadpool(ensure_user, token["uid"], token.get("name"), token.get("email"))
        viewer = Viewer(row["user_id"], token["uid"], row["username"], row["role"])
    current_viewer.set((viewer.user_id, viewer.role) if viewer else (0, "anon"))
    return viewer


async def viewer_required(viewer: Optional[Viewer] = Depends(viewer_optional)) -> Viewer:
    if viewer is None:
        raise HTTPException(status_code=401, detail="Sign in required")
    return viewer


async def moderator_required(viewer: Viewer = Depends(viewer_required)) -> Viewer:
    if not viewer.is_staff:
        raise HTTPException(status_code=403, detail="Moderators and admins only")
    return viewer


async def admin_required(viewer: Viewer = Depends(viewer_required)) -> Viewer:
    if viewer.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return viewer
