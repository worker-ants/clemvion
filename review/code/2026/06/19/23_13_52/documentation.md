# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] WorkflowForbiddenWorkspaceError JSDoc — executeSync 비-canonical 명칭 혼입
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L75–78 (신규 클래스 JSDoc)
- 상세: JSDoc 에 "`executeInline` / `executeSync` / `executeAsync` 진입에서 발생"이라고 기재되어 있으나, `executeSync` 는 `spec/4-nodes/2-flow/1-workflow.md §4` 에 없는 비-canonical 명칭이다. 이전 리뷰(22_49_28 I-8 disposition)에서 "정확 — sibling WorkflowNotFoundError JSDoc 도 동일하게 executeSync 명시"라고 수용되었으나, spec canonical 명칭과의 불일치가 문서 독자에게 혼동을 줄 수 있다.
- 제안: JSDoc 에서 `executeSync` 를 제거하거나 괄호 보조 설명으로 전환. (이전 리뷰에서 disposition 처리됨 — 차단 수준 아님.)

### [INFO] error-codes.ts WORKFLOW_FORBIDDEN_WORKSPACE 주석 — fallthrough 제거 사실 미기술
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` L61–66
- 상세: 인라인 주석이 W-6 맥락·spec 좌표·deny-by-default 를 잘 기술하고 있다. 단, `mapSubWorkflowError` 의 typed branch 로 직접 surface 되어 더 이상 `SUB_WORKFLOW_FAILED` 로 fallthrough 하지 않는다는 사실이 주석에 반영되지 않아, 이전 동작(fallthrough)을 아는 독자가 혼동할 여지가 있다.
- 제안: "Surfaced at the Sub-Workflow node's error port via `mapSubWorkflowError` typed branch (no longer falls through to `SUB_WORKFLOW_FAILED`)." 한 줄 보강 (선택적, 비차단).

### [INFO] ai-agent.handler.ts 인라인 주석 언어 혼용 — 한국어 괄호 잔존
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1489–1490, L2408–2409 (diff 기준)
- 상세: RESOLUTION.md I-9 에서 영어 통일 조치를 완료로 기록했으나, 현재 diff 에서 "// Canonical shared trace type (C-1 후속 ③ / dev 1b)." 한국어 괄호 병기("C-1 후속 ③")가 잔존한다. 동일 파일의 기존 주석("// Per-call trace so the frontend LlmInformationTab can inspect each")은 영어 단독이다.
- 제안: 두 위치 모두 "// Canonical shared trace type (C-1 follow-up ③ / dev 1b). The shared type is // an all-optional superset; the push sites below always supply every field." 로 영어 단독 통일.

### [INFO] output-shape.ts TurnRagDelta — rename 이력 주석 추가됨 (개선 확인)
- 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` L307–316
- 상세: 이전 리뷰(22_49_28 I-10)의 권고에 따라 `TurnRagDelta` 인터페이스 JSDoc 에 rename 이력 주석이 추가되었다("formerly `TurnDebugEntry` — conversation-utils.ts 의 canonical-shaped TurnDebugEntry 와의 동명 충돌 해소를 위해 rename. dev 1b."). 문서화 개선이 반영된 것이다.
- 제안: 없음. 현행 유지.

### [INFO] workflow-errors.spec.ts 신규 describe 블록 — JSDoc 주석 충실
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.spec.ts` L123–148 (신규 블록)
- 상세: 신규 `describe('WorkflowForbiddenWorkspaceError 클래스 계약 (W-6)', ...)` 블록에 JSDoc 블록 주석이 추가되어 plain Error 계층 여부, mapSubWorkflowError 매핑 경로, 본 블록의 검증 범위를 명확히 기술한다. 테스트 문서화 패턴으로 바람직하며 이전 리뷰(I-4) 권고를 충족한다.
- 제안: 없음.

### [INFO] plan/in-progress/c1-dev-followups-1b.md — /consistency-check 체크박스 미완료
- 위치: `plan/in-progress/c1-dev-followups-1b.md` (신규 파일)
- 상세: 파일 기준 `/ai-review + SUMMARY` 와 `RESOLUTION.md` 항목은 `[x]` 완료 표기이나, `/consistency-check --impl-done` 항목은 `[ ]` 미체크 상태다. 이 리뷰가 두 번째 ai-review 세션임을 고려하면 이 리뷰 완료 후 체크박스 갱신이 필요하다. MEMORY 규약 "plan 체크박스 = 실제 상태" 준수 필요.
- 제안: 본 ai-review(23_13_52) 완료 후 plan 파일의 체크박스를 최신 상태로 갱신하여 커밋.

### [INFO] plan/complete/c1-pr2-aiturn-blueprint.md — 청사진 라인 번호 고착화 위험
- 위치: `plan/complete/c1-pr2-aiturn-blueprint.md` L19–28 (메서드 테이블)
- 상세: 청사진 문서에 메서드별 구체적 라인 번호가 기재되어 있다(예: "4451–4470", "5483–5531"). 파일이 `plan/complete/` 역사 기록 위치에 있으므로 자체 문제는 없으나, 이후 독자가 실제 코드와 대조 시 라인이 달라져 혼동할 수 있다.
- 제안: `plan/complete/` 역사 문서로서 현행 유지 가능. 필요 시 상단에 "(PR1 적용 후 기준 라인 번호 — 이후 리팩토링으로 변경됨)" 명시.

## 요약

이번 변경셋은 전반적으로 문서화 품질이 양호하다. `WorkflowForbiddenWorkspaceError` 클래스에는 spec 좌표·동작 조건·throw 지점을 명확히 기술한 JSDoc 이 갖춰져 있고, `error-codes.ts` 인라인 주석도 W-6 맥락을 충실히 담고 있다. 이전 리뷰(22_49_28) 의 INFO 권고사항 대부분이 반영되어 있어(TurnRagDelta rename 이력 주석 추가, workflow-errors.spec.ts 클래스 계약 describe 추가 등) 주목할 만한 문서화 개선이 이루어졌다. 잔존 관찰 사항은: (1) JSDoc 의 `executeSync` 비-canonical 명칭(이전 리뷰에서 disposition 처리됨), (2) ai-agent.handler.ts 주석의 한국어 괄호 잔존("C-1 후속 ③"), (3) error-codes.ts 에서 fallthrough 제거 사실 미기술, (4) plan 체크박스 최신 반영 필요 — 모두 INFO 수준으로 기능·보안에 영향을 주지 않으나 장기 유지보수성 관점에서 권장된다. Critical 또는 Warning 수준의 문서화 결함은 발견되지 않았다.

## 위험도

LOW
