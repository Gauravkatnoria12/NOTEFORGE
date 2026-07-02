from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

class Database:
    client: AsyncIOMotorClient = None
    db = None

    async def connect(self):
        self.client = AsyncIOMotorClient(settings.MONGODB_URI)
        db_name = settings.MONGODB_URI.split("/")[-1].split("?")[0]
        if not db_name or db_name == "localhost:27017":
            db_name = "noteforge"
        self.db = self.client[db_name]
        
        # Create indexes
        await self.db.users.create_index("email", unique=True)
        await self.db.notes.create_index([("user_id", 1), ("updated_at", -1)])
        await self.db.todos.create_index([("user_id", 1), ("completed", 1)])
        
        print(f"Connected to MongoDB database: {db_name}")

    async def disconnect(self):
        if self.client:
            self.client.close()
            print("Disconnected from MongoDB")

db = Database()
