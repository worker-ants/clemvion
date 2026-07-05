# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `shop_no` field 객체가 파일 전체에서 53회 완전히 동일하게 반복됨(type/location/default/description 4-5줄)
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/product.ts` (예: L182-186, L515-519, L591-596, L1370-1375 등 62개 operation 전역)
  - 상세: `{ type: 'number', location: 'query'|'body', default: 1, description: 'Multi-shop number (default 1)' }` 형태의 리터럴이 62개 operation 대부분에 그대로 복붙되어 있다. 공용 상수/헬퍼(`CAFE24_SHOP_NO_FIELD` 등)로 추출하면 4530줄 파일에서 수백 줄을 줄일 수 있다. 다만 이 파일이 속한 `metadata/` 폴더 전체 컨벤션(예: `order.ts`)도 동일하게 `shop_no` 를 인라인 반복하고 있어, 이번 diff 만의 새 문제라기보다 **기존 코드베이스 스타일을 그대로 따른 것**이다.
  - 제안: 이번 PR 범위에서 수정할 필요는 낮음(스타일 일관성 유지가 더 중요). 다만 후속 refactor 백로그 항목으로 `metadata/` 공용 field 상수 모듈(`shop_no`, 공통 enum 등) 추출을 고려할 만하다 — `date-descriptions.ts` 가 이미 이런 패턴(공용 description 상수화)의 선례이므로 동일 접근을 `shop_no` 류 필드에도 확장 가능.

- **[WARNING]** 날짜 range 필드 description 이 기존 공용 상수 모듈(`date-descriptions.ts`)을 재사용하지 않고 리터럴 문자열로 중복 인라인됨
  - 위치: `product.ts` L171/176/181/186 (product_list), L1751/1756/1761/1766 (product_count), L3376/3381/3386/3391 (bundleproducts 계열), L2795/2800/2838/2843/3008/3013 (display 기간) 등
  - 상세: 동일 리소스 내에서 `'Created-date range start (YYYY-MM-DD, KST)'` / `'...end (YYYY-MM-DD, KST)'` / `'Updated-date range start/end (YYYY-MM-DD, KST)'` 문자열이 최소 3곳(product_list, product_count, bundleproducts_list 추정)에서 완전히 동일하게 반복된다. 같은 폴더에 이미 이런 반복을 막기 위해 만들어진 `date-descriptions.ts`(`CAFE24_DATE_FIELD_SINCE`/`CAFE24_DATE_FIELD_UNTIL` 등, 모듈 주석에 "30+ 동일 패턴 row 의 description 을 한 곳에서 관리해 표현 일관성을 보장" 이라고 명시)가 존재하는데, 이번 diff 의 신규 필드들은 이를 소비하지 않고 새 리터럴을 만들었다. `order.ts` 는 실제로 이 상수를 import 해서 쓰고 있어(`import { CAFE24_DATE_FIELD_SINCE, CAFE24_DATE_FIELD_UNTIL } from './date-descriptions.js'`), product.ts 가 같은 컨벤션에서 벗어난 형태다.
  - 제안: `product.ts` 의 날짜 range description 을 `date-descriptions.ts` 상수(필요 시 YYYY-MM-DD 포맷 변형을 상수 모듈에 추가)로 교체해 3중 이상 리터럴 중복과 "문구 하나만 나중에 고치고 나머지는 놓치는" drift 위험을 줄일 것을 권고. (단, 기존 상수는 ISO8601 datetime 포맷 예시를 쓰고 product.ts 는 YYYY-MM-DD date-only 포맷이라 완전 동일 문자열은 아니며, 상수 추가/변형이 선행되어야 함.)

- **[INFO]** 파일 길이(4530줄)와 단일 배열 리터럴 안에 62개 operation 이 나열되는 구조
  - 위치: `product.ts` 전체
  - 상세: 함수형 로직이 아닌 선언적 데이터(`Cafe24OperationMetadata[]`)이므로 순환 복잡도·중첩 문제는 없으나, 파일 하나가 4500줄을 넘어 IDE 탐색·리뷰 부담이 크다. 이미 `order.ts`(42KB), `customer.ts`(14KB) 등 유사 규모 파일이 존재하는 걸 보면 "resource 당 1파일" 이 이 폴더의 확립된 컨벤션이라 즉시 분할을 요구하긴 어렵다.
  - 제안: 현재 변경 범위에서는 그대로 두되, 향후 유사 규모가 더 커지면 operation 그룹(예: `product-core.ts`/`product-variants.ts`/`product-options.ts`)으로 서브파일 분리하는 안을 백로그로 고려. 이번 PR 자체를 막을 사유는 아님.

- **[INFO]** `product-fields.spec.ts` 의 헬퍼 `op(id)` 는 간결하고 명확함
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/product-fields.spec.ts` L45-49
  - 상세: `find` + `throw` 패턴으로 테스트 실패 시 원인 파악이 쉽고, 각 `it` 블록이 단일 책임(필드 수, 대표 필드, alias 제거, constraint, offset/limit 부재)으로 잘 분리되어 있다. 네이밍(`op`, `list`, `create`)도 파일 스코프 안에서 목적이 명확하다. 별도 지적사항 없음(긍정적 관찰).
  - 제안: 없음.

- **[INFO]** 매직 넘버 `50`(필드 수 임계값)이 테스트에 하드코딩
  - 위치: `product-fields.spec.ts` L56 `expect(Object.keys(list.fields).length).toBeGreaterThanOrEqual(50)`
  - 상세: `50` 은 회귀 가드용 임계값으로 의미가 주석(plan 문서의 "8→57 필드")에는 있으나 테스트 코드 자체에는 근거 주석이 없다. 다만 이런 종류의 "최소 개수" 회귀 가드는 테스트 코드에서 흔한 패턴이고, 정확한 상수화가 오히려 과도할 수 있어 CRITICAL 수준은 아니다.
  - 제안: 임계값 옆에 `// G-1-P: 57 fields as of 2026-07-05, threshold gives headroom` 같은 한 줄 주석을 추가하면 향후 유지보수자가 임계값 근거를 바로 파악하기 쉬움.

## 요약

이번 변경은 대부분 Cafe24 `product` 리소스의 declarative field-metadata 를 공식 docs 와 전량 미러하는 데이터 위주 diff로, 로직 복잡도·중첩·네이밍 측면에서는 문제가 없다. 주요 유지보수성 이슈는 (1) `shop_no` 필드 객체의 53회 완전 동일 반복과 (2) 날짜 range description 리터럴이 이미 존재하는 `date-descriptions.ts` 공용 상수를 소비하지 않고 새로 중복 생성된 점이다. 둘 다 codebase 기존 관례(파일별 인라인 field 정의)의 연장선이라 이번 PR 을 막을 사유는 아니지만, (2)는 같은 폴더 안에 이미 이 문제를 풀기 위한 상수 모듈이 존재함에도 활용하지 않은 것이라 후속 정리 대상으로 남기는 편이 좋다. 테스트 파일(`product-fields.spec.ts`)은 책임이 명확하고 가독성이 좋다.

## 위험도

LOW
