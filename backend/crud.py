from sqlalchemy.future import select
from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm import selectinload
from models import Club, Review
from db import AsyncSessionLocal

async def get_clubs(limit: int = 100, offset: int = 0):
    """
    Возвращает список клубов с пагинацией (limit, offset),
    предварительно загружая связанные сущности, чтобы избежать DetachedInstanceError.
    """
    async with AsyncSessionLocal() as session:
        q = await session.execute(
            select(Club)
            .options(
                selectinload(Club.images),
                selectinload(Club.reviews),
                selectinload(Club.schedules),
                selectinload(Club.teacher),
                selectinload(Club.address),
                selectinload(Club.socialLinks)
            )
            .limit(limit)
            .offset(offset)
        )
        return q.scalars().all()

async def get_club_by_id(club_id):
    async with AsyncSessionLocal() as session:
        q = await session.execute(
            select(Club)
            .options(
                selectinload(Club.images),
                selectinload(Club.reviews),
                selectinload(Club.schedules),
                selectinload(Club.teacher),
                selectinload(Club.address)
            )
            .where(Club.id == club_id)
        )
        return q.scalar_one_or_none()

async def create_review_for_club(club_id: str, payload):
    async with AsyncSessionLocal() as session:
        q = await session.execute(select(Club).where(Club.id == club_id))
        club = q.scalar_one_or_none()
        if not club:
            raise NoResultFound()

        review = Review(
            club_id=club.id,
            author_name=getattr(payload, "author_name", None),
            rating=getattr(payload, "rating", None),
            text=getattr(payload, "text", None)
        )
        session.add(review)
        await session.commit()
        await session.refresh(review)
        return review
