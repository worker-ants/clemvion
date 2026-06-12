## 발견사항

### [INFO] `order/orders.md`, `store/orders-setting.md` 등에 동일 버그 잔존 — 미수정
- target 위치: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` (GET 응답 표 line 49, POST 응답 표 line 97) — 이번 diff 에서 수정됨
- 충돌 대상: `spec/conventions/cafe24-api-catalog/order/orders.md` (line 839, 1400), `spec/conventions/cafe24-api-catalog/store/orders-setting.md`, `spec/conventions/cafe24-api-catalog/store/users.md` (`↳ ↳ order` 2곳) — 동일 `order` 래퍼 행에 "정렬 순서 asc : 순차정렬 · desc : 역순 정렬" 설명이 그대로 남아 있음
- 상세: target diff 는 `appstore-orders.md` 두 곳의 `order` 응답 래퍼 설명만 "(응답 객체)"로 교정하고, 동일 패턴이 있는 다른 entity 파일은 이번 변경에서 미포함. `_overview.md §7.3` 신규 추가 줄이 이를 "수동 회귀 검증 대상"으로 명시하고 `order/orders.md` 를 예시로 언급하므로 인지된 사안이다. Field-level 카탈로그 파일은 `catalog-sync.spec.ts` 대상 외이고 생성기로 재생성 가능하므로 즉각 블로커는 아니다.
- 제안: `_overview.md §7.3` 의 회귀 검증 레시피에 명시된 절차(`order/orders.md`, `store/orders-setting.md` 등 재생성 후 확인)를 후속 PR 에서 수행하거나 backlog(`cafe24-backlog-residual.md`)에 추적 항목으로 추가. 이번 diff 의 범위 내에서는 수정 의무 없음.

### [INFO] `_generator.py` 변경이 field-level 파일 재생성 시 동작 변경 — 기존 생성 파일과 미동기
- target 위치: `spec/conventions/cafe24-api-catalog/_generator.py` (lines 381–385, `resp_param_rows` 함수 내 cross-map fallback 분기)
- 충돌 대상: `spec/conventions/cafe24-api-catalog/` 하위 존재하는 222개 field-level `.md` 파일 중 래퍼 이름이 요청 파라미터 이름과 충돌하는 entity (예: `order/orders.md`, `store/orders-setting.md`, `promotion/discountcodes.md`, `order/reservations.md` 등 grep 결과 최소 8개 파일)
- 상세: `_generator.py` 의 버그 수정 후 재생성을 실행하면 `order/orders.md` 등의 `order` 래퍼 행 설명이 "(응답 객체)"로 바뀔 것이나, 현재 커밋된 파일들은 구버전 생성기 산출물이다. `_overview.md §7.3` 은 이를 "수동 확인" 레시피로 문서화했고, `_overview.md §7.3` 본문은 파일들이 재생성 전에 잘못된 값을 가질 수 있음을 묵시적으로 허용한다. 생성기는 결정적·멱등이므로 재생성 후에만 파일이 맞아진다.
- 제안: `_generator.py` 수정과 영향받는 entity 파일들의 재생성·커밋을 같은 PR 에 포함하거나, 별도 후속 PR 로 추적. 현재 diff 범위에서는 명시적 규약 위반이 아님 (field-level 파일은 `catalog-sync.spec.ts` 검증 대상 외).

### [INFO] `_overview.md §7.3` 신규 추가 줄이 §7.3 제목 섹션과 동일 섹션에 배치 — 기존 §7.4 heading 과 위치 충돌 없음(확인)
- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §7.3 "출처와 정확성 원칙" 본문 끝에 1줄 추가
- 충돌 대상: 없음 — §7.4 "sync 테스트와의 관계" 는 새 줄 이후에 별도 heading 으로 존재하며, heading 구조 변경 없음. `spec-impl-evidence.md §1` 의 `cafe24-api-catalog/<resource>/**/*.md` 제외 규칙과도 무관 (추가된 줄은 `_overview.md` 에 속하며 `_overview.md` 는 정식 spec임).
- 제안: 없음.

---

## 요약

이번 diff 는 `spec/conventions/cafe24-api-catalog/` 범위 내 3파일의 좁은 수정으로, 다른 spec 영역(데이터 모델, API 계약, RBAC, 상태 머신 등)에 직접 영향을 주는 변경이 없다. 생성기(`_generator.py`)의 container/scalar 판별 수정은 field-level 카탈로그 파일의 재생성 결과에만 영향을 미치며, catalog-sync 테스트(`spec/conventions/cafe24-api-catalog/_overview.md §4` 규칙 1~9)의 검증 대상인 top-level index 표나 backend 메타데이터와는 무관하다. 동일 `order` 래퍼 버그가 다른 entity 파일(`order/orders.md` 등 최소 8개)에 잔존하지만, 이는 `_overview.md §7.3` 의 새 회귀 검증 레시피가 명시적으로 인지하고 후속 수동 검증 대상으로 분류한 사안이다. Cross-spec 일관성 관점에서 채택 블로커 충돌은 발견되지 않는다.

---

## 위험도

NONE
