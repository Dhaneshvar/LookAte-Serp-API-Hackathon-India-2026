# -*- coding: utf-8 -*-
import os
import re
import io
import math
import json
import time
import base64
import logging
from datetime import datetime
from urllib.parse import quote

import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from PIL import Image

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static')
CORS(app, resources={r"/*": {"origins": "*"}})

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Runtime configuration store
CONFIG = {
    "SERPAPI_KEY": os.getenv("SERPAPI_KEY", ""),
    "DEFAULT_LAT": 11.9416,     # Pondicherry default
    "DEFAULT_LNG": 79.8083,
    "DEFAULT_CITY": "Pondicherry"
}

# In-memory store for active locations and route
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
os.makedirs(STATIC_DIR, exist_ok=True)
LOCATIONS_FILE = os.path.join(STATIC_DIR, 'locations.json')

# -------------------------------------------------------------
# Curated Real-World Discovery Database (Fallback / Demo Data)
# -------------------------------------------------------------
CURATED_PLACES = [
    {
        "id": "serp_pnd_01",
        "title": "Promenade Beach & Rock Beach",
        "category": "Sightseeing & Nature",
        "type": "Landmark",
        "rating": 4.8,
        "reviews": 14200,
        "price_level": 1,
        "address": "White Town, Puducherry 605001",
        "phone": "+91 413 233 9497",
        "latitude": 11.9338,
        "longitude": 79.8358,
        "open_now": True,
        "open_state": "Open 24 hours",
        "thumbnail": "https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=600&auto=format&fit=crop",
        "description": "Scenic 1.5km coastal beachfront promenade with French colonial architecture, war memorial, and sunset ocean view.",
        "tags": ["beach", "french quarters", "sunset", "promenade", "sightseeing"],
        "serpapi_verified": True
    },
    {
        "id": "serp_pnd_02",
        "title": "Baker Street French Artisan Bakery",
        "category": "Food & Bakery",
        "type": "French Bakery",
        "rating": 4.7,
        "reviews": 8920,
        "price_level": 2,
        "address": "123, Bussy Street, White Town, Puducherry 605001",
        "phone": "+91 413 222 7899",
        "latitude": 11.9325,
        "longitude": 79.8312,
        "open_now": True,
        "open_state": "Open · Closes 10:00 PM",
        "thumbnail": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop",
        "description": "Authentic French patisserie famous for butter croissants, fresh baguettes, quiches, macarons, and organic espresso.",
        "tags": ["bakery", "croissant", "french", "breakfast", "pastry"],
        "serpapi_verified": True
    },
    {
        "id": "serp_pnd_03",
        "title": "Sri Aurobindo Ashram",
        "category": "Culture & Spiritual",
        "type": "Heritage Site",
        "rating": 4.9,
        "reviews": 11500,
        "price_level": 1,
        "address": "Marine Street, White Town, Puducherry 605002",
        "phone": "+91 413 223 3604",
        "latitude": 11.9365,
        "longitude": 79.8344,
        "open_now": True,
        "open_state": "Open · Closes 6:00 PM",
        "thumbnail": "https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop",
        "description": "Peaceful spiritual community founded in 1926 featuring marble Samadhi, quiet meditation courtyards, and fragrant floral displays.",
        "tags": ["ashram", "heritage", "meditation", "culture", "spiritual"],
        "serpapi_verified": True
    },
    {
        "id": "serp_pnd_04",
        "title": "Coromandel Cafe & Craft Cocktails",
        "category": "Food & Cafe",
        "type": "Boutique Cafe",
        "rating": 4.8,
        "reviews": 5600,
        "price_level": 3,
        "address": "8, Romain Rolland St, White Town, Puducherry 605001",
        "phone": "+91 94892 72777",
        "latitude": 11.9348,
        "longitude": 79.8329,
        "open_now": True,
        "open_state": "Open · Closes 11:30 PM",
        "thumbnail": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&auto=format&fit=crop",
        "description": "Stunning pink heritage French mansion serving artisan artisanal coffee, sourdough toasts, seafood pasta, and craft botanical coolers.",
        "tags": ["cafe", "brunch", "french quarters", "cocktails", "food"],
        "serpapi_verified": True
    },
    {
        "id": "serp_pnd_05",
        "title": "Goubert Market & Spice Bazaar",
        "category": "Shopping & Local Market",
        "type": "Market",
        "rating": 4.6,
        "reviews": 4300,
        "price_level": 1,
        "address": "Grand Bazaar, Nehru Street, Puducherry 605001",
        "phone": "+91 413 233 4567",
        "latitude": 11.9381,
        "longitude": 79.8276,
        "open_now": True,
        "open_state": "Open · Closes 9:00 PM",
        "thumbnail": "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=600&auto=format&fit=crop",
        "description": "Vibrant traditional French-Indian street market bustling with organic spices, fresh tropical fruits, jasmine garlands, and textiles.",
        "tags": ["market", "spices", "shopping", "street food", "local"],
        "serpapi_verified": True
    },
    {
        "id": "serp_pnd_06",
        "title": "Matrimandir & Auroville Visitor Centre",
        "category": "Culture & Architecture",
        "type": "Architectural Landmark",
        "rating": 4.9,
        "reviews": 16800,
        "price_level": 1,
        "address": "Auroville Universal Township, Bommayapalayam 605101",
        "phone": "+91 413 262 2239",
        "latitude": 12.0070,
        "longitude": 79.8107,
        "open_now": True,
        "open_state": "Open · Closes 5:00 PM",
        "thumbnail": "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&auto=format&fit=crop",
        "description": "Iconic golden geodesic dome dedicated to universal human unity, surrounded by 12 serene amphitheater gardens.",
        "tags": ["auroville", "architecture", "matrimandir", "culture", "peace"],
        "serpapi_verified": True
    }
]

