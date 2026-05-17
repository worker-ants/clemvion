import { cookies } from "next/headers";
import { isLocale, type Locale } from "./types";
import { LOCALE_COOKIE_NAME } from "./cookie";

export { LOCALE_COOKIE_NAME };

/** 서버 컴포넌트/라우트 핸들러에서 locale 쿠키를 읽어와요.
 *  값이 없거나 유효하지 않으면 `null`. 호출부에서 `DEFAULT_LOCALE`로 폴백해 주세요. */
export async function readLocaleCookie(): Promise<Locale | null> {
  const jar = await cookies();
  const raw = jar.get(LOCALE_COOKIE_NAME)?.value;
  return isLocale(raw) ? raw : null;
}
