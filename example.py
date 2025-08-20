#!/usr/bin/env python3
"""
Example script demonstrating the Intelligent Driver Forwarder API usage
"""

import requests
import json
import time
from datetime import datetime

# Configuration
SERVICE_URL = "http://localhost:8000"  # Change this to your deployed service URL

def test_service():
    """Test the intelligent driver forwarder service"""
    
    print("🚀 Testing Intelligent Driver Forwarder Service")
    print(f"Service URL: {SERVICE_URL}")
    print("-" * 50)
    
    try:
        # Test 1: Check service status
        print("1. Checking service status...")
        response = requests.get(f"{SERVICE_URL}/")
        if response.status_code == 200:
            print("✅ Service is running")
            print(f"   Status: {response.json()}")
        else:
            print("❌ Service check failed")
            return
        
        # Test 2: Health check
        print("\n2. Health check...")
        response = requests.get(f"{SERVICE_URL}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
        
        # Test 3: Send a regular post
        print("\n3. Sending a regular priority post...")
        regular_post = {
            "title": "Daily Update",
            "content": "This is a regular daily update post",
            "author": "Content Manager",
            "priority": 2
        }
        
        response = requests.post(f"{SERVICE_URL}/posts", json=regular_post)
        if response.status_code == 200:
            result = response.json()
            print("✅ Regular post sent successfully")
            print(f"   Post ID: {result['post_id']}")
        
        # Test 4: Send a high priority post
        print("\n4. Sending a high priority post...")
        urgent_post = {
            "title": "Urgent System Alert",
            "content": "This is an urgent system alert that requires immediate attention",
            "author": "System Administrator",
            "priority": 5
        }
        
        response = requests.post(f"{SERVICE_URL}/posts", json=urgent_post)
        if response.status_code == 200:
            result = response.json()
            print("✅ High priority post sent successfully")
            print(f"   Post ID: {result['post_id']}")
        
        # Test 5: Send a post with priority keywords
        print("\n5. Sending a post with priority keywords...")
        keyword_post = {
            "title": "Breaking News Alert",
            "content": "This is breaking news about an important development",
            "author": "News Reporter",
            "priority": 3
        }
        
        response = requests.post(f"{SERVICE_URL}/posts", json=keyword_post)
        if response.status_code == 200:
            result = response.json()
            print("✅ Keyword priority post sent successfully")
            print(f"   Post ID: {result['post_id']}")
        
        # Test 6: Get all posts
        print("\n6. Retrieving all posts...")
        response = requests.get(f"{SERVICE_URL}/posts")
        if response.status_code == 200:
            posts = response.json()
            print(f"✅ Retrieved {len(posts)} posts")
            for post in posts:
                print(f"   - {post['id']}: {post['title']} (Priority: {post['priority']}, Forwarded: {post['forwarded']})")
        
        # Test 7: Get forwarded posts
        print("\n7. Retrieving forwarded posts...")
        response = requests.get(f"{SERVICE_URL}/posts/forwarded")
        if response.status_code == 200:
            forwarded = response.json()
            print(f"✅ Retrieved {len(forwarded)} forwarded posts")
        
        print("\n" + "=" * 50)
        print("🎉 All tests completed successfully!")
        print("\nThe service is now running and will automatically check for")
        print("new posts to forward every 5 minutes.")
        print(f"\nAPI Documentation: {SERVICE_URL}/docs")
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to the service")
        print("Make sure the service is running:")
        print("   Local: python main.py")
        print("   Docker: docker run -p 8000:8000 intelligent-driver-forwarder")
    except Exception as e:
        print(f"❌ Error during testing: {str(e)}")

def send_test_posts_continuously():
    """Send test posts continuously to demonstrate the 5-minute scheduler"""
    
    print("🔄 Starting continuous post generation...")
    print("This will send test posts every 30 seconds to demonstrate the system")
    print("Press Ctrl+C to stop")
    
    counter = 1
    
    try:
        while True:
            # Generate different types of posts
            post_types = [
                {
                    "title": f"Regular Update #{counter}",
                    "content": f"This is regular update number {counter}",
                    "author": "Auto Generator",
                    "priority": 1
                },
                {
                    "title": f"Important Notice #{counter}",
                    "content": f"This is an important notice number {counter}",
                    "author": "System",
                    "priority": 3
                },
                {
                    "title": f"Urgent Alert #{counter}",
                    "content": f"This is urgent alert number {counter}",
                    "author": "Alert System",
                    "priority": 5
                }
            ]
            
            # Select post type based on counter
            post = post_types[counter % 3]
            
            try:
                response = requests.post(f"{SERVICE_URL}/posts", json=post)
                if response.status_code == 200:
                    result = response.json()
                    print(f"✅ [{datetime.now().strftime('%H:%M:%S')}] Sent: {post['title']} (ID: {result['post_id']})")
                else:
                    print(f"❌ Failed to send post: {response.status_code}")
            except Exception as e:
                print(f"❌ Error sending post: {str(e)}")
            
            counter += 1
            time.sleep(30)  # Wait 30 seconds between posts
            
    except KeyboardInterrupt:
        print("\n🛑 Stopped continuous post generation")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "continuous":
        send_test_posts_continuously()
    else:
        test_service()
        print("\nTo run continuous post generation:")
        print("python example.py continuous")