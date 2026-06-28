# 신규 식별자 충돌 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
검토 대상: `spec/5-system/` (1-auth, 10-graph-rag, 및 참조 문서 포함) + `spec/conventions/audit-actions.md`, `spec/conventions/cafe24-api-catalog/`

---

## 발견사항

### 1. **[WARNING]** `spec/5-system/10-graph-rag.md` KB-GR-EX-11 — 이벤트명 `document:` prefix 누락

- **target 신규 식별자**: `graph_failed` (KB-GR-EX-11 행 내 괄호 표기: `document:graph_retry`·`graph_failed`)
- **기존 사용처**: `spec/5-system/10-graph-rag.md` §A.2 이벤트 표(line 548–549)와 codebase `websocket.service.ts` type union 에서 이벤트명은 `document:graph_failed`로 `document:` prefix 포함. `graph-extraction.service.ts`도 `'document:graph_failed'` 리터럴로 emit.
- **상세**: KB-GR-EX-11 요구사항 행에서 두 이벤트를 나열할 때 `document:graph_retry` 는 prefix 가 붙어 있고 `graph_failed` 는 누락된 채 혼용됐다. 동일 문서 내 다른 표(line 549)·코드에서는 `document:graph_failed` 가 정본이다. 요구사항 행 단독으로 읽으면 이벤트명이 두 개의 다른 네임스페이스처럼 보여 구현자가 혼동할 수 있다.
- **제안**: KB-GR-EX-11 셀을 `document:graph_retry`·`document:graph_failed` 로 통일 (prefix 누락 교정).

---

### 2. **[WARNING]** `spec/5-system/10-graph-rag.md` line 551 — `document:graph_error` "dead-declared" 서술이 실제 코드와 불일치

- **target 신규 식별자**: `document:graph_error` (spec line 143, 551에서 "websocket.service.ts 의 이벤트 타입 union 에 선언됐으나 emit 하지 않는 dead-declared 항목"으로 기술)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/websocket/websocket.service.ts` 의 `KnowledgeBaseEventName` type union 을 grep 한 결과, `document:graph_error` 항목이 **존재하지 않는다** (0건). 반면 `document:embedding_error` 는 union 에 선언돼 있다(line 316).
- **상세**: spec 이 "타입 union 에 dead-declared" 라고 서술한 `document:graph_error` 는 실제로 union 에도 없고 emit 도 없다. spec 이 존재하지 않는 선언을 "dead-declared" 로 지칭하면서 embedding 계열(`document:embedding_error`)과의 대칭 구조를 잘못 암시한다. 구현자가 대칭 완성을 위해 `document:graph_error` 를 union 에 추가할 위험이 있고, KB-GR-EX-11 의 이벤트 목록(graph_started/progress/completed/retry/failed)과 spec line 551 의 서술 간 일관성도 손상된다.
- **제안**: spec line 143 과 551 에서 `document:graph_error` 관련 서술을 "union 에 선언됐으나 미emit" 에서 "현재 union 에도 미선언·미emit — embedding_error 와 대칭적으로 추가할 수 있으나 현재 비채택" 으로 교정하거나, 해당 언급을 완전히 제거해 혼선을 없앤다.

---

### 3. **[INFO]** `spec/conventions/cafe24-api-catalog/store.md` — `privacy_*` operation ID prefix 가 별도 `privacy` resource와 혼동 가능

- **target 신규 식별자**: `store` resource 내 operation ID `privacy_boards_get`, `privacy_boards_update`, `privacy_join_get`, `privacy_join_update`, `privacy_orders_get`, `privacy_orders_update`
- **기존 사용처**: 별도 `privacy` resource (`spec/conventions/cafe24-api-catalog/privacy.md`) 에 `customers_privacy_get`, `customers_privacy_list` 등 `*_privacy_*` IDs 존재. `_overview.md` §5 카버리지 매트릭스 주석 자체에서도 "store.md 의 privacy_* id 명명 우려 (별 privacy resource 와 prefix 충돌) 는 별 트랙으로 follow-up 가능" 언급.
- **상세**: operation ID 충돌은 없다 — `findCafe24Operation(resource, operationId)` 가 resource 단위로 범위가 한정되므로 `('store', 'privacy_boards_get')` 과 `('privacy', <any_id>)` 는 별도 namespace 다. 그러나 `store` resource 내 `privacy_*` ID 들은 Cafe24 Admin API 의 별도 `privacy` 카테고리와 prefix 가 동일해, ID 목록을 수동 검색할 때 혼동 가능성이 있고 가독성·유지보수성이 저하된다.
- **제안**: 기능 충돌은 없으므로 즉시 조치 불필요. 향후 store resource 내 해당 ops 를 `store_privacy_*` 또는 `privacy_setting_*` 등으로 rename 하거나, _overview.md 주석을 follow-up plan 으로 공식 등재하는 방향을 검토한다.

---

## 요약

`spec/5-system/` 범위에서 신규 도입 식별자의 **실제 충돌**(동일 식별자가 다른 의미로 이미 사용 중인 케이스)은 없다. 검출된 두 건의 WARNING 은 모두 동일 문서 내 자기 불일치다: ① KB-GR-EX-11 에서 `document:graph_failed` 의 prefix 누락 오기(코드·다른 표와 불일치), ② spec 이 "union dead-declared" 라 서술한 `document:graph_error` 가 실제 코드에는 union 에도 없어 서술이 부정확하다. 두 건 모두 구현자가 스펙을 그대로 따를 경우 예상치 못한 이벤트명을 추가하거나 emit 할 위험을 내포하므로 spec 텍스트 교정이 권장된다. Cafe24 catalog `store.md` 의 `privacy_*` prefix 는 INFO 수준으로 기능 충돌이 없어 즉시 차단 불필요.

---

## 위험도

LOW
