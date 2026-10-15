import { ArrowLeft, BookOpen, Compass } from "lucide-react";
import { pageMetadata } from "../lib/metadata";
import styles from "./not-found.module.css";

export const metadata = pageMetadata({
  title: "Không tìm thấy trang",
  description:
    "Trang bạn tìm không còn ở đây. Trở lại không gian học tập Lumio AI để tiếp tục.",
  path: "/",
  privatePage: true,
});
export default function NotFound() {
  return (
    <main className={styles.screen}>
      <a href="/" className={styles.brand}>
        <BookOpen size={22} />
        Lumio<span>AI</span>
      </a>
      <div className={styles.orbit} aria-hidden="true">
        <span>404</span>
        <Compass size={43} />
        <i />
      </div>
      <section className={styles.message}>
        <span>ĐỔI HƯỚNG MỘT CHÚT</span>
        <h1>
          Trang này chưa có trong
          <br />
          hành trình của bạn.
        </h1>
        <p>
          Liên kết có thể đã thay đổi hoặc không còn tồn tại.
          <br />
          Không gian học của bạn vẫn ở ngay đây.
        </p>
        <a href="/" className={styles.primary}>
          <ArrowLeft size={17} />
          Về không gian học
        </a>
        <div className={styles.links}>
          <a href="/privacy">Quyền riêng tư</a>
          <span>·</span>
          <a href="/terms">Điều khoản sử dụng</a>
        </div>
      </section>
      <small>Lumio AI · Learn smarter. Grow further.</small>
    </main>
  );
}
