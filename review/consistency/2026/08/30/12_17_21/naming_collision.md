STATUS=success naming_collision review complete (coverage caveat — see 발견사항 1)
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** `--impl-prep` 번들 예산 초과로 `spec/conventions/` 328/334 파일이 절단돼 신규 식별자 충돌 여부를 검증할 수 없음
  - target 신규 식별자: (검증 불가 — 아래 파일들의 본문이 전달되지 않음)
  - 기존 사용처: `review/consistency/2026/08/30/12_17_21/_prompts/naming_collision.md` 자체. `<!-- @bundle-file -->` 로 나열된 335개 항목 중 328개가 `> ⚠️ 본문 생략됨 — 컨텍스트 예산 초과 (원래 N 자). 조립 실패가 아니라 의도된 절단이다.` 로 대체됐음(전문 포함은 `audit-actions.md`, `cafe24-api-catalog/_overview.md`·`category.md`·`store.md`·`translation.md`, `cafe24-api-metadata.md` 6개 spec 파일뿐).
  - 상세: 절단된 파일 중 본 체크리스트(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·파일 경로 충돌)와 직접 관련된 것들이 다수 포함된다 — `error-codes.md`(에러 코드 ID 네임스페이스), `redis-keys.md`(캐시/락 키 네임스페이스), `secret-store.md`(secret/설정 키), `node-output.md`·`execution-context.md`·`interaction-type-registry.md`(엔티티·이벤트 타입명), `swagger.md`(API 문서화 컨벤션), `migrations.md`(DB 식별자), `chat-channel-adapter.md`·`conversation-thread.md`(엔티티/이벤트명), `cafe24-restricted-scopes.md`, `makeshop-api-catalog/*`·`makeshop-api-metadata.md`(전체 API endpoint 카탈로그) 등. 이들 파일이 새로 도입하는 식별자가 기존 사용처와 충돌하는지는 이번 실행에서 전혀 점검되지 않았다. 이는 이 저장소에서 반복 관측된 기존 결함이다("consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다") — orchestrator 의 번들링 예산 로직이 `spec/conventions/` 처럼 파일 수가 많은 스코프에서 앞쪽 소수 파일만 전문 포함하고 나머지를 조용히 드롭한다.
  - 제안: 재실행 시 청크 분할(파일별 개별 호출 또는 상위 20~30개씩 batch)로 `spec/conventions/` 전체가 전문 포함되도록 orchestrator 번들링 예산을 조정할 것. 그 전까지는 이번 회차의 "충돌 없음" 판정을 절단된 328개 파일에는 적용하지 말 것 — 미검증 상태로 간주해야 한다.

- **[WARNING]** cafe24 catalog `store` resource 의 `privacy_*` id 접두어가 별도 `privacy` resource 와 네임스페이스 충돌 우려 (스펙 저자가 이미 인지·미해결)
  - target 신규 식별자: `spec/conventions/cafe24-api-catalog/store.md` 의 `privacy_boards_get` / `privacy_boards_update` / `privacy_join_get` / `privacy_join_update` / `privacy_orders_get` / `privacy_orders_update` (store resource 소속, 코드 상 `codebase/backend/src/nodes/integration/cafe24/metadata/store.ts:2341,2358,2397,2414,2466,2483`)
  - 기존 사용처: 별도 `privacy` resource — `spec/conventions/cafe24-api-catalog/privacy.md` (`customers_privacy_get` / `customers_privacy_list` / `customers_privacy_count` / `customers_privacy_update` / `products_wishlist_customers_list` / `products_wishlist_customers_count`, `codebase/backend/src/nodes/integration/cafe24/metadata/privacy.ts:19,40,192,343,469,489`) 및 `approvalGroup: 'privacy'` (전체 privacy resource scope 승인 그룹, `cafe24-api-metadata.md` §"approvalGroup 이 묶는 operation 집합").
  - 상세: 리터럴 ID 문자열 충돌은 아니다(`privacy_boards_get` ≠ `customers_privacy_get`) — `catalog-sync.spec.ts` 의 resource-내 unique 검증도 통과한다. 그러나 `<resource>_<verb>` id 명명 컨벤션(§6 신규 endpoint 등재 절차)을 사람/도구가 접두어로 신뢰하면 `privacy_*` id 를 별도 `privacy` resource 소속으로 오인하기 쉽다 — 실제로는 `store` resource 소속(카페24 게시판/가입/주문 개인정보 "정책" 조회이지 `privacy` resource 의 "회원 개인정보" CRUD 와 다른 대상). `_overview.md` 자체가 "`store.md` 의 `privacy_*` id 명명 우려 (별 `privacy` resource 와 prefix 충돌) 는 별 트랙으로 follow-up 가능" 이라고 명시해 미해결 상태를 인정하고 있다.
  - 제안: `store` resource 의 6개 id 를 `store_privacy_boards_get` 류로 재명명하거나(breaking — catalog-sync·backend 메타데이터·i18n dict 동반 갱신 필요), 최소한 `_overview.md` §5 Coverage Matrix 각주에서 "follow-up 가능" 을 실제 plan(`plan/in-progress/`) 항목으로 승격해 추적할 것. 현재는 산문 각주로만 남아 있어 유실 위험이 있다.

