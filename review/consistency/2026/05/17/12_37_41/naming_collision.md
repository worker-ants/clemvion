# 신규 식별자 충돌 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
검토 대상: `spec/conventions/` — `cafe24-restricted-scopes.md` 신규 컨벤션 + `cafe24-api-catalog/_overview.md` §2·§4 개정 + `mileage.md` / `notification.md` / `privacy.md` / `store.md` 표 헤더·row 갱신

---

### 발견사항

- **[CRITICAL]** `catalog-sync.spec.ts` 의 9-cell 파서가 10-column 표를 잘못 파싱
  - target 신규 식별자: `restricted` 컬럼 (catalog 표에 6번째 열로 삽입 — `scope` 다음, `paginated` 앞)
  - 기존 사용처: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` 의 `parseCatalogFile()` 함수 (lines 86-97). `cells.length < 9` 기준으로 행을 건너뛰고, 9개 셀을 고정 순서로 destructure 한다 (`[idCell, labelKoCell, englishTitleCell, methodCell, pathCell, scopeCell, paginatedCell, statusCell, docsCell]`).
  - 상세: `mileage.md` / `notification.md` / `privacy.md` / `store.md` 표는 이제 10컬럼(`id | 라벨 | English title | method | path | scope | restricted | paginated | status | docs`)이다. 기존 파서는 7번째 셀(index 6)을 `paginatedCell`로 읽는데, 신규 포맷에서 index 6은 `restricted` 값(`scope` / `op` / 빈칸)이다. 결과적으로 `paginated` 컬럼이 `statusCell`에, `status` 컬럼이 `docsCell`에 할당된다. `paginated` 값인 `✓` 또는 공백이 status 로 파싱되면 `VALID_STATUSES` 검사(`supported | planned | deprecated`)를 통과하지 못해 테스트가 오작동하거나, 이 4개 catalog 파일의 supported rows가 전부 누락 판정될 수 있다. 더 위험한 것은 `cells.length < 9` 조건 자체는 10-column 행을 통과시키므로 파싱이 조용히 진행되어 오염된 데이터로 검증이 실행될 수 있다는 점이다. `_overview.md` §4 검증 규칙 8(`restricted` 컬럼 ↔ `restrictedApproval` 동기)도 파서 미갱신으로 인해 실제로는 수행되지 않는다.
  - 제안: `catalog-sync.spec.ts` 의 `CatalogRow` 인터페이스에 `restricted?: 'scope' | 'op' | ''` 필드를 추가하고, `parseCatalogFile()` 를 10-column 표도 파싱할 수 있도록 개정한다. 간단한 접근: 헤더 행에서 컬럼 이름을 읽어 동적으로 인덱스를 매핑하거나, `cells.length >= 10` 분기를 두어 `restricted` 셀을 skip-파싱한다. 또한 규칙 8 검증 로직(`restricted` ↔ `metadata.restrictedApproval` 양방향)을 실제로 구현하여 명세와 동기화한다.

---

- **[WARNING]** store.md 내 `privacy_*` operation id 접두사와 `privacy` resource 명 혼동 가능
  - target 신규 식별자: store 카탈로그에 등재된 `privacy_boards_get`, `privacy_boards_update`, `privacy_join_get`, `privacy_join_update`, `privacy_orders_get`, `privacy_orders_update` (6건, 모두 `planned`)
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/privacy.md` — Cafe24 Privacy (개인정보) resource 카탈로그. 본 resource 의 operation id는 `customers_privacy_get`, `customers_privacy_list`, `customers_privacy_count`, `customers_privacy_update`, `products_wishlist_customers_list`, `products_wishlist_customers_count` 이다. `privacy` 가 resource 이름으로도 사용된다 (`Cafe24Resource` enum 값 `'privacy'`).
  - 상세: catalog id 고유성은 resource 파일 내에서만 보장된다(규칙 6: resource 내 unique). `privacy_boards_get` 등이 `store.md` 안에 있고 `privacy.md` 안에는 없으므로 기술적 충돌은 아니다. 그러나 `privacy_` 접두사는 관례적으로 `privacy` resource 의 operation을 연상시키고, Cafe24 공식 docs에서도 해당 endpoint는 Store resource 하위의 "개인정보 정책" 관련 sub-resource(경로: `store/boards/privacy`, `store/join/privacy`, `store/orders/privacy`) 이다. 개발자가 `privacy_*` ID를 보면 `privacy.md` 를 먼저 찾을 가능성이 높아 메타데이터 탐색 시 혼동이 생긴다.
  - 제안: store 카탈로그 내 privacy 정책 관련 operation id 를 `store_privacy_boards_get`, `store_privacy_boards_update` 등 `store_` prefix를 명시하거나, `policy_boards_get` / `policy_join_get` 등 별개 용어를 사용하는 방향으로 재명명을 검토한다. 현재는 `planned` status이므로 변경 영향이 작다.

