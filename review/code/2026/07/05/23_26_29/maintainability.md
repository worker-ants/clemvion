### 발견사항

- **[INFO]** `design.ts` 는 다른 리소스 파일과 달리 필드 객체를 인라인 확장할 때 스타일이 혼재
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/design.ts:25-33` 등 (`shop_no: { type: 'number', location: 'query', default: 1 }` 한 줄 유지 vs 신규 `type` 필드는 멀티라인 + `description`)
  - 상세: 같은 필드 객체(`fields`) 안에서 `shop_no` 는 `description` 없이 한 줄로 남아 있고, 바로 옆에 추가된 `type` 필드는 `description` 을 포함한 멀티라인 스타일이다. 다른 리소스 파일(application/collection/mileage 등)은 이번 diff 에서 `shop_no` 도 함께 `description` 을 붙여 멀티라인으로 통일했는데, design.ts 는 일부만 통일하고 일부(예: `themes_list`, `themes_detail`)는 기존 한 줄 스타일 그대로 남겨 파일 내부 일관성이 떨어진다.
  - 제안: `shop_no` 등 기존 필드도 `description` 을 채워 멀티라인으로 통일하거나, 최소한 "이 파일은 왜 예외인지"를 헤더 주석에 명시. (기능에는 영향 없는 순수 스타일 이슈이므로 우선순위는 낮음.)

- **[INFO]** 각 metadata 파일 상단에 거의 동일한 "G-1-remaining 규칙" JSDoc 블록이 리소스 파일마다 반복 붙음
  - 위치: `application.ts`, `collection.ts`, `design.ts`, `mileage.ts`, `personal.ts`, `shipping.ts`, `translation.ts` 등 각 파일 최상단
  - 상세: "필드명은 docs Parameter 를 그대로 사용", "offset/limit 은 field 로 넣지 않는다", "requiredFields 는 기존 계약 ∩ 신규 fields keys" 같은 규칙 문장이 파일마다 거의 그대로 복사돼 있다(문구만 리소스명이 다름). 이는 코드 중복은 아니지만 문서 중복이며, 규칙이 바뀌면 17개 파일을 동기화해야 하는 유지보수 부담이 생긴다.
  - 제안: 공용 규칙은 `metadata/README.md` 또는 `types.ts` 상단 한 곳에 SoT 로 두고, 각 리소스 파일의 헤더는 "공용 규칙 참고 + 이 리소스 고유 예외"만 남기는 편이 낫다. 다만 이는 기존에도 반복되던 프로젝트 관례(다른 cafe24 리소스 파일들의 선례)로 보이며, 이번 PR 이 새로 만든 패턴이 아니라 확장한 것이므로 CRITICAL 로 보지 않는다.

- **[INFO]** `Cafe24OperationMetadata` 필드 객체 리터럴이 매우 반복적(수백 개의 `{ type, location, description, ... }` 블록)이라 diff/리뷰 가독성이 낮음
  - 위치: 전 파일 공통 (예: `application.ts` 전체, `notification.ts` 전체)
  - 상세: 이는 데이터 카탈로그 미러링이라는 작업 성격상 불가피한 반복이며 로직 중복이 아니다. 다만 파일당 라인 수가 크게 늘어(예: `notification.ts` diff 만 500줄+) 향후 개별 필드 수정 시 diff noise 가 커질 수 있다.
  - 제안: 현재 방식(정적 배열/객체 리터럴)이 타입 안정성과 handler 소비 방식(`buildRequest`가 field key 를 그대로 파라미터명으로 사용)에 맞아 실용적이다. 별도 코드 변경 제안 없음 — 반복 자체는 스키마 데이터의 본질적 특성.

- **[INFO]** `salesreport.ts` 에서 `CAFE24_DATE_FIELD_SINCE`/`CAFE24_DATE_FIELD_UNTIL` import 를 제거하면서 동일 의미의 문자열(`'Search start date (YYYY-MM-DD, KST)'`)을 각 operation 마다 인라인 하드코딩
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/salesreport.ts` (diff 내 5개 operation 모두 동일 description 반복)
  - 상세: 이 PR 은 다른 파일(application/mileage/privacy)에서는 `date-descriptions.ts` 의 공용 상수(`CAFE24_DATE_FIELD_CREATED_START` 등)를 적극 도입해 "30+ resource 의 동일 패턴을 일관화"한다고 밝혔는데(date-descriptions.ts 헤더 주석), salesreport.ts 는 반대로 공용 상수 import 를 걷어내고 리터럴 문자열을 5곳에 복제했다. 같은 PR 안에서 상반된 방향의 리팩터링이 공존해 일관성이 떨어진다.
  - 제안: salesreport 의 `start_date`/`end_date` description 도 기존 `CAFE24_DATE_FIELD_SINCE`/`CAFE24_DATE_FIELD_UNTIL` (또는 신설된 공용 상수)을 계속 사용하도록 되돌리거나, 그럴 수 없는 이유(문구가 미묘하게 다름 등)가 있다면 파일 헤더 주석에 명시. 기능 영향은 없음.

- **[INFO]** `product-fields.spec.ts` 신규 회귀 테스트는 목적과 구조가 명확하고 가독성이 좋음
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/product-fields.spec.ts`
  - 상세: `op()` 헬퍼, describe/it 네이밍, "대량 미러가 조용히 축소되지 않도록" 등 의도 설명 주석이 잘 갖춰져 있다. 다만 `toBeGreaterThanOrEqual(50)` 같은 하한값에 대해 "docs 표는 57개, floor 는 50" 이라는 주석으로 매직넘버를 설명하고 있어 매직넘버 자체는 문제 없음(의도 문서화됨).
  - 제안: 없음 (참고용 긍정 사항).

### 요약
이번 변경은 cafe24 통합 노드의 `metadata/*.ts` 21개 리소스 파일에 걸쳐 공식 docs 카탈로그의 요청 파라미터 표를 필드 단위로 1:1 미러링하는 대규모 데이터 확장이며, 로직/제어흐름 변경이 아니라 선언적 스키마(정적 배열·객체 리터럴) 확장이라 함수 길이·중첩 깊이·순환 복잡도 관점의 리스크는 사실상 없다. 각 리소스 파일 상단에 "docs-verbatim 미러 규칙"을 설명하는 JSDoc 을 일관되게 추가하고, `date-descriptions.ts` 에 공용 date-range 상수 4종을 신설해 KST 설명을 재사용하도록 한 점, 그리고 회귀를 방지하는 타깃 유닛 테스트(`product-fields.spec.ts`, `public-meta.spec.ts` 갱신)를 추가한 점은 유지보수성 측면에서 바람직하다. 다만 (1) 헤더 주석 문구가 파일마다 거의 동일하게 복제돼 규칙 변경 시 다중 동기화 부담이 있고, (2) `design.ts` 내부에서 필드 객체 스타일(한 줄 vs 멀티라인+description)이 혼재하며, (3) 같은 PR 안에서 `salesreport.ts` 만 공용 date 상수 사용을 되레 제거하고 리터럴을 복제하는 등 파일 간 경미한 스타일 비일관성이 존재한다. 모두 기능 결함이 아닌 사소한 스타일 이슈이며, 전체적으로 코드베이스의 기존 cafe24 관례(반복적 리소스별 파일 구조, docs-mirror 방식)를 그대로 따른 자연스러운 확장으로 판단된다.

### 위험도
LOW
