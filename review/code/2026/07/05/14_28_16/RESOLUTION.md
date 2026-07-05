# RESOLUTION — V-04 folder guard ai-review (14_28_16)

## 조치 항목
| # | 발견 | 조치 |
|---|---|---|
| testing WARNING×4 | 경계값·형제다중 BFS·mock정확도·parentId undefined 커버리지 갭 | 경계값(정확히 depth5 통과)·형제 다중 서브트리(BFS 다중 frontier→cycle) 테스트 2개 추가(folders.service 16 passed). mock 정확도는 e2e(235 실 DB)로 보완, parentId undefined 는 기존 "renames without parent change" 테스트가 커버 |
| api_contract WARNING | 3 실패사유 message 로만 구분(details 미구조화) | 조치 불요 — create() depth 검증·`VALIDATION_ERROR` 표준과 일관, details 구조화는 프로젝트 컨벤션 아님 |
| requirement/plan_coherence INFO | plan V-04 checkbox 미갱신 | plan spec-code-cross-audit V-04 [x] 완료 처리 |
| maintainability/documentation INFO | getDepth +1 근거·throw 중복·@ApiBadRequestResponse 비대칭·CHANGELOG | 비차단, 미조치(현 규모 적정) |

## TEST 결과
- lint: 통과
- unit: 통과 (folders.service 16 passed)
- build: 통과 (직전 — 본 조치는 테스트/plan 만, 프로덕션 코드 무변경)
- e2e: 통과 235 (직전 — 프로덕션 코드 무변경이라 회귀 없음)

## 보류·후속 항목
- 없음 (V-04 완결). 잔여 V-05·V-09 등 major/minor 는 별도 결정.