- **[INFO]** 검토 범위 안에서는 실제 충돌 0건 확인 — 스펙이 스스로 문서화한 명명 충돌 회피 결정 3건은 코드와 일치
  - target 신규 식별자: `scopeType`(Cafe24OperationMetadata), `approvalGroup`(restrictedApproval), `Cafe24FieldConstraint.oneOf`
  - 기존 사용처: `Node.category` enum, `Cafe24Resource.category`, JSON Schema `oneOf`, frontend `UiHint.visibleWhen.oneOf`
  - 상세: `spec/conventions/cafe24-api-metadata.md` 가 "`category` 대신 `scopeType`/`approvalGroup` 채택 — `Node.category` 와 충돌 회피" 를 명시하는데, `codebase/backend/src/nodes/integration/cafe24/metadata/types.ts:26-29,108-114` 의 주석이 동일 근거로 동일 결정을 반영하고 있어 spec-code 간 드리프트 없음을 확인했다. `oneOf` 는 타입 네임스페이스가 분리돼(`Cafe24FieldConstraint` vs JSON Schema vs frontend `UiHint`) 컴파일·런타임 충돌이 없다는 서술도 그대로 성립한다.
  - 제안: 조치 불필요. (양성 확인 — 참고용 기록)

### 요약
이번 `--impl-prep` 번들이 `spec/conventions/` 335개 파일 중 겨우 6개 spec 파일만 전문 포함하고 나머지 328개(error-codes/redis-keys/secret-store/node-output/execution-context/swagger/migrations/makeshop-* 등 신규 식별자 충돌 점검에 직결되는 파일 다수 포함)를 예산 초과로 절단해, 이번 회차의 신규 식별자 충돌 점검은 사실상 스코프의 2% 미만에서만 수행됐다. 그 2% 안에서는 실제 충돌은 발견되지 않았고 오히려 스펙 저자가 `scopeType`/`approvalGroup` 채택으로 `Node.category` 명명 충돌을 사전에 회피한 사례를 코드와 대조해 정합함을 확인했다. 유일한 실질 우려는 `cafe24-api-catalog/store.md` 의 `privacy_*` id 6개가 별도 `privacy` resource 와 네임스페이스 상 혼동 소지가 있다는, 스펙 저자 스스로 이미 인지·미해결 상태로 남긴 항목이다(리터럴 충돌 아님, WARNING). 결론적으로 "충돌 없음" 을 전체 스코프에 대해 단정할 수 없다 — 절단된 328개 파일은 이번 검토에서 미검증 상태다.

### 위험도
MEDIUM (실제 확인된 충돌은 낮은 심각도이나, 검토 범위 자체가 예산 초과로 98% 가량 누락돼 "충돌 없음" 판정의 신뢰도가 낮음 — 재실행 필요)
