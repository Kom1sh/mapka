# backend/auth.py
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Request, Form, Response, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, PlainTextResponse
from jose import jwt, JWTError
from passlib.hash import pbkdf2_sha256
from sqlalchemy.future import select

from db import AsyncSessionLocal  # <- твой файл db.py (create_async_engine, AsyncSessionLocal)
from models import User

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", os.getenv("FLASK_SECRET_KEY", "dev_secret_change_me"))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS", "7"))
COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "mapka_token")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() in ("1","true","yes")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": now})
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return token

async def get_current_user(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = payload.get("user_id")
        if not uid:
            return None
    except JWTError:
        return None

    async with AsyncSessionLocal() as session:
        q = await session.execute(select(User).where(User.id == uid))
        user = q.scalar_one_or_none()
        return user

async def admin_required(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if getattr(user, "role", None) not in ("moder", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    return user

# Simple HTML login page (you can replace with template)
LOGIN_HTML = """
<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Login</title></head>
<body>
  <h3>Вход в админку</h3>
  <form method="post" action="/admin/login">
    <label>Логин: <input name="username" /></label><br/>
    <label>Пароль: <input name="password" type="password" /></label><br/>
    <button type="submit">Войти</button>
  </form>
</body></html>
"""

@router.get("/admin")
async def admin_check(user=Depends(get_current_user)):
    """
    Простая проверка: вернёт 200 OK если пользователь аутентифицирован,
    иначе 401 Unauthorized.
    Это endpoint, который вызывается ensureAuth() с фронта для проверки сессии.
    """
    if not user:
        # возвращаем 401 — фронт должен редиректить на /admin/login
        return PlainTextResponse("Unauthorized", status_code=401)
    # можно возвращать 200 и небольшую инфу о пользователе
    return {"username": user.username, "role": user.role}

@router.get("/admin/login", response_class=HTMLResponse)
async def login_get():
    return HTMLResponse(LOGIN_HTML)

@router.post("/admin/login")
async def login_post(response: Response, username: str = Form(...), password: str = Form(...)):
    async with AsyncSessionLocal() as session:
        q = await session.execute(select(User).where(User.username == username))
        user = q.scalar_one_or_none()

    if not user:
        return HTMLResponse(LOGIN_HTML)
    if not pbkdf2_sha256.verify(password, user.password_hash):
        return HTMLResponse(LOGIN_HTML)

    token = create_access_token({"user_id": str(user.id)})
    resp = RedirectResponse(url="/admin", status_code=302)
    resp.set_cookie(COOKIE_NAME, token, httponly=True, secure=COOKIE_SECURE, samesite="lax",
                    max_age=ACCESS_TOKEN_EXPIRE_DAYS*24*3600)
    return resp

@router.get("/admin/logout")
async def logout():
    resp = RedirectResponse(url="/admin/login")
    resp.delete_cookie(COOKIE_NAME)
    return resp
