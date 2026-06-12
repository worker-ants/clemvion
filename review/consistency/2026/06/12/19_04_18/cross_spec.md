# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`  
Target: `spec/conventions/` (diff-base: `origin/main`)  
실제 변경 파일 (5개):
- `spec/conventions/cafe24-api-catalog/_generator.py`
- `spec/conventions/cafe24-api-catalog/_overview.md`
- `spec/conventions/cafe24-api-catalog/application/appstore-orders.md`
- `spec/conventions/cafe24-api-catalog/order/orders.md`
- `spec/conventions/cafe24-api-catalog/store/orders-setting.md`

---

## 발견사항

### INFO: store/users.md 의 `↳ ↳ order` 응답 행에 잔존 오기재

- **target 위치**: 변경된 파일 외부 — 기존 파일 `spec/conventions/cafe24-api-catalog/store/users.md` 라인 136, 195
- **충돌 대상**: 이번 diff 가 수정한 `application/appstore-orders.md`, `order/orders.md`, `store/orders-setting.md` 의 수정 패턴 (`응답 객체`)
- **상세**: `store/users.md` 의 응답 파라미터 표에서 `↳ ↳ order` (메뉴 접근 권한 하위 "주문 관리" 섹션 — 도메인 객체) 에 `정렬 순서 asc : 순차정렬 · desc : 역순 정렬` 설명이 달려 있다. 이는 동일한 `resp_param_rows` cross-map fallback 버그의 잔여 인스턴스다. 이번 diff 가 수정한 3개 파일은 top-level `order` 래퍼만 대상이었고, 이 케이스(`menu_access_authority.order` / `detail_authority_setting.order`)는 누락됐다. 본 파일은 `_overview.md §7.3` 의 수동 검증 예시 목록(`appstore-orders.md`, `order/orders.md`)에도 포함되지 않아 follow-up 대상으로 인식되지 않을 수 있다.
- **제안**: `store/users.md` 라인 136, 195 의 `정렬 순서 asc : 순차정렬 · desc : 역순 정렬` 을 `(응답 객체)` 로 수정. `_overview.md §7.3` 의 수동 검증 예시에 `store/users.md` 도 추가하거나, 문서에서 "이 3개 파일에만 해당" 이 아닌 패턴 서술로 일반화 권장. — 단, 본 문서는 spec-impl-evidence.md R-7 에 의해 frontmatter lifecycle 비추적 생성기 산출물이므로 내용 오기재는 spec 외부(구현 사양) 에 영향을 주지 않는다.

---

## 요약

이번 diff (`spec/conventions/cafe24-api-catalog/`) 는 `_generator.py` 의 `resp_param_rows` 함수에서 컨테이너 타입(obj/arr) 필드에 대해 request/global/variant 파라미터 설명의 cross-map fallback 을 차단하는 버그 수정 + 그 결과를 `_overview.md §7.3` 에 수동 검증 정책으로 문서화 + 이미 잘못 생성된 3개 field-level 카탈로그 파일 수정으로 구성된다. 다른 spec 영역(data-model, API convention, RBAC, 상태 전이, 요구사항 ID)과의 교차 충돌은 없다 — 변경 범위가 모두 `cafe24-api-catalog` 필드 단위 레퍼런스 파일(spec-impl-evidence R-7 적용 대상, lifecycle 비추적)과 그 생성기 내부 로직에 국한된다. 유일한 불일치는 `store/users.md` 의 동일 패턴 버그 잔존(INFO 등급)으로, 이번 수정이 직접 도입한 것이 아니라 기존 생성기 버그의 누락된 적용 대상이다.

---

## 위험도

LOW
