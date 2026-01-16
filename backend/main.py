# main.py
import os
import uuid
import datetime
import asyncio
import json
import urllib.parse
import urllib.request

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse, Response, PlainTextResponse
from xml.sax.saxutils import escape as xml_escape

import aiofiles
from sqlalchemy.exc import NoResultFound, IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy import select, delete, or_, desc
from datetime import time as dt_time

from models import Club, Address, Schedule, BlogPost
from db import AsyncSessionLocal
from crud import create_review_for_club
from schemas import (
    ReviewSchema,
    ReviewCreateSchema,
    BlogPostSchema,
    BlogPostCreateSchema,
    BlogPostUpdateSchema,
)
from auth import router as auth_router, admin_required

from fastapi.exception_handlers import RequestValidationError
from fastapi.exceptions import HTTPException as FastAPIHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI(title="Mapka API")
app.include_router(auth_router)

# ==========================
# Yandex Geocoder
# ==========================
# ВАЖНО: у тебя ключ настроен с whitelist домена.
# Это почти всегда означает, что СЕРВЕРНЫЕ запросы к геокодеру будут получать 403,
# потому что у них нет Referer, который проверяет Яндекс.
# Поэтому геокодинг делаем на фронте (в админке) через JS API (ymaps.geocode),
# а бэкенд только ПРИНИМАЕТ lat/lon и пишет их в БД.
#
# Ключ оставил тут только для совместимости/будущего (и чтобы не ломать импорт),
# но по умолчанию в create/update геокодер НЕ вызывается.
YANDEX_MAPS_API_KEY = "58c38b72-57f7-4946-bc13-a256d341281a"


def _to_float(v):
    try:
        if v is None:
            return None
        if isinstance(v, str):
            v = v.strip().replace(",", ".")
            if v == "":
                return None
        return float(v)
    except Exception:
        return None


def _to_int(v):
    try:
        if v is None:
            return None
        if isinstance(v, str):
            vv = v.strip().replace(',', '.')
            if vv == '' or vv.lower() in ('null', 'undefined'):
                return None
            v = vv
        return int(float(v))
    except Exception:
        return None


def _norm_addr(addr: str) -> str:
    return " ".join(str(addr or "").strip().lower().split())


