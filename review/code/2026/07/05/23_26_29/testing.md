### 발견사항

- **[INFO]** 대량 field-set 미러 변경(20개 리소스 파일, +18,477/-1,734줄)에 대해 리소스-특정 회귀 테스트는 `product` 하나(`product-fields.spec.ts`, 신규 110줄)에만 추가됨
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/product-fields.spec.ts` (신규) vs `order.ts`(+4904/-…, 최대 diff), `category.ts`(+902), `community.ts`(+826), `store.ts`(+2606), `supply.ts`(+1065), `promotion.ts`(+1630) 등은 전용 스펙 없음
  - 상세: `product-fields.spec.ts`는 alias 제거(`since`/`until`/`category_no` 삭제), `options` 배열로의 스키마 교체(`option_values`→`options`), `impliesValue`(해외배송) 등 "조용히 되돌아가면 위험한" 사실을 명시적으로 고정한다. 반면 `order.ts`/`category.ts`/`store.ts` 등 유사하거나 더 큰 규모의 alias 제거·필드 재구성(예: `mileage.ts`의 `points/autoexpiration`에서 `member_id`/`points_amount`가 `requiredFields`에서 빠짐, `notification.ts`의 `sms_send`에서 `sender`/`receiver`가 `sender_no`/`recipients`로 대체)이 있음에도, 이를 지키는 리소스별 스펙이 없다. 현재는 `metadata.spec.ts`(제네릭 invariant: constraints 참조 유효성, enum 배열, KST 포맷, requiredFields subset)와 `catalog-sync.spec.ts`/`catalog-docs-drift.spec.ts`(catalog ↔ metadata 동기화, method/path/scope 일치)만 이 파일들을 커버한다. 이 제네릭 가드들은 "필드가 docs와 구조적으로 일치하는가"는 검증하지 않고 "선언이 내적으로 일관적인가"만 검증하므로, 예컨대 `docs`가 요구하는 field 자체가 오타·오필드명이어도(구조는 valid) 통과한다.
  - 제안: `product-fields.spec.ts`와 같은 패턴(대표 필드 존재 하한선, 제거된 alias 재등장 방지, 조건부 constraints 고정)을 최소한 diff 규모가 큰 `order`/`category`/`store`/`community`/`promotion`/`supply`에도 확대 적용 권장. 특히 non-functional alias 제거(예: `page_path`→`path`, `option_values`→`options`, `sender`/`receiver`→`sender_no`/`recipients`)처럼 "과거 필드명이 되살아나면 API가 조용히 실패"하는 케이스는 회귀 위험이 커서 우선순위가 높음.

- **[INFO]** `requiredFields`가 줄어드는 변경(제약 완화)에 대한 명시적 테스트 부재
  - 위치: `mileage.ts` `points/autoexpiration`(`requiredFields: ['member_id', 'expiration_date', 'points_amount']` → `['expiration_date']`), `application.ts` `recipes_create`(`requiredFields: ['recipe_name']` → `[]`), `design.ts` `themes/{skin_no}/pages` POST/PUT(`requiredFields: [..., 'page_path']` → `[..., ]`로 축소, `page_path`→`path`로 이름도 변경)
  - 상세: `metadata.spec.ts`의 `requiredFields is a subset of fields keys` 테스트는 requiredFields가 여전히 fields의 부분집합인지만 검증하고, "이전에 required였던 필드가 실수로 optional이 됐는지" 여부는 검증하지 않는다. 이번 변경은 의도적(주석에 근거 명시)이나, 이런 완화가 실제로 Cafe24 API 스펙과 일치하는지 검증하는 테스트가 없어 향후 유사 diff에서 의도치 않은 완화가 섞여도 감지되지 않는다.
  - 제안: 최소한 `product-fields.spec.ts`처럼 "이 op은 이제 X를 required로 요구하지 않는다"는 사실을 1줄 assertion으로 고정해두면, 실수로 원복되거나 반대로 다시 과도하게 required가 추가되는 회귀를 막을 수 있다.

- **[INFO]** `type` 필드 변경(`number` → `string`, 예: `script_no`, `page_path`/`path`)에 대한 handler 동작 검증 부재
  - 위치: `application.ts`의 `script_no: {type:'number'→'string'}` (scripttags 관련 6개 op), `design.ts` `skin_no`는 유지되나 `page_path`류가 `path`(string)로 통합
  - 상세: `cafe24.handler.ts`의 `buildRequestParts`는 `fieldSpec.type`을 소비하지 않고 `location`만으로 query/body/path에 값을 그대로 전달하므로 handler 레벨 회귀는 없음을 코드 확인·기존 handler spec 실행(209 tests pass)으로 확인함. 다만 이 `type` 필드가 도구 파라미터 스키마 생성(예: LLM tool-calling JSON schema, admin UI form)에서 소비되는 경로가 있다면, 그 경로에 대한 테스트가 이번 diff 범위에는 없어 실제 영향 여부가 검증되지 않은 채 남아있다.
  - 제안: `type` 필드의 소비처(스키마 생성기 등)가 있다면 그 경로에 대해 최소 1개의 smoke test로 `application.ts`의 `script_no` type 변경이 정상 반영되는지 확인 권장. 이번 diff에는 포함되지 않은 파일이라 범위 밖일 수 있음.

### 요약

이번 변경은 20개 cafe24 리소스 메타데이터 파일에 걸친 대규모 field-set docs 미러링(순수 데이터 선언 diff)이며, 기존에 이미 견고한 제네릭 회귀 가드 계층(`metadata.spec.ts`의 invariant 검증, `catalog-sync.spec.ts`/`catalog-docs-drift.spec.ts`의 양방향 docs-metadata 동기화, `constraint-validator.spec.ts`의 constraint 로직 단위테스트)이 존재하여 이 diff의 새 필드·constraints·enum 선언을 자동으로 검증한다 — 실제로 `metadata` 하위 전체 스위트(105 tests, cafe24 전체로는 209 tests)가 모두 통과했고 stale 참조(제거된 필드를 가리키는 옛 테스트)도 없음을 확인했다. 다만 `product` 리소스에만 alias 제거·스키마 재구성·조건부 constraint를 고정하는 전용 회귀 스펙(`product-fields.spec.ts`)이 추가된 반면, 유사하거나 더 큰 규모의 변경이 있는 `order`/`category`/`store`/`community`/`promotion`/`supply` 등에는 리소스-특정 테스트가 없어 제네릭 가드가 못 잡는 "docs와 구조적으로는 일관되지만 의미적으로 잘못된" 필드명/alias 회귀에 취약하다. Mock 사용이나 테스트 격리 문제는 없으며(순수 데이터 선언 + 결정적 정적 검증), 테스트 용이성 측면에서도 이미 좋은 구조(catalog가 SoT, 코드는 그로부터 파생 검증)를 갖추고 있다. 전체적으로 위험도는 낮으나, 대규모 diff 대비 리소스별 타겟 테스트 커버리지가 고르지 않다는 점은 개선 여지가 있다.

### 위험도
LOW
