# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 보안 수정(`stripExternalOnlyFields`/`stripDeep`, 깊이 무관 재귀 strip)은 실제로 존재했던 raw LLM 프롬프트/대화이력 외부 노출을 정확히 닫는 정당한 수정이나, 그 구현 자체가 `__proto__` bracket assignment 로 인한 prototype pollution(CWE-1321, 값 손실·크래시 가능)을 새로 도입했고, 형제 함수 대비 깊이 가드·캐시가 없으며, 같은 diff 안에서 새로 작성된 plan 문서가 이미 구현·테스트 완료된 결정을 "미착수"로 서술하는 자기모순이 다수 reviewer 에서 공통 지적됨. forced whitelist 7명 전원 결과 확보(누락 없음).

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `stripDeep` 의 object 분기가 `out[k] = s` bracket assignment 로 조립되어, payload 에 own-enumerable `"__proto__"` 키가 있으면(예: `JSON.parse` 결과) 필드로 복사되지 않고 반환 객체의 실제 `[[Prototype]]` 을 덮어씀(CWE-1321) — 값이 조용히 사라지거나(payload 손상) 값이 `null` 이면 `hasOwnProperty` 등 표준 메서드가 없는 null-prototype 객체가 되어 이후 emit 파이프라인에서 처리되지 않은 `TypeError` 크래시 가능. 재현 확인됨(직접 재현 코드로 검증). 형제 함수 `sanitizeInner` 는 `{...obj}` 로 스프레드 먼저 하는 덕에 우연히 이 결함이 없음 | `codebase/backend/src/modules/websocket/websocket.service.ts:363,371` (`stripDeep`), 대조 `sanitizeInner`(스프레드 우선 패턴) | `Object.create(null)` 로 `out` 생성하거나 `"__proto__"`/`"constructor"`/`"prototype"` 키 명시적 방어, 또는 `Object.defineProperty` 로 대체. `{"__proto__": {...}}` 를 포함한 payload 회귀 테스트 추가 |
| 2 | 성능/부작용 | `stripDeep` 이 hot path(`emitExecutionEvent`/`emitNodeEvent`, 실행당 모든 이벤트)에서 캐시 없이 payload 전체를 매번 완전 재귀 순회 — 이미 같은 payload 를 완전 순회하는 `sanitizePayloadForWs`(credential 마스킹) 와 동일 hot path 에서 중복 순회가 발생하고, 형제 함수가 갖는 `SANITIZE_CACHE`(WeakMap) 이득을 못 받음. AI 멀티턴 대화의 누적 `turnDebugHistory` 처럼 턴이 늘수록 커지는 구조에서 비용 누적 | `codebase/backend/src/modules/websocket/websocket.service.ts:339,349-374`(`stripDeep`), 호출부 `:524,:595` | 두 pass(`sanitizePayloadForWs`+`stripDeep`)를 단일 재귀로 병합하거나, `stripDeep` 전용 identity 캐시 추가. 최소한 트레이드오프를 JSDoc 에 명시 |
| 3 | 유지보수성 | `stripDeep` JSDoc 이 "common path 는 allocation 이 없다" 고 약속하지만, 실제로는 모든 중첩 레벨에서 무조건 임시 객체/배열을 만들고(`out = {}`, `value.map()`) 변경 없을 때만 버림 — 최상위 반환값 identity 는 보존되나 "allocates nothing" 주장 자체는 사실이 아님. 형제 함수 `sanitizeInner` 는 `result = null` 로 시작하는 진짜 지연 할당 패턴이라 대비됨(문서한 보장이 구현보다 넓은 패턴, 이 프로젝트 반복 지적 이력) | `codebase/backend/src/modules/websocket/websocket.service.ts:325-331`(JSDoc), `:349-374`(구현), 대조 `:265-291`(`sanitizeInner`) | JSDoc 문구를 실제 동작(top-level 만 allocation-free)에 맞게 낮추거나, `sanitizeInner` 처럼 지연 할당 패턴으로 구현 변경 |
| 4 | 보안 | `stripDeep` 에 형제 함수(`sanitizeInner`/`sanitizePayloadForWs`)가 갖는 `MAX_SANITIZE_DEPTH`(=10) 깊이 상한이 없음 — 현재는 `emitExecutionEvent`/`emitNodeEvent` 양쪽 모두 `sanitizePayloadForWs` 를 먼저 거친 결과에만 `stripDeep` 을 호출해 우연히 depth 가 이미 bounded 되어 안전하나, 이는 함수 자체의 방어가 아니라 **호출 순서**에만 암묵적으로 의존하는 불변식. 향후 sanitize 를 거치지 않은 경로에서 재사용되면 무제한 재귀 위험 | `codebase/backend/src/modules/websocket/websocket.service.ts:349`(`stripDeep`) vs `:226,251`(`MAX_SANITIZE_DEPTH`) | 동일 깊이 캡을 `stripDeep` 에도 적용하거나, JSDoc 에 "반드시 `sanitizePayloadForWs` 이후에만 호출" 전제를 명시 |
| 5 | 테스트 | "제거할 필드가 없으면 fanout payload 가 wire envelope 과 동일 객체다(할당 없음)" 라고 이름 붙인 테스트가 실제로는 최상위 envelope 이 아니라 자식 필드(`nodeOutput`) 하나의 참조 동일성만 단언 — 테스트명이 주장하는 것보다 약한 검증(최상위에서만 불필요한 재구성이 일어나는 회귀를 못 잡음) | `codebase/backend/src/modules/websocket/websocket.service.spec.ts:715,734` | `expect(fanout.payload).toBe(wire);` 를 추가해 envelope 자체의 참조 동일성을 직접 검증 |
| 6 | 테스트 | 신규 nested-strip 테스트(§4.4 turnDebug 이중 경로)가 외부 fanout payload 만 확인하고, 내부 WS wire envelope(에디터 채널)이 여전히 raw `llmCalls` 를 보존하는지는 검증하지 않음 — 같은 블록의 기존 top-level strip 테스트들은 모두 "fanout 은 strip / wire 는 원본 보존" 을 짝으로 검증하는데 이 테스트만 대조군이 빠져 비대칭 | `codebase/backend/src/modules/websocket/websocket.service.spec.ts:656-708` | `gateway.broadcastToChannel.mock.calls[0][2]`(wire envelope) 를 확보해 `SECRET PROMPT A/B` 문자열이 남아있는지 대조 단언 추가 |
| 7 | 요구사항 | 신규 회귀 테스트의 JSDoc 이 "strip 은 depth-1 shallow delete 다(그 함수 JSDoc 이 명시)" 라고 **현재형**으로 서술하는데, 같은 diff 가 바로 그 production JSDoc 을 "깊이 무관" 으로 이미 바꿔놓아 자기모순 — production 파일은 같은 사실을 "종전엔 top-level 전용이었고" 로 정확히 과거형 처리했으나 테스트 파일만 누락 | `codebase/backend/src/modules/websocket/websocket.service.spec.ts:636-639` | "고치기 전엔 depth-1 shallow delete 였다" 식으로 과거형 정정 — 방치 시 후속 개발자가 "strip 은 여전히 top-level 전용" 으로 오인해 새 필드를 top-level 에만 추가하는 재발 패턴 유발 가능 |
| 8 | Requirement/Scope/Documentation | 같은 diff 안에서 새로 작성된 plan 문서의 `### 다음 (별건)` 체크리스트가, 이미 구현·테스트로 완료된 항목("실증 테스트", "처방 후보 결정")을 전부 `[ ]` 미체크로 남겨두고, 자신이 스스로 "(a) 는 비용이 크고 (c) 는 이름 충돌 고착 → **(b) 가 유력**" 이라 결론낸 것과 달리 실제로는 **(a)** 안(`stripDeep` 재귀)이 채택·구현됐는데 그 반전이 문서에 기록되지 않음 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md:130-137`(`### 다음 (별건)`) | 체크박스 3항을 실제 상태(테스트 완료, (a) 채택)로 갱신하고, (b) 대신 (a) 를 택한 이유(clone-on-write 로 할당 비용 해소, 이름 기반 방어가 위치 나열보다 강건)를 문서에 반영 |
| 9 | 문서화 | 인증 없이도 접근 가능한 외부 SSE/webhook/chat-channel 로 raw LLM system prompt/대화이력이 새던 정보 노출 결함의 수정에 `CHANGELOG.md` 항목이 없음 — 이 저장소는 유사 등급(보안/정보노출) 수정을 `## Unreleased` 항목으로 기록해온 확립된 관행이 있음 | `CHANGELOG.md`(Unreleased 섹션에 항목 부재), 관련 코드 `websocket.service.ts:296-374` | `## Unreleased — waiting_for_input 의 중첩 turnDebug.llmCalls 외부 fanout 유출 수정` 형태 항목 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | 핵심 수정(`stripDeep`)의 "깊이 무관 strip" 은 spec 3곳(WS §4.4, EIA §6.5, chat-channel CCH-MP-01)과 line-level 로 일치 확인 — SPEC-DRIFT 아님, 코드가 spec 미달 상태였던 것을 정정. 테스트 32/32 통과 + 뮤테이션 검증(옛 shallow 구현 복원 시 정확히 1건 실패)으로 비-vacuous 확인 | `websocket.service.ts` 전반, `spec/5-system/6-websocket-protocol.md:519` 등 | 조치 불필요, 참고 |
| 2 | 부작용 | strip 판단 기준이 "위치(top-level)" 에서 "이름(어디서든 `llmCalls`)" 으로 바뀌어, 이번에 고치는 `waiting_for_input` 외 모든 이벤트 타입의 외부 fanout 계약이 전역적으로 넓어짐 — 문서화된 의도적 트레이드오프이나 향후 워크플로 사용자가 변수명을 `llmCalls` 로 짓는 노드 출력이 있으면 그 값도 조용히 사라질 수 있음(현재 grep 결과 collateral 없음 확인) | `websocket.service.ts:322,349` | 참고, `plan/in-progress/eia-terminal-payload.md` 의 `result.outputs` 외부 노출 작업 착수 시 재점검 권장 |
| 3 | 유지보수성 | `stripDeep`(strip)과 `sanitizeInner`(redact)가 "배열/객체 재귀 + 변경 여부 추적 + 무변경 시 원본 반환" 이라는 거의 동일한 트리 순회 스켈레톤을 별도로 두 벌 구현 | `websocket.service.ts:349-374` vs `:265-291` | 즉시 통합 불요, 한쪽 수정 시 다른 쪽도 같은 클래스 결함(깊이 미처리 등) 짝점검 관례 권장 |
| 4 | 유지보수성 | `EXTERNAL_STRIPPED_FIELDS` 가 배열이라 `.includes()` 로 O(n) 멤버십 검사 — 현재 원소 1개라 무해 | `websocket.service.ts:365` | 필드 2개 이상으로 늘어날 계획 있으면 `Set` 으로 전환, 우선순위 낮음 |
| 5 | 테스트 | 신규 테스트에서 `wire` 변수명이 같은 블록의 기존 관례("내부 WS envelope 객체")와 다른 의미(fanout payload 의 직렬화 문자열)로 재사용돼 혼동 유발 | `websocket.service.spec.ts:702` | `wireJson`/`serializedFanout` 등으로 개명 |
| 6 | 테스트 | `registerExecutionRouting`(routing context)과 nested strip 을 함께 검증하는 테스트가 없음 — 코드 리딩상 안전해 보이나 두 기능이 같은 emit 경로를 공유 | `websocket.service.spec.ts:341-565` vs `569-776`(두 describe 블록 미교차) | 필수 아님, 향후 `attachRoutingContext` 리팩터 시 조합 회귀 방지용 통합 테스트 1건 권장 |
| 7 | 문서화 | `stripDeep` JSDoc 의 순환 참조 처리 근거("순환이 있으면 여기서 죽든 거기서 죽든 마찬가지") 가 실패 모드 차이(스택 오버플로우 vs `JSON.stringify` 의 `TypeError`)를 생략해 다소 부정확 | `websocket.service.ts:346-347` | 표현만 다듬기 권고, 결론(가드 미도입) 변경 불필요 |
| 8 | 스코프 | 이번 diff(`websocket.service.ts`/`.spec.ts`)는 브랜치·정본 plan(`eia-terminal-payload.md`, `error`/`durationMs`/`result.outputs` 종결 payload 정리)과 무관한 별건 보안 수정 — `eia-terminal-payload.md` 는 `BLOCK: YES` 로 착수 차단 유지된 채 전혀 진전 없음(계획대로 보류, 스코프 이탈 아님) | `plan/in-progress/eia-terminal-payload.md:95-106` | 조치 불필요 — 위 WARNING #8 의 plan 동기화만 이뤄지면 해소 |
| 9 | 스코프 | `websocket.service.ts`/`.spec.ts` 자체 diff 는 JSDoc 재작성 + `stripExternalOnlyFields` + 신규 `stripDeep` + 테스트 2건 순수 추가로 좁게 스코프됨 — 무관한 리팩토링/포맷팅/임포트 변경 없음 | 파일 전체 | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | prototype pollution(WARNING #1), 깊이 가드 부재(WARNING #4). 핵심 leak-fix 자체는 정당 |
| performance | MEDIUM | hot path 중복 완전 순회 + 캐시 부재(WARNING #2) |
| requirement | LOW | spec 3곳 line-level 일치 확인(SPEC-DRIFT 아님), 테스트 JSDoc 자기모순(WARNING #7), plan 미동기화(WARNING #8) |
| scope | MEDIUM | 코드 diff 자체는 좁게 스코프됐으나 plan 문서와 구현 상태 불일치(WARNING #8) |
| side_effect | LOW | 순수 함수·mutate-free 확인, hot path 캐시 부재(WARNING #2)·계약 확장(INFO #2) |
| maintainability | LOW | JSDoc 이 실제 구현보다 넓은 보장을 주장(WARNING #3) |
| testing | LOW | 32/32 통과 + 뮤테이션 검증 유효, identity 테스트 약함(WARNING #5)·대조군 누락(WARNING #6) |
| documentation | MEDIUM | plan 미동기화(WARNING #8), CHANGELOG 누락(WARNING #9), 깊이 가드 비대칭 설명 부재 |

## 발견 없는 에이전트

(없음 — 8개 에이전트 전원 WARNING 이상 발견 보유)

## 권장 조치사항

1. **[최우선]** `stripDeep` 의 `__proto__` bracket assignment prototype pollution 수정 (WARNING #1) — `Object.create(null)` 또는 위험 키 명시적 방어 + 회귀 테스트 추가. 값 손실·크래시 가능성이 있는 유일한 실질 보안/안정성 결함.
2. `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의 `### 다음 (별건)` 체크리스트를 실제 구현 상태((a) 채택·테스트 완료)로 갱신 (WARNING #8) — 코드와 문서 간 자기모순 해소.
3. `CHANGELOG.md` 에 이번 정보 노출 수정 항목 추가 (WARNING #9).
4. 테스트 보강: "identity" 테스트에 최상위 envelope 동일성 단언 추가(WARNING #5), nested-strip 테스트에 wire envelope 원본 보존 대조군 추가(WARNING #6), 신규 테스트 JSDoc 과거형 정정(WARNING #7).
5. `stripDeep` 에 형제 함수(`sanitizeInner`)와 동등한 깊이 캡 적용 또는 호출 순서 의존을 JSDoc 에 명시(WARNING #4), JSDoc "no allocation" 주장을 실제 구현에 맞게 정정하거나 지연 할당 패턴으로 구현 변경(WARNING #3).
6. 여유가 있으면 hot path 중복 순회 최적화(WARNING #2) — `sanitizePayloadForWs`+`stripDeep` 단일 pass 병합 또는 캐시 추가. 필수 차단 사유는 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 누락 없음
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터 판단 — 이번 diff 가 아키텍처 경계/모듈 구조 변경을 포함하지 않는다고 판단(구체 사유는 라우터 출력에 미기재) |
  | dependency | 라우터 판단 — 의존성(패키지/버전) 변경 없음 |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판단 — 동시성 제어 로직 변경 없음 |
  | api_contract | 라우터 판단 — 외부 공개 API 시그니처 변경 없음(내부 함수 리팩터) |
  | user_guide_sync | 라우터 판단 — 사용자 가이드 문서 대상 변경 없음 |