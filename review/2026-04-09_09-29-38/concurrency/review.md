### 발견사항

- **[INFO]** `POLL_INTERVAL_WAITING_MS` 10000ms → 2000ms 변경
  - 위치: `use-execution-events.ts` — `POLL_INTERVAL_WAITING_MS` 상수
  - 상세: `waiting_for_input` 상태에서의 폴링 간격이 10초에서 2초로 단축됨. `pollExecutionStatus`가 2초 이내에 완료되지 않을 경우(느린 네트워크 환경), 폴링 구현 방식이 `setInterval` 기반이라면 복수의 폴링 요청이 동시에 인-플라이트 상태가 될 수 있음. `setTimeout` 재귀 방식이라면 문제없으나, 구현을 확인할 필요 있음. 또한 사용자 입력 대기 중에도 서버 부하가 5배 증가함.
  - 제안: `cancelledRef` 체크와 함께 이전 폴링 완료 후에만 다음 폴링을 스케줄링하는 재귀 `setTimeout` 패턴이 적용되어 있는지 확인. 필요시 인-플라이트 요청 추적 플래그(`isPollingRef`) 추가 고려.

- **[INFO]** `execution-store.ts` 세 개의 waiting setter에 `selectedResultNodeId` 추가
  - 위치: `execution-store.ts` — `setWaitingForForm`, `setWaitingForButtons`, `setWaitingForConversation`
  - 상세: 각 `set()` 호출 내에서 여러 필드를 한 번에 업데이트함. Zustand의 `set()`은 단일 호출 내 변경을 원자적으로 처리하므로, 중간 상태 노출 문제는 없음. 다만 두 개의 waiting setter가 매우 짧은 간격으로 연속 호출될 경우(예: 빠른 노드 전환) 두 번째 `set()`이 첫 번째를 덮어쓰는 것은 의도된 동작인지 확인 필요.
  - 제안: 현재 구현은 정상. 특이 케이스 없음.

- **[INFO]** `carousel.handler.ts` — `buttonItemMap` 빌드 후 `execute()` 내 동기 처리
  - 위치: `carousel.handler.ts` — `execute()` 메서드 내 `buttonItemMap` 구성 루프
  - 상세: `allButtons` 배열과 `buttonItemMap` 객체가 단일 동기 루프에서 구성됨. NestJS 요청 핸들러 맥락에서 해당 객체들은 요청 스코프 내 로컬 변수이므로 공유 상태 접근 없음. 동시성 위험 없음.
  - 제안: 해당 없음.

---

### 요약

이번 변경사항은 대부분 단일 요청 스코프 내의 동기적 데이터 변환(캐러셀 버튼 라우팅, `_selectedPort` 제거, `buttonItemMap` 구성) 또는 표준 async/await 패턴에 해당하며, 전통적인 동시성 문제(데드락, 뮤텍스, 공유 상태 경쟁)와는 무관하다. 가장 주목할 변경은 `POLL_INTERVAL_WAITING_MS`의 10초→2초 단축으로, 폴링 구현이 `setInterval` 기반인 경우 느린 네트워크에서 중복 요청이 발생할 수 있으나, `setTimeout` 재귀 방식이 적용되어 있다면 실질적 위험은 없다.

### 위험도
**LOW**