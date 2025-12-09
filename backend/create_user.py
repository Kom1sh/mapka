# backend/create_user.py
import argparse
import asyncio
import getpass
import os

from passlib.hash import pbkdf2_sha256
from sqlalchemy.future import select
from sqlalchemy import text

# ВАЖНО: используем твой AsyncSessionLocal из db.py
from db import AsyncSessionLocal

# Импорт модели — путь такой же, как в твоём репо
from models import User

async def create_user(username: str, password: str, role: str = "moder"):
    # перед хешированием:
    pw_hash = pbkdf2_sha256.hash(password)

    async with AsyncSessionLocal() as session:
        # проверка существования
        q = await session.execute(select(User).where(User.username == username))
        existing = q.scalar_one_or_none()
        if existing:
            print("User already exists:", username)
            return
        u = User(username=username, password_hash=pw_hash, role=role)
        session.add(u)
        await session.commit()
        print("Created user:", username)

async def list_users():
    async with AsyncSessionLocal() as session:
        q = await session.execute(select(User))
        rows = q.scalars().all()
        for u in rows:
            print(f"{u.id}  {u.username}  {u.role}  {u.created_at}")

async def delete_user(username: str):
    async with AsyncSessionLocal() as session:
        q = await session.execute(select(User).where(User.username == username))
        u = q.scalar_one_or_none()
        if not u:
            print("Not found:", username)
            return
        await session.delete(u)
        await session.commit()
        print("Deleted:", username)

def main():
    p = argparse.ArgumentParser()
    sp = p.add_subparsers(dest="cmd")
    pc = sp.add_parser("create")
    pc.add_argument("--username", "-u")
    pc.add_argument("--password", "-p", help="If omitted, will prompt")
    pc.add_argument("--role", "-r", default="moder")

    pl = sp.add_parser("list")
    pd = sp.add_parser("delete")
    pd.add_argument("--username", "-u", required=True)

    args = p.parse_args()
    if args.cmd == "create":
        username = args.username or input("username: ").strip()
        password = args.password
        if not password:
            p1 = getpass.getpass("password: ")
            p2 = getpass.getpass("confirm password: ")
            if p1 != p2:
                print("Passwords mismatch")
                return
            password = p1
        asyncio.run(create_user(username, password, args.role))
    elif args.cmd == "list":
        asyncio.run(list_users())
    elif args.cmd == "delete":
        asyncio.run(delete_user(args.username))
    else:
        p.print_help()

if __name__ == "__main__":
    main()
