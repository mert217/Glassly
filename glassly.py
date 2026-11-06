#!/usr/bin/env python3
"""Glassly - okul OBS paneli için şeffaf, hareketli istemci."""
import json, re, secrets, socket, sys, threading, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import requests
from urllib.parse import urlparse, parse_qs

try:
    import keyring
except Exception:
    keyring = None

HERE = Path(__file__).parent
TOKEN = secrets.token_urlsafe(32)      # her açılışta yeni; başka program API'ye erişemez
KR_SERVICE, KR_USER = "Glassly", "login"
XHR = {"X-Requested-With": "XMLHttpRequest"}


class State:
    def __init__(self):
        self.reset()

    def reset(self):
        self.http = requests.Session()
        self.http.headers["User-Agent"] = "Glassly/1.0"
        self.base = ""
        self.path = "pages/student"
        self.creds = None              # yalnızca RAM'de, otomatik yeniden giriş için


S = State()


def norm_url(u):
    u = (u or "").strip().rstrip("/")
    if not u.startswith("http"):
        u = "https://" + u
    if not u.startswith("https://") or not re.fullmatch(r"https://[A-Za-z0-9.-]+(:\d+)?", u):
        raise ValueError("Geçerli bir https:// okul adresi gir.")
    return u


def do_login(base, tc, pw):
    S.base = norm_url(base)
    r = S.http.post(f"{S.base}/require/class/login.php", timeout=12, data={
        "request": "login", "loginAs": "standard", "isRegister": "0",
        "username": tc, "password": pw, "newUser": "0"})
    ok = bool(r.json().get("success"))
    if ok:
        S.creds = {"base": S.base, "tc": tc, "pw": pw}
        detect_role()
    return ok


def detect_role():
    try:
        t = S.http.get(f"{S.base}/require/menuLoader.php", timeout=8).text
        if "window.obsNavData = " in t:
            d = json.loads(t.split("window.obsNavData = ", 1)[1].split("};", 1)[0] + "}")
            veli = d.get("key") == "parent" or "veli" in json.dumps(d.get("brand", {})).lower()
            S.path = (d.get("base") or f"pages/{'parent' if veli else 'student'}/").strip("/")
    except Exception:
        pass


def req(method, url, **kw):
    """Oturum düşerse RAM'deki bilgilerle bir kez yeniden girer."""
    for attempt in (0, 1):
        r = S.http.request(method, url, timeout=12, **kw)
        try:
            j = r.json()
        except Exception:
            j = None
        if isinstance(j, dict) and j.get("error") == "Login required" and attempt == 0 and S.creds:
            c = S.creds
            if do_login(c["base"], c["tc"], c["pw"]):
                continue
        return j
    return None


def api(name, arg=None):
    b, p = S.base, S.path
    if name == "home":
        return req("POST", f"{b}/{p}/require/indexAction.php", data={"request": "loadIndex"}, headers=XHR)
    if name == "homework":
        return req("GET", f"{b}/obsapi/homework/getHomeworkList")
    if name == "mail":
        i = req("GET", f"{b}/obsapi/mail/getInbox") or {}
        s = req("GET", f"{b}/obsapi/mail/getSentMail") or {}
        return {"success": True, "inbox": (i.get("data") or {}).get("mail", []),
                "sent": (s.get("data") or {}).get("mail", [])}
    if name == "mailopen":
        return req("POST", f"{b}/obsapi/mail/getMailContent", data={"mailId": str(arg)})
    if name == "attendance":
        ep = f"{b}/{p}/require/attendanceDashboard.php"
        init = req("POST", ep, data={"request": "load-attendance-initial-data"}, headers=XHR) or {}
        per = init.get("periods") or []
        lst = []
        if per:
            x = req("POST", ep, data={"request": "get-attendance-graph-7", "periodId": per[0].get("id")}, headers=XHR) or {}
            lst = x.get("list") or []
        return {"success": True, "periods": per, "list": lst}
    if name == "notifications":
        return req("GET", f"{b}/obsapi/notification/list")
    if name == "exams":
        ex = req("POST", f"{b}/{p}/require/examDashboard.php", data={"request": "getStudentExams", "examType": "SBS"}, headers=XHR) or {}
        g = req("POST", f"{b}/{p}/require/studentGeneralList.php", headers=XHR, data={
            "request": "getStudentGeneralList", "studentList": 0, "teacherInfo": 0, "exams": 0, "dbs": 2,
            "attendance": 0, "exam": 0, "homework": 0, "course1": 0, "course2": 0, "library": 0}) or {}
        st = ((g.get("data") or {}).get("students") or [{}])[0]
        return {"success": True, "exams": ex.get("exams", []), "kpi": ex.get("kpi", {}),
                "lessonSuccess": ex.get("lessonSuccess", []), "dbs": (st.get("dbsInfo") or {}).get("list", []) or []}
    if name == "hwdetail":
        return req("GET", f"{b}/obsapi/homework/getHomeworkDetail", params={"id": arg})
    if name == "food":
        return req("POST", f"{b}/{p}/require/foodListAction.php", data={"request": "get-food-list"}, headers=XHR)
    if name == "receivers":
        return req("GET", f"{b}/obsapi/mail/getReceiverList", params={"q": arg})
    if name == "send":
        rc = json.dumps([{"type": str(arg["type"]), "id": str(arg["id"])}])
        return req("POST", f"{b}/obsapi/mail/sendMail", headers=XHR, data={
            "title": arg["title"], "content": arg["content"], "receivers": rc,
            "canReply": "true", "shouldReply": "false", "replyId": arg.get("replyId", "")})
    return {"success": False, "error": "bilinmeyen"}


