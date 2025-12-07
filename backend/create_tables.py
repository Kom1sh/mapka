import sys, os
# добавить корень проекта в sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

import asyncio
from db import engine
from models import Base

async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

if __name__ == "__main__":
    asyncio.run(init())
