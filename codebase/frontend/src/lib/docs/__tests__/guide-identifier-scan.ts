// 유저 가이드가 이름으로 적은 **식별자가 실재하는가** 를 판정하는 순수 스캐너.
// 테스트는 `guide-identifier-existence.test.ts`.
//
// SoT: spec/conventions/user-guide-evidence.md (가드 가족) · spec/conventions/error-codes.md
// (코드 명명·은퇴 이력) · spec/5-system/3-error-handling.md §1 (카탈로그).
//
// ## 왜 "에러 코드" 가 아니라 "식별자" 인가
//
// `#1330` 은 이 가드를 **에러 코드 전용**으로 만들었다(`guide-error-code-*`). 그런데 이 가드를
// 등재시킨 원래 근거는 `#1328` 이 손으로 고친 **환경변수 오기**였다:
//
// ```
// - "… Plain-HTTP URLs are only allowed when `MCP_INSECURE_URL_ALLOWED` is enabled …"
// + "… Plain-HTTP URLs are only allowed when `MCP_ALLOW_INSECURE_URL` is enabled …"
// ```
//
// **그 줄에 `#1330` 의 세 축을 그대로 걸어 보니 전부 미포착이었다**(실측):
//
// | `#1330` 축 | 판정 | 왜 |
// |---|---|---|
// | `<FieldTable>` 의 `name` | ✗ | 토큰이 `name` 이 아니라 **`description` 안**에 있다 |
// | `code:` 값 | ✗ | `code:` 필드가 아니다 |
// | 실패-문맥 산문 | ✗ | 그 줄에 실패 어휘가 **없다** (KO 는 *"별도 안전장치"*) |
//
// 즉 가드가 **자기 존재 이유를 못 잡고** 있었고, 베이스라인 0 이 그 사실을 가렸다.
// *"정의를 한 칸 좁게 잡는다"* 의 **거울상** — 좁혀서 오탐을 0 으로 만들었는데 잡아야 할
// 것까지 빠졌다.
//
// ## 축 (실측으로 결정)
//
// | 축 | 대상 | 허용목록 |
// |---|---|---|
// | `field-table` | `<FieldTable>` 의 `name` (따옴표) | 없음 |
// | `code-field` | `code:` 값 (따옴표) | 없음 |
// | `backtick` | **모든 백틱 UPPER_SNAKE** | 외부 어휘만 |
//
// `backtick` 축은 `#1330` 의 *"실패 문맥 산문"* 축을 **교체**한 것이다 — 후자를 포함하므로
// 함께 두면 같은 토큰이 두 번 보고되고 축별 floor 가 서로를 가린다.
//
// 실측: 가이드 92개에서 백틱 UPPER_SNAKE **91종**, 기준집합 부재 **1종**(`MESSAGE_CREATE`).
// 과거 결함 `MCP_INSECURE_URL_ALLOWED` 는 기준집합에 **없어** 잡히고, 정정된 이름
// `MCP_ALLOW_INSECURE_URL` 은 **있어** 통과한다.
//
// ## 허용목록을 둔다 — 그리고 그 결정의 대가를 적는다
//
// `#1330` 은 *"허용목록 없음"* 을 설계 원칙으로 세웠다. **이번 축에서는 유지할 수 없다.**
// 유지하려면 문맥을 좁혀야 하고, 좁히면 위 표가 보인 대로 결함 클래스가 통째로 빠진다.
// **둘 중 무엇을 포기할지가 실제 결정이었고, 실측이 답을 정했다.**
//
// 대신 허용목록이 은폐 수단이 되지 않도록 **네 가지를 테스트가 강제**한다(§테스트 참조):
// 외부 시스템 이름 의무 · 상한 · 여전히 인용될 것 · 기준집합에 없을 것.

