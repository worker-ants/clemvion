# 신규 식별자 충돌 검토 결과

## 검토 범위 요약

target 은 `spec/4-nodes/4-integration` (impl-done, diff-base=main). 실제 `git diff origin/main...HEAD` 를 절대경로 워킹트리에서 직접 확인한 결과, 코드 변경분은 `codebase/backend/src/nodes/integration/cafe24/metadata/*.ts` 21개 파일(총 +18,477/-1,734)로, Cafe24 API 카탈로그의 **기존 resource/operation 에 필드셋을 보강**(공식 문서와의 field-set 미러링, 최근 커밋 이력 "G-1-remaining field-set docs 미러" 시리즈와 일치)하는 작업이다. spec 본문(`0-common.md`/`1-http-request.md`/`2-database-query.md` 등)에 포함된 SSRF 메시지 일반화(§8.3, `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)·pub/sub 채널(`integration:cache:invalidate`) 관련 서술은 모두 이전 세션(#809/#814 등, 사용자 메모리 기록 확인)에서 이미 완료·정착된 식별자로, 본 diff 의 신규 도입물이 아니다.

## 발견사항

### 신규 상수 식별자 — `CAFE24_DATE_FIELD_CREATED_START/END`, `CAFE24_DATE_FIELD_UPDATED_START/END`

- **[INFO]** 기존 `CAFE24_DATE_FIELD_SINCE`/`CAFE24_DATE_FIELD_UNTIL` (mileage 등에서 사용 중, `date-descriptions.ts`)와 명명 패턴이 유사하나 의미는 명확히 분리된다.
  - target 신규 식별자: `CAFE24_DATE_FIELD_CREATED_START`, `CAFE24_DATE_FIELD_CREATED_END`, `CAFE24_DATE_FIELD_UPDATED_START`, `CAFE24_DATE_FIELD_UPDATED_END` (`codebase/backend/src/nodes/integration/cafe24/metadata/date-descriptions.ts` 신규 export, `application.ts` 등 다수 소비)
  - 기존 사용처: 동일 파일의 `CAFE24_DATE_FIELD_SINCE` / `CAFE24_DATE_FIELD_UNTIL` (변경 전부터 존재, `mileage.ts` 등에서 소비)
  - 상세: `SINCE`/`UNTIL` 은 단일 검색 범위(예: 마일리지 조회 기간)를, 신규 `CREATED_START/END`·`UPDATED_START/END` 는 Cafe24 다수 list/count endpoint 의 `created_start_date`/`created_end_date`/`updated_start_date`/`updated_end_date` 쌍을 표현한다. 의미가 겹치지 않고 접두어(`SINCE/UNTIL` vs `CREATED_*/UPDATED_*`)로 명확히 구분되어 실질 충돌은 없다.
  - 제안: 없음(현재 명명으로 충분히 구분됨). 향후 세 번째 유사 패턴(예: `expire_date` 범위)이 추가될 경우 `CAFE24_DATE_FIELD_<VERB>_START/END` 네이밍 컨벤션을 conventions 문서에 명문화하는 것을 권장(현재는 파일 주석에만 설명).

### API path 재사용 — 기존 정의된 endpoint 에 필드 추가

- **[INFO]** `order.ts`/`product.ts`/`store.ts`/`design.ts` diff 에서 다수의 `path:` 라인이 `+` 로 표시되나, 이는 신규 endpoint 도입이 아니라 **기존에 이미 `origin/main` 에 존재하던 path**(예: `products/{product_no}/options`, `orders/migrations`, `exchange/{claim_code}`)를 가진 operation 객체를 멀티라인으로 재포맷하며 필드를 추가한 결과다. `git show origin/main:...` 로 직접 대조해 사전 존재를 확인했다.
  - target 신규 식별자: 해당 없음(신규 endpoint 아님)
  - 기존 사용처: `origin/main` 시점의 동일 `metadata/*.ts` 파일 내 동일 path
  - 상세: 동일 path 에 여러 operationId(GET/POST/PUT 등)가 매핑되는 것은 Cafe24 카탈로그의 기존 패턴이며 이번 diff 로 신규 중복이 발생하지 않았다.
  - 제안: 없음.

### 테스트 파일 신설 — `product-fields.spec.ts`

- **[INFO]** 신규 파일 `codebase/backend/src/nodes/integration/cafe24/metadata/product-fields.spec.ts` 는 기존 `metadata.spec.ts`/`public-meta.spec.ts`/`catalog-sync.spec.ts` 등과 동일한 `<topic>.spec.ts` 명명 컨벤션을 따르며 경로 충돌이나 컨벤션 이탈이 없다.

### 사전 정착 식별자 확인 (충돌 아님, 참고용)

- `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED` 에러 코드, `integration:cache:invalidate` Redis pub/sub 채널은 target payload 본문에 등장하지만 코드(`codebase/backend/src/nodes/core/error-codes.ts`, `codebase/backend/src/common/redis/integration-cache-bus.service.ts`)에 이미 구현·테스트(`execution-failure-classifier.spec.ts` 등)까지 존재하는 기 정착 식별자다. 폐기된 `execution:continuation` pub/sub 채널과도 명확히 구분되어 있어(§Rationale 교차 서술) 신규 식별자 충돌 항목에 해당하지 않는다.

## 요약

실제 코드 diff(`origin/main...HEAD`)를 워킹트리에서 직접 대조한 결과, 이번 변경은 Cafe24 API 카탈로그 기존 resource/operation 에 대한 필드셋 보강(공식 문서 field-set 미러링)이며 신규 요구사항 ID, 신규 엔티티/DTO/인터페이스명, 신규 API endpoint, 신규 이벤트/큐 이름, 신규 환경변수·설정키를 도입하지 않는다. 유일하게 새로 추가된 식별자군은 `CAFE24_DATE_FIELD_CREATED_START/END`·`CAFE24_DATE_FIELD_UPDATED_START/END` 상수이며, 기존 `CAFE24_DATE_FIELD_SINCE/UNTIL` 과 명명·의미가 명확히 분리되어 있어 실질 충돌이 없다. spec 본문에 언급된 SSRF 에러 코드·pub/sub 채널명은 이전 세션에서 이미 완료·정착된 식별자로 이번 target 의 "신규 도입" 범주에 해당하지 않는다.

## 위험도

NONE