---

- **[WARNING]** `category` 필드명이 `restrictedApproval` 내부에 재사용 — 기존 `Cafe24Resource` enum 값과 혼동 가능
  - target 신규 식별자: `Cafe24OperationMetadata.restrictedApproval.category` 필드 (`cafe24-api-metadata.md` §2 에 정의). 값: `'mileage' | 'notification' | 'privacy' | 'activitylogs' | 'menus' | 'naverpay_setting' | 'kakaopay_setting' | 'pg_settings' | 'analytics'`
  - 기존 사용처: `backend/src/nodes/integration/cafe24/metadata/types.ts` 의 `Cafe24Resource` type — `'category'` 가 멤버로 존재 (Category 상품분류 resource). `CAFE24_RESOURCE_LABELS['category'] = 'Category (상품분류)'`. `Node.category` 엔티티 필드도 `logic | flow | ai | integration | data | presentation` enum.
  - 상세: `restrictedApproval.category` 의 실제 값 집합에는 `'category'` 가 없으므로 런타임 충돌은 없다. 그러나 `category` 필드 이름 자체가 세 곳(`Cafe24Resource` 타입, `Node.category`, `restrictedApproval.category`)에서 각기 다른 의미로 쓰인다. `Cafe24OperationMetadata` 타입 내에서 `category` 는 "승인 묶음 식별자"를 의미하는데, 같은 파일 내에서 `scopeType` 이 `category` 충돌 우려로 이미 `category` 대신 쓴 사례(`types.ts` 주석: `scopeType (not category) intentionally — avoids collision with Node.category enum`)가 있다. `restrictedApproval.category` 는 다른 인터페이스의 서브필드라 직접 충돌은 아니지만, 일관성 차원에서 `approvalGroup` 또는 `approvalCategory` 처럼 더 구체적인 이름이 혼동 예방에 유리하다.
  - 제안: `restrictedApproval.category` 를 `restrictedApproval.approvalGroup` 으로 재명명하는 것을 고려한다. 현재는 `cafe24-api-metadata.md` spec에만 정의되어 있고 backend 코드에 아직 반영되지 않아 변경 비용이 낮다.

---

- **[WARNING]** `restricted` 컬럼 값 `op` — `_overview.md` 와 `store.md` 간 표기 불일치 가능성
  - target 신규 식별자: catalog `restricted` 컬럼의 값 `op`(`_overview.md` §2 정의: `op` = 본 row 만 단독 승인 대상), `scope` = resource 전체 영향
  - 기존 사용처: `_overview.md` §2 컬럼 설명 에는 `scope` / `op` / 빈칸 세 값만 명시. `store.md` 표에서도 동일하게 사용.
  - 상세: `cafe24-api-metadata.md` §2 의 `restrictedApproval.level` 은 `'scope' | 'operation' | 'program'` 이고, catalog 의 `restricted` 컬럼 값은 `scope` / `op` / 빈칸이다. 매핑: `scope` ↔ `level='scope'`, `op` ↔ `level='operation'`. 값이 동일하지 않다 — catalog 는 `op`을, 메타데이터는 `operation`을 쓴다. `_overview.md` §4 규칙 8에 매핑이 명시되어 있으나, `parseCatalogFile()`이 `restricted` 컬럼을 아직 파싱하지 않으므로 동기 검증이 실제로 수행되지 않는다. 개발자가 메타데이터 level 값을 `op`으로 쓰는 실수가 생길 수 있다.
  - 제안: catalog `restricted` 컬럼 값을 `operation`으로 통일하거나, 메타데이터 `level` 값을 `op`로 단축하는 방향 중 하나로 정렬한다. 현재처럼 상이한 표기가 유지된다면 `_overview.md` §4 규칙 8의 매핑 표 (`scope` ↔ `level='scope'`, `op` ↔ `level='operation'`)를 자동 검증하는 linting 또는 catalog-sync 규칙을 즉시 구현해야 drift를 막을 수 있다.

---

