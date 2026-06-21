# Testing Review — M-7 채널 Authorizer 도메인 역전

## 발견사항

### 발견사항 1
- **[INFO]** 신규 코드 전체에 대한 테스트가 충실히 작성됨
  - 위치: `uuid.spec.ts`, `execution-channel-authorizer.spec.ts`, `background-run-channel-authorizer.spec.ts`, `kb-channel-authorizer.spec.ts`, `notifications-channel-authorizer.spec.ts`, `workflow-channel-authorizer.spec.ts`, `websocket.gateway.spec.ts`
  - 상세: 신설된 5개 authorizer 클래스 각각에 도메인-로컬 단위 spec이 함께 추가되었다. `isValidUuid` 공유 util 에도 `uuid.spec.ts` 가 신설되었다. gateway spec은 실 authorizer 클래스 + useFactory wiring을 그대로 재현해 DI 역전 구조를 integration 수준으로 검증한다. 커밋 메시지에서 lint·build·unit(40 suites)·e2e 205 PASS를 보고하고 있어 회귀 없음이 확인됨.
  - 제안: 없음.

### 발견사항 2
- **[INFO]** 각 authorizer 단위 테스트의 의존성 주입 방식이 테스트 용이성을 극대화함
  - 위치: 모든 `*-channel-authorizer.spec.ts` 파일의 `makeAuthorizer()` 헬퍼 함수
  - 상세: 각 spec은 NestJS `Test.createTestingModule`을 사용하지 않고, 생성자에 mock 서비스를 직접 전달하는 `makeAuthorizer(mock)` 팩토리 패턴을 사용한다. 이로 인해 DI 컨테이너 부팅 비용 없이 순수 단위 테스트가 가능하며, 각 테스트가 필요한 mock만 명시적으로 선언한다. `NotificationsChannelAuthorizer`는 의존성이 없어 `new NotificationsChannelAuthorizer()`로 직접 인스턴스화하여 단순성을 더 높였다.
  - 제안: 현재 구조 유지.

### 발견사항 3
- **[INFO]** uuid.spec.ts의 경계값 커버리지가 충분함
  - 위치: `codebase/backend/src/common/utils/uuid.spec.ts`
  - 상세: 버전 nibble(1-5 유효, 0·6 거부), variant nibble(8/9/a/b 유효, 7 거부), 대소문자 혼용, 길이 부족/초과, 구분자 누락, 비-hex 문자, 선행 공백이 모두 별도 케이스로 테스트된다. 정규식의 핵심 제약 조건이 빠짐없이 명시적으로 테스트되어 있다.
  - 제안: 없음.

### 발견사항 4
- **[INFO]** 각 authorizer spec이 보안 의도를 명확히 표현하는 테스트 이름을 사용함
  - 위치: 모든 `*-channel-authorizer.spec.ts`의 `it(...)` 문자열
  - 상세: `'rejects non-UUID id before DB lookup (W-6)'`, `'rejects when ownership throws (catch → false)'`, `'rejects when channel userId differs from JWT sub (IDOR)'`, `'rejects when JWT userId is empty (fail-closed)'` 등 보안 정책 레이블이 테스트 이름에 포함되어 있어 스펙-테스트 추적성이 양호하다.
  - 제안: 없음.

### 발견사항 5
- **[INFO]** gateway.spec의 authorizer 개수 assertion이 useFactory 동기화 드리프트를 조기 감지함
  - 위치: `websocket.gateway.spec.ts` L176-L182 (`CHANNEL_AUTHORIZER 주입` describe 블록)
  - 상세: `expect(authorizers).toHaveLength(5)` assertion이 useFactory inject 목록과 실제 배열이 어긋날 경우를 조기에 탐지한다. 신규 authorizer 추가 시 `websocket.module.ts`의 inject 목록과 gateway spec의 inject 목록을 함께 갱신해야 함을 이 assertion이 강제한다.
  - 제안: 없음.

### 발견사항 6
- **[INFO]** fail-closed W-5 분기를 실제로 테스트함
  - 위치: `websocket.gateway.spec.ts` L184-L201
  - 상세: `channelAuthorizers` 배열을 `[]`로 교체하여 정상 prefix 채널이라도 매칭 authorizer가 없을 때 `success:false + 'Not authorized for this channel'`를 반환함을 직접 검증한다. 테스트 대상 분기에 대한 내부 상태 조작을 사용하나(private field에 `as unknown` 캐스트), fail-closed 정책 검증이 목적이므로 적절한 Trade-off이다.
  - 제안: 없음.

