// 유저 가이드가 이름으로 적은 **식별자가 실재하는가** 를 판정하는 순수 스캐너.
// 테스트는 `guide-identifier-existence.test.ts`.
//
// SoT: NERV `CLE-ENG-GUIDEEVIDENCE` 「빌드 가드」 의 「가이드 → 코드 대조 가드」 표
//      (소유 결정은 같은 문서 R-6, NERV Task `CLE-T-GTSEDT`).
// 카탈로그: NERV `CLE-API-ERRCODES` 「6. 카탈로그」 를 탈출구로만 읽는다. 가드는 미러
//      spec/CLE-API/CLE-API-ERRCODES.md 와 카탈로그 표를 맡은 하위 문서 미러
//      spec/CLE-API/CLE-API-ERRCODES-*.md 를 읽는다. 그 문서의 범위(명명 · rename 안정성 ·
//      예외 레지스트리)는 「발행」 까지 넓히지 않는다.
//
// ## 왜 "에러 코드" 가 아니라 "식별자" 인가
//
// `#1330` 은 이 가드를 **에러 코드 전용**으로 만들었다. 그런데 이 가드를 등재시킨 원래 근거는
// `#1328` 이 손으로 고친 **환경변수 오기**(`MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL`)
// 였고, `#1330` 의 세 축(`<FieldTable>` 의 `name` · `code:` 값 · 실패-문맥 산문)은 그 줄을 하나도
// 잡지 못했다. 토큰이 `description` 안에 있고 실패 어휘도 없었다. 테스트 「오기를 잡는다」 ·
// 「`#1330` 의 문맥-게이팅 축이었다면 놓쳤다」 · 「`field-table` 축도 이 줄을 못 잡는다」 가 고정한다.
//
// ## 축 (실측으로 결정)
//
// | 축 | 대상 | 허용목록 |
// |---|---|---|
// | `field-table` | `<FieldTable>` 의 `name` (따옴표) | 없음 |
// | `code-field` | `code:` 값 (따옴표) | 없음 |
// | `backtick` | **모든 백틱 UPPER_SNAKE** | 외부 어휘만 |
//
// `backtick` 축은 `#1330` 의 *"실패 문맥 산문"* 축을 **교체**한 것이다. 후자를 포함하므로
// 함께 두면 같은 토큰이 두 번 보고되고 축별 floor 가 서로를 가린다.
//
// ## 허용목록을 둔다
//
// `#1330` 은 *"허용목록 없음"* 을 설계 원칙으로 세웠지만 이 축에서는 유지할 수 없다. 유지하려면
// 문맥을 좁혀야 하고, 좁히면 위 결함 클래스가 통째로 빠진다. 허용목록이 은폐 수단이 되지 않도록
// 테스트가 네 가지를 강제한다: 외부 시스템 이름 의무 · 상한 · 여전히 인용될 것 · 기준집합에 없을 것.

// ## 이 가드가 **못** 보는 것 — 대부분 존재 검사다 (발행 축은 아래 §발행 축 참조)
//
// 술어는 *"그 토큰이 소스·env 선언처에 문자열로 있는가"* 다. 그래서 **실제로 발행되지 않는
// 토큰도 통과한다**:
//
// - 에러 **메시지 접두**로만 쓰이는 것 — `throw new Error('X_UNRESOLVED: …')` 의
//   `X_UNRESOLVED` 는 실재하지만 `output.error.code` 로는 나가지 않는다(catch 가
//   `err instanceof IntegrationError ? err.code : 'INTEGRATION_CALL_FAILED'`).
//   «메시지 접두로만 등장하고 카탈로그에도 없는» 인용은 `GUIDE_NON_EMITTED_VOCABULARY` 등록을
//   요구해 이 갈래를 **부분적으로** 닫았다(§발행 축). 소비자 목록이 같은 이름을 인용해 통과하는
//   경우는 그대로 열려 있다(`collectQuotedLiterals` 주석).
// - **읽히지 않는 env 변수** — `.env.example` 에 남아 있지만 아무도 `process.env` 로 읽지
//   않는 이름. 선언처에 있으니 통과한다.
//
// 예: `MAKESHOP_UNRESOLVED_PATH_PARAM` 은 메시지 접두로만 발행되는데 소스에 실재하므로 존재
// 축을 통과한다. (첫 판에서 이 토큰이 통과한 진짜 이유는 «실재» 가 아니라 `BACKTICK` 축이
// 인용 자체를 탐지하지 못해서였다. 지금은 탐지되고 등록으로 통과한다.)
//
// **이 주석을 지우지 말 것.** 가드가 무엇을 보장하지 *않는지* 가 적혀 있지 않으면 다음
// 사람이 "가드가 통과했으니 이 식별자는 실재한다" 로 읽는다.
//
// > 실제로 한 번 지워졌다. 이 파일을 `guide-error-code-scan.ts` 에서 재작성하면서였다.
// > 재작성은 리네임 · 이동과 달리 diff 가 "삭제+생성" 으로 보여 **무엇이 사라졌는지가 눈에 안
// > 띈다**. 다음에 이 파일을 재작성하거나 주석을 크게 줄이면 먼저 옛 판본의 주석 절 목록을
// > 뽑아 대조할 것.

