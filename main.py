from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import json
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Scheduler setup
scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events"""
    # Startup
    scheduler.start()
    logger.info("Intelligent Driver Forwarder started successfully")
    logger.info("Scheduler started - will check for new posts every 5 minutes")
    
    yield
    
    # Shutdown
    scheduler.shutdown()
    logger.info("Scheduler stopped")

app = FastAPI(
    title="Intelligent Driver Forwarder",
    description="A service that intelligently forwards posts and checks for new content every 5 minutes",
    version="1.0.0",
    lifespan=lifespan
)

# Data models
class Post(BaseModel):
    id: Optional[str] = None
    title: str
    content: str
    author: str
    timestamp: Optional[datetime] = None
    forwarded: bool = False
    priority: int = 1  # 1-5, higher is more important

class ForwardResponse(BaseModel):
    success: bool
    message: str
    post_id: str

# In-memory storage (in production, use a proper database)
posts_store: List[Post] = []
forwarded_posts: List[Post] = []

@app.get("/")
async def read_root():
    return {
        "message": "Intelligent Driver Forwarder is running",
        "status": "active",
        "posts_count": len(posts_store),
        "forwarded_count": len(forwarded_posts)
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}

@app.post("/posts", response_model=ForwardResponse)
async def receive_post(post: Post):
    """Receive a new post for intelligent forwarding"""
    try:
        # Generate ID and timestamp if not provided
        if not post.id:
            post.id = f"post_{len(posts_store) + 1}_{int(datetime.now().timestamp())}"
        if not post.timestamp:
            post.timestamp = datetime.now()
        
        # Add to store
        posts_store.append(post)
        logger.info(f"Received new post: {post.id} - {post.title}")
        
        # Intelligent forwarding logic
        await intelligent_forward(post)
        
        return ForwardResponse(
            success=True,
            message="Post received and processed for intelligent forwarding",
            post_id=post.id
        )
    except Exception as e:
        logger.error(f"Error processing post: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing post: {str(e)}")

@app.get("/posts", response_model=List[Post])
async def get_posts():
    """Get all posts"""
    return posts_store

@app.get("/posts/forwarded", response_model=List[Post])
async def get_forwarded_posts():
    """Get all forwarded posts"""
    return forwarded_posts

@app.get("/posts/{post_id}")
async def get_post(post_id: str):
    """Get a specific post by ID"""
    for post in posts_store:
        if post.id == post_id:
            return post
    raise HTTPException(status_code=404, detail="Post not found")

async def intelligent_forward(post: Post):
    """Intelligent forwarding logic based on post priority and content"""
    try:
        # Simple intelligence: forward based on priority and keywords
        high_priority_keywords = ["urgent", "important", "breaking", "alert"]
        
        # Check for high priority keywords
        content_lower = post.content.lower()
        title_lower = post.title.lower()
        
        has_priority_keywords = any(
            keyword in content_lower or keyword in title_lower 
            for keyword in high_priority_keywords
        )
        
        if post.priority >= 4 or has_priority_keywords:
            await forward_post_immediately(post)
        else:
            logger.info(f"Post {post.id} queued for batch forwarding")
        
    except Exception as e:
        logger.error(f"Error in intelligent forwarding for post {post.id}: {str(e)}")

async def forward_post_immediately(post: Post):
    """Forward a post immediately"""
    try:
        # Simulate forwarding to external service
        logger.info(f"🚀 Immediately forwarding high-priority post: {post.id}")
        
        # Mark as forwarded
        post.forwarded = True
        forwarded_posts.append(post)
        
        logger.info(f"✅ Post {post.id} forwarded successfully")
        
    except Exception as e:
        logger.error(f"Error forwarding post {post.id}: {str(e)}")

async def check_and_forward_posts():
    """Background task that runs every 5 minutes to check for new posts to forward"""
    try:
        logger.info("🔍 Checking for new posts to forward...")
        
        # Find unforwarded posts
        unforwarded_posts = [post for post in posts_store if not post.forwarded]
        
        if unforwarded_posts:
            logger.info(f"Found {len(unforwarded_posts)} posts to forward")
            
            for post in unforwarded_posts:
                await forward_post_immediately(post)
                
        else:
            logger.info("No new posts to forward")
            
        logger.info(f"📊 Summary - Total posts: {len(posts_store)}, Forwarded: {len(forwarded_posts)}")
        
    except Exception as e:
        logger.error(f"Error in scheduled post check: {str(e)}")

# Schedule the task to run every 5 minutes
scheduler.add_job(
    check_and_forward_posts,
    trigger=IntervalTrigger(minutes=5),
    id="post_forwarder",
    name="Check and forward posts every 5 minutes",
    replace_existing=True
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)