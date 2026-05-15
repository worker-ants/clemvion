# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - 동시성 버그(waitForConnect reject 누락), 테스트 커버리지 공백(WS 이벤트 핸들러 동작 미검증), API 계약 불명확(cancelled→failed 매핑)이 주요 위험 요소

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | `mockSocket`이 모듈 스코프 공유 객체이며 `connected` 프로퍼티를 직접 변조 — `vi.clearAllMocks()`로 일반 프로퍼티는 초기화되지 않아 테스트 실행 순서 변경/병렬화 시 상태 오염 가능 | `ws-client.test.ts` 전반 | `beforeEach`에서 mockSocket을 factory 함수로 매 테스트마다 새로 생성: `const createMockSocket = () => ({ connected: false, on: vi.fn(), ... })` |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | `waitForConnect`에 reject 경로 없음 — `connect_error`/`disconnect` 발생 시 Promise가 영구 pending 상태로 남아 async 태스크 leak 유발 | `ws-client.ts` `waitForConnect` | `socket.once("connect_error", reject)` 및 `once("disconnect", reject)` 추가, resolve/reject 후 반대쪽 핸들러 정리 |
| 2 | API 계약 | `cancelled` 상태가 API 타입에는 독립 값으로 존재하나 store에서 `failed`로 흡수되는 묵시적 매핑 — 의도 불명확 | `executions.ts:21`, `use-execution-events.test.ts:196` | store에 `cancelled` 상태를 명시적으로 추가하거나, 매핑 함수를 분리하고 주석으로 이유 명시 |
| 3 | 테스트 커버리지 | WebSocket 이벤트 핸들러 등록 여부만 검증하고 실제 페이로드 수신 시 store 상태 업데이트가 올바른지 검증 없음 (`execution.started`, `execution.node.started` 등) | `use-execution-events.test.ts` `binds all event handlers` | 각 이벤트 핸들러 호출 시 store mutation을 검증하는 테스트 추가 |
| 4 | 테스트 커버리지 | `waiting_for_input` 노드 상태에 대한 테스트 없음 — 타입 정의에는 존재하나 poll 결과 처리 검증 누락 | `executions.ts:7`, `use-execution-events.test.ts` | `waiting_for_input` 상태 포함 poll 응답 처리 테스트 추가 |
| 5 | 보안 | WebSocket 연결 시 인증 토큰이 `auth`와 `query` 양쪽에 전달 — `query` 파라미터는 서버 로그, 브라우저 히스토리, 프록시 로그에 노출 가능 | `ws-client.ts` (테스트 `ws-client.test.ts`) | 구현에서 `query`로 토큰 전달 제거, `auth`만 사용 |
| 6 | 보안 | `ExecutionData.error`에 `stack` 필드 — 서버 내부 경로/프레임워크 정보 클라이언트 노출 가능 | `executions.ts:22` `error: { stack?: string }` | 클라이언트 타입에서 `stack` 제거 또는 UI 레이어에서 렌더링 금지 처리 |
| 7 | 의존성 / 아키텍처 | `resetWsClient`가 프로덕션 번들에 테스트 전용 API로 노출 — 프로덕션에서 의도치 않게 호출 시 전역 WS 연결 끊김 | `ws-client.ts` export, `ws-client.test.ts:18` | `process.env.NODE_ENV === 'test'` 조건부 export 또는 별도 테스트 유틸 파일로 분리 |
| 8 | Side Effect | `use-execution-events.test.ts`의 `vi.clearAllMocks()`는 mock 구현을 복원하지 않아 `mockImplementation` 오버라이드가 다음 테스트에 영향 가능 | `use-execution-events.test.ts` `beforeEach` | `vi.clearAllMocks()` → `vi.resetAllMocks()`로 교체 또는 `beforeEach`에서 기본 구현 명시적 재설정 |
| 9 | Side Effect | `useExecutionStore.setState()` partial merge 사용 — 향후 store 필드 추가 시 이전 테스트 값이 남을 수 있음 | `use-execution-events.test.ts` `beforeEach` | `useExecutionStore.setState({...}, true)` (replace 모드)로 완전 교체 보장 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 코드 품질 | `act` import 미사용 (다수 에이전트 공통 지적) | `use-execution-events.test.ts:2` | import에서 `act` 제거 |
| 2 | 테스트 커버리지 | `executionsApi.getById` 자체 단위 테스트 없음 — URL 구성 오류 조기 발견 불가 | `executions.ts`, `__tests__` 디렉토리 부재 | `src/lib/api/__tests__/executions.test.ts` 추가, `apiClient.get`이 올바른 URL로 호출되는지 검증 |
| 3 | 테스트 커버리지 | cleanup 시 `mockClient.off` 호출 여부만 확인하고 등록된 것과 동일한 핸들러 참조로 off가 호출되는지 미검증 | `use-execution-events.test.ts` cleanup 테스트 | `on` 호출과 `off` 호출의 핸들러 참조 대칭성 검증 추가 |
| 4 | 테스트 커버리지 | `connect` 이벤트에 `onConnect`와 `onReconnect` 두 핸들러 등록되나 cleanup 테스트에서 두 번 off 호출 검증 누락 | `use-execution-events.test.ts:128–143` | `mockClient.off`가 `connect` 이벤트에 대해 두 번 호출되는지 검증 |
| 5 | 테스트 안정성 | `waitForConnect` 테스트에서 실제 타이머 `setTimeout(..., 10)` 사용 — CI 환경 flakiness 가능 | `ws-client.test.ts:124–133` | `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(10)` 사용 |
| 6 | 테스트 커버리지 | 소켓이 존재하지만 `connected === false`인 재연결 시도 케이스 미테스트 | `ws-client.test.ts:57` | 소켓 있지만 disconnected 상태일 때 동작 검증 테스트 추가 |
| 7 | 테스트 커버리지 | `waitForConnect` timeout 시나리오(영구 대기 가능성) 테스트 없음 | `ws-client.test.ts` | timeout 거부 케이스 또는 무한 대기 허용 여부 명시 |
| 8 | 유지보수성 | `NodeExecutionData.error`와 `ExecutionData.error` 인라인 타입 중복 정의 | `executions.ts:11,22` | `type ExecutionError = { message?: string; stack?: string }` 공유 타입 추출 |
| 9 | 유지보수성 | status 유니온 타입이 두 인터페이스에 인라인 중복 선언 | `executions.ts` | `type NodeExecutionStatus`, `type ExecutionStatus`로 네임드 타입 추출 |
| 10 | 유지보수성 | 테스트 mock 응답 구조가 여러 테스트에서 리터럴 반복 | `use-execution-events.test.ts` | `createMockExecution(overrides)` 헬퍼 팩토리 함수로 추출 |
| 11 | API 계약 | `NodeExecutionData`의 `waiting_for_input` 상태가 WebSocket 이벤트 계약에 미반영 — 폴링 전용인지 불명확 | `executions.ts:7` | 해당 상태가 폴링 전용임을 문서화 또는 WS 이벤트 핸들러 추가 |
| 12 | API 계약 | 테스트 mock 데이터가 타입 필수 필드 일부 생략 (`id`, `executionId`, `startedAt` 등) | `use-execution-events.test.ts:99–116` | mock 데이터를 실제 API 스키마에 맞게 완성하거나 선택적 필드는 `?` 표시 |
| 13 | 보안 | `id`를 URL에 직접 interpolation — UUID 검증 없음 | `executions.ts` `` `/executions/${id}` `` | `encodeURIComponent(id)` 적용 또는 호출 전 UUID 형식 검증 |
| 14 | 보안 | 백엔드 내부 오류 메시지가 그대로 store/UI에 노출 가능 | `use-execution-events.test.ts` error 검증 | 사용자 노출 전 sanitize 또는 사전 정의 메시지 매핑 레이어 추가 |
| 15 | 아키텍처 | `useExecutionEvents` 훅이 WS 연결, 채널 구독, HTTP 폴링, 스토어 업데이트를 모두 담당 — SRP 위반 | `use-execution-events.ts` | `useWsConnection`(연결/구독)과 `useExecutionPoller`(폴링+스토어 동기화)로 분리 고려 |
| 16 | 문서화 | `cancelled → failed` 매핑 이유가 코드/테스트 어디에도 설명 없음 | `use-execution-events.test.ts:189–200` | 구현부 또는 테스트에 인라인 주석 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| concurrency | MEDIUM | `waitForConnect` reject 경로 누락으로 async 태스크 leak, onReconnect cleanup 경쟁 조건 |
| requirement | MEDIUM | WS 이벤트 핸들러 동작 미검증, `waiting_for_input` 테스트 누락, `cancelled→failed` 매핑 불명확 |
| testing | MEDIUM | 이벤트 페이로드 처리 store mutation 미검증, API 단위 테스트 없음, cleanup 핸들러 대칭성 미검증 |
| api_contract | MEDIUM | `cancelled`/`failed` 계약 불명확, `waiting_for_input` WS 이벤트 누락, mock 데이터 스키마 불일치 |
| security | LOW | 토큰 query 파라미터 노출, `stack` 필드 서버 정보 노출 |
| dependency | LOW | `resetWsClient` 프로덕션 노출, `act` 미사용 import |
| architecture | LOW | `useExecutionEvents` SRP 위반, `cancelled` 암묵적 매핑 |
| maintainability | LOW | 인라인 타입 중복, `act` 미사용, mock 데이터 리터럴 반복 |
| side_effect | LOW | mock 공유 객체 상태 오염 (확장 시 MEDIUM) |
| performance | LOW | 완료 상태 캐싱 부재, fake timer 미사용 |
| scope | LOW | `act` 미사용 import, cleanup 핸들러 검증 불완전 |
| documentation | LOW | JSDoc 부재, `cancelled→failed` 매핑 주석 없음 |
| database | NONE | 해당 없음 (프론트엔드 코드) |