// ## 정규식 경계 — 방향이 둘이다
//
// | 정규식 | 과매치 | 미탐지 |
// |---|---|---|
// | `FIELD_TABLE_NAME` | 안전 (`{ xname:` 은 리터럴과 안 맞는다) | `name` 이 첫 키가 아니어도 잡는다 |
// | `CODE_FIELD` | 하이픈 키는 의도적 과매치 | 안전 — 키 이름이 `code` 로 고정 |
// | `BACKTICK` | 안전 (구분자가 명시적) | 스팬에 다른 글자가 섞여도 잡는다 |
// | `SOURCE_TOKEN` 의 `\b…\b` | 안전 — 대조군 「워드 경계 안쪽의 부분 문자열은 안 센다」 | 안전 |
// | `ENV_LINE` · `COMPOSE_LINE` | 안전 (`^` 행 앵커) | compose **매핑 스타일만** — fail-closed 라 유지 |
//
// **두 방향은 결과가 반대다.** 기준집합(`collectSourceTokens`·`collectEnvDeclarations`)은
// **넓어지면 거짓 PASS**, 인용집합(세 축)은 **좁아지면 거짓 PASS** 다. 같은 "경계" 라는 낱말을
// 써도 어느 집합이냐에 따라 안전한 방향이 뒤집힌다. 한때 과매치 방향만 보고 다섯 정규식을
// "안전" 으로 판정했다가 미탐지 둘(축 1 키 순서 · 축 3 혼합 스팬)을 놓쳤다.

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

// 이 파일의 정규식은 모두 토큰을 **이름 붙은 그룹 `token`** 으로 낸다. 값은 `matchTokens` 한
// 곳에서만 꺼낸다. 그룹 번호를 정수로 넘기던 때는 그룹 순서가 바뀌면 `undefined` 가 조용히
// `Set` 에 섞일 수 있었다. 지금은 그룹이 없으면 throw 한다.

/**
 * 축 1 — `<FieldTable rows={[{ name: "CODE", … }]} />` 의 객체 리터럴 키.
 *
 * **판정은 줄 단위다.** 오늘 코퍼스의 `<FieldTable>` 행은 전부 한 줄 스타일이라 이것으로
 * 충분하지만, 한 행을 여러 줄로 쪼개면 `{ name:` 과 `"CODE"` 가 갈려 **조용히 빠진다**.
 * (`description` 안의 토큰은 이 축이 아니라 `backtick` 축이 잡는다.)
 *
 * `\\{[^}]*?\\bname:` 이라 `name` 이 첫 키가 아니어도 잡고 같은 객체 리터럴 안에 머문다.
 * 대조군 「축 1 — `name` 이 첫 키가 아니어도 집는다」.
 */
const FIELD_TABLE_NAME = new RegExp(
  `\\{[^}]*?\\bname:\\s*"(?<token>${UPPER_SNAKE})"`,
  "g",
);

