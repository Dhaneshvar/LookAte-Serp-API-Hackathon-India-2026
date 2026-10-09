import os, sys, json, threading, base64, io
from http.server import BaseHTTPRequestHandler, HTTPServer

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

captured = []


def tool_call(cid, name, args):
    return {"id": cid, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}


STATE = {"script": None}


class FakeAzure(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        captured.append({"path": self.path, "api_key": self.headers.get("api-key"), "body": body})
        n = len(captured)
        if STATE["script"] is not None:
            msg = next(STATE["script"])
        elif n == 1:   # model looks at the photo and calls three tools at once
            msg = {"role": "assistant", "content": None, "tool_calls": [
                tool_call("t1", "search_places", {"query": "masala dosa restaurants", "limit": 3}),
                tool_call("t2", "search_images", {"query": "masala dosa"}),
                tool_call("t3", "tripadvisor_search", {"query": "dosa", "kind": "restaurants"}),
            ]}
        elif n == 2:  # then asks a general-knowledge question
            msg = {"role": "assistant", "content": None, "tool_calls": [tool_call("t4", "web_answer", {"question": "What is a masala dosa?"})]}
        else:
            msg = {"role": "assistant", "content": "That looks like a masala dosa, a crisp fermented crepe with a spiced potato filling. I found places near you serving it."}
        out = {"id": "x", "object": "chat.completion", "created": 0, "model": "gpt-4o",
               "choices": [{"index": 0, "finish_reason": "tool_calls" if msg.get("tool_calls") else "stop", "message": msg}]}
        data = json.dumps(out).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


srv = HTTPServer(("127.0.0.1", 8765), FakeAzure)
threading.Thread(target=srv.serve_forever, daemon=True).start()

os.environ.update(AZURE_OPENAI_ENDPOINT="http://127.0.0.1:8765", AZURE_OPENAI_API_KEY="test-key-123",
                  AZURE_OPENAI_DEPLOYMENT="gpt-4o", AZURE_OPENAI_API_VERSION="2025-01-01-preview")
import app as A

serp_calls = []


def fake_serp(params, timeout=30):
    serp_calls.append(params["engine"])
    e = params["engine"]
    if e == "google_images":
        return {"images_results": [
            {"title": "Masala dosa", "thumbnail": "https://t/1.jpg", "source": "site.com", "link": "https://site.com/1"},
            {"title": "No thumb", "link": "https://x"},
            {"title": "Dosa 2", "thumbnail": "https://t/2.jpg", "source": "b.com", "original": "https://b.com/2.jpg"}]}
    if e == "tripadvisor":
        return {"places": [
            {"position": 1, "title": "Surguru Restaurant", "place_type": "EATERY", "place_id": "1", "link": "https://ta/1", "rating": 4.1, "reviews": 1506, "location": "Pondicherry, India", "thumbnail": "https://t/ta1.jpg"},
            {"position": 2, "title": "Radisson Resort", "place_type": "ACCOMMODATION", "place_id": "2", "link": "https://ta/2", "rating": 4.4, "reviews": 800, "location": "Pondicherry, India"},
            {"position": 3, "title": "", "rating": 1}]}
    if e == "google_ai_mode":
        return {"text_blocks": [{"type": "paragraph", "snippet": "Masala dosa is a South Indian crepe."},
                                {"type": "list", "list": [{"title": "Batter", "snippet": "rice and urad dal"}, "potato masala"]}],
                "references": [{"title": "Wiki", "link": "https://w/dosa", "source": "Wikipedia"}, {"title": "no link"}]}
    return None  # google_maps (search_places) path goes through serp_client, not _serp


A._serp = fake_serp
A.serp_client.search_google_maps = lambda q, lat, lng, limit=10: None   # force the demo-data fallback for places

img = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff\xe0fakejpegbytes").decode()
client = A.app.test_client()
r = client.post("/api/chat", json={"message": "", "image": img, "lat": 11.9416, "lng": 79.8083, "located": True})
d = r.get_json()

print("status:", r.status_code, "| success:", d.get("success"))
print("reply:", d["response"][:90])
print("azure requests made:", len(captured))
c1 = captured[0]
print("1) url path:", c1["path"].split("?")[0], "| api-version:", c1["path"].split("api-version=")[-1])
print("   api-key header sent:", c1["api_key"] == "test-key-123")
last = c1["body"]["messages"][-1]["content"]
print("   user content parts:", [p["type"] for p in last], "| image forwarded intact:", last[1]["image_url"]["url"] == img)
print("   tools offered:", [t["function"]["name"] for t in c1["body"]["tools"]], "| tool_choice:", c1["body"].get("tool_choice"))
c2 = captured[1]["body"]["messages"]
print("2) round-2 roles:", [m["role"] for m in c2][-5:], "| ids paired:", sorted(m["tool_call_id"] for m in c2 if m["role"] == "tool"))
print("serp engines called:", serp_calls)
print("places plotted:", [p["title"] for p in d["places"]])
print("tools trace:", [(t["tool"], t["source"]) for t in d["tools"]])
print("images:", [(i["title"], i["link"]) for i in d["images"]])
print("cards:", [(c["title"], c["subtitle"], c["rating"], c["provider"]) for c in d["cards"]])
print("sources:", d["sources"])

assert r.status_code == 200 and d["success"]
assert c1["api_key"] == "test-key-123" and "/openai/deployments/gpt-4o/chat/completions" in c1["path"]
assert "2025-01-01-preview" in c1["path"] and last[1]["image_url"]["url"] == img
assert len(c1["body"]["tools"]) == 6
assert sorted(m["tool_call_id"] for m in c2 if m["role"] == "tool") == ["t1", "t2", "t3"]
assert [i["title"] for i in d["images"]] == ["Masala dosa", "Dosa 2"] and d["images"][1]["link"] == "https://b.com/2.jpg"
assert [c["title"] for c in d["cards"]] == ["Surguru Restaurant", "Radisson Resort"], d["cards"]
assert d["cards"][0]["subtitle"] == "Restaurant · Pondicherry, India" and d["cards"][1]["subtitle"].startswith("Hotel")
assert d["sources"] == [{"title": "Wiki", "link": "https://w/dosa", "source": "Wikipedia"}]
assert len(d["places"]) == 3, d["places"]  # only the 3 Google Maps places are plotted; Tripadvisor has no coordinates
ai_msg = [m for m in captured[2]["body"]["messages"] if m["role"] == "tool" and m["tool_call_id"] == "t4"][0]["content"]
assert "Masala dosa is a South Indian crepe." in ai_msg and "Batter: rice and urad dal" in ai_msg and "- potato masala" in ai_msg
print("AI Mode text reached the model:", ai_msg[:100].replace("\n", " | "))

# SerpApi down -> tools degrade gracefully, chat still answers
captured.clear(); serp_calls.clear()
A._serp = lambda params, timeout=30: None
STATE["script"] = iter([
    {"role": "assistant", "content": None, "tool_calls": [tool_call("u1", "search_images", {"query": "x"}), tool_call("u2", "web_answer", {"question": "y"}), tool_call("u3", "tripadvisor_search", {"query": "z"})]},
    {"role": "assistant", "content": "Sorry, live photos and reviews are unavailable right now."}])
A._azure_client = None
r = client.post("/api/chat", json={"message": "show dosa photos and reviews"})
d = r.get_json()
errs = [json.loads(m["content"]) for m in captured[1]["body"]["messages"] if m["role"] == "tool"]
print("SerpApi down ->", r.status_code, d["success"], "| model told:", [list(e)[0] for e in errs], "| images/cards/sources:", d["images"], d["cards"], d["sources"])
assert r.status_code == 200 and all("error" in e for e in errs) and d["images"] == [] and d["cards"] == []
print("ALL SDK TESTS OK")
