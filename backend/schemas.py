from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Any
from datetime import time, datetime
from uuid import UUID

class ImageSchema(BaseModel):
    id: UUID
    url: str
    alt: Optional[str]
    is_cover: bool

    model_config = {"from_attributes": True}

class ReviewSchema(BaseModel):
    id: UUID
    author_name: Optional[str]
    rating: Optional[int]
    text: Optional[str]
    created_at: Optional[datetime]   # <-- changed to datetime

    model_config = {"from_attributes": True}

class ReviewCreateSchema(BaseModel):
    author_name: str = Field(None)
    rating: int = Field(..., ge=1, le=5)
    text: str = Field(None)

    class Config:
        orm_mode = True

class ScheduleSchema(BaseModel):
    id: UUID
    weekday: Optional[int]
    start_time: Optional[time]
    end_time: Optional[time]
    note: Optional[str]

    model_config = {"from_attributes": True}

class TeacherSchema(BaseModel):
    id: UUID
    name: str
    bio: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    photo_url: Optional[str]

    model_config = {"from_attributes": True}
class ClubSchema(BaseModel):
    id: UUID
    name: str
    slug: Optional[str]
    description: Optional[str]
    phone: Optional[str] = None
    webSite: Optional[str] = None

    # ✅ new fields
    category: Optional[str] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    price_notes: Optional[str] = None

    main_image_url: Optional[str]
    price_cents: Optional[int]
    currency: Optional[str]
    group_size: Optional[int]
    lat: Optional[float]
    lon: Optional[float]
    tags: List[str] = []

    social_links: Optional[dict] = None
    images: List[ImageSchema] = []
    reviews: List[ReviewSchema] = []
    schedules: List[ScheduleSchema] = []
    teacher: Optional[TeacherSchema]

    model_config = {"from_attributes": True}


# ==========================
# Blog
# ==========================

class BlogFaqItemSchema(BaseModel):
    q: str
    a: str


class BlogPostSchema(BaseModel):
    id: UUID
    title: str
    slug: str

    status: Literal["draft", "published"] = "draft"
    excerpt: Optional[str] = None
    content: Optional[str] = None
    content_blocks: Optional[List[Any]] = None

    cover_image: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []

    author_name: Optional[str] = None
    author_role: Optional[str] = None
    author_avatar: Optional[str] = None

    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    faq: Optional[List[BlogFaqItemSchema]] = None

    model_config = {"from_attributes": True}


class BlogPostCreateSchema(BaseModel):
    title: str
    slug: Optional[str] = None
    status: Literal["draft", "published"] = "draft"

    excerpt: Optional[str] = None
    content: Optional[str] = None
    content_blocks: Optional[List[Any]] = None

    cover_image: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []

    author_name: Optional[str] = None
    author_role: Optional[str] = None
    author_avatar: Optional[str] = None

    published_at: Optional[datetime] = None
    faq: Optional[List[BlogFaqItemSchema]] = None


class BlogPostUpdateSchema(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    status: Optional[Literal["draft", "published"]] = None

    excerpt: Optional[str] = None
    content: Optional[str] = None
    content_blocks: Optional[List[Any]] = None

    cover_image: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None

    author_name: Optional[str] = None
    author_role: Optional[str] = None
    author_avatar: Optional[str] = None

    published_at: Optional[datetime] = None
    faq: Optional[List[BlogFaqItemSchema]] = None
