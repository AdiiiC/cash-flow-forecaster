"""Auth endpoints: register, login, current user."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app import store
from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.schemas import TokenResponse, UserCreate, UserLogin, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_public(user: dict) -> UserPublic:
    created = user["created_at"]
    return UserPublic(
        id=user["id"],
        email=user["email"],
        created_at=created if isinstance(created, datetime) else datetime.fromisoformat(created),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: UserCreate) -> TokenResponse:
    if store.get_user_by_email(body.email) is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    try:
        user = store.create_user(body.email, hash_password(body.password))
    except IntegrityError:
        # Race: another request created the same email between the check and insert.
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    token = create_access_token(user["id"])
    return TokenResponse(access_token=token, user=_to_public(user))


@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin) -> TokenResponse:
    user = store.get_user_by_email(body.email)
    if user is None or not verify_password(body.password, user["password_hash"]):
        # Same message for both cases so we don't reveal which emails exist.
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    token = create_access_token(user["id"])
    return TokenResponse(access_token=token, user=_to_public(user))


@router.get("/me", response_model=UserPublic)
def me(user: dict = Depends(get_current_user)) -> UserPublic:
    return _to_public(user)
