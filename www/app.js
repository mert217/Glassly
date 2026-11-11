const $ = s => document.querySelector(s);
function el(t, c, x) { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e }
const pick = (o, ks) => { for (const k of ks) if (o && o[k] != null && o[k] !== "") return String(o[k]).replace(/<[^>]*>/g, ""); return "" };
const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? null : n };
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h };
const TABS = [["home", "🏠", "Ana"], ["schedule", "📅", "Program"], ["homework", "📝", "Ödevler"], ["mail", "✉️", "Mesajlar"], ["more", "☰", "Daha"]];
const SUB = { exams: "Sınavlar", attendance: "Devamsızlık", food: "Yemekhane" };
let cur = "home", sheets = [];
const tabOf = v => SUB[v] ? "more" : v;
function toast(t) { const e = $("#toast"); e.textContent = t; e.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = "none", 2600) }
function theme(p) { if (p) localStorage.setItem("g.theme", p); p = localStorage.getItem("g.theme") || "system"; document.documentElement.dataset.theme = p === "system" ? "" : p }
theme();

/* ---- giriş / PIN ---- */
function screen(n) { for (const s of ["login", "pin", "app"]) $("#" + s).style.display = s === n ? (s === "app" ? "flex" : "grid") : "none" }
async function doLogin(base, tc, pw, remember) {
  let ok = false; try { ok = await G.login(base, tc, pw) } catch (e) { return e.message || "Bağlanılamadı." }
  if (!ok) return "Giriş başarısız. Bilgileri kontrol et.";
  if (remember) { const pin = await askPin(); if (pin) { await G.vault.save(pin, { base: G.ST.base, tc, pw }); toast("PIN ile kaydedildi 🔒") } }
  enterApp(); return "";
}
function askPin() {
  return new Promise(res => sheet((b, close) => {
    b.append(el("h2", "", "PIN belirle"), el("p", "mu", "Bilgilerin bu PIN ile şifrelenir. 4–6 rakam."));
    const i = el("input"); i.type = "password"; i.inputMode = "numeric"; i.maxLength = 6; const e = el("div", "err"), ok = el("button", "full", "Kaydet"), no = el("button", "full soft", "Vazgeç"); no.style.marginTop = "10px";
    ok.onclick = () => { if (!/^\d{4,6}$/.test(i.value)) return e.textContent = "4–6 rakam gir."; res(i.value); close(true) }; no.onclick = () => { res(null); close(true) };
    b.append(i, e, ok, no); b._cancel = () => res(null);
  }));
}
$("#go").onclick = async () => { $("#err").textContent = ""; $("#go").textContent = "Bağlanıyor…"; const m = await doLogin($("#base").value, $("#tc").value.trim(), $("#pw").value, $("#rem").checked); $("#go").textContent = "Giriş yap"; $("#err").textContent = m; if (!m) $("#pw").value = "" };
$("#pinok").onclick = async () => {
  $("#pinerr").textContent = ""; let c;
  try { c = await G.vault.open($("#pinin").value) } catch (e) { $("#pinin").value = ""; if (e.message === "WIPED") { toast("Çok fazla hata, kayıtlı giriş silindi"); return screen("login") } return $("#pinerr").textContent = e.message }
  $("#pinok").textContent = "Bağlanıyor…"; let ok = false; try { ok = await G.login(c.base, c.tc, c.pw) } catch (e) {}
  $("#pinok").textContent = "Aç"; if (ok) { $("#pinin").value = ""; enterApp() } else $("#pinerr").textContent = "Giriş yapılamadı. İnternetini ve şifreni kontrol et.";
};
$("#pinforget").onclick = () => { G.vault.wipe(); screen("login") };

