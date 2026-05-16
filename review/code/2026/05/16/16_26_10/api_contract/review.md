# API 계약(API Contract) Review

## 발견사항

- **[WARNING]** Cafe24 외부 API 조작 메타데이터 다수 삭제 — 하위 호환성 위험
  - 위치: `backend/src/nodes/integration/cafe24/metadata/application.ts`, `collection.ts`, `community.ts`, `design.ts`, `mileage.ts`, `notification.ts`
  - 상세: Phase 8a/8g/8h/8i/8j 등에서 추가되었던 operation 항목들(appstore orders/payments, databridge logs, recipes, manufacturers CRUD, trends/classifications/origin, themes CRUD/pages/icons, points_report, boards extras, commenttemplates CUD, urgentinquiry, notification groups 등)이 이번 diff 에서 일괄 제거되었다. 이 메타데이터는 프론트엔드 또는 내부 노드 실행기가 허용 operation 목록을 참조해 Cafe24 외부 API 를 호출하는 계약 역할을 한다. 해당 operation id 를 사용 중인 기존 워크스페이스·플로우가 있다면, 삭제 후 operation 을 찾지 못해 런타임 오류가 발생할 수 있다.
  - 제안: 삭제 이유(scope 축소, spec 미정, 품질 미달 등)를 코드 주석 또는 spec Rationale 에 명시하고, 이미 저장된 플로우에서 해당 operation id 를 참조하는 경우에 대한 마이그레이션·경고 전략을 수립한다. 단순 삭제가 아니라 `deprecated` 표시 후 유예 기간을 두는 방법도 고려한다.

- **[INFO]** `integrations.controller.ts` Swagger `description` 에 route 선언 순서 제약 문서화
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` line ~374
  - 상세: `GET /api/integrations/cafe24/precheck` 가 동적 `GET /api/integrations/:id` 보다 앞에 선언되어야 한다는 제약이 Swagger description 문자열 안에 인라인으로 기술되어 있다. 이는 유용한 정보이지만 Swagger UI 에서 최종 사용자에게도 노출된다. API 소비자에게 불필요한 구현 세부사항이다.
  - 제안: route 순서 제약은 Swagger description 에서 제거하고, 컨트롤러 소스 코드 주석(예: 해당 `@Get('cafe24/precheck')` 데코레이터 바로 위 블록 주석)으로만 남기는 것을 권장한다. spec Rationale 참조 링크는 유지해도 무방하다.

- **[INFO]** 테스트 mock 에서 `workspaceId` 필드 제거
  - 위치: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts`, `buildFakeCafe24Integration` factory 함수
  - 상세: 기존 인라인 mock 에 있던 `workspaceId: 'ws-1'` 필드가 신규 factory 에서 제외되었다. 실 서비스 코드가 중복 체크 시 `workspaceId` 를 필터 조건으로 사용한다면 mock 의 누락이 테스트 커버리지 사각지대를 만들 수 있다.
  - 제안: `IntegrationOAuthService.begin` 내부의 `integrationRepo.find` 호출 조건을 확인해, `workspaceId` 가 쿼리 조건에 포함된다면 factory 에 `workspaceId` 를 추가하거나 최소한 테스트 케이스에서 명시적으로 지정한다.

## 요약

이번 변경의 핵심은 테스트 mock 팩토리 함수 도입(코드 품질 개선)과 Cafe24 operation 메타데이터 대규모 삭제다. API 계약 관점에서 가장 주목할 부분은 여러 metadata 파일에서 다수의 Cafe24 operation entry 가 일괄 제거된 점이다. 이 메타데이터는 이 시스템이 Cafe24 외부 API 와 맺는 계약의 일부로, 기존에 배포된 플로우·워크스페이스가 해당 operation id 를 참조한다면 breaking change 가 된다. 내부 API(`/integrations/cafe24/precheck`)의 계약 자체(요청 파라미터, 응답 스키마, HTTP 상태 코드, 인증)는 변경되지 않았으며, Swagger description 개선과 트랜잭션 미적용 이유 주석은 계약에 영향을 주지 않는다.

## 위험도

MEDIUM
