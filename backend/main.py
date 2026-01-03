# main.py
import os
import uuid
import datetime
import json
import asyncio
import urllib.parse
import urllib.request

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse, Response, PlainTextResponse
from xml.sax.saxutils import escape as xml_escape

import aiofiles
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy import select, delete, or_

from models import Club, Address, Schedule
from db import AsyncSessionLocal

from fastapi.exceptions import HTTPException as FastAPIHTTPException, RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

# auth: поддержим оба варианта импорта (на случай разных названий в auth.py)
auth_router = None
admin_required = None
try:
    from auth import auth_router, admin_required  # type: ignore
except Exception:
    try:
        from auth import router as auth_router, admin_required  # type: ignore
    except Exception:
        auth_router = None
        admin_required = None

from datetime import time as dt_time


# ------------------------------
# CONFIG / PATHS
# ------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

STATIC_DIR = os.path.join(BASE_DIR, "static")
STATIC_CLUBS_DIR = os.path.join(STATIC_DIR, "clubs")

UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(STATIC_CLUBS_DIR, exist_ok=True)


# ------------------------------
# APP
# ------------------------------
app = FastAPI(title="Mapka API")

if auth_router is not None:
    app.include_router(auth_router)


# ------------------------------
# CORS
# ------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CORSMiddlewareAll(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        try:
            response = await call_next(request)
        except Exception as exc:
            if isinstance(exc, FastAPIHTTPException):
                response = JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
            elif isinstance(exc, RequestValidationError):
                response = JSONResponse(status_code=422, content={"detail": exc.errors()})
            else:
                response = JSONResponse(status_code=500, content={"detail": str(exc)})

        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response


app.add_middleware(CORSMiddlewareAll)


# ------------------------------
# Static mount
# ------------------------------
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ------------------------------
# Helpers
# ------------------------------
def _base_origin_from_request(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    return f"{proto}://{host}"


def _split_location(loc_str: str):
    if not loc_str:
        return None, None
    parts = [p.strip() for p in loc_str.split(",", 1)]
    if len(parts) == 2 and parts[1]:
        return parts[0], parts[1]
    return loc_str.strip(), None


# ------------------------------
# Yandex Geocoder (server-side)
# ------------------------------
# По твоей просьбе: ключ прямо в коде.
# Это тот же ключ, что у тебя уже светится на фронте.
YANDEX_GEOCODER_API_KEY = "58c38b72-57f7-4946-bc13-a256d341281a"


def _to_float(v):
    try:
        if v is None or v == "":
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


async def _geocode_yandex(location: str):
    """
    Возвращает (lat, lon) через Yandex Geocoder API.
    ВАЖНО: вызываем ТОЛЬКО при create/update (админка), чтобы не жечь лимит на просмотрах.
    """
    if not YANDEX_GEOCODER_API_KEY or not location:
        return None

    params = {
        "format": "json",
        "apikey": YANDEX_GEOCODER_API_KEY,
        "geocode": location,
    }
    url = "https://geocode-maps.yandex.ru/1.x/?" + urllib.parse.urlencode(params)

    def _fetch():
        with urllib.request.urlopen(url, timeout=8) as resp:
            return resp.read().decode("utf-8", errors="ignore")

    try:
        text = await asyncio.to_thread(_fetch)
        data = json.loads(text)

        pos = (
            data.get("response", {})
                .get("GeoObjectCollection", {})
                .get("featureMember", [{}])[0]
                .get("GeoObject", {})
                .get("Point", {})
                .get("pos")
        )
        if not pos:
            return None

        lon_s, lat_s = pos.split()
        lat = _to_float(lat_s)
        lon = _to_float(lon_s)
        if lat is None or lon is None:
            return None
        return lat, lon
    except Exception as e:
        print(f"[WARN] geocode failed for '{location}': {e}")
        return None


# ------------------------------
# robots + sitemap (динамика)
# ------------------------------
@app.get("/robots.txt", response_class=PlainTextResponse, include_in_schema=False)
async def robots_txt(request: Request):
    base = _base_origin_from_request(request).rstrip("/")
    lines = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin-panel",
        "Disallow: /favorites",
        f"Sitemap: {base}/sitemap.xml",
        "",
    ]
    return "\n".join(lines)


@app.get("/sitemap.xml", response_class=Response, include_in_schema=False)
async def sitemap_xml(request: Request):
    base = _base_origin_from_request(request).rstrip("/")
    urls = [f"{base}/"]

    async with AsyncSessionLocal() as session:
        q = await session.execute(select(Club.slug))
        slugs = [row[0] for row in q.all() if row and row[0]]

    for slug in slugs:
        urls.append(f"{base}/{slug}")

    today = datetime.datetime.utcnow().date().isoformat()
    body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    for u in urls:
        body.append("<url>")
        body.append(f"<loc>{xml_escape(u)}</loc>")
        body.append(f"<lastmod>{today}</lastmod>")
        body.append("</url>")
    body.append("</urlset>")

    return Response(
        content="\n".join(body),
        media_type="application/xml; charset=utf-8",
        headers={"Cache-Control": "no-store, max-age=0"},
    )


