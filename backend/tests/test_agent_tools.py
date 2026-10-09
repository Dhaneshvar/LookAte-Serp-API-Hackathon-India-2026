import os, sys, json
BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)
os.environ.update(AZURE_OPENAI_ENDPOINT="https://fake.openai.azure.com", AZURE_OPENAI_API_KEY="x", AZURE_OPENAI_DEPLOYMENT="gpt")
import app as A
A.serp_client.search_google_maps = lambda *a, **k: None   # keep tests offline (no live SerpApi credits)
A._serp = lambda *a, **k: None

seen = []

def scripted(script):
    it = iter(script)
    def fake(messages, tools=None, **kw):
        seen.append({"n_msgs": len(messages), "tools": bool(tools), "roles": [m["role"] for m in messages], "messages": json.loads(json.dumps(messages))})
        return next(it)
    return fake

def call(name, args, cid="c1"):
    return {"role": "assistant", "content": None,
            "tool_calls": [{"id": cid, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}]}

client = A.app.test_client()
def chat(body):
    r = client.post("/api/chat", json=body)
    return r.status_code, r.get_json()

# 1. search -> final answer
A._azure_chat_raw = scripted([call("search_places", {"query": "beach", "limit": 3}), {"role": "assistant", "content": "Try **Promenade Beach** first."}])
code, d = chat({"message": "best beaches", "lat": 11.9416, "lng": 79.8083, "map_places": ["Old Place"], "context": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]})
print("1 search:", code, d["success"], "| places:", [p["title"] for p in d["places"]], "| tools:", [t["label"] for t in d["tools"]])
print("   azure calls:", seen[-2:], )
tool_msg_roles = seen[-1]["roles"]
assert tool_msg_roles[-2:] == ["assistant", "tool"], tool_msg_roles
assert d["places"] and d["places"][0]["latitude"]

# 2. directions -> final answer
A._azure_chat_raw = scripted([call("get_directions", {"destination": "Promenade Beach"}), {"role": "assistant", "content": "About 3 km away."}])
code, d = chat({"message": "how far is Promenade Beach"})
print("2 directions:", code, "| places:", [p["title"] for p in d["places"]], "| label:", d["tools"][0]["label"], "| source:", d["tools"][0]["source"])
assert len(d["places"]) == 1

# 3. no tool needed
A._azure_chat_raw = scripted([{"role": "assistant", "content": "You're welcome!"}])
code, d = chat({"message": "thanks"})
print("3 no-tool:", code, d["response"], "| places:", d["places"], "| tools:", d["tools"])
assert d["places"] == [] and d["tools"] == []

# 4. malformed tool args + unknown tool, then answer
A._azure_chat_raw = scripted([
    {"role": "assistant", "content": None, "tool_calls": [{"id": "a", "type": "function", "function": {"name": "search_places", "arguments": "{bad json"}}, {"id": "b", "type": "function", "function": {"name": "nope", "arguments": "{}"}}]},
    {"role": "assistant", "content": "Could you tell me what you are looking for?"}])
code, d = chat({"message": "??"})
print("4 bad args:", code, d["success"], d["response"], "| places:", d["places"])

# 5. model keeps calling tools -> capped, forced final answer
A._azure_chat_raw = scripted([call("search_places", {"query": "cafe"}, f"c{i}") for i in range(4)] + [{"role": "assistant", "content": "Here you go."}])
code, d = chat({"message": "loop"})
print("5 capped:", code, d["response"], "| tool calls:", len(d["tools"]), "| last call had tools:", seen[-1]["tools"])
assert len(d["tools"]) == 4 and seen[-1]["tools"] is False

# 6. Azure failure surfaces cleanly
def boom(*a, **k): raise RuntimeError("azure down")
A._azure_chat_raw = boom
code, d = chat({"message": "hi"})
print("6 azure down:", code, d)
assert code == 502

# 7. optimize_itinerary with stops given in the prompt
A._azure_chat_raw = scripted([call("optimize_itinerary", {"stops": ["Promenade Beach", "French bakery", "spice market", "Auroville"]}), {"role": "assistant", "content": "Here is the best order."}])
code, d = chat({"message": "plan these: beach, bakery, spice market, auroville", "lat": 11.9416, "lng": 79.8083})
tool_payload = json.loads(seen[-1]["messages"][-1]["content"])
print("7 optimize(stops):", code, "| ordered flag:", d["ordered"], "| order:", [p["title"] for p in d["places"]], "| label:", d["tools"][0]["label"])
print("   payload to model -> total_km:", tool_payload["total_km"], "mins:", tool_payload["total_est_mins"], "unresolved:", tool_payload["unresolved"], "first leg:", tool_payload["stops_in_order"][0]["leg_km"])
assert d["ordered"] is True and len(d["places"]) >= 2 and tool_payload["total_km"] > 0