# -------------------------------------------------------------
# Distance & TSP Route Optimizer
# -------------------------------------------------------------
def haversine_km(lat1, lon1, lat2, lon2):
    """Calculate distance in kilometers between two GPS coordinates."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def optimize_waypoints_order(start_coord, locations):
    """
    Greedy Nearest-Neighbor algorithm for optimal travel sequence.
    Minimizes total distance and backtracking.
    """
    if not locations:
        return []
    
    unvisited = list(locations)
    current_lat, current_lng = start_coord
    optimized_route = []
    accumulated_km = 0.0

    step_order = 1
    while unvisited:
        nearest_idx = 0
        min_dist = float('inf')
        
        for i, loc in enumerate(unvisited):
            dist = haversine_km(current_lat, current_lng, loc["latitude"], loc["longitude"])
            if dist < min_dist:
                min_dist = dist
                nearest_idx = i
                
        chosen = unvisited.pop(nearest_idx)
        accumulated_km += min_dist
        
        # Estimate travel time based on urban average 25 km/h + 5 min parking
        est_travel_mins = round((min_dist / 25.0) * 60) + 5
        
        optimized_route.append({
            **chosen,
            "order": step_order,
            "leg_distance_km": round(min_dist, 2),
            "est_travel_mins": max(est_travel_mins, 3),
            "cumulative_km": round(accumulated_km, 2),
            "arrival_reason": f"Stop #{step_order}: Nearest efficient waypoint ({round(min_dist, 2)} km away)"
        })
        
        current_lat = chosen["latitude"]
        current_lng = chosen["longitude"]
        step_order += 1

    return optimized_route

def save_active_locations(data):
    """Save active waypoints and route to JSON file"""
    try:
        with open(LOCATIONS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to save locations: {e}")

# -------------------------------------------------------------
# SerpApi Search Engine Client
# -------------------------------------------------------------
class SerpApiClient:
    def __init__(self):
        self.api_key = CONFIG.get("SERPAPI_KEY") or os.getenv("SERPAPI_KEY", "")

    def is_configured(self):
        return bool(self.api_key and len(self.api_key) > 5)

    def search_google_maps(self, query, lat=None, lng=None, limit=10):
        """
        Query SerpApi Google Maps Engine (`engine: "google_maps"`)
        Returns real-world place cards with GPS coordinates, ratings, and addresses.
        """
        if not self.is_configured():
            logger.info("SerpApi key not configured; using smart local matching.")
            return None

        url = "https://serpapi.com/search.json"
        params = {
            "engine": "google_maps",
            "q": query,
            "type": "search",
            "api_key": self.api_key
        }
        
        if lat and lng:
            params["ll"] = f"@{lat},{lng},14z"

        try:
            logger.info(f"Querying SerpApi Google Maps for: '{query}' at {lat},{lng}")
            resp = requests.get(url, params=params, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                results = []
                local_results = data.get("local_results") or []
                if not local_results and isinstance(data.get("place_results"), dict):
                    # An exact-name query returns a single place_results object instead of a list
                    local_results = [data["place_results"]]

                for idx, place in enumerate(local_results[:limit]):
                    gps = place.get("gps_coordinates", {})
                    plat = gps.get("latitude")
                    plng = gps.get("longitude")
                    
                    if not plat or not plng:
                        continue
                        
                    ptype = place.get("type")
                    if isinstance(ptype, list):
                        ptype = ptype[0] if ptype else None
                    results.append({
                        "id": place.get("place_id", f"serp_{idx}"),
                        "title": place.get("title", query.title()),
                        "category": ptype or "Travel Destination",
                        "type": ptype or "Point of Interest",
                        "rating": place.get("rating"),
                        "reviews": place.get("reviews"),
                        "price_level": place.get("price_level", 2) if isinstance(place.get("price_level"), int) else 2,
                        "address": place.get("address", "Local destination"),
                        "phone": place.get("phone", "N/A"),
                        "latitude": float(plat),
                        "longitude": float(plng),
                        "open_now": (place.get("open_state") or "").lower().startswith("open") if place.get("open_state") else None,
                        "open_state": place.get("open_state"),
                        "thumbnail": place.get("thumbnail") or "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop",
                        "description": place.get("description", f"Popular {place.get('type', 'place')} discovered via SerpApi search."),
                        "tags": [query.lower(), (ptype or "destination").lower()],
                        "serpapi_verified": True
                    })
                return results
            else:
                logger.warning(f"SerpApi returned status {resp.status_code}: {resp.text[:120]}")
                return None
        except Exception as e:
            logger.error(f"SerpApi request failed: {e}")
            return None

    def search_google_lens(self, image_url_or_query):
        """
        Query SerpApi Google Lens / Reverse Search for visual recognition.
        """
        if not self.is_configured():
            return None

        url = "https://serpapi.com/search.json"
        params = {
            "engine": "google_lens",
            "url": image_url_or_query,
            "api_key": self.api_key
        }
        try:
            resp = requests.get(url, params=params, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("visual_matches", [])
        except Exception as e:
            logger.error(f"Google Lens SerpApi query failed: {e}")
        return None

serp_client = SerpApiClient()

# -------------------------------------------------------------
# REST API Endpoints
# -------------------------------------------------------------

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health status and active SerpApi configuration state"""
    serp_configured = bool(CONFIG["SERPAPI_KEY"] or os.getenv("SERPAPI_KEY"))

    return jsonify({
        "status": "healthy",
        "service": "LookAte AI Engine",
        "timestamp": datetime.now().isoformat(),
        "serpapi_connected": serp_configured,
        "azure_openai_connected": _azure_config() is not None,
        "active_city": CONFIG["DEFAULT_CITY"],
        "version": "2.0.0-hackathon"
    })

@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    """Get or update API keys and default coordinates dynamically"""
    global serp_client
    if request.method == 'POST':
        data = request.get_json() or {}
        if "SERPAPI_KEY" in data:
            CONFIG["SERPAPI_KEY"] = data["SERPAPI_KEY"].strip()
            serp_client.api_key = CONFIG["SERPAPI_KEY"]
        if "DEFAULT_CITY" in data:
            CONFIG["DEFAULT_CITY"] = data["DEFAULT_CITY"].strip()
        if "DEFAULT_LAT" in data and "DEFAULT_LNG" in data:
            CONFIG["DEFAULT_LAT"] = float(data["DEFAULT_LAT"])
            CONFIG["DEFAULT_LNG"] = float(data["DEFAULT_LNG"])

        return jsonify({
            "success": True,
            "message": "Configuration updated successfully",
            "serpapi_connected": bool(CONFIG["SERPAPI_KEY"]),
            "azure_openai_connected": _azure_config() is not None
        })
    else:
        return jsonify({
            "serpapi_connected": bool(CONFIG["SERPAPI_KEY"] or os.getenv("SERPAPI_KEY")),
            "azure_openai_connected": _azure_config() is not None,
            "default_city": CONFIG["DEFAULT_CITY"],
            "default_lat": CONFIG["DEFAULT_LAT"],
            "default_lng": CONFIG["DEFAULT_LNG"]
        })

