# 테스트(Testing) 리뷰 — cafe24 product 리소스 docs 전량 미러 (G-1-P)

## 발견사항

- **[INFO]** `product-fields.spec.ts` 는 62개 operation 중 6개 operation(`product_list`, `product_create`, `product_options_create`, `bundleproducts_create/update`, 전체 대상 offset/limit 부재 체크)만 타깃 검증한다
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/product-fields.spec.ts`
  - 상세: diff 는 `product.ts` 전체 41→62 operation, 수천 줄을 새로 채웠지만, 신규 회귀 가드는 그중 극히 일부 operation 의 일부 필드만 스팟체크한다. 예컨대 `product_update`, `product_variants_*`, `product_memos_*`, `product_tags_*`, `bundleproducts_list/get`, `categories_products_*` 등은 필드 수·대표 필드·alias 제거 여부를 검증하는 테스트가 없다. `metadata.spec.ts` 의 범용 불변식(placeholder-field 매칭, requiredFields subset, constraint 참조 무결성, enum 배열, KST 날짜 description)과 `catalog-docs-drift.spec.ts` 의 (method, path, scope) 가드가 이 갭을 일부 보완하지만, **plan 문서 자신이 명시하듯("field-set 은 어떤 가드도 검증 안 함(drift 가드는 method/path/scope 만)") field 콘텐츠 자체의 회귀(예: 향후 실수로 `price_min` 필드를 삭제)는 어떤 자동 테스트도 잡지 못한다.**
  - 제안: 완전한 field-level fixture 대조가 부담스럽다면 최소한 operation당 "필드 개수 하한(>=N)" 스냅샷 성격의 assertion을 62개 전 operation에 대해 루프로 추가하면(예: `for (const op of productOperations) expect(Object.keys(op.fields).length).toBeGreaterThanOrEqual(SNAPSHOT[op.id])`), 향후 필드가 대량으로 소실되는 회귀를 저비용으로 방지할 수 있다. 현재는 6개 operation 외에는 무방비다.

- **[INFO]** `product_options_update`/`product_options_delete` 의 alias 제거(`option_value`→`options`, `use_option`/`required_option` 삭제) 는 신규 테스트가 커버하지 않는다
  - 위치: `product-fields.spec.ts`의 `product_options_create` 테스트만 `options`/`option_values` 를 검증, `product_options_update`는 미검증
  - 상세: diff 를 보면 `product_options_update` 도 동일하게 옛 `option_value`(단수) / `use_option` / `required_option` 필드가 사라지고 `options`(배열) 로 교체됐다. 이는 `product_options_create` 와 대칭적인 변경인데 회귀 가드가 `create`만 검사한다. 향후 `update` 쪽에서 실수로 옛 alias 가 되살아나도(`option_value` 재추가 등) 감지되지 않는다.
  - 제안: `product_options_create`와 동일한 패턴으로 `product_options_update`에 대해 `options` 존재/`option_value`, `use_option`, `required_option` 부재 assertion 추가.

- **[INFO]** `bundleproducts_create`/`update` 의 `impliesValue` 상수 리터럴 재작성(constraint object 를 파일마다 다시 씀) — DRY 아님이나 테스트 자체는 명확
  - 위치: `product-fields.spec.ts` L113-127
  - 상세: 사소하지만, 동일 constraint 객체 리터럴을 `for (const id of [...])`로 순회하며 각각 `toEqual(expect.arrayContaining([...]))` 하는 패턴은 두 operation이 정확히 같은 constraint shape 을 공유한다는 것을 잘 표현한다. 가독성 측면에서 문제는 없다.

- **[INFO]** 테스트 격리·전역 상태 없음, 순수 함수(`op()` helper) 기반이라 병렬/순서 무관 실행 가능
  - 위치: `product-fields.spec.ts` 전체
  - 상세: `productOperations.find(...)` 조회만 사용하고 mutation/mock 이 전혀 없다. 각 `it` 블록이 독립적으로 자기완결적이다. Mock 부적절성 이슈 없음(대상이 순수 정적 데이터라 mock 자체가 불필요).

- **[INFO]** `public-meta.spec.ts` 변경은 기존 회귀 테스트를 알맞게 최신화(regression test still valid)
  - 위치: `public-meta.spec.ts` L44-50 diff
  - 상세: `category_no`→`category` alias 교체를 반영해 필드명만 갈아끼웠고 검증 의도(shop_no required, 선택적 필터 optional)는 그대로 보존됨. 회귀 테스트 유효성 문제 없음.

- **[INFO]** `product_list`/`product_count`/`bundleproducts_list` 의 신규 `allOrNone` constraint(created/updated pair, additional_information_key/value pair) 3종 중 `updated_start_date/end_date` pair 와 `additional_information_key/value` pair 는 `product-fields.spec.ts` 가 검증하지 않는다 (created pair만 검증)
  - 위치: `product-fields.spec.ts` L82-91 (`product_list`), 소스는 `product.ts` L497-504
  - 상세: `metadata.spec.ts`의 범용 불변식(`constraints reference only declared fields...`)이 필드 참조 유효성은 보장하지만, "실제로 이 3개 pair가 각각 올바른 필드셋으로 선언돼 있는가"라는 의도 검증은 `created_start_date/end_date` pair 하나만 명시적으로 고정돼 있다. `updated_*` pair 나 `additional_information_key/value` pair 가 실수로 삭제/오기입돼도(예: `updated_end_date` 를 빼먹고 커밋) 전용 회귀 테스트는 통과한다(구조적 불변식만 통과 여부 확인, 존재 자체는 무검증).
  - 제안: `product_list` constraint 테스트를 `expect(list.constraints).toEqual(expect.arrayContaining([...]))` 로 3개 pair 모두 포함하도록 확장 권장(선택 사항, 우선순위 낮음).

## 요약

신규 `product-fields.spec.ts`는 field 콘텐츠 자체를 검증하는 어떤 자동 가드도 없던 상태(diff 주석이 스스로 인정)에 대해, 62개 operation 중 핵심 위험 지점(대량 필드 수 하한, 대표 필터 필드, 비동작 alias 제거, docs 채택 필드명, 조건부 constraint) 6곳을 최소 침습으로 고정하는 목적성 회귀 가드다. 순수 정적 메타데이터를 대상으로 하므로 mock 필요성이 없고 테스트 격리·가독성 문제도 없으며, 기존 `metadata.spec.ts`(구조 불변식)·`catalog-docs-drift.spec.ts`(method/path/scope drift)와 상호보완적으로 잘 배치됐다. 다만 스코프가 의도적으로 좁아(62개 중 6개 operation만), `product_update`/`product_variants_*`/`product_options_update`(alias 제거 대칭 케이스)/`product_memos_*` 등 대다수 operation 의 field 콘텐츠 회귀는 여전히 무방비이며, 이는 plan 문서에도 명시된 기술 부채(field-set 은 어떤 가드도 검증하지 않음)로 이번 PR 범위에서 완전 해소를 요구할 사안은 아니라고 판단된다. Critical/Warning 수준 결함은 없다.

## 위험도
LOW
