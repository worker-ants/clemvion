# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `stripDeep` 의 깊이 상한 경계(depth 정확히 10)에서 `llmCalls` strip 우회 가능성에 대해 reviewer 들의 결론이 정면 충돌한다. testing reviewer 는 재현 스크립트로 실측된 CRITICAL(raw 콘텐츠 유출 재현)로 판정했고, security/side_effect/requirement 3개 reviewer 는 독립적으로 같은 depth 산술을 추적해 "실제 콘텐츠는 이미 형제 함수가 redact 한 뒤라 새지 않고 필드명만 잔존" 이라는 WARNING/NONE 결론에 도달했다. **이 경계를 실제 파이프라인으로 실행하는 테스트가 diff 전체에 하나도 없어 코드만으로는 어느 쪽이 맞는지 확정할 수 없다** — 이 충돌 자체가 "clean" 으로 읽혀서는 안 되며, 직접 재현 검증이 다른 모든 조치보다 우선한다. 이 CRITICAL 판정을 제외하면 나머지는 이전 라운드(10_32_27) 지적사항(`__proto__` 오염, 지연 할당, 깊이 상한 부재, identity/대조군 테스트, plan 문서 동기화)이 실제 코드에 반영됐음을 다수 reviewer 가 직접 소스 대조로 확인한 상태다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY / TESTING / SIDE_EFFECT (결론 충돌) | `stripDeep` 의 깊이 상한 비교 연산자(`depth >= MAX_SANITIZE_DEPTH`)가 형제 함수 `sanitizePayloadForWs`(`depth > MAX_SANITIZE_DEPTH`)와 달라, depth 정확히 10 인 노드는 own-key 검사를 건너뛰어 `llmCalls` 키가 삭제되지 않는다. **testing** 은 두 함수 로직을 그대로 복제한 재현 스크립트로 `containerDepth=10: sanitized 보존=true, stripped 이후 보존=true`(누출)를 실측해 CRITICAL 로 판정했다. 반면 **security/side_effect/requirement** 는 독립적으로 같은 depth 산술을 추적해 "depth 11 에 위치한 `llmCalls` 의 실제 값(value)은 `sanitizePayloadForWs` 가 stripDeep 이전 단계에서 이미 `'[REDACTED_DEPTH]'` 문자열로 치환해 둔 상태이므로, 남는 것은 **필드 이름**뿐이고 raw 콘텐츠는 새지 않는다"고 결론(requirement 는 이를 "버그가 아니라 의도된 보정"으로까지 판정, NONE). 두 결론 모두 정교한 line-level 근거를 갖고 있으나 정면으로 충돌하며, 이 정확한 경계(depth=10, 실제 파이프라인 호출 순서 그대로)를 실행하는 회귀 테스트가 diff 전체에 전무해 코드만으로는 검증 불가능하다. | `codebase/backend/src/modules/websocket/websocket.service.ts:387` (`stripDeep`, `if (depth >= MAX_SANITIZE_DEPTH) return value;`) vs `:251` (`sanitizePayloadForWs`, `if (depth > MAX_SANITIZE_DEPTH) return '[REDACTED_DEPTH]';`) | **최우선 조치**: `sanitizePayloadForWs → stripExternalOnlyFields(stripDeep)` 실제 호출 순서 그대로, depth 정확히 10 에 실제 식별 가능한 문자열(예: `'SECRET PROMPT AT DEPTH 10'`)을 담은 `llmCalls` 를 배치하고 `emitExecutionEvent` 전체 경로를 태워 외부 fanout 결과 JSON 에 그 문자열이 남는지 직접 단언하는 테스트를 추가해 분쟁을 해소한다. 결과와 무관하게 `stripDeep` 의 경계 연산자를 `sanitizePayloadForWs` 와 동일한 `depth > MAX_SANITIZE_DEPTH` 로 통일해 모호성 자체를 제거하고, 이 경계를 고정하는 회귀 테스트를 영구히 남긴다. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | PERFORMANCE | `stripDeep` 에 형제 `sanitizePayloadForWs` 의 `SANITIZE_CACHE` 같은 identity(WeakMap) 캐시가 없어, 그 캐시가 존재하는 이유(ForEach 가 같은 `node.config` 를 수천 회 emit)와 정확히 같은 hot-loop 시나리오에서 sanitize 쪽은 O(1) 로 줄었는데 strip 쪽 비용만 O(N × subtree) 로 재발생한다. 이 gap 을 커버하는 테스트도 없다(기존 캐시 테스트는 `stripExternalOnlyFields` 를 호출하지 않는 `emitBackgroundRunEvent` 만 검증). | `codebase/backend/src/modules/websocket/websocket.service.ts:386-421`(`stripDeep`, 캐시 없음) vs `:236`(`SANITIZE_CACHE`), `:254-262`(캐시 조회/저장) | `wireEnvelope` 서브트리 단위 `WeakMap` 캐시를 `stripDeep` 에도 추가하거나, 최소한 이 gap 을 JSDoc(`:342-385`)에 명시. |
| 3 | PERFORMANCE | 유예 근거로 제시된 A/B 벤치마크(8턴 `turnDebugHistory` AI 대화, N=3000, +20.2µs)가 이번 diff 로 새로 확장된 실사용 범위 — `llmCalls` 를 가질 수 없다고 스스로 명시한 **모든 node 이벤트**에도 무조건 `stripDeep` 을 거는 것(방어심층화, `:640-642`) — 의 worst case(대용량 non-AI `nodeOutput`, HTTP 노드 대용량 JSON 응답 등)를 대표하지 않는다. | JSDoc `codebase/backend/src/modules/websocket/websocket.service.ts:370-384` vs 호출부 `:640-642` | 대용량 `nodeOutput` 시나리오로 동일 A/B 를 추가 측정해 JSDoc 에 반영하거나, `llmCalls` 를 가질 수 없는 이벤트에는 `stripDeep` 자체를 스킵하는 방식을 검토. |
| 4 | DOCUMENTATION | `spec-draft-eia-62-waiting-payload.md` 의 "성능 실측" 체크리스트 항목이 실제로는 커밋 `5df89cda6` 에서 이미 완료(수치가 `stripDeep` JSDoc `## 비용 (실측)` 및 `RESOLUTION.md` W2 에 기록됨)됐는데도 미체크(`[ ]`)로 남아 있다. | `plan/in-progress/spec-draft-eia-62-waiting-payload.md:150` | 체크박스를 `[x]` 로 갱신하고 "옛 depth-1 0.0112ms vs 현행 재귀 0.0314ms(2.80배)" 한 줄을 근거로 덧붙인다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 5 | SCOPE | 브랜치/plan 표제("종결 payload 정리")와 실제 랜딩된 코드(`llmCalls` 유출 보안 수정)가 무관해 보이지만, `--impl-prep` 이 spec CRITICAL 로 원 작업을 차단해 보안 결함을 우선 처리하기로 pivot 한 경위가 plan·커밋 이력에 이미 기록돼 있다 — 신규 스코프 이탈 아님. | `plan/in-progress/eia-terminal-payload.md:12-16, 61-114`, `plan/in-progress/spec-draft-eia-62-waiting-payload.md` | 조치 불요(원 작업 재개 시 plan 체크리스트에 pivot 사실 재확인 권고). |
| 6 | ARCHITECTURE | `turnDebug` 필드명이 payload 트리 안에서 서로 다른 두 shape(object vs array)로 재사용돼 name-based strip 설계의 전제(필드명=유일 식별자)를 약화시킨다. 이미 별도 planner 항목(CRITICAL)으로 분리 추적 중. | `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:615` vs `ai-conversation-helpers.ts:97` | 이번 diff 조치 불요. 필드명 충돌 해소 작업 시 `stripDeep` 의 name-based 전제가 안전한지 함께 검증. |
| 7 | ARCHITECTURE | `stripDeep` 과 형제 `sanitizeInner` 가 거의 동일한 트리 순회 스켈레톤(재귀+변경추적+clone-on-write)을 독립 구현 — 의도적으로 defer 된 사안(짝점검 관례). | `websocket.service.ts:386-421` vs `:265-291` | 즉시 조치 불요. 한쪽 수정 시 다른 쪽도 같은 결함 클래스(특히 `__proto__`/깊이 상한) 짝점검 유지. |
| 8 | ARCHITECTURE | `websocket.service.ts`(744줄)가 transport facade 와 payload 보안 정책(마스킹+strip) 두 관심사를 계속 누적 중. | `websocket.service.ts` 전체, 특히 `:216-421` | 지금 분리 불요. `EXTERNAL_STRIPPED_FIELDS` 확장 시 `payload-sanitization.ts` 유틸 모듈 추출 고려. |
| 9 | MAINTAINABILITY | `stripDeep` JSDoc 이 "형제 `sanitizeInner` 와 같은 패턴" 이라 주장하지만, 배열 분기는 실제로 다르다(`stripDeep` 은 진짜 lazy slice-on-first-change, `sanitizeInner` 는 매 호출마다 `new Array` 선할당). | `websocket.service.ts:344`(JSDoc) vs `:389-396` / `:265-274` | JSDoc 문구를 객체/배열 분기로 나눠 한정하거나 `sanitizeInner` 배열 분기도 동일 lazy 패턴으로 정렬(후속 작업). |
| 10 | MAINTAINABILITY | `stripDeep` 내부에서 배열 분기(`if` 두 개)와 객체 분기(`??=` 관용구)가 동일한 "지연 할당" 의도를 서로 다른 스타일로 표현 — 내부 일관성 낮음. | `websocket.service.ts:393-394` vs `:404, 410` | `out ??= value.slice();` 형태로 배열 분기도 `??=` 관용구로 통일(동작 변경 없는 스타일 정리, 우선순위 낮음). |
| 11 | TESTING | 신규 nested-strip 테스트가 배열을 단일 원소로만 구성해, `stripDeep` 배열 분기의 부분 clone-on-write(여러 원소 중 일부만 변경되는 경우)는 검증되지 않는다. | `websocket.service.spec.ts:672-678, 733` | `turnDebugHistory` 를 2개 이상 원소로 구성해 "일부 원소만 strip" 케이스 추가(필수 아님). |
| 12 | DOCUMENTATION | `stripDeep` JSDoc 의 "깊이 상한은 형제와 같은 `MAX_SANITIZE_DEPTH` 를 쓴다" 문구가 상수 재사용까지만 정확하고 경계 조건(`>` vs `>=`)까지는 정확하지 않아 완전한 동작 동등성으로 오독될 수 있다 — Critical #1 항목과 연관된 문서 정밀도 이슈. | `websocket.service.ts:360-361` vs `:387`, `:251` | Critical #1 조치(경계 연산자 통일) 시 자동 해소. 별도 조치 시 문구를 "경계 조건은 다르다"로 명확화. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | depth 경계에서 `llmCalls` 필드명 잔존 가능성(내용은 이미 redact 됐다고 판단) — WARNING. `__proto__`/깊이상한 처방은 확인 완료 |
| performance | MEDIUM | `stripDeep` identity 캐시 부재, 유예 벤치마크가 확장된 실사용 범위 대표 못함 |
| architecture | LOW | OCP 정합·결합도 개선 확인. `turnDebug` 이름 재사용/파일 비대화는 INFO(추적 중 또는 defer) |
| requirement | NONE | depth 경계는 산술적으로 의도된 보정(버그 아님)으로 결론. RESOLUTION.md 9개 항목 전부 소스 대조로 반영 확인 |
| scope | LOW | diff 자체는 좁게 스코프됨 확인. plan/브랜치 표제 불일치는 이미 승인된 pivot |
| side_effect | MEDIUM | 동일 depth 경계 WARNING(security 와 같은 결론) — 새 방어(depth cap) 자체의 경계 결함 |
| maintainability | LOW | 사소한 JSDoc 부정확·내부 스타일 불일치만(INFO 2건) |
| testing | **CRITICAL** | depth 경계에서 재현 스크립트로 실측된 leak(off-by-one) + 그 경계를 실행하는 테스트 전무 |
| documentation | LOW | plan 성능실측 체크리스트 stale(WARNING). 그 외 CHANGELOG/plan/JSDoc 조치 확인됨 |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 INFO 이상의 발견사항을 보고했다(대다수는 이전 라운드 조치의 확인 성격).

