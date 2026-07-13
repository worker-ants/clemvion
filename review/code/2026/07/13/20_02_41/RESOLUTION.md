# Resolution — edge §4.1 엣지 분할 ai-review 5회차 (2026-07-13 20:02)

원 위험도 **LOW** (CRITICAL 0 + WARNING 4). documentation disk-write gap journal 복구 → NONE. 코드 실질 WARNING 2건 반영, 나머지 2건은 review-infra(코드 무관).

## Warning

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | 유지보수성/아키텍처 | SoT 상수화(4회차)가 3개 호출부 중 2개에만 적용 — `propagateContainerInMap`(editor-store.ts:472/477, `deriveContainerAssignments` 경로)이 **작은따옴표** `'body'`/`'emit'` 를 재하드코딩(4회차 replace_all 이 큰따옴표만 잡아 누락). 값 일치라 기능 회귀는 없으나 SoT 미완 | **반영** — 472/477 을 `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 로 치환. editor-store 내 body/emit 리터럴 0건 확인(3 사이트 모두 상수화 완료). behavior-preserving(container 테스트 전수 통과). |
| 2 | 프로세스/추적성 | RESOLUTION 이 언급한 `task_89a0d3a2`(노드 복제 phantom-undo)가 canonical plan(`plan/complete/spec-sync-edge-gaps.md` 비고)에 미등록 | **반영** — plan 비고에 `task_78c80fec`(UX 프리뷰)·`task_89a0d3a2`(복제 undo) 둘 다 §4 후속으로 등록. |
| 3 | review-infra | harness diff-list 갭 2회 연속 재발(payload 가 review 산출물·spec 위주, 마지막 커밋 코드 파일 누락) | **코드 무관** — orchestrator diff-base 산출 이슈. architecture·requirement 가 `git diff` 직접 확인으로 우회 검증(결함 0). 본 PR 코드 결함 아님. |
| 4 | review-infra | documentation reviewer disk-write gap | **복구** — journal 에서 전문 복구, 위험도 NONE(spec↔코드 정합·JSDoc·CHANGELOG 확인). |

## 검증
- tsc `--noEmit` clean · edge-utils+editor-store **158 passed** · eslint 0 errors · e2e 44 suites/253(재검증) · fresh `/ai-review` 6회차로 최종 수렴 확인.
