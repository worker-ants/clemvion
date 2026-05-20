# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `fields` 객체 인라인/멀티라인 포맷 혼재 (order.ts)
- **위치**: `order.ts` 신규 추가 엔트리 전체 (Batch 3-A~G)
- **상세**: 기존 코드베이스(`order_list`, `order_get`, `order_items_list` 등)는 `fields` 값을 여러 줄로 전개한다. 신규 추가 엔트리는 단일 path 파라미터 하나일 때 `fields: { order_id: { type: 'string', location: 'path' } }` 형태로 한 줄에 압축해 작성했다. 두 파라미터 이상인 경우(`order_memos_update`, `order_shipments_update` 등)는 두 필드를 동일 한 줄에 이어 붙여 80자를 훌쩍 넘기는 긴 라인을 만든다 (예: 라인 561, 572, 704, 715).
- **제안**: 기존 멀티라인 스타일을 일관되게 따르거나, 코드베이스 전체에 걸쳐 "단일 path 파라미터 → 인라인 허용" 규칙을 Prettier 설정 또는 코딩 가이드에 명시해 합의한다. 현재 상태에서는 두 스타일이 혼재해 읽는 사람이 의도를 판단해야 하는 부담이 생긴다.

### [WARNING] 빈 `fields: {}` 객체와 `requiredFields: []` 일관성 없음
- **위치**: `product.ts` — `bundleproducts_create` (라인 추가 부분); `order.ts` — `orders_dashboard_list`
- **상세**: `bundleproducts_create` 는 `requiredFields: [], fields: {}` 로 선언되어 있고, `product_images_upload` / `product_images_delete` 는 `requiredFields: []` 임에도 `fields` 에 `shop_no` 를 포함한다. 전자는 "필드가 아예 없음", 후자는 "필수는 아니지만 선택 파라미터 있음"을 뜻하므로 의도가 다르다. 그러나 `bundleproducts_create` 가 실제로 body 파라미터를 아무것도 받지 않는 것인지, 아니면 문서 확인 후 채울 예정인지가 코드만으로 불분명하다.
- **제안**: 빈 `fields: {}` 사용 시 주석으로 "본 API 는 request body/query parameter 없음"을 명시하거나, spec 규약에 이 패턴을 공식화해 의도를 명확히 한다.

### [WARNING] `orders_calculation_total` 의 `scopeType: 'read'` 와 `method: 'POST'` 불일치
- **위치**: `order.ts` — `orders_calculation_total` 엔트리
- **상세**: HTTP POST 이지만 `scopeType: 'read'` 로 표기되어 있다. `scopeType` 이 OAuth scope(`mall.read_order`) 기준이므로 Cafe24 API 상 읽기 scope 로 호출하는 POST 가 맞다면 의미가 성립하지만, 코드 독자는 "POST = write" 라는 일반적인 직관과 충돌해 혼란을 겪을 수 있다. 기존 코드베이스에서 `method: 'POST'` 와 `scopeType: 'read'` 의 조합이 다른 곳에서도 사용되는지 확인되지 않았다.
- **제안**: `types.ts` 의 `Cafe24OperationMetadata` 인터페이스 주석 또는 spec 문서에 "scopeType 은 Cafe24 OAuth scope 기준이며 HTTP method 와 무관하게 결정된다"는 규칙을 명시한다. 그렇지 않으면 향후 유지보수 시 오류 수정 대상으로 오해받을 가능성이 있다.

### [INFO] Batch 구분 주석의 표기 방식이 파일마다 소폭 다름
- **위치**: `product.ts` 의 `// Batch 2-A`, `// Batch 2-B`, ...; `order.ts` 의 `// Batch 3-A`, `// Batch 3-B`, ...
- **상세**: 배치 주석 형식 자체는 일관되지만, `product.ts` 의 주석은 "sub-resource 그룹 이름 (개수)" 패턴을 사용하고(`// Batch 2-A — product_variants (5) · product_additionalimages (3) ...`), `order.ts` 는 동일하게 쓰여 파일 간 일관성은 유지된다. 단, 이 batch 주석은 개발 추적 목적이지 코드 의미 전달 목적이 아니므로, 코드베이스 장기 보존 시 혼선을 줄 수 있다. 구현 완료 후 plan 이 `complete/` 로 이동하면 batch 주석은 맥락 없는 노이즈가 된다.
- **제안**: 구현 완료 이후 batch 주석을 제거하거나, "아래 항목 추가: YYYY-MM-DD" 형태의 의미 있는 주석으로 교체하는 후속 cleanup 을 plan 에 명시적으로 추가하는 것을 고려한다.

### [INFO] `planned.ts` — `product: [], order: []` 빈 배열로 전환
- **위치**: `planned.ts` — `product` 키, `order` 키
- **상세**: 모든 항목이 구현 완료됨에 따라 빈 배열로 전환되었다. 코드 의도는 명확하다. 단, `store` 배열은 privacy_* 6건이 잔존하므로 세 키의 처리 상태(빈 배열 vs 잔존 항목)가 달라, 이후 privacy_* 처리 완료 시 `store` 를 `[]` 로 교체하는 작업이 누락되지 않도록 plan 에 명확히 기록될 필요가 있다. 코드 자체에는 문제가 없다.

### [INFO] `product_images_upload` 와 `product_images_delete` 의 `shop_no` default 값 하드코딩
- **위치**: `product.ts` — `product_images_upload` (body), `product_images_delete` (query)
- **상세**: `default: 1` 은 기존 코드베이스 전반에서 동일하게 사용되는 패턴이고, `shop_no` 의 기본값 1이 Cafe24 단일 쇼핑몰 기본 쇼핑몰 번호임을 `product_list` 등의 description 주석에서 확인할 수 있다. 매직 넘버는 아니나, 이 의미가 `shop_no` 필드의 `description` 문자열 없이 `default: 1` 만으로 표현되어 있어 다른 엔트리(`product_list` 의 `shop_no: { ..., description: 'Multi-shop number (default 1)' }`)보다 설명이 부족하다.
- **제안**: `product_images_upload` / `product_images_delete` 의 `shop_no` 에도 `description: 'Multi-shop number (default 1)'` 또는 동급 설명을 추가해 일관성을 맞춘다.

---

## 요약

이번 변경은 Cafe24 API metadata 배열에 236개의 operation row 를 일괄 추가하는 대규모 데이터 확장 작업으로, 코드 구조·인터페이스·네이밍 모두 기존 규약을 대체로 잘 따르고 있다. 가장 눈에 띄는 유지보수성 문제는 `order.ts` 신규 엔트리에서의 `fields` 포맷 혼재(인라인 vs 멀티라인)로, 특히 다중 path 파라미터를 한 줄에 압축한 경우 가독성이 저하된다. `orders_calculation_total` 의 `POST` + `scopeType: 'read'` 조합은 의도적이더라도 문서화가 없으면 향후 오해를 유발할 수 있다. Batch 주석은 개발 중에는 추적에 유용하지만 장기 잔존 시 노이즈가 될 수 있으므로 cleanup 계획을 권장한다. 전반적으로 이 유형(데이터 선언 파일 bulk 추가)의 변경에서 기대할 수 있는 수준의 유지보수성을 유지하고 있다.

## 위험도

LOW