# ------------------------------
# Serializers
# ------------------------------
def _serialize_club(c, base_origin: str, payload_extra: dict = None):
    try:
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

        addr = getattr(c, "address", None)
        location = ""
        if addr:
            street = getattr(addr, "street", None) or ""
            city = getattr(addr, "city", None) or ""
            parts = [p for p in (street.strip(), city.strip()) if p]
            location = ", ".join(parts)

        tags = list(getattr(c, "tags", None) or [])
        raw_social = getattr(c, "social_links", None) or {}
        social_links = dict(raw_social) if isinstance(raw_social, dict) else {}

        schedules_out = []
        raw_schedules = getattr(c, "schedules", None)
        if raw_schedules:
            for s in raw_schedules:
                try:
                    wd = getattr(s, "weekday", None)
                    day = str(wd) if wd is not None else ""
                    st = getattr(s, "start_time", None)
                    en = getattr(s, "end_time", None)
                    note = getattr(s, "note", None) or ""
                    time_str = ""
                    if st and en:
                        try:
                            time_str = f"{st.strftime('%H:%M')}-{en.strftime('%H:%M')}"
                        except Exception:
                            time_str = f"{st}-{en}"
                    schedules_out.append({"day": day, "time": time_str, "note": note})
                except Exception:
                    pass

        price_cents = getattr(c, "price_cents", None)
        price_rub = None
        if price_cents is not None:
            try:
                price_rub = float(price_cents) / 100.0
            except Exception:
                price_rub = None

        out = {
            "id": str(getattr(c, "id", "") or ""),
            "name": getattr(c, "name", "") or "",
            "slug": getattr(c, "slug", "") or "",
            "description": getattr(c, "description", "") or "",
            "image": image_url or "",
            "location": location,

            # ✅ важно для фронта: чтобы он не дергал геокодер на просмотрах
            "lat": getattr(c, "lat", None),
            "lon": getattr(c, "lon", None),

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


# ------------------------------
# Misc
# ------------------------------
@app.options("/{path:path}")
async def options_handler(path: str):
    return StarletteResponse(status_code=204)


@app.get("/api/health")
async def health():
    return {"ok": True}


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[-1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    out_path = os.path.join(UPLOAD_DIR, filename)
    async with aiofiles.open(out_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    return {"url": f"/uploads/{filename}"}


# ------------------------------
# Clubs API
# ------------------------------
@app.post("/api/clubs")
async def api_create_club(request: Request, payload: dict, user=Depends(admin_required) if admin_required else None):
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

        tags = payload.get("tags") or []
        if not isinstance(tags, (list, tuple)):
            tags = []

        phone = payload.get("phone") or ""
        webSite = payload.get("webSite") or payload.get("website") or ""

        social_links = payload.get("socialLinks") or payload.get("social_links") or {}
        if not isinstance(social_links, dict):
            social_links = {}

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

        # ✅ coords: если не прислали — геокодим 1 раз при создании
        lat = _to_float(payload.get("lat"))
        lon = _to_float(payload.get("lon"))
        if (lat is None or lon is None) and loc:
            geo = await _geocode_yandex(loc)
            if geo:
                lat, lon = geo

        if addr_obj is not None:
            addr_obj.lat = lat
            addr_obj.lon = lon

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
            lat=lat,
            lon=lon,
        )
        session.add(club)
        await session.flush()

        # schedules
        schedules_payload = payload.get("schedules") or []
        weekday_map = {
            "понедельник": 0, "вторник": 1, "среда": 2,
            "четверг": 3, "пятница": 4, "суббота": 5, "воскресенье": 6
        }

        for row in schedules_payload:
            if not isinstance(row, dict):
                continue
            day = (row.get("day") or "").strip().lower()
            raw_time = (row.get("time") or "").strip()
            note = (row.get("note") or "").strip() if row.get("note") is not None else None

            weekday_val = weekday_map.get(day, None)

            start_time_obj = None
            end_time_obj = None
            note_time = None
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
                        note_time = raw_time
                else:
                    note_time = raw_time

            final_note = note or note_time

            if weekday_val is None and not start_time_obj and not end_time_obj and not final_note:
                continue

            session.add(Schedule(
                club_id=club.id,
                weekday=weekday_val,
                start_time=start_time_obj,
                end_time=end_time_obj,
                note=final_note,
            ))

        await session.commit()

        base_origin = _base_origin_from_request(request)
        q2 = await session.execute(
            select(Club).options(selectinload(Club.address), selectinload(Club.schedules)).where(Club.id == club.id)
        )
        c2 = q2.scalar_one_or_none()
        return _serialize_club(c2 or club, base_origin)


@app.get("/api/clubs")
async def api_list_clubs(request: Request):
    async with AsyncSessionLocal() as session:
        q = await session.execute(
            select(Club).options(selectinload(Club.address), selectinload(Club.schedules)).order_by(Club.created_at.desc())
        )
        clubs = q.scalars().all()
        base_origin = _base_origin_from_request(request)
        return [_serialize_club(c, base_origin) for c in clubs]


@app.get("/api/clubs/{club_id}")
async def api_get_club(club_id: str, request: Request):
    async with AsyncSessionLocal() as session:
        try:
            parsed_uuid = uuid.UUID(str(club_id))
            where_clause = (Club.id == parsed_uuid)
        except Exception:
            where_clause = or_(Club.id == club_id, Club.slug == club_id)

        q = await session.execute(
            select(Club).options(selectinload(Club.address), selectinload(Club.schedules)).where(where_clause)
        )
        c = q.scalar_one_or_none()
        if not c:
            raise HTTPException(status_code=404, detail="Club not found")
        base_origin = _base_origin_from_request(request)
        return _serialize_club(c, base_origin)


@app.put("/api/clubs/{club_id}")
async def api_update_club(club_id: str, request: Request, payload: dict):
    from sqlalchemy.orm.attributes import flag_modified

    async with AsyncSessionLocal() as session:
        try:
            parsed_uuid = uuid.UUID(str(club_id))
            where_clause = (Club.id == parsed_uuid)
        except Exception:
            where_clause = or_(Club.id == club_id, Club.slug == club_id)

        q = await session.execute(select(Club).where(where_clause))
        club = q.scalar_one_or_none()
        if not club:
            raise HTTPException(status_code=404, detail="Club not found")

        club.updated_at = datetime.datetime.utcnow()

        # scalars
        if "name" in payload:
            club.name = payload.get("name")
        if "slug" in payload:
            club.slug = payload.get("slug")
        if "description" in payload:
            club.description = payload.get("description") or ""
        if "image" in payload:
            club.main_image_url = payload.get("image") or None

        if "phone" in payload:
            club.phone = payload.get("phone") or ""
        if "webSite" in payload or "website" in payload:
            club.webSite = payload.get("webSite") or payload.get("website") or ""

        if "price_rub" in payload:
            try:
                price_rub = float(payload.get("price_rub") or 0)
                club.price_cents = int(round(price_rub * 100))
            except Exception:
                club.price_cents = None
        if "price_cents" in payload:
            try:
                club.price_cents = int(payload.get("price_cents"))
            except Exception:
                club.price_cents = None

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

        # ✅ coords: если прислали — сохраняем
        lat_in_payload = "lat" in payload
        lon_in_payload = "lon" in payload
        if lat_in_payload:
            club.lat = _to_float(payload.get("lat"))
        if lon_in_payload:
            club.lon = _to_float(payload.get("lon"))

        # location -> address (и если coords не прислали — геокодим 1 раз)
        loc = (payload.get("location") or "").strip()
        need_geocode = (not lat_in_payload and not lon_in_payload and bool(loc))

        if "location" in payload:
            street_val, city_val = _split_location(loc)

            addr = None
            if club.address_id:
                addr_q = await session.execute(select(Address).where(Address.id == club.address_id))
                addr = addr_q.scalar_one_or_none()

            if addr:
                addr.street = street_val
                addr.city = city_val
            else:
                if street_val or city_val:
                    new_addr = Address(street=street_val, city=city_val)
                    session.add(new_addr)
                    await session.flush()
                    club.address_id = new_addr.id
                    addr = new_addr

            if need_geocode:
                geo = await _geocode_yandex(loc)
                if geo:
                    club.lat, club.lon = geo
                    if addr:
                        addr.lat, addr.lon = geo

        # schedules (replace)
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

            for row in schedules_payload:
                if not isinstance(row, dict):
                    continue
                day = (row.get("day") or "").strip().lower()
                raw_time = (row.get("time") or "").strip()
                note = (row.get("note") or "").strip() if row.get("note") is not None else None

                weekday_val = weekday_map.get(day, None)

                start_time_obj = None
                end_time_obj = None
                note_time = None
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
                            note_time = raw_time
                    else:
                        note_time = raw_time

                final_note = note or note_time

                if weekday_val is None and not start_time_obj and not end_time_obj and not final_note:
                    continue

                session.add(Schedule(
                    club_id=club.id,
                    weekday=weekday_val,
                    start_time=start_time_obj,
                    end_time=end_time_obj,
                    note=final_note,
                ))

        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            raise HTTPException(status_code=400, detail="Slug already exists")

        base_origin = _base_origin_from_request(request)
        q2 = await session.execute(
            select(Club).options(selectinload(Club.address), selectinload(Club.schedules)).where(Club.id == club.id)
        )
        c2 = q2.scalar_one_or_none()
        return _serialize_club(c2 or club, base_origin)


@app.delete("/api/clubs/{club_id}")
async def api_delete_club(club_id: str):
    async with AsyncSessionLocal() as session:
        try:
            parsed_uuid = uuid.UUID(str(club_id))
            where_clause = (Club.id == parsed_uuid)
        except Exception:
            where_clause = or_(Club.id == club_id, Club.slug == club_id)

        q = await session.execute(select(Club).where(where_clause))
        club = q.scalar_one_or_none()
        if not club:
            raise HTTPException(status_code=404, detail="Club not found")

        await session.delete(club)
        await session.commit()
        return {"ok": True}
