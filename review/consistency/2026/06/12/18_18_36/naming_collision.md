# 신규 식별자 충돌 검토 결과

검토 범위: `spec/conventions/` diff vs `origin/main` (--impl-done 모드)

변경 파일 (3):
- `spec/conventions/cafe24-api-catalog/_overview.md` (§7.3 에 新 bullet 1개 추가)
- `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` (응답 래퍼 `order` 라벨 fix ×2)
- `spec/conventions/cafe24-api-catalog/_generator.py` (검토 범위 — spec 문서가 아닌 생성기 스크립트, 식별자 충돌 관점 해당 없음)

---

## 발견사항

### 발견사항 1

- **[WARNING]** `order/orders.md` 의 `order` 응답 래퍼 라벨 미수정 — 언급은 됐으나 fix 누락
  - target 신규 식별자: `_overview.md §7.3` 新 bullet 은 `order/orders.md` 를 명시적 회귀 검증 대상 예시로 기재 (`application/appstore-orders.md` 와 함께)
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/order/orders.md` 라인 839, 1400 — `| \`order\` |  | 정렬 순서 asc : 순차정렬 · desc : 역순 정렬 |` (응답 파라미터 표의 래퍼 행)
  - 상세: `application/appstore-orders.md` 는 이번 diff 에서 `(응답 객체)` 로 정정됐다. 그런데 `_overview.md §7.3` 새 bullet 이 `order/orders.md` 를 두 번째 예시로 명시함에도 해당 파일은 수정되지 않아 동일 버그가 잔존한다. 이 상태에서 spec 을 읽는 개발자는 `order` 응답 래퍼가 "정렬 순서 asc/desc" 를 뜻한다고 오독할 수 있다.
  - 제안: `order/orders.md` 라인 839 및 1400 의 `order` 행 설명을 `(응답 객체)` 로 정정한다 (동일 패턴의 `application/appstore-orders.md` fix 와 동일 작업).

### 발견사항 2

- **[INFO]** `resp_param_rows` 코드 심볼을 spec 문서에 직접 노출
  - target 신규 식별자: `_overview.md §7.3` 新 bullet 내 `` `resp_param_rows` `` 참조
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/_generator.py` 라인 353 — `def resp_param_rows(resp_str, props, req_map=None, global_map=None, variant_map=None):`
  - 상세: 식별자 자체는 충돌하지 않는다 (generator 함수명과 정확히 일치하며 의도적 참조). 다만 이 함수명이 변경될 경우 spec 문서도 함께 갱신해야 하는 결합이 생긴다. 현재는 동일 디렉토리 내 파일이라 추적 부담이 낮다.
  - 제안: 현상 유지 허용. 향후 generator 리팩터링 시 spec 문서도 함께 갱신 필요함을 주석 또는 별도 TODO 로 남기면 충분.

### 발견사항 3

- **[INFO]** `store.md` 내 `privacy_*` operation ID 와 `privacy` resource prefix 잠재 혼동 (이번 diff 와 무관, 기 인지된 사항)
  - target 신규 식별자: 이번 diff 는 해당 식별자를 새로 도입하지 않음. `_overview.md §5` 각주에 "follow-up 가능" 언급이 이미 원본에 있었으며 이번 diff 에서 변경 없음.
  - 기존 사용처: `store.md` 라인 85-90 — `privacy_boards_get`, `privacy_boards_update`, `privacy_join_get`, `privacy_join_update`, `privacy_orders_get`, `privacy_orders_update`. `privacy.md` resource 는 `customers_privacy_*` 패턴 사용.
  - 상세: `privacy_` prefix 의 `store.md` operation 들은 "개인정보 정책(store 설정)" 을 뜻하고, `privacy.md` resource 는 "회원 개인정보(customer PII)" 를 뜻한다. resource 내 ID 는 unique 해 catalog-sync 테스트 통과에 문제 없다. 그러나 cross-resource 검색 시 혼동 가능.
  - 제안: 이번 diff 대상이 아니므로 별도 follow-up 트랙에서 처리. 현 상태를 이번 검토의 차단 사유로 보지 않음.

---

## 요약

이번 diff 가 도입하는 신규 식별자는 `_overview.md §7.3` 의 절차 설명 bullet 하나이며, 기존 사용처와 의미 충돌하는 새 ID/엔티티명/API endpoint/이벤트명/환경변수/파일경로는 없다. `resp_param_rows` 는 동일 디렉토리의 `_generator.py` 함수명과 의도적으로 일치하며 충돌이 아니다. 단, 새 bullet 이 회귀 검증 예시로 명시한 `order/orders.md` 의 동일 버그(`order` 응답 래퍼 라벨 "정렬 순서 asc...")가 이번 diff 에서 수정되지 않아 spec 문서 내 불일치가 잔존하는 점은 WARNING 으로 분류한다.

## 위험도

LOW

STATUS: SUCCESS
