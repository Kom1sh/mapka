"use client";

import { useMemo, useState } from "react";
import styles from "./PricingBlock.module.css";

const GROUP_ORDER = ["Разовое", "Абонементы", "Индивидуально", "Дополнительно"];

function formatRub(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return `${num.toLocaleString("ru-RU")} ₽`;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Админка у тебя “доверенная”, но на всякий случай уберём очевидные опасности.
function sanitizeBasicHtml(html) {
  let s = String(html || "");
  s = s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/\son\w+\s*=\s*\"[^\"]*\"/gi, "");
  s = s.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  s = s.replace(/javascript:/gi, "");
  return s;
}

function toSafeHtml(s) {
  const str = String(s || "");
  if (!str) return "";

  // Если это HTML — оставляем, но чистим.
  if (/<[a-z][\s\S]*>/i.test(str)) return sanitizeBasicHtml(str);

  // Иначе экранируем и поддерживаем переносы строк.
  return escapeHtml(str).replace(/\n/g, "<br/>");
}

function renderHtml(s) {
  return { __html: toSafeHtml(s) };
}

export default function PricingBlockClient({ items = [], ctaHref, noteText }) {
  const isAnchorCta = typeof ctaHref === "string" && ctaHref.startsWith("#");

  const onCtaClick = (e) => {
    if (!isAnchorCta) return;
    e.preventDefault();
    const el = document.querySelector(ctaHref);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const groups = useMemo(() => {
    const set = new Set(items.map((x) => x?.group).filter(Boolean));

    const ordered = GROUP_ORDER.filter((g) => set.has(g));
    const rest = Array.from(set)
      .filter((g) => !GROUP_ORDER.includes(g))
      .sort((a, b) => String(a).localeCompare(String(b), "ru"));

    return ["Все", ...ordered, ...rest];
  }, [items]);

  const [active, setActive] = useState("Все");
  const [expandedId, setExpandedId] = useState(null);

  const filtered = useMemo(() => {
    if (active === "Все") return items;
    return items.filter((x) => x?.group === active);
  }, [items, active]);

  const footerNote = noteText?.trim() || "* Цены могут меняться — уточняйте у администратора.";

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Стоимость занятий и абонементов</h2>
          <div className={styles.sub}>
            Понятно, компактно, с деталями — чтобы родитель сразу понимал, что входит.
          </div>
        </div>

        {ctaHref ? (
          <a
            className={styles.primaryCta}
            href={ctaHref}
            onClick={onCtaClick}
            {...(!isAnchorCta ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            Записаться
          </a>
        ) : null}
      </div>

      <div className={styles.filters}>
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            className={`${styles.pill} ${active === g ? styles.pillActive : ""}`}
            onClick={() => setActive(g)}
          >
            {g}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {filtered.map((p, idx) => {
          const id = p?.id || `pricing-${idx}`;
          const isExpanded = expandedId === id;

          const priceText = String(p?.price_text || p?.priceText || "").trim();
          const priceNum = Number(p?.price_rub);

          const priceLabel = priceText
            ? priceText
            : (Number.isFinite(priceNum) && priceNum === 0)
              ? "Бесплатно"
              : formatRub(priceNum);

          const details = Array.isArray(p?.details) ? p.details.filter(Boolean) : [];

          return (
            <div key={id} className={styles.row}>
              <div className={styles.iconWrap} aria-hidden="true">
                <span className={styles.icon}>{p?.icon || "💳"}</span>
              </div>

              <div className={styles.main}>
                <div className={styles.topLine}>
                  <div className={styles.name}>{p?.title || ""}</div>
                  {p?.badge ? <span className={styles.badge}>{p.badge}</span> : null}
                </div>

                {p?.subtitle ? (
                  <div className={styles.subtitle} dangerouslySetInnerHTML={renderHtml(p.subtitle)} />
                ) : null}

                <div className={styles.metaLine}>
                  {p?.group ? <span className={styles.meta}>{p.group}</span> : null}
                  {p?.group && p?.per ? <span className={styles.dot} /> : null}
                  {p?.per ? <span className={styles.meta}>{p.per}</span> : null}
                </div>

                {details.length ? (
                  <button
                    type="button"
                    className={styles.moreBtn}
                    onClick={() => setExpandedId(isExpanded ? null : id)}
                  >
                    {isExpanded ? "Скрыть детали" : "Подробнее"}
                  </button>
                ) : null}

                {isExpanded && details.length ? (
                  <ul className={styles.details}>
                    {details.map((d, di) => (
                      <li key={di} dangerouslySetInnerHTML={renderHtml(d)} />
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className={styles.right}>
                <div className={styles.price}>{priceLabel}</div>
                {ctaHref ? (
                  <a
                    className={styles.secondaryCta}
                    href={ctaHref}
                    onClick={onCtaClick}
                    {...(!isAnchorCta ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    Записаться
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.note} dangerouslySetInnerHTML={renderHtml(footerNote)} />
    </div>
  );
}
