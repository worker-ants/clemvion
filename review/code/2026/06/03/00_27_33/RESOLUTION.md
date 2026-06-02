# RESOLUTION — 00_27_33

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1 | 코드(테스트) | 6c8eef0c | use-execution-events.test.ts — optimisticPending 사전 삽입 후 handleUserMessage echo 도달 시 버블 1개 유지 통합 테스트 2건 추가 |
| I-11 | 코드(리팩토링) | 6c8eef0c | execution-store.ts — pendingIdx → optimisticPendingIdx 변수명 명확화 |
| I-14 | 코드(문서) | 6c8eef0c | execution-store.ts — appendOptimisticUserMessage JSDoc 에 reconcile 분기 설명 절 추가 |
| I-8 | 코드(주석) | 6c8eef0c | execution-store.ts — content 기반 매칭 trade-off 인라인 주석 추가 |
| I-9 | 코드(주석) | 6c8eef0c | execution-store.ts — optimisticPending: undefined 할당 (spread 불변 패턴) 이유 주석 추가 |
| I-12 | 코드(테스트) | 6c8eef0c | execution-store.test.ts — reconcile 테스트에 turnIndex 보존 assert 추가 |

## TEST 결과

- lint  : 통과 (0 errors, 3 warnings — 기존 pre-existing)
- unit  : 통과 (3268 passed, 1 skipped / 176 test files)
- build : 통과
- e2e   : 통과 (140 passed, 120s — 사용자가 docker daemon 기동 후 재시도: "도커 데몬 실행했으니 다시 시도해봐")

## 보류·후속 항목

- INFO #I-4: spec §9.7 user_message reconcile 분기 명문화 — project-planner 위임 후보 (spec/ 쓰기 권한 없음, developer 권한 밖)
- INFO #I-15: spec §9.7 spec-impl 미세 설명 차이 — project-planner 위임 후보 (동일 사유)
- INFO #I-1: 서버 에러 메시지 toast 직접 노출 — 중장기 개선 과제, 별도 이슈 추적 권장
- INFO #I-2: content 기반 reconcile 매칭 멀티탭 엣지 케이스 — 향후 확장 시 executionId+메시지 고유 ID dedup 키 고려
- INFO #I-3: requestPayload/responsePayload 민감 데이터 마스킹 정책 문서화 — 별도 이슈 추적 권장
- INFO #I-5/I-13: receivedAt="" + optimisticPending 버블 조합 방어 테스트 — 추가 시 edge-case 커버 향상, 현재 INFO 수준
- INFO #I-6: 동일 content 다중 optimistic bubble 처리 시나리오 테스트 — 현재 INFO 수준
- INFO #I-7: appendOptimisticUserMessage reconcile 분기 순수 헬퍼 함수 분리 — 향후 복잡도 증가 시 리팩토링 권장
- INFO #I-10: 테스트·구현 양쪽 reconcile 배경 설명 주석 중복 — 향후 정리 권장
