# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `buildFakeCafe24Integration` 팩토리 도입으로 테스트 가독성 및 중복 제거 달성
  - 위치: `integration-oauth.service.cafe24.spec.ts` lines 36–87 (추가된 팩토리)
  - 상세: 기존 테스트 곳곳에 흩어진 인라인 객체 리터럴을 단일 팩토리로 통일해 선언 반복을 제거하고, legacy `mallId=null` + `credentialsMallId` 분기도 명시적으로 지원한다. 팩토리 상단 JSDoc에 설계 의도가 잘 서술되어 있어 유지 보수 맥락을 전달한다.
  - 제안: 유지 현상 (긍정적 변경).

- **[WARNING]** `buildFakeCafe24Integration`이 반환하는 객체에 `workspaceId` 필드가 없어, 일부 실서비스 코드 경로와 mock 객체 형상이 불일치할 수 있음
  - 위치: `buildFakeCafe24Integration` 반환 객체 (lines 75–86); 기존 인라인 mock 은 `workspaceId: 'ws-1'` 을 명시하던 케이스 포함 (제거된 lines 99, 131, 149)
  - 상세: diff 에서 삭제된 인라인 mock 중 일부는 `workspaceId: 'ws-1'`를 명시적으로 포함하고 있었다. 팩토리는 `workspaceId`를 노출하지 않아 제거된 셈인데, 테스트 대상 서비스 로직이 반환된 통합 객체의 `workspaceId`를 참조하지 않는다면 무방하다. 그러나 미래에 서비스 로직이 해당 필드를 쓰게 되면 팩토리 누락을 감지하기 어렵다.
  - 제안: 팩토리 overrides 에 `workspaceId?: string` 옵션을 추가하고 기본값(`'ws-1'`)을 반환하도록 보완하면, 기존 테스트가 묵시적으로 의존하던 필드를 명시화하고 회귀를 예방할 수 있다.

- **[WARNING]** `buildFakeCafe24Integration` 팩토리의 `mallId=null` + `credentialsMallId` 케이스에서 `name` 기본값 계산이 실제 entity와 달라 테스트 검증 범위 누락 가능성 존재
  - 위치: `buildFakeCafe24Integration` lines 61–77
  - 상세: `mallId`가 `null`이고 `credentialsMallId`도 지정되지 않으면 `credentialsMallId` 는 `null ?? 'priv-shop'` = `'priv-shop'` 으로 fallback 된다. 그런데 실제 DB row 에서 `mallId=null`인 legacy row 의 `name` 은 `credentials.mall_id`에서 파생된 값이 아니라 사용자가 임의로 지정한 문자열일 수 있다. 팩토리가 `name`을 `` `${credentialsMallId} (Cafe24)` ``로 자동 생성하므로, 테스트가 `name` 필드를 검증하는 경우 실 서비스와 다른 값이 주입된다.
  - 제안: `mallId=null` + `credentialsMallId` 시나리오를 다루는 두 테스트 케이스 (lines 182–193, 311–323) 에서 `name` 을 명시적 override로 설정하거나, 테스트 assertion이 `name` 을 검증하지 않는다는 점을 주석으로 명확히 한다.

- **[INFO]** `omits status when row has a status outside the priority enum` 테스트에서 팩토리 적용 후 `status: 'initializing'`이 유지되는지 확인 필요
  - 위치: `integration-oauth.service.cafe24.spec.ts` lines 294–306 (팩토리 치환 이후)
  - 상세: 원래 인라인 mock은 `status: 'initializing'`을 명시했다. 팩토리 치환 후 diff에는 overrides에 `status` 키가 없어 팩토리 기본값 `'connected'`가 사용될 우려가 있다. 그러나 diff 실제 내용(lines 297–303)을 보면 `status: 'initializing'`이 override에 포함되어 있어 정상이다.
  - 제안: 현재 코드 문제 없음. 팩토리 기본값(status: 'connected')과 충돌할 수 있는 케이스이므로, 향후 비슷한 케이스 추가 시 override 누락에 주의할 것.