/**
 * 축 2 — 예시 코드펜스의 `"code": "CODE"` / `code: "CODE"`.
 *
 * 왼쪽 경계 `(?<!\\w)` 가 `"mycode":` · `"error_code":` · `"http_code":` 를 막는다(`_` 도
 * 워드 문자다). camelCase `"statusCode"` 는 대문자 `C` 라 애초에 안 걸린다.
 *
 * **하이픈 키(`"x-code"`·`"status-code"`)는 «의도적으로» 걸린다. 경계를 `(?<![\\w-])` 로
 * 좁히지 않는다.**
 *
 * | 입력 | 현행 `(?<!\\w)` | 좁힌 `(?<![\\w-])` |
 * |---|---|---|
 * | `"code": "X_Y"` · `code: "X_Y"` | 매치 | 매치 |
 * | `"mycode":` · `"error_code":` · `"http_code":` · `"statusCode":` | 미매치 | 미매치 |
 * | `"x-code":` · `"status-code":` | **매치** | **미매치** ← 유일하게 갈리는 자리 |
 *
 * 이 가드에서 **과매치는 fail-closed 다** — 더 많은 토큰이 `basis` 대조를 받으므로 가짜
 * 이름이 RED 를 낸다. 좁히면 그 토큰이 **검사 자체를 안 받는다**(거짓 PASS 방향). 가이드의
 * `x-code: "INTEGRATION_CALL_FAILED"` 같은 HTTP 헤더 예시도 진짜 식별자를 담는다. 축 라벨만
 * `code-field` 로 붙을 뿐 판정(`basis.has`)은 축과 무관하다. 대조군이 이 결정을 고정한다.
 */
const CODE_FIELD = new RegExp(
  `(?<!\\w)"?code"?\\s*:\\s*"(?<token>${UPPER_SNAKE})"`,
  "g",
);

/**
 * 축 3 — 백틱 스팬 **안의** 모든 UPPER_SNAKE. 문맥으로 게이팅하지 않는다.
 *
 * 게이팅하면 과거 결함이 빠진다(파일 상단). 대가는 외부 어휘 오탐이고, 그것은
 * `GUIDE_EXTERNAL_VOCABULARY` 로 **명시적으로** 받는다.
 *
 * 스팬을 먼저 끊고 그 안을 `BACKTICK_INNER` 로 다시 훑는 2단이다. 1단(`` /`(TOKEN)`/ ``)이면
 * 스팬 전체가 토큰 하나일 때만 잡혀 아래 형태가 빠진다. 첫 판이 그랬고 6종
 * (`ALLOW_HTTP_HOOKS` · `INVALID_FIELD` · `MAKESHOP_UNRESOLVED_PATH_PARAM` · `NODE_ENV` ·
 * `PARALLEL_ENGINE` · `UNKNOWN_PLACEHOLDER`)이 검사를 한 번도 받지 못했다. 테스트
 * 「혼합 백틱 스팬에만 등장하는 6종도 검사받는다」 · 「축 3 — 스팬에 다른 글자가 섞여도 집는다」.
 *
 * | 형태 | 1단 | 2단 |
 * |---|---|---|
 * | `` `REAL_TOKEN` `` | 매치 | 매치 |
 * | `` `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE` `` | **미매치** | 매치 |
 * | `` `PARALLEL_ENGINE=v1` `` | **미매치** | 매치 |
 * | `` `details.code='UNKNOWN_PLACEHOLDER'` `` | **미매치** | 매치 |
 * | `` `MAKESHOP_UNRESOLVED_PATH_PARAM: operation …` `` | **미매치** | 매치 |
 */
// 정규식 리터럴로 쓰지 않는다. frontend `target` 이 ES2017 이라 tsc 가 리터럴의 이름 붙은 그룹을
// TS1503 으로 막는다(`check-frontend-typecheck-ratchet.py`). 이 파일의 정규식은 모두 `new RegExp` 다.
const BACKTICK_SPAN = new RegExp("`(?<span>[^`\\n]+)`", "g");