/* ---- iskelet ---- */
function enterApp() { screen("app"); const t = $("#tabs"); if (!t.children.length) TABS.forEach(([v, i, n]) => { const a = el("a"); a.dataset.v = v; a.append(el("i", "", i), el("span", "", n)); a.onclick = () => show(v); t.append(a) }); show("home") }
async function show(v, force) {
  cur = v; document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.v === tabOf(v)));
  const m = $("#main"); $("#fab").style.display = v === "mail" ? "block" : "none"; $("#back").style.display = SUB[v] ? "block" : "none";
  $("#ttl").textContent = SUB[v] || ({ home: greet(), schedule: "Ders programı", homework: "Ödevler", mail: "Mesajlar", more: "Daha" })[v];
  m.replaceChildren(el("div", "spin")); m.scrollTop = 0;
  try { await V[v](m) } catch (e) { const d = el("div", "empty", "Veri alınamadı 😕"); const r = el("button", "", "Tekrar dene"); r.onclick = () => show(v); const er = el("small", "", String(e.message || e)); er.style.userSelect = "text"; d.append(el("br"), er, el("br"), el("br"), r); m.replaceChildren(d) }
}
$("#back").onclick = () => show("more");
const greet = () => { const h = new Date().getHours(); return h < 6 ? "İyi geceler 🌙" : h < 12 ? "Günaydın ☀️" : h < 18 ? "İyi günler 👋" : "İyi akşamlar 🌆" };
const card = (a, b, pills, tap) => { const d = el("div", "c" + (tap ? " tap" : "")); d.append(el("b", "", a)); if (b) d.append(el("small", "", b)); if (pills && pills.length) { d.append(el("br")); pills.filter(p => p && p[0]).forEach(p => d.append(el("span", "pill " + (p[1] || ""), p[0]))) } return d };
const empty = (m, t) => m.append(el("div", "empty", t));
const sec = (m, t) => m.append(el("h3", "", t));

/* ---- bottom sheet ---- */
function sheet(build) {
  const o = el("div", "ov"), s = el("div", "sh"), g = el("div", "gr"); s.append(g); o.append(s);
  const close = silent => { if (!silent && s._cancel) s._cancel(); o.remove(); sheets = sheets.filter(x => x !== o) }; o._close = close;
  o.onclick = e => { if (e.target === o) close() };
  let y0 = null; g.ontouchstart = e => y0 = e.touches[0].clientY; g.ontouchmove = e => { const d = e.touches[0].clientY - y0; if (d > 0) s.style.transform = `translateY(${d}px)` }; g.ontouchend = e => { if (e.changedTouches[0].clientY - y0 > 90) close(); else s.style.transform = "" };
  build(s, close); document.body.append(o); sheets.push(o); return o;
}

/* ---- veri yardımcıları ---- */
const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"], todayIdx = () => (new Date().getDay() + 6) % 7 + 1;
async function sched() { const r = await G.api.home(), s = ((r && r.data || {}).lessonSchedule || {}).data || {}; return { x: s.xInfo || [], y: s.yInfo || [], l: s.data || [], raw: (r && r.data) || {} } }
const nowIn = s => { const m = /(\d+):(\d+)\s*-\s*(\d+):(\d+)/.exec(s || ""); if (!m) return false; const n = new Date().getHours() * 60 + new Date().getMinutes(); return n >= +m[1] * 60 + +m[2] && n <= +m[3] * 60 + +m[4] };
function lesson(l, S, now) {
  const t = l.text || [], slot = (S.x[l.x - 1] || ["?"])[0], d = el("div", "c les"); d.style.setProperty("--h", hue(t[1] || ""));
  const tm = el("div", "tm"); tm.innerHTML = ""; slot.split("-").forEach((p, i) => { if (i) tm.append(el("br")); tm.append(document.createTextNode(p.trim())) });
  const b = el("div"); b.append(el("b", "", (t[1] || "-").trim()), el("small", "", "👤 " + (t[0] || "-").trim())); d.append(tm, b); if (now && nowIn(slot)) d.classList.add("now"); return d
}
async function openFile(kind, o, name) { toast("İndiriliyor…"); try { await G.saveShare(await G.fileB64(kind, o), name) } catch (e) { toast("Dosya açılamadı") } }

