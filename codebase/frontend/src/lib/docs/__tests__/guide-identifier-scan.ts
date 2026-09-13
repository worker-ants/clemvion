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

// ## 이 가드가 **못** 보는 것 — 대부분 존재 검사다 (발행 축은 아래 §발행 축 참조)
//
// > **2026-09-13 에 한 칸 좁혔다.** *"메시지 접두로만 등장하고 카탈로그에도 없는"* 인용은
// > 이제 `GUIDE_NON_EMITTED_VOCABULARY` 등록을 요구한다(§발행 축). 아래 두 갈래 중 **첫째가
// > 부분적으로 닫혔고**, 둘째와 *"소비자 목록이 인용해서 통과하는"* 경우는 그대로 열려 있다.
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
// > **그런데 이 절은 자기 예시의 «이유» 를 틀리게 적고 있었다 (라운드 7 에 정정).**
// > 가드가 `MAKESHOP_UNRESOLVED_PATH_PARAM` 을 통과시킨 진짜 이유는 *"이름이 소스에
// > 실재해서"* 가 **아니라 인용 자체를 탐지하지 못해서**였다 — 가이드의 표기가
// > `` `MAKESHOP_UNRESOLVED_PATH_PARAM: operation '…'` `` 이라 첫 판 `BACKTICK` 축의
// > *"스팬 전체가 토큰 하나"* 조건에 걸리지 않았다(전수 재현).
// >
// > 즉 **한계 절이 있었는데도 그 자리에 다른 결함이 숨어 있었다.** 지금은 인용이
// > 탐지되고, 위 두 갈래(메시지 접두 · 안 읽히는 env)의 한계는 그대로 유효하다 —
// > 이 토큰은 이제 *탐지되고 통과한다*(존재하므로). 예시로서는 여전히 맞고 **이유가
// > 달라졌다**. 틀린 근거는 다음 사람의 판단 기준을 바꾸므로 지우지 않고 정정만 한다.
//
// **이 주석을 지우지 말 것.** 가드가 무엇을 보장하지 *않는지* 가 적혀 있지 않으면 다음
// 사람이 "가드가 통과했으니 이 식별자는 실재한다" 로 읽는다.
//
// > **그리고 실제로 지워졌다 — 이 파일을 `guide-error-code-scan.ts` 에서 재작성하면서.**
// > 같은 문장을 쓴 사람이 한 PR 뒤에 그것을 지웠고, `/ai-review`
// > (`review/code/2026/09/13/14_41_14` documentation WARNING#3)가 잡았다.
// >
// > (이 자리에 **아직 열리지 않은 PR 번호**를 적었다가 라운드 6 에서 뺐다. 번호는 push
// > 전에는 확정되지 않아 병렬 세션이 먼저 PR 을 열면 **남의 PR 을 가리킨다** — 검증 불가능한
// > 단정이다. 바로 위 리뷰 세션 경로가 이미 확정된 앵커이므로 번호는 군더더기였다.)
// >
// > 파일 **재작성**은 리네임·이동과 달리 diff 가
// > "삭제+생성" 으로 보여 **무엇이 사라졌는지가 눈에 안 띈다**. 다음에 이 파일을 재작성하면
// > 먼저 옛 판본의 주석 절 목록을 뽑아 대조할 것.