- **[INFO]** 컨트롤러 레벨에서 `cafe24/precheck` 라우트 순서 회귀를 검증하는 e2e 테스트가 존재하지 않음 (scope 외 관찰)
  - 위치: `integrations.controller.ts` lines 590–617; `@Get('cafe24/precheck')` 가 `@Get(':id')` 보다 앞에 선언되어야 한다는 주석과 Swagger description 추가
  - 상세: 라우트 순서 역전 시 `ParseUUIDPipe`가 400을 반환하는 회귀는 단위 테스트로 탐지 불가능하고 e2e 레벨에서만 탐지 가능하다. 현재 diff는 Swagger description과 코드 주석으로 경고를 남겼으나, 이는 개발자 의존적이며 빌드 타임 / CI 타임에 자동으로 탐지되지 않는다.
  - 제안: `GET /integrations/cafe24/precheck`를 호출해 200을 확인하는 e2e 시나리오를 추가해 회귀를 CI에서 자동 탐지되도록 한다.

- **[INFO]** `integrations.service.ts`의 트랜잭션 미적용 결정에 대해 단위 테스트에서 `save()` 성공 + `auditLogsService.record()` 실패 시나리오가 커버되지 않음
  - 위치: `integrations.service.ts` lines 1317–1335 (트랜잭션 미적용 주석 추가 블록)
  - 상세: 코드 주석은 트랜잭션 불필요 근거를 상세히 서술하고 있으나, `save()` 성공 후 `auditLogsService.record()` 실패 시 응답이 어떻게 되는지 (`create()` 메서드가 예외를 올리는지, 저장은 유지되는지) 검증하는 테스트가 없다. 해당 경로는 try/catch 블록 내에 있어 예외가 상위로 전파된다.
  - 제안: `integrationRepository.save` 는 성공, `auditLogsService.record` 는 실패로 mock하는 테스트 케이스를 추가해 "audit 실패 시 create가 예외를 던지고 이미 save된 row가 남는다"는 현재 동작을 명시적으로 문서화한다. 의도적인 트레이드오프라면 이를 테스트로 고정해야 회귀가 방지된다.

- **[INFO]** `buildFakeCafe24Integration` 팩토리 자체에 대한 단위 테스트 또는 타입 수준 검증 부재
  - 위치: `integration-oauth.service.cafe24.spec.ts` lines 36–87
  - 상세: 팩토리가 반환하는 `Record<string, unknown>` 타입은 실제 `Integration` entity 타입과 구조적으로 검증되지 않는다. entity 스키마가 변경될 경우 팩토리가 구식 필드를 반환해도 TypeScript가 탐지하지 못한다.
  - 제안: 반환 타입을 `Partial<Integration>` 또는 관련 인터페이스로 좁히거나, `satisfies` 키워드를 활용해 컴파일 타임에 구조 정합성을 확인한다. 단, 테스트 helper에서 완전한 entity 타입을 강제하는 것이 오버엔지니어링이 될 수 있으므로, 최소한 핵심 필드(`credentials`, `mallId`, `status`)를 명시적 타입으로 선언하는 것으로도 충분하다.

## 요약

이번 변경의 핵심은 `buildFakeCafe24Integration` 팩토리 도입을 통한 테스트 코드 중복 제거이며, 이는 유지 보수성과 가독성을 실질적으로 향상시킨다. legacy `mallId=null` + `credentialsMallId` 분리 시나리오를 명시적으로 지원하는 점도 회귀 방지에 기여한다. 단, 팩토리 반환 객체에서 `workspaceId`가 누락된 점, 반환 타입이 `Record<string, unknown>`으로 느슨해 entity 스키마 변경 시 팩토리 부정합을 컴파일 타임에 잡지 못하는 점, 컨트롤러 라우트 순서 회귀가 e2e 테스트로 보호되지 않는 점, audit log 실패 시 create 동작이 테스트로 고정되지 않는 점 등의 개선 여지가 있다. 전반적으로 기능적 테스트 커버리지 자체는 유지되거나 소폭 향상되었으며 전반적인 위험도는 낮다.

## 위험도

LOW
