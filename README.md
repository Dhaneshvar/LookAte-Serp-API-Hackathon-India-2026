# LookAte: AI Travel Guide

**Talk to your trip. Watch it appear on the map.**

LookAte is a voice-first AI travel companion built for the **SerpAPI India Hackathon 2026**. Ask about places, food or routes by typing, speaking, or snapping a photo. An Azure OpenAI model decides which **SerpAPI** services to call, answers in plain language, and plots the results on a live map with a route you can follow.

## What it does

- **Ask in your own words** by typing or by voice ("best dosa places near me", "how far is Promenade Beach?").
- **Snap or upload a photo** of a dish, a landmark or a menu. The AI works out what it is, then finds nearby places, photos, reviews and facts.
- **The AI picks the tools.** It calls live SerpAPI services only when the question needs them, then explains the results in natural language.
- **Everything lands on the map.** Places appear as numbered markers with a type icon (supermarket, mall, fuel pump, hospital, salon, restaurant, house and more). Hover for details, click for a popup.
- **Start a journey.** The road route, distance and time are drawn, and a marker travels along it stop by stop.
- **Itinerary optimizer.** Keep a to-do list of places; the AI can read it and reorder the stops for the shortest trip.
- **Installable on a phone** (Add to Home Screen), with location, microphone and camera support over HTTPS.

## How SerpAPI is used

The AI model is given six tools. Five are backed by SerpAPI engines; the sixth builds on the first.

| SerpAPI engine | Tool the AI can call | What the user sees | Code (`backend/app.py`) |
|---|---|---|---|
| `google_maps` | `search_places` | Numbered, icon markers on the map, ratings, open status | `SerpApiClient.search_google_maps`, `_tool_search_places` |
| `google_maps_directions` | `get_directions` | Distance and time by car and two-wheeler | `_serp_directions`, `_tool_get_directions` |
| `google_images` | `search_images` | A photo strip in the chat | `_tool_search_images` |
| `tripadvisor` | `tripadvisor_search` | Rating and review cards (restaurants, hotels, things to do) | `_tool_tripadvisor_search` |
| `google_ai_mode` | `web_answer` | A web-grounded answer with source links | `_tool_web_answer` |
| `google_maps` (resolves each stop) | `optimize_itinerary` | The stops reordered for the shortest trip | `_tool_optimize_itinerary` |

All SerpAPI calls go through one small function, `_serp`. The tool loop is `_run_concierge`, and the chat endpoint is `ai_chat`.

## Architecture

```
 Browser (React + Leaflet)                     Flask backend                       Services
 ┌──────────────────────────┐   /api/chat   ┌──────────────────────┐
 │ chat, voice, photo input │ ────────────► │ ai_chat()            │ ───► Azure OpenAI (GPT-4o, vision)
 │ map, route, journey      │               │  _run_concierge()    │ ◄─── "call search_images(...)"
 │ itinerary (localStorage) │ ◄──────────── │   runs the tools     │ ───► SerpAPI: Maps, Directions, Images,
 └──────────────────────────┘  answer +     └──────────────────────┘      Tripadvisor, AI Mode
        │                      places,                                          
        │ road routes          photos, cards,
        ▼                      sources
   OSRM routing, OpenStreetMap tiles
```

One question, step by step:

1. The browser sends the message, your location, the places already on the map, your saved itinerary and, optionally, a photo.
2. Azure OpenAI reads it and either answers directly or asks for one or more tools.
3. The backend runs those tools against SerpAPI and gives the results back to the model.
4. The model writes the final answer using only what the tools returned (it is told never to invent ratings, addresses or opening hours).
5. The backend returns the answer plus structured `places`, `images`, `cards`, `sources` and the list of tools used. The UI shows them as chips, photo strips and cards, and plots the places on the map.

## Quick start

You need **Python 3.10+**, **Node 18+**, a **SerpAPI key**, and an **Azure OpenAI** resource with a **vision-capable chat deployment** (for example `gpt-4o`).

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate      macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # Windows: copy .env.example .env
# edit .env and fill in your keys (see the table below)
python app.py               # runs on http://localhost:5000
```

| Variable | Purpose |
|---|---|
| `SERPAPI_KEY` | SerpAPI key (Maps, Directions, Images, Tripadvisor, AI Mode) |
| `AZURE_OPENAI_ENDPOINT` | e.g. `https://your-resource.openai.azure.com` |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key |
| `AZURE_OPENAI_DEPLOYMENT` | Name of a vision-capable chat deployment |
| `AZURE_OPENAI_API_VERSION` | Defaults to `2025-01-01-preview` |
| `SERPAPI_GL`, `SERPAPI_GOOGLE_DOMAIN` | Optional. Default `in` and `google.co.in` |
| `PORT` | Optional. Default `5000` |