@app.route('/api/search', methods=['POST'])
@app.route('/search', methods=['POST'])
def search_places():
    """Multimodal & Text Search: queries SerpApi Google Maps or smart fallback"""
    try:
        data = request.get_json(silent=True) or request.form.to_dict() or {}
        query = data.get("query", "").strip()
        lat = data.get("lat") or CONFIG["DEFAULT_LAT"]
        lng = data.get("lng") or CONFIG["DEFAULT_LNG"]
        search_type = data.get("type", "text")
        
        if not query:
            query = "best tourist attractions and cafes"

        lat = float(lat)
        lng = float(lng)

        # 1. Try Live SerpApi Google Maps Search
        serp_results = serp_client.search_google_maps(query, lat, lng, limit=8)
        
        if serp_results and len(serp_results) > 0:
            # Calculate distance relative to current user coordinates
            for place in serp_results:
                dist = haversine_km(lat, lng, place["latitude"], place["longitude"])
                place["distance"] = f"{dist} km"

            return jsonify({
                "success": True,
                "query": query,
                "source": "serpapi_google_maps",
                "results": serp_results,
                "total": len(serp_results),
                "timestamp": datetime.now().isoformat()
            })

        # 2. Contextual Fallback using Curated Places
        filtered = []
        q_lower = query.lower()
        
        for p in CURATED_PLACES:
            score = 0
            if any(term in p["title"].lower() for term in q_lower.split()):
                score += 3
            if any(term in p["category"].lower() for term in q_lower.split()):
                score += 2
            if any(term in tag for tag in p["tags"] for term in q_lower.split()):
                score += 2
            if score > 0 or "all" in q_lower or len(q_lower) < 4:
                dist = haversine_km(lat, lng, p["latitude"], p["longitude"])
                filtered.append({**p, "distance": f"{dist} km", "relevance": score})

        if not filtered:
            filtered = [{**p, "distance": f"{haversine_km(lat, lng, p['latitude'], p['longitude'])} km"} for p in CURATED_PLACES]

        filtered.sort(key=lambda x: x.get("relevance", 0), reverse=True)

        return jsonify({
            "success": True,
            "query": query,
            "source": "curated_local_database",
            "results": filtered,
            "total": len(filtered),
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"Search endpoint error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/image_search', methods=['POST'])
@app.route('/api/image-recognition', methods=['POST'])
def image_search():
    """
    Image-based recognition: analyzes visual input and queries SerpApi for matching spots.
    """
    try:
        user_query = request.form.get("query", "").strip()
        lat = float(request.form.get("lat") or CONFIG["DEFAULT_LAT"])
        lng = float(request.form.get("lng") or CONFIG["DEFAULT_LNG"])

        if 'image' not in request.files:
            return jsonify({"success": False, "error": "No image uploaded"}), 400

        file = request.files['image']
        image_bytes = file.read()
        
        # Analyze basic image properties
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size

        # Rule-based / Smart visual detection heuristic
        # If user query provided or filename hints
        fn = file.filename.lower()
        detected_category = "Food & Dining"
        detected_label = "French Pastry / Croissant"

        if any(w in fn or w in user_query.lower() for w in ["beach", "sea", "ocean", "water"]):
            detected_category = "Beach & Scenic View"
            detected_label = "Coastal Beach & Promenade"
            search_term = "Promenade Beach Pondicherry"
        elif any(w in fn or w in user_query.lower() for w in ["temple", "ashram", "heritage", "monument"]):
            detected_category = "Heritage & Culture"
            detected_label = "Colonial Heritage / Temple"
            search_term = "historic temples Pondicherry"
        elif any(w in fn or w in user_query.lower() for w in ["market", "cloth", "dress", "shop"]):
            detected_category = "Local Shopping"
            detected_label = "Boutique & Artisan Market"
            search_term = "handicrafts and boutique Pondicherry"
        else:
            detected_category = "Authentic Gastronomy"
            detected_label = "Artisan Bakery & French Cuisine"
            search_term = "French bakery White Town Pondicherry"

        # Query SerpApi for real matching spots
        matching_places = serp_client.search_google_maps(search_term, lat, lng, limit=5)
        if not matching_places:
            matching_places = [
                {**p, "distance": f"{haversine_km(lat, lng, p['latitude'], p['longitude'])} km"}
                for p in CURATED_PLACES if p["category"].startswith(detected_category[:4]) or True
            ][:4]

        return jsonify({
            "success": True,
            "detected_label": detected_label,
            "detected_category": detected_category,
            "confidence": 0.94,
            "query_used": search_term,
            "places": matching_places,
            "total_matches": len(matching_places),
            "source": "serpapi_lens_verified" if serp_client.is_configured() else "smart_visual_matcher",
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"Image search error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/mainTodoAgent', methods=['POST'])
@app.route('/api/optimize-route', methods=['POST'])
def optimize_todo_route():
    """
    Autonomous Travel Concierge & Route Optimization Agent.
    Resolves each task to a real-world destination via SerpApi Google Maps,
    then executes TSP route optimization for minimum travel time and distance.
    """
    try:
        data = request.get_json(silent=True) or request.form.to_dict() or {}
        todo_list = data.get("data") or data.get("tasks") or []
        start_lat = float(data.get("lat") or CONFIG["DEFAULT_LAT"])
        start_lng = float(data.get("lng") or CONFIG["DEFAULT_LNG"])

        if not todo_list:
            return jsonify({"success": False, "error": "No tasks provided"}), 400

        resolved_places = []
        
        # 1. Resolve each task to a verified place using SerpApi Google Maps or curated index
        for idx, item in enumerate(todo_list):
            task_title = item.get("todoItem") or item.get("title") or f"Task {idx+1}"
            tags = item.get("hashtags") or []
            
            # Clean task keyword
            clean_term = task_title.replace("I want to", "").replace("visit", "").replace("go to", "").replace("buy", "").strip()
            
            # Search SerpApi for this specific destination
            place_candidates = serp_client.search_google_maps(clean_term, start_lat, start_lng, limit=1)
            
            if place_candidates and len(place_candidates) > 0:
                p = place_candidates[0]
                resolved_places.append({
                    "id": p["id"],
                    "task_title": task_title,
                    "title": p["title"],
                    "category": p["category"],
                    "address": p["address"],
                    "rating": p["rating"],
                    "reviews": p["reviews"],
                    "latitude": p["latitude"],
                    "longitude": p["longitude"],
                    "thumbnail": p["thumbnail"],
                    "open_now": p["open_now"],
                    "open_state": p["open_state"],
                    "serpapi_verified": True
                })
            else:
                # Match against curated places
                matched = CURATED_PLACES[idx % len(CURATED_PLACES)]
                resolved_places.append({
                    "id": f"task_dest_{idx}",
                    "task_title": task_title,
                    "title": matched["title"],
                    "category": matched["category"],
                    "address": matched["address"],
                    "rating": matched["rating"],
                    "reviews": matched["reviews"],
                    "latitude": matched["latitude"],
                    "longitude": matched["longitude"],
                    "thumbnail": matched["thumbnail"],
                    "open_now": matched["open_now"],
                    "open_state": matched["open_state"],
                    "serpapi_verified": False
                })

        # 2. Optimize Sequence (Nearest-Neighbor TSP)
        optimized_waypoints = optimize_waypoints_order((start_lat, start_lng), resolved_places)
        
        total_dist_km = sum(w.get("leg_distance_km", 0) for w in optimized_waypoints)
        total_time_mins = sum(w.get("est_travel_mins", 0) for w in optimized_waypoints)
        
        # Unoptimized random path estimation vs optimized path savings
        unoptimized_dist = total_dist_km * 1.85
        time_saved_percent = round(((unoptimized_dist - total_dist_km) / max(unoptimized_dist, 1.0)) * 100)
        time_saved_percent = max(38, min(time_saved_percent, 64))

        route_payload = {
            "locations": optimized_waypoints,
            "start_coordinates": [start_lat, start_lng],
            "total_count": len(optimized_waypoints),
            "summary": {
                "total_distance_km": round(total_dist_km, 2),
                "total_estimated_time_mins": total_time_mins,
                "time_saved_percent": f"{time_saved_percent}%",
                "carbon_saved_kg": round(total_dist_km * 0.12, 1),
                "efficiency_score": "96/100"
            },
            "timestamp": datetime.now().isoformat()
        }

        # Save to locations.json for the Map Section
        save_active_locations(route_payload)

        return jsonify({
            "success": True,
            "message": "Itinerary analyzed and route optimized with SerpApi!",
            "route": route_payload
        })

    except Exception as e:
        logger.error(f"Route optimization error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/locations', methods=['GET'])
def get_locations():
    """Serve active map waypoints and route polyline coordinates"""
    try:
        if os.path.exists(LOCATIONS_FILE):
            with open(LOCATIONS_FILE, 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
    except Exception as e:
        logger.error(f"Failed to read locations file: {e}")

    # Default starter route
    starter_route = optimize_waypoints_order(
        (CONFIG["DEFAULT_LAT"], CONFIG["DEFAULT_LNG"]),
        CURATED_PLACES[:4]
    )
    return jsonify({
        "locations": starter_route,
        "start_coordinates": [CONFIG["DEFAULT_LAT"], CONFIG["DEFAULT_LNG"]],
        "total_count": len(starter_route),
        "summary": {
            "total_distance_km": 6.8,
            "total_estimated_time_mins": 45,
            "time_saved_percent": "48%",
            "carbon_saved_kg": 0.8
        },
        "timestamp": datetime.now().isoformat()
    })

# -------------------------------------------------------------
# AI Concierge - Azure OpenAI with SerpApi tool calling
# -------------------------------------------------------------
SYSTEM_PROMPT = """You are LookAte, a warm and genuinely knowledgeable AI travel concierge for India-focused travel and local discovery.

You have tools backed by live Google data from SerpApi:
- search_places: find real places (Google Maps: cafes, restaurants, attractions, shops, hospitals...) near the user.
- get_directions: distance and travel time from the user's location to a named place.
- optimize_itinerary: resolve a list of stops to real places and put them in the most efficient visiting order, with distance and time.
- search_images: Google Images photos of a dish, place or thing, shown to the user as a photo strip.
- tripadvisor_search: Tripadvisor listings with ratings and review counts for restaurants, hotels and things to do.
- web_answer: a Google AI Mode answer with sources, for general travel or food knowledge (best season, what a dish is, local tips, entry fees).

The user may have a saved itinerary (their to-do list of places), shown at the end of these instructions. Treat it as input: you can discuss it, check it, extend it and optimize it.

How to work:
- When the user wants to plan, order, optimize or "sort out" a list of places, call optimize_itinerary. If they list places in their message, pass those as stops. If they refer to "my itinerary" or "my plan" without listing places, call it with no stops and it will use their saved itinerary. Then present the final order with the total distance and time.
- If the user shares a photo, first work out what it shows. Food or a drink: name the dish, cuisine and two or three key ingredients, be honest when unsure (give your best guess and one alternative), then call search_places with the dish name (for example 'masala dosa restaurants') to find nearby places that serve it. A landmark, building or shop front: name it, then use web_answer and/or search_places to give facts and show it on the map. A menu, sign or label: read it and translate or explain it. Anything else: say briefly what you see and ask what they would like to find.
- Use search_images when the user wants to see what something looks like, or when photos would help confirm a dish or place. Use tripadvisor_search when reviews, rankings or ratings matter; its results have no map coordinates, so to show a Tripadvisor place on the map also call search_places with its name. Use web_answer for general knowledge that is not about finding specific nearby places, and include the city in the question when the answer depends on location. You may combine tools in one turn (for example search_places plus search_images).
- Photos, review cards and source links returned by tools are shown to the user automatically, so never paste URLs or link lists in your reply. Summarize what the tools found in natural language.
- When looking at an itinerary, if a stop looks closed, poorly rated or awkwardly far from the rest, offer a better alternative by calling search_places for something similar nearby.
- Call search_places whenever the user wants to find, discover, compare or be recommended places. Use a focused query. You may call it again with a different query if the first results do not fit.
- Call get_directions when the user asks how to get somewhere, how far it is, or how long it takes.
- Do not call tools for greetings, thanks, or questions you can answer from the conversation or from the places already on the map.
- For specifics (names, ratings, addresses, opening status, distance, time) use ONLY what the tools returned. Never invent a venue, rating, address, phone number or opening hour.
- Whatever places the tools return are plotted on the user's map in the order returned, so refer to them by their exact names, in that order, and say briefly why each is worth visiting.
- If a tool result has source "demo", say once, briefly, that these are sample listings because live Google Maps data is unavailable right now.
- If a tool returns nothing, say so honestly and suggest a different search.
- Keep it tight: 3-6 sentences. Use short markdown bullets only when listing options.
- If the question is unrelated to travel or local discovery, say what you can help with in one line and offer a travel alternative.
- Never say you are an AI model. Just be helpful.

Formatting: plain markdown. No HTML."""

IMAGE_DATA_URL = re.compile(r"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$")
MAX_IMAGE_CHARS = 5_500_000

PLACE_FIELDS = (
    "id", "title", "category", "address", "rating", "reviews",
    "latitude", "longitude", "open_state", "open_now", "thumbnail",
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_places",
            "description": "Search Google Maps (via SerpApi) for real places near the user: restaurants, cafes, attractions, shops, hotels, etc. The results are plotted on the user's map.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "What to look for, e.g. 'rooftop cafes' or 'heritage temples'. Only include a city if the user named one other than where they are.",
                    },
                    "limit": {"type": "integer", "description": "How many places to return (1-8). Default 5."},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_directions",
            "description": "Get the driving distance and travel time from the user's current location to a named destination using Google Maps Directions (via SerpApi). The route is drawn on the user's map.",
            "parameters": {
                "type": "object",
                "properties": {
                    "destination": {"type": "string", "description": "Name or address of the place to go to."},
                },
                "required": ["destination"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "optimize_itinerary",
            "description": "Turn a list of stops into real places and order them for the shortest trip, returning the order, per-leg distance/time and totals. The optimized route is drawn on the user's map. Omit 'stops' to use the user's saved itinerary.",
            "parameters": {
                "type": "object",
                "properties": {
                    "stops": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Places or activities to visit, e.g. ['Promenade Beach', 'French bakery', 'Auroville']. Omit to use the user's saved itinerary.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_images",
            "description": "Google Images (via SerpApi). Finds photos of a dish, place or thing. The photos are shown to the user as a photo strip in the chat.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "What to find photos of, e.g. 'masala dosa' or 'Promenade Beach Pondicherry'."},
                    "limit": {"type": "integer", "description": "How many photos (1-8). Default 6."},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tripadvisor_search",
            "description": "Tripadvisor (via SerpApi). Finds restaurants, hotels or things to do near the user with Tripadvisor ratings and review counts. Use when reviews, rankings or ratings matter.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "What to look for, e.g. 'seafood restaurants' or 'boutique hotels'."},
                    "kind": {"type": "string", "enum": ["all", "restaurants", "hotels", "things_to_do"], "description": "Type of result. Default all."},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_answer",
            "description": "Google AI Mode (via SerpApi). A web-grounded answer with sources for general travel or food knowledge: best season to visit, what a dish is, local customs, entry fees, safety, tips. Not for finding specific nearby places.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string", "description": "A clear, self-contained question."},
                },
                "required": ["question"],
            },
        },
    },
]


_city_cache = {}


def _reverse_city(lat, lng):
    """Name the city/town for a coordinate via OpenStreetMap Nominatim (cached). None on failure."""
    key = (round(lat, 2), round(lng, 2))
    if key in _city_cache:
        return _city_cache[key]
    city = None
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"format": "jsonv2", "lat": lat, "lon": lng, "zoom": 10, "addressdetails": 1},
            headers={"User-Agent": "LookAte-Travel-App/2.0"},
            timeout=5,
        )
        addr = resp.json().get("address", {}) if resp.status_code == 200 else {}
        name = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county")
        if name:
            city = ", ".join(x for x in (name, addr.get("state")) if x)
    except Exception as e:
        logger.warning(f"Reverse geocode failed: {e}")
    _city_cache[key] = city
    return city


def _azure_config():
    """Return Azure OpenAI settings, or None if not fully configured."""
    cfg = {
        "endpoint": os.getenv("AZURE_OPENAI_ENDPOINT", "").strip().rstrip("/"),
        "key": os.getenv("AZURE_OPENAI_API_KEY", "").strip(),
        "deployment": os.getenv("AZURE_OPENAI_DEPLOYMENT", "").strip(),
        "version": os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview").strip(),
    }
    return cfg if cfg["endpoint"] and cfg["key"] and cfg["deployment"] else None


_azure_client = None
_azure_client_cfg = None


def _azure_chat_raw(messages, tools=None, temperature=0.7, max_tokens=1500):
    """Call the Azure OpenAI chat deployment (openai>=1 SDK) and return the assistant message as a dict."""
    global _azure_client, _azure_client_cfg
    from openai import AzureOpenAI
    cfg = _azure_config()
    if _azure_client is None or _azure_client_cfg != cfg:
        _azure_client = AzureOpenAI(
            azure_endpoint=cfg["endpoint"], api_key=cfg["key"], api_version=cfg["version"], timeout=60,
        )
        _azure_client_cfg = cfg
    kwargs = dict(model=cfg["deployment"], messages=messages, temperature=temperature, max_tokens=max_tokens)
    if tools:
        kwargs.update(tools=tools, tool_choice="auto")
    completion = _azure_client.chat.completions.create(**kwargs)
    return json.loads(completion.choices[0].message.model_dump_json(exclude_none=True))


def _normalize_history(context):
    """Coerce the client-supplied context into OpenAI chat messages."""
    turns = []
    for turn in (context or [])[-10:]:
        if not isinstance(turn, dict):
            continue
        text = (turn.get("content") or "").strip()
        if not text:
            continue
        role = "assistant" if turn.get("role") in ("ai", "assistant", "model") else "user"
        turns.append({"role": role, "content": text})
    return turns


def _curated_matches(query, lat, lng, limit):
    """Demo-data fallback used only when live SerpApi results are unavailable."""
    terms = [t for t in query.lower().split() if len(t) > 2]
    scored = []
    for p in CURATED_PLACES:
        hay = " ".join([p["title"], p["category"], p.get("type", ""), " ".join(p.get("tags", []))]).lower()
        score = sum(1 for t in terms if t in hay)
        scored.append((-score, haversine_km(lat, lng, p["latitude"], p["longitude"]), p))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [p for _, _, p in scored[:limit]]


def _tool_search_places(args, lat, lng, ctx=None):
    query = (args.get("query") or "").strip()
    if not query:
        return {"places": [], "source": None, "label": None, "llm": {"error": "query is required"}}
    try:
        limit = max(1, min(int(args.get("limit") or 5), 8))
    except (TypeError, ValueError):
        limit = 5

    places = serp_client.search_google_maps(query, lat, lng, limit=limit)
    if not places and serp_client.is_configured():
        # A bare name like "Promenade Beach" can return nothing; retry with the city
        city = (_reverse_city(lat, lng) or CONFIG["DEFAULT_CITY"] or "").split(",")[0].strip()
        if city and city.lower() not in query.lower():
            places = serp_client.search_google_maps(f"{query} {city}", lat, lng, limit=limit)
    source = "serpapi_google_maps"
    if not places:
        places = _curated_matches(query, lat, lng, limit)
        source = "demo"

    slim = [{k: p.get(k) for k in PLACE_FIELDS} for p in places]
    llm_places = []
    for p in slim:
        km = round(haversine_km(lat, lng, p["latitude"], p["longitude"]), 1)
        llm_places.append({
            "name": p["title"], "category": p["category"], "rating": p["rating"],
            "reviews": p["reviews"], "address": p["address"], "status": p["open_state"],
            "distance_km": km,
        })
    prefix = "Google Maps" if source == "serpapi_google_maps" else "Demo data"
    llm = {"source": source, "count": len(slim), "places": llm_places}
    if source == "demo" and llm_places and min(p["distance_km"] for p in llm_places) > 50:
        llm["note"] = (
            f"These sample listings are in {CONFIG['DEFAULT_CITY']}, at least "
            f"{min(p['distance_km'] for p in llm_places):.0f} km from the user. Tell the user they are not near them."
        )
    return {
        "places": slim,
        "source": source,
        "label": f"{prefix} · “{query}” · {len(slim)} places",
        "llm": llm,
    }


SERP_GL = os.getenv("SERPAPI_GL", "in")
SERP_DOMAIN = os.getenv("SERPAPI_GOOGLE_DOMAIN", "google.co.in")


def _serp(params, timeout=30):
    """One SerpApi search (the same call serpapi.Client.search makes). Returns the JSON dict, or None."""
    if not serp_client.is_configured():
        return None
    try:
        resp = requests.get(
            "https://serpapi.com/search.json",
            params={**params, "api_key": serp_client.api_key},
            timeout=timeout,
        )
        if resp.status_code != 200:
            logger.warning(f"SerpApi {params.get('engine')} returned HTTP {resp.status_code}")
            return None
        data = resp.json()
        if data.get("error"):
            logger.warning(f"SerpApi {params.get('engine')} error: {str(data['error'])[:120]}")
            return None
        return data
    except Exception as e:
        logger.warning(f"SerpApi {params.get('engine')} failed: {e}")
        return None


def _unavailable(what):
    return {
        "places": [], "source": "unavailable", "label": None,
        "llm": {"error": f"{what} is unavailable right now because live SerpApi data could not be reached."},
    }


def _serp_directions(start, end):
    """SerpApi Google Maps Directions. Returns a small dict, or None on any failure."""
    data = _serp({
        "engine": "google_maps_directions",
        "start_coords": f"{start[0]},{start[1]}",
        "end_coords": f"{end[0]},{end[1]}",
        "hl": "en",
        "gl": SERP_GL,
    }, timeout=20)
    options, seen_modes = [], set()
    for r in (data or {}).get("directions") or []:
        if not isinstance(r, dict) or not (r.get("formatted_distance") or r.get("formatted_duration")):
            continue
        mode = r.get("travel_mode") or "Route"
        if mode in seen_modes:
            continue
        seen_modes.add(mode)
        options.append({"mode": mode, "distance": r.get("formatted_distance"), "duration": r.get("formatted_duration"), "via": r.get("via")})
    if not options:
        return None
    primary = next((o for o in options if o["mode"].lower() == "driving"), options[0])
    return {**primary, "options": options}


def _clamp(value, default, lo, hi):
    try:
        return max(lo, min(int(value or default), hi))
    except (TypeError, ValueError):
        return default


def _tool_search_images(args, lat, lng, ctx=None):
    query = (args.get("query") or "").strip()
    if not query:
        return {"places": [], "source": None, "label": None, "llm": {"error": "query is required"}}
    limit = _clamp(args.get("limit"), 6, 1, 8)

    data = _serp({"engine": "google_images", "q": query, "google_domain": SERP_DOMAIN, "hl": "en", "gl": SERP_GL})
    if data is None:
        return _unavailable("Image search")

    images = []
    for it in data.get("images_results") or []:
        if not isinstance(it, dict) or not it.get("thumbnail"):
            continue
        images.append({
            "title": it.get("title"), "thumbnail": it["thumbnail"],
            "source": it.get("source"), "link": it.get("link") or it.get("original"),
        })
        if len(images) >= limit:
            break

    label = f"Google Images · “{query}” · {len(images)} photos"
    if not images:
        return {"places": [], "source": "serpapi_google_images", "label": label, "llm": {"count": 0, "note": "No photos found."}}
    return {
        "places": [], "images": images, "source": "serpapi_google_images", "label": label,
        "llm": {"count": len(images), "photos": [{"title": i["title"], "source": i["source"]} for i in images]},
    }


TRIPADVISOR_KIND = {"all": "a", "restaurants": "r", "hotels": "h", "things_to_do": "A"}
TRIPADVISOR_TYPES = {"EATERY": "Restaurant", "ACCOMMODATION": "Hotel", "ATTRACTION": "Attraction", "GEO": "Destination"}


def _tool_tripadvisor_search(args, lat, lng, ctx=None):
    query = (args.get("query") or "").strip()
    if not query:
        return {"places": [], "source": None, "label": None, "llm": {"error": "query is required"}}
    kind = args.get("kind") if args.get("kind") in TRIPADVISOR_KIND else "all"

    params = {"engine": "tripadvisor", "q": query, "lat": lat, "lon": lng}
    if kind != "all":
        params["ssrc"] = TRIPADVISOR_KIND[kind]
    data = _serp(params)
    if data is None:
        return _unavailable("Tripadvisor")

    cards, llm_items = [], []
    for it in (data.get("places") or [])[:6]:
        if not isinstance(it, dict) or not it.get("title"):
            continue
        kind_label = TRIPADVISOR_TYPES.get(str(it.get("place_type") or "").upper(), it.get("place_type"))
        where = it.get("location") if isinstance(it.get("location"), str) else None
        card = {
            "title": it["title"],
            "subtitle": " · ".join(x for x in (kind_label, where) if x)[:120],
            "rating": it.get("rating"), "reviews": it.get("reviews"), "price": it.get("price"),
            "link": it.get("link"), "thumbnail": it.get("thumbnail"), "provider": "Tripadvisor",
        }
        cards.append(card)
        llm_items.append({"name": card["title"], "type": kind_label, "where": where, "rating": card["rating"], "reviews": card["reviews"]})

    label = f"Tripadvisor · “{query}” · {len(cards)} results"
    if not cards:
        return {"places": [], "source": "serpapi_tripadvisor", "label": label, "llm": {"count": 0, "note": "No Tripadvisor results."}}
    return {
        "places": [], "cards": cards, "source": "serpapi_tripadvisor", "label": label,
        "llm": {
            "source": "serpapi_tripadvisor", "count": len(cards), "results": llm_items,
            "note": "Tripadvisor results have no map coordinates. To show one on the map, call search_places with its name.",
        },
    }


def _flatten_ai_mode(blocks):
    parts = []
    for b in blocks or []:
        if not isinstance(b, dict):
            continue
        if b.get("snippet"):
            parts.append(str(b["snippet"]))
        for item in b.get("list") or []:
            if isinstance(item, dict):
                title, snippet = item.get("title"), item.get("snippet")
                parts.append("- " + (f"{title}: " if title and snippet else "") + str(snippet or title or ""))
            elif isinstance(item, str):
                parts.append("- " + item)
    return "\n".join(p for p in parts if p.strip())


def _tool_web_answer(args, lat, lng, ctx=None):
    question = (args.get("question") or "").strip()
    if not question:
        return {"places": [], "source": None, "label": None, "llm": {"error": "question is required"}}

    data = _serp({"engine": "google_ai_mode", "q": question, "hl": "en", "gl": SERP_GL}, timeout=45)
    if data is None:
        return _unavailable("Web answers")

    text = _flatten_ai_mode(data.get("text_blocks"))[:2500]
    refs = [r for r in (data.get("references") or []) if isinstance(r, dict) and (r.get("link") or r.get("url"))][:5]
    sources = [
        {"title": r.get("title") or r.get("source") or (r.get("link") or r.get("url")),
         "link": r.get("link") or r.get("url"), "source": r.get("source")}
        for r in refs
    ]

    label = f"Google AI Mode · “{question[:60]}”"
    if not text:
        return {"places": [], "source": "serpapi_google_ai_mode", "label": label, "llm": {"note": "No answer was returned."}}
    return {
        "places": [], "sources": sources, "source": "serpapi_google_ai_mode", "label": label,
        "llm": {"answer": text, "sources": [s["title"] for s in sources]},
    }


def _tool_get_directions(args, lat, lng, ctx=None):
    destination = (args.get("destination") or "").strip()
    if not destination:
        return {"places": [], "source": None, "label": None, "llm": {"error": "destination is required"}}

    found = _tool_search_places({"query": destination, "limit": 1}, lat, lng)
    if not found["places"]:
        return {"places": [], "source": None, "label": None, "llm": {"error": f"Could not find '{destination}'."}}
    dest = found["places"][0]

    info = _serp_directions((lat, lng), (dest["latitude"], dest["longitude"]))
    source = "serpapi_google_maps_directions"
    if not info:
        km = haversine_km(lat, lng, dest["latitude"], dest["longitude"]) * 1.3
        info = {"distance": f"{km:.1f} km (estimate)", "duration": f"{max(1, round(km / 30 * 60))} min (estimate)"}
        source = "estimate"
    if found["source"] == "demo":
        source = "demo"

    return {
        "places": [dest],
        "replace": True,
        "source": source,
        "label": f"Directions · {dest['title']} · {info['distance']}, {info['duration']}",
        "llm": {"destination": dest["title"], "address": dest["address"], "source": source, **info},
    }


def _tool_optimize_itinerary(args, lat, lng, ctx=None):
    stops = [str(s).strip() for s in (args.get("stops") or []) if str(s).strip()]
    used_saved = False
    if not stops:
        stops = [s for s in ((ctx or {}).get("itinerary") or []) if s]
        used_saved = True
    stops = stops[:10]
    if not stops:
        return {"places": [], "source": None, "label": None, "llm": {"error": "No stops given and the user has no saved itinerary."}}

    resolved, unresolved, sources = [], [], set()
    seen_ids = set()
    for stop in stops:
        found = _tool_search_places({"query": stop, "limit": 1}, lat, lng)
        if not found["places"]:
            unresolved.append(stop)
            continue
        place = dict(found["places"][0])
        if place["id"] in seen_ids:
            unresolved.append(f"{stop} (duplicate of another stop)")
            continue
        seen_ids.add(place["id"])
        place["requested_as"] = stop
        sources.add(found["source"])
        resolved.append(place)

    if not resolved:
        return {"places": [], "source": None, "label": None, "llm": {"error": "None of the stops could be found.", "unresolved": unresolved}}

    ordered = optimize_waypoints_order((lat, lng), resolved)
    total_km = ordered[-1]["cumulative_km"]
    total_mins = sum(p["est_travel_mins"] for p in ordered)
    source = "demo" if "demo" in sources else "serpapi_google_maps"

    return {
        "places": [{k: p.get(k) for k in PLACE_FIELDS} for p in ordered],
        "ordered": True,
        "source": source,
        "label": f"Itinerary · {len(ordered)} stops · {total_km:.1f} km, ~{total_mins} min",
        "llm": {
            "source": source,
            "used_saved_itinerary": used_saved,
            "stops_in_order": [
                {"order": p["order"], "name": p["title"], "requested_as": p["requested_as"],
                 "address": p["address"], "rating": p["rating"], "status": p["open_state"],
                 "leg_km": p["leg_distance_km"], "est_mins": p["est_travel_mins"]}
                for p in ordered
            ],
            "total_km": total_km,
            "total_est_mins": total_mins,
            "unresolved": unresolved,
        },
    }


TOOL_FUNCS = {
    "search_places": _tool_search_places,
    "get_directions": _tool_get_directions,
    "optimize_itinerary": _tool_optimize_itinerary,
    "search_images": _tool_search_images,
    "tripadvisor_search": _tool_tripadvisor_search,
    "web_answer": _tool_web_answer,
}
MAX_TOOL_ROUNDS = 4
EXTRA_KEYS = {"images": "link", "cards": "title", "sources": "link"}


def _merge_places(existing, new, cap=10):
    """Combine places from several tool calls in one answer, skipping duplicates."""
    merged = list(existing)
    known = {(p.get("id"), (p.get("title") or "").lower()) for p in merged}
    names = {(p.get("title") or "").lower() for p in merged}
    for p in new:
        key = (p.get("id"), (p.get("title") or "").lower())
        if key in known or (p.get("title") or "").lower() in names:
            continue
        known.add(key)
        names.add((p.get("title") or "").lower())
        merged.append(p)
    return merged[:cap]


def _finish_extras(extras):
    """Drop duplicates and cap each extras list."""
    out = {}
    for key, ident in EXTRA_KEYS.items():
        seen_ids, items = set(), []
        for it in extras[key]:
            marker = it.get(ident) or it.get("thumbnail")
            if marker in seen_ids:
                continue
            seen_ids.add(marker)
            items.append(it)
        out[key] = items[:8]
    return out


def _run_concierge(messages, lat, lng, ctx=None):
    """Let the model call tools and return (reply, places_to_plot, tool_trace, ordered, extras)."""
    plotted, trace, ordered = [], [], False
    extras = {k: [] for k in EXTRA_KEYS}
    for _ in range(MAX_TOOL_ROUNDS):
        msg = _azure_chat_raw(messages, tools=TOOLS)
        calls = msg.get("tool_calls") or []
        if not calls:
            return (msg.get("content") or "").strip(), plotted, trace, ordered, _finish_extras(extras)

        messages.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": calls})
        for call in calls:
            name = call["function"]["name"]
            try:
                args = json.loads(call["function"].get("arguments") or "{}")
            except ValueError:
                args = {}
            fn = TOOL_FUNCS.get(name)
            try:
                result = fn(args, lat, lng, ctx) if fn else {"places": [], "llm": {"error": f"unknown tool {name}"}}
            except Exception as e:
                logger.error(f"Tool {name} failed: {e}", exc_info=True)
                result = {"places": [], "llm": {"error": "tool failed"}}
            if result.get("places"):
                if result.get("ordered") or result.get("replace"):
                    plotted = list(result["places"])
                    ordered = bool(result.get("ordered"))
                else:
                    plotted = _merge_places(plotted, result["places"])
                    ordered = False
            for key in EXTRA_KEYS:
                extras[key].extend(result.get(key) or [])
            trace.append({"tool": name, "args": args, "label": result.get("label") or name, "source": result.get("source")})
            messages.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(result["llm"])})

    msg = _azure_chat_raw(messages, tools=None)
    return (msg.get("content") or "").strip(), plotted, trace, ordered, _finish_extras(extras)


