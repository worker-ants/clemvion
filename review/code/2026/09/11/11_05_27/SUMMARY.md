# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없다. 코드 자체(15자리 `details[].code` 배선, `botToken` `@MinLength(1)`, 메시지 상수화)는 계약(§5.3)과 정확히 일치하고 뮤테이션 테스트로 촘촘히 뒷받침돼 있으나, 이 PR 이 착지하면서 **spec 이 스스로 예고했던 "배선 전" 서술 3곳이 stale 해지는데도 이번 diff 가 그 spec 파일을 갱신하지 않았다**(requirement·documentation 두 reviewer 가 독립적으로 지적, SPEC-DRIFT). 여기에 코드 리터럴 중복(architecture)·테스트 fixture 완전 중복(maintainability)·CHANGELOG 누락(documentation) 등 WARNING 4건이 겹쳐 MEDIUM 으로 판정한다. **forced(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/5-system/15-chat-channel.md` §5.4.1(375행)·§5.4.1.1(426행)·§5.4.1.2(411-416행)가 "`details[].code` 는 **현재** 서비스 가드 갈래라 싣지 않는다 … 배선은 뒤따르는 developer PR 이 한다"고 서술하는데, 바로 이 PR(`triggers.service.ts` 13곳)이 그 배선을 포함해 머지된다. 코드는 spec 이 선언한 계약값(`INVALID_FIELD`)을 정확히 구현했으므로 코드는 옳다 — spec 문단의 시제가 stale 해질 뿐이다. | `spec/5-system/15-chat-channel.md:375,411-416,426` | planner 턴으로 세 문단을 "배선 전 관측값 → 2026-09-11 배선 완료, 두 갈래 모두 `code: 'INVALID_FIELD'`" 로 갱신. developer 는 `spec/` 을 자유롭게 못 고친다(이 문구는 developer 자신이 쓴 게 아니므로 자기-반증형 소정정 조건 1 불성립) — 이번 PR 의 plan/커밋 본문에 "spec 갱신 필요" 한 줄을 남겨 후속 세션이 놓치지 않게 할 것 |
| 2 | 문서화 | 이번 PR 의 두 동작 변경(응답 payload 신규 `code` 키 15곳, `botToken` 빈 문자열 거부)이 저장소 관례상 유지돼 온 `CHANGELOG.md` 에 기록되지 않음 | `CHANGELOG.md` (이번 diff 미포함) | `## Unreleased` 에 "botToken 빈 문자열이 시크릿을 먼저 지우던 결함 수정 + details.code 배선" 항목 추가 검토. 명문화된 강제 규칙은 없어 차단 사유는 아님 |
| 3 | 아키텍처 | `details[].code` 값 `'INVALID_FIELD'` 를 15곳(문자열 리터럴)에 중복 배선하면서, 저장소에 이미 존재하는 canonical `ErrorCode.INVALID_FIELD`(`error-codes.ts:116`, 다수 `modules/*`가 실제 참조 중) 를 재사용하지 않음 — 같은 PR 이 메시지 문자열은 상수화(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`)하면서 code 값에는 동일 원칙을 적용하지 않은 비일관 | `codebase/backend/src/modules/triggers/triggers.service.ts:509,655,662,669,700,707,730,741,794,809,821,830,995`, `codebase/backend/src/common/utils/password.util.ts:66,87` | `ErrorCode.INVALID_FIELD` import 로 리터럴 치환. `password.util.ts` 등 계층상 `nodes/core` 참조가 부적절하면 canonical 값을 `common/` 으로 승격 |
| 4 | 아키텍처 | 신규 상수 파일 헤더 주석이 "`chat-channel-rejection-messages.spec.ts` 가 등가성을 단언한다"고 서술하지만, 그런 파일은 diff 에도 저장소 어디에도 없음(grep 0건) — 실제 단언은 `trigger-dto-validation.spec.ts`/`triggers.service.spec.ts` 의 `[등가성]` 테스트에 분산 | `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` 파일 헤더 주석 | 주석을 실제 두 스펙 파일의 `[등가성]` 테스트 위치로 정정 |
| 5 | 유지보수성 | `it.each` fixture 5-tuple 배열(필드명·payload·provider)이 두 테스트 블록에 바이트 그대로 복제됨 — 6번째 차단 필드 추가 시 한쪽만 갱신돼도 컴파일·기존 케이스 통과라 drift 가 조용히 발생 가능 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3100`(`[A]`), `:3142`(`[등가성]`) | `describe` 상단에 `const BLOCKED_FIELD_CASES = [...] as const` 로 한 번만 선언해 두 `it.each` 가 공유하도록 통합 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `SecretResolverService.rotate()` 자체는 여전히 빈 값을 가드하지 않음 — 이번 PR 이 닫은 것은 `ChatChannelConfigDto.botToken`(DTO 계층)뿐. 컨트롤러의 별도 방어(`rotateBotToken`)로 현재 실질 악용 경로는 없으나, 새 호출부가 생기면 재발 가능 | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` `rotate`(~129-145행, 이번 diff 밖) | plan §C 에 이미 별개 항목으로 명시됨 — 후속 PR 에서 `rotate`/`store` 자체에 빈 값 가드 내재화 권장 |
| 2 | 테스트 | PATCH 경로(`chatChannel` 거부)의 `details.code` wire-level(e2e) 증거가 없음 — POST 생성 경로 5곳만 e2e 커버, PATCH 는 unit(`triggers.service.spec.ts`)에만 의존 | `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`(POST 전용) | 최소 1개 PATCH e2e 케이스에 `error.details` `toEqual` 고정 권장. 이번 PR 범위(A/B/C/D) 밖이라 후속으로 미뤄도 무방 |
| 3 | 테스트 | `[등가성]` 파이프 테스트가 `details` 배열 길이를 단언하지 않아 "정확히 이 필드 하나만 거부됐다"는 전제가 암묵적 | `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:915-925` | `expect(res?.details).toHaveLength(1)` 추가로 전제 명시화 |
| 4 | 테스트 | `botToken` `@MinLength(1)` 은 공백 전용 문자열(`'   '`)은 막지 못함 — plan 이 스코프 아웃했으나 테스트에 그 경계가 문서화돼 있지 않아 "빈 문자열 문제 전부 닫힘"으로 오독 가능 | `chat-channel-config.dto.ts:192`, `trigger-dto-validation.spec.ts` `[C]` | `[C]` 테스트 JSDoc 에 "공백 전용은 미결정" 한 줄 추가 |
| 5 | 문서화 | `chat-channel-config.dto.ts` 공개 Swagger JSDoc(`botTokenRef` 등)과 `password.util.ts` 독스트링이 이번에 신설된 `details[].code` 필드를 언급하지 않음 | `chat-channel-config.dto.ts:196-203`, `password.util.ts:53-56` | 여유 있을 때 "두 갈래 모두 `details[].code='INVALID_FIELD'` 를 싣는다" 문구 추가 |
| 6 | API 계약 | `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 로 모은 5개 메시지가 문체 혼재(격식체 vs 해요체) — 이번 PR 이 만든 결함 아니고 상수로 모으며 더 눈에 띄게 됐을 뿐 | `chat-channel-rejection-messages.const.ts:23-34` | 범위 밖. 필요 시 "메시지 문체 통일" 후속 트래커 등재 |
| 7 | 아키텍처 | `CHAT_CHANNEL_BLOCKED_FIELDS` 배열과 `..._MESSAGES` 객체의 동기화가 편도(원소→key 유효성)만 컴파일러가 검사 — 메시지 객체에 필드가 추가돼도 배열 누락은 컴파일 에러 없음 | `chat-channel-rejection-messages.const.ts:22-45` | 필드 배열을 1차 SoT 로 삼고 메시지 객체를 `Record<(typeof FIELDS)[number], string>` 로 선언해 양방향 동기화 강제 |
| 8 | 아키텍처 | `TriggersService`(1852줄)로 chatChannel 검증 책임이 계속 누적 — plan 이 모듈 경계 추출(E)을 후속 PR 로 이미 명시적으로 분리 | `codebase/backend/src/modules/triggers/triggers.service.ts` 전체 | 후속 PR 착지 여부 추적 필요(plan 체크리스트 미체크 상태) |
| 9 | 유지보수성 | e2e 5곳에 동일한 4줄 배경 설명 주석이 문자 그대로 복제됨 | `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts:187-190,243-246,268-271,344-347,367-370` | `describe` 블록 상단에 한 번만 배경 설명, 각 `it()` 은 짧은 앵커만 |
| 10 | 부작용 | 에러 응답 payload 에 `code` 키 15자리 additive 추가 — frontend 쪽 정확-일치(deep-equal) 소비는 grep 결과 0건이라 내부적으로 영향 없음, 외부 소비자가 있다면 릴리스 노트 권장(WARNING #2 와 동일 맥락) | `triggers.service.ts`(13곳), `password.util.ts`(2곳) | 외부 API 소비자 존재 시 변경 로그에 additive 명시 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `rotate()` 잔존 갭(pre-existing, tracked), 내부 라우트 노출은 위험 없음 |
| performance | NONE | 전부 O(1)/냉경로, 실질 우려 없음 |
| architecture | LOW | code 리터럴 15곳 canonical 상수 미재사용, 헤더 주석 오류 스펙 인용, 편도 동기화, TriggersService 누적 |
| requirement | LOW | `[SPEC-DRIFT]` §5.4.1.2 시제 stale, 그 외 기능/엣지/에러 시나리오 전부 정합 |
| scope | NONE | 4개 항목(A/B/C/D) 전부 계획대로, 숨은 변경·범위 이탈 없음 |
| side_effect | LOW | payload additive 확장, botToken 검증 강화 — 둘 다 의도되고 테스트로 뒷받침됨 |
| maintainability | LOW | it.each fixture 완전 중복(WARNING), e2e 주석 중복, code 리터럴 반복 |
| testing | LOW | PATCH e2e 증거 부재, fixture 중복, 등가성 length 미단언 — 전부 INFO |
| documentation | MEDIUM | spec 3곳 stale(SPEC-DRIFT와 동일 근거), CHANGELOG 미기록 |
| api_contract | LOW | botToken 검증 강화·code additive 배선 모두 계약 준수 방향, 메시지 문체 혼재만 pre-existing |

## 발견 없는 에이전트

없음 — 전 10개 reviewer 가 최소 INFO 이상을 보고했다(대부분 "문제 없음" 확인성 INFO 포함).

## 권장 조치사항

1. **(WARNING #1, 최우선)** `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1/§5.4.1.2 의 "배선 전 관측값" 서술 3곳을 planner 턴으로 "2026-09-11 배선 완료" 로 정정한다 — 코드를 되돌릴 사안이 아니라 spec 갱신이 필요한 SPEC-DRIFT.
2. **(WARNING #3)** `details[].code: 'INVALID_FIELD'` 15곳을 canonical `ErrorCode.INVALID_FIELD` import 참조로 치환해 오탈자 방지.
3. **(WARNING #5)** `triggers.service.spec.ts` 의 `it.each` fixture 중복을 공유 상수로 통합.
4. **(WARNING #4)** 신규 상수 파일 헤더 주석의 잘못된 스펙 파일 인용을 실제 위치로 정정.
5. **(WARNING #2)** `CHANGELOG.md` 에 이번 두 동작 변경(payload `code` 추가, `botToken` 빈 문자열 거부) 기록 검토.
6. 나머지 INFO 항목(PATCH e2e 증거, 공백 전용 botToken 미커버 문서화, JSDoc 갱신 등)은 이번 PR 을 막을 사유가 아니며 후속 개선으로 축적.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보 확인됨, 강제 화이트리스트 미이행 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 diff 와 무관 (신규 의존성/버전 변경 없음) |
  | database | router 판단상 이번 diff 와 무관 (스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 diff 와 무관 (동시성 로직 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 무관 (사용자 가이드 문서 대상 변경 없음) |
