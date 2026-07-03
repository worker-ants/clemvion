# Resolution — 06 concurrency 잔여 배치 (M-3/M-6/m-3/m-5)

원본 리뷰: `review/code/2026/07/03/21_48_56/SUMMARY.md` (Risk LOW).
초기 Workflow 실행에서 scope·side_effect·testing 3개 reviewer 는 success 로 기록됐으나 출력 파일이 디스크에 유실 → 직접 Agent 로 재실행하여 3개 결과 복구(`scope.md`·`side_effect.md`·`testing.md`).

## 처리 결과

| 심각도 | 발견 | 위치 | 조치 |
|--------|------|------|------|
| WARNING (testing) | `handleUnsubscribe` 의 `leave()` 실패(best-effort 성공 계약) 회귀 테스트 누락 — `handleSubscribe` join 롤백은 커버됐으나 대칭 경로 미검증 | `websocket.gateway.spec.ts` | **FIXED** — `'should still ack success when leave() rejects (best-effort)'` 테스트 추가: `leave.mockRejectedValueOnce` 시 throw 없이 `success:true` 응답 + 구독 집합 제거 단언. unit 7537→7538 PASS |

## INFO (조치 불요 — 기록만)

- **maintainability**: `handleSubscribe` 응집도(8+ 분기)·에러 리터럴 3중복·dismiss `1000`ms 매직넘버 — 선택적 리팩토링, 이번 저위험 배치 범위 밖. 후속 여유 시 helper/상수 추출 고려.
- **api_contract / side_effect**: join 실패 신규 ack(`success:false` + `'Subscription failed — please retry'`)를 frontend `WsClient.subscribe()` 가 ack 콜백 없이 fire-and-forget 이라 미소비 — **pre-existing 패턴, 이번 diff 회귀 아님**. join 실패를 UX 신호로 쓰려면 별도 후속(ack 콜백/REST fallback 트리거)이 필요하나 현 스코프 밖.
- **architecture**: `handleSubscribe`(join 원자성) vs `handleDisconnect`(leave fire-and-forget) 비대칭 — 의도된 설계(주석 근거 명확, socket.io disconnect auto-leave). 조치 불요.
- **security/performance**: join/leave await 는 in-memory adapter 하 무해. Redis adapter 도입 시 timeout(Promise.race)·credential 노출 별도 점검 — 도입 시점 후속.
- **testing (INFO)**: hysteresis/dedup 테스트가 구현 세부(off 카운트) 결합 — 회귀 가드로는 유효, 완화는 선택.

## 검증

- lint·unit(backend **7538**·frontend 237 파일)·build·e2e(226) PASS.
- spec 무변경 (robustness-only).
- fresh /ai-review 로 WARNING 해소 커밋 재검토 예정.
