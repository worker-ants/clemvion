# Code Review 통합 보고서

## 전체 위험도

**LOW** — 신규 CRITICAL/실질 코드 결함 없음. 이번 라운드의 유일한 실제 코드 변경(`propagateContainerInMap` SoT 상수 3번째 호출부 완성, 커밋 `12ea43d7a`)은 behavior-preserving 이며 6개 reviewer 전원이 이를 직접 대조·검증해 이상 없음을 확인했다. 다만 harness diff-list 갭이 3회 연속(19_42_07 → 20_02_41 → 20_16_42) 재발한 review-infra 신뢰성 문제가 WARNING 으로 남아 있다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Review-Infra(harness) | harness diff-list 갭이 3회 연속(19_42_07 → 20_02_41 → 20_16_42) 재발 — 실제 최신 커밋(`12ea43d7a`, `editor-store.ts` `propagateContainerInMap` 의 `'body'`/`'emit'` 리터럴→SoT 상수 치환 4줄)이 이번 payload 에도 포함되지 않음. 6개 reviewer 전원이 `git show`/`grep` 으로 작업 트리를 직접 대조해 우회 검증했으나(behavior-preserving 확인, 결함 없음), 이 갭이 지속되면 향후 라운드에서 실제 결함이 조용히 스킵될 위험이 누적됨(직전 라운드가 이미 "이번엔 실제 수정 권고" 로 escalate 했음에도 미조치) | `review/code/2026/07/13/20_16_42/_prompts/*.md`(payload 파일 1~26 전부 review 산출물·spec 문서뿐, `codebase/**` 소스 0개) | orchestrator 의 diff-base 산출 로직(어떤 커밋 범위를 payload 에 번들링하는지)을 이번 라운드에서 실제로 수정할 것 — 이미 2회 이상 권고에도 미조치 상태 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 커버리지 | `propagateContainerInMap` Rule 2(emit 핸들) 분기가 `removeEdge→deriveContainerAssignments` 경로에서 직접 단언하는 테스트가 없음(로직 무변경 리팩터라 실질 리스크는 낮음) | `codebase/frontend/src/lib/stores/editor-store.ts:477` | 비차단. 여유 있을 때 "컨테이너 loopback(emit) 엣지 제거 시 source 의 containerId 재도출" 테스트 1건을 추가해 Rule 1/Rule 2 대칭 커버리지 완성 |
| 2 | 유지보수성(구조적 중복, 선재) | `detectContainerConflict`/`propagateContainerOnConnect`/`propagateContainerInMap` 3개 함수가 동일한 body/emit/chain 3규칙 로직을 각각 독립 재구현(이번 diff 가 도입한 패턴 아님, JSDoc 상호참조로 의도적 미러링임을 문서화) | `codebase/frontend/src/lib/stores/editor-store.ts` 245-291, 303-360, 454-511행 | 차단 사유 아님. 장기적으로 "3규칙 판정"을 순수 함수 하나로 추출해 세 함수가 결과만 소비하도록 리팩터링 고려(이번 PR 스코프 아님) |
| 3 | 아키텍처(장기 개선) | `withUndoCheckpoint` 류 상위 헬퍼로 undo 경계를 중앙화하는 구조적 개선 미착수 — 개별 사례 수정(`buildAndAddNode`)만 이뤄짐 | `spec/3-workflow-editor/2-edge.md` Rationale R-3 | 조치 불요(이월 합의됨). `task_89a0d3a2` 로 노드 복제 경로의 동일 결함이 별도 추적 중 |
| 4 | 테스트 커버리지(이월) | "노드 복제"(우클릭) 시 `handleNodeMenuAction` `pushUndo()` + `addNode` 내부 무조건 `pushUndo()` 이중 호출(phantom-undo) 이 코드에 그대로 남아 있고 여전히 무테스트 — 다만 backlog 등록(`task_89a0d3a2`)은 이번 라운드에 canonical plan 위치로 확인됨 | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:451,472`; `codebase/frontend/src/lib/stores/editor-store.ts:839-840` | 조치 불요(추적 확인됨). 향후 `task_89a0d3a2` 이행 시 회귀 테스트 동반 권고 |
| 5 | 테스트 커버리지(이월) | `onDrop`(workflow-canvas.tsx) DOM 배선에 대한 통합/e2e 테스트 부재 — 기존 합의로 이월, 이번 changeset 이 새로 만든 갭 아님 | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` | 조치 불요(기존 이월 합의), 우선순위 낮음 |
| 6 | 문서(tracking fatigue) | 5회 연속(consistency-check `18_06_53` 포함) 동일한 non-blocking 각주 2건이 이번 라운드에도 미반영 | `spec/3-workflow-editor/0-canvas.md` §3.3 ↔ `2-edge.md` §4/§4.1 상호참조 각주; `1-node-common.md`/`2-edge.md` §3.1 "컨테이너 포트=보라" 대상 구분 각주 | 여전히 비차단이나, 이 changeset(spec-sync-edge-gaps 5 surface)이 사실상 종결 단계이므로 이번 기회에 실제 반영하거나 "확정 보류"로 명시해 반복 이월을 매듭짓기를 권고 |