// ## 정규식 경계 — 전수 감사 (라운드 5) + **그 감사가 틀렸던 자리** (라운드 7)
//
// 경계 결함이 한 축씩 발견되는 것을 멈추려고, 이 파일의 정규식 5개를 한 번에 점검했다.
// *"리뷰어가 찾은 것만 고치고 다음 라운드를 기다린다"* 를 끊는 것이 목적이었다.
//
// **그 감사는 «과매치» 방향만 봤다.** 표의 "안전" 은 전부 *"필요 이상으로 잡지 않는다"*
// 를 뜻했고, **«못 잡는» 방향은 묻지 않았다**. 라운드 7 이 그 자리에서 CRITICAL 하나와
// WARNING 하나를 냈다 — 둘 다 fail-open(미탐지)이다. 그래서 표에 방향 칸을 넣는다.
//
// | 정규식 | 과매치 | 미탐지 |
// |---|---|---|
// | `FIELD_TABLE_NAME` | 안전 (`{ xname:` 은 리터럴과 안 맞는다) | **라운드 7 에 고침** — `name` 이 첫 키가 아니면 빠졌다 |
// | `CODE_FIELD` | **두 번 고쳤다**. 하이픈 키는 의도적 과매치 | 안전 — 키 이름이 `code` 로 고정 |
// | `BACKTICK` | 안전 (구분자가 명시적) | **라운드 7 CRITICAL** — 스팬 전체가 토큰 하나일 때만 잡았다 |
// | `collectSourceTokens` 의 `\b…\b` | 안전하되 **자기검증 부재** → 라운드 5 대조군 | 안전 — 기준집합은 넓을수록 위험하지 좁아서 위험하지 않다 |
// | `collectEnvDeclarations` 의 두 정규식 | 안전 (`^` 행 앵커) | compose **매핑 스타일만** — fail-closed 라 유지 (아래 JSDoc) |
//
// **두 방향은 결과가 반대다.** 기준집합(`collectSourceTokens`·`collectEnvDeclarations`)은
// **넓어지면 거짓 PASS**, 인용집합(세 축)은 **좁아지면 거짓 PASS** 다. 같은 "경계" 라는
// 낱말을 써도 어느 집합이냐에 따라 안전한 방향이 뒤집힌다 — 라운드 5 가 한 낱말로 다섯
// 정규식을 묶어 판정하면서 이 차이를 뭉갰다.
//
// **`collectSourceTokens` 의 `\b` 가 없으면 기준집합이 부풀어 «거짓 PASS» 가 된다** —
// `xMY_TOKEN` 안의 `MY_TOKEN` 까지 실재로 세므로, 가이드가 적은 가짜 토큰이 우연히 어떤
// 식별자의 부분 문자열이면 통과한다. 방향이 «검출 실패» 쪽이라 특히 조용하다.

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
 *
 * **`name` 이 첫 키가 아니어도 잡는다.** 첫 판은 `\\{\\s*name:` 이라 `{ type: "x",
 * name: "CODE" }` 처럼 **키 순서가 다르면 조용히 빠졌다**(fail-open). 오늘 코퍼스의
 * `<FieldTable>` 행 242개는 전부 `name` 이 첫 키라 관측되지 않던 갭이다
 * (`/ai-review` `review/code/2026/09/13/16_56_29` requirement WARNING#1).
 * 지금은 `\\{[^}]*?\\bname:` — `[^}]` 이므로 **같은 객체 리터럴 안에 머문다**.
 * 넓히는 방향인 것이 맞다: 이 가드에서 더 많은 인용을 보는 것은 fail-closed 다.
 */
const FIELD_TABLE_NAME = new RegExp(
  `\\{[^}]*?\\bname:\\s*"(${UPPER_SNAKE})"`,
  "g",
);

/**
 * 축 2 — 예시 코드펜스의 `"code": "CODE"` / `code: "CODE"`.
 *
 * **왼쪽 경계가 필요하다.** 경계가 없으면 `code` 로 **끝나는** 키가 걸린다 —
 * `"mycode": "X"` 가 `code"` 부분에서 매치된다(실측). camelCase 인 `"statusCode"` 는
 * 대문자 `C` 라 애초에 안 걸린다.
 *
 * **경계를 두 번 고쳤다.** 첫 판은 `(?<![A-Za-z])` 였고 주석에 *"위험한 형태는 전부 소문자로
 * `code` 로 끝나는 키"* 라고 단정했는데, **그 단정이 고친 범위보다 넓었다** — `_` 는
 * `[A-Za-z]` 가 아니라 `"error_code":`·`"http_code":` 가 그대로 통과했다
 * (`/ai-review` `review/code/2026/09/13/16_04_15` requirement WARNING#1 · 직접 재현).
 * 지금은 `(?<!\\w)` — 워드 문자(`[A-Za-z0-9_]`) 전체를 배제한다. 6갈래 실측 대조표에서
 * 불일치 **2건 → 0건**.
 *
 * **하이픈 키(`"x-code"`·`"status-code"`)는 «의도적으로» 걸린다.** `-` 는 `\\w` 가 아니라
 * 왼쪽 경계를 통과한다(실측). `/ai-review`(`review/code/2026/09/13/16_28_47` requirement
 * INFO#1)가 이것을 축 라벨 오분류로 지적했고 경계를 `(?<![\\w-])` 로 좁힐 것을 제안했는데,
 * **좁히는 쪽이 틀렸다** — 8갈래로 직접 재현해 두 판본이 갈리는 자리를 특정했다:
 *
 * | 입력 | 현행 `(?<!\\w)` | 좁힌 `(?<![\\w-])` |
 * |---|---|---|
 * | `"code": "X_Y"` · `code: "X_Y"` | 매치 | 매치 |
 * | `"mycode":` · `"error_code":` · `"http_code":` · `"statusCode":` | 미매치 | 미매치 |
 * | `"x-code":` · `"status-code":` | **매치** | **미매치** ← 유일하게 갈리는 자리 |
 *
 * 이 가드에서 **과매치는 fail-closed 다** — 더 많은 토큰이 `basis` 대조를 받으므로 가짜
 * 이름이 RED 를 낸다. 좁히면 그 토큰이 **검사 자체를 안 받는다**(거짓 PASS 방향). 게다가
 * 가이드의 `x-code: "INTEGRATION_CALL_FAILED"` 같은 HTTP 헤더 예시는 진짜 식별자를 담으므로
 * 검사 대상인 것이 맞다. 축 라벨만 `code-field` 로 붙을 뿐 **판정(`basis.has`)은 축과
 * 무관하다**. 대조군이 이 결정을 고정한다 — 다음 사람이 "경계를 마저 좁히자" 로 읽지 않도록.
 */
const CODE_FIELD = new RegExp(`(?<!\\w)"?code"?\\s*:\\s*"(${UPPER_SNAKE})"`, "g");

/**
 * 축 3 — 백틱 스팬 **안의** 모든 UPPER_SNAKE. 문맥으로 게이팅하지 않는다.
 *
 * 게이팅하면 과거 결함이 빠진다는 것이 이 파일 상단의 실측이다. 대가는 외부 어휘 오탐이고,
 * 그것은 `GUIDE_EXTERNAL_VOCABULARY` 로 **명시적으로** 받는다 — 문맥 술어에 숨기지 않는다.
 *
 * ## 이 축은 한 번 «모든» 을 참칭했다 (라운드 7 CRITICAL)
 *
 * 첫 판은 `` /`(UPPER_SNAKE)`/ `` — **백틱과 토큰이 붙어 있어야** 매치되므로 사실상
 * *"스팬 전체가 정확히 토큰 하나뿐일 때"* 만 잡았다. 그런데 주석은 *"**모든** 백틱
 * UPPER_SNAKE"* 라고 썼다. **문서한 보장이 구현보다 넓었다** — 이 저장소가 이름 붙여 둔
 * 결함 형태 그대로이고, 라운드 5 의 *"전수 감사"* 표가 이 축을 *"안전"* 으로 통과시켰다.
 * 그 감사는 **과매치 방향만** 봤다. 술어가 "전수" 라는 단어보다 좁았다.
 *
 * 실측(코퍼스 92 mdx · `/ai-review` `review/code/2026/09/13/16_56_29` requirement CRITICAL):
 *
 * | 형태 | 첫 판 | 지금 |
 * |---|---|---|
 * | `` `REAL_TOKEN` `` | 매치 | 매치 |
 * | `` `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE` `` | **미매치** | 매치 |
 * | `` `PARALLEL_ENGINE=v1` `` | **미매치** | 매치 |
 * | `` `details.code='UNKNOWN_PLACEHOLDER'` `` | **미매치** | 매치 |
 * | `` `MAKESHOP_UNRESOLVED_PATH_PARAM: operation …` `` | **미매치** | 매치 |
 *
 * 그 결과 **6종**이 이 가드의 검사를 한 번도 받지 못하고 있었다 — `ALLOW_HTTP_HOOKS` ·
 * `INVALID_FIELD` · `MAKESHOP_UNRESOLVED_PATH_PARAM` · `NODE_ENV` · `PARALLEL_ENGINE` ·
 * `UNKNOWN_PLACEHOLDER`. (리뷰어는 5종을 들었고 전수로 다시 세니 `NODE_ENV` 가 더 있었다.)
 *
 * **아래 «한계» 절이 자기 예시에서 틀렸던 것도 이 때문이다.** `MAKESHOP_UNRESOLVED_PATH_PARAM`
 * 이 통과한 이유를 *"이름이 소스에 실재해서(existence≠emission)"* 라고 적어 뒀는데, 실제
 * 이유는 **인용 자체가 탐지되지 않아서**였다. 틀린 근거는 다음 사람의 판단 기준을 바꾼다.
 */
const BACKTICK_SPAN = /`([^`\n]+)`/g;

/**
 * 백틱 스팬 **안쪽**을 다시 훑는 토큰 패턴.
 *
 * **워드 경계가 막는 것은 «접두사가 붙은 자리» 다.** 처음엔 *"`X_YMORE` 안의 `X_Y` 를
 * 따로 세지 않는다"* 고 적었는데 **틀렸다** — `UPPER_SNAKE` 가 greedy 라 경계가 없어도
 * `X_YMORE` 를 통째로 먹는다(뮤턴트가 그 fixture 에서 생존해 드러났다). 실제로 갈리는
 * 것은 `camelPREFIX_ONE` 처럼 **앞에 워드 문자가 붙은** 형태이고, 경계가 없으면 거기서
 * `PREFIX_ONE` 을 오려내 인용으로 센다 → 기준집합에 없으니 **거짓 RED**.
 *
 * 방향이 `collectSourceTokens` 의 `\b` 와 **반대**다 — 저쪽은 기준집합이라 경계가 없으면
 * 집합이 부풀어 거짓 PASS 였고, 이쪽은 인용집합이라 거짓 RED 다.
 */
const BACKTICK_INNER = new RegExp(`\\b(${UPPER_SNAKE})\\b`, "g");

// ## 발행 축의 정규식 셋 — **`lastIndex` 보일러플레이트를 늘리지 않는다**
//
// 이 파일은 `rx.lastIndex = 0` → `while ((m = rx.exec(t)))` 를 이미 **4곳**에 손으로
// 복제하고 있고, 그 복제는 트래커에 등재돼 있다(*"리셋 누락 시 두 번째 호출부터 조용히
// 누락"*). `--impl-prep`(`review/consistency/2026/09/13/18_40_54` plan_coherence INFO#3)이
// **이 축을 더하면 다섯 번째가 생긴다**고 예견했다.
//
// 그래서 아래 셋은 `String.prototype.matchAll` 로 쓴다 — `matchAll` 은 내부적으로 정규식을
// **복제**하므로 공유 `lastIndex` 를 건드리지 않는다. 등재된 리팩터를 앞당기지 않으면서
// 복제를 **4곳에 묶어 둔다**.
//
// | 정규식 | 무엇을 집나 | 경계 |
// |---|---|---|
// | `QUOTED_LITERAL` | `'X'` · `"X"` · `` `X` `` — 따옴표가 **토큰만** 감쌀 때 | 여는·닫는 따옴표가 같아야 한다 |
// | `MESSAGE_PREFIX` | `'X: …'` — 토큰 뒤에 `:` + 공백 | 여는 따옴표 직후여야 한다 |
// | `CATALOG_CODE` | spec 마크다운의 `` `X` `` | 백틱 양쪽 |

/** 따옴표가 **토큰만** 감싼 리터럴. 여는·닫는 따옴표가 같아야 한다(역참조). */
const QUOTED_LITERAL = new RegExp(`(['"\`])(${UPPER_SNAKE})\\1`, "g");

/** 메시지 접두 — 여는 따옴표 **직후**의 토큰 + `:` + 공백. */
const MESSAGE_PREFIX = new RegExp(`['"\`](${UPPER_SNAKE}):\\s`, "g");

/** spec 카탈로그의 백틱 인용. */
const CATALOG_CODE = new RegExp(`\`(${UPPER_SNAKE})\``, "g");

/**
 * 여러 텍스트에서 한 정규식의 캡처 그룹을 걷는 **공용 수집기**.
 *
 * `/ai-review`(`review/code/2026/09/13/19_23_22` maintainability WARNING#7)가 지적한
 * 근접 중복을 없앤다 — 세 수집기가 정규식과 그룹 번호만 다르고 구조가 같았다.
 * **`lastIndex` 중복을 피했다고 적은 주석 바로 옆에서 다른 형태의 중복을 만든 것**이라
 * 지적이 특히 정확했다.
 *
 * `matchAll` 은 내부적으로 정규식을 복제하므로 공유 `lastIndex` 를 건드리지 않는다.
 * 위쪽 세 함수(`scanIdentifierCitations`·`collectSourceTokens`·`collectEnvDeclarations`)의
 * 수동 `lastIndex` 관용구는 **그대로 둔다** — 그 리팩터는 트래커에 별건으로 등재돼 있고,
 * 여기서 앞당기면 이 배치의 diff 가 두 가지 일을 하게 된다.
 */
function collectMatches(
  texts: readonly string[],
  rx: RegExp,
  group: number,
): Set<string> {
  const tokens = new Set<string>();
  for (const text of texts) {
    for (const m of text.matchAll(rx)) tokens.add(m[group]);
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
 * **제약이 정확히 반대라 두 목록은 합칠 수 없다** — 한 항목이 *"기준집합에 없고 동시에
 * 있을"* 수는 없다. 합치면 예외 하나가 두 축의 결함을 동시에 덮는다.
 *
 * `#1330` 은 *"허용목록 없음"* 을 설계 원칙으로 세웠다. 이것이 그 원칙의 **두 번째 부분
 * 번복**이다(첫 번째는 `GUIDE_EXTERNAL_VOCABULARY`). 두 번 다 이유가 같다 — 문맥 술어에
 * 숨기는 대신 **명시적으로 적고 사유를 강제**한다. 숨기면 다음 사람이 그 술어를 넓히거나
 * 좁힐 때 무엇이 걸려 있는지 모른다.
 *
 * **등록이 이 축의 값이다.** 새로 «메시지 접두로만 등장하고 카탈로그에도 없는» 토큰이
 * 가이드에 등장하면 사유를 적기 전까지 RED 다. 사유를 적는 행위가 *"그럼 이 문장은
 * 정확한가?"* 를 묻게 만든다 — 실제로 이 배치에서 `CONTAINER_*` 두 문장이 그 질문에 걸려
 * 정정됐다.
 */
export const GUIDE_NON_EMITTED_VOCABULARY: readonly {
  token: string;
  /** 접두를 붙이는 자리. 사유가 "어디서" 를 지목하지 못하면 등록이 통행증이 된다. */
  where: string;
  why: string;
}[] = [
  {
    token: "MAKESHOP_UNRESOLVED_PATH_PARAM",
    where: "makeshop.handler.ts:436 — 일반 `Error` 메시지 접두",
    why: "catch 가 `err instanceof IntegrationError ? err.code : 'INTEGRATION_CALL_FAILED'` 라 `output.error.code` 에는 공용 fallback 이 들어간다. 가이드는 이미 '전용 코드가 없어요 … 코드가 아니라 메시지를 봐야 해요' 라고 정확히 적고 있어 문장 수정이 아니라 등록이 맞다.",
  },
  {
    token: "CONTAINER_MISSING_EMIT",
    where: "execution-engine.service.ts:7121·7125 — 템플릿 리터럴 메시지 접두",
    why: "구조화된 `error.code` 로 나가지 않는다. 가이드가 '…로 실행 실패해요' 라고 적어 코드처럼 읽혔고 이 배치에서 '메시지 앞에 붙어요' 로 정정했다. 전용 코드 발행은 동작 변경이라 별 배치(트래커 등재분).",
  },
  {
    token: "CONTAINER_MULTIPLE_EMIT",
    where: "execution-engine.service.ts:7130 — 형제 접두",
    why: "위와 동형. 두 이름은 같은 문장에 함께 등장하므로 처분도 함께 한다.",
  },
];

/**
 * 소스에서 **«정확히 토큰만» 담은 따옴표 리터럴**로 등장하는 토큰 전수.
 *
 * `'X'` · `"X"` · `` `X` `` 세 형태를 받는다. 메시지 접두(`'X: …'`)는 따옴표 안에 토큰
 * 외의 글자가 있으므로 **여기 안 걸린다** — 그 갈림이 이 함수의 존재 이유다.
 *
 * **이 집합을 «발행» 의 증거로 쓰지 않는다.** `3-error-handling.md §1.4` 가 명시하듯
 * *"`execution-failure-classifier.ts` 의 목록에 같은 이름이 나오지만 그것은 소비자·분류기
 * 쪽 어휘이지 엔진 발행 경로의 앵커가 아니다"* — 실제로 `MAX_ITERATIONS_EXCEEDED` 는
 * 메시지 접두로만 발행되는데 그 분류기가 인용해서 여기 들어온다.
 *
 * 그래서 호출부는 이것을 **통과 조건이 아니라 «접두 전용» 을 부정하는 데만** 쓴다.
 */
export function collectQuotedLiterals(
  fileTexts: readonly string[],
): Set<string> {
  // 그룹 1 은 여는 따옴표(역참조용), **토큰은 그룹 2** 다.
  return collectMatches(fileTexts, QUOTED_LITERAL, 2);
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
  return collectMatches(fileTexts, MESSAGE_PREFIX, 1);
}

/**
 * spec 에러 코드 **카탈로그**가 백틱으로 등재한 코드 전수.
 *
 * **카탈로그는 «요구 조건» 이 아니라 «탈출구» 다.** 요구 조건으로 쓰면 오늘 거짓 RED 가
 * 25건 난다 — 인용된 에러 코드 78종 중 28종이 미등재이고 그중 25종이 **진짜 발행되는**
 * 통합 코드다(`CAFE24_*`·`MAKESHOP_*`·`INTEGRATION_*`). 그 미등재는 planner 트래커에
 * 등재된 별건이고, 가드가 **남의 미완결을 신고하게** 두지 않는다.
 *
 * 탈출구로 쓰면 그 25종은 애초에 접두 전용이 아니라 술어에 안 걸리므로 무해하다.
 *
 * ## **이 탈출구는 오늘 한 번도 발화하지 않는다** (라운드 1 에 반증됨)
 *
 * 처음엔 *"`MAX_ITERATIONS_EXCEEDED` 처럼 접두로만 발행되지만 spec 이 정식 코드로 인정한
 * 것이 이 탈출구로 통과한다"* 고 적었다. **틀렸다.** 단계별로 재보니:
 *
 * | 단계 | `MAX_ITERATIONS_EXCEEDED` |
 * |---|---|
 * | 메시지 접두인가 | 예 (`loop-executor.ts:64·85`) |
 * | 토큰-단독 리터럴이 있나 | **예** — `execution-failure-classifier.ts:76` 의 **소비자 Set** |
 * | ⇒ `isMessagePrefixOnly` | **false — 여기서 탈락, 카탈로그에 도달하지 않는다** |
 *
 * 즉 그 토큰은 **이 축이 스스로 «함정» 이라 부른 소비자-인용 경로** 때문에 통과한다
 * (`/ai-review` `review/code/2026/09/13/19_23_22` requirement WARNING#3 · 직접 재현).
 *
 * 전수로도 셌다 — 인용된 «접두 전용» 3종 중 카탈로그 등재 **0종**, 인용과 무관하게
 * 소스 전체의 접두 전용 11종 중에도 **0종**. **탈출구 교집합은 공집합이다.**
 *
 * ## 그래도 남기는 이유 — 트래커 항목이 이것을 발화시킨다
 *
 * `spec-draft-nullable-notation-followups.md` 의 planner 항목이 *"`CONTAINER_*` 를
 * §1.4 에 backfill"* 을 처분안으로 담고 있고, **그 처분이 집행되는 순간 이 탈출구가
 * 발화해 아래 등록 2종이 자동으로 불필요해진다.** 지금 지우면 그 처분안의 서술이
 * 거짓이 된다.
 *
 * 같은 형태의 선례가 이 파일에 이미 있다 — `collectEnvDeclarations` 도 *"오늘 판정을
 * 지탱하지 않지만 내일의 오탐을 막는다"* 로 남아 있다. **차이는 그 사실을 적었느냐다.**
 * 테스트가 «0회 발화» 를 단언으로 고정하므로, 언젠가 1이 되면 그 단언이 알려준다.
 */
export function collectCatalogCodes(specTexts: readonly string[]): Set<string> {
  return collectMatches(specTexts, CATALOG_CODE, 1);
}

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

    // 백틱 축만 2단이다 — 스팬을 먼저 끊고 그 «안» 을 다시 훑는다. 1단으로 하면
    // 백틱과 토큰이 붙은 경우만 잡혀 `` `413 CODE` `` 류가 통째로 빠진다(라운드 7 CRITICAL).
    BACKTICK_SPAN.lastIndex = 0;
    let span: RegExpExecArray | null;
    while ((span = BACKTICK_SPAN.exec(line)) !== null) {
      BACKTICK_INNER.lastIndex = 0;
      let inner: RegExpExecArray | null;
      while ((inner = BACKTICK_INNER.exec(span[1])) !== null) {
        out.push({ axis: "backtick", token: inner[1], line: idx + 1 });
      }
    }
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
 *
 * **compose 는 매핑 스타일(`KEY: value`)만 읽는다 — 리스트 스타일(`- KEY=value`)은 못 읽는다.**
 * `/ai-review`(`review/code/2026/09/13/16_28_47` requirement·testing INFO#2)가 지적했고
 * 전제를 직접 셌다: 저장소의 compose 두 파일에 **리스트 스타일 0건**, 매핑 스타일 66건
 * (`docker-compose.yml` 24 · `docker-compose.e2e.yml` 42). 그래서 오늘 판정에는 영향이 없다.
 *
 * 확장하지 않고 **현행 미지원을 대조군으로 고정**하는 쪽을 택했다. 이 갭의 방향이
 * fail-closed 이기 때문이다 — 리스트 스타일이 생기면 그 변수가 기준집합에서 **빠져** 가이드
 * 인용이 RED 가 난다(거짓 경보이지 거짓 PASS 가 아니다). 반대로 정규식을 넓히면 기준집합이
 * 부풀어 **거짓 PASS 방향**으로 간다 — 이 파일 상단이 `collectSourceTokens` 에 대해 적은
 * 것과 같은 이유다. 게다가 위쪽 vacuity floor 가 `POSTGRES_PASSWORD`(compose 주입 전용)를
 * 단언하므로, 누가 compose 를 리스트 스타일로 바꾸면 **그 floor 가 먼저 RED** 로 알린다.
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