def kr_load():
    if not keyring:
        return None
    try:
        v = keyring.get_password(KR_SERVICE, KR_USER)
        return json.loads(v) if v else None
    except Exception:
        return None


def kr_save(c):
    if not keyring:
        return False
    try:
        keyring.set_password(KR_SERVICE, KR_USER, json.dumps(c))
        return True
    except Exception:
        return False


def kr_clear():
    try:
        keyring and keyring.delete_password(KR_SERVICE, KR_USER)
    except Exception:
        pass


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _ok_host(self):
        return self.headers.get("Host", "").split(":")[0] in ("127.0.0.1", "localhost")

    def _send(self, code, body, ctype="application/json"):
        b = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; object-src 'self'")
        self.end_headers()
        self.wfile.write(b)

    def _guard(self, t=None):
        if not self._ok_host() or (self.headers.get("X-Glassly-Token") or t) != TOKEN:
            self._send(403, {"success": False, "error": "yetkisiz"})
            return False
        return True

    def _file(self, q):
        b = S.base
        if q.get("kind") == "food":
            h = (api("food") or {}).get("hash")
            r = S.http.get(f"{b}/download.php", params={"file": h, "view": ""}, timeout=25)
        else:
            r = None
            if q.get("h"):
                r = S.http.get(f"{b}/download.php", params={"file": q["h"]}, timeout=25)
            if r is None or not r.ok or not r.content:
                tk = req("GET", f"{b}/obsapi/homework/getHomeworkFileToken", params={
                    "homeworkId": q.get("id"), "fileId": q.get("fid"), "fileType": q.get("ft", "attachFiles")}) or {}
                r = S.http.get(f"{b}/obsapi/public/downloadFileByToken", params={"f": tk.get("token")}, timeout=25)
        if not r.ok or not r.content:
            return self._send(404, {"success": False, "error": "Dosya indirilemedi"})
        name = re.sub(r"[^\w.\- ]", "_", q.get("n") or "dosya")
        self.send_response(200)
        self.send_header("Content-Type", r.headers.get("Content-Type", "application/octet-stream").split(";")[0])
        self.send_header("Content-Disposition", f'{"inline" if q.get("kind") == "food" else "attachment"}; filename="{name}"')
        self.send_header("Content-Length", str(len(r.content)))
        self.end_headers()
        self.wfile.write(r.content)

    def do_GET(self):
        if not self._ok_host():
            return self._send(403, {})
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == "/":
            html = (HERE / "index.html").read_text(encoding="utf-8").replace("__TOKEN__", TOKEN)
            return self._send(200, html.encode(), "text/html")
        if not self._guard(q.get("t")):
            return
        try:
            if u.path == "/dl":
                return self._file(q)
            if u.path == "/api/saved":
                c = kr_load()
                return self._send(200, {"saved": bool(c), "base": (c or {}).get("base", ""),
                                        "tc": (c or {}).get("tc", ""), "keyring": bool(keyring)})
            name = u.path.split("/api/", 1)[1]
            return self._send(200, api(name, q.get("q") or q.get("id")) or {"success": False})
        except Exception as e:
            self._send(200, {"success": False, "error": str(e)})

    def do_POST(self):
        if not self._guard():
            return
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            if self.path == "/api/login":
                if body.get("auto"):
                    c = kr_load() or {}
                    body = {**c, "pw": c.get("pw", "")}
                ok = do_login(body["base"], body["tc"], body["pw"])
                if ok and body.get("remember"):
                    kr_save({"base": S.base, "tc": body["tc"], "pw": body["pw"]})
                return self._send(200, {"success": ok, "role": S.path.split("/")[-1]})
            if self.path == "/api/logout":
                kr_clear(); S.reset()
                return self._send(200, {"success": True})
            if self.path == "/api/send":
                return self._send(200, api("send", body) or {"success": False})
            if self.path == "/api/mailopen":
                return self._send(200, api("mailopen", body.get("id")) or {"success": False})
            self._send(404, {})
        except Exception as e:
            self._send(200, {"success": False, "error": str(e)})


def main():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{port}/"
    try:
        import webview
        webview.create_window("Glassly", url, width=1180, height=760, min_size=(900, 600))
        webview.start()
    except Exception:
        webbrowser.open(url)
        print("Glassly çalışıyor:", url, "(kapatmak için Ctrl+C)")
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
