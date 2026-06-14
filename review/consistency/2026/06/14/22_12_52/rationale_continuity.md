# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-form-hygiene.md`
검토 모드: `--spec`
검토 일시: 2026-06-14

---

## 발견사항

### [INFO] D-2 Decision 1: `details[]` 길이 1 구현 현실 — 계약 배열과 정합 명시 필요

- **target 위치**: `spec-draft-form-hygiene.md` §D-2 Decision 1 — "EIA `details[]` 는 따라서 보통 길이 1 배열이다 (계약상 배열이지만 현 구현은 단건)"
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` §5.1 에러 코드 표 (`VALIDATION_ERROR` 행, `details[]` 배열 정의) 및 §Rationale R13 (`FormValidationError → 400 VALIDATION_ERROR (+ details[])` 매핑 확정). `spec/4-nodes/6-presentation/4-form.md` §6.2 검증 실패 주석 ("EIA 는 `400 VALIDATION_ERROR` + `details[]`")
- **상세**: EIA spec 과 form.md §6.2 는 `details[]` 를 "배열(`{field, message, code}` 배열)"로 정의하며 길이 제한 없이 공개 계약을 맺었다. target 의 Rationale 은 "현 구현은 단건" 이라는 구현 사실을 기록하면서도 "계약상 배열이지만" 이라는 괄호로 계약 다중성은 유지한다고 적어, 두 레이어를 혼재 표현하고 있다. EIA R13 이 `details[]` 를 정식 배열로 확정한 이후 이를 번복하는 결정은 없으나, 현 구현이 단건임을 form.md Rationale 에 기록하면서 EIA spec 의 `details[]` 계약이 단건으로 축소됐는지 여부가 cross-doc 독자에게 불명확해질 수 있다.
- **제안**: 신설 Rationale 문구를 "EIA `details[]` 는 계약상 다중 배열이며, 현 `validateFormSubmission` 구현(FIRST 오류 반환)에서 실제로는 항상 길이 1 이다. 다중 배열 기능 자체는 후속 전수 수집 구현 시 계약 변경 없이 확장된다." 로 명확히 분리하면 EIA R13 계약과의 연속성이 보인다.

---

### [INFO] D-1: WS §4.2 부연 추가가 기존 Rationale 항목(`§Rationale "§4.2 submit_form/click_button payload·ack 정정"`)과 보완 관계임을 명시 권장

- **target 위치**: `spec-draft-form-hygiene.md` §D-1 전체
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md` §Rationale "§4.2 submit_form/click_button payload·ack 정정 — 구현 현실 채택 (2026-06-10 spec-sync audit)" 및 §4.2 "실패 ack 형태" 주석 (`{ success: false, error: string, errorCode?: string }` 평면 확인)
- **상세**: WS §4.2 의 `VALIDATION_ERROR` 행은 이미 "EIA REST 의 `400 VALIDATION_ERROR` + `details[]` 와 동일 의미·동일 검증 지점" 으로 기술하고 있다. `실패 ack 형태` 주석도 평면 `{ success, error, errorCode? }` 를 명시한다. D-1 이 추가하는 "ack payload 에 `details[]` 미포함" 부연은 기존 Rationale 의 ack 정정 항목이 암묵적으로 확정한 내용과 일치하므로, 충돌은 없다. 다만 기존 Rationale 에서 이미 "평면 ack" 를 확정했음을 cross-ref 로 명시하면 추후 독자가 두 항을 별도 결정으로 오해할 여지를 줄일 수 있다.
- **제안**: D-1 에서 WS §4.2 를 수정할 때 Rationale 항목 "§4.2 submit_form/click_button payload·ack 정정"에 보완 주석("ack 평면 형태는 `details[]` 를 포함하지 않음, §본문 `VALIDATION_ERROR` 행 부연과 정합")을 추가하거나, 본문 인라인 설명에 기존 Rationale 항목을 cross-ref 로 달아주는 것을 권장한다.

---

## 요약

target 문서의 두 변경(D-1·D-2)은 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하지 않는다. D-2 Decision 1 의 `details[]` "현 구현 단건" 표현이 EIA R13 의 다중 배열 계약과 레이어가 다르다는 점이 미묘한 혼란 요소로 작용할 수 있으나, 계약 자체를 번복하는 것이 아니라 구현 현실을 보조 기록하는 수준이다. 두 INFO 사항 모두 문구 명확화로 해소 가능한 수준이며 차단 등급에 해당하지 않는다.

## 위험도

LOW