/* ---- görünümler ---- */
const V = {
  async home(m) {
    const S = await sched(), di = todayIdx(), L = S.l.filter(l => l.y === di).sort((a, b) => a.x - b.x); m.replaceChildren();
    const nowL = L.find(l => nowIn((S.x[l.x - 1] || [])[0])), next = nowL || L.find(l => { const sl = (S.x[l.x - 1] || [""])[0], mm = /(\d+):(\d+)/.exec(sl); return mm && +mm[1] * 60 + +mm[2] > new Date().getHours() * 60 + new Date().getMinutes() });
    const hero = el("div", "c hero"); if (next) { const t = next.text || []; hero.append(el("small", "", nowL ? "Şu an" : "Sıradaki ders"), el("b", "", (t[1] || "-").trim()), el("small", "", "⏰ " + (S.x[next.x - 1] || ["?"])[0] + "  •  👤 " + (t[0] || "-").trim())) } else hero.append(el("b", "", L.length ? "Bugünkü dersler bitti 🎉" : "Bugün ders yok 🌿"), el("small", "", "Dinlen, hak ettin!")); m.append(hero);
    if (L.length) { sec(m, "Bugünün programı"); L.forEach(l => m.append(lesson(l, S, true))) }
    const an = S.raw.announcementList || []; if (an.length) { sec(m, "Duyurular"); an.slice(0, 6).forEach(a => m.append(card(pick(a, ["title", "headerTitle", "name"]) || "Duyuru", pick(a, ["date", "startDate"]), [[pick(a, ["text", "content", "description"]).slice(0, 100)]]))) }
  },
  async schedule(m) {
    const S = await sched(); m.replaceChildren(); if (!S.y.length) return empty(m, "Ders programı alınamadı.");
    let day = Math.min(todayIdx(), S.y.length), mode = "day"; const seg = el("div", "seg"), body = el("div"); body.dataset.swipe = 1; m.append(seg, body);
    const draw = () => { seg.replaceChildren(); [["day", "Günlük"], ["week", "Haftalık"]].forEach(([k, n]) => { const a = el("a", mode === k ? "on" : "", n); a.onclick = () => { mode = k; draw() }; seg.append(a) }); body.replaceChildren();
      if (mode === "week") { const w = el("div", "tw"), t = el("table"), h = el("tr"); h.append(el("th")); S.y.forEach(y => h.append(el("th", "", y[0].slice(0, 3)))); t.append(h);
        S.x.forEach((xs, xi) => { const tr = el("tr"); tr.append(el("td", "sl", xs[0])); S.y.forEach((_, yi) => { const l = S.l.find(z => z.x === xi + 1 && z.y === yi + 1), td = el("td"); if (l) { const tx = l.text || []; td.append(el("b", "", (tx[1] || "-").trim()), el("br"), el("small", "", (tx[0] || "").trim())) } tr.append(td) }); t.append(tr) }); w.append(t); body.append(w); return }
      const ch = el("div", "chips"); S.y.forEach((y, i) => { const c = el("a", "chip" + (i + 1 === day ? " on" : "") + (i + 1 === todayIdx() ? " td" : ""), y[0].slice(0, 3)); c.onclick = () => { day = i + 1; draw() }; ch.append(c) }); body.append(ch);
      const L = S.l.filter(l => l.y === day).sort((a, b) => a.x - b.x); L.forEach(l => body.append(lesson(l, S, day === todayIdx()))); if (!L.length) empty(body, "Bu gün ders yok 🌿"); body.append(el("div", "empty mu", "← kaydırarak günleri değiştir →")) };
    body._swipe = d => { if (mode === "day") { day = Math.max(1, Math.min(S.y.length, day + d)); draw() } }; draw();
  },
  async homework(m) {
    const L = await G.api.homework(); m.replaceChildren(); if (!L.length) return empty(m, "Hiç ödev yok 🎉");
    L.forEach(h => { const c = card(pick(h, ["title"]) || "Ödev", [pick(h, ["lesson"]), pick(h, ["teaNameSurname"])].filter(Boolean).join(" • "), [[pick(h, ["statusName"]), "ok"], [pick(h, ["endDate"]) && "📆 " + pick(h, ["endDate"])], [pick(h, ["attachFileCount"]) && "📎 " + pick(h, ["attachFileCount"])]], 1); c.onclick = () => hwOpen(h); m.append(c) });
  },
  async mail(m) {
    const r = await G.api.mail(); m.replaceChildren(); let box = el("div"), idx = 0; const seg = el("div", "seg"); m.append(seg, box);
    const draw = () => { seg.replaceChildren(); ["Gelen", "Giden"].forEach((n, i) => { const a = el("a", idx === i ? "on" : "", n); a.onclick = () => { idx = i; draw() }; seg.append(a) }); box.replaceChildren(); const L = idx ? r.sent : r.inbox;
      L.forEach(x => { const c = card(pick(x, ["mailTitle"]) || "(başlıksız)", pick(x, ["sender", "receiver", "recipient"]) + " • " + pick(x, ["sendDate", "date"]), [[pick(x, ["mailPreview"]).slice(0, 90)]], 1); c.onclick = () => mailOpen(x); box.append(c) }); if (!L.length) empty(box, "Mesaj yok 📭") };
    draw();
  },
  async more(m) {
    m.replaceChildren(); const item = (ic, t, s, f) => { const c = el("div", "c tap row"); c.append(el("span", "ic", ic)); const d = el("div"); d.append(el("b", "", t)); if (s) d.append(el("small", "", s)); c.append(d, el("span", "gt", "›")); c.onclick = f; m.append(c) };
    item("📊", "Sınavlar", "Puan, net, oran", () => show("exams")); item("🗓️", "Devamsızlık", "Kayıtlar ve dağılım", () => show("attendance")); item("🍽️", "Yemekhane", "Aylık yemek listesi", () => show("food"));
    sec(m, "Görünüm"); const seg = el("div", "seg"), cu = localStorage.getItem("g.theme") || "system";
    [["system", "Sistem"], ["light", "☀️ Açık"], ["dark", "🌙 Koyu"]].forEach(([k, n]) => { const a = el("a", cu === k ? "on" : "", n); a.onclick = () => { theme(k); V.more(m) }; seg.append(a) }); m.append(seg);
    sec(m, "Hesap"); if (G.vault.exists()) item("🔒", "Kayıtlı girişi sil", "PIN ve şifre bu telefondan silinir", () => { G.vault.wipe(); toast("Silindi"); V.more(m) });
    item("🛠️", "Bağlantı testi", "Sorun olursa ekran görüntüsünü gönder", () => sheet(async b => { b.append(el("h2", "", "Bağlantı testi"), el("div", "spin")); const t = await G.diag().catch(e => "HATA: " + e.message); const p = el("div", "msg", t); p.style.fontSize = "13px"; b.querySelector(".spin").replaceWith(p) }));
    item("🚪", "Çıkış yap", "", async () => { await G.logout(); $("#pw").value = ""; G.vault.exists() ? screen("pin") : screen("login") });
  },
  async exams(m) {
    const r = await G.api.exams(), k = r.kpi || {}, ex = r.exams || []; m.replaceChildren();
    const K = [["Sınav", k.examCount || ex.length], ["Ortalama puan", k.avgPoint], ["Son puan", k.lastPoint], ["En yüksek", k.maxPoint], ["Ort. başarı", k.avgSuccess != null ? "%" + k.avgSuccess : null]].filter(z => z[1] != null && z[1] !== "");
    if (K.length) { const g = el("div", "kpis"); K.forEach(([l, v]) => { const c = el("div", "c"); c.append(el("div", "kpi", String(v)), el("small", "", l)); g.append(c) }); m.append(g) }
    const ls = r.lessonSuccess || []; if (ls.length) { sec(m, "Ders başarı oranı"); ls.forEach(l => { const rate = num(l.successRate != null ? l.successRate : l.rate) || 0, c = card(pick(l, ["lesson", "name", "title"]) || "Ders", null, [[rate.toFixed(0) + "%", rate >= 50 ? "ok" : "bad"]]), b = el("div", "bar"), i = el("i"); i.style.width = Math.min(100, rate) + "%"; b.append(i); c.append(b); m.append(c) }) }
    sec(m, "Deneme sınavları"); if (!ex.length) empty(m, "Deneme sınavı yok.");
    ex.forEach(e => { const d = num(e.dogru), y = num(e.yanlis), n = num(e.questionCount); m.append(card(e.examName || "Sınav", e.examDate, [[e.point != null && "🎯 " + e.point + " puan"], [e.net != null && "Net " + e.net], [d != null && "✅ " + d + "  ❌ " + (y || 0)], [d != null && n && "%" + (100 * d / n).toFixed(0), "ok"], [e.SD && "Sınıf " + e.SD], [e.GD && "Genel " + e.GD]])) });
    const dbs = r.dbs || []; if (dbs.length) { sec(m, "Tarama sınavları"); dbs.forEach(d => { let D = 0, Y = 0, S = 0; for (let i = 1; i <= 10; i++) { D += +d["D" + i] || 0; Y += +d["Y" + i] || 0; S += +d["SS" + i] || 0 } m.append(card(d.sinavAd || "Sınav", d.sinavTarih, [[d.Puan != null && "🎯 " + d.Puan + " puan"], ["Net " + (D - Y / 3).toFixed(2)], ["✅ " + D + "  ❌ " + Y], [S && "%" + (100 * D / S).toFixed(0), "ok"]])) }) }
  },
  async attendance(m) {
    const r = await G.api.attendance(), L = r.list || []; m.replaceChildren();
    const g = el("div", "kpis"), c = el("div", "c"); c.append(el("div", "kpi", String(L.length)), el("small", "", "Devamsız ders saati")); g.append(c); m.append(g);
    if (!L.length) return empty(m, "Devamsızlık kaydın yok ✨"); const by = {}; L.forEach(a => { const k = pick(a, ["lesson"]) || "Ders"; by[k] = (by[k] || 0) + 1 });
    sec(m, "Derslere göre"); Object.entries(by).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => m.append(card(k, null, [[v + " saat", "bad"]])));
    sec(m, "Tüm kayıtlar"); L.forEach(a => m.append(card(pick(a, ["lesson"]) || "Ders", [pick(a, ["absenceDate"]), pick(a, ["teaNameSurname"])].filter(Boolean).join(" • "), [[pick(a, ["lessonNo"]) && pick(a, ["lessonNo"]) + ". ders"], [pick(a, ["description"]) || "Devamsız", "bad"], [pick(a, ["note"])]])));
  },
  async food(m) { m.replaceChildren(); m.append(el("div", "empty", "Bu ayın yemek listesi PDF olarak geliyor 🍽️")); const b = el("button", "full", "📄 Listeyi aç"); b.onclick = () => openFile("food", {}, "yemek-listesi.pdf"); m.append(b) },
};
function files(b, t, L, id, ft) { if (!L || !L.length) return; b.append(el("h3", "", t)); L.forEach(f => { const a = el("a", "f", "📎 " + (f.fileName || "Dosya")); a.onclick = () => openFile("hw", { id, fid: f.fileId || "", hash: f.fileHash || "", ft }, f.fileName || "dosya"); b.append(a) }) }
function hwOpen(h) { sheet(b => { const body = el("div"), title = pick(h, ["title"]) || "Ödev"; b.append(body); body.append(el("h2", "", title), el("div", "spin"));
  G.api.hwDetail(h.id).catch(() => ({})).then(d => { body.replaceChildren(el("h2", "", title), el("small", "mu", [pick(h, ["lesson"]), pick(h, ["teaNameSurname"]), pick(h, ["endDate"])].filter(Boolean).join(" • ")));
    if (d.konuAd) body.append(el("div"), el("span", "pill", d.konuAd)); body.append(el("div", "msg", pick(d, ["description"]) || "Öğretmen açıklama eklememiş."));
    if (d.teacherComment) body.append(el("h3", "", "Öğretmen notu"), el("div", "msg", pick(d, ["teacherComment"])));
    files(body, "Ek dosyalar", d.attachFiles, h.id, "attachFiles"); files(body, "Cevap anahtarı", d.answerFiles, h.id, "answerFiles"); files(body, "Teslim ettiğin dosyalar", d.studentAttachFiles, h.id, "studentAttachFiles") }) }) }
