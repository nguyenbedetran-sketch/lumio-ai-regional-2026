import {
  readJSON,
  json,
  errorResponse,
} from "../../../../../lib/server/access";
import { assertNativeRequest } from "../../../../../lib/server/mobile-access";
import { getStore } from "../../../../../lib/server/store";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    assertNativeRequest(req);
    const { code, deviceName } = await readJSON(req);
    return json(getStore().exchangeMobileCode(code, deviceName));
  } catch (error) {
    return errorResponse(error);
  }
}