// ## 이 가드가 **못** 보는 것 — 존재 검사이지 방출 검사가 아니다
//
// 술어는 *"그 토큰이 소스·env 선언처에 문자열로 있는가"* 다. 그래서 **실제로 발행되지 않는
// 토큰도 통과한다**:
//
// - 에러 **메시지 접두**로만 쓰이는 것 — `throw new Error('X_UNRESOLVED: …')` 의
//   `X_UNRESOLVED` 는 실재하지만 `output.error.code` 로는 나가지 않는다(catch 가
//   `err instanceof IntegrationError ? err.code : 'INTEGRATION_CALL_FAILED'`).
// - **읽히지 않는 env 변수** — `.env.example` 에 남아 있지만 아무도 `process.env` 로 읽지
//   않는 이름. 선언처에 있으니 통과한다.
//
// **이 한계는 가정이 아니라 실측이다**: `#1330` 이 이 구멍으로
// `MAKESHOP_UNRESOLVED_PATH_PARAM` 을 가이드에 적었고 `--impl-done`
// (`review/consistency/2026/09/13/11_33_51`)의 naming_collision 이 **CRITICAL** 로 잡았다.
// 가드는 통과시켰다. 방출 위치를 AST 로 특정하는 축이 트래커에 등재돼 있다.
//
// **이 주석을 지우지 말 것.** 가드가 무엇을 보장하지 *않는지* 가 적혀 있지 않으면 다음
// 사람이 "가드가 통과했으니 이 식별자는 실재한다" 로 읽는다.
//
// > **그리고 실제로 지워졌다 — `#1331` 이 이 파일을 재작성하면서.** 같은 문장을 쓴 사람이
// > 한 PR 뒤에 그것을 지웠고, `/ai-review`(`review/code/2026/09/13/14_41_14`
// > documentation WARNING#3)가 잡았다. 파일 **재작성**은 리네임·이동과 달리 diff 가
// > "삭제+생성" 으로 보여 **무엇이 사라졌는지가 눈에 안 띈다**. 다음에 이 파일을 재작성하면
// > 먼저 옛 판본의 주석 절 목록을 뽑아 대조할 것.

/** 판정 축. `#1330` 의 `"prose"` 는 *실패 문맥 게이팅* 을 뜻했으므로 재사용하지 않는다. */
export type CitationAxis = "field-table" | "code-field" | "backtick";

export interface IdentifierCitation {
  axis: CitationAxis;
  /** 가이드가 적은 식별자 토큰. */
  token: string;
  /** 1-indexed */
  line: number;
}

/** UPPER_SNAKE — 밑줄이 **최소 하나** 있어야 한다(`LLM`·`HTTP` 같은 약어 제외). */
const UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+";

/**
 * 축 1 — `<FieldTable rows={[{ name: "CODE", … }]} />` 의 객체 리터럴 키.
 *
 * **판정은 줄 단위다.** 오늘 코퍼스의 `<FieldTable>` 행은 전부 한 줄 스타일이라(실측)
 * 이것으로 충분하지만, 훗날 누가 한 행을 여러 줄로 쪼개면 `{ name:` 과 `"CODE"` 가 갈려
 * **조용히 빠진다**. 대조군이 그 경계를 양성으로 고정한다.
 *
 * (`description` 안의 토큰은 이 축이 아니라 `backtick` 축이 잡는다 — 과거 결함이 정확히
 * 그 자리였다.)
 */
const FIELD_TABLE_NAME = new RegExp(`\\{\\s*name:\\s*"(${UPPER_SNAKE})"`, "g");

/**
 * 축 2 — 예시 코드펜스의 `"code": "CODE"` / `code: "CODE"`.
 *
 * **왼쪽 경계가 필요하다.** 경계가 없으면 `code` 로 **끝나는** 키가 전부 걸린다 —
 * `"mycode": "X"` 가 `code"` 부분에서 매치된다(실측). camelCase 인 `"statusCode"` 는
 * 대문자 `C` 라 애초에 안 걸리므로, 위험한 형태는 **전부 소문자로 `code` 로 끝나는 키**다.
 *
 * 오늘 코퍼스에 그런 키는 0건이라 현재 오탐은 없지만, 같은 파일의 다른 두 축에는 판별
 * fixture 를 붙여 놓고 이 축만 빠져 있었다(`/ai-review`
 * `review/code/2026/09/13/15_42_54` testing WARNING#2). 경계를 넣고 음성 fixture 로 고정한다.
 */
const CODE_FIELD = new RegExp(
  `(?<![A-Za-z])"?code"?\\s*:\\s*"(${UPPER_SNAKE})"`,
  "g",
);

/**
 * 축 3 — **모든** 백틱 UPPER_SNAKE. 문맥으로 게이팅하지 않는다.
 *
 * 게이팅하면 과거 결함이 빠진다는 것이 이 파일 상단의 실측이다. 대가는 외부 어휘 오탐이고,
 * 그것은 `GUIDE_EXTERNAL_VOCABULARY` 로 **명시적으로** 받는다 — 문맥 술어에 숨기지 않는다.
 */
const BACKTICK = new RegExp(`\`(${UPPER_SNAKE})\``, "g");

/**
 * 우리 것이 아닌 것이 **정상**인 외부 어휘.
 *
 * 각 항목은 `system` 으로 **어느 외부 제품의 어휘인지** 밝혀야 한다 — *"아직 미구현"* ·
 * *"Planned 니까"* 같은 사유를 쓸 수 없게 하는 것이 이 필드의 목적이다. 테스트가
 * 상한·인용 여부·기준집합 부재를 함께 강제한다.
 */