/**
 * 백틱 스팬 **안쪽**을 다시 훑는 토큰 패턴.
 *
 * 워드 경계가 막는 것은 `camelPREFIX_ONE` 처럼 **앞에 워드 문자가 붙은** 자리다. 경계가 없으면
 * 거기서 `PREFIX_ONE` 을 오려내 인용으로 세고, 기준집합에 없으니 **거짓 RED** 다.
 * (`X_YMORE` 는 `UPPER_SNAKE` 가 greedy 라 경계와 무관하게 통째로 먹는다.)
 * 방향이 `SOURCE_TOKEN` 의 `\b` 와 **반대**다 — 저쪽은 기준집합이라 경계가 없으면 거짓 PASS 다.
 */
const BACKTICK_INNER = new RegExp(`\\b(?<token>${UPPER_SNAKE})\\b`, "g");

// ## 발행 축의 정규식 셋
//
// | 정규식 | 무엇을 집나 | 경계 |
// |---|---|---|
// | `QUOTED_LITERAL` | `'X'` · `"X"` · `` `X` `` — 따옴표가 **토큰만** 감쌀 때 | 여는·닫는 따옴표가 같아야 한다 |
// | `MESSAGE_PREFIX` | `'X: …'` — 토큰 뒤에 `:` + 공백 | 여는 따옴표 직후여야 한다 |
// | `CATALOG_CODE` | spec 마크다운의 `` `X` `` | 백틱 양쪽 |

/** 따옴표가 **토큰만** 감싼 리터럴. 여는·닫는 따옴표가 같아야 한다(역참조). */
const QUOTED_LITERAL = new RegExp(
  `(?<quote>['"\`])(?<token>${UPPER_SNAKE})\\k<quote>`,
  "g",
);

/** 메시지 접두 — 여는 따옴표 **직후**의 토큰 + `:` + 공백. */
const MESSAGE_PREFIX = new RegExp(`['"\`](?<token>${UPPER_SNAKE}):\\s`, "g");

/** spec 카탈로그의 백틱 인용. */
const CATALOG_CODE = new RegExp(`\`(?<token>${UPPER_SNAKE})\``, "g");

/** 소스의 UPPER_SNAKE 토큰. 경계 방향은 위 §정규식 경계 표. */
const SOURCE_TOKEN = new RegExp(`\\b(?<token>${UPPER_SNAKE})\\b`, "g");

/** `.env.example` 의 `KEY=` · `# KEY=` 줄. */
const ENV_LINE = new RegExp(`^#?\\s*(?<token>${UPPER_SNAKE})=`, "gm");

/** compose 의 매핑 스타일 `  KEY: value` 줄. 리스트 스타일은 `collectEnvDeclarations` 주석. */
const COMPOSE_LINE = new RegExp(`^\\s+(?<token>${UPPER_SNAKE}):\\s`, "gm");

/**
 * 한 텍스트에서 정규식의 `token` 그룹을 순서대로 낸다. 이 파일의 매치는 전부 여기를 지난다.
 *
 * 손으로 쓴 `rx.lastIndex = 0` → `while ((m = rx.exec(t)))` 는 리셋을 빠뜨리거나 다른 곳이
 * 같은 정규식을 쓰다 멈추면 다음 호출의 앞부분 매치를 조용히 건너뛴다. 그 관용구를 이 함수 하나로
 * 바꿨다.
 *
 * `matchAll` 만으로는 부족하다. 정규식을 복제하지만 원본의 `lastIndex` 까지 이어받아 그 위치부터
 * 찾는다. 그래서 `new RegExp(rx)` 로 `lastIndex` 0 인 사본을 만들어 넘긴다. 원본은 건드리지 않는다.
 * 대조군 「`matchTokens` 는 정규식의 `lastIndex` 에 기대지 않는다」(사본을 빼면 RED).
 */
export function matchTokens(text: string, rx: RegExp): string[] {
  return [...text.matchAll(new RegExp(rx))].map((m) => {
    const token = m.groups?.token;
    if (token === undefined) {
      throw new Error(
        `정규식 ${rx.source} 에 이름 붙은 그룹 \`token\` 이 없다`,
      );
    }
    return token;
  });
}

