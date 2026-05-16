# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `registerEntityTester` — "Last registration wins" 정책으로 인한 묵시적 덮어쓰기 위험
  - 위치: `backend/src/modules/integrations/integrations.service.ts` +197~+199 (`entityTesters.set`)
  - 상세: `registerEntityTester`는 동일 `serviceType`에 대해 어떤 보호도 없이 덮어씁니다. 두 모듈이 동일한 `service_type`에 대해 각각 `onModuleInit`에서 등록하면, NestJS 모듈 초기화 순서에 따라 tester가 묵시적으로 교체되며 이전 등록자는 경고 없이 사라집니다. 현재는 cafe24만 등록하지만, 추가 통합 서비스가 등록될 때 충돌이 발생할 수 있습니다.
  - 제안: 이미 등록된 `serviceType`에 재등록 시도가 발생하면 `Logger.warn` 또는 오류를 발생시키거나, 문서에 "동일 serviceType 중복 등록 시 덮어쓰기됨"을 명시적으로 경고로 남길 것.

- **[WARNING]** `pingConnection` — `withIntegrationLock` 내부에서 DB 상태를 변경하는 조건부 부작용
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` +633, +718
  - 상세: `pingConnection`은 "사용자 진단용 호출"이라고 명시하면서도 401 재시도 후 실패 시 `markAuthFailed(integration)`를 호출하여 DB의 `status`, `statusReason`을 변경합니다. 403 + 재시도 시에도 동일합니다(line +717). 이는 진단 호출이 인테그레이션 상태를 영구 변경하는 예상 외의 부작용입니다. 사용자 입장에서는 "연결 테스트" 버튼을 눌렀을 뿐인데 integration 상태가 `error(auth_failed)`로 전이될 수 있습니다. 이 동작 자체가 설계 의도라면 공개 API 문서(Swagger, spec §5.8)에 명시되어야 합니다.
  - 제안: spec §5.8에 "2차 재시도 후 401/403 응답 시 integration status가 auth_failed로 전이된다"는 부작용을 명시하거나, 진단 전용 모드에서 status 전이를 일으키지 않도록 `markAuthFailed` 호출을 생략하는 별도 경로를 제공하는 것을 검토할 것.

- **[WARNING]** 테스트 코드에서 `process.env`를 수동으로 설정/삭제 — 테스트 격리 미흡
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` +312, +376, +377, +383, +432~+433, +439, +468~+469, +527, +565~+566
  - 상세: 여러 테스트 케이스가 `process.env.CAFE24_CLIENT_ID`와 `process.env.CAFE24_CLIENT_SECRET`를 직접 설정하고 `delete`로 삭제합니다. 테스트가 예외를 던지거나 조기 종료되면 `delete` 코드가 실행되지 않아 환경 변수가 누출되어 이후 테스트 케이스에 영향을 줍니다. 이것은 환경 변수 부작용의 전형적인 누수 패턴입니다.
  - 제안: `afterEach`에서 환경 변수를 정리하거나 `jest.resetModules()` / `jest.replaceProperty(process, 'env', {...})` 패턴을 사용하거나, `beforeEach`에서 초기 env 스냅샷을 저장하고 `afterEach`에서 복원할 것.

- **[WARNING]** `EntityAwareTester` 타입이 `export`로 공개 API에 추가됨
  - 위치: `backend/src/modules/integrations/integrations.service.ts` +165~+167
  - 상세: `EntityAwareTester` 타입이 새롭게 `export`되어 공개 인터페이스에 추가됩니다. 이 타입이 외부 모듈에서 참조되기 시작하면 추후 시그니처 변경(예: `Integration` 대신 다른 타입)이 파급 효과를 가집니다. `registerEntityTester` 메서드 자체도 공개 메서드(`public`)로 추가되어 IntegrationsService의 공개 API 표면이 확장됩니다.
  - 제안: `EntityAwareTester`가 외부 공개가 불필요하다면 `// @internal` JSDoc 주석을 추가하거나 별도의 internal types 파일로 분리할 것. 현재 설계상 Cafe24Module만 사용하므로 공개 범위를 최소화하는 검토가 필요함.