function mailOpen(x) { sheet(async b => { b.append(el("h2", "", pick(x, ["mailTitle"]) || "Mesaj"), el("small", "mu", pick(x, ["sender", "receiver", "recipient"]) + " • " + pick(x, ["sendDate", "date"])), el("div", "spin"));
  const z = await G.api.mailOpen(x.id).catch(() => null); b.querySelector(".spin").replaceWith(el("div", "msg", pick(((z || {}).data || {}).mailContent || {}, ["mailContent", "content", "text"]) || "İçerik alınamadı.")) }) }
function compose() { sheet((b, close) => { let rc = null; b.append(el("h2", "", "Yeni mesaj")); const s = el("input"); s.placeholder = "Alıcı ara (öğretmen adı)…"; const res = el("div", "res"), pk = el("small", "mu", "Alıcı seçilmedi");
  let tm; s.oninput = () => { clearTimeout(tm); tm = setTimeout(async () => { if (s.value.length < 2) return; const L = await G.api.receivers(s.value).catch(() => []); res.replaceChildren(); L.forEach(x => { const d = el("div", "", (x.nameSurname || x.teaNameSurname || "?") + " • " + (x.type || "")); d.onclick = () => { if (!x.userId && x.id) { const r = String(x.id); x = { ...x, userType: r.length > 1 ? r[0] : 3, userId: r.length > 1 ? r.slice(1) : r } } rc = x; pk.textContent = "Alıcı: " + (x.nameSurname || x.teaNameSurname); res.replaceChildren() }; res.append(d) }) }, 300) };
  const t = el("input"); t.placeholder = "Başlık (en az 5 karakter)"; const c = el("textarea"); c.rows = 6; c.placeholder = "Mesajın (en az 10 karakter)"; const e = el("div", "err"), go = el("button", "full", "Gönder");
  go.onclick = async () => { e.textContent = ""; if (!rc) return e.textContent = "Önce alıcı seç."; if (t.value.length < 5 || c.value.length < 10) return e.textContent = "Başlık en az 5, mesaj en az 10 karakter olmalı."; go.textContent = "Gönderiliyor…"; const r = await G.api.send({ title: t.value, content: c.value, type: rc.userType, id: rc.userId }).catch(() => null); go.textContent = "Gönder"; if (r && r.success) { close(); toast("Gönderildi ✅"); show("mail") } else e.textContent = (r && (r.msg || r.error)) || "Gönderilemedi." };
  b.append(s, res, pk, el("br"), el("br"), t, c, e, go) }) }
