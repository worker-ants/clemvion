# RESOLUTION — V-05 execution-detail node sub-tabs (16_49_52)

## 조치 항목

| # | Reviewer/위험도 | 발견 | 조치 | 커밋 |
|---|---|---|---|---|
| 1 | requirement / **CRITICAL** | `toNodeResult()` 가 `NodeExecutionData.inputData` 를 `NodeResult` 로 매핑 안 함 → ResultDetail Input 탭이 모든 노드에서 영구 "입력 데이터 로드 중..." placeholder | `toNodeResult` 에 `inputData: ne.inputData` 추가 + 회귀 테스트(완결 노드 Input 탭이 placeholder 아님) | (fix 커밋) |
| 2 | requirement / **CRITICAL** | `toNodeResult()` 가 `startedAt` 미매핑 → ResultDetail 헤더 시작 시각 소실 | `toNodeResult` 에 `startedAt: ne.startedAt` 추가 | (fix 커밋) |
| 3 | side_effect + requirement / WARNING | dry-run 배지가 execution-level fallback 상실 → `_dryRun` 마커 없는 비-effect 노드가 dry-run 실행에서 배지 미표시 | `ResultDetail` 에 optional `executionDryRun?: boolean`(기본 false) prop 추가, 배지 조건 `executionDryRun || isDryRunOutput(...)`. page 가 `execution.dryRun===true` 를 재-전달. 에디터 drawer 미전달→기존 동작 유지. 회귀 테스트 추가 | (fix 커밋) |
| 4 | documentation / LOW | run-results.mdx `code:` 실행 페이지 미등재 + 서브탭 이중 surface 미명시 + CHANGELOG 누락 | CHANGELOG `## Unreleased` 엔트리 추가. mdx(ko/en) frontmatter code + 이중 surface 노트는 user-guide-writer 위임 | (fix 커밋) |
| 5 | maintainability / WARNING | store→ResultDetail props 파생 로직이 page·drawer 두 소비처 중복 | **후속 이관** — 공용 hook(예: `useResultDetailProps`) 추출은 별도 리팩터. 본 PR 은 재사용으로 이미 ~190줄 감소 |
| 6 | cross_spec / WARNING · rationale / INFO | References/Meta/Port/Status 탭이 §3.3 미열거 + Config 탭 viewer 접근(masking 으로 안전)에 대한 §14 Rationale 노트 부재 | **후속 이관(planner)** — spec-doc 완전성. 코드는 이미 §10.6.1(editor spec)이 서술한 탭 집합을 재사용, masking 은 서버 boundary 에서 보편 적용(security LOW 확인). 본 PR 은 코드 변경만 |
| 7 | architecture / INFO | run-results 폴더명이 이중 소유 미반영 | **후속 이관** — 폴더 rename 은 광범위, 저우선 |

## TEST 결과

- lint: 통과 (재수행)
- unit: 통과 (재수행 — execution-detail 10 / editor result-detail 31)
- build: 통과 (재수행)
- e2e: 통과 (재수행)

## 보류·후속 항목

- **maintainability #5**: page·drawer 의 store→props 파생 공용 hook 추출 (별도 리팩터 plan 후보).
- **spec-doc #6 (planner)**: `14-execution-history.md §3.3` 에 References/Meta/Port/Status 탭 열거 + Config 탭 viewer 접근·masking Rationale 노트 (editor `3-execution.md §10.6.1` 과 정합). project-planner 트랙.
- **architecture #7**: `components/editor/run-results` → 공용 위치 rename (저우선).
