// 유저 가이드가 이름으로 적은 **에러 코드가 backend 소스에 실재하는가** 를 판정하는 순수
// 스캐너. 테스트는 `guide-error-code-existence.test.ts`.
//
// SoT: spec/conventions/user-guide-evidence.md (가드 가족) · spec/conventions/error-codes.md
// (코드 명명·은퇴 이력) · spec/5-system/3-error-handling.md §1 (카탈로그).
//
// ## 왜 이 가드가 필요한가
//
// 자매 `impl-anchor-existence.test.ts` 는 가이드가 약속한 **코드 symbol** 의 실재를 본다
// (`<ImplAnchor>` 의 `symbol`). 그 가드가 있는데도 가이드는 존재하지 않는 **에러 코드 이름**
// 다섯 종을 적고 있었다 — 지어낸 것(`MAKESHOP_API_ERROR`), 은퇴한 것
// (`NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`), 로드맵에만 있는 것(`LLM_AUTH_ERROR`·
// `LLM_MODEL_NOT_FOUND`). 에러 코드는 `<ImplAnchor>` 로 감싸지지 않는 자리(표 셀·예시
// 코드펜스·산문)에 살기 때문에 기존 가드의 표면 밖이었다.
//
// ## 술어를 어떻게 좁혔나 (전부 실측)
//
// "가이드의 UPPER_SNAKE 토큰 전부" 는 틀린 축이다 — 외부 어휘가 섞인다. 세 축을 각각 재고
// 오탐이 **구조적으로** 빠지는 형태만 채택했다. 허용목록은 없다.
//
// | 축 | 후보 | 부재 | 채택 |
// |---|---|---|---|
// | 1 `<FieldTable>` 의 `name` | 19종 | 0 | ✓ |
// | 2 `code:` 필드 값 | 2종 | 0 | ✓ |
// | 3 산문 백틱 (무조건) | 82종 | **1** | ✗ — 그 1건이 전부 오탐이었다 |
// | 3′ + 에러-코드 문맥만 | 39종 | 0 | ✗ — 실패 서술 표를 통째로 놓쳤다 |
// | 3″ + 실패 어휘 문맥 | **66종** | 0 | ✓ |
//
// 축 3 을 무조건 걷으면 Discord Gateway 이벤트 이름 `MESSAGE_CREATE` 가 잡힌다 — 우리 코드에
// 없는 것이 **정상**인 외부 어휘다. 그런데 그 줄은 실패를 말하고 있지 않다. 그래서 판정
// 단위를 토큰이 아니라 **줄의 주어**로 옮겼다(`CODE_CONTEXT` · 코드 열을 가진 표의 행).
//
// 축 3 을 버리지 않고 좁힌 이유: 원래 결함 4건은 모두 축 1·2 였지만, 산문에 코드를 적는
// 자리가 66군데나 되고 그중 하나가 지어낸 이름이 되는 것을 막을 다른 그물이 없다.
//
// **전수 열거(82종) + 외부 어휘 허용목록도 검토했다.** 미검출 구멍이 없는 대신 허용목록이
// 생기고, 더 근본적으로 판정 기준집합을 넓혀야 한다 — "가이드의 모든 대문자 식별자" 를
// 대상으로 삼으면 frontend 전용 상수(`NEXT_PUBLIC_*` 류)가 오탐이 되고, 그걸 막으려
// frontend 소스를 기준집합에 넣으면 **가이드가 인용한 이름이 프런트 라벨 맵으로 자기를
// 증명**하게 된다. backend-only 기준집합이 옳은 것은 대상이 **에러 코드**일 때뿐이다.

export type CitationAxis = "field-table" | "code-field" | "prose";

export interface ErrorCodeCitation {
  axis: CitationAxis;
  code: string;
  /** 1-indexed */
  line: number;
}

/** UPPER_SNAKE — 밑줄이 **최소 하나** 있어야 한다(`LLM`·`HTTP` 같은 약어 제외). */
const UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+";

/** 축 1 — `<FieldTable rows={[{ name: "CODE", … }]} />` 의 객체 리터럴 키. */
const FIELD_TABLE_NAME = new RegExp(`\\{\\s*name:\\s*"(${UPPER_SNAKE})"`, "g");

/** 축 2 — 예시 코드펜스의 `"code": "CODE"` / `code: "CODE"`. */
const CODE_FIELD = new RegExp(`"?code"?\\s*:\\s*"(${UPPER_SNAKE})"`, "g");

/** 축 3′ — 산문·표의 백틱 토큰. 줄 문맥 신호가 있을 때만 후보다. */
const PROSE_BACKTICK = new RegExp(`\`(${UPPER_SNAKE})\``, "g");

