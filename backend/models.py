# models.py (исправленный)
import uuid
import datetime
from sqlalchemy import (
    Column, String, Integer, Text, ForeignKey, DateTime, Float,
    Boolean, SmallInteger, Time, JSON
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.ext.mutable import MutableList

Base = declarative_base()

def gen_uuid():
    return uuid.uuid4()

class Address(Base):
    __tablename__ = "addresses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    street = Column(Text)
    city = Column(Text)
    postcode = Column(Text)
    region = Column(Text)
    lat = Column(Float)
    lon = Column(Float)

    # добавляем обратную связь: Address.clubs
    clubs = relationship("Club", back_populates="address", cascade="all, delete-orphan")

class Teacher(Base):
    __tablename__ = "teachers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    bio = Column(Text)
    phone = Column(Text)
    email = Column(Text)
    photo_url = Column(Text)

class Club(Base):
    __tablename__ = "clubs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    phone = Column(String(64), nullable=True)
    webSite = Column(String(1024), nullable=True)
    social_links = Column(JSON, nullable=True, default=dict)
    # УБРАНА колонка schedules = Column(JSON,...), используем relationship Schedule
    address_id = Column(UUID(as_uuid=True), ForeignKey("addresses.id"), nullable=True)
    address = relationship("Address", back_populates="clubs", uselist=False)
    main_image_url = Column(String(1024), nullable=True)
    price_cents = Column(Integer, nullable=True)
    currency = Column(Text, default="RUB")
    group_size = Column(Integer)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teachers.id"))
    lat = Column(Float)
    lon = Column(Float)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    tags = Column(MutableList.as_mutable(JSON), nullable=True, default=list)

    images = relationship("Image", back_populates="club", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="club", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="club", cascade="all, delete-orphan")
    teacher = relationship("Teacher")

class Image(Base):
    __tablename__ = "images"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    club_id = Column(UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"))
    url = Column(Text, nullable=False)
    alt = Column(Text)
    is_cover = Column(Boolean, default=False)
    club = relationship("Club", back_populates="images")


class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    club_id = Column(UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"))
    weekday = Column(SmallInteger)       # 0..6 or 1..7 — твой выбор
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    note = Column(Text, nullable=True)
    club = relationship("Club", back_populates="schedules")


class Review(Base):
    __tablename__ = "reviews"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    club_id = Column(UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"))
    author_name = Column(Text, nullable=True)
    rating = Column(SmallInteger, nullable=True)
    text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    club = relationship("Club", back_populates="reviews")

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String(50), nullable=False, default="moder")
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
