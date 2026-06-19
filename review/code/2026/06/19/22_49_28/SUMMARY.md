# Code Review 통합 보고서

**대상**: C-1 dev 잔꼬리(작업 1b) — WorkflowForbiddenWorkspaceError 타입화, LlmCallRecord 공유 타입 전환, TurnRagDelta rename, plan/review 문서 추가
**리뷰 일시**: 2026-06-19

---

## 전체 위험도

**LOW** — 보안 강화(workspace 격리 fail-closed) 및 내부 코드 정합 리팩토링이 주를 이루며 새로운 취약점·아키텍처 회귀·기능 결함 없음. 단, API 에러 코드 surface 변경(SUB_WORKFLOW_FAILED → WORKFLOW_FORBIDDEN_WORKSPACE)은 의도된 breaking change 로 변경 이력 문서화 권장. spec §4 인라인 열거 stale 은 SPEC-DRIFT 로 project-planner 위임 필요.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec §4 step 4 런타임 에러 열거에 `WORKFLOW_FORBIDDEN_WORKSPACE` 미포함 — 코드는 `mapSubWorkflowError` 에 해당 분기를 추가·동작하나, `spec/4-nodes/2-flow/1-workflow.md §4` step 4 인라인 열거(`SUB_WORKFLOW_NOT_FOUND / SUB_WORKFLOW_TIMEOUT / SUB_WORKFLOW_QUEUE_FAILED / SUB_WORKFLOW_FAILED`)가 stale 상태 | `spec/4-nodes/2-flow/1-workflow.md §4` L108 | 코드 유지 + spec 갱신: §4 step 4 인라인 열거에 `WORKFLOW_FORBIDDEN_WORKSPACE` 추가 또는 열거 대신 "§6 표 참조"로 간소화. project-planner 위임 |
| 2 | API 계약 | 에러 코드 surface 변경 — cross-workspace 호출 시 기존 `SUB_WORKFLOW_FAILED` fallthrough 가 `WORKFLOW_FORBIDDEN_WORKSPACE` 로 변경됨. 에러 코드를 직접 파싱하는 클라이언트(프론트엔드·webhook·API 소비자) 기존 핸들링이 동작하지 않을 수 있음 | `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` `mapSubWorkflowError` + `error-codes.ts` | 보안 강화 목적의 의도된 변경이므로 CRITICAL 아님. changelog 또는 마이그레이션 가이드에 "Cross-workspace 호출 에러 코드가 `SUB_WORKFLOW_FAILED` → `WORKFLOW_FORBIDDEN_WORKSPACE` 로 변경됨" 명시 권장 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 에러 메시지에 `targetWorkspaceId`/`callerWorkspaceId` 포함 — 기존 inline Error 와 동일 패턴, 외부 API 응답 직렬화 여부 확인 권장 | `workflow-errors.ts` L88-93 | 에러 핸들러 레이어에서 workspaceId 필드가 외부 응답에 직렬화되지 않는지 확인 |
| 2 | 보안 | `LlmCallRecord` optional 화로 감사 추적 정적 보장 약화 — push site 가 항상 전 필드 공급하나 정적 계약이 느슨해짐 | `ai-agent.handler.ts` L1489, L2410 | `requestPayload`/`responsePayload` non-optional 유지 또는 push site 명시적 타입 단언 검토 |
| 3 | 아키텍처 | `LlmCallRecord` all-optional superset 설계 — 미래 consumer 에서 required subset 구분 필요 가능 | `shared/llm-tracing/llm-call-record` | 중기적으로 required subset + optional extension 구분 검토 (비차단) |
| 4 | 테스트 | `WorkflowForbiddenWorkspaceError` 클래스 계약 전용 단위 테스트 없음 — typed error 계층의 다른 멤버(`workflow-errors.spec.ts`)와 일관성 결여 | `codebase/backend/src/modules/execution-engine/workflow-errors.spec.ts` | describe 블록 추가: (a) mismatch 케이스 필드 단언, (b) missing-caller 케이스, (c) `.name` 확인, (d) `instanceof Error` |
| 5 | 테스트 | `assertSameWorkspace` 테스트 6건이 regex 기반 — `instanceof WorkflowForbiddenWorkspaceError` 타입 가드 미검증 | `execution-engine.service.spec.ts` L878, L943, L1842, L1849, L1957, L1964 | 최소 1건에 `expect(err).toBeInstanceOf(WorkflowForbiddenWorkspaceError)` 또는 `rejects.toThrow(WorkflowForbiddenWorkspaceError)` 추가 |
| 6 | 테스트 | `LlmCallRecord[]` 전환 후 `durationMs` 런타임 공급 계약 테스트 없음 | `ai-agent.handler.spec.ts` | LLM 호출 경로 테스트에 `expect(typeof llmCalls[0].durationMs).toBe('number')` 단언 추가 |
| 7 | 테스트 | `mapSubWorkflowError` backstop 음성 테스트 누락 — prefix 없는 plain Error 가 `SUB_WORKFLOW_FAILED` fallback 으로 라우팅되는지 미검증 | `workflow.handler.spec.ts` | prefix 없는 plain Error → `SUB_WORKFLOW_FAILED` 케이스 음성 테스트 1건 추가 |
| 8 | 문서화 | `WorkflowForbiddenWorkspaceError` JSDoc 에 non-canonical `executeSync` 명칭 혼입 | `workflow-errors.ts` L75-78 | JSDoc 에서 `executeSync` 제거, `executeInline`/`executeAsync` 만 표기 |
| 9 | 문서화 | `ai-agent.handler.ts` 인라인 주석 한국어·영어 혼용 — 동일 파일 기존 주석은 영어 단독 | `ai-agent.handler.ts` L1487-1488, L2407-2408 | 영어 단독으로 통일: "push sites always supply every field." |
| 10 | 문서화 | `TurnRagDelta` rename 이력 주석 부재 — 동명 충돌 해소 의도가 코드에 미기술 | `output-shape.ts` L307-312 | 인터페이스 주석에 "(formerly `TurnDebugEntry` — renamed to disambiguate from canonical `TurnDebugEntry` in `conversation-utils.ts`)" 추가 |
| 11 | 문서화 | `plan/in-progress/c1-dev-followups-1b.md` 워크플로 체크박스 미반영 (`/ai-review`, `RESOLUTION.md` 항목 미체크) | `plan/in-progress/c1-dev-followups-1b.md` L30-34 | `/ai-review` 완료 및 SUMMARY 생성 후 `[x]` 갱신 후 커밋에 포함 |
| 12 | 유지보수성 | `WorkflowForbiddenWorkspaceError` 생성자 메시지 prefix 상수 미추출 — 오타 위험 존재 | `workflow-errors.ts` L88-93 | `const FORBIDDEN_WORKSPACE_PREFIX = 'WORKFLOW_FORBIDDEN_WORKSPACE:'` 추출 선택적 고려 |
| 13 | 부작용 | `ErrorCode` enum 신규 항목 추가 — `Object.keys(ErrorCode)` 동적 순회 로직이 있다면 새 항목 노출 | `error-codes.ts` | 해당 패턴 없으면 무시; 있다면 새 항목 포함 여부 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | workspaceId 에러 메시지 노출(기존과 동일), LlmCallRecord optional 화 — 신규 취약점 없음 |
| architecture | NONE | 도메인 오류 계층 일관성 적절, 레이어 경계 올바름, rename 명확성 향상 |
| requirement | LOW | SPEC-DRIFT: spec §4 step 4 인라인 열거 stale (코드는 정확, spec 갱신 필요) |
| scope | NONE | 17개 파일 전부 plan 1:1 대응, 범위 이탈 없음 |
| side_effect | LOW | 에러 타입 변경 호환성 유지, 타입 loosen 런타임 영향 없음, 파일시스템 변경 의도된 것 |
| maintainability | NONE | 기존 패턴 일관 준수, 중복 제거, 네이밍 개선 |
| testing | LOW | 기존 테스트 통과, WorkflowForbiddenWorkspaceError 클래스 직접 단위 테스트 부재 |
| documentation | LOW | JSDoc executeSync 비-canonical 명칭, 주석 언어 혼용, rename 이력 미기술 |
| api_contract | LOW | 에러 코드 surface 변경(SUB_WORKFLOW_FAILED → WORKFLOW_FORBIDDEN_WORKSPACE) — 의도된 breaking change, changelog 문서화 권장 |