# 8. no stops -> uses saved itinerary (done items skipped); itinerary is in the system prompt
A._azure_chat_raw = scripted([call("optimize_itinerary", {}), {"role": "assistant", "content": "Optimized your plan."}])
itin = [{"title": "Promenade Beach", "completed": False, "hashtags": ["beach"]}, {"title": "Goubert Market", "completed": True, "hashtags": []}, {"title": "Auroville", "completed": False, "hashtags": ["heritage"]}]
code, d = chat({"message": "optimize my itinerary", "itinerary": itin})
sys_prompt = seen[-2]["messages"][0]["content"]
payload = json.loads(seen[-1]["messages"][-1]["content"])
print("8 optimize(saved):", code, "| used_saved:", payload["used_saved_itinerary"], "| requested:", [x["requested_as"] for x in payload["stops_in_order"]])
print("   system prompt has itinerary:", "1. Promenade Beach (#beach)" in sys_prompt, "| marks done:", "Goubert Market [done]" in sys_prompt)
assert payload["used_saved_itinerary"] and "Goubert Market" not in [x["requested_as"] for x in payload["stops_in_order"]]
assert "1. Promenade Beach (#beach)" in sys_prompt and "Goubert Market [done]" in sys_prompt

# 9. no stops and no saved itinerary -> tool error goes to the model, nothing plotted
A._azure_chat_raw = scripted([call("optimize_itinerary", {}), {"role": "assistant", "content": "You have no itinerary yet. Tell me where you want to go."}])
code, d = chat({"message": "optimize my itinerary", "itinerary": []})
payload = json.loads(seen[-1]["messages"][-1]["content"])
print("9 empty itinerary:", code, "| tool said:", payload.get("error"), "| places:", d["places"], "| 'no itinerary' in prompt:", "no saved itinerary" in seen[-2]["messages"][0]["content"])
assert d["places"] == [] and "error" in payload

# 10. malformed itinerary payload is ignored safely
A._azure_chat_raw = scripted([{"role": "assistant", "content": "ok"}])
code, d = chat({"message": "hi", "itinerary": [None, 5, {"title": ""}, "Just a string", {"title": "x" * 500}]})
sp = seen[-1]["messages"][0]["content"]
print("10 junk itinerary:", code, "| kept string item:", "Just a string" in sp, "| long title capped:", ("x" * 121) not in sp)
assert code == 200

# 11. food photo -> vision message to the model, then the model searches for the dish
import base64, io
from PIL import Image as PI
buf = io.BytesIO(); PI.new("RGB", (64, 64), (200, 120, 40)).save(buf, "JPEG")
img = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
A._azure_chat_raw = scripted([call("search_places", {"query": "masala dosa restaurants", "limit": 4}), {"role": "assistant", "content": "That looks like a masala dosa. Try the places on your map."}])
code, d = chat({"message": "", "image": img, "lat": 11.9416, "lng": 79.8083, "context": [{"role": "user", "content": "hi"}]})
first = seen[-2]["messages"][-1]
print("11 photo:", code, d["success"], "| default prompt used:", first["content"][0]["text"])
print("   user content parts:", [p["type"] for p in first["content"]], "| image forwarded:", first["content"][1]["image_url"]["url"] == img, "| places plotted:", len(d["places"]), "| chip:", d["tools"][0]["label"].encode("ascii", "replace").decode())
assert code == 200 and [p["type"] for p in first["content"]] == ["text", "image_url"] and d["places"]
assert "shares a photo" in seen[-2]["messages"][0]["content"] and "landmark" in seen[-2]["messages"][0]["content"]
assert all(isinstance(m["content"], str) for m in seen[-2]["messages"][1:-1] if m["role"] in ("user",)), "history must stay text-only"

# 12. photo plus a typed instruction keeps the user's text
A._azure_chat_raw = scripted([{"role": "assistant", "content": "ok"}])
code, d = chat({"message": "find it near the beach", "image": img})
print("12 photo+text:", code, "| text kept:", seen[-1]["messages"][-1]["content"][0]["text"])
assert seen[-1]["messages"][-1]["content"][0]["text"] == "find it near the beach"

# 13. invalid / oversized / non-image payloads are rejected before reaching the model
before = len(seen)
for label, bad in (("not a data url", "http://x/y.jpg"), ("wrong type", "data:text/html;base64,AAAA"), ("svg", "data:image/svg+xml;base64,AAAA"), ("not a string", 123), ("too big", "data:image/jpeg;base64," + "A" * 5_600_000)):
    code, d = chat({"message": "hi", "image": bad})
    print("13 reject", label + ":", code)
    assert code == 400
assert len(seen) == before, "model must not be called for rejected images"

# 14. vision failure gives a helpful error
def vision_fail(messages, tools=None, **kw): raise RuntimeError("deployment does not support images")
A._azure_chat_raw = vision_fail
code, d = chat({"message": "what is this", "image": img})
print("14 vision unsupported:", code, d["error"])
assert code == 502 and "vision" in d["error"]

# 15. GPS flag changes what the model is told; far-away demo data is flagged
A._azure_chat_raw = scripted([call("search_places", {"query": "cafe"}), {"role": "assistant", "content": "ok"}])
code, d = chat({"message": "cafes near me", "lat": 12.9716, "lng": 77.5946, "located": True})
sp = seen[-2]["messages"][0]["content"]
tool_payload = json.loads(seen[-1]["messages"][-1]["content"])
print("15 located:", code, "| told GPS:", "from their device GPS" in sp, "| no Pondicherry assumption:", "real location is unknown" not in sp)
print("   far demo note:", tool_payload.get("note", "")[:110])
assert "from their device GPS" in sp and "note" in tool_payload

A._azure_chat_raw = scripted([{"role": "assistant", "content": "ok"}])
code, d = chat({"message": "hi", "located": False})
print("16 not located:", code, "| assumption stated:", "real location is unknown" in seen[-1]["messages"][0]["content"])
assert "real location is unknown" in seen[-1]["messages"][0]["content"]
print("ALL OK")
