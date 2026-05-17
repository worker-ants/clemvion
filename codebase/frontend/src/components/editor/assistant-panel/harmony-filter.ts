/**
 * OpenAI harmony chat format (GPT-5 등에서 사용) 제어 토큰을 assistant bubble
 * 렌더 직전에 걸러낸다. tool call 이 올바르게 function-calling 채널로 돌아오면
 * 문제가 없지만, 모델 구현에 따라 `<|channel|>commentary <|constrain|>json
 * <|message|>{...}` 블록이 assistant text 스트림에 leak 하는 경우가 관찰되어
 * 방어 레이어가 필요하다.
 *
 * 규칙:
 *  1) 채널 블록(`<|channel|>name … <|message|>body`)을 모두 찾는다.
 *     - `final` 채널(대소문자 무시)이 있으면 그 body 들만 이어붙여 반환한다
 *       (사용자에게 보여주기로 의도된 공식 채널).
 *     - `final` 이 없으면 모든 채널 블록을 통째로 제거한다 (`commentary`,
 *       `analysis`, `tool` 등 내부 채널).
 *  2) 남은 문자열에서 role header(`<|start|>assistant<|message|>` 등),
 *     잔여 완전 harmony 토큰, 그리고 **스트리밍 중 아직 닫히지 않은 꼬리
 *     토큰**(`… <|channel`) 까지 제거한다. partial 토큰을 놔두면 다음
 *     delta 가 붙기 전까지 사용자에게 한 순간 노출된다.
 *  3) 전체 trim.
 *
 * 안전 원칙: harmony 토큰이 전혀 없는 정상 prose 는 bytes-identical 통과.
 */

// m[1] = channel name (e.g. "final", "commentary", "analysis")
// m[2] = message body up to the next control token or end-of-string
// NOTE: /g 플래그는 `matchAll` · `replaceAll` 전용으로만 사용한다.
// `.exec()` 루프로 전환할 경우 `lastIndex` 상태가 살아남아 false negative
// 를 일으킬 수 있으니 주의.
const CHANNEL_BLOCK_RE =
  /<\|channel\|>\s*([a-zA-Z_-]+)[\s\S]*?<\|message\|>([\s\S]*?)(?=<\|(?:start|channel|end|return)\|>|$)/g;

const ROLE_HEADER_RE = /<\|start\|>[^<]*?<\|message\|>/g;
const COMPLETE_TOKEN_RE = /<\|[^|>]*\|>/g;
// 스트리밍 중 청크 경계에서 토큰이 반만 들어온 꼬리 — e.g. "hello <|chan".
// 다음 delta 가 붙기 전까지 사용자에게 노출되지 않도록 렌더 시점에서 잘라낸다.
const TRAILING_PARTIAL_TOKEN_RE = /<\|[^|>]*$/;

function stripHarmonyTokens(s: string): string {
  return s
    .replace(ROLE_HEADER_RE, "")
    .replace(COMPLETE_TOKEN_RE, "")
    .replace(TRAILING_PARTIAL_TOKEN_RE, "")
    .trim();
}

export function sanitizeAssistantText(raw: string): string {
  if (!raw) return "";

  const matches = [...raw.matchAll(CHANNEL_BLOCK_RE)];
  if (matches.length === 0) {
    return stripHarmonyTokens(raw);
  }

  const finals = matches.filter(
    (m) => (m[1] ?? "").toLowerCase() === "final",
  );
  if (finals.length > 0) {
    return finals
      .map((m) => stripHarmonyTokens(m[2] ?? ""))
      .filter((s) => s.length > 0)
      .join("\n\n")
      .trim();
  }

  // final 채널 없음: 모든 채널 블록 통째로 제거 후 남은 prose 반환.
  // 동일 블록이 여러 번 등장할 수 있으므로 `replaceAll` 로 전역 제거한다.
  let out = raw;
  for (const m of matches) {
    out = out.replaceAll(m[0], "");
  }
  // 블록 경계에 인접한 partial 토큰도 함께 제거되도록 한 번 더 거른다.
  return stripHarmonyTokens(out);
}

