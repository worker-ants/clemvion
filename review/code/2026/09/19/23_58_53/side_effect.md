# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 공개 인터페이스 `IntegrationTestResult.code` 를 `string` → `IntegrationTestResultCode` 로 좁힘
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:84`
  - 상세: 노출 인터페이스(§5 인터페이스 변경 관점)의 필드 타입을 넓은 `string` 에서 6개 부분 union 으로 컴파일타임에 좁혔다. `TestConnectionResultDto.code`(`codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 부근)는 여전히 `string` 이라 그쪽으로의 대입은 안전(narrow→wide, 구조적 서브타입)하며, plan(`plan/in-progress/connection-test-codes-and-gaps.md`)의 실측대로 백엔드 안에서 이 `code` 를 비교하는 곳이 없고 build 단계 타입체크 ratchet(194, baseline 일치)이 통과했다는 근거가 이미 확보되어 있어 런타임 동작 변화는 없다. 다만 "narrower 로 좁히는 시그니처 변경"은 향후 이 필드에 문자열을 새로 대입하는 코드가 추가될 때 컴파일 에러의 원인이 되므로 기록해 둔다.
  - 제안: 조치 불필요(이미 검증됨) — 향후 새 생산자를 추가할 때 이 union 갱신을 빠뜨리지 않도록 `connection-test-codes.ts` 상단 주석(생산자 목록)을 계속 최신 상태로 유지할 것.

- **[INFO]** `pingConnection` 반환 타입이 두 클라이언트에서 `code?: string` → `code?: Cafe24PingCode` / `code?: MakeshopPingCode` 로 좁혀짐
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:380`, `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:312` (내부 헬퍼 `mapPingError` 반환 타입도 각각 `:186`, `:177`)
  - 상세: 두 함수 모두 `export`되어 있고, `IntegrationsService.registerEntityTester` 를 통해 entity tester 로 등록되어 호출된다(§4 시그니처 변경 관점). 실제 반환 리터럴 값(`'CAFE24_AUTH_FAILED'` 등)은 좁힌 union 과 정확히 일치하고, 좁히는 김에 발견된 누락(`INTEGRATION_CREDENTIALS_UNREADABLE` 게이트 코드)까지 별도 처리되어 있어 반환값 자체의 변화는 없다. 순수 컴파일타임 계약 강화.
  - 제안: 조치 불필요.

- **[INFO]** `database-driver-sockets.spec.ts` 의 `it('mysql2 promise Connection ...')` 는 루프백(127.0.0.1) 포트 9(discard)로 실제 TCP 연결을 시도하는 부작용을 갖는다
  - 위치: `codebase/backend/src/modules/integrations/database-driver-sockets.spec.ts:29-45` (unified diff 상 컨텍스트 라인)
  - 상세: 이번 diff 가 새로 도입한 부작용이 아니다 — 기존 코드에 이미 있던 실제 소켓 연결 시도이며, 이번 변경은 그 위에 `try/finally` 를 씌워 단언 실패 시에도 소켓을 정리하도록 고친 것뿐이다(오히려 이전엔 단언이 실패하면 `destroy()` 가 호출되지 않아 소켓이 열린 채 남을 수 있었던 부작용을 줄였다). 외부 네트워크 호출이 아니라 로컬 루프백에 한정되며, 주석(`// **unit 계층에서 예외적으로 실제 소켓을 연다**`)으로 이미 명시돼 있다.
  - 제안: 조치 불필요 — side-effect 관점에서는 개선(리소스 누수 축소)으로 판단.

- **[INFO]** `integrations.service.spec.ts` 신규 테스트가 `describe('rotate')` 안에서 `integrationRepo.findOne.mockReset()` 을 테스트 중간에 호출
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1337`
  - 상세: 공유 mock 객체를 테스트 도중 리셋하는 패턴은 이후 테스트로 상태가 새는 전형적인 위험 신호(§1 의도치 않은 상태 변경)라 확인했다. 그러나 최상위 `describe('IntegrationsService')` 의 `beforeEach`(`:118`)가 매 테스트마다 `integrationRepo` 전체를 `jest.fn()` 으로 새로 만들고, `describe('rotate')` 자체의 `beforeEach`(`:1277`)도 매 테스트 전에 `findOne` 기본값을 재설정한다 — 따라서 이 `mockReset()` 은 해당 테스트 스코프 안에서만 유효하며 인접 테스트로 새지 않는다(테스트 순서 무관하게 안전).
  - 제안: 조치 불필요.

- **[INFO]** 신규 파일 `connection-test-codes.ts` / `.spec.ts` 는 순수 상수·타입 정의와 타입 전용(런타임 no-op) 테스트로, 전역 상태·파일시스템·환경변수·네트워크에 관여하지 않는다
  - 위치: `codebase/backend/src/modules/integrations/connection-test-codes.ts` 전체, `codebase/backend/src/modules/integrations/connection-test-codes.spec.ts` 전체
  - 상세: `as const` 객체의 각 값이 기존에 흩어져 있던 리터럴 문자열과 1:1 대응함을 `database-connection-tester.ts`·`http-connection-tester.ts`·`integrations.service.ts` 실제 코드에서 대조 확인했다(예: `DB_HOST_BLOCKED: 'DB_HOST_BLOCKED'`, 실사용처 `CONNECTION_TEST_CODES.DB_HOST_BLOCKED`) — wire 값 변화 없음.
  - 제안: 조치 불필요.

## 요약
이번 변경은 연결 테스트 결과 코드를 흩어진 문자열 리터럴에서 상수(`as const`)·literal union 으로 컴파일타임에 정리하는 순수 리팩터이며, 실행 시 반환되는 문자열 값은 모두 기존과 동일함을 각 생산자 파일(`database-connection-tester.ts`, `http-connection-tester.ts`, `integrations.service.ts`, `cafe24-api.client.ts`, `makeshop-api.client.ts`)에서 직접 대조해 확인했다. 인터페이스·함수 시그니처가 `string` → 좁은 union 으로 바뀌는 지점이 세 곳(`IntegrationTestResult.code`, 두 `pingConnection` 반환 타입) 있지만 전부 컴파일타임 전용이며 build 단계 타입체크 ratchet 통과로 뒷받침된다. 테스트 쪽에서는 `mockReset()` 중간 호출·실제 루프백 소켓 연결이 눈에 띄지만 둘 다 스코프가 격리되어 있거나(전자) 이번 diff 가 만든 것이 아니라 오히려 정리를 개선한 것(후자)이다. 새 전역 변수·환경변수 접근·의도치 않은 외부 네트워크 호출·이벤트/콜백 변경은 발견되지 않았다. 저장소 트리에 대한 뮤테이션은 수행하지 않았다(`git status --short` 로 확인, `review/code/2026/09/19/23_58_53/`(본 세션 산출물 디렉터리) 외 변경 없음).

## 위험도
NONE
