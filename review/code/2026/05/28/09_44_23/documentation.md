# 문서화(Documentation) 코드 리뷰

리뷰 대상: integration-activity-api-label (통합 활동 로그 API 식별 정보 추가)
리뷰 일시: 2026-05-28

---

## 발견사항

### [INFO] SQL 마이그레이션 파일: 문서화 수준이 모범적
- 위치: `codebase/backend/migrations/V064__integration_usage_log_api_columns.sql`
- 상세: 마이그레이션 파일 헤더에 관련 spec 링크 5개, 결정 사항(nullable 이유, backfill 없음, 인덱스 없음, varchar 길이 근거, truncate 정책) 을 완전히 기술. SQL 마이그레이션 파일에서 이 수준의 주석은 매우 우수하다.
- 제안: 없음.

### [INFO] 엔티티 필드 주석: 적절하나 `apiMethod`/`apiPath` 설명이 대칭적이지 않음
- 위치: `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts` lines 157-170
- 상세: `apiLabel` 은 SoT 링크까지 포함한 완전한 JSDoc 블록을 가지고 있으나, `apiMethod` 와 `apiPath` 는 단일 인라인 주석(`/** ... */`)만 있다. 두 필드 모두 "통합별 의미 다름" 이라고 명시하지만, 각 통합별 실제 의미(cafe24: HTTP method, database: SQL 동사, email: `SEND`, http: HTTP method) 는 코드에서 바로 확인할 수 없고 `integration-handler-base.ts` JSDoc 또는 spec 을 봐야 한다.
- 제안: 없음 필수 사항은 아님. 다만 `apiMethod`/`apiPath` 도 `apiLabel` 처럼 `SoT: spec/4-nodes/4-integration/_product-overview.md INT-US-05` 링크를 단 라인 추가하면 독자 경험이 개선된다.

### [WARNING] `IntegrationUsageParams.api` 필드: JSDoc 에 `label` 필드가 비대칭적으로 빠진 개별 최대 길이 명시
- 위치: `codebase/backend/src/nodes/integration/_base/integration-handler-base.ts` lines 545-557
- 상세: JSDoc 에 길이 한도를 "label 128, method 8, path 256" 이라고 묶어 문장으로 기재하고 있다. 각 서브 필드의 타입이 `string | null | undefined` 인데 nullable vs undefined 의 차이(빈 문자열 → null 코어스 포함)가 이 JSDoc 에서는 언급되지 않는다. 소비자 입장에서 `""` 를 전달하면 어떻게 처리되는지 알 수 없다.
- 제안: JSDoc 의 "길이 한도" 문장 뒤에 "빈 문자열은 null 로 정규화됨" 한 줄을 추가한다. 예: `빈 문자열 및 undefined 는 null 로 정규화됩니다 (clampApiField 참조).`

### [INFO] `clampApiField` 함수: JSDoc 있으나 edge-case(max <= 1) 미설명
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` lines 384-400
- 상세: `if (max <= 1) return raw.slice(0, max)` 분기는 코너 케이스 처리이지만 JSDoc 에 설명이 없다. 실제 운용에서 max 값은 상수(128/8/256)이므로 이 분기가 실행되는 일은 없지만, 함수를 다른 컨텍스트에서 재사용할 경우 의도가 불명확하다.
- 제안: JSDoc 에 `max <= 1 인 경우 ellipsis 를 붙이지 않고 단순 슬라이싱` 한 줄 추가 또는 해당 분기에 인라인 주석 추가.

### [INFO] `getServiceCatalog`: 반환 타입이 인라인 익명 객체 — DTO 클래스와 불일치
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` lines 447-469
- 상세: 컨트롤러 `@ApiOkWrappedResponse` 는 `OperationCatalogDto` 를 사용하지만, 서비스 메서드의 반환 타입 주석은 `{ operations: Array<{ key: string; method: string; ... }> }` 인라인 형태다. Swagger 문서화 목적의 DTO 클래스(`OperationCatalogDto`) 와 서비스 레이어의 반환 타입이 분리되어 있어, 향후 DTO 에 필드가 추가될 경우 서비스 타입과의 동기화 누락 위험이 있다. 현재 JSDoc 은 이 분리 이유를 설명하지 않는다.
- 제안: 서비스 메서드 반환 타입을 `OperationCatalogDto` 로 직접 지정하거나, JSDoc 에 "타입은 DTO 와 구조적으로 동일하나 클래스 의존성을 피하기 위해 인라인으로 정의" 라는 이유를 한 줄 추가.

### [INFO] 컨트롤러 `getServiceCatalog`: 메서드에 별도 JSDoc 없음
- 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` lines 202-222
- 상세: `@ApiOperation` description 에 충분한 설명이 있어 Swagger 문서화는 양호하다. 다만 코드 레벨 JSDoc(`/** ... */`) 이 없어 IDE hover 시 타입 정보만 노출된다. 다른 컨트롤러 메서드들이 JSDoc 를 가지는지 여부에 따라 일관성 문제가 될 수 있다.
- 제안: 기존 컨트롤러 메서드 스타일과 일치하면 문제없음. 라우트 순서 주의 사항은 이미 인라인 주석으로 잘 설명됨.

### [INFO] `extractSqlVerb`: 공개 함수이나 `export` 목적 미설명
- 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` lines 404-700
- 상세: `export function extractSqlVerb` 로 공개 export 되어 있고 JSDoc 도 있다. 그런데 이 함수가 테스트 용도로만 export 된 것인지, 다른 모듈에서도 재사용 가능한 유틸리티로 의도된 것인지 명확하지 않다. 현재 소비처는 같은 파일 내 핸들러뿐이므로 `export` 는 테스트 접근을 위한 것으로 보인다.
- 제안: JSDoc 에 `@internal 테스트 접근 목적으로만 export` 표기를 추가하거나, 별도 유틸 파일로 이동. 현재 상태도 크게 문제없음.

