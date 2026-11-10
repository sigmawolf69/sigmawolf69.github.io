import requests
import json
import time
from pathlib import Path

BASE_URL = "https://animeidhentai.com/api/browse"
OUTPUT_FILE = "animeidhentai_all_videos.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

def fetch_page(page: int, max_retries: int = 3) -> dict:
    """Fetch a single page with retries."""
    url = f"{BASE_URL}?page={page}"
    
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.get(url, headers=HEADERS, timeout=30)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"  Attempt {attempt}/{max_retries} failed for page {page}: {e}")
            if attempt < max_retries:
                time.sleep(1.5 * attempt)  # increasing delay
            else:
                raise  # re-raise after all retries failed

def scrape_all():
    print("Fetching first page to get total pages...")
    first_page = fetch_page(1)
    
    total_pages = first_page.get("pages", 1)
    total_videos = first_page.get("total", 0)
    
    print(f"Total videos: {total_videos}")
    print(f"Total pages:  {total_pages}")
    
    all_videos = first_page.get("videos", [])
    
    # Fetch remaining pages
    for page in range(2, total_pages + 1):
        print(f"Fetching page {page}/{total_pages}...", end=" ", flush=True)
        
        try:
            data = fetch_page(page)
            videos = data.get("videos", [])
            all_videos.extend(videos)
            print(f"got {len(videos)} videos")
            
            # Be polite to the server
            time.sleep(0.1)
            
        except Exception as e:
            print(f"Error on page {page} after retries: {e}")
            # Continue with next page
            continue
    
    # Build final structure
    result = {
        "total": len(all_videos),
        "pages": total_pages,
        "videos": all_videos
    }
    
    # Save to file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\nDone! Saved {len(all_videos)} videos to '{OUTPUT_FILE}'")

if __name__ == "__main__":
    scrape_all()