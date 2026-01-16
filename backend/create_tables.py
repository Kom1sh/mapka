import sys
import os
import asyncio
import logging

from sqlalchemy import text

# Добавить корень проекта в sys.path (чтобы импорты работали при запуске из любого места)
PROJECT_ROOT = os.path.abspath(os.path.dirname(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from db import engine  # noqa: E402
from models import Base  # noqa: E402

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')


async def init_db() -> None:
    """Создает все недостающие таблицы/индексы по SQLAlchemy моделям.

    Важно:
    - Base.metadata.create_all() СОЗДАЕТ новые таблицы.
    - Он НЕ изменяет уже существующие таблицы (не добавляет/не меняет колонки).
      Для таких изменений нужна миграция (alembic) или ручные ALTER TABLE.

    Для добавления новой сущности BlogPost (таблица blog_posts) этого достаточно.
    """

    async with engine.begin() as conn:
        # На всякий случай: если где-то используются uuid_generate_v4() в SQL-скриптах
        # (не обязательно для моделей с default=uuid.uuid4)
        try:
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
        except Exception as e:
            logging.warning(
                f'Не удалось создать extension uuid-ossp (может не хватать прав). '
                f'Продолжаю. Причина: {e}'
            )

        # Создать недостающие таблицы
        await conn.run_sync(Base.metadata.create_all)

        # Быстрая проверка, что blog_posts есть (если модель BlogPost добавлена в models.py)
        try:
            r = await conn.execute(text("SELECT to_regclass('public.blog_posts');"))
            logging.info(f"blog_posts table: {r.scalar()}")
        except Exception as e:
            logging.warning(f'Не удалось проверить blog_posts: {e}')


if __name__ == '__main__':
    asyncio.run(init_db())