/** 여러 텍스트의 `token` 그룹을 중복 없이 모은다. */
function collectMatches(texts: readonly string[], rx: RegExp): Set<string> {
  const tokens = new Set<string>();
  for (const text of texts) {
    for (const token of matchTokens(text, rx)) tokens.add(token);
  }
  return tokens;
}

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

/**
 * **메시지 접두일 뿐 `error.code` 로 발행되지 않는** 토큰. 위 목록의 **거울상**이다.
 *
 * | 목록 | 무엇을 면제하나 | 제약 |
 * |---|---|---|
 * | `GUIDE_EXTERNAL_VOCABULARY` | **존재** 축 | 기준집합에 **없을** 것 |
 * | `GUIDE_NON_EMITTED_VOCABULARY` | **발행** 축 | 기준집합에 **있을** 것 |
 *
 * **제약이 정확히 반대라 두 목록은 합칠 수 없다.** 합치면 예외 하나가 두 축의 결함을 동시에
 * 덮는다. 문맥 술어에 숨기는 대신 명시적으로 적고 사유를 강제한다.
 *
 * **등록이 이 축의 값이다.** 새로 «메시지 접두로만 등장하고 카탈로그에도 없는» 토큰이
 * 가이드에 등장하면 사유를 적기 전까지 RED 다. 사유를 적으면서 *"그럼 이 문장은 정확한가?"* 를
 * 묻게 된다. `CONTAINER_*` 두 문장이 그 질문에 걸려 정정됐다.
 */
export const GUIDE_NON_EMITTED_VOCABULARY: readonly {
  token: string;
  /**
   * 접두를 붙이는 자리. 사유가 "어디서" 를 지목하지 못하면 등록이 통행증이 된다.
   * 줄 번호가 움직여도 깨지지 않는 `파일.ts#심볼` 로 적는다. `파일.ts:줄` 은 쓰지 않는다
   * (엔진 서비스에 줄이 더해질 때마다 따로 고쳐야 했다. 테스트가 막는다).
   */
  where: string;
  why: string;
}[] = [
  {
    token: "MAKESHOP_UNRESOLVED_PATH_PARAM",
    where:
      "makeshop.handler.ts#MAKESHOP_UNRESOLVED_PATH_PARAM — 일반 `Error` 메시지 접두",
    why: "catch 가 `err instanceof IntegrationError ? err.code : 'INTEGRATION_CALL_FAILED'` 라 `output.error.code` 에는 공용 fallback 이 들어간다. 가이드는 이미 '전용 코드가 없어요 … 코드가 아니라 메시지를 봐야 해요' 라고 정확히 적고 있어 문장 수정이 아니라 등록이 맞다.",
  },
  {
    token: "CONTAINER_MISSING_EMIT",
    where:
      "execution-engine.service.ts#CONTAINER_MISSING_EMIT — 템플릿 리터럴 메시지 접두",
    why: "구조화된 `error.code` 로 나가지 않는다. 가이드가 '…로 실행 실패해요' 라고 적어 코드처럼 읽혔고 이 배치에서 '메시지 앞에 붙어요' 로 정정했다. 2026-11-12 에 전용 코드를 만들지도, 카탈로그 행으로 등재하지도 않기로 정했다(NERV Task `CLE-T-1W44RD`. `CLE-API-ERRCODES` 「6.5」 는 이 이름을 행 없이 메시지 접두로 적는다). 그래서 이 등록은 계속 필요하다.",
  },
  {
    token: "CONTAINER_MULTIPLE_EMIT",
    where: "execution-engine.service.ts#CONTAINER_MULTIPLE_EMIT — 형제 접두",
    why: "위와 동형. 두 이름은 같은 문장에 함께 등장하므로 처분도 함께 한다.",
  },
];

