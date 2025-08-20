import pytest
from fastapi.testclient import TestClient
from main import app
import time

client = TestClient(app)

def test_read_root():
    """Test the root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "status" in data
    assert data["status"] == "active"

def test_health_check():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data

def test_create_post():
    """Test creating a new post"""
    post_data = {
        "title": "Test Post",
        "content": "This is a test post content",
        "author": "Test Author",
        "priority": 3
    }
    
    response = client.post("/posts", json=post_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "post_id" in data
    assert data["message"] == "Post received and processed for intelligent forwarding"

def test_create_high_priority_post():
    """Test creating a high priority post"""
    post_data = {
        "title": "Urgent Alert",
        "content": "This is an urgent system alert",
        "author": "System Admin",
        "priority": 5
    }
    
    response = client.post("/posts", json=post_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

def test_create_post_with_priority_keywords():
    """Test creating a post with priority keywords"""
    post_data = {
        "title": "Important Breaking News",
        "content": "This is breaking news about an important event",
        "author": "News Reporter",
        "priority": 2
    }
    
    response = client.post("/posts", json=post_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

def test_get_posts():
    """Test getting all posts"""
    response = client.get("/posts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_get_forwarded_posts():
    """Test getting forwarded posts"""
    response = client.get("/posts/forwarded")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_get_nonexistent_post():
    """Test getting a post that doesn't exist"""
    response = client.get("/posts/nonexistent_id")
    assert response.status_code == 404

def test_post_validation():
    """Test post data validation"""
    # Missing required fields
    invalid_post = {
        "title": "Test"
        # Missing content and author
    }
    
    response = client.post("/posts", json=invalid_post)
    assert response.status_code == 422  # Validation error

def test_post_processing_flow():
    """Test the complete post processing flow"""
    # Create a regular priority post
    post_data = {
        "title": "Regular Post",
        "content": "This is a regular post",
        "author": "User",
        "priority": 2
    }
    
    # Send post
    response = client.post("/posts", json=post_data)
    assert response.status_code == 200
    post_id = response.json()["post_id"]
    
    # Check if post exists
    response = client.get(f"/posts/{post_id}")
    assert response.status_code == 200
    
    # Verify post data
    post = response.json()
    assert post["title"] == post_data["title"]
    assert post["content"] == post_data["content"]
    assert post["author"] == post_data["author"]
    assert post["priority"] == post_data["priority"]

if __name__ == "__main__":
    pytest.main([__file__, "-v"])