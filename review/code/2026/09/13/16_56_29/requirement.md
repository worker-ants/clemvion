# 요구사항(Requirement) 코드 리뷰

## 발견사항

- **[CRITICAL]** `backtick` 축이 "모든 백틱 UPPER_SNAKE" 를 잡는다는 설계 주장과 달리, **백틱 스팬 전체가 정확히 그 식별자 하나뿐일 때만** 잡는다 — 같은 스팬 안에 다른 문자(HTTP 상태코드 접두, `=값`, 콜론+설명문, `code='X'` 형태)가 섞이면 **전혀 시트레이션으로 잡히지 않는다**. 실제 코퍼스로 재현 확인함(node 로 정규식 직접 실행):
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `BACKTICK` 정규식 정의부(`` const BACKTICK = new RegExp(`\`(${UPPER_SNAKE})\``, "g"); ``, JSDoc 주석 "축 3 — **모든** 백틱 UPPER_SNAKE. 문맥으로 게이팅하지 않는다.") 및 상단 "정규식 경계 — 전수 감사" 표의 `BACKTICK` 행("안전. 구분자가 명시적이라 부분 매치 불가").
  - 상세: `` `(${UPPER_SNAKE})` `` 는 백틱 두 개 사이에 **오직 UPPER_SNAKE 문자열만** 있을 때만 매치된다. 실제 가이드 코퍼스에는 식별자가 백틱 스팬 안에서 다른 텍스트와 섞여 인용되는 패턴이 광범위하게 존재하고, 이들은 **전부 미탐지**임을 직접 실행으로 확인했다:
    - `` `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE` ``, `` `413 PAYLOAD_TOO_LARGE` `` (`codebase/frontend/src/content/docs/02-nodes/triggers.mdx:97`)
    - `` `ALLOW_HTTP_HOOKS=1` `` (`triggers.mdx:237`), `` `PARALLEL_ENGINE=v1` `` (`codebase/frontend/src/content/docs/02-nodes/logic.mdx:345`, `logic.en.mdx:334`)
    - `` `400 VALIDATION_ERROR` ``, `` `409 STATE_MISMATCH` `` (`triggers.mdx:283,291` 및 `.en.mdx` 대응)
    - `` `details.code='UNKNOWN_PLACEHOLDER'` `` (`discord.mdx:175`·`discord.en.mdx:165`·`telegram.mdx:155`·`telegram.en.mdx:142`·`slack.mdx:175`·`slack.en.mdx:175`)
    - `` `details.field='chatChannel'`, `details.code='INVALID_FIELD'` `` (`triggers.mdx:429`, `triggers.en.mdx:418`)
    - `` `MAKESHOP_UNRESOLVED_PATH_PARAM: operation '...' has unresolved path placeholder(s): ...` `` (`codebase/frontend/src/content/docs/02-nodes/integrations.mdx:306`, `integrations.en.mdx:295`) — **이 토큰은 스캐너 자신의 JSDoc 이 "이 가드가 못 보는 것"의 대표 사례로 직접 인용하는 바로 그 토큰**이다. JSDoc 은 이 토큰이 통과하는 이유를 *"실재하지만 방출되지 않는다"* (existence≠emission) 로 설명하지만, 실측하면 **그 설명 자체가 틀렸다** — 이 문장은 애초에 `scanIdentifierCitations` 의 citation 목록에 **들어가지도 않는다**(백틱 스팬에 콜론과 설명문이 같이 있어서). basis 대조는 citation 이 있어야 실행되므로, "잡았는데 통과시킨다" 가 아니라 "애초에 검사 대상이 아니다" 가 실제 동작이다.
    - `UNKNOWN_PLACEHOLDER`·`MAKESHOP_UNRESOLVED_PATH_PARAM`·`PARALLEL_ENGINE`·`ALLOW_HTTP_HOOKS`·`INVALID_FIELD` 5개 토큰은 **코퍼스 전체를 grep 해도 순수-백틱(`` `TOKEN` `` 단독) 형태로 인용된 곳이 단 한 곳도 없다**(직접 확인: `grep -rn "\`TOKEN\`" content/docs/` 전부 0건) — 즉 이 5개는 이 가드의 베이스라인-0 검사 대상에서 **완전히 빠져 있다**. (참고로 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`·`PAYLOAD_TOO_LARGE`·`VALIDATION_ERROR`·`STATE_MISMATCH` 는 같은 파일의 **다른 줄**에 순수-백틱 인용이 중복으로 존재해 실질적으로는 검사되고 있다 — 이 4개는 우연히 안전하다.)
    - 오늘 이 5개 토큰 자체가 틀린 것은 아니라서(모두 backend 소스에 실재하는 것으로 보인다) **지금 당장 거짓 PASS 는 아니다.** 그러나 이 가드가 존재하는 이유(라운드 1의 트래커 근거, `#1328`)가 정확히 "가이드가 식별자를 잘못 옮겨 적어도 아무도 눈치 못 채는 문제" 이고, 위 5개 형태(HTTP 상태코드 접두·`=값`·`code='X'` 인용)는 가이드 전반에서 **반복적으로 쓰이는 정형 패턴**이다. 그 패턴 안에서 오타가 나면 이 가드는 원리적으로 못 잡는다 — 라운드 5 "정규식 5개 전수 감사" 표가 이 축을 "안전" 으로 판정한 근거("구분자가 명시적이라 부분 매치 불가")는 **다른 종류의 위험(부분 문자열 오탐)에 대한 답**이지 이 위험(스팬-전체-일치 요구로 인한 미탐지)에 대한 답이 아니다 — 축 이름("백틱 전수")과 실제 커버리지가 어긋난다.
  - 제안: `BACKTICK` 매칭을 스팬 전체 일치가 아니라 **스팬 내부 어디든** UPPER_SNAKE 부분 문자열을 찾도록 바꾼다(예: 백틱 쌍으로 먼저 분리한 뒤 각 스팬 내부에서 `\b(${UPPER_SNAKE})\b` 로 재검색, 또는 `` /`[^`]*?(${UPPER_SNAKE})[^`]*?`/g `` 류 — 단 겹치는 토큰 처리에 주의). 위에서 실측한 5개 실패 패턴(`413 X`, `X=1`, `code='X'`, `X: 설명문`)을 판별 fixture 로 회귀 테스트에 추가하고, `MAKESHOP_UNRESOLVED_PATH_PARAM` JSDoc 의 "existence≠emission" 서술도 "citation 자체가 미탐지" 라는 더 정확한 사유로 정정할 것.

- **[WARNING]** `field-table` 축(`FIELD_TABLE_NAME`)이 "줄 단위" 한계는 스스로 문서화했지만, **같은 줄이라도 `name` 이 객체 리터럴의 첫 키가 아니면 놓치는** 인접 한계는 문서화도 대조군도 없다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `const FIELD_TABLE_NAME = new RegExp(\`\\{\\s*name:\\s*"(${UPPER_SNAKE})"\`, "g");` 선언부 및 그 위 JSDoc("판정은 줄 단위다").
  - 상세: 정규식이 `\{\s*name:` 로 `{` 바로 뒤(공백만 허용)에 `name:` 이 와야 매치되므로, `{ type: "x", name: "CODE" }` 처럼 `name` 이 첫 키가 아니면 같은 줄이어도 미탐지된다. 오늘 코퍼스는 실측상 전부 `name` 이 첫 키라 현재는 안전하지만(`grep` 으로 반례 0건 확인), 이는 "줄 단위 한계" 와는 다른 축의 가정이고 JSDoc 에 명시돼 있지 않다. 백틱 축과 달리 이 값은 보통 따옴표만 두르지 백틱은 안 두르므로 폴백 탐지 경로도 없다.
  - 제안: JSDoc 에 "`name` 이 그 줄의 `{` 바로 뒤 첫 키여야 한다"는 가정을 명시하거나, `\{[^}]*?\bname:\s*"(${UPPER_SNAKE})"` 류로 완화해 키 순서 의존을 없앤다.

- **[WARNING][SPEC-DRIFT]** `spec/conventions/user-guide-evidence.md §2` "Build-time 가드 (3건)" 표가 `guide-identifier-existence.test.ts`(및 `guide-sanitized-message-parity.test.ts`)를 여전히 미등재 — CHANGELOG.md/PROJECT.md 는 이 가드를 `user-guide-evidence.md` "가드 가족" 소속으로 명시하는데 SoT 표는 3건("impl-anchor-existence.test.ts", "integrations-coverage.test.ts", "triggers-coverage.test.ts")만 나열한다(§2 표, §2.1 관계표도 동일). **이미 다른 라운드/세션에서 여러 차례 독립 확인·등재된 선재 갭**이다(`plan/in-progress/spec-draft-nullable-notation-followups.md:3247-3274`, 리네임 반영 포함 — plan 문서 자체가 "통산 8회 확인" 이라 적고 있음). 코드가 틀린 게 아니라 spec 갱신이 밀려 있는 상태(SPEC-DRIFT)이고, `developer` 권한 밖(`spec/` 직접 수정 불가)이라 이번 세션에서도 정정 대상이 아니다. 새로 발견한 것이 아니라 **line-level 대조 결과 여전히 미해소임을 재확인**한 것.
  - 위치: `spec/conventions/user-guide-evidence.md:68-76` (§2 표) 및 `plan/in-progress/spec-draft-nullable-notation-followups.md:3247`
  - 제안: 코드 변경 불필요. planner 턴에서 §2 표·§2.1 관계표·frontmatter `code:` 목록·Rationale 을 한 번에 갱신(이미 백로그 항목에 그렇게 적혀 있음).

## 요약

`guide-identifier-existence` 가드는 6라운드에 걸친 뮤테이션 기반 정밀 검증(경계 감사, 대조군, 판별 fixture)을 거쳤고 실제로 `vitest run`(34/34, 스위트 전체 3331/3331)과 독립 재현으로 대부분의 주장(베이스라인 0, `MCP_ALLOW_INSECURE_URL` 과거 결함 포착, env 병합 동작, compose 매핑-only 한계 등)이 실측과 일치함을 확인했다. 다만 이번 리뷰에서 새로 실측한 결과, 핵심 신설 축인 `backtick`("문맥 게이팅 없이 모든 백틱 UPPER_SNAKE 를 잡는다")이 실제로는 **백틱 스팬 전체가 토큰 단독일 때만** 매치되어, `413 CODE`·`CODE=value`·`code='CODE'` 같은 실제 코퍼스에 반복 등장하는 흔한 인용 형태를 통째로 놓친다 — 5개 토큰(`UNKNOWN_PLACEHOLDER` 등)은 코퍼스 전체에서 대체 순수-인용도 없어 이 가드의 검사 대상에서 완전히 빠져 있다. 이는 라운드 5 "정규식 5개 전수 감사"가 "안전" 으로 판정한 것과 배치되고, 가드 자신이 예시로 드는 과거 결함(`MAKESHOP_UNRESOLVED_PATH_PARAM`)에 대한 설명(existence≠emission)도 실측과 다르다(실은 citation 미탐지). 나머지 항목(`field-table` 축의 키-순서 의존, `user-guide-evidence.md §2` 미등재)은 각각 저위험 엣지케이스와 이미 추적 중인 SPEC-DRIFT다.

## 위험도

HIGH