/**
 * 소스에서 **«정확히 토큰만» 담은 따옴표 리터럴**로 등장하는 토큰 전수.
 *
 * `'X'` · `"X"` · `` `X` `` 세 형태를 받는다. 메시지 접두(`'X: …'`)는 따옴표 안에 토큰
 * 외의 글자가 있으므로 **여기 안 걸린다** — 그 갈림이 이 함수의 존재 이유다.
 *
 * **이 집합을 «발행» 의 증거로 쓰지 않는다.** `CLE-API-ERRCODES` 「6.5」 가 명시하듯
 * *"… `execution-failure-classifier.ts` 의 목록)에도 같은 이름이 나오지만 그것은 소비자·분류기
 * 쪽 어휘이지 엔진 발행 경로의 앵커가 아니다"* — 실제로 `MAX_ITERATIONS_EXCEEDED` 는
 * 메시지 접두로만 발행되는데 그 분류기가 인용해서 여기 들어온다.
 *
 * 그래서 호출부는 이것을 **통과 조건이 아니라 «접두 전용» 을 부정하는 데만** 쓴다.
 */
export function collectQuotedLiterals(
  fileTexts: readonly string[],
): Set<string> {
  return collectMatches(fileTexts, QUOTED_LITERAL);
}

/**
 * 소스에서 **메시지 접두**(`'X: …'`)로 등장하는 토큰 전수.
 *
 * `throw new Error('X: 설명')` · 템플릿 리터럴 `` `X: ${…}` `` 둘 다 대상이다. 실제
 * 코퍼스가 둘을 섞어 쓴다 — makeshop 은 작은따옴표, 엔진은 템플릿 리터럴이다(실측).
 */
export function collectMessagePrefixes(
  fileTexts: readonly string[],
): Set<string> {
  return collectMatches(fileTexts, MESSAGE_PREFIX);
}

/**
 * spec 에러 코드 **카탈로그**가 백틱으로 등재한 코드 전수.
 *
 * 호출부는 NERV `CLE-API-ERRCODES` 미러의 「6. 카탈로그」 절만 넘긴다. 미러 전체를 넘기면
 * 은퇴 코드 · 규칙 예시도 탈출구가 된다(2026-10-03 실측: 전체 189종, 절 170종). 절 안 산문이
 * 은퇴 코드를 백틱으로 가리키면 그 토큰은 여전히 걸린다(현재 `INVALID_PASSWORD` 1종. 감사
 * 사유값으로 소스에 실재해 접두 전용 술어에 걸리지 않으므로 판정은 같다).
 *
 * **카탈로그는 «요구 조건» 이 아니라 «탈출구» 다.** 요구 조건으로 쓰면 진짜 발행되는 미등재
 * 통합 코드(`CAFE24_*`·`MAKESHOP_*`·`INTEGRATION_*`)에 거짓 RED 가 난다(2026-09-13 실측 25건).
 * 그 미등재는 별건이고(NERV Task `CLE-T-DM3AXQ` 항목 4) 가드가 남의 미완결을 신고하게 두지
 * 않는다. 탈출구로 쓰면 그 코드들은 애초에 접두 전용이 아니라 술어에 안 걸리므로 무해하다.
 *
 * ## 이 탈출구는 오늘 한 번도 발화하지 않는다
 *
 * 인용된 «접두 전용» 토큰 중 카탈로그 등재는 0종이다. 테스트 「[한계] 카탈로그 탈출구는 오늘
 * 한 번도 발화하지 않는다」 가 고정하고, 「[대조군] 그래도 탈출구가 작동은 한다」 가 합성 입력으로
 * 동작을 확인한다. 그래도 남기는 근거는 두 가지다(NERV Task `CLE-T-82M3MB` 판단).
 *
 * 1. **원래 역할은 그대로다.** 카탈로그에 정식 코드로 오른 이름이 소스에서 메시지 접두로만
 *    보이면 그것은 카탈로그와 구현의 어긋남이지 가이드 문장의 잘못이 아니다.
 * 2. **지우면 아래 함정을 알릴 신호도 함께 없어진다.**
 *
 * ## 처음 발화할 자리 — `MAX_ITERATIONS_EXCEEDED` 함정
 *
 * 카탈로그 「6.5」 의 `MAX_ITERATIONS_EXCEEDED` 행은 앵커 열이 `메시지 접두` 이고 설명에
 * *"코드가 아니다"* 라고 적혀 있다. 그런데 `CATALOG_CODE` 는 행의 뜻을 보지 않고 절 안의
 * 백틱 토큰을 모두 세므로 이 이름도 등재 코드로 센다. 지금은 분류기의 소비자 Set
 * (`execution-failure-classifier.ts`) 인용 때문에 접두 전용 단계에서 먼저 탈락해 문제가 없다
 * (테스트 「[회귀] `MAX_ITERATIONS_EXCEEDED` 는 소비자-인용 때문에 통과한다」). 그 인용이
 * 지워지면(분류기의 미발행 코드 정리, NERV Task `CLE-T-8WXV7T`) 이 탈출구가 그 이름을 구하고
 * «0회 발화» 단언이 RED 가 된다.
 *
 * **그 RED 는 "등록을 지워도 된다" 는 신호가 아니다.** 코드가 아니라고 적은 행을 탈출구로
 * 통과시키면 거짓 통과다. 그때는 카탈로그 행을 지우거나 이 이름을
 * `GUIDE_NON_EMITTED_VOCABULARY` 에 등록한다. 가이드 실행 결과 페이지는 이미 이 이름을
 * 메시지 접두로 적는다.
 */
