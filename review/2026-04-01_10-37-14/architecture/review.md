### 발견사항

- **[INFO]** `executionsApi`의 단일 엔드포인트 노출
  - 위치: `executions.ts` 전체
  - 상세: 현재 `getById` 하나만 존재하며, 실행 목록 조회(`list`), 취소(`cancel`) 등 확장 가능성이 높음. 구조 자체는 객체 리터럴로 향후 추가에 열려있어 문제없음.
  - 제안: 현재 구조 유지, 필요 시 `list`, `cancel` 추가

- **[WARNING]** `useExecutionEvents` 훅의 다중 책임
  - 위치: `use-execution-events.test.ts` 기반 추론 — WS 연결, 채널 구독, API 폴링, 스토어 업데이트를 모두 수행
  - 상세: 하나의 훅이 WebSocket 생명주기 관리 + HTTP 폴링 + 상태 파생 + 스토어 쓰기까지 담당. SRP 위반. 특히 "WebSocket 연결 후 HTTP로 현재 상태를 폴링"하는 패턴은 두 가지 데이터 소스를 하나의 레이어에서 조율하는 복잡성을 야기함.
  - 제안: `useWsConnection` (연결/구독), `useExecutionSync` (폴링+스토어 동기화)로 분리 고려

- **[WARNING]** 폴링 전략의 아키텍처적 위치
  - 위치: `use-execution-events.test.ts` — `polls execution status after subscribing` 테스트
  - 상세: WebSocket 구독 후 HTTP 폴링을 수행하는 fallback 패턴은 정당하지만, 이 로직이 presentation layer와 가까운 훅 내부에 있음. 폴링 주기, 재시도 로직 등이 훅에 하드코딩될 경우 테스트 및 재사용이 어려워짐.
  - 제안: 폴링 로직을 별도 `executionSyncService` 또는 `useExecutionPoller` 훅으로 분리

- **[INFO]** `resetWsClient` 테스트 전용 노출
  - 위치: `ws-client.test.ts` — `resetWsClient` import
  - 상세: 싱글턴 리셋 함수가 테스트를 위해 공개 API로 노출됨. 프로덕션 코드에서 호출될 위험 존재.
  - 제안: `/* @internal */` JSDoc 주석 또는 별도 테스트 유틸 파일(`ws-client.test-utils.ts`)에서만 re-export

- **[INFO]** `cancelled` 상태를 `failed`로 매핑
  - 위치: `use-execution-events.test.ts` — `handles cancelled execution from poll` 테스트
  - 상세: `cancelled` 실행 상태가 스토어에서 `failed`로 처리됨. 도메인 개념과 UI 상태 간의 매핑이 암묵적이며, 향후 취소 전용 UI 처리가 필요할 때 변경 범위가 큼.
  - 제안: 스토어에 `cancelled` 상태를 명시적으로 추가하거나, 매핑 함수를 명시적으로 분리

- **[INFO]** `act` import 미사용
  - 위치: `use-execution-events.test.ts:3`
  - 상세: `act`가 import되었으나 테스트에서 사용되지 않음.
  - 제안: 미사용 import 제거

### 요약

전반적인 아키텍처는 싱글턴 WS 클라이언트 → 훅 → Zustand 스토어의 단방향 데이터 흐름을 따르며 레이어 방향이 명확하다. `executions.ts`의 타입 정의와 API 클라이언트 분리, `ws-client`의 팩토리/싱글턴 패턴은 적절하다. 주요 아키텍처 리스크는 `useExecutionEvents` 훅의 과도한 책임 집중이며, WebSocket 이벤트 처리와 HTTP 폴링 fallback을 단일 훅이 담당함으로써 SRP를 위반하고 있다. `cancelled → failed` 상태 매핑의 암묵적 처리와 `resetWsClient`의 공개 노출은 소규모 개선 대상이다.

### 위험도

**LOW**