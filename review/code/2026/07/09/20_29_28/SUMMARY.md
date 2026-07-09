# Code Review 통합 보고서

## 전체 위험도
**LOW** — #501 회귀(멀티턴 AI resume/retry 턴에서 `integration_usage_log` 기록 누락) 수정 범위가 정확하고 부수 영향이 없음을 6개 reviewer(security/requirement/scope/side_effect/maintainability/documentation)가 교차 확인. Critical/Warning 0건, 전 발견사항 INFO. 다만 `testing` reviewer 는 `ran` 목록에 `success` 로 보고됐으나 결과 파일(`testing.md`)이 실제로 존재하지 않아 내용을 반영하지 못함(아래 "재시도 필요" 참고).

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 재주입되는 `workflowId`/`nodeExecutionId` 는 이미 소속 검증을 통과한 DB row PK 로, 사용자 주입 불가·인젝션 표면 없음. `_resumeCheckpoint`/`_retryState`(DB 영속) 는 명시적 allow-list 구조라 두 필드가 애초 배제되며, WebSocket emit 화이트리스트에도 신규 노출 없음 | `execution-engine.service.ts` (`buildRetryReentryState`), `ai-turn-orchestrator.service.ts`, `retry-turn.service.ts`, `resume-state.schema.ts` | 없음 — 정보 제공용 |
| 2 | Requirement | 호출부(`handleAiResumeTurn`/`applyRetryLastTurn`)가 실제로 `nodeExecutionId` 를 전달하는지에 대한 mock assertion 이 spec 에 없음 — 배선(wiring) 자체는 소스 읽기로 확인됐으나 자동 회귀 감지 커버리지는 얇음 | `ai-turn-orchestrator.service.spec.ts`, `retry-turn.service.spec.ts` | `toHaveBeenCalledWith(..., expect.objectContaining({ nodeExecutionId: ... }))` assertion 추가(조치됨) |
| 3 | Requirement | (diff 범위 밖) `information-extractor.handler.ts` 의 resume `llmContext` 구성이 `nodeExecutionId` 에 `state.nodeId`(노드 정의 id, row PK 아님)를 쓰고 `workflowId` 자체가 누락된 유사 클래스의 attribution 갭으로 보임 | `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` | 별도 plan/이슈로 추적(후속, 이번 PR 스코프 확장 불필요) |
| 4 | Scope / Security / Maintainability | `execution-engine.service.spec.ts` 의 `reentryWorkflowInput` 헬퍼가 선행 PR(#868) 유입 out-of-scope `service` 참조(`ReferenceError`)를 `svcMetrics` 로 정정 — 이번 PR 핵심 스코프(#501)와 무관하나 plan 문서에 근거·기록되어 투명함. production 코드 영향 없음 | `execution-engine.service.spec.ts` (`NF-OB-07` describe) | 별도 조치 불필요 |
| 5 | Side Effect | `nodeExec`/`spawnedRow` 가 null 인 방어 경로에서 `resumeState.nodeExecutionId` 가 값 `undefined` 상태로 키 자체는 존재. 현재 유일 소비처가 truthy 게이트라 무해하나, 향후 존재-검사 소비 코드 추가 시 유의 | `ai-turn-orchestrator.service.ts`, `execution-engine.service.ts` | 별도 조치 불요 |
| 6 | Side Effect | resume/retry 턴에서 `IntegrationsService.logUsage()` DB 쓰기 재개는 회귀 fix 의 의도된 목적(신규 외부 호출 아님, 기록 경로 복구) | `ai-turn-executor.ts`(소비 게이트) | 없음 — 의도된 동작 |
| 7 | Side Effect | `CREDENTIAL_CONTEXT_FIELDS` 에 `'nodeExecutionId'` 추가는 `.spec.ts` 전용 오라클이며 production `buildResumeCheckpoint` 는 자체 allow-list 리터럴을 써 이 배열 미참조 — 안전 | `resume-state.schema.ts` | 향후 재사용 시 재검증만 권고 |
| 8 | Maintainability | `#501` 회귀 설명 주석이 호출부 3곳 + 스키마 doc-comment 에 반복(문서 성격 중복, 로직 중복 아님) | 다수 | 우선순위 낮음 |
| 9 | Documentation | CHANGELOG.md 미갱신 — 유사 회귀 수정(#868)은 CHANGELOG 항목 있음 | `CHANGELOG.md` | 선택적 |
| 10 | Documentation | `ReentryStateDriver` 인터페이스 JSDoc 이 신규 `opts.nodeExecutionId` 목적을 설명 안 함 | `engine-driver.interface.ts` | `@param` 한 줄 추가(조치됨) |
| 11 | Documentation | plan 문서의 파일:라인 참조가 향후 stale 될 수 있음(일반적 관행) | plan 문서 | 별도 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/자격증명 유출/신규 노출 없음 — 서버측 DB PK 재주입만, allow-list·화이트리스트 이중 방어 유지 |
| requirement | LOW | spec(INT-US-05, §4 6단계)과 line-level 정합, root cause 정확·회귀 테스트 실제 검증(464/464 통과). 호출부 wiring mock assertion 부재만 지적 |
| scope | LOW | 7개 변경 파일 전부 단일 목적에 수렴, 과잉/무관 변경 없음. 유일 경계는 문서화된 선행 결함 수정 1줄 |
| side_effect | LOW | breaking 시그니처 변경 없음(optional 필드 추가), DB 영속 checkpoint 배제 확인, 유일 관측 부작용은 의도된 것(logUsage 재개) |
| maintainability | NONE | 변경 폭 작고 주석 충실, 기존 패턴 준수 |
| documentation | LOW | `#501` 태그 일관·spec 인용 정확. CHANGELOG/JSDoc 보강은 선택적 |
| testing | 재시도 필요 | `ran` 은 `success` 인데 `testing.md` 출력 파일 부재 — 상태-산출물 불일치(requirement reviewer 가 464/464 통과·회귀 테스트 검증으로 커버) |

## 권장 조치사항

1. (선택, 비차단) `testing` reviewer 결과 파일 부재 — requirement reviewer 가 이미 전량 통과(464/464)·`#501 regression` 신규 테스트 검증을 직접 실행으로 확인했으므로 병합 차단 사유 아님.
2. (조치됨) `ai-turn-orchestrator.service.spec.ts`/`retry-turn.service.spec.ts` 에 `nodeExecutionId` 전달 mock assertion 추가.
3. (후속 추적) `information-extractor.handler.ts` 유사 attribution 갭 별도 이슈.
4. (조치됨) `ReentryStateDriver` 인터페이스 JSDoc 에 `opts.nodeExecutionId` 목적 보강.

## 라우터 결정

- `routing_status=done`. 실행: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7). 제외: `performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync` (성능/구조/의존성/DB/동시성/외부계약/유저가이드 영향 경로 없음).