export function collectCatalogCodes(specTexts: readonly string[]): Set<string> {
  return collectMatches(specTexts, CATALOG_CODE);
}

/**
 * 발행 축의 **핵심 술어** — *"이 토큰은 메시지 접두로만 등장하는가"*.
 *
 * | 접두에 있나 | 토큰-단독 리터럴이 있나 | 판정 |
 * |---|---|---|
 * | 예 | 아니오 | **`true`** — 접두 전용 |
 * | 예 | 예 | `false` — 소비자·분류기가 인용한다(§`collectCatalogCodes` 주석) |
 * | 아니오 | 예 | `false` — 평범한 발행 코드 |
 * | 아니오 | 아니오 | `false` — 이 축의 대상이 아니다 |
 *
 * **두 인자를 분리해 받는 이유**는 각 조합을 합성 입력으로 직접 고정하기 위해서다. 하나로
 * 묶으면 `(false, true)`·`(false, false)` 가 실제 코퍼스에 없어 영영 관측되지 않는다.
 */
export function isMessagePrefixOnly(
  token: string,
  messagePrefixes: ReadonlySet<string>,
  quotedLiterals: ReadonlySet<string>,
): boolean {
  return messagePrefixes.has(token) && !quotedLiterals.has(token);
}

/**
 * 발행 축의 **판정 정본** — 인용 토큰 중 «등록이 필요한» 것을 낸다.
 *
 * ```
 * offender = 인용됨 ∧ 접두-전용 ∧ ¬카탈로그 ∧ ¬등록
 * ```
 *
 * 베이스라인 단언과 대조군이 **이 함수 하나를 부른다.** 테스트가 판정 체인을 손으로 다시 쓰던
 * 때는 실제 체인에서 카탈로그 필터 한 줄을 지워도 스위트가 GREEN 이었다(헬퍼 테스트 ≠ 호출부
 * 테스트). 이제 어느 항을 지워도 양쪽이 함께 RED 다(「computeNonEmittedOffenders — 네 항이
 * 각각 무는가」).
 */
export function computeNonEmittedOffenders(
  citedTokens: Iterable<string>,
  sets: {
    messagePrefixes: ReadonlySet<string>;
    quotedLiterals: ReadonlySet<string>;
    catalogCodes: ReadonlySet<string>;
    registered: ReadonlySet<string>;
  },
): string[] {
  return [...new Set(citedTokens)]
    .filter((t) =>
      isMessagePrefixOnly(t, sets.messagePrefixes, sets.quotedLiterals),
    )
    .filter((t) => !sets.catalogCodes.has(t))
    .filter((t) => !sets.registered.has(t))
    .sort();
}

