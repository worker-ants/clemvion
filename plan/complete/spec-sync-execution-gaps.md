---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
status: complete
spec_impact:
  - spec/3-workflow-editor/3-execution.md
---

# execution — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/3-workflow-editor/3-execution.md
> 주의: §6 브레이크포인트/단계 실행은 spec 본문·Rationale 에서 이미 "향후 로드맵(미구현)" 으로 분리돼 있으므로 본 plan 범위 밖 (별도 재도입 plan 대상). 본 plan 은 implemented 로 단정됐으나 실제 부재한 surface 만 추적한다.

> **구현 진척 (2026-06-14, impl-execution-editor-gaps PR)**: 결정 불필요(decision-free) 항목 처리.
> §10.12 단축키 풀(frontend) + §2.2 실시간 JSON 검증·히스토리 로드(기존 executions API 재사용) 구현.
> §1.3·§7·§2.2-저장은 아래대로 로드맵/결정 대기로 재분류(§6 와 동일 처리) — 본 PR 미포함.

## 구현 완료 (decision-free)
- [x] §2.2 Mock Input — 실시간 JSON 검증(무효 시 인라인 오류 + Run 비활성) + "Load from History"(이전 실행 `inputData` 적재, `GET /executions/workflow/:id` + `GET /executions/:id` 재사용). `editor-toolbar.tsx`. 테스트: `editor-toolbar-run-input.test.tsx`.
- [x] §10.12 단축키 — Ctrl+Shift+R 드로어 펼침/접힘 토글(브라우저 하드 리로드 preventDefault), Escape(드로어 포커스 시) 캔버스 복귀(편집 필드는 양보). 드로어 펼침 상태를 `execution-store.drawerExpanded` 로 승격. `workflow-editor.tsx`/`run-results-drawer.tsx`. 테스트: `execution-store.test.ts`·`workflow-editor-shortcuts.test.ts`.

## 로드맵 / 결정 대기 (본 plan 활성 범위에서 분리 — §6 와 동일)
- [x] §1.3 단일 노드 테스트 (2026-06-15, exec-single-node PR) — **결정: 입력=직전 실행(previousExecutionId) 상류 노드 출력 자동 주입(미지정 시 수동 입력) + 단일 노드만 실행(downstream 미진행) + 전용 엔드포인트**. `POST /api/workflows/:id/nodes/:nodeId/execute`(body `{ previousExecutionId?, input? }`), Execution `single_node_id`/`previous_execution_id` 컬럼(V098), `runExecution` single-node 분기(대상 노드만 seed·break·predecessor 출력 복원), frontend 우클릭 "이 노드 실행"+InfoTab 결과+i18n. spec §1.3 v1 승격 + §9 + R-1.3, replay-rerun §15 C3 재조정, 1-data-model §2.13, 4-execution-engine §11/§6.1.
  - [x] TEST WORKFLOW (lint·unit·build·e2e) — 전 단계 PASS (e2e 202, 단일실행 F/노드오류 G/prev오류 H 포함)
  - [x] /ai-review (15_05_56) Critical 0/Warning 18 → resolution fix(W-6/7/9/13/14 등)+DEFER(W-1/2/3/5/8/10/18 근거) → fresh review(15_29_28) Critical 0·Warning 2(비-defect accept) 수렴
  - [x] /consistency-check --impl-done (15_36_35) — BLOCK: NO (5 checker 전원 비차단)
- [x] §2.2 테스트 데이터 세트 저장/이름 지정 (2026-06-14, exec-test-dataset PR) — **결정: 유저 귀속 기본(private) + 유저 선택 시 워크스페이스 read-only 공유 + 타 유저는 clone→자기 소유 수정**. 신규 `WorkflowTestDataset` 엔티티(V097, `(workflow_id,owner_id,name)` UNIQUE) + 모듈(service/controller/DTO) + CRUD·clone 엔드포인트(Editor+, 소유자만 수정/삭제). frontend Mock Input 다이얼로그에 "데이터셋으로 저장"(이름+공유옵션)·"데이터셋" 목록(불러오기·복제·삭제) + i18n ko/en. spec §2.2 ✅ + §9 API + R-2.2 + data-model §2.13.3 동기화.
  - [x] TEST WORKFLOW (lint·unit·build·e2e) — 전 단계 PASS (e2e 199/199, dataset DELETE invariant G 포함)
  - [x] /ai-review (--range merge-base..HEAD) — 4회 fresh review 모두 Critical 0. 실질 발견 fix1/fix2 조치(IDOR 오탐·copyName·Swagger·유저가이드·DTO 계약). #610 발 main Gate C breakage 는 fix3(spec_impact) 복구. 잔여는 테스트커버리지·문서 nit → RESOLUTION(12_10_03) accept/defer.
  - [x] /consistency-check --impl-done (12_18_43) — BLOCK: NO. 잔여 W-1(ForbiddenException FORBIDDEN 코드 중복)·W-2(DUPLICATE_NAME 전역 카탈로그 미등록)는 에러코드 컨벤션 nit — 프론트가 해당 code 로 분기하지 않아 저위험, 전역 카탈로그 등록은 후속 defer.
- [x] §7 인-에디터 실행 히스토리(패널·캔버스 오버레이) (2026-06-16, exec-history-panel PR) — **frontend-only, 결정: 로드맵 승격 + 기존 API 재사용(`GET /executions/workflow/:id` 목록 + `GET /executions/:id` 상세) + 신규 backend/엔티티 없음**. 더보기(⋮) → "실행 히스토리" 모달 패널(`run-results/execution-history-panel.tsx`): 최근 20건 목록(상태/트리거/소요/노드수/상대시각). 항목 클릭 → `loadHistoricalExecution`(신규 store action `startHistoryView` + 기존 `applyExecutionSnapshot` 재사용)으로 드로어 타임라인 + 캔버스 `nodeStatuses` 오버레이 적재(§10.10). "이 입력으로 다시 실행" 은 드로어 Re-run(§10.14) 재사용. i18n ko/en. spec §7 v1 승격 + R-7, frontmatter `status: implemented` 복귀(추적 surface 전건 해소). 엣지 데이터 미리보기는 라이브에도 미구현이라 v1 제외.

## 비고
- §1.2 부분 실행 트리거(우클릭 → 툴바 드롭다운 "Run from Selected") 및 §8/§9 WS·API 명칭 불일치는 spec 본문 패치로 정정 완료 (기능 자체는 구현돼 있어 plan 항목 아님).
- 각 항목의 근거(claim→코드부재)는 audit findings/3-workflow-editor.md 참조.