/**
 * 그 **줄**이 실패를 서술하고 있다는 신호. 토큰의 모양이 아니라 줄의 주어를 본다 — 같은
 * `MESSAGE_CREATE` 가 Gateway 이벤트 문맥에서는 비대상, 봉투 문맥에서는 대상이 되도록.
 *
 * **처음엔 `error.code`·"에러 코드" 만 봤다(39종).** 그러면 실패를 서술하면서 코드를
 * 괄호로 인용하는 자리가 통째로 빠진다 — chat-channel 가이드의 `executionFailed*` 키 표가
 * `HTTP_4XX`·`LLM_TIMEOUT`·`EXECUTION_TIMEOUT` 을 그렇게 적는다(6파일). 실패 어휘를 넣어
 * 66종으로 넓혔고 **부재 0건은 그대로**였다(실측). `MESSAGE_CREATE` 의 두 줄에는 실패
 * 어휘가 없어 여전히 빠진다.
 *
 * **남는 구멍**: 실패 어휘가 한 단어도 없는 줄에 코드를 적으면 안 걸린다. 이건 미검출
 * (false negative) 쪽 위험이고, 반대쪽(외부 어휘를 결함으로 신고)은 0 이다 — 허용목록이
 * 없는 대가로 이 방향을 택했다. 허용목록을 두면 *"Planned 니까"* 로 오늘의 결함이 다시
 * 들어오는 것이 더 비싸다.
 */
const CODE_CONTEXT =
  /error\.code|error code|에러 코드|\bfail(?:s|ed|ure)?\b|실패|\berror\b|오류|timed out|시간 초과|rate limit|요청 한도|returns \d{3}/i;

/**
 * 헤더에 코드 **열**이 있는 마크다운 표 — 그 본문 행은 전부 코드 문맥이다.
 *
 * 셀 내용이 정확히 `코드`/`Code`/`Codes` 인 열을 찾는다. 종전 판본은 헤더 줄 전체에
 * 부분일치(`.*(?:코드|Code)\b.*`)를 걸었는데 두 문제가 있었다 — (1) 헤더가 문장 안에서
 * "code" 를 스칠 때도 표 전체가 코드 문맥이 되고, (2) `\b` 는 JS 정규식에서 ASCII 워드
 * 문자로만 정의되므로 `코드` 뒤에서는 경계가 성립하지 않아 **한국어 헤더가 조용히 빠졌다**
 * (Python 으로 먼저 실측할 때는 `re` 가 유니코드 인식이라 통과해 차이가 안 보였다).
 */
const TABLE_HEADER_WITH_CODE = /^\|(?:[^|]*\|)*?\s*(?:코드|Codes?)\s*\|/;

/**
 * 코드 열을 가진 마크다운 표의 **본문 행** 인덱스 집합. 헤더 줄 자체와 구분자
 * (`|---|---|`) 는 토큰을 담지 않으므로 함께 포함해도 무해하지만, 표가 끝나는 지점
 * (`|` 로 시작하지 않는 첫 줄)에서 끊는다.
 */
function codeTableRows(lines: string[]): Set<number> {
  const rows = new Set<number>();
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("|") && TABLE_HEADER_WITH_CODE.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && lines[j].startsWith("|")) {
        rows.add(j);
        j += 1;
      }
      i = j;
    } else {
      i += 1;
    }
  }
  return rows;
}

/** 한 MDX 본문에서 에러 코드 인용을 전부 걷는다. 같은 줄의 중복 축은 각각 보고된다. */
export function scanErrorCodeCitations(mdx: string): ErrorCodeCitation[] {
  const lines = mdx.split("\n");
  const inCodeTable = codeTableRows(lines);
  const out: ErrorCodeCitation[] = [];

  lines.forEach((line, idx) => {
    const push = (axis: CitationAxis, rx: RegExp): void => {
      rx.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(line)) !== null) {
        out.push({ axis, code: m[1], line: idx + 1 });
      }
    };
    push("field-table", FIELD_TABLE_NAME);
    push("code-field", CODE_FIELD);
    if (CODE_CONTEXT.test(line) || inCodeTable.has(idx)) {
      push("prose", PROSE_BACKTICK);
    }
  });

  return out;
}

/**
 * backend·packages 소스에 등장하는 UPPER_SNAKE 토큰 전수 — 실재 판정의 기준집합.
 *
 * **`ErrorCode` enum 만 읽지 않는다.** `3-error-handling.md §1.4` 가 명시하듯 이 저장소의
 * 코드 앵커는 셋으로 갈리고(`ErrorCode` const · `EngineErrorCode` const · 에러 클래스의
 * `readonly code`) **상당수는 앵커 없는 맨 문자열**이다. enum 만 기준으로 삼으면 실재하는
 * 코드를 가이드가 적었는데 RED 가 뜬다 — 가드가 자기 사각지대를 결함으로 신고하는 형태다.
 */
export function collectBackendTokens(files: readonly string[]): Set<string> {
  const rx = new RegExp(`\\b(${UPPER_SNAKE})\\b`, "g");
  const tokens = new Set<string>();
  for (const text of files) {
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      tokens.add(m[1]);
    }
  }
  return tokens;
}
