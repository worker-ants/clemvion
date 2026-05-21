# Testing 관점 코드 리뷰

## 발견사항

### [INFO] 테스트 존재 여부 — 양방향 동기 가드가 핵심 로직을 커버
- 위치: `/codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`, `metadata.spec.ts`, `public-meta.spec.ts`, `restricted-approval.spec.ts`
- 상세: 변경된 `order.ts`, `product.ts`, `store.ts`(metadata row 추가) 및 `planned.ts`(row 제거)에 대한 전용 단위 테스트는 없으나, 기존 `catalog-sync.spec.ts`가 `supported` row ↔ catalog MD ↔ `planned.ts` 3자 양방향 동기를 엄격하게 검증한다. `metadata.spec.ts`는 path placeholder 선언, `requiredFields` ⊆ `fields`, enum 배열, date-time KST 명시까지 cross-operation 전수 검증한다. 이 두 스펙이 새 row 전체(236 row)를 자동으로 커버하므로 별도 단위 테스트 없이도 정적 데이터 정합성은 충분히 보호된다.
- 제안: 현 구조 유지 적절. 단, 아래 항목들의 커버리지 갭에 한해 보강 검토.

---

### [WARNING] 커버리지 갭 — `fields: {}` + `requiredFields: []` 를 동시에 선언하는 bulk 오퍼레이션 패턴 무검증
- 위치: `order.ts` — `return_update`, `returnrequests_create/reject`, `cancellation_update_bulk`, `cancellationrequests_create/reject`, `control`, `exchange_update_multiple`, `exchangerequests_create_bulk/reject_multiple`, `fulfillments_create`, `labels_create_multiple`, `orderform_properties_create/update/delete`, `shipments_create_multiple/update_multiple`, `subscription_shipments_create/update`, `unpaidorders_list` 등 37개 이상
- 상세: `fields: {}`이면서 body에 payload를 요구하는 bulk/mutation 오퍼레이션들이 다수다. `metadata.spec.ts`의 "every path placeholder is declared in fields" 검증은 경로 변수가 없으면 통과하므로, body payload에 어떤 필드를 받아야 하는지 완전히 미검증이다. 현 시스템이 `fields` 딕셔너리를 AI Agent 파라미터 힌트로 사용한다면, 빈 `fields`는 Agent가 body 없이 호출하는 회귀를 낳을 수 있다.
- 제안: `metadata.spec.ts`에 "write operation with path containing no `{...}` and `fields: {}` 인 row를 warn 목록으로 수집하는 informational assertion" 추가를 검토한다. 즉각 차단이 아니더라도 미래 body-schema 보강 시 누락 탐지가 가능하다.

---

### [WARNING] 커버리지 갭 — `responseShape: 'list'` + `paginated` 생략 패턴
- 위치: `order.ts` — `order_memos_list`(line ~759), `order_receivers_list`, `order_shipments_list`, `orders_benefits_list`, `orders_coupons_list`, `orders_dashboard_list`, `orders_memos_list`, `labels_list`, `orderform_properties_get`(responseShape='list') 등
- 상세: `responseShape: 'list'`이지만 `paginated: true` 선언이 없는 row들이 다수 존재한다. `catalog-sync.spec.ts`는 `paginated` 불일치를 `supported` row에 대해 엄격히 검증하므로, catalog MD에 `paginated: ✓` 없이 작성된 경우 sync가 통과한다. 이 "list이지만 non-paginated" 패턴이 의도적인지(Cafe24 API가 페이지네이션 미지원) 아닌지를 구분하는 테스트가 없다.
- 제안: `metadata.spec.ts`에 "responseShape='list'인 row는 paginated=true 또는 description에 '비페이지네이션' 사유 주석 필수" 규칙 추가를 검토한다. 현재는 INFO 수준이나, AI Agent가 페이지네이션 없이 전체 조회를 시도할 때 대량 응답 문제가 발생할 수 있다.

---

### [INFO] 엣지 케이스 — `product_images_upload/delete`의 `path: 'products/images'` 공유 패턴
- 위치: `product.ts` — `product_images_upload`(POST), `product_images_delete`(DELETE)
- 상세: 두 오퍼레이션이 동일한 path `products/images`를 공유하지만, 메서드가 다르다. `metadata.spec.ts`의 unique 검증은 id 기준이므로 path 중복 자체는 검출되지 않는다. `catalog-sync.spec.ts`도 path 동일성 검증은 1:1 row에 대해만 수행한다. 단일 path에 여러 메서드가 매핑되는 경우 handler 라우팅 충돌 테스트가 없다.
- 제안: e2e 테스트에서 동일 path의 다른 메서드가 각자 올바른 핸들러로 분기하는지 확인한다. 현 plan D-3에 따라 phase 종료 시 e2e가 수행되므로 이 지점은 자연히 커버될 것으로 보이나, 명시적 테스트 케이스가 없다는 점을 확인한다.

---

