# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 이번 커밋(`34e32e62f`)이 REST `getStatus()` 의 `nodeOutput`(waiting) 출구는 fanout 과 동등하게 막았지만, **같은 함수의 형제 출구인 `result`/`error`(COMPLETED/FAILED terminal)는 이번 수정에서 빠졌고, testing 리뷰어가 실제 코드를 실행해 raw 시스템 프롬프트가 그대로 새는 것을 재현했다** — 이 PR 자신이 반복 경고하는 "한 출구만 막고 나머지를 세지 않는다" 패턴의 재발.

forced(router_safety) 리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과가 확보되어 화이트리스트 미이행은 없음 — 위 CRITICAL 판정은 결과 누락이 아니라 **실제 실행 재현 + 4개 독립 리뷰어(testing/architecture/requirement, 그리고 security 의 대조 추적)의 수렴**에 근거한다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/테스트 | `InteractionService.getStatus()` 의 `result`/`error`(terminal COMPLETED/FAILED) 필드는 여전히 `deepRedactSecrets` 만 거치고 `stripExternalOnlyFields` 를 거치지 않는다. testing 리뷰어가 `execution.outputData` 에 `meta.turnDebug[].llmCalls[].requestPayload`(raw 시스템 프롬프트)를 심은 임시 프로브로 `getStatus` 를 직접 실행해 `r.result` 에 시크릿이 그대로 실리는 것을 확인했다(`PROBE_COMPLETED_RESULT_CONTAINS_SECRET=true`). architecture/requirement 도 독립적으로 같은 출구를 지적했으나, 이들은 정상 완주 경로의 `toEngineFlatShape` 가 구조적으로 `meta` 를 드롭한다고 보아 "오늘은 안전"으로 낮춰 잡았다 — 다만 두 리뷰어 모두 **context rehydration 경로**(`execution-engine.service.ts:1564-1573`, COMPLETED `NodeExecution.outputData` 원본을 `toEngineFlatShape` 없이 그대로 `setNodeOutput` 에 전달)와 **multi-turn 정상 종료 경로**(`ai-turn-executor.ts:3327` `buildMultiTurnFinalOutput` 이 `meta.turnDebug` 를 실음 → `execution-engine.service.ts:2358-2360` `savedExecution.outputData = context.nodeOutputCache[lastNodeId]`)가 이 구조적 안전 가정을 우회할 수 있음을 인정했다. 즉 "구조적으로 안전하다"는 결론과 "실행하면 샌다"는 재현이 정면으로 갈리며, 이 불일치 자체가 다음 라운드에서 반드시 확정해야 할 미해결 리스크다. | `codebase/backend/src/modules/external-interaction/interaction.service.ts:406-421` (result/error, strip 미적용) ↔ 대조 `:349-355` (nodeOutput, 이번 diff 로 strip 적용됨). 근거 경로: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3188,3327`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1564-1573,2358-2360,5899-5901` | `stripExternalOnlyFields(deepRedactSecrets(execution.outputData ?? null), MAX_REDACT_DEPTH)` 를 `result`/`error` 조립에도 대칭 적용한다. 이어서 `interaction.service.spec.ts:830` 옆에 `outputData.meta.turnDebug[].llmCalls[].requestPayload` 를 심은 COMPLETED/FAILED 회귀 테스트를 `:626` 테스트와 대칭으로 추가해, "구조적으로 안전한가 vs 실행하면 새는가" 논쟁을 테스트로 확정한다. 코드 수정 전에는 최소한 context-rehydration/multi-turn 정상종료 경로가 실제로 `execution.outputData` 에 `meta` 를 남기는지 엔진 쪽 실측을 우선한다. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | REST 신규 경로 `stripExternalOnlyFields(deepRedactSecrets(...))` 순서가, 곧바로 통째로 삭제될 `llmCalls` 서브트리(가장 큰 필드일 가능성)에 정규식 다중 패스 + JSON 파싱까지 포함하는 `deepRedactSecrets` 를 먼저 돌리고 버린다 — 버릴 데이터에 비싼 연산을 선지불 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:349-355` | 호출 순서를 `deepRedactSecrets(stripExternalOnlyFields(nodeExec.outputData ?? {}, MAX_REDACT_DEPTH))` 로 바꿔 `llmCalls` 서브트리 자체를 `deepRedactSecrets` 가 방문하지 않게 한다. 순서 무관 결과 동일성을 보장하는 회귀 테스트를 함께 추가한다. |
| 2 | 성능/문서 | 공유 유틸 추출 과정에서 직전 라운드가 실측까지 남긴 "왜 두 pass 를 합치지 않는가"(비용 실측: 0.0112ms→0.0314ms, 2.80배) JSDoc 과 순환 참조 처리 근거가 새 파일로 이관되지 않고 소실됐다 — 정확히 이 타이밍에 두 번째 호출자(REST)가 같은 트레이드오프를 다시 안게 됐는데 문서가 비어 있다 | `codebase/backend/src/modules/websocket/websocket.service.ts:294-304` (남은 자리), `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (신규, 해당 서술 없음) | `## 비용 (실측)` 절과 순환 참조 근거를 `strip-external-only-fields.ts` JSDoc 으로 이관하고, REST 신규 호출자의 비용 특성(위 WARNING 1)도 같은 절에 함께 기록한다. |
| 3 | 아키텍처/요구사항/유지보수성 | `stripExternalOnlyFields` 의 "호출부는 자매 sanitizer 와 같은 값·같은 경계 연산자를 쓴다"는 JSDoc 계약을 새 REST 호출부가 값(`MAX_REDACT_DEPTH`)만 지키고 연산자는 어긴다(`stripDeep` 은 `>`, `deepRedactSecrets` 는 `>=`) — 오늘은 `deepRedactSecrets` 가 depth 10 서브트리를 문자열로 먼저 collapse 해 우연히 무해하지만, 이는 함수 자신의 방어가 아니라 **호출 순서 + 값 우연 일치**에 의존한다. `websocket.service.spec.ts` 의 depth `it.each` 경계 sweep 에 대응하는 테스트가 REST 경로에는 없다 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:349-355` ↔ `codebase/backend/src/shared/utils/strip-external-only-fields.ts:36-39,46` ↔ `codebase/backend/src/shared/utils/sanitize-error-message.ts:134` | JSDoc 을 "값은 호출부가 맞추고 연산자는 이 함수가 항상 `>` 로 고정 — 자매가 다른 연산자를 쓰더라도 그 경계에서 서브트리를 non-object 로 collapse 한다면 무해하다"로 정밀화하거나 호출부 주석에 순서 의존성을 명시. `interaction.service.spec.ts` 에 depth 경계(`MAX_REDACT_DEPTH-1`/`MAX_REDACT_DEPTH`) sweep 테스트 추가 권장. |
| 4 | 아키텍처/테스트 | 승격된 공유 유틸 `strip-external-only-fields.ts` 가 자기 소유 spec 파일 없이, 회귀 보증이 한 소비처(`websocket.service.spec.ts`)의 describe 블록에만 결속돼 있다 — 자매 유틸 `sanitize-error-message.ts`(↔`sanitize-error-message.spec.ts`)의 직접 단위 테스트 관례와 어긋난다. 다원소 배열의 부분 clone-on-write 참조 동일성도 여전히 미검증(직전 라운드 유예 항목) | `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 전체 (대응 spec 파일 부재) | `strip-external-only-fields.spec.ts` 신설 — 참조 동일성 보존, 입력 비변형, `maxDepth` 경계, `__proto__` 오염 방지(객체+배열 분기), 다원소 배열 부분 clone 을 직접 검증. 두 소비자 spec 은 "배선 확인"만 남긴다. |
| 5 | 문서화 | `CHANGELOG.md` 의 보안 항목이 최초 fanout(depth-1) 누출만 서술하고, 같은 브랜치의 이번 커밋이 고친 **REST 단발 조회 누출**(별개의 "이미 전송된 데이터" 노출 표면)을 언급하지 않는다 — 직전 라운드(`10_32_27` W9)가 같은 클래스 결함을 조치한 전례와 비대칭 | `CHANGELOG.md:1-24` (Unreleased 보안 항목, fanout 세 표면만 명시) | 기존 항목에 REST `getStatus` 누출·수정 사실을 추가하거나 별도 Unreleased 항목 신설. `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의 "사후 대응 — 운영 판단 필요" 체크리스트에도 REST 경로 추가. |
| 6 | 유지보수성/테스트/문서화 | 이번 커밋이 새로 추가한 `interaction.service.spec.ts:616-620` 테스트 JSDoc 이 (a) `stripDeep` 을 여전히 `websocket.service.ts` 소속으로 잘못 가리키고(같은 커밋이 그 함수를 `shared/utils/strip-external-only-fields.ts` 로 옮겼음에도), (b) `getStatus` 의 옛(버그) 동작("돌려준다")을 현재형으로 서술한다(같은 커밋이 이미 고쳤으므로 과거형이어야 함) — 이 브랜치에서 "같은 커밋이 고친 걸 JSDoc 이 옛 상태로 말한다" 패턴이 세 번째~네 번째로 재발 | `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:616-620` | 파일 참조를 `shared/utils/strip-external-only-fields.ts` 로, 서술 시제를 과거형("돌려주고 있었다")으로 정정. 코드 변경 완료 후 JSDoc 을 마지막에 한 번 더 검토하는 절차화 권장(개별 수정보다 프로세스 문제로 재발 중). |
| 7 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/14-external-interaction-api.md` §R17 "표면 제약(보안)" 의 `getStatus` 서술이 이번 코드 강화(`nodeOutput` 경로에 `stripExternalOnlyFields` 추가)를 반영하지 못해 실제 방어보다 좁게 낡았다. 이 갭은 `12_06_21` cross_spec CRITICAL 1 제안②가 이미 명시적으로 요구했으나, `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의 "planner 인계" 목록에는 아직 옮겨지지 않았다 — 다음 세션이 "이미 처리됨"으로 오인하거나 재발견 낭비를 할 위험 | `spec/5-system/14-external-interaction-api.md` §R17 "nodeOutput.conversationConfig + terminal result/error (강제됨)" 항목 (약 :1346-1352) | 코드는 유지. `spec/5-system/14-external-interaction-api.md` §R17 문장을 "`getStatus` 는 `nodeOutput`(waiting) 에 `deepRedactSecrets`+`stripExternalOnlyFields` 를, terminal `result`/`error` 에는 `deepRedactSecrets` 만 적용한다"로 구분 갱신 — **단 위 Critical #1 이 (a)안(대칭 strip 적용)으로 해소되면 "양쪽 모두 stripExternalOnlyFields 적용"으로 한 번에 갱신**. `spec-draft-eia-62-waiting-payload.md` 의 (7)번 또는 별도 항목에 이 planner 인계를 명시적으로 등재. planner 위임 대상(`developer` 는 `spec/` 쓰기 권한 없음). |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 | REST `getStatus` 응답 shape 변경 — `nodeOutput.meta.turnDebug[].llmCalls[]` 필드가 더 이상 실리지 않음(공개 인터페이스 breaking, 그러나 의도된 보안 수정이고 CHANGELOG 에 운영 영향 명시됨) | `interaction.service.ts:349-355` | 조치 불요(문서화 완료). |
| 2 | 부작용 | `stripExternalOnlyFields` 시그니처가 module-private 단일 인자 → exported `(value, maxDepth)` 로 승격. 전수 grep 으로 잔존 orphan 호출자 없음을 확인, `maxDepth` 는 TS 필수 인자라 누락 시 컴파일 타임에 걸림 | `strip-external-only-fields.ts:41-43`, 호출부 2곳 | 조치 불요. |
| 3 | 부작용 | `stripDeep` 은 lazy clone-on-write 로 입력을 mutate 하지 않음 — 내부 WS 브로드캐스트(`wireEnvelope`)나 `deepRedactSecrets` 의 `DEEP_REDACT_CACHE` WeakMap 을 오염시키지 않음 (직접 확인) | `strip-external-only-fields.ts:45-86` | 조치 불요. |
| 4 | 스코프 | 이번 라운드 실질 델타는 커밋 `34e32e62f` 하나 — 직전 consistency CRITICAL(REST 누출) 처방일 뿐, 신규 기능/무관한 리팩터 없음. 테스트도 기존 케이스 수정 없이 신규 1건만 순수 추가 | 전체 diff (`git show 34e32e62f --stat`) | 조치 불요. |
| 5 | 유지보수성 | "재귀 트리 순회 + lazy clone-on-write" 스켈레톤이 이제 세 벌(`stripDeep`/`sanitizeInner`/`deepRedactObject`)로 늘었으나, 프로젝트가 이미 "axes 발산 시 full-unification defer, 짝점검으로 대체" 로 이 트레이드오프를 수용한 바 있음 | `strip-external-only-fields.ts:45-86` vs `websocket.service.ts:266-292` vs `sanitize-error-message.ts:127-160` | 즉시 조치 불필요 — 한쪽 수정 시 나머지 짝점검. |
| 6 | 성능 | REST 경로엔 WS 의 `SANITIZE_CACHE`/`DEEP_REDACT_CACHE` 같은 identity 캐시가 없지만, 매 요청 TypeORM 하이드레이트 객체라 캐시 적중 가능성이 없어 실질 손해 아님 | `interaction.service.ts:349-355` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | REST 스냅샷 fix 자체는 정확·충분함을 재귀 규칙 추적으로 확인. `emitNodeEvent` strip 주석이 "현재 불필요"라고 위험을 과소평가(실제로는 단일 턴 AI Agent `NODE_COMPLETED` 가 이미 llmCalls 를 실어 활성 경로 보호 중) |
| performance | LOW | 알고리즘 악화 없음. `deepRedactSecrets`→`stripExternalOnlyFields` 순서가 버릴 데이터에 비싼 연산을 선지불(순서 스왑 1줄로 해결). 비용 실측 JSDoc 소실 |
| architecture | MEDIUM | 공유 유틸 승격은 옳은 방향. 자기 소유 spec 부재, 경계 연산자 계약 위반(호출 순서 의존), `result`/`error` 출구 비대칭(재현 못함, 후속 확인 권고) |
| requirement | MEDIUM | 핵심 CRITICAL 처방은 유효. `result`/`error` 비대칭(구조적으로는 안전 결론, but context rehydration 경로 인정), 경계 연산자 계약 위반, spec §R17 SPEC-DRIFT, CHANGELOG 누락 |
| scope | NONE | 실질 델타는 커밋 1개, 직전 CRITICAL 의 최소 필요 처방. 스코프 이탈 없음 |
| side_effect | LOW | REST 응답 shape 변경(의도됨), 시그니처 승격 전수 확인, no-mutation 확인. 문제 없음 |
| maintainability | LOW | 핵심 수정 정확. 경계 연산자 계약 미검증 + 같은 커밋의 JSDoc 파일 참조 stale(4번째 재발 패턴의 일부) |
| testing | CRITICAL | `result`/`error` 출구에 strip 미적용을 **실제 코드 실행으로 재현** — raw 시스템 프롬프트 누출 확인. 공유 유틸 전용 테스트 부재, JSDoc stale 참조 |
| documentation | WARNING (3건) | JSDoc 시제 오류(같은 브랜치 3번째 재발), CHANGELOG 누락, spec §R17 stale + planner 인계 미등재 |

## 발견 없는 에이전트

없음 — 9개 reviewer 모두 최소 1건 이상의 WARNING/INFO/CRITICAL 을 보고함.

## 권장 조치사항

1. **[최우선]** `InteractionService.getStatus()` 의 `result`/`error` 조립에 `stripExternalOnlyFields(deepRedactSecrets(execution.outputData ?? null), MAX_REDACT_DEPTH)` 를 대칭 적용하고, `meta.turnDebug[].llmCalls[]` 를 심은 COMPLETED/FAILED 회귀 테스트를 추가한다 — testing 이 실제 실행으로 재현한 CRITICAL. 착수 전 context-rehydration/multi-turn 정상종료 경로가 실제로 `execution.outputData` 에 `meta` 를 남기는지 엔진 쪽을 우선 실측해 architecture/requirement 의 "구조적으로 안전" 결론과의 불일치를 확정한다.
2. `interaction.service.spec.ts:616-620` 의 JSDoc 을 정정(파일 참조를 `shared/utils/strip-external-only-fields.ts` 로, 시제를 과거형으로) — 저비용, 즉시 가능.
3. `deepRedactSecrets`/`stripExternalOnlyFields` 호출 순서를 스왑해 REST 경로의 낭비 연산을 제거한다(순서 무관 결과 동일성 회귀 테스트 동반).
4. `strip-external-only-fields.spec.ts` 신설로 공유 유틸 자체의 계약(참조 동일성, 비변형, depth 경계, `__proto__` 방어, 다원소 배열 부분 clone)을 직접 검증한다.
5. `CHANGELOG.md` 에 REST `getStatus` 누출·수정 항목을 추가하고, `spec/5-system/14-external-interaction-api.md` §R17 갱신을 planner 인계 목록에 명시적으로 등재한다(§R17 은 위 1번 결과에 따라 한 번에 갱신하는 것이 효율적).
6. 비용 실측 JSDoc(`## 비용 (실측)` 절)과 순환 참조 근거를 `strip-external-only-fields.ts` 로 이관하고, 경계 연산자 계약 문구를 실제로 검증 가능한 형태로 정밀화한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (9명)
  - **제외**: 표 (5명, 이유는 라우터 결정 로그에 개별 사유가 제공되지 않음 — diff 가 보안/데이터 정제 성격이라 아래 표면과 무관하다고 라우터가 판단한 것으로 추정)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 이번 diff 가 신규/변경 외부 의존성을 도입하지 않아 라우터가 비대상으로 판단(개별 사유 미기재) |
  | database | 이번 diff 가 DB 스키마/쿼리 변경 없음(순수 in-memory payload 정제) |
  | concurrency | 신규 동시성 프리미티브·레이스 조건 표면 없음 |
  | api_contract | REST 응답 필드 소멸은 있으나(side_effect INFO 1 참조) 계약 정의(OpenAPI 등) 변경으로 라우터가 분류하지 않음 |
  | user_guide_sync | 사용자 가이드/문서 영향 없는 내부 보안 수정으로 판단 |