### [INFO] `extractApiPath`: 보안 의도가 JSDoc 에 잘 설명됨
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` lines 763-771
- 상세: query string 제거 이유(PII/credentials 누출 방지)와 relative URL fallback 이유가 JSDoc 에 명확히 서술되어 있다. 이 수준의 보안 의도 문서화는 모범 사례다.
- 제안: 없음.

### [WARNING] 프론트엔드 `renderApiCell` / `tryTranslateLabel`: 현재 dict 가 비어있다는 사실이 주석에만 존재
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` lines 1003-1047
- 상세: `renderApiCell` 의 주석에 "본 PR 에서는 dict 가 빈 상태라 사실상 모든 cafe24 호출도 endpoint-only fallback 으로 흐른다" 고 명시하고, `tryTranslateLabel` 의 JSDoc 에도 "현재 dict 는 빈 상태이므로 항상 null" 이라고 설명한다. 이는 기능이 완전히 동작하지 않는 상태로 UI 가 배포되는 것을 의미하는데, 이 사실이 코드 주석에만 존재하고 사용자에게 노출되는 UI 나 README/CHANGELOG 에는 명시가 없다.
- 제안: 코드 주석만으로 충분하다고 판단되면 현 상태 유지 가능. 다만 UI 동작이 불완전한 상태(라벨 표시 없음)를 인식하는 팀원을 위해 `cafe24-catalog-i18n.md` plan 링크를 주석에 포함하면 더 명확하다. `tryTranslateLabel` JSDoc 에 follow-up plan 파일 경로(`plan/in-progress/cafe24-catalog-i18n.md`) 를 `@see` 로 추가하는 것을 권장.

### [INFO] `ActivityItem` 인터페이스: 필드 asymmetry 설명이 양호
- 위치: `codebase/frontend/src/lib/api/integrations.ts` lines 1072-1081
- 상세: `apiLabel?/apiMethod?/apiPath?` 3필드에 대해 통합별 채우기 정책 비대칭성과 SoT 링크가 JSDoc 에 명시되어 있다. 프론트엔드 API 클라이언트 인터페이스에서 이 수준의 문서화는 적절하다.
- 제안: 없음.

### [INFO] `cafe24Catalog.ts` (KO): 풍부한 JSDoc, EN 파일은 KO 를 참조만 함
- 위치:
  - `codebase/frontend/src/lib/i18n/dict/ko/cafe24Catalog.ts`
  - `codebase/frontend/src/lib/i18n/dict/en/cafe24Catalog.ts`
- 상세: KO 파일은 사용 맥락, follow-up plan, key 형식 예시, SoT 링크를 완전히 기술한다. EN 파일은 "See dict/ko/cafe24Catalog.ts for rationale" 로 위임한다. 이 방식은 중복을 피하고 KO 를 canonical 로 다루는 합리적 전략이다. 단, EN 파일의 JSDoc 에 follow-up plan 파일 명(`cafe24-catalog-i18n.md`) 참조가 있어 추적 가능성도 확보됨.
- 제안: 없음.

### [INFO] CHANGELOG 파일 부재
- 위치: 프로젝트 루트 또는 `codebase/` 하위
- 상세: 이번 변경에서 CHANGELOG.md 는 추가/수정되지 않았다. `plan/in-progress/integration-activity-api-label.md` 가 상세 변경 이력을 담고 있고, 일관성 검토 산출물도 존재한다. 프로젝트 규약(`CLAUDE.md`) 상 CHANGELOG 관련 의무 조항이 보이지 않으므로 누락이 아닐 수 있다.
- 제안: 프로젝트가 외부 사용자를 위한 공개 CHANGELOG 를 유지하지 않는다면 현 상태 적절. 유지한다면 "통합 활동 탭에 API 컬럼 추가 (cafe24 라벨 fill follow-up 예정)" 한 항목을 추가할 것을 권장.

### [INFO] README 업데이트 불필요
- 위치: 프로젝트 루트
- 상세: 새 환경변수 추가 없음, 새 설치 단계 없음, 신규 public API 는 Swagger 로 자동 문서화됨. 마이그레이션 파일 자체가 데이터베이스 변경을 문서화한다. README 업데이트 필요성 없음.

---

## 요약

이번 변경은 전반적으로 문서화 수준이 높다. SQL 마이그레이션 파일의 헤더 주석, `IntegrationHandlerBase.IntegrationUsageParams.api` 의 JSDoc, `extractApiPath` 의 보안 의도 설명, `cafe24Catalog.ts` 의 follow-up plan 연계 주석 등이 특히 모범적이다. 두 가지 경미한 개선 사항이 있다. 첫째, `IntegrationUsageParams.api` 의 JSDoc 에 빈 문자열 정규화 동작(null 코어스)이 명시되지 않아 소비자 코드 작성 시 혼란 가능성이 있다. 둘째, `renderApiCell`/`tryTranslateLabel` 의 "dict 가 비어있어 항상 fallback" 상태가 코드 주석에만 존재하고 follow-up plan 참조 링크가 없어 코드를 처음 보는 개발자가 이것이 의도적 미완성인지 버그인지 즉시 판단하기 어렵다. API 엔드포인트는 Swagger 데코레이터로 완전히 문서화되어 있고, plan 파일과 consistency-check 산출물이 변경 이력을 충분히 기록하고 있다.

---

## 위험도

LOW