### 확인됨 (문제 없음)

- 컨테이너 경계 핸들 SoT 상수화(`CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE`)가 `detectContainerConflict`/`propagateContainerOnConnect`/`propagateContainerInMap` 3개 호출부 전부에 완성됨 — `editor-store.ts` 전체에서 `body`/`emit` 리터럴 0건(직접 grep 확인). spec R-3 "hidden coupling 제거" 서술과 코드가 완전히 일치(architecture/requirement/maintainability/testing/documentation 5개 reviewer 독립 재확인).
- backlog 추적성 해소 — `task_78c80fec`(엣지 분할 드롭 시각 프리뷰), `task_89a0d3a2`(노드 복제 phantom-undo 감사) 둘 다 `plan/complete/spec-sync-edge-gaps.md` 비고 섹션에 canonical 등록 확인.
- 최신 커밋(`12ea43d7a`)은 값이 동일한 리터럴→상수 치환뿐인 behavior-preserving 순수 리팩터. `npx vitest run edge-utils.test.ts editor-store.test.ts` 직접 실행 결과 158/158 통과(회귀 없음), Rule 1 분기는 `editor-store.test.ts:308` 이 실제 경로로 이미 커버.
- `review/**` 산출물의 절대경로(worktree 경로) 커밋은 기존 관행과 일치하는 이력성 아티팩트로, 신규 side-effect 아님.
- CHANGELOG 가 behavior-preserving 내부 리팩터(SoT 상수화)를 개별 언급하지 않는 것은 "사용자/동작 영향 변경만 기재"하는 기존 관례와 일치, 결함 아님.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | LOW | harness diff-list 갭 3회 연속 재발(WARNING) 외에는 SoT 상수화 3개 호출부 완성·backlog 추적성 해소 재확인, 신규 아키텍처 결함 없음 |
| requirement | LOW | harness gap WARNING 재확인 + spec §4.1/R-3 서술과 코드 line-level 완전 일치 확인, phantom-undo 잔존 결함은 스코프 밖·추적 확인 |
| side_effect | NONE | 최신 커밋이 behavior-preserving 순수 리팩터임을 직접 검증, 신규 부작용 없음 |
| maintainability | NONE | SoT 상수화 완성 확인, 3개 형제 함수의 구조적 중복(선재, 비차단)만 참고로 재상기 |
| testing | NONE | 158/158 테스트 통과 직접 재확인, Rule 2 대칭 테스트 미비(비차단)만 잔존 |
| documentation | NONE | spec-코드 완전 일치 확인, 5회 연속 이월된 non-blocking 각주 2건만 tracking fatigue 로 재상기 |

## 발견 없는 에이전트

없음 (6개 에이전트 전원 최소 1건 이상의 INFO/WARNING 발견사항을 보고했으며, 그중 다수가 "문제 없음 확인" 성격).

## 권장 조치사항

1. orchestrator 의 diff-base 산출 로직을 실제로 점검·수정한다 — 3회 연속 재발한 harness diff-list 갭으로, 2회 이상 명시적으로 권고됐음에도 미조치 상태다(review-infra 신뢰성 문제, WARNING #1).
2. spec 문서의 5회 연속 이월된 non-blocking 각주 2건(0-canvas §3.3↔2-edge §4.1 상호참조, 컨테이너 포트 색상 대상 구분)을 이번 changeset 종결 시점에 실제 반영하거나 "확정 보류"로 명시해 매듭짓는다.
3. (낮은 우선순위, 비차단) `propagateContainerInMap` Rule 2(emit) 분기에 대한 대칭 테스트 1건 추가를 고려한다.
4. (장기, 비차단) `withUndoCheckpoint` 류 중앙화 헬퍼, 3개 형제 함수의 구조적 중복 추출은 별도 backlog(`task_89a0d3a2` 등)로 계속 추적한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `architecture, requirement, side_effect, maintainability, testing, documentation` (6명)
  - **강제 포함(router_safety)**: `architecture, documentation, maintainability, requirement` — 문서 파일(`review/**`, spec 등) 변경 및 `spec/3-workflow-editor/2-edge.md` 본문 변경에 따른 요구사항 일관성 검증 필요로 강제 포함
  - **제외**: 아래 표 (8명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | security | 이번 diff 범위(review 산출물·spec 문서·behavior-preserving 리팩터)에 보안 관련 변경 없음으로 router 판단 |
  | performance | 성능 영향 있는 변경 없음으로 router 판단 |
  | scope | 스코프 이탈 위험 있는 변경 없음으로 router 판단 |
  | dependency | 의존성 변경 없음으로 router 판단 |
  | database | DB 관련 변경 없음으로 router 판단 |
  | concurrency | 동시성 관련 변경 없음으로 router 판단 |
  | api_contract | API 계약 변경 없음으로 router 판단 |
  | user_guide_sync | 사용자 가이드 동기화 대상 변경 없음으로 router 판단 |