# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] 파일 1-2 (execution-engine.service.spec.ts, execution-engine.service.ts) — 범위 내
- **위치**: `codebase/backend/src/modules/execution-engine/`
- **상세**: plan `c1-dev-followups-1b.md` §1b-1 이 `assertSameWorkspace` 의 inline `Error` → `WorkflowForbiddenWorkspaceError` typed throw 전환과, 테스트에 `instanceof` 단언 추가(RESOLUTION I-5 반영)를 명시한다. 두 diff 모두 정확히 이 범위만 수정하며 추가 리팩토링 없음.

### [INFO] 파일 3-4 (workflow-errors.spec.ts, workflow-errors.ts) — 범위 내
- **위치**: `codebase/backend/src/modules/execution-engine/`
- **상세**: `WorkflowForbiddenWorkspaceError` 클래스 신설(§1b-1)과 클래스 계약 단위 테스트 추가(RESOLUTION I-4). 추가된 JSDoc은 스펙 좌표·동작 조건을 기술하며, 범위를 벗어난 코드 정리나 기존 클래스 수정은 포함되지 않는다.

### [INFO] 파일 5 (ai-agent.handler.ts) — 범위 내, 주석 언어 변경 확인
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1489, L2410
- **상세**: plan §1b-2 가 지정한 두 인라인 타입 선언(L1488·L2413)만 `LlmCallRecord[]` 로 교체한다. 추가된 주석("Canonical shared trace type (C-1 follow-up ③ / dev 1b).") 은 기존 RESOLUTION I-9 에 따라 영어 단독으로 통일되었으며 내용은 적절하다. 범위 외 기존 코드 수정 없음.

### [INFO] 파일 6 (error-codes.ts) — 범위 내
- **위치**: `codebase/backend/src/nodes/core/error-codes.ts`
- **상세**: plan §1b-1 이 명시한 `WORKFLOW_FORBIDDEN_WORKSPACE` enum 등재만 수행. 추가된 JSDoc 블록 주석은 동일 파일 다른 enum 항목과 동일한 스타일이며 범위 이탈 없음.

### [INFO] 파일 7-8 (workflow.handler.spec.ts, workflow.handler.ts) — 범위 내
- **위치**: `codebase/backend/src/nodes/flow/workflow/`
- **상세**: plan §1b-1 이 명시한 `instanceof WorkflowForbiddenWorkspaceError` 분기 추가와, RESOLUTION I-7 에 따른 음성 테스트(over-match 방지) 포함 4개 테스트 케이스 추가. defensive backstop 인라인 주석도 §1b-1 의도를 정확히 설명한다.

### [INFO] 파일 9 (output-shape.ts) — 범위 내, rename 이력 주석 확인
- **위치**: `codebase/frontend/src/components/editor/run-results/output-shape.ts`
- **상세**: plan §1b-3 의 `TurnDebugEntry` → `TurnRagDelta` rename (4 refs, 1파일). RESOLUTION I-10 에 따라 인터페이스 JSDoc 에 rename 이력 주석이 추가되었다. 범위 외 수정 없음.

### [INFO] 파일 10 (plan/complete/c1-engine-split.md) — diff 생략됨, 완전 검증 불가
- **위치**: `plan/complete/c1-engine-split.md`
- **상세**: diff 가 "omitted due to prompt size limit" 으로 생략되어 전체 변경 내용을 확인할 수 없다. 이전 scope 리뷰(22_49_28/scope.md)는 "c1-engine-split Gate C 이동" 으로 범위 내 평가했으며, 본 리뷰에서도 범위 이탈 징후 없음. 단, diff 미확인이므로 INFO 수준으로 기록.

### [INFO] 파일 11 (plan/complete/c1-pr2-aiturn-blueprint.md) — 신규 완료 plan 파일, 범위 내
- **위치**: `plan/complete/c1-pr2-aiturn-blueprint.md`
- **상세**: C-1 PR2 청사진 신규 파일로 PR2(PR #625) 완료 아카이브 목적. CLAUDE.md 정책상 완료 작업은 `plan/complete/` 에 기록하는 것이 정책이다. 코드·spec 변경 미포함, 기능적 범위 이탈 없음.

### [INFO] 파일 12 (plan/in-progress/c1-dev-followups-1b.md) — 신규 plan 파일, 체크박스 상태 정상
- **위치**: `plan/in-progress/c1-dev-followups-1b.md`
- **상세**: 작업 1b 전체 추적 plan 파일 신규 생성. RESOLUTION I-11 에 따라 `TEST WORKFLOW`·`/ai-review + SUMMARY`·`RESOLUTION.md` 가 체크됐고, `/consistency-check --impl-done` 은 미완(`[ ]`)으로 현재 진행 상태를 정확히 반영한다.

### [INFO] 파일 13-14 (RESOLUTION.md + SUMMARY.md) — 정책 필수 산출물
- **위치**: `review/code/2026/06/19/22_49_28/`
- **상세**: CLAUDE.md 정책상 `/ai-review` 완료 후 SUMMARY·RESOLUTION 은 커밋에 포함해야 한다. 두 파일 모두 지정 경로에 생성되었으며 범위 내.

### [INFO] 파일 15-25 (review/code/22_49_28/ 산출물) — ai-review 에이전트 산출물, 범위 내
- **위치**: `review/code/2026/06/19/22_49_28/` 하위
- **상세**: _retry_state.json, api_contract.md, architecture.md, documentation.md, maintainability.md, meta.json, requirement.md, scope.md, security.md, side_effect.md, testing.md 모두 정책 지정 경로에 생성된 리뷰 산출물이다. 범위 이탈 없음.

### [INFO] 파일 26-31 (review/consistency/21_40_43/ 산출물) — consistency-check --spec 산출물, 범위 내
- **위치**: `review/consistency/2026/06/19/21_40_43/`
- **상세**: SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md 전부 정책 지정 경로에 생성된 일관성 검토 산출물이다. 범위 이탈 없음.

## 요약

전체 31개 파일이 `plan/in-progress/c1-dev-followups-1b.md` 에 명시된 dev 1b 3개 작업(1b-1 `WorkflowForbiddenWorkspaceError` typed error + enum + mapSubWorkflowError 분기, 1b-2 ai-agent `LlmCallRecord[]` 타입 통합, 1b-3 frontend `TurnRagDelta` rename)과 RESOLUTION 조치(I-4/I-5/I-7/I-9/I-10/I-11), plan Gate C 이동, 필수 review 산출물로 구성된다. 의도 이상의 변경, 무관한 리팩토링, 불필요한 기능 확장, 포맷팅 혼입, 무관한 임포트 정리 등 범위 이탈 징후는 발견되지 않는다. 유일한 정보 항목은 `c1-engine-split.md` diff 가 프롬프트 크기 제한으로 생략되어 완전 검증이 불가한 점이나 기능적 우려 없다.

## 위험도

NONE
