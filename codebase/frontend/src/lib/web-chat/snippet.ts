/**
 * 웹채팅 위젯 설치 스니펫 생성.
 *
 * 운영자가 자기 사이트에 붙일 `<script>` 블록을 만든다. 외형/콘텐츠는 백엔드에
 * 저장하지 않고 boot 옵션으로만 emit 한다(spec 5-admin-console §4·§5, BootConfig
 * SoT 는 spec 2-sdk.md §4).
 */

export interface WebChatAppearance {
  primaryColor?: string;
  position?: "bottom-right" | "bottom-left";
  zIndex?: number;
}

export interface WebChatBootInput {
  /** EIA API origin. */
  apiBase: string;
  /** 인스턴스(webhook trigger)의 공개 endpointPath. */
  triggerEndpointPath: string;
  locale?: "ko" | "en";
  appearance?: WebChatAppearance;
  headerTitle?: string;
  welcome?: { text?: string; suggestions?: string[] };
  launcher?: { suggestions?: string[] };
  disclaimer?: string;
}

function cleanString(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

function cleanSuggestions(arr: string[] | undefined): string[] | undefined {
  const cleaned = (arr ?? []).map((s) => s.trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

function pruneObject<T extends Record<string, unknown>>(obj: T): T | undefined {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  return entries.length ? (Object.fromEntries(entries) as T) : undefined;
}

/**
 * boot 설정 객체를 만든다 — 빈 문자열·빈 배열·undefined 필드는 제거해 깔끔한
 * 스니펫이 되도록. 필수 필드(apiBase, triggerEndpointPath)는 항상 포함.
 */
export function buildBootConfig(input: WebChatBootInput): Record<string, unknown> {
  const appearance = input.appearance
    ? pruneObject({
        primaryColor: cleanString(input.appearance.primaryColor),
        position: input.appearance.position,
        zIndex: input.appearance.zIndex,
      })
    : undefined;

  const welcome = input.welcome
    ? pruneObject({
        text: cleanString(input.welcome.text),
        suggestions: cleanSuggestions(input.welcome.suggestions),
      })
    : undefined;

  const launcher = input.launcher
    ? pruneObject({ suggestions: cleanSuggestions(input.launcher.suggestions) })
    : undefined;

  const config: Record<string, unknown> = {
    apiBase: input.apiBase,
    triggerEndpointPath: input.triggerEndpointPath,
  };
  if (input.locale) config.locale = input.locale;
  if (appearance) config.appearance = appearance;
  const headerTitle = cleanString(input.headerTitle);
  if (headerTitle) config.headerTitle = headerTitle;
  if (welcome) config.welcome = welcome;
  if (launcher) config.launcher = launcher;
  const disclaimer = cleanString(input.disclaimer);
  if (disclaimer) config.disclaimer = disclaimer;

  return config;
}

/**
 * boot 설정을 `<script>` 안에 안전하게 박기 위해 `</script>` 시퀀스를 이스케이프.
 * (값에 `</script>` 가 들어가면 HTML 파서가 스크립트를 조기 종료해 XSS 가 된다.)
 */
function escapeForScript(json: string): string {
  // `</script>` 조기 종료 방지 + U+2028/U+2029(JS 줄바꿈으로 해석되는 라인 구분자) 이스케이프.
  return json
    .replace(/<\/(script)/gi, "<\\/$1")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * command-queue 스텁 — `window.ClemvionChat` 을 동기 정의해 `loader.js`(async) 로드 전 호출을 `.q` 에
 * 버퍼링한다. 로더(`installGlobal`)가 로드되며 큐를 replay (spec 2-sdk §1 명령 큐 패턴 / Rationale R5).
 * 스니펫·spec 예시·유저 가이드가 동일 스텁을 공유하므로, 형식 변경 시 본 상수와 마크다운 예시를 함께 갱신한다.
 */
export const QUEUE_STUB_JS =
  "window.ClemvionChat=window.ClemvionChat||function(){(window.ClemvionChat.q=window.ClemvionChat.q||[]).push(arguments)};";

/**
 * 전체 설치 스니펫(loader + boot 두 `<script>` 블록)을 생성한다.
 *
 * 첫 블록은 {@link QUEUE_STUB_JS}(command-queue 스텁)를 설치한 뒤 `loader.js` 를 async 로 붙인다.
 * 이래야 둘째 블록의 `ClemvionChat('boot', …)` 가 로더 로드 **전**에 실행돼도 `ReferenceError` 없이
 * 큐잉되고, 로더가 로드되며 `.q` 큐를 replay 한다 (spec 2-sdk §1 명령 큐 패턴 / Rationale R5).
 *
 * @param loaderUrl `getWidgetLoaderUrl()` 결과 — 위젯 동봉/CDN 위치의 loader.js URL.
 */
export function buildWebChatSnippet(loaderUrl: string, input: WebChatBootInput): string {
  const boot = buildBootConfig(input);
  const bootJson = escapeForScript(JSON.stringify(boot, null, 2));
  const loaderSrc = escapeForScript(loaderUrl);

  return [
    `<script>(function(d,s){`,
    `  ${QUEUE_STUB_JS}`,
    `  var j=d.createElement(s);j.async=1;j.src="${loaderSrc}";d.head.appendChild(j);`,
    `})(document,"script");</script>`,
    `<script>`,
    `  ClemvionChat('boot', ${bootJson});`,
    `</script>`,
  ].join("\n");
}