async def _geocode_yandex_server_side(address: str):
    """Серверный геокодер (по умолчанию НЕ используется).

    Если очень захочешь вернуть серверный геокодинг —
    добавь корректный ключ без referer-ограничений или используй IP allowlist.
    """
    addr = (address or "").strip()
    if not addr:
        return None

    params = {
        "format": "json",
        "apikey": YANDEX_MAPS_API_KEY,
        "geocode": addr,
        "results": "1",
    }
    url = "https://geocode-maps.yandex.ru/1.x/?" + urllib.parse.urlencode(params)

    def _fetch():
        req = urllib.request.Request(url, headers={"User-Agent": "mapka-backend/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.read().decode("utf-8", errors="ignore")

    try:
        raw = await asyncio.to_thread(_fetch)
        data = json.loads(raw)
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

        # pos: "lon lat"
        lon_s, lat_s = pos.split()[:2]
        lat = _to_float(lat_s)
        lon = _to_float(lon_s)
        if lat is None or lon is None:
            return None
        return (lat, lon)
    except Exception as e:
        print("[WARN] _geocode_yandex_server_side failed:", e)
        return None


# Middleware для добавления CORS-заголовков даже к ошибкам
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
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response


app.add_middleware(CORSMiddlewareAll)

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


def _sitemap_base(request: Request) -> str:
    return (os.getenv("SITEMAP_BASE_URL") or str(request.base_url)).rstrip("/")


@app.get("/robots.txt", include_in_schema=False)
async def robots_txt(request: Request):
    base = _sitemap_base(request)
    txt = "\n".join([
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /admin",
        "Disallow: /admin-panel",
        "Disallow: /favorites",
        "",
        f"Sitemap: {base}/sitemap.xml",
        "",
    ])
    return PlainTextResponse(txt, headers={"Cache-Control": "no-store, max-age=0"})


@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap_xml(request: Request):
    base = _sitemap_base(request)

    static_urls = [
        (f"{base}/", None),
        (f"{base}/blog", None),
    ]

    async with AsyncSessionLocal() as session:
        q = await session.execute(
            select(Club.slug, Club.updated_at).where(Club.slug != None)
        )
        rows = q.all()

        qb = await session.execute(
            select(BlogPost.slug, BlogPost.updated_at)
            .where(BlogPost.slug != None)
            .where(BlogPost.status == "published")
        )
        blog_rows = qb.all()

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]

    def add_url(loc: str, lastmod: str | None = None):
        parts.append("<url>")
        parts.append(f"<loc>{xml_escape(loc)}</loc>")
        if lastmod:
            parts.append(f"<lastmod>{xml_escape(lastmod)}</lastmod>")
        parts.append("</url>")

    for loc, lastmod in static_urls:
        add_url(loc, lastmod)

    for slug, updated_at in rows:
        if not slug:
            continue
        lm = None
        if updated_at:
            try:
                lm = updated_at.date().isoformat()
            except Exception:
                lm = None
        add_url(f"{base}/{slug}", lm)

    for slug, updated_at in blog_rows:
        if not slug:
            continue
        lm = None
        if updated_at:
            try:
                lm = updated_at.date().isoformat()
            except Exception:
                lm = None
        add_url(f"{base}/blog/{slug}", lm)

    parts.append("</urlset>")
    xml = "\n".join(parts)

    return Response(
        content=xml,
        media_type="application/xml; charset=utf-8",
        headers={"Cache-Control": "no-store, max-age=0"},
    )


def _serialize_club(c, base_origin: str, payload_extra: dict = None):
    """Надёжная сериализация ORM -> plain dict для фронта."""
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

        raw_tags = getattr(c, "tags", None)
        tags = list(raw_tags) if raw_tags is not None else []

        raw_social = getattr(c, "social_links", None) or {}
        social_links = dict(raw_social) if isinstance(raw_social, dict) else {}

        schedules_out = []
        raw_schedules = getattr(c, "schedules", None)
        if raw_schedules:
            for s in raw_schedules:
                try:
                    if hasattr(s, "weekday") or hasattr(s, "start_time") or hasattr(s, "note"):
                        day = ""
                        wd = getattr(s, "weekday", None)
                        if wd is not None:
                            wd_map = {0: "Понедельник", 1: "Вторник", 2: "Среда", 3: "Четверг", 4: "Пятница", 5: "Суббота", 6: "Воскресенье"}
                            day = wd_map.get(wd, str(wd))

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
                        schedules_out.append({
                            "day": s.get("day", "") or "",
                            "time": s.get("time", "") or "",
                            "note": s.get("note", "") or "",
                        })
                except Exception:
                    continue

        price_cents = getattr(c, "price_cents", None)
        price_rub = None
        if price_cents is not None:
            try:
                price_rub = round(float(price_cents) / 100.0, 2)
            except Exception:
                price_rub = None

        lat = getattr(c, "lat", None)
        lon = getattr(c, "lon", None)
        if (lat is None or lon is None) and addr:
            lat = getattr(addr, "lat", None)
            lon = getattr(addr, "lon", None)

        out = {
            "id": str(getattr(c, "id", "") or ""),
            "name": getattr(c, "name", "") or "",
            "slug": getattr(c, "slug", "") or "",
            "description": getattr(c, "description", "") or "",
            "image": image_url or "",
            "location": location,
            "lat": lat,
            "lon": lon,
            "isFavorite": False,
            "tags": tags,
            "category": getattr(c, "category", "") or "",
            "minAge": getattr(c, "min_age", None),
            "maxAge": getattr(c, "max_age", None),
            "priceNotes": getattr(c, "price_notes", "") or "",
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


def _slugify_basic(text: str) -> str:
    """Очень простой slugify на случай, если фронт не прислал slug."""
    s = (text or "").strip().lower()
    out = []
    prev_dash = False
    for ch in s:
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        else:
            if not prev_dash:
                out.append("-")
                prev_dash = True
    slug = "".join(out).strip("-")
    slug = "-".join([p for p in slug.split("-") if p])
    return (slug or "post")[:80]


async def _ensure_unique_blog_slug(session, desired_slug: str, exclude_id=None) -> str:
    base = _slugify_basic(desired_slug)
    slug = base
    for i in range(1, 51):
        q = select(BlogPost.id).where(BlogPost.slug == slug)
        if exclude_id is not None:
            q = q.where(BlogPost.id != exclude_id)
        r = await session.execute(q)
        exists = r.scalar_one_or_none()
        if not exists:
            return slug
        slug = f"{base}-{i+1}"
    # fallback
    return f"{base}-{uuid.uuid4().hex[:6]}"


def _serialize_blog_post(p: BlogPost):
    return {
        "id": str(getattr(p, "id", "")),
        "title": getattr(p, "title", "") or "",
        "slug": getattr(p, "slug", "") or "",
        "status": getattr(p, "status", "draft") or "draft",
        "excerpt": getattr(p, "excerpt", None),
        "content": getattr(p, "content", None),
        "content_blocks": getattr(p, "content_blocks", None),
        "cover_image": getattr(p, "cover_image", None),
        "category": getattr(p, "category", None),
        "tags": list(getattr(p, "tags", None) or []),
        "author_name": getattr(p, "author_name", None),
        "author_role": getattr(p, "author_role", None),
        "author_avatar": getattr(p, "author_avatar", None),
        "faq": getattr(p, "faq", None),
        "published_at": getattr(p, "published_at", None),
        "created_at": getattr(p, "created_at", None),
        "updated_at": getattr(p, "updated_at", None),
    }


def _render_club_html_simple(obj):
    title = obj.get("name", "Кружок")
    desc = obj.get("description", "")
    image = obj.get("image", "")
    location = obj.get("location", "")
    tags = obj.get("tags", [])
    tags_html = " ".join(f'<span class="tag-btn">{t}</span>' for t in tags)
    html = f"""<!doctype html>
<html lang=\"ru\">
<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">
<title>{title}</title></head><body>
<main>
  <h1>{title}</h1>
  <p>{desc}</p>
  <img src=\"{image}\" alt=\"\" style=\"max-width:640px;width:100%;height:auto\" />
  <p>Адрес: {location}</p>
  <div>Теги: {tags_html}</div>
</main>
</body></html>"""
    return html


def write_static_club_file(slug, payload):
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
        print("[WARN] write_static_club_file failed:", e)
        return None


def remove_static_club_file(slug):
    try:
        if not slug:
            return
        safe = str(slug).replace("/", "_")
        fname = os.path.join(STATIC_CLUBS_DIR, f"{safe}.html")
        if os.path.exists(fname):
            os.remove(fname)
    except Exception:
        pass


def _split_location(loc_str: str):
    if not loc_str:
        return None, None
    parts = [p.strip() for p in loc_str.split(",", 1)]
    if len(parts) == 2 and parts[1]:
        return parts[0], parts[1]
    return loc_str.strip(), None


@app.post("/api/clubs")
async def api_create_club(request: Request, payload: dict, user=Depends(admin_required)):
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    async with AsyncSessionLocal() as session:
        addr_obj = None
        loc = (payload.get("location") or "").strip()
        if loc:
            street_val, city_val = _split_location(loc)
            if street_val:
                addr_obj = Address(street=street_val, city=city_val)
                session.add(addr_obj)
                await session.flush()

        # coords: ТОЛЬКО из payload (геокодинг делается в админке на клиенте)
        lat = _to_float(payload.get("lat"))
        lon = _to_float(payload.get("lon"))
        if addr_obj is not None and lat is not None and lon is not None:
            addr_obj.lat = lat
            addr_obj.lon = lon

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
            category=(payload.get("category") or "").strip() or None,
            min_age=_to_int(payload.get("minAge") or payload.get("min_age")),
            max_age=_to_int(payload.get("maxAge") or payload.get("max_age")),
            price_notes=(payload.get("priceNotes") or payload.get("price_notes") or "").strip() or None,
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

            session.add(Schedule(
                club_id=club.id,
                weekday=weekday_val,
                start_time=start_time_obj,
                end_time=end_time_obj,
                note=note
            ))

        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise HTTPException(status_code=400, detail=f"DB error: {str(e.orig) if getattr(e,'orig',None) else str(e)}")

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
async def api_update_club(club_id: str, request: Request, payload: dict, user=Depends(admin_required)):
    from sqlalchemy.orm.attributes import flag_modified

    async with AsyncSessionLocal() as session:
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

        if "name" in payload:
            club.name = payload.get("name")
        if "slug" in payload:
            club.slug = payload.get("slug")
        if "description" in payload:
            club.description = payload.get("description")
        if "image" in payload:
            club.main_image_url = payload.get("image")

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

        if "phone" in payload:
            club.phone = payload.get("phone") or ""
        if "webSite" in payload or "website" in payload:
            club.webSite = payload.get("webSite") or payload.get("website") or ""

        # ✅ new fields: category / age / price notes
        if "category" in payload:
            v = payload.get("category")
            club.category = (str(v).strip() if v is not None else None) or None

        if "minAge" in payload or "min_age" in payload:
            club.min_age = _to_int(payload.get("minAge") if "minAge" in payload else payload.get("min_age"))

        if "maxAge" in payload or "max_age" in payload:
            club.max_age = _to_int(payload.get("maxAge") if "maxAge" in payload else payload.get("max_age"))

        if "priceNotes" in payload or "price_notes" in payload:
            v = payload.get("priceNotes") if "priceNotes" in payload else payload.get("price_notes")
            club.price_notes = (str(v).strip() if v is not None else None) or None


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

        # address
        old_loc_norm = ""
        addr = None
        if club.address_id:
            addr_q = await session.execute(select(Address).where(Address.id == club.address_id))
            addr = addr_q.scalar_one_or_none()
            if addr:
                old_loc_norm = _norm_addr(", ".join([x for x in [(addr.street or "").strip(), (addr.city or "").strip()] if x]))

        loc = (payload.get("location") or "").strip() if "location" in payload else ""
        if "location" in payload:
            street_val, city_val = _split_location(loc)

            if club.address_id and addr:
                addr.street = street_val
                addr.city = city_val
                session.add(addr)
                await session.flush()
            elif street_val or city_val:
                new_addr = Address(street=street_val, city=city_val)
                session.add(new_addr)
                await session.flush()
                club.address_id = new_addr.id
                addr = new_addr

        new_loc_norm = _norm_addr(loc) if loc else ""
        loc_changed = bool(loc) and (old_loc_norm != new_loc_norm)

        # coords:
        # 1) если пришли lat/lon — используем их
        has_lat = "lat" in payload
        has_lon = "lon" in payload
        payload_lat = _to_float(payload.get("lat")) if has_lat else None
        payload_lon = _to_float(payload.get("lon")) if has_lon else None

        if payload_lat is not None and payload_lon is not None:
            club.lat = payload_lat
            club.lon = payload_lon
            if addr:
                addr.lat = payload_lat
                addr.lon = payload_lon
        else:
            # 2) если адрес изменили, но координаты не прислали — сбрасываем,
            # чтобы не оставлять «старые» координаты на новый адрес.
            if loc_changed:
                club.lat = None
                club.lon = None
                if addr:
                    addr.lat = None
                    addr.lon = None

        # schedules replacement
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

                session.add(Schedule(
                    club_id=club.id,
                    weekday=weekday_val,
                    start_time=start_time_obj,
                    end_time=end_time_obj,
                    note=note
                ))

        session.add(club)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise HTTPException(status_code=400, detail=f"DB error: {str(e.orig) if getattr(e,'orig',None) else str(e)}")
        except Exception as e:
            await session.rollback()
            raise HTTPException(status_code=500, detail=f"Commit failed: {e}")

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
async def api_delete_club(club_id: str, user=Depends(admin_required)):
    async with AsyncSessionLocal() as session:
        q = await session.execute(select(Club).where(Club.id == club_id))
        club = q.scalar_one_or_none()
        if not club:
            raise HTTPException(404, "Club not found")
        slug = getattr(club, "slug", None)
        await session.delete(club)
        await session.commit()
        if slug:
            try:
                remove_static_club_file(slug)
            except Exception:
                pass
        return {"ok": True}


@app.post("/api/clubs/{club_id}/reviews", response_model=ReviewSchema)
async def api_post_review(club_id: str, payload: ReviewCreateSchema):
    try:
        review = await create_review_for_club(club_id, payload)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Club not found")
    return review


@app.post("/api/clubs/{club_id}/images")
async def api_upload_image(club_id: str, file: UploadFile = File(...), user=Depends(admin_required)):
    ext = os.path.splitext(file.filename)[1]
    fname = f"{uuid.uuid4().hex}{ext or '.jpg'}"
    dest_path = os.path.join(MEDIA_DIR, fname)
    async with aiofiles.open(dest_path, "wb") as out:
        content = await file.read()
        await out.write(content)
    url = f"/media/{fname}"
    return {"url": url}


@app.get("/api/clubs")
async def api_get_clubs(request: Request, limit: int = 100, offset: int = 0):
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
    async with AsyncSessionLocal() as session:
        q = await session.execute(
            select(Club)
            .where(or_(Club.id == club_id, Club.slug == club_id))
            .options(
                selectinload(Club.address),
                selectinload(Club.images),
                selectinload(Club.schedules),
                selectinload(Club.teacher),
            )
        )
        c = q.scalar_one_or_none()
        if not c:
            raise HTTPException(status_code=404, detail="Club not found")
        base_origin = str(request.base_url).rstrip("/")
        return _serialize_club(c, base_origin)


# ==========================
# Blog API
# ==========================


@app.get("/api/blog/public/posts")
async def api_public_blog_posts(
    limit: int = 20,
    offset: int = 0,
    q: str | None = None,
    tag: str | None = None,
    category: str | None = None,
):
    """Публичный список статей (только published)."""
    limit = max(1, min(int(limit or 20), 200))
    offset = max(0, int(offset or 0))
    q_txt = (q or "").strip()
    tag_txt = (tag or "").strip()
    cat_txt = (category or "").strip()

    async with AsyncSessionLocal() as session:
        stmt = (
            select(BlogPost)
            .where(BlogPost.status == "published")
            .order_by(desc(BlogPost.published_at), desc(BlogPost.updated_at))
            .limit(limit)
            .offset(offset)
        )
        if cat_txt:
            stmt = stmt.where(BlogPost.category == cat_txt)
        if q_txt:
            like = f"%{q_txt}%"
            stmt = stmt.where(or_(BlogPost.title.ilike(like), BlogPost.excerpt.ilike(like)))

        r = await session.execute(stmt)
        posts = r.scalars().all()

        out = []
        for p in posts:
            if tag_txt:
                tags = list(getattr(p, "tags", None) or [])
                if tag_txt not in tags:
                    continue
            out.append(_serialize_blog_post(p))
        return out


@app.get("/api/blog/public/posts/{slug}")
async def api_public_blog_post(slug: str):
    """Публичная статья по slug (только published)."""
    s = (slug or "").strip()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")

    async with AsyncSessionLocal() as session:
        r = await session.execute(
            select(BlogPost)
            .where(BlogPost.slug == s)
            .where(BlogPost.status == "published")
            .limit(1)
        )
        post = r.scalar_one_or_none()
        if not post:
            raise HTTPException(status_code=404, detail="Not found")
        return _serialize_blog_post(post)


@app.get("/api/blog/posts")
async def api_admin_blog_posts(
    limit: int = 5000,
    offset: int = 0,
    include_drafts: bool = True,
    user=Depends(admin_required),
):
    """Админский список статей (draft+published по умолчанию)."""
    limit = max(1, min(int(limit or 5000), 5000))
    offset = max(0, int(offset or 0))

    async with AsyncSessionLocal() as session:
        stmt = select(BlogPost)
        if not include_drafts:
            stmt = stmt.where(BlogPost.status == "published")
        stmt = stmt.order_by(desc(BlogPost.updated_at), desc(BlogPost.created_at)).limit(limit).offset(offset)
        r = await session.execute(stmt)
        posts = r.scalars().all()
        return [_serialize_blog_post(p) for p in posts]


@app.post("/api/blog/posts")
async def api_admin_blog_create(payload: BlogPostCreateSchema, user=Depends(admin_required)):
    now = datetime.datetime.utcnow()
    title = (payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    async with AsyncSessionLocal() as session:
        desired_slug = (payload.slug or "").strip() or _slugify_basic(title)
        slug = await _ensure_unique_blog_slug(session, desired_slug)

        status = payload.status or "draft"
        published_at = payload.published_at
        if status == "published" and not published_at:
            published_at = now
        if status != "published":
            published_at = None

        post = BlogPost(
            title=title,
            slug=slug,
            status=status,
            excerpt=(payload.excerpt or "").strip() or None,
            content=payload.content,
            content_blocks=payload.content_blocks,
            cover_image=(payload.cover_image or "").strip() or None,
            category=(payload.category or "").strip() or None,
            tags=list(payload.tags or []),
            author_name=(payload.author_name or "Редакция Мапка").strip() or None,
            author_role=(payload.author_role or "").strip() or None,
            author_avatar=(payload.author_avatar or "").strip() or None,
            faq=payload.faq,
            published_at=published_at,
            created_at=now,
            updated_at=now,
        )
        session.add(post)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise HTTPException(status_code=400, detail=f"DB error: {str(e.orig) if getattr(e,'orig',None) else str(e)}")

        await session.refresh(post)
        return _serialize_blog_post(post)


@app.put("/api/blog/posts/{post_id}")
async def api_admin_blog_update(post_id: str, payload: BlogPostUpdateSchema, user=Depends(admin_required)):
    now = datetime.datetime.utcnow()

    try:
        pid = uuid.UUID(str(post_id))
    except Exception:
        raise HTTPException(status_code=400, detail="post_id must be UUID")

    async with AsyncSessionLocal() as session:
        r = await session.execute(select(BlogPost).where(BlogPost.id == pid))
        post = r.scalar_one_or_none()
        if not post:
            raise HTTPException(status_code=404, detail="Not found")

        if payload.title is not None:
            t = (payload.title or "").strip()
            if not t:
                raise HTTPException(status_code=400, detail="title cannot be empty")
            post.title = t

        if payload.slug is not None:
            desired = (payload.slug or "").strip() or _slugify_basic(post.title)
            post.slug = await _ensure_unique_blog_slug(session, desired, exclude_id=post.id)

        if payload.excerpt is not None:
            post.excerpt = (payload.excerpt or "").strip() or None

        if payload.content is not None:
            post.content = payload.content

        if payload.content_blocks is not None:
            post.content_blocks = payload.content_blocks

        if payload.cover_image is not None:
            post.cover_image = (payload.cover_image or "").strip() or None

        if payload.category is not None:
            post.category = (payload.category or "").strip() or None

        if payload.tags is not None:
            post.tags = list(payload.tags or [])

        if payload.author_name is not None:
            post.author_name = (payload.author_name or "").strip() or None
        if payload.author_role is not None:
            post.author_role = (payload.author_role or "").strip() or None
        if payload.author_avatar is not None:
            post.author_avatar = (payload.author_avatar or "").strip() or None

        if payload.faq is not None:
            post.faq = payload.faq

        if payload.status is not None:
            st = payload.status
            if st not in ("draft", "published"):
                raise HTTPException(status_code=400, detail="status must be draft|published")
            post.status = st

        # published_at rules
        if payload.published_at is not None:
            post.published_at = payload.published_at

        if post.status == "published" and not post.published_at:
            post.published_at = now
        if post.status != "published":
            post.published_at = None

        post.updated_at = now
        session.add(post)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise HTTPException(status_code=400, detail=f"DB error: {str(e.orig) if getattr(e,'orig',None) else str(e)}")

        await session.refresh(post)
        return _serialize_blog_post(post)


@app.delete("/api/blog/posts/{post_id}")
async def api_admin_blog_delete(post_id: str, user=Depends(admin_required)):
    try:
        pid = uuid.UUID(str(post_id))
    except Exception:
        raise HTTPException(status_code=400, detail="post_id must be UUID")

    async with AsyncSessionLocal() as session:
        r = await session.execute(select(BlogPost).where(BlogPost.id == pid))
        post = r.scalar_one_or_none()
        if not post:
            raise HTTPException(status_code=404, detail="Not found")
        await session.delete(post)
        await session.commit()
        return {"ok": True}


@app.post("/api/clubs/{club_id}")
async def api_update_club_post(club_id: str, request: Request, user=Depends(admin_required)):
    payload = await request.json()
    print(f"[DEBUG] Update club {club_id} payload: {payload}")
    return await api_update_club(club_id, request, payload, user=user)


@app.get("/club/{slug}")
async def serve_club_page(slug: str):
    fname = os.path.join(STATIC_CLUBS_DIR, f"{slug}.html")
    if os.path.exists(fname):
        return FileResponse(fname, media_type="text/html")

    async with AsyncSessionLocal() as session:
        q = await session.execute(select(Club)\
            .where(Club.slug == slug)\
            .options(selectinload(Club.address), selectinload(Club.images), selectinload(Club.schedules), selectinload(Club.teacher))
        )
        c = q.scalar_one_or_none()
        if not c:
            raise HTTPException(404, "Club not found")
        serialized = _serialize_club(c, "")
        html = _render_club_html_simple(serialized)
        try:
            with open(fname, "w", encoding="utf-8") as f:
                f.write(html)
        except Exception:
            pass
        return HTMLResponse(html)


@app.get("/api/admin/geocode-missing")
@app.post("/api/admin/geocode-missing")
async def api_admin_geocode_missing(
    request: Request,
    limit: int = 50,
    user=Depends(admin_required),
):
    """Исторический эндпоинт.

    Раньше он делал серверный геокодинг. Сейчас серверный геокодинг выключен,
    потому что ключ у тебя whitelisted по домену, и сервер получает 403.

    Эндпоинт возвращает список записей, где координаты отсутствуют.
    Геокодинг и запись координат делай через админку (кнопки "Заполнить координаты").
    """
    async with AsyncSessionLocal() as session:
        q = await session.execute(
            select(Club)
            .options(selectinload(Club.address))
            .limit(5000)
        )
        clubs = q.scalars().all()

        missing = []
        for c in clubs:
            addr = getattr(c, "address", None)
            loc_parts = []
            if addr:
                st = (getattr(addr, "street", None) or "").strip()
                ct = (getattr(addr, "city", None) or "").strip()
                if st:
                    loc_parts.append(st)
                if ct:
                    loc_parts.append(ct)
            loc = ", ".join(loc_parts).strip()
            if not loc:
                continue

            club_lat = getattr(c, "lat", None)
            club_lon = getattr(c, "lon", None)
            addr_lat = getattr(addr, "lat", None) if addr else None
            addr_lon = getattr(addr, "lon", None) if addr else None

            if club_lat is None or club_lon is None or (addr and (addr_lat is None or addr_lon is None)):
                missing.append({
                    "id": str(getattr(c, "id", "")),
                    "slug": getattr(c, "slug", ""),
                    "location": loc,
                    "lat": club_lat,
                    "lon": club_lon,
                })

        missing = missing[: max(0, int(limit or 0))]

        return {
            "processed": len(missing),
            "updated": 0,
            "failed": missing,
            "note": "Server-side geocoding disabled. Use AdminPanelClient.jsx buttons to geocode via browser (ymaps.geocode) and save lat/lon into DB.",
        }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
