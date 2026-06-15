### 발견사항

- **[INFO]** 검증 규칙 열거 확장은 기존 Rationale 의 설계 원칙과 완전히 정합함
  - target 위치: `plan/in-progress/spec-draft-form-validation-enum.md` §변경 1·2·3
  - 과거 결정 출처: `spec/4-nodes/6-presentation/4-form.md ## Rationale` — `"validation.min/max·pattern 은 공유 validator 확장으로, file 검증은 cluster 로 분리"` 항목
  - 상세: form.md Rationale 은 `validateFormSubmission` 이 `min`/`max`·`pattern` 을 포함하는 공유 validator 임을 명문화하고, EIA/WS/UI 3 경로가 동일 검증 규칙을 공유한다고 선언했다 (PR #610 A-1). target 이 제안하는 변경은 그 구현 사실을 인접 spec 의 "illustrative 열거(`등`)" 에 반영하는 순수 doc 동기화다. 기각된 대안이 없으며, 번복도 없다.
  - 제안: 변경 자체는 문제없음. 추가 조치 불필요.

- **[INFO]** chat-channel-adapter §4.1 step 4 의 표현 — `maxLength` 누락 여부 확인 권고
  - target 위치: `plan/in-progress/spec-draft-form-validation-enum.md` §변경 1
  - 과거 결정 출처: `spec/4-nodes/6-presentation/4-form.md ## Rationale` — 검증 적용 순서 `required → type → minLength/maxLength → min/max → pattern → select/radio`
  - 상세: form.md Rationale 의 검증 순서에는 `minLength`/`maxLength` 가 짝으로 나열된다. target §변경 1 (`§4.1 step 4`) 은 `minLength·maxLength·min/max(숫자 범위)` 를 추가해 `maxLength` 를 포함한다. 반면 §변경 2 (`§4.2 step 3`) 는 `minLength·maxLength · min/max(숫자 범위)` 를 추가해 역시 `maxLength` 를 포함한다. 두 변경 모두 `maxLength` 를 포함하므로 정합하나, 실제 spec 현재 텍스트의 §4.2 step 3 이 `type / pattern / minLength 등` 으로 이미 `pattern` 을 포함하고 있어 추가 목록 중 `pattern` 이 중복 삽입되지 않도록 편집 시 주의 필요하다 (단순 중복이므로 기능 영향은 없음).
  - 제안: 실제 spec 편집 시 §4.2 step 3 의 기존 `pattern` 과 새로 삽입할 항목 간 중복 여부를 확인하고, 중복 없이 정렬할 것.

- **[INFO]** WS protocol VALIDATION_ERROR 행 열거 확장 — details[] 미포함 원칙과의 정합 확인
  - target 위치: `plan/in-progress/spec-draft-form-validation-enum.md` §변경 3
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md §4.2 VALIDATION_ERROR` Rationale 항목 (`§4.2 submit_form/click_button payload·ack 정정` 및 인라인 주석)
  - 상세: WS spec VALIDATION_ERROR 행은 `ack payload 는 평면 { success:false, error, errorCode:'VALIDATION_ERROR' } 로 field-level details[] 를 포함하지 않는다` 는 합의된 invariant 를 보유한다. target 변경은 이 행의 **검증 규칙 열거 예시** (`필수/type/minLength 등` → `필수/type/minLength·maxLength·min/max·pattern 등`) 만 갱신하는 것으로, details[] 미포함 원칙이나 ack payload 형태는 건드리지 않는다. 설계 invariant 위반 없음.
  - 제안: 변경 서술이 `등` 을 유지하고 있어 illustrative 성격이 명확하므로 현행 표현 방식 그대로 진행 가능.

### 요약

target 문서가 제안하는 세 곳의 검증 규칙 열거 확장은 모두 PR #610(A-1) 에서 구현·문서화된 `validateFormSubmission` 의 min/max·pattern 지원을 인접 spec 의 "대표 예시 열거(`등`)" 에 사후 반영하는 순수 현행화다. `spec/4-nodes/6-presentation/4-form.md ## Rationale` 에 명문화된 공유 validator 원칙 및 검증 적용 순서와 완전히 정합하며, 어떤 spec 의 Rationale 에서도 이 열거 확장을 기각·폐기한 결정이 없다. 합의된 invariant(WS ack payload details[] 미포함, illustrative 열거 성격 유지)도 침해하지 않는다. 유일한 주의 사항은 §4.2 step 3 기존 텍스트에 이미 `pattern` 이 포함되어 있으므로 편집 시 중복 삽입 여부를 확인하는 것이다.

### 위험도

NONE
