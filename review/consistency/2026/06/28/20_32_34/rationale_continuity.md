# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-m1-integration-errorcode.md`
검토 모드: spec draft (--spec)
검토일: 2026-06-28

---

## 발견사항

발견된 CRITICAL 또는 WARNING 항목 없음.

### [INFO] error-codes.md 미등재 결정 — Rationale 와 완전 정합

- target 위치: draft `## 변경 1 — §9.4 통합 에러 카탈로그` 의 "error-codes.md 미등재 결정" 소항목
- 과거 결정 출처: `spec/conventions/error-codes.md ## Rationale` "왜 SoT 를 분리하는가" 항 + `§3` 흡수 조건 설명
- 상세: draft 는 `INTEGRATION_INVALID_SERVICE` 를 `error-codes.md §3` 에 등재하지 않는 이유를 세 가지로 설명한다 — (1) `error-codes.md` 는 명명 규율 전용, (2) §3 은 §1 을 위반하는 기존 코드의 예외 레지스트리, (3) `INTEGRATION_INVALID_SERVICE` 는 §1 준수 정상 코드라 §3 에 넣으면 레지스트리 의미 오염. 이는 `error-codes.md` Rationale 의 "왜 SoT 를 분리하는가: 카탈로그는 `3-error-handling.md`, 본 문서는 명명 규율만 소유" 와 `§3 흡수 조건 = rename 이 breaking 이다 OR rename 이 모듈 일관성을 해친다` 의 합집합과 완전히 일치한다. 기각된 대안을 재도입하거나 원칙을 위반하는 요소가 없다.
- 제안: 특별한 조치 불필요. 기존 Rationale 의 결론을 정확히 따르고 있다.

### [INFO] §9.2 preview-test body 필드명 변경 — Rationale 부재이나 순수 문서 정합

- target 위치: draft `## 변경 2 — §9.2 preview-test 요청 바디 필드명` + `spec/2-navigation/4-integration.md` §9.2 표 `POST /api/integrations/preview-test` 행
- 과거 결정 출처: `spec/2-navigation/4-integration.md ## Rationale` 에 preview-test DTO 필드명 관련 항목 부재
- 상세: `service` → `serviceType` 변경은 코드(`PreviewTestDto`) 가 이미 `serviceType` 을 사용하고 있어 순수 문서 오탈자 교정이다. 신규 설계 결정이 아니라 코드 SoT 에 맞추는 행위이므로 별도 Rationale 항을 추가하지 않아도 무방하다 (`spec/2-navigation/4-integration.md ## Rationale` 전문이 이미 "spec 을 코드에 맞춘다" 라는 맥락을 가지고 있음). 단, `oauth/begin` 의 `body.service` 필드는 별도 `OAuthBeginDto` 에서 실제 필드명 `service` 를 사용하므로 건드리지 않은 것이 올바른 범위 판단이다.
- 제안: 필요하다면 draft 의 "범위 밖 (미변경): oauth/begin 행의 `service` 는 별도 DTO" 설명을 spec 의 §9.2 표 비고나 Rationale 에 한 줄 명시해 두면 미래 혼동을 더 줄일 수 있다. 그러나 현 상태도 Rationale 원칙 위반은 아니다.

---

## 요약

target draft 가 다루는 두 변경(§9.4 에러 카탈로그 신규 bullet 등재 + §9.2 DTO 필드명 정정) 모두 기존 Rationale 에서 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하는 요소가 없다. 특히 `error-codes.md` 미등재 결정은 해당 문서 자체의 Rationale("카탈로그는 `3-error-handling.md` / 본 문서는 명명 규율만 소유")을 정확히 인용해 근거를 제시하고 있어, 오히려 Rationale 연속성이 강하게 유지된 사례다. 결정의 번복이나 암묵적 invariant 우회는 식별되지 않았다.

---

## 위험도

NONE
