# 정식 규약 준수 검토 — Chat Channel PATCH Token (impl-done, scope=spec/5-system)

## 범위와 방법

- 이 브랜치의 `spec/5-system` 델타는 0개 파일이다 — 순수 코드 PR. 검토는 diff 7개 파일
  (`chat-channel-config.dto.ts` · `trigger-dto-validation.spec.ts` · `update-trigger.dto.ts` ·
  `triggers.controller.ts` · `triggers.service.spec.ts` · `triggers.service.ts` ·
  `trigger-workflow-ref.e2e-spec.ts`) 을 대상으로, 프롬프트가 예산 절단한
  `spec/conventions/*.md` 파일들을 워킹트리 절대경로로 직접 열어 대조했다
  (`swagger.md` · `error-codes.md` · `audit-actions.md` · `secret-store.md` ·
  `chat-channel-adapter.md` · `spec-impl-evidence.md` · `review-citations.md` 전문 확인).
- 핵심 판정 하나는 추측이 아니라 실측으로 확인했다 — `ChatChannelUpdateConfigDto` 의
  class-level JSDoc 이 공개 OpenAPI 로 나가는지 여부를 `@nestjs/swagger` 플러그인
  소스(`plugin/visitors/model-class.visitor.js`)에서 직접 확인했다. `visitClassNode` 는
  `ts.forEachChild` 로 **프로퍼티만** 순회하고 클래스 자신의 leading comment 는 스키마
  `description` 으로 승격하지 않는다 — 즉 class JSDoc 은 `swagger.md §3` (JSDoc 공개 노출
  금지 내부 서사) 규약의 적용 대상이 **아니다**. 이 확인이 없었다면 "class JSDoc 에 구현
  경위(왜 OmitType 인지 등)를 적은 것"을 CRITICAL 로 오판했을 자리다.

## 발견사항

이번 diff 는 `spec/conventions/**` 의 명명·출력 포맷·API 문서·금지 항목 규약을 위반하는
지점을 찾지 못했다. 아래는 CRITICAL/WARNING 이 아니라 완결성 관점의 INFO 두 건이다.

