"use client";

import React, { useMemo, useRef } from "react";

const PRICING_GROUPS = [
  { value: "one_time", label: "Разовое" },
  { value: "subscription", label: "Абонементы" },
  { value: "individual", label: "Индивидуально" },
  { value: "extra", label: "Дополнительно" },
];

function makeId(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function safeString(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeItems(value) {
  return asArray(value)
    .map((x) => (x && typeof x === "object" ? x : null))
    .filter(Boolean)
    .map((x) => ({
      id: safeString(x.id) || makeId("pricing"),
      group: safeString(x.group || x.type) || "one_time",
      title: safeString(x.title),
      subtitle: safeString(x.subtitle),
      badge: safeString(x.badge),
      unit: safeString(x.unit),
      price_rub: safeString(x.price_rub),
      price_text: safeString(x.price_text),
      cta_text: safeString(x.cta_text),
      detailsText: safeString(
        x.detailsText || (Array.isArray(x.details) ? x.details.join("\n") : "")
      ),
    }));
}

export default function PricingEditor({ value, onChange }) {
  const items = useMemo(() => normalizeItems(value), [value]);

  const refs = useRef({});
  const setRef = (id, field) => (el) => {
    if (!el) return;
    refs.current[`${id}_${field}`] = el;
  };

  const updateItem = (id, patch) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id) => {
    onChange(items.filter((it) => it.id !== id));
  };

  const moveItem = (id, dir) => {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const addItem = () => {
    onChange([
      ...items,
      {
        id: makeId("pricing"),
        group: "one_time",
        title: "",
        subtitle: "",
        badge: "",
        unit: "",
        price_rub: "",
        price_text: "",
        cta_text: "",
        detailsText: "",
      },
    ]);
  };

  const applyToSelection = (id, field, transform) => {
    const el = refs.current[`${id}_${field}`];
    if (!el) return;
    const it = items.find((x) => x.id === id);
    if (!it) return;

    const current = safeString(it[field]);
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = current.slice(0, start);
    const mid = current.slice(start, end);
    const after = current.slice(end);

    const next = transform(before, mid, after);
    updateItem(id, { [field]: next });

    requestAnimationFrame(() => {
      try {
        el.focus();
      } catch {}
    });
  };

  const wrap = (id, field, open, close, placeholder = "") => {
    applyToSelection(id, field, (b, m, a) => {
      const inner = m || placeholder;
      return `${b}${open}${inner}${close}${a}`;
    });
  };

  const insertLink = (id, field) => {
    const url = window.prompt("URL ссылки:", "");
    if (!url) return;
    const text = window.prompt("Текст ссылки:", "ссылка") || "ссылка";
    applyToSelection(id, field, (b, m, a) => {
      const label = m || text;
      return `${b}<a href="${url}">${label}</a>${a}`;
    });
  };

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Стоимость занятий и абонементов</h3>
          <div className="muted" style={{ marginTop: 6 }}>
            Добавляй несколько вариантов: пробное, разовое, абонементы, индивидуальные и т.д.
          </div>
        </div>
        <button type="button" className="btn ghost" onClick={addItem}>
          + Добавить тариф
        </button>
      </div>

      {items.length === 0 && <div className="muted" style={{ marginTop: 12 }}>Пока нет тарифов.</div>}

      {items.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((it) => (
            <div key={it.id} className="pricingItem">
              <div className="pricingTop">
                <div style={{ flex: 2 }}>
                  <label>Название</label>
                  <input value={it.title} onChange={(e) => updateItem(it.id, { title: e.target.value })} />
                </div>

                <div style={{ width: 200 }}>
                  <label>Категория</label>
                  <select value={it.group} onChange={(e) => updateItem(it.id, { group: e.target.value })}>
                    {PRICING_GROUPS.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ width: 160 }}>
                  <label>Цена (₽)</label>
                  <input
                    value={it.price_rub}
                    onChange={(e) => updateItem(it.id, { price_rub: e.target.value, price_text: "" })}
                    placeholder="1500"
                  />
                </div>

                <div style={{ width: 220 }}>
                  <label>или текст цены</label>
                  <input
                    value={it.price_text}
                    onChange={(e) => updateItem(it.id, { price_text: e.target.value, price_rub: "" })}
                    placeholder="Бесплатно"
                  />
                </div>

                <div className="pricingTopActions">
                  <button type="button" className="iconBtn" onClick={() => moveItem(it.id, -1)}>↑</button>
                  <button type="button" className="iconBtn" onClick={() => moveItem(it.id, 1)}>↓</button>
                  <button type="button" className="iconBtn danger" onClick={() => removeItem(it.id)}>✕</button>
                </div>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <label>Бейдж</label>
                  <input value={it.badge} onChange={(e) => updateItem(it.id, { badge: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Единица</label>
                  <input value={it.unit} onChange={(e) => updateItem(it.id, { unit: e.target.value })} placeholder="за занятие" />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Текст кнопки</label>
                  <input value={it.cta_text} onChange={(e) => updateItem(it.id, { cta_text: e.target.value })} placeholder="Записаться" />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label>Короткое описание</label>
                <div className="miniEditorToolbar">
                  <button type="button" className="miniBtn" onClick={() => wrap(it.id, "subtitle", "<strong>", "</strong>", "текст")}>B</button>
                  <button type="button" className="miniBtn" onClick={() => wrap(it.id, "subtitle", "<em>", "</em>", "текст")}>I</button>
                  <button type="button" className="miniBtn" onClick={() => insertLink(it.id, "subtitle")}>🔗 Ссылка</button>
                </div>
                <textarea
                  ref={setRef(it.id, "subtitle")}
                  rows={3}
                  value={it.subtitle}
                  onChange={(e) => updateItem(it.id, { subtitle: e.target.value })}
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <label>Подробнее (по строкам)</label>
                <div className="miniEditorToolbar">
                  <button type="button" className="miniBtn" onClick={() => wrap(it.id, "detailsText", "<strong>", "</strong>", "текст")}>B</button>
                  <button type="button" className="miniBtn" onClick={() => wrap(it.id, "detailsText", "<em>", "</em>", "текст")}>I</button>
                  <button type="button" className="miniBtn" onClick={() => insertLink(it.id, "detailsText")}>🔗 Ссылка</button>
                </div>
                <textarea
                  ref={setRef(it.id, "detailsText")}
                  rows={4}
                  value={it.detailsText}
                  onChange={(e) => updateItem(it.id, { detailsText: e.target.value })}
                  placeholder="Например:\n• 60 минут\n• Инвентарь включён\n• 1 раз в неделю"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