$("#fab").onclick = compose;

/* ---- dokunmatik: yana kaydır = sekme/gün, aşağı çek = yenile ---- */
let sx, sy, pt = null, ptd = 0;
document.addEventListener("touchstart", e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; pt = (!sheets.length && $("#main").contains(e.target) && $("#main").scrollTop === 0) ? sy : null; ptd = 0 }, { passive: true });
document.addEventListener("touchmove", e => { if (pt == null) return; ptd = e.touches[0].clientY - pt; $("#ptr").style.transform = `translateY(${Math.max(0, Math.min(ptd, 100)) - 60}px) rotate(${ptd * 3}deg)` }, { passive: true });
document.addEventListener("touchend", e => {
  const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; $("#ptr").style.transform = "";
  if (pt != null && ptd > 90 && Math.abs(dx) < 50) return show(cur, true);
  if (sheets.length || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || e.target.closest(".tw,.chips") || !$("#main").contains(e.target)) return;
  const sw = e.target.closest("[data-swipe]"); if (sw && sw._swipe) return sw._swipe(dx < 0 ? 1 : -1);
  const i = TABS.findIndex(z => z[0] === tabOf(cur)), n = i + (dx < 0 ? 1 : -1); if (n >= 0 && n < TABS.length) show(TABS[n][0]);
}, { passive: true });

/* ---- Android geri tuşu ---- */
try { G.listen("App", "backButton", () => { if (sheets.length) sheets[sheets.length - 1]._close(); else if (SUB[cur]) show("more"); else if (cur !== "home" && $("#app").style.display === "flex") show("home"); else Capacitor.nativeCallback("App", "exitApp", {}) }) } catch (e) {}
G.vault.exists() ? screen("pin") : screen("login");