- **[INFO]** `cafe24-restricted-scopes.md` 파일 경로 — 기존 컨벤션 파일 명명 패턴과 일치
  - target 신규 식별자: `spec/conventions/cafe24-restricted-scopes.md`
  - 기존 사용처: `spec/conventions/cafe24-api-metadata.md`, `spec/conventions/cafe24-api-catalog/` (디렉토리), `spec/conventions/conversation-thread.md`, `spec/conventions/migrations.md`, `spec/conventions/node-output.md`, `spec/conventions/swagger.md`
  - 상세: `cafe24-` prefix 패턴이 `cafe24-api-metadata.md`, `cafe24-api-catalog/` 와 일관된다. 기존 파일과 이름이 겹치지 않으며 파일 경로 충돌은 없다. 신규 파일이 다수의 기존 문서(`1-data-model.md`, `2-navigation/4-integration.md`, `4-nodes/4-integration/4-cafe24.md`, `cafe24-api-metadata.md`, `cafe24-api-catalog/_overview.md`)에서 앵커 링크로 참조되고 있어 링크 타깃이 존재하는지 확인이 필요하다. 실제 파일은 이미 생성되어 있으므로 링크 누락 위험은 없다.
  - 제안: 추가 조치 불필요. 참고로 `spec/conventions/` 내 `cafe24-` prefix 파일이 세 번째로 추가되는 것이므로, 향후 더 늘어날 경우 `cafe24-api-catalog/` 처럼 별도 디렉토리로 묶는 것을 고려할 수 있다.

---

- **[INFO]** `oauth_invalid_scope` status_reason 값 — 기존 status_reason enum 에 추가
  - target 신규 식별자: `Integration.status_reason = 'oauth_invalid_scope'` (2026-05-17 추가)
  - 기존 사용처: `spec/1-data-model.md §2.10` 의 `status_reason` 값 목록 — `insufficient_scope`, `auth_failed`, `network`, `unknown`, `token_expired`, `install_timeout`, `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`. `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 에 `reason: 'auth_failed' | 'insufficient_scope'` 타입 사용.
  - 상세: `oauth_invalid_scope` 는 기존 값과 겹치지 않으며 snake_case 규칙을 준수한다. `oauth_` prefix 패턴이 `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired` 와 일관된다. 충돌 없음.
  - 제안: backend 코드(`integration.entity.ts` 등)에서 `status_reason` 타입 유니온에 `'oauth_invalid_scope'` 를 추가할 때 기존 `'insufficient_scope'` 와 의미를 명확히 구분하는 주석을 달 것을 권장한다 (`oauth_invalid_scope` = OAuth 단계에서 scope 거부, `insufficient_scope` = 노드 실행 중 403).

---

- **[INFO]** `requiresCafe24Approval` — `last_error.details` 의 신규 키
  - target 신규 식별자: `Integration.last_error.details.requiresCafe24Approval: string[]`
  - 기존 사용처: `spec/1-data-model.md §2.10` `last_error` JSONB 스키마 — `{ code, message, at, details? }`. `details` 는 `Record<string, unknown>`. 기존에 정의된 다른 `details` 키는 별도 명시 없음(자유 형식).
  - 상세: 기존 `details` 키와 겹치지 않으며 camelCase 규칙을 준수한다. 충돌 없음.
  - 제안: 추가 조치 불필요.

---

### 요약

신규 식별자 충돌 관점에서 가장 심각한 문제는 `catalog-sync.spec.ts` 파서가 10-column 표를 파싱하지 못하도록 하드코딩되어 있다는 점이다 (CRITICAL). `restricted` 컬럼이 `mileage` / `notification` / `privacy` / `store` 4개 카탈로그에 삽입됨으로써 기존 9-cell 파서는 `paginated`, `status`, `docs` 셀을 각각 한 칸씩 오판독하게 되어, 해당 resource의 supported row 동기 검증이 전부 비정상 작동한다. `_overview.md` §4 규칙 8로 명세된 `restricted` ↔ `restrictedApproval` 양방향 동기 검증도 파서 미갱신으로 실제로는 수행되지 않는 상태다. WARNING 3건은 `privacy_*` 접두사 혼동, `category` 필드명 중복 사용, `op` vs `operation` 표기 비일관성으로, 즉각 오류를 유발하지는 않으나 코드 작성 및 명세 해석 시 혼란 소지가 있다. 새 파일 경로(`cafe24-restricted-scopes.md`)와 신규 status_reason 값(`oauth_invalid_scope`), details 키(`requiresCafe24Approval`)는 기존 식별자와 충돌하지 않는다.

### 위험도

**HIGH**

> CRITICAL 1건(`catalog-sync.spec.ts` 파서 10-column 미지원)이 테스트 무결성을 직접 훼손한다. 이 상태로 구현을 진행하면 `catalog-sync` 테스트가 4개 resource의 `restricted` 승인 동기 여부를 실제로 검증하지 못한 채 통과하여, 메타데이터 미갱신 상태가 CI에서 걸러지지 않는다.