- **[INFO]** `Cafe24Module.onModuleInit`에서 `IntegrationsService`에 대한 런타임 의존성 주입 부작용
  - 위치: `backend/src/nodes/integration/cafe24/cafe24.module.ts` +862~+875
  - 상세: `Cafe24Module`이 `IntegrationsModule`을 import하고 `onModuleInit`에서 `IntegrationsService.registerEntityTester`를 호출합니다. 이 패턴은 `nodes/*` → `modules/*` 단방향 의존성을 유지하면서 역방향 참조를 우회하기 위한 의도된 설계이나, NestJS DI 컨테이너의 초기화 순서에 따라 `IntegrationsService`가 준비되기 전에 `onModuleInit`이 실행되면 런타임 오류가 발생할 수 있습니다. NestJS는 일반적으로 이 순서를 보장하지만, circular dependency 도입 시 예외가 발생할 수 있습니다.
  - 제안: 현재 구조는 의도된 설계 결정이며 commit message에서도 명시하고 있으므로 큰 위험은 아님. 다만 `IntegrationsModule`이 순환 의존성 없이 안전하게 export되는지 integration 테스트에서 모듈 초기화를 검증하는 케이스를 추가 권장.

- **[INFO]** `rawPing` 메서드 내 `AbortController` 타이머 30초 — 부작용 있는 타이머 리소스
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` +741~+742, +756
  - 상세: `rawPing`은 `setTimeout`으로 30초 타이머를 생성하고 `finally`에서 `clearTimeout`으로 정리합니다. 이 패턴 자체는 올바르나, `pingConnection` 경로에서 `rawPing`이 최대 2회 호출되므로 동시에 2개의 AbortController/타이머가 존재할 수 있습니다. 예외적인 코드 경로에서 타이머가 누수되지 않도록 `finally` 블록이 모든 경로를 커버하는지 확인 필요.
  - 제안: 현재 구현의 `finally { clearTimeout(timer) }`은 올바른 패턴임. 추가 조치 불필요하나, 향후 `rawPing` 시그니처 변경 시 이 패턴을 유지할 것.

- **[INFO]** `withIntegrationLock` 내부에서의 DB 상태 읽기 — `integration.credentials` 인메모리 객체 변경
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` +661~+663, +704~+706
  - 상세: `pingConnection`은 `ensureFreshToken` 및 `refreshAccessToken` 호출 후 `integration.credentials` 객체를 직접 참조하여 갱신된 `access_token`을 읽습니다. `refreshAccessToken`이 DB 트랜잭션을 통해 토큰을 갱신하고 `integration` 인메모리 객체도 함께 변경한다고 가정하는데, 이 사이드 이펙트(인메모리 객체 변경)가 `refreshAccessToken` 구현에 명시적으로 보장되는지 확인 필요합니다.
  - 제안: `refreshAccessToken`이 `integration.credentials`를 인메모리에서도 갱신한다는 보장이 구현 주석 또는 타입에 명시되어야 함. 현재 테스트에서 `txRepo.save`가 mock이므로 실제 동작 보장을 코드 레벨에서 확인 권장.

## 요약

이번 변경은 `IntegrationsService`에 `entityTesters` Map을 추가하고 `Cafe24Module.onModuleInit`에서 cafe24의 `pingConnection`을 등록하는 구조로, 의존성 방향을 보존하면서 entity-aware 테스트를 추가하는 설계입니다. 가장 중요한 부작용 위험은 두 가지입니다. 첫째, `pingConnection`이 "진단용" 호출임에도 불구하고 401 재시도 실패 시 DB의 integration status를 `error(auth_failed)`로 영구 변경하는 점(의도된 설계라면 spec에 명시 필요). 둘째, 테스트 코드에서 `process.env` 환경 변수를 설정/삭제하는 패턴이 테스트 실패 시 환경 변수를 누출할 수 있어 테스트 격리 위험이 존재합니다. `registerEntityTester` 메서드의 "Last registration wins" 정책도 향후 다수 통합 서비스 등록 시 묵시적 덮어쓰기 위험을 내포합니다.

## 위험도

MEDIUM
