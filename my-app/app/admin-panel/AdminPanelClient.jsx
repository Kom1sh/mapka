"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function AdminPanelClient() {
  // ===== API auto-detect =====
  const api = useMemo(() => {
    if (typeof window === "undefined") return { API_BASE: "", API_ORIGIN: "" };

    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";

    /**
     * ⚠️ ВРЕМЕННО ДЛЯ ОТЛАДКИ:
     * В DEV (localhost) ходим на продовый бэкенд mapka.рф вместо localhost:8000
     * Потом вернуть обратно на localhost:8000
     */
    if (isLocal) {
      return {
        API_BASE: "https://xn--80aa3agq.xn--p1ai/api",
        API_ORIGIN: "https://xn--80aa3agq.xn--p1ai/",
        IS_DEV_PROXY: true,
      };
    }

    return {
      API_BASE: `${window.location.origin}/api`,
      API_ORIGIN: window.location.origin,
      IS_DEV_PROXY: false,
    };
  }, []);

  const { API_BASE, API_ORIGIN } = api;

  // ===== UI state =====
  const [clubs, setClubs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [q, setQ] = useState("");
  const [filterApplied, setFilterApplied] = useState("");

  const [toast, setToast] = useState({ show: false, text: "" });
  const toastTimer = useRef(null);

  const [logText, setLogText] = useState("—");

  const fileInputRef = useRef(null);

  // ===== Form state =====
  const emptyForm = {
    name: "",
    slug: "",
    description: "",
    image: "",
    price_rub: "",
    location: "",
    lat: "", // ✅ optional
    lon: "", // ✅ optional
    schedules: "",
    phone: "",
    webSite: "",
    social_vk: "",
    social_telegram: "",
    tags: "",
    isFavorite: false,
  };

  const [form, setForm] = useState(emptyForm);

  const showToast = (text, ms = 2200) => {
    setToast({ show: true, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ show: false, text: "" }), ms);
  };

  const log = (msg) => {
    const t = new Date().toLocaleTimeString();
    setLogText((prev) => `[${t}] ${msg}\n` + (prev === "—" ? "" : prev));
  };

  // ===== API helpers (credentials include) =====
  const apiGet = async (url) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  };

  const apiPost = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status} ${res.statusText} ${txt}`);
    }
    return res.json();
  };

  const apiPut = async (url, body) => {
    let res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });

    // fallback to POST if PUT not allowed
    if (res.status === 405 || !res.ok) {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status} ${res.statusText} ${txt}`);
    }
    return res.json();
  };

  const apiDelete = async (url) => {
    const res = await fetch(url, { method: "DELETE", credentials: "include" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.text();
  };

  // ===== Auth check =====
  const ensureAuth = async () => {
    if (api.IS_DEV_PROXY) {
      log("DEV: пропускаю ensureAuth() из-за CORS. Нажми «Войти» (mapka.рф) и вернись сюда.");
      return;
    }

    try {
      const res = await fetch(`${API_ORIGIN}/admin`, {
        method: "GET",
        credentials: "include",
        redirect: "manual",
      });

      if (res.status === 200) return;

      window.location.href = `${API_ORIGIN}/admin/login`;
    } catch (err) {
      console.error("Auth check failed:", err);
      showToast("Не удалось проверить авторизацию");
      log("Auth check failed: " + String(err?.message || err));
    }
  };

  const openLogin = () => {
    window.open(`${API_ORIGIN}/admin/login`, "_blank", "noopener,noreferrer");
  };

  // ===== Data load =====
  const loadClubs = async () => {
    try {
      const arr = await apiGet(`${API_BASE}/clubs`);
      const normalized = (arr || []).map((x) => ({
        tags: [],
        isFavorite: false,
        schedules: [],
        socialLinks: {},
        ...x,
      }));
      setClubs(normalized);
      showToast("Список загружен");
      log(`Загружено ${normalized.length} кружков`);
    } catch (e) {
      console.error(e);
      showToast("Ошибка загрузки: " + e.message);
      log("Ошибка: " + e.message);
    }
  };

  const findClub = (id) => clubs.find((c) => String(c.id) === String(id)) || null;

  const fillFormFromClub = (obj) => {
    if (!obj) {
      setForm(emptyForm);
      return;
    }

    setForm({
      name: obj.name || "",
      slug: obj.slug || "",
      description: obj.description || "",
      image: obj.image || "",
      price_rub: obj.price_cents ? String(Number(obj.price_cents) / 100) : "",
      location: obj.location || "",
      lat: obj.lat != null ? String(obj.lat) : "",
      lon: obj.lon != null ? String(obj.lon) : "",
      schedules:
        Array.isArray(obj.schedules) && obj.schedules.length
          ? obj.schedules.map((s) => `${s.day || ""}|${s.time || ""}`).join("\n")
          : "",
      phone: obj.phone || "",
      webSite: obj.webSite || "",
      social_vk: obj.socialLinks?.vk || "",
      social_telegram: obj.socialLinks?.telegram || "",
      tags: Array.isArray(obj.tags) ? obj.tags.join(",") : "",
      isFavorite: !!obj.isFavorite,
    });
  };

  const selectItem = (id) => {
    setSelectedId(id);
    const obj = findClub(id);
    fillFormFromClub(obj);
  };

  const handleNew = () => {
    setSelectedId(null);
    fillFormFromClub(null);
    showToast('Создайте новый кружок и нажмите "Сохранить как новый"');
  };

  const parseSchedulesTextarea = (txt) => {
    return String(txt || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((p) => p.trim());
        return { day: parts[0] || "", time: parts[1] || "" };
      });
  };

  const parseNum = (v) => {
    const s = String(v ?? "").trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const getPayload = () => {
    const tags = String(form.tags || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const prRaw = form.price_rub ? String(form.price_rub).replace(",", ".") : "";
    const price_rub = prRaw ? Number(prRaw) : null;

    const schedules = parseSchedulesTextarea(form.schedules);

    const socialLinks = {};
    const vk = String(form.social_vk || "").trim();
    const tg = String(form.social_telegram || "").trim();
    if (vk) socialLinks.vk = vk;
    if (tg) socialLinks.telegram = tg;

    const latNum = parseNum(form.lat);
    const lonNum = parseNum(form.lon);

    const base = {
      name: String(form.name || "").trim(),
      slug: String(form.slug || "").trim(),
      description: String(form.description || "").trim(),
      image: String(form.image || "").trim(),
      location: String(form.location || "").trim(),
      tags,
      isFavorite: !!form.isFavorite,
      price_rub,
      phone: String(form.phone || "").trim(),
      webSite: String(form.webSite || "").trim(),
      socialLinks,
      schedules,
    };

    // ✅ координаты добавляем ТОЛЬКО если обе валидны
    if (latNum != null && lonNum != null) {
      return { ...base, lat: latNum, lon: lonNum };
    }
    return base;
  };

  const handleSave = async (asNew = false) => {
    const payload = getPayload();
    if (!payload.name) {
      showToast("Введите название");
      return;
    }

    try {
      if (!selectedId || asNew) {
        const created = await apiPost(`${API_BASE}/clubs`, payload);
        setClubs((prev) => [created, ...(prev || [])]);
        setSelectedId(created.id);
        fillFormFromClub(created);
        showToast("Создан новый кружок");
        log("Создан: " + created.id);
      } else {
        const updated = await apiPut(`${API_BASE}/clubs/${selectedId}`, payload);
        setClubs((prev) => (prev || []).map((c) => (String(c.id) === String(selectedId) ? updated : c)));
        fillFormFromClub(updated);
        showToast("Сохранено");
        log("Обновлен: " + selectedId);
      }
    } catch (e) {
      console.error(e);
      showToast("Ошибка сохранения: " + e.message);
      log("Ошибка при сохранении: " + e.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) {
      showToast("Нет выбранного кружка");
      return;
    }
    if (!confirm("Удалить кружок?")) return;

    try {
      await apiDelete(`${API_BASE}/clubs/${selectedId}`);
      setClubs((prev) => (prev || []).filter((c) => String(c.id) !== String(selectedId)));
      setSelectedId(null);
      fillFormFromClub(null);
      showToast("Удалено");
      log("Удалён");
    } catch (e) {
      console.error(e);
      showToast("Ошибка удаления: " + e.message);
      log("Ошибка удаления: " + e.message);
    }
  };

  // ===== Upload image =====
  const uploadImageFile = async (file) => {
    try {
      if (!selectedId) {
        showToast("Сначала сохраните кружок");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/clubs/${selectedId}/images`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      if (data.url) {
        const url = data.url.startsWith("/") ? API_ORIGIN + data.url : data.url;
        setForm((p) => ({ ...p, image: url }));
        setClubs((prev) => (prev || []).map((c) => (String(c.id) === String(selectedId) ? { ...c, image: url } : c)));
        showToast("Картинка загружена");
        log("Загружено изображение");
      }
    } catch (e) {
      showToast("Ошибка загрузки: " + e.message);
      log("Ошибка загрузки: " + e.message);
    }
  };

  const onDropPreview = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) await uploadImageFile(file);
  };

  const onPastePreview = async (e) => {
    const items = e.clipboardData?.items || [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) await uploadImageFile(file);
      }
    }
  };

  // ===== computed =====
  const displayedClubs = useMemo(() => {
    const qq = String(filterApplied || "").trim().toLowerCase();
    if (!qq) return clubs;
    return (clubs || []).filter((c) => {
      const name = String(c.name || "").toLowerCase();
      const tags = Array.isArray(c.tags) ? c.tags : [];
      const tagHit = tags.some((t) => String(t).toLowerCase().includes(qq));
      return name.includes(qq) || tagHit;
    });
  }, [clubs, filterApplied]);

  const previewUrl = useMemo(() => {
    const img = String(form.image || "").trim();
    if (!img) return "";
    return img.startsWith("/") ? API_ORIGIN + img : img;
  }, [form.image, API_ORIGIN]);

  const rightTags = useMemo(() => {
    return String(form.tags || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8);
  }, [form.tags]);

  // ===== init =====
  useEffect(() => {
    if (!API_BASE || !API_ORIGIN) return;

    (async () => {
      await ensureAuth();
      await loadClubs();
    })();

    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, API_ORIGIN]);

  return (
    <>
      <header>
        <h1>Mapka — Admin: Управление кружками</h1>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>API: {API_ORIGIN}</div>
          <button type="button" className="btn ghost" onClick={openLogin} title="Открыть логин в mapka.рф (в новой вкладке)">
            Войти
          </button>
        </div>
      </header>

      <div className="wrap">
        <aside className="left">
          <div className="toolbar">
            <button className="btn ghost" onClick={loadClubs} type="button">
              Обновить
            </button>
            <button className="btn" onClick={handleNew} type="button">
              Новый
            </button>
            <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={handleDelete} type="button">
              Удалить
            </button>
          </div>

          <div className="search">
            <input
              placeholder="Фильтр по названию или тегу"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setFilterApplied(q);
              }}
            />
            <button className="btn" type="button" onClick={() => setFilterApplied(q)}>
              Фильтр
            </button>
          </div>

          <div className="list" aria-live="polite">
            {displayedClubs.map((it) => {
              const selected = String(it.id) === String(selectedId);
              const price = it.price_cents ? `${Math.round(it.price_cents / 100)} ₽` : "";
              const loc = String(it.location || "").slice(0, 60);

              return (
                <div key={it.id} className={"item" + (selected ? " selected" : "")} onClick={() => selectItem(it.id)}>
                  <div className="meta">
                    <h4>{it.name || "—"}</h4>
                    <p>{loc}</p>
                  </div>
                  <div className="muted">{price}</div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="main">
          <div className="grid">
            <div className="card">
              <label>Название</label>
              <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />

              <label style={{ marginTop: 10 }}>Slug</label>
              <input type="text" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} />

              <label style={{ marginTop: 10 }}>Описание</label>
              <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />

              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <label>Image URL</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="text" style={{ flex: 1 }} value={form.image} onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))} />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) await uploadImageFile(file);
                        e.target.value = "";
                      }}
                    />
                    <button type="button" className="btn ghost" title="Загрузить картинку" onClick={() => fileInputRef.current?.click()}>
                      📁
                    </button>
                  </div>
                </div>

                <div style={{ width: 150 }}>
                  <label>Цена (₽)</label>
                  <input type="text" placeholder="1000" value={form.price_rub} onChange={(e) => setForm((p) => ({ ...p, price_rub: e.target.value }))} />
                </div>
              </div>

              <label style={{ marginTop: 10 }}>Адрес (location)</label>
              <input type="text" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />

              {/* ✅ optional coords */}
              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ width: 160 }}>
                  <label>lat (опц.)</label>
                  <input type="text" placeholder="47.2" value={form.lat} onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))} />
                </div>
                <div style={{ width: 160 }}>
                  <label>lon (опц.)</label>
                  <input type="text" placeholder="39.7" value={form.lon} onChange={(e) => setForm((p) => ({ ...p, lon: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }} />
              </div>

              <label style={{ marginTop: 10 }}>Расписание (по строке: День|время)</label>
              <textarea
                placeholder={"Понедельник|16:00-17:30\nСреда|16:00-17:30"}
                style={{ minHeight: 80 }}
                value={form.schedules}
                onChange={(e) => setForm((p) => ({ ...p, schedules: e.target.value }))}
              />

              <label style={{ marginTop: 10 }}>Contacts (телефон, сайт, соцссылки)</label>
              <input type="text" placeholder="+7 (___) ___-__-__" style={{ marginBottom: 6 }} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              <input type="text" placeholder="https://..." style={{ marginBottom: 6 }} value={form.webSite} onChange={(e) => setForm((p) => ({ ...p, webSite: e.target.value }))} />
              <input type="text" placeholder="VK URL (опционально)" style={{ marginBottom: 6 }} value={form.social_vk} onChange={(e) => setForm((p) => ({ ...p, social_vk: e.target.value }))} />
              <input type="text" placeholder="Telegram URL (опционально)" value={form.social_telegram} onChange={(e) => setForm((p) => ({ ...p, social_telegram: e.target.value }))} />

              <label style={{ marginTop: 10 }}>Tags (через запятую)</label>
              <input type="text" placeholder="каратэ,спорт,дети" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} />

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                <label style={{ margin: 0 }}>
                  <input type="checkbox" checked={form.isFavorite} onChange={(e) => setForm((p) => ({ ...p, isFavorite: e.target.checked }))} /> isFavorite
                </label>
                <div style={{ flex: 1 }} />
                <div className="muted">ID: {selectedId ?? "—"}</div>
              </div>

              <div className="actions">
                <button className="btn" type="button" onClick={() => handleSave(false)}>
                  Сохранить
                </button>
                <button className="btn ghost" type="button" onClick={() => handleSave(true)}>
                  Сохранить как новый
                </button>
              </div>
            </div>

            <div className="card">
              <label>Превью</label>
              <div
                className="preview"
                tabIndex={0}
                style={{ outline: "none" }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#2b87d4";
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#e6e9ec";
                }}
                onDrop={async (e) => {
                  e.currentTarget.style.borderColor = "#e6e9ec";
                  await onDropPreview(e);
                }}
                onPaste={onPastePreview}
                title="Drag&Drop / Paste для загрузки картинки"
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  "Нет изображения"
                )}
              </div>

              <label style={{ marginTop: 12 }}>Теги</label>
              <div className="tags">
                {rightTags.map((t) => (
                  <div className="tag" key={t}>
                    {t}
                  </div>
                ))}
              </div>

              <label style={{ marginTop: 10 }}>Лог</label>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }} className="muted-log">
                {logText}
              </div>
            </div>
          </div>
        </main>
      </div>

      <div id="toast" className={"toast" + (toast.show ? " show" : "")}>
        {toast.text}
      </div>
    </>
  );
}