### 발견사항 7
- **[WARNING]** gateway.spec의 useFactory wiring이 websocket.module.ts와 완전히 이중 관리됨
  - 위치: `websocket.gateway.spec.ts` L138-L150 vs `websocket.module.ts`의 useFactory 블록
  - 상세: 두 파일에 동일한 `inject: [ExecutionChannelAuthorizer, BackgroundRunChannelAuthorizer, WorkflowChannelAuthorizer, KbChannelAuthorizer, NotificationsChannelAuthorizer]` 배열이 중복된다. 신규 authorizer 추가 시 두 파일 중 한 곳을 빠뜨리면 gateway spec이 실제 prod wiring과 다른 상태로 통과하는 거짓 신뢰를 준다. W-5 개수 assertion이 이를 일부 완화하지만, spec inject 배열과 module inject 배열이 완전히 독립적으로 관리되는 구조 자체는 잔존한다. maintainability.md에서도 같은 issue가 WARNING으로 식별됨.
  - 제안: `websocket.module.ts`에서 `buildChannelAuthorizerProvider` helper 함수를 export하거나, 별도 `channel-authorizer.factory.ts` 상수 파일에 inject 배열을 추출하여 module과 spec이 같은 소스를 참조하도록 개선할 수 있다. 단, 현재 개수 assertion이 보완책으로 동작하므로 urgent하지 않다.

### 발견사항 8
- **[INFO]** notifications authorizer spec에서 공유 인스턴스를 `describe` 스코프에서 선언함
  - 위치: `notifications-channel-authorizer.spec.ts` L12 (`const authorizer = new NotificationsChannelAuthorizer()`)
  - 상세: `NotificationsChannelAuthorizer`는 상태가 없는 순수 클래스이므로 `describe` 블록 상단에서 한 번 생성해 공유하는 것은 테스트 격리 관점에서 문제가 없다. 모든 `authorize` 호출이 입력에만 의존하므로 테스트 간 상태 오염 가능성이 없다.
  - 제안: 없음.

### 발견사항 9
- **[INFO]** ExecutionChannelAuthorizer spec에 `verifyOwnership`이 false를 반환하는 케이스가 부재함
  - 위치: `execution-channel-authorizer.spec.ts`
  - 상세: 이 authorizer는 `verifyOwnership`의 결과를 `.then(() => true).catch(() => false)` 패턴으로 처리한다. throw 케이스는 테스트되었으나(`'rejects when ownership throws'`), `verifyOwnership`이 정상적으로 resolve되되 소유권이 없는 케이스(undefined/false resolve → true 평탄화)는 존재하지 않는다. 현재 구현상 `verifyOwnership`이 throw하지 않는 한 항상 `allowed = true`가 되므로, 서비스가 false를 반환하는 경우가 어차피 없다(throw 기반 거부 계약). 이 점이 코드 주석(`미소유/부재 시 throw(NotFound 통일)`)에 명시되어 있어 의도적 설계임.
  - 제안: 코드 주석("verifyOwnership은 미소유/부재 시 throw(NotFound 통일 — ID enumeration 차단)")이 이 설계를 이미 설명하고 있다. 혼동 방지를 위해 테스트 이름을 `'allows when verifyOwnership resolves (throw = denied, so any resolve = allowed)'` 수준으로 강화할 수 있으나, 선택적 개선이다.

### 발견사항 10
- **[INFO]** WorkflowChannelAuthorizer spec에서 `findById`가 `undefined`를 반환하는(소유하지 않은 워크플로이나 throw 없이 resolve) 케이스가 테스트되지 않음
  - 위치: `workflow-channel-authorizer.spec.ts`
  - 상세: ExecutionChannelAuthorizer와 동일하게 `.then(() => true).catch(() => false)` 패턴이라 resolve는 항상 allowed=true 처리된다. `findById`가 null/undefined 반환 시 거부 경로가 없으므로, 이 케이스는 현재 코드로는 의미 있는 테스트 대상이 아니다. "resolve = 소유 확인됨"의 서비스 계약이 전제되어 있다.
  - 제안: 없음(설계 의도에 부합).

## 요약

M-7 채널 authorizer 도메인 역전 변경의 테스트 커버리지는 전반적으로 우수하다. 신설된 5개 authorizer 모두 도메인-로컬 단위 spec을 가지며, `isValidUuid` 공유 util도 경계값 중심의 spec이 함께 신설되었다. 각 authorizer는 matches/authorize의 정상 경로·UUID 선차단·소유 검증 throw 경로를 명시적으로 테스트하고, notifications authorizer는 JWT userId 불일치 IDOR와 빈 userId fail-closed까지 포함한다. gateway spec은 실 authorizer 클래스 + useFactory wiring 구조를 재현해 DI 역전과 인가 동작을 통합적으로 검증하며, fail-closed W-5 분기와 authorizer 개수 assertion으로 구조적 안전망을 구축했다. 유일한 주목 사항은 gateway spec의 useFactory inject 배열이 websocket.module과 이중 관리되는 점(WARNING 1건)으로, 현재 개수 assertion이 완화하고 있으나 장기적으로 단일 소스 추출이 권장된다.

## 위험도

LOW
