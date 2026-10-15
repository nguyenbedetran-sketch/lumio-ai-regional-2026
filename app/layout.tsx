import "./lumio.css";
import "./ai.css";
import "./motion.css";
import "./polish.css";
import "katex/dist/katex.min.css";
import "./experience.css";
import "./connections.css";
import "./learning-extra.css";
import "./studio.css";
import "./personalization.css";
import "./billing.css";
import "./public-demo.css";
import "./mobile.css";
import "./motion-v2.css";
import "./voice.css";
import "./meeting.css";
import "./full-summary.css";
import "./command-menu.css";
import "./dashboard-v3.css";
import "./study-v3.css";
import "./premium-v3.css";
import "./regional.css";
import "./learner-v7.css";
import { publicSiteSchema, siteMetadata } from "../lib/metadata";
export const metadata = siteMetadata;
export default function Layout({ children }: { children: React.ReactNode }) {
  const schema = publicSiteSchema();
  return (
    <html lang="vi">
      <body>
        {children}
        {schema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: schema }}
          />
        )}
      </body>
    </html>
  );
}