## 권장 조치사항

1. **[최우선]** depth=10 경계 `llmCalls` 유출 여부를 실제 파이프라인 순서(`sanitizePayloadForWs` → `stripExternalOnlyFields`)와 `emitExecutionEvent` 전체 경로로 직접 재현 검증해 testing(CRITICAL) vs security/side_effect/requirement(WARNING/NONE) 결론 충돌을 해소한다. 결과와 무관하게 `stripDeep` 의 경계 연산자를 `sanitizePayloadForWs` 와 동일한 `depth > MAX_SANITIZE_DEPTH` 로 통일하고, 이 경계를 고정하는 회귀 테스트를 영구히 추가한다.
2. `stripDeep` 에 identity(WeakMap) 캐시를 추가하거나 반복-emit hot-loop 비용 gap 을 JSDoc 에 명시한다(performance #2).
3. 유예 성능 벤치마크를 대용량 non-AI `nodeOutput` 시나리오로 보강하거나, `llmCalls` 를 가질 수 없는 이벤트에는 `stripDeep` 자체를 스킵하는 방식을 검토한다(performance #3).
4. `spec-draft-eia-62-waiting-payload.md:150` 의 성능 실측 체크박스를 실제 상태(`[x]`)로 동기화한다(documentation #4).
5. (낮은 우선순위) INFO 항목들 — JSDoc 정밀도 정정, 배열/객체 지연할당 스타일 통일, 다중 원소 배열 테스트 보강. `turnDebug` 필드명 충돌은 이미 별도 planner 항목으로 추적 중이므로 그대로 유지.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation (9명)
  - **제외**: dependency, database, concurrency, api_contract, user_guide_sync (5명) — prompt 에 개별 사유가 제공되지 않음(라우터 스코프 판단, 상세 사유 미기재)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단(사유 미제공) |
  | database | 라우터 판단(사유 미제공) |
  | concurrency | 라우터 판단(사유 미제공) |
  | api_contract | 라우터 판단(사유 미제공) |
  | user_guide_sync | 라우터 판단(사유 미제공) |