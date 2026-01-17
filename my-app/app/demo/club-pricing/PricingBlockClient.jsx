"use client";

import { useMemo, useState } from "react";
import styles from "./PricingBlock.module.css";

function formatRub(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return `${num.toLocaleString("ru-RU")} ₽`;
}

export default function PricingBlockClient({ items = [], ctaHref }) {
  const groups = useMemo(() => {
    const set = new Set(items.map((x) => x.group).filter(Boolean));
    return ["Все", ...Array.from(set)];
  }, [items]);

  const [active, setActive] = useState("Все");
  const [expandedId, setExpandedId] = useState(null);

  const filtered = useMemo(() => {
    if (active === "Все") return items;
    return items.filter((x) => x.group === active);
  }, [items, active]);

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
          <a className={styles.primaryCta} href={ctaHref} target="_blank" rel="noreferrer">
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
        {filtered.map((p) => {
          const isExpanded = expandedId === p.id;

          const priceLabel =
            p.price_rub === 0 ? "Бесплатно" : formatRub(p.price_rub);

          return (
            <div key={p.id} className={styles.row}>
              <div className={styles.iconWrap} aria-hidden="true">
                <span className={styles.icon}>{p.icon || "💳"}</span>
              </div>

              <div className={styles.main}>
                <div className={styles.topLine}>
                  <div className={styles.name}>{p.title}</div>
                  {p.badge ? <span className={styles.badge}>{p.badge}</span> : null}
                </div>

                {p.subtitle ? <div className={styles.subtitle}>{p.subtitle}</div> : null}

                <div className={styles.metaLine}>
                  <span className={styles.meta}>{p.group}</span>
                  {p.per ? <span className={styles.dot} /> : null}
                  {p.per ? <span className={styles.meta}>{p.per}</span> : null}
                </div>

                {p.details?.length ? (
                  <button
                    type="button"
                    className={styles.moreBtn}
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    {isExpanded ? "Скрыть детали" : "Подробнее"}
                  </button>
                ) : null}

                {isExpanded && p.details?.length ? (
                  <ul className={styles.details}>
                    {p.details.map((d, idx) => (
                      <li key={idx}>{d}</li>
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
                    target="_blank"
                    rel="noreferrer"
                  >
                    Записаться
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.note}>
        * Цены могут меняться — уточняйте у администратора.
      </div>
    </div>
  );
}
