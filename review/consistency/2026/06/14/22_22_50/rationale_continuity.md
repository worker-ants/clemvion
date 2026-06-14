# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/6-presentation/` (구현 착수 전 검토 — --impl-prep)
검토 모드: `--impl-prep`, scope=`spec/4-nodes/6-presentation/`
검토 일시: 2026-06-14

---

## 발견사항

### [INFO] `validation.min`/`max`/`pattern` "Planned" defer — 과거 "FIRST 오류" Rationale 과의 확장 경계 명시 권장

- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §Rationale "file 검증(MIME/크기/개수)·`validation.min`/`max`·`pattern` 분리 defer" — "공유 validator 확장만으로 3 경로 공통 적용" 문구
- **과거 결정 출처**: `spec/4-nodes/6-presentation/4-form.md` §Rationale "field 검증은 FIRST 오류만 반환 (전수 수집 아님)" — "첫 번째 위반에서 즉시 실패를 표면" 원칙. `spec/4-nodes/6-presentation/4-form.md` §Rationale "검증 지점 = publisher 측 `continueExecution` chokepoint (3 경로 공통)" — 단일 chokepoint 원칙
- **상세**: defer Rationale 은 "`validation.min`/`max`·`pattern` 은 공유 validator 확장만으로 3 경로 공통 적용" 이라 기술한다. 이는 기존 FIRST 오류 원칙(필드 순서대로 검사, 첫 위반 즉시 throw) 의 연장선에 있다는 암묵적 가정이나, 새 규칙 추가 시 FIRST 원칙이 그대로 유지될지 여부가 명시되지 않았다. 예를 들어, `min`/`max` 위반 메시지 생성 방식(range 초과 vs underflow 별도 메시지 vs 단일 range 메시지)이나 `pattern` 과 `min`/`max` 동시 위반 시 어느 쪽이 "첫 번째" 가 되는지는 현재 defer Rationale 에서 규정하지 않는다. 기각된 대안의 재도입이나 invariant 위반은 아니지만, 구현 단계에서 FIRST 원칙을 어디까지 적용하는지에 대한 해석 여지가 남는다.
- **제안**: defer Rationale 말미에 "추가 규칙은 FIRST 오류 원칙(§Rationale 첫 번째 항)을 그대로 따른다 — 필드 순서·규칙 순서(required → type → minLength/maxLength → min/max → pattern) 기준 첫 위반에서 즉시 throw" 한 문장을 추가하면 구현 시 해석 분기를 방지할 수 있다.

---

### [INFO] WS `VALIDATION_ERROR` ack 에서 `details[]` 미포함 결정 — 기존 Rationale "§4.2 ack 정정" 과의 cross-ref 보완 권장

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §7.1 에러 코드 표 `VALIDATION_ERROR` 행 — "ack payload 는 평면 `{ success:false, error, errorCode:'VALIDATION_ERROR' }` 로 field-level `details[]` 를 포함하지 않는다" (HEAD commit #609 신규 부연)
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md` §Rationale "§4.2 submit_form/click_button payload·ack 정정 — 구현 현실 채택 (2026-06-10 spec-sync audit)" — "실패 ack 형태: `{ success: false, error: string, errorCode?: string }` **평면 필드**" 확정. 해당 Rationale 이 이미 4개 continuation 명령의 ack 평면 형태를 확정했다.
- **상세**: 이번 변경이 추가한 "ack payload 에 `details[]` 미포함" 부연은 기존 Rationale 의 "평면 ack" 확정과 일치하며 충돌하지 않는다. 단, 본문 인라인 부연만 추가했고 기존 Rationale 항목에 cross-ref 가 없어 두 기술이 독립적으로 보일 수 있다. 이 자체가 기각된 대안의 재도입이나 invariant 위반은 아니지만, 향후 독자가 "`details[]` 미포함" 결정의 근거를 찾을 때 Rationale 항목으로 도달하지 못할 수 있다.
- **제안**: `VALIDATION_ERROR` 행의 부연 말미에 "([§Rationale `§4.2 ack 정정`](spec/5-system/6-websocket-protocol.md#42-submitformclickbutton-payload·ack-정정--구현-현실-채택-2026-06-10-spec-sync-audit) 의 평면 ack 확정과 정합)" 형태의 cross-ref 를 추가하면 결정 연원을 단일 경로로 추적할 수 있다.

---

### [INFO] `details[]` "계약상 다중 배열, 현 구현 항상 길이 1" — EIA `## Rationale` 과의 레이어 분리 명시 완성

- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §Rationale "field 검증은 FIRST 오류만 반환" — "EIA `400 VALIDATION_ERROR` 의 `error.details[]` 는 계약상 다중 배열이지만 현 구현은 항상 길이 1 이다"
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` §5.1 / §Rationale R13 — `details[]` 를 배열 타입으로 확정 (길이 제한 없는 공개 계약). 이전 rationale_continuity 검토(review/consistency/2026/06/14/22_12_52/rationale_continuity.md)에서 INFO 등급으로 지적된 항목.
- **상세**: 이번 commit (#609) 에서 추가된 form.md §Rationale 텍스트를 확인한 결과 — "두 레이어는 구분된다: 계약은 복수 entry 를 허용하므로, 향후 전수 수집으로 바뀌어도 `details[]` 응답 형태 자체는 변경이 불필요하다" — 이전 검토에서 제안한 명확화가 정확히 반영됐다. EIA R13 의 다중 배열 계약을 번복하지 않고 구현 현실(FIRST 단건)을 하위 레이어로 기록하는 방식이 완성됐다. 잔존 INFO 이므로 별도 조치 불필요하나, 검토 completeness 차원에서 기록한다.
- **제안**: 없음 (이전 제안이 이미 반영됨).

---

## 요약

검토 대상 `spec/4-nodes/6-presentation/` 범위(특히 commit #609 에서 신설된 `4-form.md` §Rationale 3항목 및 `6-websocket-protocol.md` §7.1 `VALIDATION_ERROR` 행 부연)는 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하지 않는다. 신설 Rationale 3항목(FIRST 오류 반환 / chokepoint 단일화 / defer)은 기존 EIA R13·WS §4.2 ack 정정 Rationale 과 방향이 일치하며, `details[]` 레이어 분리 표현도 이전 검토에서 지적한 INFO 를 정확히 반영했다. 단, `validation.min`/`max`/`pattern` defer Rationale 이 FIRST 원칙의 적용 범위를 명시하지 않아 구현 단계에서 해석 여지가 생기는 점과, WS `VALIDATION_ERROR` 부연에서 기존 Rationale 항목으로의 cross-ref 가 없는 점이 사소한 연속성 보완 과제로 남는다. 양쪽 모두 INFO 수준이며 구현 착수 차단 사유가 아니다.

## 위험도

LOW

STATUS: SUCCESS