- **[INFO]** 신규 spec drift 발견("9곳이 `SecretResolver.store()`라 적지만 실구현은
  `rotate()` 전용")이 전용 추적 파일이 아니라 이번 plan 문서에만 기록됨
  - target 위치: `plan/in-progress/impl-chat-channel-patch-token.md` §"이 턴에 실측해
    planner 로 넘길 것" 표 1행
  - 위반 규약: 직접 위반은 아니나 `CLAUDE.md` "정보 저장 위치 (단일 진실 원칙)" 및
    `spec/conventions/spec-impl-evidence.md` R-5 의 "spec ↔ plan 역방향 추적" 정신과
    결이 다르다. 같은 표의 2번째 행("`details.field` 는 flat 이 아니라 중첩 경로다")은
    이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` (§5.4.1/§5.4.1.1
    placeholder 항목)에 planner 후속으로 사전 등재돼 있었고 이번 PR 은 그 실측만
    수행했다 — 정상 경로. 그런데 1번째 행("`store()` vs `rotate()`" 9곳)은 **이번 PR
    에서 새로 발견**됐고, `spec-draft-nullable-notation-followups.md` 에 대응 항목이
    아직 없다 (grep 0건, 직접 확인).
  - 상세: `impl-chat-channel-patch-token.md` 는 developer 소유 in-progress plan이라
    작업 종료 시 `plan/complete/` 로 이동한다(`spec_impact: [none]` 선언 — 이 plan 자체는
    spec 을 건드리지 않으므로 정확한 선언이다). 그런데 이 plan 이 `complete/` 로 이동한
    뒤에는, 이 표에 적힌 "planner 후속" 신호가 `spec-draft-nullable-notation-followups.md`
    처럼 **살아있는(in-progress) 단일 추적 지점**에 없으므로 다음 planner 턴이 우연히
    이 완료된 plan 파일을 열어 보지 않는 한 놓칠 위험이 있다 (메모리
    `feedback_review_fix_stale_loop.md` — *"review/** 는 SoT 아님, 미룬 항목은 그
    턴에 plan/ 에 적어라"* 와 같은 클래스의 위험 — 여기서는 "적었다"가 "적었지만 중앙
    트래커가 아니다"로 한 단계 완화된 형태).
  - 제안: 이 plan 이 `complete/` 로 이동하기 전에, `spec-draft-nullable-notation-followups.md`
    에도 같은 발견(9곳 `store()`↔`rotate()` 표기 drift, 대상 라인 `15-chat-channel.md:200,201,373,390` 등)을
    한 줄 등재해 두 문서가 같은 planner 후속 항목을 가리키게 한다. (developer 가 `spec/`
    을 직접 고치라는 뜻이 아니라, 발견을 기존 중앙 트래커에 병합하라는 것 — 이 자체는
    `plan/**` 편집이라 developer 권한 안이다.)

- **[INFO]** `spec/5-system/15-chat-channel.md` frontmatter `code:` 가 이번 diff 로 새로
  생긴 보조 파일들을 아직 가리키지 않음
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` 목록
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의 — 강제
    사항은 아니다. `spec-code-paths.test.ts` 가드는 "글로브가 ≥1 파일에 매치"만 요구하고,
    `triggers.service.ts` · `chat-channel-config.dto.ts` · `triggers.controller.ts` 가
    이미 명시돼 있어 가드는 통과한다(직접 대조 확인).
  - 상세: 이번 diff 가 새로 건드린 `update-trigger.dto.ts`(DTO 배선의 핵심 연결점) ·
    `trigger-dto-validation.spec.ts` · `triggers.service.spec.ts` ·
    `trigger-workflow-ref.e2e-spec.ts` 는 `code:` 목록에 없다. R-1 Rationale 이 이미
    "글로브 stale/누락은 이 가드만으로 검출 불가 — `/spec-coverage` 가 보완"이라 인정한
    구조적 한계와 같은 종류라, 위반이라기보다 완결성 여지다.
  - 제안: 특히 `update-trigger.dto.ts` 는 `ChatChannelUpdateConfigDto` 를 실제로 배선하는
    자리라 `code:` 에 추가할 가치가 있다 (선택 사항, 차단 아님).

## 준수 확인 (근거 요약)

- **DTO 명명** — `ChatChannelUpdateConfigDto` 는 저장소 전역에 `Patch*Dto` 클래스 0건,
  `Update*Dto` 15건이라는 실측(`grep`)과 정확히 일치하는 선택이다. `OmitType` 사용은
  `swagger.md §5-1` "PickType/OmitType/PartialType 로 재사용 가능"과 합치한다.
- **writeOnly/보안 캐비엇** — `botToken`/`inboundSigningPlaintext` 필드에 `writeOnly: true`
  동반(§1-5 의무 사항 충족), 설명이 "왜 이 값을 보내면 400인가"를 담아 §3 의
  "요청 값이 정책으로 거부될 수 있는 필드는 길어도 반드시 적는다" 지시와 정확히
  일치한다(오히려 모범 사례에 가깝다 — 같은 파일이 swagger.md §3 Rationale 이 인용하는
  "최장 435자" 사례의 당사자 파일이다).
- **에러 코드** — 신규 검증 실패는 모두 `VALIDATION_ERROR` (prefix-less 전역 공용 코드,
  `error-codes.md §1` 의 명시적 예외 범주)만 사용해 신규 코드를 남발하지 않았다.
- **`details.field` 중첩 경로** — `CustomValidationPipe` 를 실제로 통과시켜 관찰한 값이
  `3-error-handling.md §2.1` (`nodes[3].type` 형 중첩/배열 경로 유지)과 일치함을 새 테스트로
  확정했고, 이 확정이 spec §5.4.1/§5.4.1.1 의 flat 표기(`botTokenRef`)가 낡았음을
  드러냈다 — 그러나 developer 는 spec 문구를 직접 고치지 않고(§자기-반증형 소정정 조건 1
  불충족 — 그 문장은 developer 가 쓴 게 아니라 planner PR #1311 이 썼다) `plan/`
  followups 로 정확히 위임했다(`impl-chat-channel-patch-token.md` 본문에 명시).
  거버넌스 경계 준수의 좋은 사례다.
- **Secret Store 사용 패턴** — chat-channel 경로의 비밀 저장은 실측 전수(`grep`)로
  `secrets.rotate(...)` 만 쓰고 `secrets.store(...)` 는 0건 — `secret-store.md §2.1`
  ("Trigger 생성(notification/chatChannel 포함) — `rotate()` 권장, UPSERT 멱등성")과
  일치한다.
- **audit-actions** — 이번 diff 는 신규 감사 액션을 추가하지 않았고, 기존
  `chat_channel_bot_token_rotated` 등 트리거 회전 액션 체계를 건드리지 않는다 — 명명
  규약 대상 변경 없음.
- **review-citations** — 새 JSDoc/주석에 `review/**` 세션 경로 인용이 필요한 자리
  (`trigger-workflow-ref.e2e-spec.ts`)는 전체 경로 형식(`review/code/2026/09/10/14_34_18`)
  으로 적혀 §2 (bare `hh_mm_ss` 금지) 를 지킨다. DTO JSDoc 에는애초에 review 경로 인용이
  없어 §3 문제도 없다.

## 요약

이 diff 는 R-CC-21(D-1/D-2)을 구현하며 DTO 명명(`Update` 축) · Swagger `writeOnly` +
보안 캐비엇 설명 · `VALIDATION_ERROR` 단일 코드 재사용 · `secrets.rotate()` 사용 패턴 ·
`review-citations` 인용 형식 등 `spec/conventions/**` 의 모든 점검 관점에서 명시적
위반을 찾지 못했다. 오히려 두 지점(spec 문구 정정 시도를 자기-반증 예외로 우회하지 않고
planner 로 위임한 것, class-level JSDoc 이 실제로 OpenAPI 에 노출되지 않음을 소스 레벨로
확인하고 그 여지를 정당하게 활용한 것)에서 규약의 취지를 정확히 읽고 지킨 흔적이 보인다.
유일한 개선 여지는 이번 PR 이 새로 발견한 spec-drift 항목 하나가 중앙 추적 파일이 아니라
이번 plan 문서에만 적혀 있어, 향후 plan 이동 시 누락될 잠재 위험이 있다는 완결성
차원의 INFO 다.

## 위험도

LOW
