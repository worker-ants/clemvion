### 발견사항

- **[INFO]** `buttonItemMap` 빌드 후 조회의 원자성
  - 위치: `execution-engine.service.ts` — `buttonItemMap[buttonId]` 조회
  - 상세: `buttonItemMap`은 요청별 로컬 변수로 생성되어 공유 상태가 아님. 단일 실행 컨텍스트 내에서만 읽히므로 동시성 문제 없음.
  - 제안: 해당 없음.

- **[INFO]** `cancelledRef.current` 체크 위치 — `use-execution-events.ts`
  - 위치: `pollExecutionStatus` 함수, `await executionsApi.getById(executionId)` 이후
  - 상세: 변경 전/후 모두 `await` 직후에 취소 여부를 체크하는 패턴이 유지됨. `response.data` 언래핑 제거는 동작에 영향 없음. 올바른 취소 처리 패턴.

- **[INFO]** `execution-store.ts` — 대기 상태 전환 시 `selectedResultNodeId` 동시 설정
  - 위치: `waitingForForm`, `waitingForButtons`, `waitingForConversation` 세 함수
  - 상세: 각각 Zustand `set()` 호출로 `selectedResultNodeId`를 설정. Zustand의 `set()`은 동기적이며, 워크플로우 실행 흐름상 세 상태가 동시에 진입될 수 없는 구조라 실질적 경쟁 조건 없음.

- **[INFO]** `__item_` 기반 포트 라우팅의 결정론적 분리
  - 위치: `execution-engine.service.ts` — `buttonId.split('__item_')[0]`
  - 상세: 런타임에 생성된 버튼 ID(`${defId}__item_${idx}`)를 파싱하여 원본 포트 ID를 추출. 동시성 문제는 없으나, 버튼 정의 ID가 `__item_`을 포함할 경우 잘못된 포트로 라우팅될 수 있음. 이는 데이터 계약 이슈이지 동시성 이슈는 아님.

- **[INFO]** `POLL_INTERVAL_WAITING_MS` 10000ms → 2000ms 변경
  - 위치: `use-execution-events.ts`
  - 상세: 대기 상태에서의 폴링 간격을 줄여 동시 폴링 요청 빈도가 증가함. 사용자가 여러 탭에서 같은 실행을 동시에 볼 경우 서버 부하가 누적될 수 있으나, 동시성 버그는 아님.

---

### 요약

변경된 코드의 대부분은 요청별 로컬 변수(`buttonItemMap`, `allButtons`, `items`)를 다루거나 순수 UI 상태(Zustand, React `useState`)를 조작하는 코드로, 전통적인 멀티스레드 경쟁 조건이나 데드락과는 무관한 JavaScript 싱글스레드 환경이다. 백엔드 핸들러(`carousel.handler.ts`, `execution-engine.service.ts`)의 변경사항은 모두 실행별 격리된 로컬 연산이며 공유 가변 상태 접근이 없다. `use-execution-events.ts`의 폴링 로직은 취소 체크 패턴이 적절히 유지되어 있다. 동시성 관점에서 새롭게 도입된 위험 요소는 없으며, 기존에 지적된 `adjacentQuery` 경쟁 조건은 이번 변경과 무관하게 이미 존재하던 이슈다.

### 위험도
**NONE**