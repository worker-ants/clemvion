# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `buildFakeCafe24Integration` 팩토리 함수 — 테스트 전용 단일 책임 분리
  - 위치: `integration-oauth.service.cafe24.spec.ts` 라인 42–87 (추가된 코드)
  - 상세: 분산되어 있던 인라인 mock 객체 선언을 `buildFakeCafe24Integration` 단일 팩토리 함수로 통합했다. 테스트 픽스처 조립이라는 단일 책임을 수행하며, `credentialsMallId` override 파라미터로 V045 이전 legacy row(plain `mallId` null + JSONB `credentials.mall_id` 불일치)를 명시적으로 표현한 점이 도메인 복잡성을 캡슐화한다. 이는 SRP 를 테스트 코드에 적용한 올바른 패턴이다.
  - 제안: 특이사항 없음. 다만 반환 타입이 `Record<string, unknown>` 으로 넓게 열려 있어 잘못된 필드명을 컴파일러가 잡지 못할 수 있다. 향후 `Integration` 엔티티 타입 또는 별도 픽스처 타입을 반환 타입으로 사용하면 타입 안전성이 올라간다.

- **[INFO]** `planned.ts` 에 planned 연산 목록 집중 관리 — 메타데이터 레지스트리 패턴
  - 위치: `backend/src/nodes/integration/cafe24/metadata/planned.ts` 라인 339–1732
  - 상세: 이번 변경에서 Phase 8a~8j 로 각 도메인 파일(`mileage.ts`, `promotion.ts`, `translation.ts`, `community.ts`, `design.ts`, `notification.ts`, `privacy.ts`, `personal.ts`, `collection.ts`, `application.ts`)에 직접 추가되었던 연산들이 삭제되고, 동일한 연산 식별자와 레이블이 `CAFE24_PLANNED_BY_RESOURCE` 레코드에 이동되었다. 이는 "아직 구현되지 않은 API 항목"을 별도의 planned 레지스트리에서 관리하는 명확한 모듈 경계 패턴이다. 도메인 파일은 실제로 동작하는 연산만 소유하고, planned 파일은 미래 확장 계획을 담당하는 관심사 분리가 잘 이루어졌다.
  - 제안: 특이사항 없음. 다만 `CAFE24_PLANNED_BY_RESOURCE` 의 키(`community`, `design` 등)와 실제 도메인 파일 이름 사이의 매핑이 암묵적이다. 향후 도메인 파일이 추가될 경우 둘의 동기화를 보장하는 린트 규칙이나 유닛 테스트가 있으면 좋다.

- **[INFO]** `integrations.controller.ts` API description에 라우트 순서 경고 내포
  - 위치: `integrations.controller.ts` 라인 370–371 (변경된 코드)
  - 상세: 동적 `GET /api/integrations/:id` 보다 `GET /api/integrations/cafe24/precheck-mall` 이 앞에 선언되어야 한다는 사실을 API description 문자열에 `**Route order note**` 로 내재화했다. Swagger 문서와 코드 주석 두 곳에 일치시킨 점은 긍정적이나, 이는 아키텍처 레벨의 취약 지점이다.
  - 제안: NestJS `@Get('cafe24/precheck-mall')` 핸들러는 `@Get(':id')` 보다 물리적으로 위에 선언되어야 한다는 제약을 코드 내에서 자체 강제할 수 없다. 이를 e2e 테스트(`GET /integrations/cafe24/precheck-mall?mall_id=xxx` 가 400 이 아닌 200을 반환하는지)에서 회귀 안전망으로 검증하거나, NestJS 버전에서 지원하면 라우트를 별도 컨트롤러로 분리하는 방법도 고려할 수 있다.

- **[INFO]** `integrations.service.ts` 트랜잭션 미적용 의도 설명 주석 추가
  - 위치: `integrations.service.ts` 라인 394–403 (추가된 주석)
  - 상세: `save()` + `auditLogsService.record()` 의 두 연산을 트랜잭션으로 묶지 않은 의도가 주석으로 명시되었다. "audit log 외 부작용이 추가되면 재검토"라는 조건부 경고도 포함되어, 미래 유지보수자에게 설계 결정의 경계를 전달한다. 이는 ADR(Architecture Decision Record)을 코드 내 인라인으로 표현한 패턴으로, 적절한 수준의 추상화 문서화다.
  - 제안: 비즈니스 로직 레이어(`integrations.service.ts`)에 persist + audit 두 부수효과를 순차 실행하는 로직이 함께 있는 구조는 SRP 관점에서 서비스가 두 책임(도메인 저장 + 감사 기록)을 함께 갖는다. 현재 규모에서는 허용 가능하나, 향후 audit 이외의 부수효과(예: 이벤트 발행, 알림)가 늘어나면 Observer / Event-Driven 패턴이나 별도 사이드이펙트 조율 레이어 분리를 검토할 것을 권장한다.

- **[INFO]** 메타데이터 파일들 — 단순 서식 정리 (quote 스타일, line-length)
  - 위치: `customer.ts`, `community.ts`, `promotion.ts`, `supply.ts`, `product.ts`, `mileage.ts` 등 다수 파일
  - 상세: 단일 따옴표↔이중 따옴표 교체, 긴 description 줄의 줄바꿈 정렬이 일괄 적용되었다. 기능 변화 없는 포맷팅 정리로 아키텍처에 영향을 주지 않는다. 다만 프로젝트 전반에 prettier 또는 eslint quote 규칙이 적용되어 있다면 이런 변경이 자동으로 처리되어야 한다.
  - 제안: 린터 설정(`eslint.config.js` 또는 `.prettierrc`)에 quote 정책을 고정하면 향후 리뷰 diff 를 도메인 변경에만 집중할 수 있다.

- **[INFO]** `integration-oauth.service.ts` 타입 별칭 인라인 정렬
  - 위치: `integration-oauth.service.ts` 라인 345–347 (변경된 코드)
  - 상세: `type Cafe24PrecheckStatus` 가 한 줄로 인라인 정렬된 서식 변경이다. 기능 변화 없음.
  - 제안: 해당 없음.

## 요약

이번 변경의 아키텍처 핵심은 두 가지다. 첫째, Phase 8a–8j 에서 각 도메인 메타데이터 파일에 직접 추가되었던 "미구현 연산"들이 `planned.ts` 의 `CAFE24_PLANNED_BY_RESOURCE` 레지스트리로 이동하여, 도메인 파일(실동작)과 planned 파일(미래 계획) 간의 모듈 경계가 명확하게 정립되었다. 둘째, 테스트 픽스처 팩토리 `buildFakeCafe24Integration` 도입으로 spec 파일 내 중복 mock 선언이 단일 진실로 수렴되었다. 나머지 변경은 서식 정리 및 설계 결정 인라인 문서화 수준이다. 전반적으로 관심사 분리와 단일 책임 원칙이 잘 적용된 리팩토링이며, `planned.ts` 와 도메인 파일 간 동기화를 보장하는 자동화 검증 및 controller 라우트 순서 회귀 테스트가 보완되면 아키텍처 견고성이 더 높아진다.

## 위험도

LOW
