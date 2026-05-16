### 발견사항

- **[INFO]** `GET /api/integrations/cafe24/precheck` 라우트 순서 의존성이 Swagger description 에만 문서화됨
  - 위치: `integrations.controller.ts` L373-374 (diff), 전체 파일 L593-598 (컨트롤러 주석)
  - 상세: `GET cafe24/precheck`가 동적 경로 `GET :id` 보다 앞에 선언되어야 한다는 제약이 컨트롤러 주석과 Swagger `description` 문자열 두 곳에 설명되어 있다. 이번 변경에서 Swagger description 에도 "Route order note"를 추가한 것은 문서화 측면에서 긍정적이나, 런타임 보호 장치(예: e2e 테스트에서 `GET /api/integrations/cafe24/precheck?mallId=x`를 실제로 호출해 200을 확인하는 케이스)는 별도로 존재해야 한다. 해당 라우트 충돌은 빌드 타임에 탐지되지 않으므로 회귀 위험이 잠재한다.
  - 제안: e2e 테스트에서 `GET /api/integrations/cafe24/precheck?mallId=<valid>` 호출 시 400이 아닌 200을 받는다는 보장 케이스를 추가해 라우트 순서 회귀를 런타임에 탐지할 것.

- **[INFO]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드 이름과 실제 의미 간 불일치가 공개 API 문서에 노출됨
  - 위치: `integrations.controller.ts` 전체 파일 L552-555 (`@ApiConflictResponse` description)
  - 상세: 에러 코드 이름에 `PRIVATE`가 포함되어 있으나 실제로는 public/private 구분 없이 동일 mall_id 중복 시 발생한다는 사실이 Swagger description에 "historical artifact"로 명시되어 있다. 클라이언트가 코드 이름으로 분기할 경우 오해를 유발할 수 있다. 현재 변경에서 이 부분이 개선된 것은 아니며 기존 API 계약을 유지한 상태이나, 장기적으로 코드 이름이 의미를 정확히 반영하지 않으면 클라이언트 통합 시 혼란이 발생할 수 있다.
  - 제안: 다음 major 버전 업 또는 breaking-change 허용 시점에 `CAFE24_MALL_ALREADY_CONNECTED` 등 app_type 중립적인 코드 이름으로 교체하는 것을 고려할 것. 현재 시점에서는 Swagger description의 설명으로 충분히 완화되어 있음.

- **[INFO]** `buildFakeCafe24Integration` factory의 `mallId` null 처리 시 `credentialsMallId` fallback 로직이 실제 서비스 코드의 V045 이중 조회 로직과 대응하는지 명시적 확인 불가
  - 위치: `integration-oauth.service.cafe24.spec.ts` L64-67 (diff, 신규 추가 factory 함수)
  - 상세: 테스트 전용 코드이므로 API 계약에 직접적인 영향은 없으나, `mallId: null` + `credentialsMallId: 'pub-shop'` 조합으로 만들어지는 legacy mock 객체가 실제 DB row 구조를 정확히 반영하는지는 서비스 코드의 V045 마이그레이션 로직에 의존한다. factory 주석("`V045 plain mall_id 와 JSONB credentials.mall_id 가 다른 legacy 케이스도 지원`")은 이를 인지하고 있음을 나타내나, factory가 잘못된 구조를 반환하면 테스트가 잘못된 계약을 검증하게 된다.
  - 제안: 해당 없음 (테스트 코드이므로 API 계약 직접 위반은 아님). 단, 서비스 코드의 V045 legacy 처리와 factory 구조의 일치 여부를 integration/e2e 테스트로 보완할 것을 권장.

### 요약

이번 변경의 핵심은 테스트 파일의 인라인 mock 객체를 `buildFakeCafe24Integration` factory 함수로 통합한 리팩토링과, 서비스/컨트롤러 코드의 소규모 문서화 개선이다. API 계약 관점에서 breaking change는 없으며, 새로 추가된 엔드포인트나 응답 스키마 변경도 없다. 컨트롤러에서 `GET cafe24/precheck`의 라우트 순서 제약이 Swagger description에 추가 문서화된 것은 긍정적이나 런타임 회귀 방어는 e2e 테스트로 보완이 필요하다. `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드의 의미 불일치는 기존부터 존재하던 기술 부채로, 이번 변경에서 악화되지는 않았으나 장기 관리가 필요하다. 전반적으로 API 계약 측면의 위험도는 낮다.

### 위험도
LOW
