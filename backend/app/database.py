"""
MongoDB connection using Motor (async driver).
"""

import motor.motor_asyncio
from app.config import settings

client: motor.motor_asyncio.AsyncIOMotorClient = None
db = None


async def connect_db():
    """Connect to MongoDB."""
    global client, db
    client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    # Create indexes
    await db.exams.create_index("created_at")
    await db.papers.create_index("exam_id")
    await db.papers.create_index("status")
    await db.evaluations.create_index("paper_id")
    await db.evaluations.create_index("question_number")


async def close_db():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()


def get_db():
    """Return the database instance."""
    return db
