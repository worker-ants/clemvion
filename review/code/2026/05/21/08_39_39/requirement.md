# 요구사항(Requirement) 리뷰 결과

검토 일시: 2026-05-21T08:39:39
대상 파일: order.ts (신규 89행), product.ts (신규 49행), planned.ts (축소), plan/in-progress/cafe24-planned-implementation.md, consistency review 산출물

---

## 발견사항

### [INFO] 기능 완전성: 수치 일치 확인
- 위치: order.ts / product.ts / store.ts / planned.ts
- 상세: plan 목표(order 89 + product 49 + store 92 = 230)와 실제 구현 수치가 정확히 일치한다. order.ts 106개(17 기존 + 89 신규), product.ts 63개(14 기존 + 49 신규), store.ts 100개(8 기존 + 92 신규). planned.ts는 product: [], order: [] 로 비워졌고 store에는 privacy_* 6건만 남아 plan §비-Scope 결정과 일치한다.

### [INFO] 엣지 케이스: path parameter 누락 없음
- 위치: order.ts 전반
- 상세: 복합 path parameter가 필요한 경우를 전수 확인했다. orders_inflowgroups_update/delete는 `{group_id}`, orders_inflows_update/delete는 `{source_id}`, orders_saleschannels_update/delete는 `{channel_id}`, orderform_properties_update/delete는 `{property_no}`, subscription_shipments_get/update는 `{subscription_id}`, reservations_get는 `{reservation_no}` 를 모두 requiredFields와 fields에 정확히 선언했다. catalog md 경로와 완전히 일치한다.

### [INFO] 반환값: responseShape 일관성
- 위치: 전체 신규 항목
- 상세: DELETE 메서드는 일관되게 `responseShape: 'empty'`, GET 단건은 `'single'`, GET 목록은 `'list'`, POST/PUT은 `'single'` 을 사용하고 있다. catalog md의 endpoint 패턴과 일치한다.

### [INFO] 비즈니스 로직: paginated 플래그 일관성
- 위치: order.ts, product.ts
- 상세: catalog md의 paginated 컬럼(✓ 여부)과 metadata의 `paginated: true` 플래그가 일치한다. orders_inflowgroups_list, orders_inflows_list, orders_saleschannels_list, cashreceipt_list, unpaidorders_list (order.ts), product_decorationimages_list, product_icons_list, product_memos_list, product_tags_list, bundleproducts_list, mains_products_list (product.ts) 모두 양방향 일치 확인. orders_memos_list는 catalog에 paginated ✓ 없음 — 구현에도 `paginated: true` 없어 일치한다.

### [INFO] restrictedApproval 누락 — 의도적
- 위치: order.ts, product.ts 전체 신규 항목
- 상세: store.ts와 달리 order/product 신규 항목 어디에도 `restrictedApproval` 필드가 없다. catalog md order.md/product.md 의 `restricted` 컬럼이 모두 빈칸(일반 사용 가능)으로 되어 있어 올바른 생략이다. catalog-sync.spec.ts 기준으로도 restricted 컬럼 빈칸이면 `restrictedApproval` 없음이 정상이다.

### [INFO] TODO/FIXME 없음
- 위치: order.ts, product.ts, planned.ts
- 상세: 미완성을 시사하는 TODO, FIXME, HACK, XXX 주석이 검색 결과 0건이다. 배치 경계 주석(예: `// Batch 3-A — ...`)만 존재하며, 이는 git history 추적용 식별자로 구현 미완성과 무관하다.

### [INFO] plan 완료 상태: 2개 항목 미체크 — 의도적
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-planned-impl-060c7f/plan/in-progress/cafe24-planned-implementation.md` Phase 4
- 상세: `[ ] /ai-review SUMMARY 0 Critical / 0 Warning 확보` 와 `[ ] git mv plan/in-progress/cafe24-planned-implementation.md plan/complete/` 2개가 미완으로 남아 있다. 전자는 현재 진행 중인 이 리뷰를 통해 완료 예정이고, 후자는 PR 종료 직전 최종 단계다. 조기 완료 마킹이 아닌 의도적 순서 관리이다.

### [WARNING] orders_memos_list: path 범위 모호성
- 위치: order.ts:894, catalog order.md 해당 행
- 상세: catalog의 path는 `orders/memos`인데, 이는 "전체 주문에 걸친 관리자 메모 목록"을 의미한다. 반면 order_memos_list(별도 항목, orders/{order_id}/memos)는 특정 주문 메모 목록이다. 구현상 두 path가 모두 정확히 반영되어 있어 버그는 아니다. 그러나 orders_memos_list의 label이 '관리자 메모 목록'으로만 표기되어 사용자 UI에서 order_memos_list(주문 메모 목록)와 혼동될 수 있다.
- 제안: label을 '전체 주문 관리자 메모 목록' 등으로 구분 명시하거나, description에 "across all orders (no order_id filter)" 명시 추가 고려.

### [INFO] order_buyer_update와 order_buyer_get의 path 패턴 일관성
- 위치: order.ts:99 (기존 order_buyer_update), order.ts:366 (신규 order_buyer_get)
- 상세: 기존 order_buyer_update는 `orders/{order_id}/buyer` PUT, 신규 order_buyer_get은 동일 path GET이다. 두 항목이 동일 resource의 CRUD를 이루며 path 일관성이 유지된다.

---

## 요약

이번 변경은 Cafe24 planned operation 전수 구현의 핵심 목적인 "product 49건, order 89건 supported 승격"을 완전히 달성했다. 구현 수치(order 106개, product 63개, store 100개)가 plan 목표와 정확히 일치하며, path parameter 선언(requiredFields/fields), responseShape 패턴, paginated 플래그, restrictedApproval 생략 모두 catalog md의 단일 진실과 어긋나는 항목이 발견되지 않았다. TODO/FIXME 주석 0건, 중복 ID 0건, 누락 ID 0건(catalog-sync 테스트 기준 통과 전제). planned.ts에서 product/order 배열이 빈 배열로 정리되었고 store의 privacy_* 6건은 plan §비-Scope 결정과 일치하여 잔존이 정당하다. 단 하나의 주의 항목으로 orders_memos_list의 label이 동명의 order_memos_list와 UI 혼동을 유발할 수 있으나, path/method/requiredFields 자체의 오류는 없다.

---

## 위험도

**LOW**

구현 정확성 관점에서 Critical/High 항목이 없다. 지적된 WARNING은 UX 레이블 모호성으로 런타임 동작에는 영향이 없고 catalog-sync 테스트를 통과하는 데에도 지장이 없다. 전체 변경이 metadata 자료구조 row 추가라는 단순 반복 패턴으로 구성되어 있어 회귀 위험이 최소화되어 있다.

STATUS: OK