---

## 권장 조치사항

1. **[SPEC-DRIFT] spec §4 step 4 인라인 열거 갱신** — `spec/4-nodes/2-flow/1-workflow.md §4` step 4 에 `WORKFLOW_FORBIDDEN_WORKSPACE` 추가 또는 "§6 표 참조"로 간소화. project-planner 위임 (코드 revert 불가).
2. **API 변경 이력 문서화** — changelog 또는 마이그레이션 가이드에 "Cross-workspace 호출 에러 코드 `SUB_WORKFLOW_FAILED` → `WORKFLOW_FORBIDDEN_WORKSPACE` 변경" 명시.
3. **테스트 보완** — (a) `workflow-errors.spec.ts` 에 `WorkflowForbiddenWorkspaceError` 클래스 계약 테스트, (b) `execution-engine.service.spec.ts` 에 `instanceof` 단언 최소 1건, (c) `ai-agent.handler.spec.ts` 에 `durationMs` 런타임 공급 단언, (d) backstop 음성 테스트 1건.
4. **문서화 정리** — JSDoc 에서 `executeSync` 제거, `ai-agent.handler.ts` 주석 영어 단독 통일, `TurnRagDelta` rename 이력 주석 추가.
5. **plan 체크박스 갱신** — `/ai-review` 완료 후 `c1-dev-followups-1b.md` 워크플로 항목 `[x]` 처리 후 커밋.

---

## 라우터 결정

- **실행(9)**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract
- **제외(5)**: performance, dependency, database, concurrency, user_guide_sync
- **강제 포함(router_safety, 7)**: documentation, maintainability, requirement, scope, security, side_effect, testing
