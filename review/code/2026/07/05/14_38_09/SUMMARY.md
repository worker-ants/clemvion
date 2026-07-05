# Code Review (fresh) 통합 — V-04 folder guard (14_38_09)

## 전체 위험도
**LOW** — Critical 0. WARNING 1(testing: 형제다중 테스트가 batched query 미검증). 프로덕션 코드는 이전 세션(14_28_16)과 동일 커밋, 이전 WARNING(security/api_contract/testing) 재발 없음.

## Critical
없음.

## WARNING
| # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| 1 | testing | "형제 다중 BFS" 테스트가 mock call-order 로만 응답해 batched frontier(collectSubtree frontier.map) 를 실제 검증 안 함 — frontier[0] 만 조회하는 mutation 도 통과(이름 overclaim) | **조치** — 해당 테스트에 `find` L2 호출 인자 단언(`toHaveBeenNthCalledWith(2, {where:[{parentId:c1},{parentId:c2}]})`) 추가. 이제 batched frontier 회귀·N+1 를 검출(16 passed) |

## 에이전트별 (전부 clean)
security NONE(DoS fix·IDOR 스코핑) · scope NONE · side_effect NONE · requirement NONE · documentation NONE · maintainability LOW(INFO defer) · testing LOW(WARNING1 조치)

## 판정
Critical 0. WARNING 조치 완료. 프로덕션 로직 무변경(테스트 단언 강화만).
