# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] `IntegrationActivityItemDto` 에 새 필드 누락 — 암묵적 직렬화 의존
- 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` `IntegrationActivityItemDto` 클래스 (라인 340-355)
- 상세: `GET :id/activity` 컨트롤러는 `IntegrationActivityDto`(`IntegrationActivityItemDto[]` 포함)를 OpenAPI 응답 타입으로 선언하고 있으나, 이번 변경에서 `IntegrationActivityItemDto` 에 `apiLabel`, `apiMethod`, `apiPath` 필드가 추가되지 않았다. 서비스 `getActivity()` 는 `IntegrationUsageLog` 엔티티를 그대로 반환하고, NestJS `ClassSerializerInterceptor` 가 없거나 `@Exclude()` 가 없으면 엔티티 필드 전체가 JSON 에 흘러나간다. 즉 실제로는 새 3개 컬럼이 응답에 포함되어 프런트엔드 `ActivityItem.apiLabel` 등이 동작하지만, OpenAPI 스펙(`IntegrationActivityItemDto`) 과 실제 응답 shape 이 어긋난다. 반대로 Interceptor 설정에 따라 엔티티 필드가 차단되면 프런트엔드는 `undefined` 를 받고 API 셀이 모두 `—` 로 표시된다.
- 제안: `IntegrationActivityItemDto` 에 `@ApiPropertyOptional({ nullable: true }) apiLabel?: string | null;` 등 3개 필드를 추가하거나, 서비스에서 DTO 로 명시적으로 매핑하는 패턴을 사용해 실제 응답과 OpenAPI 선언을 일치시킨다.

### [INFO] 모듈-레벨 전역 변수 `warnedMissingNodeExecutionId` — 기존 동작, 신규 아님
- 위치: `codebase/backend/src/nodes/integration/_base/integration-handler-base.ts` 라인 7
- 상세: `let warnedMissingNodeExecutionId = false;` 는 이번 변경 이전부터 존재하는 모듈-레벨 변수다. 이번 PR 이 새로 도입한 것이 아니며, `api` 필드 전달 경로와 직접적인 부작용 연관은 없다.
- 제안: 해당 없음 (기존 패턴 유지).

### [INFO] 새 상수 3개 모듈 스코프 도입 — 의도된 설계
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `API_LABEL_MAX`, `API_METHOD_MAX`, `API_PATH_MAX`
- 상세: 파일 최상위 `const` 로 선언됐으며 값을 변경하지 않는다. 모듈 외부에서 접근할 수 없는(export 없음) 로컬 상수이므로 공유 상태 오염 없음.
- 제안: 해당 없음.

### [INFO] `extractApiPath` / `extractSqlVerb` 함수 신규 `export`
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` 라인 763, `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` 라인 695
- 상세: 두 함수가 `export function` 으로 공개되었다. 현재 소비처는 테스트 파일뿐이므로 외부 의존자는 없지만, 이를 공개 API 로 선언함으로써 향후 다른 모듈이 import 할 수 있는 계약 표면이 생긴다.
- 제안: 테스트 목적만이라면 `export` 를 유지해도 무방하나, 향후 재사용 시 해당 함수 시그니처 변경이 파급 효과를 갖는다는 점을 인지해야 한다.

### [INFO] `getServiceCatalog` 신규 공개 메서드 추가 — 인터페이스 확장
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` 라인 1047
- 상세: `IntegrationsService` 에 `getServiceCatalog(serviceType: string)` 가 추가됐다. 반환 타입은 DTO 클래스가 아닌 익명 inline 객체 타입으로 선언되어 있어, 컨트롤러가 `OperationCatalogDto` 로 wrapping 하는 계층과 타입 불일치가 있다. 런타임에는 구조가 같아 정상 동작하지만, 타입 시스템 계약이 `OperationCatalogDto` 와 분리되어 있어 향후 필드 추가 시 둘 중 하나만 갱신되는 drift 위험이 있다.
- 제안: 서비스 반환 타입을 `OperationCatalogDto` (혹은 분리 인터페이스)로 통일해 단일 진실을 유지한다.

### [INFO] `apiInfo` 로컬 변수를 try 블록 외부에 선언 후 내부에서 변경 — 의도된 패턴, 부작용 없음
- 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts` 라인 591-597, `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts` 라인 793-796
- 상세: `apiInfo` 객체를 try 블록 외부에 선언하고 내부에서 `method`/`path` 를 채운 뒤, catch 블록에서도 참조하는 패턴이다. 이는 catch 경로에서 `method`/`path` 가 null 인 채로 로깅된다는 점이 명백히 기록되어 있고 의도된 fallback 이다. 공유 상태 변경이 아닌 지역 변수이므로 부작용 없음.

### [INFO] `listAllCafe24Operations()` 호출 — 동기·순수 함수, 외부 호출 없음
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `getServiceCatalog` 메서드
- 상세: `listAllCafe24Operations()` 는 메모리 내 상수(`CAFE24_OPERATIONS_BY_RESOURCE`)를 순회하는 순수 함수이며 네트워크·파일시스템·DB 접근이 없다. 요청마다 전체 배열을 재생성하는 비용이 있으나 성능 임계치 문제는 현재 규모에서 미미하다.

### [INFO] 프런트엔드 `useQuery` 두 번째 쿼리 추가 — 의도된 네트워크 호출
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` 라인 878-882
- 상세: `ActivityTab` 렌더 시 `GET /api/integrations/services/:serviceType/catalog` 를 staleTime 1시간으로 추가 fetch 한다. 이는 의도된 네트워크 호출이며, 캐시 공유(`["integrations","catalog",serviceType]`) 설계도 적절하다. cafe24 가 아닌 서비스 타입에서도 빈 배열 응답이 오기 때문에 불필요한 백엔드 부하가 발생할 수 있으나, 1회 fetch 후 1시간 캐시이므로 실질적 영향은 낮다.

### [INFO] i18n dict 에 `cafe24Catalog` 슬롯 추가 — 전역 i18n 객체 shape 변경
- 위치: `codebase/frontend/src/lib/i18n/dict/ko/index.ts`, `codebase/frontend/src/lib/i18n/dict/en/index.ts`
- 상세: 두 locale의 최상위 dict 객체에 `cafe24Catalog` 키가 추가된다. 빈 객체(`{}`)이므로 기존 번역 키에 영향이 없으나, `TranslationKey` 타입이 dict 구조로부터 자동 파생되는 경우 타입 표면이 넓어진다.

## 요약

이번 변경의 핵심 부작용 관점 위험은 한 곳에 집중된다. `GET :id/activity` 응답 DTO(`IntegrationActivityItemDto`)에 새 3개 컬럼(`apiLabel`, `apiMethod`, `apiPath`)이 반영되지 않았다. 서비스 레이어가 엔티티 전체를 반환하므로 런타임에는 필드가 흘러나와 프런트엔드가 동작하지만, OpenAPI 선언과 실제 응답이 불일치한다. Interceptor 설정에 따라서는 필드가 차단될 수도 있어 런타임 회귀 가능성이 잠재한다. 나머지 변경(새 상수, 신규 export, 추가 쿼리, 로컬 변수 패턴)은 모두 의도된 설계이며 의도치 않은 전역 상태 변경, 파일시스템 부작용, 환경 변수 오용, 이벤트/콜백 변경은 발견되지 않았다.

## 위험도

LOW
