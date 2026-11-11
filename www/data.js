/* Glassly veri katmanı: okul sunucusuyla doğrudan telefondan konuşur (CapacitorHttp). */
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const ST = { base: "", path: "pages/student", creds: null };
  /* Capacitor'un yerel köprüsü: bundler olmadan tek güvenilir yol nativePromise'tir. */
  const NP = async (pl, m, o) => {
    try { return await W.Capacitor.nativePromise(pl, m, o || {}); }
    catch (e) { throw new Error((e && (e.message || e.errorMessage)) || JSON.stringify(e) || "yerel köprü hatası"); }
  };
  const listen = (pl, ev, cb) => W.Capacitor.nativeCallback(pl, "addListener", { eventName: ev }, cb);
  const need = (r, n) => { if (!r || typeof r !== "object" || r.error) throw new Error(n + ": " + ((r && r.error) || "sunucudan yanıt gelmedi")); return r; };
  const strs = o => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, String(v)]));

  async function raw(method, url, { params, form, xhr, blob } = {}) {
    const o = { url, method, headers: xhr ? { "X-Requested-With": "XMLHttpRequest" } : {}, connectTimeout: 12000, readTimeout: 25000 };
    if (params) o.params = strs(params);
    if (form) { o.headers["Content-Type"] = "application/x-www-form-urlencoded"; o.data = strs(form); }
    if (blob) o.responseType = "blob";
    return NP("CapacitorHttp", "request", o);
  }
  async function http(method, url, o) {
    const r = await raw(method, url, o); let d = r.data;
    if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) {} }
    return d;
  }
  function normUrl(u) {
    u = (u || "").trim().replace(/\/+$/, "");
    if (!/^https?:\/\//.test(u)) u = "https://" + u;
    if (!/^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(u)) throw new Error("Geçerli bir https:// okul adresi gir.");
    const h = u.slice(8).split(":")[0];
    if (/^[\d.]+$/.test(h) || !h.includes(".")) throw new Error("Geçerli bir okul alan adı gir.");
    return u;
  }
  async function role() {
    try {
      const t = await http("GET", ST.base + "/require/menuLoader.php");
      if (typeof t === "string" && t.includes("window.obsNavData = ")) {
        const d = JSON.parse(t.split("window.obsNavData = ")[1].split("};")[0] + "}");
        const veli = d.key === "parent" || JSON.stringify(d.brand || {}).toLowerCase().includes("veli");
        ST.path = (d.base || "pages/" + (veli ? "parent" : "student") + "/").replace(/^\/+|\/+$/g, "");
      }
    } catch (e) {}
  }
  async function login(base, tc, pw) {
    ST.base = normUrl(base);
    const r = await http("POST", ST.base + "/require/class/login.php", { form: { request: "login", loginAs: "standard", isRegister: "0", username: tc, password: pw, newUser: "0" } });
    const ok = !!(r && r.success);
    if (ok) { ST.creds = { base: ST.base, tc, pw }; await role(); }
    return ok;
  }
  async function req(method, url, o) {
    for (let i = 0; i < 2; i++) {
      const j = await http(method, url, o);
      if (j && typeof j === "object" && j.error === "Login required" && i === 0 && ST.creds) {
        if (await login(ST.creds.base, ST.creds.tc, ST.creds.pw)) continue;
      }
      return j;
    }
    return null;
  }
  const b = () => ST.base, p = () => ST.path;
  const api = {
    home: async () => need(await req("POST", `${b()}/${p()}/require/indexAction.php`, { form: { request: "loadIndex" }, xhr: 1 }), "Ana sayfa"),
    homework: async () => { const r = await req("GET", `${b()}/obsapi/homework/getHomeworkList`); if (!r) throw new Error("Ödevler: sunucudan yanıt gelmedi"); if (r.error) throw new Error("Ödevler: " + r.error); return Array.isArray(r) ? r : (r.data || []); },
    hwDetail: async id => { const r = await req("GET", `${b()}/obsapi/homework/getHomeworkDetail`, { params: { id } }); return (r && r.data) || {}; },
    mail: async () => {
      const i = need(await req("GET", `${b()}/obsapi/mail/getInbox`), "Mesajlar"), s = (await req("GET", `${b()}/obsapi/mail/getSentMail`)) || {};
      return { inbox: (i.data || {}).mail || [], sent: (s.data || {}).mail || [] };
    },
    mailOpen: id => req("POST", `${b()}/obsapi/mail/getMailContent`, { form: { mailId: id } }),
    receivers: async q => { const r = await req("GET", `${b()}/obsapi/mail/getReceiverList`, { params: { q } }); return (r && r.data) || []; },
    send: o => req("POST", `${b()}/obsapi/mail/sendMail`, { xhr: 1, form: {
      title: o.title, content: o.content, receivers: JSON.stringify([{ type: String(o.type), id: String(o.id) }]),
      canReply: "true", shouldReply: "false", replyId: o.replyId || "" } }),
    attendance: async () => {
      const ep = `${b()}/${p()}/require/attendanceDashboard.php`;
      const init = need(await req("POST", ep, { form: { request: "load-attendance-initial-data" }, xhr: 1 }), "Devamsızlık");
      const per = init.periods || []; let list = [];
      if (per.length) { const x = (await req("POST", ep, { form: { request: "get-attendance-graph-7", periodId: per[0].id }, xhr: 1 })) || {}; list = x.list || []; }
      return { periods: per, list };
    },
    exams: async () => {
      const ex = need(await req("POST", `${b()}/${p()}/require/examDashboard.php`, { form: { request: "getStudentExams", examType: "SBS" }, xhr: 1 }), "Sınavlar");
      const g = (await req("POST", `${b()}/${p()}/require/studentGeneralList.php`, { xhr: 1, form: {
        request: "getStudentGeneralList", studentList: 0, teacherInfo: 0, exams: 0, dbs: 2, attendance: 0, exam: 0, homework: 0, course1: 0, course2: 0, library: 0 } })) || {};
      const st = ((g.data || {}).students || [{}])[0] || {};
      return { exams: ex.exams || [], kpi: ex.kpi || {}, lessonSuccess: ex.lessonSuccess || [], dbs: (st.dbsInfo || {}).list || [] };
    },
    food: () => req("POST", `${b()}/${p()}/require/foodListAction.php`, { form: { request: "get-food-list" }, xhr: 1 }),
  };

  /* Dosya indirme -> base64 */
  async function fileB64(kind, o) {
    let r = null;
    if (kind === "food") {
      const f = (await api.food()) || {};
      r = await raw("GET", `${b()}/download.php`, { params: { file: f.hash || "", view: "" }, blob: 1 });
    } else {
      if (o.hash) { try { r = await raw("GET", `${b()}/download.php`, { params: { file: o.hash }, blob: 1 }); } catch (e) { r = null; } }
      if (!r || !r.data || r.status >= 400) {
        const tk = (await req("GET", `${b()}/obsapi/homework/getHomeworkFileToken`, { params: { homeworkId: o.id, fileId: o.fid, fileType: o.ft || "attachFiles" } })) || {};
        r = await raw("GET", `${b()}/obsapi/public/downloadFileByToken`, { params: { f: tk.token || "" }, blob: 1 });
      }
    }
    if (!r || !r.data || r.status >= 400) throw new Error("Dosya indirilemedi");
    return r.data;
  }
  async function saveShare(b64, name) {
    name = String(name || "dosya").replace(/[^\w.\- ]/g, "_");
    const w = await NP("Filesystem", "writeFile", { path: name, data: b64, directory: "CACHE" });
    await NP("Share", "share", { title: name, url: w.uri, dialogTitle: "Aç veya kaydet" });
  }

  /* PIN ile korunan kasa: AES-GCM + PBKDF2. Şifre düz metin olarak hiç saklanmaz. */
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = u => btoa(String.fromCharCode(...u)), unb = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const LS = () => W.localStorage;
  async function dkey(pin, salt) {
    const k = await W.crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
    return W.crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, k, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  const vault = {
    exists: () => !!LS().getItem("g.vault"),
    wipe: () => { LS().removeItem("g.vault"); LS().removeItem("g.fails"); },
    async save(pin, obj) {
      const salt = W.crypto.getRandomValues(new Uint8Array(16)), iv = W.crypto.getRandomValues(new Uint8Array(12));
      const ct = await W.crypto.subtle.encrypt({ name: "AES-GCM", iv }, await dkey(pin, salt), enc.encode(JSON.stringify(obj)));
      LS().setItem("g.vault", JSON.stringify({ s: b64(salt), i: b64(iv), c: b64(new Uint8Array(ct)) })); LS().setItem("g.fails", "0");
    },
    async open(pin) {
      const v = JSON.parse(LS().getItem("g.vault"));
      try {
        const o = JSON.parse(dec.decode(await W.crypto.subtle.decrypt({ name: "AES-GCM", iv: unb(v.i) }, await dkey(pin, unb(v.s)), unb(v.c))));
        LS().setItem("g.fails", "0"); return o;
      } catch (e) {
        const n = (+LS().getItem("g.fails") || 0) + 1; LS().setItem("g.fails", String(n));
        if (n >= 5) { vault.wipe(); throw new Error("WIPED"); }
        throw new Error("PIN yanlış (" + (5 - n) + " hakkın kaldı)");
      }
    },
  };
  async function logout() { ST.creds = null; ST.base = ""; try { await NP("CapacitorCookies", "clearAllCookies"); } catch (e) {} }

  /* Bağlantı testi: sorun olursa ekran görüntüsüyle gönderilebilir (şifre yazmaz). */
  async function diag() {
    const L = [], add = s => L.push(s), C = W.Capacitor || {};
    add("Köprü: " + (C.nativePromise ? "var" : "YOK") + " | platform: " + (C.getPlatform ? C.getPlatform() : "?"));
    add("Okul: " + (ST.base || "-") + " | yol: " + ST.path);
    const t = async (n, m, u, o) => { try { const r = await raw(m, u, o); const d = typeof r.data === "string" ? r.data : JSON.stringify(r.data); add(n + ": HTTP " + r.status + " → " + String(d).replace(/\s+/g, " ").slice(0, 150)); } catch (e) { add(n + ": HATA " + e.message); } };
    await t("menü", "GET", b() + "/require/menuLoader.php");
    await t("ana", "POST", `${b()}/${p()}/require/indexAction.php`, { form: { request: "loadIndex" }, xhr: 1 });
    await t("ödev", "GET", b() + "/obsapi/homework/getHomeworkList");
    return L.join("\n");
  }
  const G = { ST, login, api, fileB64, saveShare, vault, logout, normUrl, NP, listen, diag };
  if (typeof module !== "undefined" && module.exports) module.exports = G; else W.G = G;
})();