export const GUIDE_EXTERNAL_VOCABULARY: readonly {
  token: string;
  system: string;
  why: string;
}[] = [
  {
    token: "MESSAGE_CREATE",
    system: "Discord Gateway",
    why: "Discord 가 정의한 Gateway 이벤트 이름. 가이드는 '이 이벤트는 Gateway WebSocket 연결이 필요해 지원하지 않는다' 고 설명하려고 인용한다 — 우리 코드에 없는 것이 정상이다.",
  },
];

/** 한 MDX 본문에서 식별자 인용을 전부 걷는다. 같은 줄의 중복 축은 각각 보고된다. */
export function scanIdentifierCitations(mdx: string): IdentifierCitation[] {
  const out: IdentifierCitation[] = [];

  mdx.split("\n").forEach((line, idx) => {
    const push = (axis: CitationAxis, rx: RegExp): void => {
      rx.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(line)) !== null) {
        out.push({ axis, token: m[1], line: idx + 1 });
      }
    };
    push("field-table", FIELD_TABLE_NAME);
    push("code-field", CODE_FIELD);
    push("backtick", BACKTICK);
  });

  return out;
}

/**
 * 소스에 등장하는 UPPER_SNAKE 토큰 전수 — 실재 판정의 기준집합 절반.
 *
 * **`ErrorCode` enum 만 읽지 않는다.** `3-error-handling.md §1.4` 가 명시하듯 이 저장소의
 * 코드 앵커는 셋으로 갈리고(`ErrorCode` const · `EngineErrorCode` const · 에러 클래스의
 * `readonly code`) **상당수는 앵커 없는 맨 문자열**이다. enum 만 기준으로 삼으면 실재하는
 * 코드를 가이드가 적었는데 RED 가 뜬다 — 가드가 자기 사각지대를 결함으로 신고하는 형태다.
 */
export function collectSourceTokens(fileTexts: readonly string[]): Set<string> {
  const rx = new RegExp(`\\b(${UPPER_SNAKE})\\b`, "g");
  const tokens = new Set<string>();
  for (const text of fileTexts) {
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      tokens.add(m[1]);
    }
  }
  return tokens;
}

/**
 * 환경변수 **선언처** 토큰 — 기준집합의 나머지 절반.
 *
 * 소스의 `process.env.X` 는 위 `collectSourceTokens` 가 이미 걷는다. 이쪽은 **소스에서 읽지
 * 않는 변수**를 보탠다 — compose 가 컨테이너에 주입만 하는 값(`POSTGRES_*`·`MINIO_*`)이나
 * 프런트 빌드타임 변수(`NEXT_PUBLIC_*`). 실측 21종이고 **전부 인프라·런타임 설정 이름**이라
 * (`*_FAILED`/`*_ERROR` 같은 에러 코드꼴 0건) 이 병합이 에러 코드 축을 가리지 않는다.
 *
 * **오늘 이 병합은 판정을 지탱하지 않는다 — 뮤턴트가 그것을 반증했다.** 이 함수를 통째로
 * 빼도 스위트는 GREEN 이다: 가이드가 인용하는 env 변수 8종이 **전부 소스에도** 있기 때문이다
 * (`process.env.X` 로 읽히므로). 소스에 없고 선언처에만 있는 21종 중 **가이드 인용은 0종**.
 *
 * 그래도 남기는 이유는 `#1330` 이 `packages` 를 남긴 것과 같다 — 가이드가 내일
 * `POSTGRES_PASSWORD` 나 `NEXT_PUBLIC_WS_URL` 을 적으면, 기준집합이 좁을 때 **실재하는
 * 변수에 RED** 가 난다. 즉 이 병합은 *오늘의 검출*이 아니라 *내일의 오탐*을 막는다.
 * 그 사실을 적어 두지 않으면 다음 사람이 "이 함수가 뭘 잡고 있지?" 를 추적하게 된다.
 */
export function collectEnvDeclarations(
  envExampleTexts: readonly string[],
  composeTexts: readonly string[],
): Set<string> {
  const tokens = new Set<string>();
  const envLine = new RegExp(`^#?\\s*(${UPPER_SNAKE})=`, "gm");
  for (const text of envExampleTexts) {
    envLine.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = envLine.exec(text)) !== null) {
      tokens.add(m[1]);
    }
  }
  const composeLine = new RegExp(`^\\s+(${UPPER_SNAKE}):\\s`, "gm");
  for (const text of composeTexts) {
    composeLine.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = composeLine.exec(text)) !== null) {
      tokens.add(m[1]);
    }
  }
  return tokens;
}
