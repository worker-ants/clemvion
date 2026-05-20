# API 계약(API Contract) 리뷰 결과

검토 대상: Cafe24 planned operation 전수 구현 (store / product / order resource)
검토 일시: 2026-05-21
검토 파일: `codebase/backend/src/nodes/integration/cafe24/metadata/{order,product,store}.ts`, `planned.ts`, `plan/in-progress/cafe24-planned-implementation.md`, `review/consistency/…`

---

## 발견사항

### [INFO] 이 변경은 Cafe24 외부 API 에 대한 내부 메타데이터 레지스트리 추가이며 직접적인 HTTP 엔드포인트 노출은 없음

- 위치: `order.ts`, `product.ts`, `store.ts` 전체
- 상세: 변경된 파일들은 Cafe24 공식 API 를 호출하기 위한 클라이언트 측 메타데이터 정의(`Cafe24OperationMetadata[]`)이다. 이 파일들은 우리 시스템이 외부로 노출하는 API 엔드포인트가 아니라, 내부 AI 에이전트 노드가 Cafe24 API 를 호출할 때 참조하는 정적 설정 레지스트리다. 따라서 하위 호환성·버전 관리·HTTP 상태 코드 적절성 등 전통적 API 계약 관점의 항목 대부분은 해당 없음이다.
- 제안: 해당 없음.

---

### [WARNING] `product_additionalimages_delete` — 리소스 식별자 없이 컬렉션 전체 DELETE 허용

- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/product.ts`, `product_additionalimages_delete`
  ```
  method: 'DELETE',
  path: 'products/{product_no}/additionalimages',
  requiredFields: ['product_no'],
  ```
- 상세: 개별 이미지 식별자(예: `image_no`) 없이 `product_no` 만으로 `DELETE` 를 수행한다. 이는 Cafe24 공식 API 의 실제 동작을 그대로 반영한 것이지만, 메타데이터를 통해 이 엔드포인트를 호출하는 AI 에이전트가 "특정 이미지만 삭제"를 기대하는 사용자 의도와 달리 해당 상품의 추가 이미지 전체를 삭제할 수 있다. `product_additionalimages_update` 도 동일한 경로를 PUT 으로 사용하며 식별자가 없다.
- 제안: `description` 필드에 "모든 추가 이미지 삭제 (개별 식별자 미지원)" 또는 이에 상응하는 한국어 설명을 명시하여 호출자가 destructive 범위를 인지하도록 한다. 가능하다면 `requiredFields` 또는 별도 `warningNote` 필드로 파괴적 작업임을 표기하는 것을 권장한다.

---

### [WARNING] `product_icons_delete` — `icon_no` 타입이 `string` 이나 실제로는 `number` 여야 할 가능성

- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/product.ts`, `product_icons_delete`
  ```
  icon_no: { type: 'string', location: 'path' },
  ```
- 상세: `product_no` 는 `type: 'number'` 로 정의되어 있으나, 같은 엔드포인트 경로 내 `icon_no` 는 `type: 'string'` 으로 정의되어 있다. 유사 패턴인 `product_memos_delete` 의 `memo_no` 도 `string`, `product_tags_delete` 의 `tag_no` 도 `string` 으로 일관되게 처리되어 있다. Cafe24 공식 docs 에서 이들이 실제로 문자열인지 숫자인지 검증이 필요하다. 타입 불일치가 존재하면 런타임에서 경로 직렬화 오류가 발생할 수 있다.
- 제안: 각 `*_no` 식별자의 Cafe24 공식 API 문서 타입(integer/string)을 재확인하고, `product_no` 의 `number` 타입과 일관성을 맞추거나, 모두 `string` 으로 통일하는 이유를 주석으로 명시한다.

---

### [INFO] `order_autocalculation_delete` — `responseShape: 'empty'` 와 DELETE 의 일관성

- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/order.ts`, `order_autocalculation_delete`
  ```
  method: 'DELETE',
  path: 'orders/{order_id}/autocalculation',
  responseShape: 'empty',
  ```
- 상세: DELETE 에 `responseShape: 'empty'` 사용은 일관된 패턴이며 적절하다. `product_variants_delete`, `product_additionalimages_delete`, `bundleproducts_delete` 등 DELETE 류는 전부 `responseShape: 'empty'` 를 사용하여 일관성이 유지되고 있다. 특이 사항 없음.
- 제안: 해당 없음.

---

### [INFO] `product_variants_update_multiple` — PUT 으로 컬렉션 일괄 수정, `responseShape: 'list'`

- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/product.ts`, `product_variants_update_multiple`
  ```
  method: 'PUT',
  path: 'products/{product_no}/variants',
  responseShape: 'list',
  ```
- 상세: RESTful 관점에서 컬렉션 경로에 대한 PUT 은 부분 업데이트가 아닌 전체 교체를 의미하는 경우가 있으나, Cafe24 API 의 실제 동작을 따르는 메타데이터 정의이므로 외부 계약 위반은 아니다. `responseShape: 'list'` 와 PUT 의 조합은 일괄 수정 후 수정된 항목 목록을 반환하는 패턴으로 해석 가능하며, 동일 패턴(`categories_products_update` 등)이 일관되게 사용된다.
- 제안: 해당 없음.

---

### [INFO] `planned.ts` 에서 `product` / `order` 배열이 `[]` 로 비워진 것 확인

- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/planned.ts`
- 상세: `product: []`, `order: []` 로 변경되어 있다. `store` 배열은 `privacy_*` 6건만 잔존 (비-Scope 처리). 이는 plan 문서에 명시된 의도와 일치한다. 내부 UI 드롭다운 비활성화 배지 자동 해제 로직에 영향을 주므로 배열이 올바르게 비워졌는지는 `catalog-sync.spec.ts` 통과로 검증된다.
- 제안: 해당 없음.

---

### [INFO] 페이지네이션 일관성 — paginated 엔드포인트의 `offset`/`limit` 필드 정의

- 위치: `product.ts` 의 `product_decorationimages_list`, `product_icons_list`, `product_memos_list`, `product_tags_list`, `bundleproducts_list`, `mains_products_list` 등
  ```
  offset: { type: 'number', location: 'query', default: 0 },
  limit: { type: 'number', location: 'query', default: 10 },
  ```
- 상세: `paginated: true` 가 설정된 모든 엔드포인트에 `offset`/`limit` 가 일관되게 정의되어 있다. `paginated: true` 없는 단건 조회 엔드포인트에는 이 필드가 포함되지 않는다. 일관성 양호.
- 제안: 해당 없음.

---

### [INFO] 인증/인가 — `scopeType` 의 일관된 적용

- 위치: 전체 신규 추가 엔드포인트
- 상세: 모든 신규 엔드포인트에 `scopeType: 'read'` (GET) 또는 `scopeType: 'write'` (POST/PUT/DELETE) 가 일관되게 할당되어 있다. `restrictedApproval` 필드는 해당 batch 에서는 나타나지 않으며, 이는 Cafe24 의 별도 승인이 필요하지 않은 일반 scope 에 해당함을 의미한다. plan 문서에서 restricted 항목 (naverpay, kakaopay, paymentgateway 등)은 별도 batch 에서 처리됨이 명시되어 있다.
- 제안: 해당 없음.

---

## 요약

이 변경은 Cafe24 외부 API 클라이언트 메타데이터 레지스트리를 확장하는 것으로, 우리 시스템이 외부로 노출하는 HTTP 엔드포인트를 추가하거나 변경하지 않는다. API 계약 관점에서 breaking change 는 없으며, 응답 형식(`responseShape`)·페이지네이션(`paginated`/`offset`/`limit`)·인증 범위(`scopeType`) 모두 기존 패턴과 일관되게 정의되어 있다. 유일한 실질적 주의사항은 `product_additionalimages_delete` 와 같이 리소스 식별자 없이 컬렉션 전체를 DELETE 하는 엔드포인트에서 AI 에이전트가 의도치 않은 범위로 작동할 수 있다는 점(WARNING)이며, `description` 을 통해 destructive 범위를 명확히 하는 것이 권장된다. 보조적으로 `icon_no` / `memo_no` / `tag_no` 등 일부 식별자의 타입이 `string` 으로 정의된 것이 Cafe24 공식 API 타입과 일치하는지 재확인이 필요하다(Warning).

---

## 위험도

LOW

STATUS=success ISSUES=2