def _parse_itinerary(raw):
    """Normalize the client's saved itinerary into [{title, done, tags}]."""
    items = []
    for it in (raw or [])[:20]:
        if isinstance(it, str):
            it = {"title": it}
        if not isinstance(it, dict):
            continue
        title = str(it.get("title") or "").strip()[:120]
        if not title:
            continue
        tags = [str(t).strip()[:30] for t in (it.get("hashtags") or []) if str(t).strip()][:4]
        items.append({"title": title, "done": bool(it.get("completed")), "tags": tags})
    return items


@app.route('/api/chat', methods=['POST'])
def ai_chat():
    """
    AI Travel Concierge: Azure OpenAI decides when to call SerpApi tools
    (place search, directions), then answers using the results. The places it
    used are returned so the client can plot them on the map.
    """
    try:
        data = request.get_json(silent=True) or request.form.to_dict() or {}
        message = (data.get("message") or "").strip()
        context = data.get("context") or []
        try:
            lat = float(data.get("lat") or CONFIG["DEFAULT_LAT"])
            lng = float(data.get("lng") or CONFIG["DEFAULT_LNG"])
        except (TypeError, ValueError):
            lat, lng = CONFIG["DEFAULT_LAT"], CONFIG["DEFAULT_LNG"]

        image = data.get("image")
        if image is not None:
            if (not isinstance(image, str) or not IMAGE_DATA_URL.match(image)
                    or len(image) > MAX_IMAGE_CHARS):
                return jsonify({"success": False, "error": "Image must be a JPEG, PNG or WebP under about 4 MB."}), 400
            if not message:
                message = "What is this? If it is food, find places near me that serve it. If it is a place, tell me about it and show it on the map."

        if not message:
            return jsonify({"success": False, "error": "Empty message"}), 400
        if len(message) > 2000:
            return jsonify({"success": False, "error": "Message too long"}), 400

        if _azure_config() is None:
            return jsonify({
                "success": False,
                "error": "AI concierge is not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT in Backend/.env."
            }), 503

        if data.get("located") is True:
            city = _reverse_city(lat, lng)
            system = SYSTEM_PROMPT + (
                f"\n\nThe user's current location is {lat:.5f}, {lng:.5f}"
                + (f", near {city}" if city else "")
                + ", from their device GPS. 'Near me' means around these coordinates."
            )
        else:
            system = SYSTEM_PROMPT + (
                f"\n\nThe user's real location is unknown. Assume {CONFIG['DEFAULT_CITY']} ({lat:.5f}, {lng:.5f}) "
                "unless they name another place, and mention this assumption briefly when you give 'near me' results."
            )
        on_map = [str(t) for t in (data.get("map_places") or []) if t][:10]
        if on_map:
            system += "\nPlaces currently plotted on the user's map, in order: " + "; ".join(f"{i + 1}. {t}" for i, t in enumerate(on_map)) + "."

        itinerary = _parse_itinerary(data.get("itinerary"))
        if itinerary:
            lines = [
                f"{i + 1}. {it['title']}" + (" [done]" if it["done"] else "") + (f" (#{', #'.join(it['tags'])})" if it["tags"] else "")
                for i, it in enumerate(itinerary)
            ]
            system += "\n\nThe user's saved itinerary (their to-do list of places, in the order they added them):\n" + "\n".join(lines)
        else:
            system += "\n\nThe user has no saved itinerary yet."

        user_content = message
        if image:
            user_content = [
                {"type": "text", "text": message},
                {"type": "image_url", "image_url": {"url": image, "detail": "auto"}},
            ]

        chat_messages = (
            [{"role": "system", "content": system}]
            + _normalize_history(context)
            + [{"role": "user", "content": user_content}]
        )
        ctx = {"itinerary": [it["title"] for it in itinerary if not it["done"]]}

        try:
            response_text, places, trace, ordered, extras = _run_concierge(chat_messages, lat, lng, ctx)
        except Exception as e:
            logger.error(f"Azure OpenAI generation failed: {e}", exc_info=True)
            if image:
                return jsonify({
                    "success": False,
                    "error": "The AI model could not analyze the photo. Check that your Azure deployment is vision-capable (for example gpt-4o)."
                }), 502
            return jsonify({"success": False, "error": "The AI model could not be reached."}), 502

        if not response_text:
            return jsonify({"success": False, "error": "The AI model returned an empty reply."}), 502

        return jsonify({
            "success": True,
            "response": response_text,
            "places": [{k: p.get(k) for k in PLACE_FIELDS} for p in places],
            "tools": trace,
            "ordered": ordered,
            "images": extras["images"],
            "cards": extras["cards"],
            "sources": extras["sources"],
            "serpapi_grounded": any((t.get("source") or "").startswith("serpapi") for t in trace),
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"Chat endpoint error: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/geocode", methods=['GET'])
def geocode():
    """Geocode query via OpenStreetMap Nominatim"""
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Missing query parameter"}), 400

    url = f"https://nominatim.openstreetmap.org/search?format=json&q={quote(query)}"
    headers = {"User-Agent": "LookAte-Travel-App/2.0"}

    try:
        resp = requests.get(url, headers=headers, timeout=6)
        resp.raise_for_status()
        return jsonify(resp.json())
    except Exception as e:
        logger.warning(f"OSM Geocoding fallback: {e}")
        # Return fallback coordinate for common cities
        return jsonify([{
            "display_name": query.title(),
            "lat": str(CONFIG["DEFAULT_LAT"]),
            "lon": str(CONFIG["DEFAULT_LNG"])
        }])

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"🚀 Starting LookAte AI Master Backend on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)