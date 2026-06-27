# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/swagger.md` (diff vs origin/main)
검토 모드: --impl-done, scope=spec/conventions/

---

## 발견사항

- **[INFO]** §2-5 "모든 성공 응답" 원칙의 암묵적 범위 축소
  - target 위치: `spec/conventions/swagger.md` §2-5 응답 wrapping
  - 과거 결정 출처: 원본 §2-5 본문 — "TransformInterceptor 로 **모든** 성공 응답을 `{ data: ... }` 로 감쌉니다"
  - 상세: 원본은 "모든(all)"이라는 보편적 원칙으로 기술됐으나, 변경 후 "모든"이 삭제되고 `'data' in data` 분기의 pass-through 예외가 명시됐다. 이는 원칙의 범위 축소처럼 보이지만, pass-through 분기는 TransformInterceptor 구현에 이미 존재했고 spec이 그것을 누락한 상태였다. 즉 spec-impl 간 불일치(spec 과도 일반화, impl 예외 존재)를 바로잡은 것이다. 새 Rationale (`§5 ApiOkPaginatedResponse single-wrap`) 이 이를 명시적으로 설명하므로 "결정의 무근거 번복"에 해당하지 않는다.
  - 제안: INFO 수준으로 충분. 이미 추가된 §5 Rationale 가 변경 근거를 커버한다.

- **[INFO]** 레거시 §6 항목과의 내부 정합 재확인 필요
  - target 위치: `spec/conventions/swagger.md` §6 레거시 패턴 제거
  - 과거 결정 출처: 원본 §6 — "`{ data: { items, totalItems, page, limit } }` 처럼 서비스 실제 반환 형태(`{ data, pagination }`)와 다른 스키마는 버그입니다"
  - 상세: 원본 §6 은 이미 service 실제 반환 형태를 `{ data, pagination }` (single-wrap 형태)로 지칭하고 double-wrap 을 버그로 표기했다. 변경 전 §5-2 표의 `{ data: { data, pagination } }` (double-wrap 기재)와 §6 서술이 이미 모순 상태였으며, 이번 변경이 그 모순을 해소했다. 즉 기각된 대안 재도입이 아니라 이미 §6 에 기각 표기된 double-wrap을 §5-2 표에서도 제거한 것이다.
  - 제안: 현행 수정이 정확하다. 추가 조치 불필요.

---

## 요약

이번 변경(`spec/conventions/swagger.md`)은 `ApiOkPaginatedResponse` 의 wire shape를 double-wrap `{ data: { data, pagination } }` 에서 single-wrap `{ data: [...], pagination }` 으로 정정하고, §2-5 에 `TransformInterceptor` 의 pass-through 예외를 명시하며, 신규 Rationale 항목(`§5 ApiOkPaginatedResponse single-wrap`)을 추가했다. 기각·폐기된 설계 대안을 재도입하는 패턴은 없으며, 오히려 원본 §6 이 이미 double-wrap을 버그로 지칭했는데도 §5-2 표가 double-wrap을 기재한 내부 모순을 해소한 것이다. 합의된 "성공 응답 `{ data }` 래핑" 원칙에서 pass-through 예외를 추가하는 것은 기존 구현에 이미 존재하는 분기(`'data' in data`)를 spec에 반영한 것이므로 설계 역전이 아니다. 새 Rationale 에 "single-wrap 을 double-wrap 으로 되돌리지 말 것"이라는 명시적 invariant가 추가되어 향후 회귀도 방지된다. Rationale 연속성 관점에서 위반 사항은 없고 오히려 spec-impl 정합성이 개선됐다.

---

## 위험도

NONE