/** 한 MDX 본문에서 식별자 인용을 전부 걷는다. 같은 줄의 중복 축은 각각 보고된다. */
export function scanIdentifierCitations(mdx: string): IdentifierCitation[] {
  const out: IdentifierCitation[] = [];

  mdx.split("\n").forEach((line, idx) => {
    const push = (axis: CitationAxis, text: string, rx: RegExp): void => {
      for (const token of matchTokens(text, rx)) {
        out.push({ axis, token, line: idx + 1 });
      }
    };
    push("field-table", line, FIELD_TABLE_NAME);
    push("code-field", line, CODE_FIELD);

    // 백틱 축만 2단이다 — 스팬을 먼저 끊고 그 «안» 을 다시 훑는다(`BACKTICK_SPAN` 주석).
    for (const span of line.matchAll(BACKTICK_SPAN)) {
      push("backtick", span.groups?.span ?? "", BACKTICK_INNER);
    }
  });

  return out;
}

/**
 * 소스에 등장하는 UPPER_SNAKE 토큰 전수 — 실재 판정의 기준집합 절반.
 *
 * **`ErrorCode` enum 만 읽지 않는다.** `CLE-API-ERRCODES` 「6.5」 가 명시하듯 이 저장소의
 * 코드 앵커는 셋으로 갈리고(`ErrorCode` const · `EngineErrorCode` const · 에러 클래스의
 * `readonly code`) **상당수는 앵커 없는 맨 문자열**이다. enum 만 기준으로 삼으면 실재하는
 * 코드를 가이드가 적었는데 RED 가 뜬다 — 가드가 자기 사각지대를 결함으로 신고하는 형태다.
 */
export function collectSourceTokens(fileTexts: readonly string[]): Set<string> {
  return collectMatches(fileTexts, SOURCE_TOKEN);
}

/**
 * 환경변수 **선언처** 토큰 — 기준집합의 나머지 절반.
 *
 * 소스의 `process.env.X` 는 `collectSourceTokens` 가 이미 걷는다. 이쪽은 **소스에서 읽지 않는
 * 변수**를 보탠다 — compose 가 컨테이너에 주입만 하는 값(`POSTGRES_*`·`MINIO_*`)이나 프런트
 * 빌드타임 변수(`NEXT_PUBLIC_*`). 전부 인프라·런타임 설정 이름이라(`*_FAILED`/`*_ERROR` 같은
 * 에러 코드꼴 0건) 이 병합이 에러 코드 축을 가리지 않는다.
 *
 * **오늘 이 병합은 판정을 지탱하지 않는다.** 가이드가 인용하는 env 변수가 전부 소스에도 있어서
 * 이 함수를 빼도 스위트는 GREEN 이다(테스트 「env 선언처 수집기가 살아 있다 (오늘 판정은 지탱하지
 * 않는다)」). 남기는 이유는 *내일의 오탐*이다 — 가이드가 `POSTGRES_PASSWORD` 나
 * `NEXT_PUBLIC_WS_URL` 을 적으면 기준집합이 좁을 때 실재하는 변수에 RED 가 난다.
 *
 * **compose 는 매핑 스타일(`KEY: value`)만 읽고 리스트 스타일(`- KEY=value`)은 못 읽는다.**
 * 저장소의 compose 파일에 리스트 스타일은 0건이다. 확장하지 않고 현행 미지원을 대조군으로
 * 고정했다. 이 갭은 fail-closed 다 — 리스트 스타일이 생기면 그 변수가 기준집합에서 빠져
 * 가이드 인용이 RED 가 난다(거짓 경보이지 거짓 PASS 가 아니다). 반대로 정규식을 넓히면
 * 기준집합이 부풀어 거짓 PASS 방향으로 간다. vacuity floor 가 `POSTGRES_PASSWORD`(compose 주입
 * 전용)를 단언하므로 compose 를 리스트 스타일로 바꾸면 그 floor 가 먼저 RED 로 알린다.
 */
export function collectEnvDeclarations(
  envExampleTexts: readonly string[],
  composeTexts: readonly string[],
): Set<string> {
  return new Set([
    ...collectMatches(envExampleTexts, ENV_LINE),
    ...collectMatches(composeTexts, COMPOSE_LINE),
  ]);
}
