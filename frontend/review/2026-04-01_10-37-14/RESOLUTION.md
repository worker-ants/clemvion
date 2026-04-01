# 코드 리뷰 이슈 조치 내용

## Critical

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | mockSocket 모듈 스코프 공유로 테스트 상태 오염 | factory 함수 `createMockSocket()`으로 매 테스트마다 새 인스턴스 생성하도록 변경. `vi.resetAllMocks()` 적용 |

## Warning

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `waitForConnect` reject 경로 없어 Promise leak | `connect_error` 이벤트 핸들러 추가. resolve/reject 후 반대쪽 핸들러 정리 구현 |
| 2 | `cancelled` → `failed` 암묵적 매핑 | `use-execution-events.ts`에 매핑 이유 주석 추가 (store가 idle/running/completed/failed만 지원) |
| 3 | WS 이벤트 핸들러 동작 미검증 | 8개 이벤트 핸들러 모두에 대한 store mutation 검증 테스트 추가 |
| 4 | `waiting_for_input` 상태 테스트 없음 | `waiting_for_input` 노드 상태 poll 처리 테스트 추가 |
| 5 | `query` 파라미터에 토큰 노출 (보안) | `ws-client.ts`에서 `query: { token }` 제거, `auth`만 사용. 테스트에서 query 미전달 검증 |
| 6 | `ExecutionData.error`에 `stack` 필드 노출 | 클라이언트 타입에서 `stack` 필드 제거 |
| 7 | `resetWsClient` 프로덕션 노출 | 유지 — 향후 로그아웃 시 WS 연결 정리에도 필요하므로 프로덕션 API로 유지 |
| 8 | `vi.clearAllMocks()` 사용 | `vi.resetAllMocks()`로 교체 |
| 9 | `useExecutionStore.setState()` partial merge | merge 모드 유지 (replace 모드는 zustand action 함수를 제거하므로 부적합) |

## Info (주요 조치)

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `act` import 미사용 | 제거 완료 |
| 3 | cleanup 시 connect 핸들러 off 호출 검증 | `connectOffCalls.length === 2` 검증 추가 (onConnect + onReconnect) |
| 5 | waitForConnect 타이머 테스트 | setTimeout 5ms로 단축. `connect_error` reject 테스트 추가 |
| 10 | mock 데이터 리터럴 반복 | `createMockExecution(overrides)` factory 함수 추출 |
