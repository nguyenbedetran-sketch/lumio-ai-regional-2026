import { MobileConnect } from "../../components/lumio/mobile-connect";
import { isPublicDemo } from "../../lib/server/public-demo";
export const dynamic = "force-dynamic";
export default function MobilePage() {
  return <MobileConnect publicDemo={isPublicDemo()} />;
}
