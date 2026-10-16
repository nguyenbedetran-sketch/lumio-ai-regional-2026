import { useId } from "react";
import styles from "./LoadingSkeleton.module.css";

/** Render only while the real workspace is being read, never as progress. */
export function LoadingSkeleton({ label }: { label: string }) {
  const id = useId();
  return (
    <section
      className={styles.shell}
      aria-busy="true"
      aria-describedby={id}
      data-loading-skeleton
    >
      <p
        id={id}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.status}
      >
        {label}
      </p>
      <div className={styles.frame} aria-hidden="true">
        <aside className={styles.sidebar}>
          <span className={styles.brand}>
            Lumio <small>AI</small>
          </span>
          <i className={styles.short} />
          <i />
          <i />
          <i />
        </aside>
        <div className={styles.content}>
          <div className={styles.toolbar}>
            <i className={styles.short} />
            <i />
          </div>
          <div className={styles.card}>
            <i className={styles.title} />
            <i />
            <i className={styles.short} />
            <div className={styles.field} />
            <i className={styles.action} />
          </div>
          <div className={styles.tiles}>
            <div className={styles.card}>
              <i className={styles.title} />
              <i />
              <i className={styles.short} />
            </div>
            <div className={styles.card}>
              <i className={styles.title} />
              <i />
              <i className={styles.short} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