### [INFO] 테스트 격리 — `catalog-sync.spec.ts`의 `execSync('git rev-parse --show-toplevel')` 의존
- 위치: `/codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` 라인 47
- 상세: worktree 환경에서 git rev-parse로 repo root를 결정하는 로직은 CI/CD 환경에서 git 바이너리 부재 시 7-levels-up fallback으로 전환된다. 이 fallback 경로가 linked worktree에서 부정확하다는 사실이 코드 주석에 명시되어 있다. `try/catch` 처리가 있으므로 crash는 없으나, git 없는 환경에서는 테스트가 잘못된 경로로 실행될 수 있다.
- 제안: CI 환경에서 항상 git이 사용 가능함을 보장하거나, 환경 변수 `REPO_ROOT`를 통해 외부 주입 경로를 우선 사용하도록 fallback 순서를 조정하면 테스트 격리가 강화된다.

---

### [INFO] Mock 적절성 — metadata 파일들은 순수 정적 데이터이므로 Mock 불필요
- 위치: `order.ts`, `product.ts`, `store.ts`, `planned.ts`
- 상세: 변경된 파일들은 런타임 의존성 없는 정적 TypeScript 객체 배열이다. 테스트에서 mock/stub 사용이 필요 없으며, 현재 스펙 파일들도 실제 데이터를 import해 검증하는 올바른 패턴을 사용하고 있다. Mock 적절성 관점에서 문제 없음.

---

### [INFO] 테스트 가독성 — `catalog-sync.spec.ts`의 throw new Error 패턴
- 위치: `catalog-sync.spec.ts` 전반
- 상세: Jest의 `expect` 대신 `throw new Error`를 사용하는 패턴은 실패 메시지가 상세하고 맥락을 담아 오히려 진단에 유리하다. `metadata.spec.ts`는 두 패턴이 혼재하나, 의도가 명확해 가독성 문제 없음.

---

### [WARNING] 회귀 테스트 — `planned.ts`의 `product: []`, `order: []` 변경이 기존 테스트에 미치는 영향
- 위치: `planned.ts` — product, order 배열 전량 제거 후 `[]`로 변경
- 상세: `catalog-sync.spec.ts`의 "every CAFE24_PLANNED_BY_RESOURCE entry exists as a planned row in catalog" 테스트는 `planned.ts`가 `[]`이면 해당 assertion이 trivially 통과한다. 그러나 역방향 검증 "every planned row in catalog exists in CAFE24_PLANNED_BY_RESOURCE"는 catalog MD의 `planned` row가 0건이 될 때만 통과한다. catalog MD의 product/order planned row가 완전히 `supported`로 전환되지 않고 일부 `planned`로 남은 경우 이 테스트가 실패를 발생시킨다. 이는 의도된 guard로서 정상 동작이나, 현재 변경 PR에서 plan Phase 3 미완료 batch들(3-B~3-G)이 포함된 경우 테스트가 통과하지 못한다.
- 제안: plan의 D-3 결정(매 batch 후 `catalog-sync.spec` 통과 확인)이 이미 이 리스크를 방어한다. PR merge 전 모든 phase가 완료됨을 plan Phase 4 체크리스트로 확인한다.

---

### [INFO] 테스트 용이성 — 대규모 정적 데이터의 구조적 테스트 용이성 양호
- 위치: 변경 파일 전체
- 상세: 모든 신규 operation row가 `Cafe24OperationMetadata` 타입으로 강제되므로 TypeScript 컴파일 시점에 구조적 위반이 차단된다. `id`, `label`, `scopeType`, `method`, `path`, `requiredFields`, `fields`, `responseShape` 필드 모두 타입 체크 대상이다. 의존성 주입 없이도 정적 분석 + 자동화 spec 검증으로 테스트 용이성이 충분히 확보되어 있다.

---

## 요약

이번 변경은 236개의 Cafe24 API 오퍼레이션을 `planned` → `supported`로 승격하는 정적 데이터 추가 작업이다. 핵심 정합성 검증은 `catalog-sync.spec.ts`(양방향 동기 가드 8개 규칙), `metadata.spec.ts`(cross-operation 전수 검증), `public-meta.spec.ts`(프론트엔드 페이로드 형태)가 자동으로 처리하므로 별도 단위 테스트 없이도 데이터 무결성은 보호된다. 다만 `fields: {}` + `requiredFields: []`로 선언된 bulk mutation 오퍼레이션이 37개 이상으로, AI Agent가 body payload 없이 호출할 때의 동작이 테스트로 검증되지 않는다는 커버리지 갭이 있다. `responseShape: 'list'`이면서 `paginated` 미선언인 패턴도 다수 존재하며, 이 경우 대량 응답 처리에 대한 보호가 부재하다. 두 항목 모두 현 스펙 구조상 즉각 차단 수준은 아니나, `metadata.spec.ts`에 informational assertion을 추가해 향후 보강 시 누락을 조기 탐지할 것을 권장한다.

## 위험도

LOW

정적 데이터 변경이며 기존 catalog-sync/metadata 스펙이 핵심 정합성을 자동으로 검증한다. 발견된 갭(bulk operation 필드 미선언, list-but-non-paginated 패턴)은 테스트 누락이지만 현재 시스템 동작을 직접 파괴하지는 않는다.
