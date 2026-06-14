---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
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
- [ ] §1.3 단일 노드 테스트 — **결정 필요**. spec 본문이 이미 "v1 surface 아님(설계 참고용)" 으로 명시. backend 가 `fromNodeId` 부분 실행 시맨틱(트리거/상류 출력 처리)을 구현하지 않아 전용 엔드포인트 설계가 선행돼야 함. 별도 재도입 plan 대상.
- [x] §2.2 테스트 데이터 세트 저장/이름 지정 (2026-06-14, exec-test-dataset PR) — **결정: 유저 귀속 기본(private) + 유저 선택 시 워크스페이스 read-only 공유 + 타 유저는 clone→자기 소유 수정**. 신규 `WorkflowTestDataset` 엔티티(V097, `(workflow_id,owner_id,name)` UNIQUE) + 모듈(service/controller/DTO) + CRUD·clone 엔드포인트(Editor+, 소유자만 수정/삭제). frontend Mock Input 다이얼로그에 "데이터셋으로 저장"(이름+공유옵션)·"데이터셋" 목록(불러오기·복제·삭제) + i18n ko/en. spec §2.2 ✅ + §9 API + R-2.2 + data-model §2.13.2 동기화.
  - [ ] TEST WORKFLOW (lint·unit·build·e2e)
  - [ ] /ai-review (--range origin/main..HEAD)
  - [ ] /consistency-check --impl-done
- [ ] §7 인-에디터 실행 히스토리(패널·캔버스 오버레이) — **로드맵**. spec 본문이 "설계 참고용", 실행 내역은 전용 페이지(`2-navigation/14-execution-history.md`)가 담당하고 에디터 재실행은 Run Results 드로어 Re-run(§10.14)으로 이미 제공. 별도 plan 대상.

## 비고
- §1.2 부분 실행 트리거(우클릭 → 툴바 드롭다운 "Run from Selected") 및 §8/§9 WS·API 명칭 불일치는 spec 본문 패치로 정정 완료 (기능 자체는 구현돼 있어 plan 항목 아님).
- 각 항목의 근거(claim→코드부재)는 audit findings/3-workflow-editor.md 참조.
