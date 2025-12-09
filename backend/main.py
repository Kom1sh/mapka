# main.py
import os
import uuid
import datetime
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from typing import List
from models import Club, Address, Schedule
from db import AsyncSessionLocal
import aiofiles
from sqlalchemy.exc import NoResultFound, IntegrityError
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import select, delete, or_
from datetime import time as dt_time
import uuid

from crud import get_clubs, get_club_by_id, create_review_for_club
from schemas import ClubSchema, ReviewSchema, ReviewCreateSchema
from auth import router as auth_router, admin_required

from fastapi.responses import JSONResponse
from fastapi.requests import Request as FastAPIRequest
from fastapi.exception_handlers import RequestValidationError
from fastapi.exceptions import HTTPException as FastAPIHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI(title="Mapka API")
app.include_router(auth_router)

# Middleware для добавления CORS-заголовков даже к ошибкам
class CORSMiddlewareAll(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        try:
            response = await call_next(request)
        except Exception as exc:
            # Обработка ошибок FastAPI
            if isinstance(exc, FastAPIHTTPException):
                response = JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
            elif isinstance(exc, RequestValidationError):
                response = JSONResponse(status_code=422, content={"detail": exc.errors()})
            else:
                response = JSONResponse(status_code=500, content={"detail": str(exc)})
        # Всегда добавляем заголовки CORS
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response

app.add_middleware(CORSMiddlewareAll)

# CORS - в dev можно "*" , в продакшн укажи конкретный домен(ы)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MEDIA_DIR = os.getenv("MEDIA_DIR", "media")
os.makedirs(MEDIA_DIR, exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

STATIC_CLUBS_DIR = os.getenv("STATIC_CLUBS_DIR", "static_clubs")
os.makedirs(STATIC_CLUBS_DIR, exist_ok=True)

def _serialize_club(c, base_origin: str, payload_extra: dict = None):
    """
    Надёжная сериализация ORM -> plain dict для фронта.
    Преобразует relationship schedules -> list(dict), social_links -> dict,
    image -> absolute url.
    """
    try:
        # image
        image_path = ""
        if getattr(c, "main_image_url", None):
            image_path = c.main_image_url
        else:
            imgs = getattr(c, "images", None)
            if imgs and len(imgs):
                first = imgs[0]
                image_path = getattr(first, "url", "") or ""
        image_url = ""
        if image_path:
            image_url = base_origin.rstrip("/") + image_path if image_path.startswith("/") else image_path

        # address -> location string
        addr = getattr(c, "address", None)
        location = ""
        if addr:
            street = getattr(addr, "street", None) or ""
            city = getattr(addr, "city", None) or ""
            parts = [p for p in (street.strip(), city.strip()) if p]
            location = ", ".join(parts)

        # tags
        raw_tags = getattr(c, "tags", None)
        tags = list(raw_tags) if raw_tags is not None else []

        # social links
        raw_social = getattr(c, "social_links", None) or {}
        social_links = dict(raw_social) if isinstance(raw_social, dict) else {}

        # schedules: если relationship объекты — привести к list(dict)
        schedules_out = []
        raw_schedules = getattr(c, "schedules", None)
        if raw_schedules:
            # raw_schedules может быть списком ORM Schedule объектов или уже list of dicts
            for s in raw_schedules:
                # если это ORM объект — у него атрибуты weekday/start_time/end_time/note
                try:
                    # поддержим оба варианта: ORM Schedule или dict
                    if hasattr(s, "weekday") or hasattr(s, "start_time") or hasattr(s, "note"):
                        day = ""
                        wd = getattr(s, "weekday", None)
                        if wd is not None:
                            wd_map = {0:"Понедельник",1:"Вторник",2:"Среда",3:"Четверг",4:"Пятница",5:"Суббота",6:"Воскресенье"}
                            day = wd_map.get(wd, str(wd))
                        # составим time строку
                        st = getattr(s, "start_time", None)
                        en = getattr(s, "end_time", None)
                        time_str = ""
                        if st and en:
                            try:
                                time_str = f"{st.strftime('%H:%M')}-{en.strftime('%H:%M')}"
                            except Exception:
                                time_str = str(st) + "-" + str(en)
                        elif st:
                            try:
                                time_str = st.strftime('%H:%M')
                            except Exception:
                                time_str = str(st)
                        elif en:
                            try:
                                time_str = en.strftime('%H:%M')
                            except Exception:
                                time_str = str(en)
                        note = getattr(s, "note", None) or ""
                        schedules_out.append({"day": day or "", "time": time_str or "", "note": note or ""})
                    elif isinstance(s, dict):
                        # если уже dict (связка фронт->API), нормализуем поля
                        schedules_out.append({
                            "day": s.get("day", "") or "",
                            "time": s.get("time", "") or "",
                            "note": s.get("note", "") or ""
                        })
                except Exception:
                    # на случай неожиданного формата — пропустить элемент
                    continue

        # price: оставить price_cents, но полезно дать price_rub тоже
        price_cents = getattr(c, "price_cents", None)
        price_rub = None
        if price_cents is not None:
            try:
                price_rub = round(float(price_cents) / 100.0, 2)
            except Exception:
                price_rub = None

        out = {
            "id": str(getattr(c, "id", "") or ""),
            "name": getattr(c, "name", "") or "",
            "slug": getattr(c, "slug", "") or "",
            "description": getattr(c, "description", "") or "",
            "image": image_url or "",
            "location": location,
            "isFavorite": False,
            "tags": tags,
            "price_cents": price_cents,
            "price_rub": price_rub,
            "phone": getattr(c, "phone", "") or "",
            "webSite": getattr(c, "webSite", "") or "",
            "socialLinks": social_links,
            "schedules": schedules_out,
        }
        if payload_extra:
            out.update(payload_extra)
        return out

    except Exception as e:
        print("[ERROR] _serialize_club failed:", e)
        return {
            "id": str(getattr(c, "id", "") or ""),
            "name": getattr(c, "name", "") or "",
            "slug": getattr(c, "slug", "") or "",
        }

def _render_club_html_simple(obj):
    """Очень простой шаблон — можно подменить на весь ваш club.html и подставлять поля."""
    title = obj.get("name", "Кружок")
    desc = obj.get("description", "")
    image = obj.get("image", "")
    location = obj.get("location", "")
    tags = obj.get("tags", [])
    tags_html = " ".join(f'<span class="tag-btn">{t}</span>' for t in tags)
    html = f"""<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head><body>
<main>
  <h1>{title}</h1>
  <p>{desc}</p>
  <img src="{image}" alt="" style="max-width:640px;width:100%;height:auto" />
  <p>Адрес: {location}</p>
  <div>Теги: {tags_html}</div>
</main>
</body></html>"""
    return html

def write_static_club_file(slug, payload):
    """Записывает/перезаписывает static_clubs/{slug}.html (best-effort)."""
    if not slug:
        return None
    safe = str(slug).replace("/", "_")
    fname = os.path.join(STATIC_CLUBS_DIR, f"{safe}.html")
    html = _render_club_html_simple(payload)
    try:
        with open(fname, "w", encoding="utf-8") as f:
            f.write(html)
        return fname
    except Exception as e:
        # не ломаем API при ошибке записи
        print("[WARN] write_static_club_file failed:", e)
        return None

def remove_static_club_file(slug):
    try:
        if not slug:
            return
        fname = os.path.join(STATIC_CLUBS_DIR, f"{slug}.html")
        if os.path.exists(fname):
            os.remove(fname)
    except Exception:
        pass

def _split_location(loc_str: str):
    """
    Разделяет location на street и city.
    Если в строке есть запятая — left = street, right = city (остаток).
    Иначе — street = loc_str, city = None
    """
    if not loc_str:
        return None, None
    parts = [p.strip() for p in loc_str.split(",", 1)]
    if len(parts) == 2 and parts[1]:
        return parts[0], parts[1]
    return loc_str.strip(), None

def _render_club_html_simple(obj):
    """Очень простой шаблон — можно подменить на весь ваш club.html и подставлять поля."""
    title = obj.get("name", "Кружок")
    desc = obj.get("description", "")
    image = obj.get("image", "")
    location = obj.get("location", "")
    tags = obj.get("tags", [])
    tags_html = " ".join(f'<span class="tag-btn">{t}</span>' for t in tags)
    html = f"""<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head><body>
<main>
  <h1>{title}</h1>
  <p>{desc}</p>
  <img src="{image}" alt="" style="max-width:640px;width:100%;height:auto" />
  <p>Адрес: {location}</p>
  <div>Теги: {tags_html}</div>
</main>
</body></html>"""
    return html

def write_static_club_file(slug, payload):
    """Записывает/перезаписывает static_clubs/{slug}.html"""
    fname = os.path.join(STATIC_CLUBS_DIR, f"{slug}.html")
    html = _render_club_html_simple(payload)
    with open(fname, "w", encoding="utf-8") as f:
        f.write(html)
    return fname

def remove_static_club_file(slug):
    try:
        fname = os.path.join(STATIC_CLUBS_DIR, f"{slug}.html")
        if os.path.exists(fname):
            os.remove(fname)
    except Exception:
        pass

@app.post("/api/clubs")
async def api_create_club(request: Request, payload: dict, user=Depends(admin_required)):
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    async with AsyncSessionLocal() as session:
        # Address
        addr_obj = None
        loc = (payload.get("location") or "").strip()
        if loc:
            street_val, city_val = _split_location(loc)
            if street_val:
                addr_obj = Address(street=street_val, city=city_val)
                session.add(addr_obj)
                await session.flush()

        # price
        price_cents = None
        if payload.get("price_rub") is not None:
            try:
                price_rub = float(payload.get("price_rub") or 0)
                price_cents = int(round(price_rub * 100))
            except Exception:
                price_cents = None
        elif payload.get("price_cents") is not None:
            try:
                price_cents = int(payload.get("price_cents"))
            except Exception:
                price_cents = None

        phone = payload.get("phone") or ""
        webSite = payload.get("webSite") or payload.get("website") or ""
        social_links = payload.get("socialLinks") or payload.get("social_links") or {}
        if not isinstance(social_links, dict):
            social_links = {}
        tags = payload.get("tags") or []
        if not isinstance(tags, (list, tuple)):
            tags = []

        club = Club(
            name=name,
            slug=payload.get("slug") or str(uuid.uuid4())[:8],
            description=payload.get("description") or "",
            main_image_url=payload.get("image") or None,
            price_cents=price_cents,
            address_id=getattr(addr_obj, "id", None),
            tags=list(tags),
            phone=phone,
            webSite=webSite,
            social_links=dict(social_links),
            group_size=payload.get("group_size") or None,
            teacher_id=payload.get("teacher_id") or None,
        )
        session.add(club)
        await session.flush()  # ensure club.id available

        # schedules payload handling — robust parsing + filtering empty entries
        schedules_payload = payload.get("schedules") or []
        weekday_map = {
            "понедельник": 0, "вторник": 1, "среда": 2,
            "четверг": 3, "пятница": 4, "суббота": 5, "воскресенье": 6
        }
        created = []
        for s in schedules_payload:
            if not isinstance(s, dict):
                continue
            raw_day = (s.get("day") or "").strip()
            raw_time = (s.get("time") or "").strip()

            # if day looks like a time (contains digits or ':' or '–' etc) and time empty => swap
            if (not raw_time) and any(ch.isdigit() for ch in raw_day):
                raw_time = raw_day
                raw_day = ""

            # skip completely empty entries
            if not raw_day and not raw_time:
                continue

            # interpret weekday if possible
            weekday_val = None
            if raw_day:
                try:
                    weekday_val = int(raw_day)
                except Exception:
                    weekday_val = weekday_map.get(raw_day.lower(), None)

            # parse time into start/end if possible
            start_time_obj = None
            end_time_obj = None
            note = None
            if raw_time:
                t = raw_time.replace("–", "-").replace("—", "-")
                parts = [p.strip() for p in t.split("-", 1)]
                if len(parts) == 2 and parts[0] and parts[1]:
                    # try parse HH:MM
                    try:
                        hh, mm = [int(x) for x in parts[0].split(":")]
                        start_time_obj = dt_time(hh, mm)
                    except Exception:
                        start_time_obj = None
                    try:
                        hh, mm = [int(x) for x in parts[1].split(":")]
                        end_time_obj = dt_time(hh, mm)
                    except Exception:
                        end_time_obj = None
                    if start_time_obj is None and end_time_obj is None:
                        note = raw_time
                else:
                    note = raw_time

            # if nothing meaningful (weekday None and no times and no note) -> skip
            if weekday_val is None and not start_time_obj and not end_time_obj and not note:
                continue

            schedule_row = Schedule(
                club_id=club.id,
                weekday=weekday_val,
                start_time=start_time_obj,
                end_time=end_time_obj,
                note=note
            )
            session.add(schedule_row)
            created.append(schedule_row)

        # commit
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise HTTPException(status_code=400, detail=f"DB error: {str(e.orig) if getattr(e,'orig',None) else str(e)}")

        # reload with relations
        q2 = await session.execute(
            select(Club)
            .where(Club.id == club.id)
            .options(
                selectinload(Club.address),
                selectinload(Club.images),
                selectinload(Club.schedules),
                selectinload(Club.teacher),
            )
        )
        club_full = q2.scalar_one_or_none() or club

        base_origin = str(request.base_url).rstrip("/")
        extra = {"tags": list(club_full.tags or []), "isFavorite": payload.get("isFavorite", False)}
        out = _serialize_club(club_full, base_origin, extra)

        try:
            write_static_club_file(out["slug"], out)
        except Exception as e:
            print("[WARN] write_static_club_file failed (create):", e)

        return out


@app.put("/api/clubs/{club_id}")
async def api_update_club(club_id: str, request: Request, payload: dict):
    from sqlalchemy.orm.attributes import flag_modified
    async with AsyncSessionLocal() as session:
        # allow id or slug lookup
        where_clause = None
        try:
            parsed_uuid = uuid.UUID(str(club_id))
            where_clause = (Club.id == parsed_uuid)
        except Exception:
            where_clause = or_(Club.id == club_id, Club.slug == club_id)

        q = await session.execute(select(Club).where(where_clause))
        club = q.scalar_one_or_none()
        if not club:
            print(f"[WARN] Update requested but club not found for club_id={club_id}")
            raise HTTPException(status_code=404, detail="Club not found")

        print(f"[DEBUG] Update club {club_id} payload: {payload}")

        # simple scalars
        if "name" in payload: club.name = payload.get("name")
        if "slug" in payload: club.slug = payload.get("slug")
        if "description" in payload: club.description = payload.get("description")
        if "image" in payload: club.main_image_url = payload.get("image")

        # price
        if "price_rub" in payload:
            try:
                price_rub = float(payload.get("price_rub") or 0)
                club.price_cents = int(round(price_rub * 100))
            except Exception:
                club.price_cents = None
        elif "price_cents" in payload:
            try:
                club.price_cents = int(payload.get("price_cents"))
            except Exception:
                club.price_cents = None

        # contacts
        if "phone" in payload: club.phone = payload.get("phone") or ""
        if "webSite" in payload or "website" in payload:
            club.webSite = payload.get("webSite") or payload.get("website") or ""

        # tags / social links
        if "tags" in payload:
            tags = payload.get("tags") or []
            if not isinstance(tags, (list, tuple)):
                tags = []
            club.tags = list(tags)
            try:
                flag_modified(club, "tags")
            except Exception:
                pass

        if "socialLinks" in payload or "social_links" in payload:
            social = payload.get("socialLinks") or payload.get("social_links") or {}
            if not isinstance(social, dict):
                social = {}
            club.social_links = dict(social)
            try:
                flag_modified(club, "social_links")
            except Exception:
                pass

        # location -> address
        loc = (payload.get("location") or "").strip()
        street_val, city_val = _split_location(loc)
        if club.address_id:
            addr_q = await session.execute(select(Address).where(Address.id == club.address_id))
            addr = addr_q.scalar_one_or_none()
            if addr:
                addr.street = street_val
                addr.city = city_val
                session.add(addr)
                await session.flush()
            else:
                if street_val or city_val:
                    new_addr = Address(street=street_val, city=city_val)
                    session.add(new_addr)
                    await session.flush()
                    club.address_id = new_addr.id
        else:
            if street_val or city_val:
                new_addr = Address(street=street_val, city=city_val)
                session.add(new_addr)
                await session.flush()
                club.address_id = new_addr.id

        # schedules replacement (if provided) — filter empty rows
        if "schedules" in payload:
            try:
                await session.execute(delete(Schedule).where(Schedule.club_id == club.id))
            except Exception:
                pass

            schedules_payload = payload.get("schedules") or []
            weekday_map = {
                "понедельник": 0, "вторник": 1, "среда": 2,
                "четверг": 3, "пятница": 4, "суббота": 5, "воскресенье": 6
            }
            for s in schedules_payload:
                if not isinstance(s, dict):
                    continue
                raw_day = (s.get("day") or "").strip()
                raw_time = (s.get("time") or "").strip()
                if (not raw_time) and any(ch.isdigit() for ch in raw_day):
                    raw_time = raw_day
                    raw_day = ""
                if not raw_day and not raw_time:
                    continue

                weekday_val = None
                if raw_day:
                    try:
                        weekday_val = int(raw_day)
                    except Exception:
                        weekday_val = weekday_map.get(raw_day.lower(), None)

                start_time_obj = None
                end_time_obj = None
                note = None
                if raw_time:
                    t = raw_time.replace("–", "-").replace("—", "-")
                    parts = [p.strip() for p in t.split("-", 1)]
                    if len(parts) == 2 and parts[0] and parts[1]:
                        try:
                            hh, mm = [int(x) for x in parts[0].split(":")]
                            start_time_obj = dt_time(hh, mm)
                        except Exception:
                            start_time_obj = None
                        try:
                            hh, mm = [int(x) for x in parts[1].split(":")]
                            end_time_obj = dt_time(hh, mm)
                        except Exception:
                            end_time_obj = None
                        if start_time_obj is None and end_time_obj is None:
                            note = raw_time
                    else:
                        note = raw_time

                if weekday_val is None and not start_time_obj and not end_time_obj and not note:
                    continue

                schedule_row = Schedule(
                    club_id=club.id,
                    weekday=weekday_val,
                    start_time=start_time_obj,
                    end_time=end_time_obj,
                    note=note
                )
                session.add(schedule_row)

        session.add(club)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise HTTPException(status_code=400, detail=f"DB error: {str(e.orig) if getattr(e,'orig',None) else str(e)}")
        except Exception as e:
            await session.rollback()
            raise HTTPException(status_code=500, detail=f"Commit failed: {e}")

        # reload
        q2 = await session.execute(
            select(Club)
            .where(Club.id == club.id)
            .options(
                selectinload(Club.address),
                selectinload(Club.images),
                selectinload(Club.schedules),
                selectinload(Club.teacher),
            )
        )
        club_full = q2.scalar_one_or_none() or club

        base_origin = str(request.base_url).rstrip("/")
        extra = {"tags": club_full.tags or [], "isFavorite": payload.get("isFavorite", False)}
        out = _serialize_club(club_full, base_origin, extra)

        try:
            write_static_club_file(out["slug"], out)
        except Exception as e:
            print("[WARN] write_static_club_file failed (update):", e)

        return out
    
@app.delete("/api/clubs/{club_id}")
async def api_delete_club(club_id: str):
    async with AsyncSessionLocal() as session:
        q = await session.execute(select(Club).where(Club.id == club_id))
        club = q.scalar_one_or_none()
        if not club:
            raise HTTPException(404, "Club not found")
        slug = getattr(club, "slug", None)
        await session.delete(club)
        await session.commit()
        # удалить статическую страницу (если есть)
        if slug:
            try:
                remove_static_club_file(slug)
            except Exception:
                pass
        return {"ok": True}

@app.post("/api/clubs/{club_id}/reviews", response_model=ReviewSchema)
async def api_post_review(club_id: str, payload: ReviewCreateSchema):
    # create_review_for_club должен вернуть объект Review ORM
    try:
        review = await create_review_for_club(club_id, payload)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Club not found")
    return review


@app.post("/api/clubs/{club_id}/images")
async def api_upload_image(club_id: str, file: UploadFile = File(...)):
    # сохраняем в media/ с уникальным именем и возвращаем url
    ext = os.path.splitext(file.filename)[1]
    fname = f"{uuid.uuid4().hex}{ext or '.jpg'}"
    dest_path = os.path.join(MEDIA_DIR, fname)
    async with aiofiles.open(dest_path, "wb") as out:
        content = await file.read()
        await out.write(content)
    # Здесь можно: создать запись в таблице images (реализуй функцию в crud)
    url = f"/media/{fname}"
    return {"url": url}

@app.get("/api/clubs")
async def api_get_clubs(request: Request, limit: int = 100, offset: int = 0):
    """
    Возвращает список клубов — предварительно грузим связи (address, images, schedules, teacher),
    чтобы избежать ленивых обращений вне сессии.
    """
    async with AsyncSessionLocal() as session:
        try:
            q = await session.execute(
                select(Club)
                .options(
                    selectinload(Club.address),
                    selectinload(Club.images),
                    selectinload(Club.schedules),
                    selectinload(Club.teacher),
                )
                .limit(limit)
                .offset(offset)
            )
            clubs = q.scalars().all()
        except Exception as e:
            print("[ERROR] get_clubs failed:", repr(e))
            raise HTTPException(status_code=500, detail=f"DB read failed: {e}")

        base_origin = str(request.base_url).rstrip("/")
        out = []
        for idx, c in enumerate(clubs):
            try:
                out.append(_serialize_club(c, base_origin))
            except Exception as e:
                print(f"[WARN] serialize club idx={idx} id={getattr(c,'id',None)} failed: {e}")
        return out

@app.get("/api/clubs/{club_id}")
async def api_get_club(request: Request, club_id: str):
    """
    Возвращает один клуб по id.
    """
    async with AsyncSessionLocal() as session:
        q = await session.execute(select(Club).where(Club.id == club_id))
        c = q.scalar_one_or_none()
        if not c:
            raise HTTPException(status_code=404, detail="Club not found")
        base_origin = str(request.base_url).rstrip("/")
        return _serialize_club(c, base_origin)

@app.post("/api/clubs/{club_id}")
async def api_update_club_post(club_id: str, request: Request):
    payload = await request.json()
    print(f"[DEBUG] Update club {club_id} payload: {payload}")
    return await api_update_club(club_id, request, payload)

@app.get("/club/{slug}")
async def serve_club_page(slug: str):
    fname = os.path.join(STATIC_CLUBS_DIR, f"{slug}.html")
    if os.path.exists(fname):
        return FileResponse(fname, media_type="text/html")
    # если нет файла — попробуем сгенерировать на лету из БД
    async with AsyncSessionLocal() as session:
        q = await session.execute(select(Club).where(Club.slug == slug))
        c = q.scalar_one_or_none()
        if not c:
            raise HTTPException(404, "Club not found")
        base_origin = ""  # not required for static
        serialized = _serialize_club(c, base_origin)
        html = _render_club_html_simple(serialized)
        try:
            with open(fname, "w", encoding="utf-8") as f:
                f.write(html)
        except Exception:
            pass
        return HTMLResponse(html)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
