# Testing the 5-Minute Scheduler

This guide shows how to test the automatic post checking that happens every 5 minutes.

## Quick Test (Local)

1. **Start the service:**
   ```bash
   python main.py
   ```

2. **Send a low-priority post that won't be immediately forwarded:**
   ```bash
   curl -X POST "http://localhost:8000/posts" \
        -H "Content-Type: application/json" \
        -d '{
          "title": "Regular Update",
          "content": "This is a regular update",
          "author": "User",
          "priority": 1
        }'
   ```

3. **Check that it's not forwarded yet:**
   ```bash
   curl http://localhost:8000/posts/forwarded
   ```
   You should see an empty list `[]` or previous posts but not this one.

4. **Wait for the next 5-minute cycle or trigger manually:**
   The scheduler runs every 5 minutes automatically. Watch the logs for:
   ```
   INFO:__main__:🔍 Checking for new posts to forward...
   INFO:__main__:Found 1 posts to forward
   INFO:__main__:🚀 Immediately forwarding high-priority post: post_xxx
   INFO:__main__:✅ Post post_xxx forwarded successfully
   ```

5. **Verify the post is now forwarded:**
   ```bash
   curl http://localhost:8000/posts/forwarded
   ```

## Immediate vs Scheduled Forwarding

### Immediate Forwarding (happens instantly):
- Posts with priority ≥ 4
- Posts containing keywords: "urgent", "important", "breaking", "alert"

**Example:**
```bash
curl -X POST "http://localhost:8000/posts" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "URGENT: System Down",
       "content": "This is an urgent alert",
       "author": "Admin",
       "priority": 5
     }'
```

### Scheduled Forwarding (every 5 minutes):
- Posts with priority < 4
- Posts without priority keywords

**Example:**
```bash
curl -X POST "http://localhost:8000/posts" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Daily Report",
       "content": "Here is the daily report",
       "author": "Reporter",
       "priority": 2
     }'
```

## Continuous Testing

Use the example script to continuously generate posts:

```bash
python example.py continuous
```

This sends a new post every 30 seconds, allowing you to see both immediate and scheduled forwarding in action.

## Google Cloud Testing

Once deployed to Google Cloud Run:

1. **Replace localhost with your service URL:**
   ```bash
   export SERVICE_URL="https://your-service-url"
   ```

2. **Use the same curl commands:**
   ```bash
   curl -X POST "$SERVICE_URL/posts" \
        -H "Content-Type: application/json" \
        -d '{"title":"Test","content":"Test content","author":"Tester","priority":1}'
   ```

3. **Monitor logs:**
   ```bash
   gcloud run logs tail intelligent-driver-forwarder --platform managed --region us-central1
   ```

## Scheduler Configuration

To change the 5-minute interval, modify this line in `main.py`:

```python
scheduler.add_job(
    check_and_forward_posts,
    trigger=IntervalTrigger(minutes=5),  # Change this value
    id="post_forwarder",
    name="Check and forward posts every 5 minutes",
    replace_existing=True
)
```

For example, to check every 2 minutes: `IntervalTrigger(minutes=2)`
Or every 30 seconds: `IntervalTrigger(seconds=30)`