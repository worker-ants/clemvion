# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] persistUserTurn 내 appendMessage → setTitleIfEmpty 비원자 순서 — pre-existing
- 위치: `assistant-turn-persistence.service.ts` lines 540–548
- 상세: `appendMessage` 완료 후 조건부로 `setTitleIfEmpty`를 호출하는 두 단계 DB 기록이 원자 트랜잭션 없이 순차 await로 이루어진다. 두 호출 사이에 장애가 발생하면 user 메시지는 저장되고 title 은 미갱신 상태로 남는다. 단, `setTitleIfEmpty`는 명칭 그대로 idempotent이고 title 누락은 UX 상 허용 가능한 수준이므로 실제 데이터 정합성 위험은 낮다. 이 패턴은 이번 변경 전 `WorkflowAssistantStreamService` 에 동일하게 존재하던 것을 verbatim 이동한 것이므로 신규 도입이 아니다.
- 제안: 변경 범위 외. 현재 idempotent 설계가 충분한 방어이므로 별도 트랜잭션 래핑은 필수가 아니나, 향후 title 설정 실패가 문제 될 경우 두 호출을 단일 트랜잭션으로 묶거나 best-effort 로그를 추가하는 것을 고려할 수 있다.

### [INFO] async generator 스트림 루프 내 순서 의존 persist — pre-existing
- 위치: `workflow-assistant-stream.service.ts` — `streamMessage` 내 `persistUserTurn` → 루프 내 4회 `persistAssistantTurn` 호출
- 상세: persist 호출이 `while(true)` async generator 루프 안에서 순서대로 await되므로 루프 재진입 전 이전 persist가 완료됨이 보장된다. 병렬 fan-out 없이 단일 caller 시퀀스로 진행되어 경쟁 조건이 없다. 이 구조 역시 리팩토링 전과 동일하다.
- 제안: 해당 없음.

## 요약

이번 변경(`AssistantTurnPersistenceService` 분리)은 기존 `WorkflowAssistantStreamService`의 persist 메서드를 무상태 collaborator로 verbatim 이동한 순수 구조 리팩토링이다. 신규 공유 가변 상태, 락, 병렬 호출 경로가 도입되지 않았으며 async/await 체인의 순서와 원자성도 이전과 동일하게 유지된다. 유일하게 주목할 패턴(`appendMessage` → `setTitleIfEmpty` 비원자 순서)은 이미 기존 코드에 존재하던 pre-existing 사항으로, 이번 변경이 위험을 증가시키지 않았다. 동시성 관점에서 신규 위험 없음.

## 위험도

NONE
