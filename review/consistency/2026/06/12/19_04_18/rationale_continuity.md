### 발견사항

해당 diff 는 5개 파일에 걸쳐 아래 변경을 포함한다.

1. `spec/conventions/cafe24-api-catalog/_generator.py` — `resp_param_rows()` 의 cross-map fallback 에 컨테이너 종류(`obj`/`arr`) 가드 추가
2. `spec/conventions/cafe24-api-catalog/_overview.md §7.3` — 위 동작을 수동 회귀 검증 레시피로 명문화
3. `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `order` 래퍼 행 설명 `"정렬 순서 asc…"` → `"(응답 객체)"` 보정
4. `spec/conventions/cafe24-api-catalog/order/orders.md` — 동일 보정 2곳
5. `spec/conventions/cafe24-api-catalog/store/orders-setting.md` — 동일 보정 2곳

Rationale 연속성 관점에서 기각·폐기된 결정 재도입이나 합의 원칙 위반은 발견되지 않았다.

**[INFO]** `_overview.md §7.3` 신규 항목에 Rationale 절 미기재
- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md §7.3` 마지막 bullet
- 과거 결정 출처: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "property list 에 없는 wrapper 는 `(응답 객체)`/`(목록)`" 원칙; `spec/conventions/cafe24-api-catalog/_overview.md §7.3` — "추측·날조로 field·샘플을 채우지 않는다" 정확성 원칙
- 상세: 신규 bullet 이 기존 원칙을 위반하지 않고 오히려 강제·명문화한다. 다만 `_overview.md` 에 `## Rationale` 절 자체가 없어서, "왜 컨테이너에는 cross-map fallback 을 적용하지 않는가"의 의사결정 배경(`요청 파라미터 설명을 응답 래퍼에 잘못 대입하면 의미 오염` 이라는 근거)이 §7.3 bullet 내 인라인 산문으로만 기술되고, spec 의 표준 `## Rationale` 항으로 추출되지 않은 상태다.
- 제안: 필수 수준은 아니지만, `_overview.md` 에 `## Rationale` 절을 신설해 "컨테이너 cross-map fallback 제외 근거 (동일 이름 요청 파라미터의 스칼라 설명이 응답 래퍼에 의미 오염 없이 이전 불가)" 를 한 항으로 추출하면 향후 리뷰어가 §7.3 bullet 과 배경 결정을 함께 이해하기 쉬워진다.

### 요약

이번 target diff 는 `_overview.md §7.2` 의 "wrapper는 `(응답 객체)`/`(목록)`" 원칙과 §7.3 의 "추측·날조 금지" 정확성 원칙을 **위반하는 버그(컨테이너 행에 요청 파라미터 설명이 잘못 복사)**를 수정하고, 그 수정 내용을 spec 과 생성기에 동시 반영한 일관된 버그픽스다. 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하거나, 합의된 invariant 를 우회하는 설계는 포함되지 않는다. 유일한 개선 여지는 `_overview.md` 에 `## Rationale` 절이 없어 해당 결정 배경이 본문 산문에만 묻혀 있다는 점이며, 이는 INFO 수준이다.

### 위험도
NONE