Check it is configured: open `http://localhost:5000/api/health`. It should show `serpapi_connected` and `azure_openai_connected` as `true`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173, proxies /api to the backend on port 5000
```

Open `http://localhost:5173` and press **Launch LookAte**.

### 3. Prove every SerpAPI service works (about 9 search credits)

```bash
cd backend
python check_serpapi.py
```

It makes one live call per service and prints what each tool extracted. It never prints your key.

## Try it: demo prompts

| Say or type | Service you will see in the chat chip |
|---|---|
| "Find good dosa places near me" | Google Maps, plotted on the map |
| "Show me what a masala dosa looks like" | Google Images (photo strip) |
| "Which restaurants here have the best reviews?" | Tripadvisor (rating cards) |
| "What is the best time to visit Pondicherry?" | Google AI Mode (answer plus sources, about 10 to 15 seconds) |
| "How far is Promenade Beach?" | Google Maps Directions |
| Upload a photo of a dish | Vision, then Maps / Images |
| "Optimize my itinerary" | Itinerary optimizer |

Each answer shows chips naming the SerpAPI services that ran. After places are plotted, press **Start journey**.

## Use it on a phone (location and microphone need HTTPS)

Browsers only allow location and microphone on HTTPS. The quickest way is a free Cloudflare quick tunnel:

```bash
cloudflared tunnel --url http://localhost:5173
```

Open the `https://….trycloudflare.com` address on your phone and allow location, microphone and camera. `vite.config.ts` already allows `*.trycloudflare.com`. The tunnel address is public while it runs, so do not share it: anyone with it can use your API keys.

## Tests

No real keys and no network needed. They use a stand-in for Azure OpenAI and canned SerpAPI replies.

```bash
cd backend
python tests/test_agent_tools.py         # tool loop, itinerary, photo input, error handling
python tests/test_azure_sdk_path.py      # real Azure SDK request shape against a local fake server
```

If you are behind a proxy, set `NO_PROXY=127.0.0.1,localhost` first.

## Project structure

```
backend/
  app.py               Flask API, SerpAPI tools, Azure OpenAI tool-calling loop
  check_serpapi.py     Live smoke test for every SerpAPI service
  tests/               Offline tests
  requirements.txt
  .env.example
frontend/
  src/pages/Index.tsx           App shell and tabs
  src/components/HomePage.tsx   Landing page
  src/components/JourneyView.tsx  Map, AI chat, voice, photo input, journey
  src/components/TodoSection.tsx  Itinerary list and optimizer
  src/lib/route.ts              Route building (OSRM) and journey position
  src/lib/placeKind.tsx         Place type to icon and color
  src/lib/image.ts              Shrinks photos before upload
```

## Notes and limits

- **Live data needed for real results.** If SerpAPI cannot be reached, the place tools fall back to a small built-in Pondicherry list. The AI is told this and says so, and the chip is labelled "Demo data".
- **Tripadvisor results have no coordinates.** They appear as cards. To put one on the map the AI also searches Google Maps for it.
- **Google AI Mode is slow** (roughly 10 to 15 seconds), so answers that use it take longer.
- **Each answer can use 1 to 4 SerpAPI searches.** Watch your quota.
- **Routes** come from the free public OSRM server (driving only). If it is unreachable, a dashed straight-line estimate is drawn instead.
- **Voice** uses the browser's speech recognition. It works best in Chrome on desktop and Android; Safari support is limited.
- **Photo input** needs an Azure deployment that supports images (such as `gpt-4o`).
- The saved itinerary lives in the browser (`localStorage`), not on the server.

## Credits

- Search data and tools: [SerpAPI](https://serpapi.com)
- Language and vision model: Azure OpenAI
- Map data: OpenStreetMap contributors; routing: OSRM; place lookups for city names: Nominatim
- The animated voice orb (`frontend/src/components/ui/fluid-orb.tsx`) is the open FluidOrb component from [RareUI](https://www.rareui.com/components)
- Icons: [Lucide](https://lucide.dev); UI primitives from shadcn/ui

## Security

Never commit `.env`. It is in `.gitignore`; use `backend/.env.example` as the template.