---

## 발견 없는 에이전트

- **database** — 데이터베이스 관련 요소 없음 (프론트엔드 전용 코드)

---

## 권장 조치사항

1. **[즉시 필수]** `waitForConnect`에 reject 경로 추가 — `connect_error`/`disconnect` 이벤트 핸들러로 Promise leak 방지
2. **[즉시 필수]** `ws-client.test.ts` `mockSocket`을 factory 패턴으로 교체하여 테스트 격리 보장
3. **[필수]** `vi.clearAllMocks()` → `vi.resetAllMocks()` 교체 및 `useExecutionStore.setState({...}, true)` replace 모드 적용
4. **[필수]** WebSocket 이벤트 핸들러 동작 검증 테스트 추가 (`execution.started` 등 → store mutation)
5. **[필수]** `waiting_for_input` 상태 poll 처리 테스트 추가
6. **[필수]** WebSocket 연결에서 `query` 파라미터 토큰 전달 제거, `auth`만 사용
7. **[권장]** `cancelled` 상태 처리 명확화 — store에 별도 상태 추가 또는 매핑 이유 주석/문서화
8. **[권장]** `resetWsClient`를 테스트 환경 전용으로 격리 (`process.env.NODE_ENV === 'test'` 조건부 export)
9. **[권장]** `executionsApi.getById` 단위 테스트 파일 추가 (`src/lib/api/__tests__/executions.test.ts`)
10. **[권장]** `act` 미사용 import 제거, `ExcutionError` 공유 타입 추출, mock 데이터 factory 헬퍼 작성