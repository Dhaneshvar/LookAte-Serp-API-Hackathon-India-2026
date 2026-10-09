"""Smoke-test every SerpApi service LookAte uses, with one live search each (about 9 credits).

Run from the Backend folder:  python check_serpapi.py
Prints what each tool extracted. Never prints the API key.
"""
import json

import app as A

LAT, LNG = A.CONFIG["DEFAULT_LAT"], A.CONFIG["DEFAULT_LNG"]

if not A.serp_client.is_configured():
    raise SystemExit("SERPAPI_KEY is not set in Backend/.env")


def show(name, result, fields):
    llm = result.get("llm", {})
    print(f"\n== {name}")
    print("   label  :", result.get("label"))
    print("   source :", result.get("source"))
    if "error" in llm:
        print("   ERROR  :", llm["error"])
        return
    for key in fields:
        items = result.get(key) or []
        print(f"   {key:8}: {len(items)}", json.dumps(items[0], ensure_ascii=False)[:230] if items else "")
    if llm.get("answer"):
        print("   answer :", llm["answer"][:230].replace("\n", " | "))


show("search_places (Google Maps, category query)", A._tool_search_places({"query": "masala dosa restaurants", "limit": 3}, LAT, LNG), ["places"])
show("search_places (Google Maps, exact place name)", A._tool_search_places({"query": "Promenade Beach", "limit": 1}, LAT, LNG), ["places"])
show("get_directions (Google Maps Directions)", A._tool_get_directions({"destination": "Promenade Beach"}, LAT, LNG), ["places"])
info = A._serp_directions((LAT, LNG), (11.9338, 79.8358)) or {}
print("   travel options:", [(o["mode"], o["distance"], o["duration"]) for o in info.get("options", [])])
show("search_images (Google Images)", A._tool_search_images({"query": "masala dosa", "limit": 3}, LAT, LNG), ["images"])
for kind in ("restaurants", "hotels", "things_to_do"):
    show(f"tripadvisor_search ({kind})", A._tool_tripadvisor_search({"query": "pondicherry" if kind != "restaurants" else "dosa", "kind": kind}, LAT, LNG), ["cards"])
show("web_answer (Google AI Mode)", A._tool_web_answer({"question": "Best time to visit Pondicherry?"}, LAT, LNG), ["sources"])
