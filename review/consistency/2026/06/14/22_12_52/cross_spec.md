# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/spec-draft-form-hygiene.md` (D-1 / D-2)

---

## 발견사항

### [INFO] D-1 부연이 기존 WS §4.2 기술과 내용상 일치 — 추가 충돌 없음

- **target 위치**: D-1 변경안 — WS §4.2 `VALIDATION_ERROR` 행에 "ack payload 는 평면 `{ success:false, error, errorCode:'VALIDATION_ERROR' }` 로 **field-level `details[]` 를 포함하지 않는다**" 부연 추가
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` §4.2 "실패 ack 형태" 주석 (L321~L323), EIA §5.1 (L313)
- **상세**: 기존 WS §4.2 "실패 ack 형태" 주석은 이미 `{ success: false, error: string, errorCode?: string }` 을 **평면 필드**로 명기하고 있으며, EIA §5.1 표는 `400 VALIDATION_ERROR + details[]` 가 EIA REST 전용임을 이미 기술한다. Draft D-1 의 부연은 이 기존 기술과 모순되지 않으며 오히려 동일한 사실을 WS §4.2 행 안에서 재확인하는 형태다. 충돌은 없다.
- **제안**: 채택 가능. 단, WS §4.2 행 문장이 이미 "EIA REST 의 `400 VALIDATION_ERROR` + `details[]` 와 동일 의미·동일 검증 지점" 이라고 적혀 있어 독자가 WS 도 `details[]` 를 반환한다고 오해할 여지가 있음은 draft 가 정확하게 짚었다. 추가 부연의 방향이 올바르다.

---

### [INFO] D-2 Rationale 결정 1 — "EIA `details[]` 는 보통 길이 1 배열" 언급과 EIA 계약 사이의 미묘한 긴장

- **target 위치**: D-2 결정 근거 1 — "EIA `details[]` 는 따라서 보통 길이 1 배열이다 (계약상 배열이지만 현 구현은 단건)"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` L81 (EIA-IN-10), L313 (§5.1 에러 표), L290~300 (응답 예시)
- **상세**: EIA 스펙은 `details[]` 를 배열(복수 가능) 계약으로 명세한다(`{field,message,code}` 배열 — §5.1, EIA-IN-10). Draft D-2 Rationale 본문은 "계약상 배열이지만 현 구현은 단건" 이라고 괄호 주석으로 구현 현실을 정직하게 기술하고 있다. 코드에서도 `workflow-errors.ts` L267-268 이 "배열 길이 항상 1" 을 명시하고 있어 사실은 일치한다. 그러나 Rationale 이 form.md 에 입력될 경우, 외부 소비자 입장에서 "보통 길이 1" 이라는 표현이 "항상 길이 1 이 계약" 으로 오해될 우려가 있다. EIA-IN-10 의 계약은 배열(확장 가능)이지 단건 고정이 아니다.
- **제안**: Rationale 문구를 "EIA `details[]` 는 현 구현 기준 항상 길이 1 배열로 반환된다(FIRST 오류 단건). 계약상 배열이므로 전수 수집 확장 시 복수 항목 가능" 으로 명확히 하여 구현 사실과 계약 의미를 분리하는 것이 안전하다. EIA 계약(spec) 과 충돌은 아니나 오독 방지용 정제 권장.

---

### [INFO] D-2 Rationale 결정 2 — `continueExecution` chokepoint 기술이 기존 form.md §6.2 주석과 중복, 충돌은 없음

- **target 위치**: D-2 결정 근거 2 — "검증 지점 = publisher 측 `continueExecution` chokepoint (3 경로 공통)"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/4-form.md` §6.2 검증 지점 주석 (L332), `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` L313 (VALIDATION_ERROR 행)
- **상세**: form.md §6.2 는 이미 "`continueExecution` chokepoint … UI(workspace WS)·외부 WS·EIA REST `submit_form` 3 경로가 같은 검증을 공유" 라고 기술한다. Draft D-2 결정 근거 2 는 동일 사실을 Rationale 로 요약하는 것이므로 중복이지만 충돌은 없다. Rationale 섹션에 기존 §6.2 를 인용하도록 크로스레퍼런스를 두면 단일 진실 원칙에 더 부합한다.
- **제안**: Rationale 결정 2 에 "§6.2 검증 지점 주석 참조" 크로스링크 추가 권장. form.md §6.2 본문 자체는 수정 불필요.

---

### [INFO] D-2 Rationale 결정 3 — defer 근거 기술이 기존 plan 파일 참조와 일치

- **target 위치**: D-2 결정 근거 3 — "file 검증·`validation.min`/`max`·`pattern` defer" 근거
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/4-form.md` §1.5 (file 옵션 주석 L49), §6.2 (Planned 행 L329-330)
- **상세**: form.md §1.5 와 §6.2 모두 동일 defer 내용을 `plan/in-progress/spec-sync-form-gaps.md` 추적으로 표기한다. Draft D-2 의 defer 근거는 기존 spec 의 "Planned" 표기와 완전히 일치한다. 충돌 없음.
- **제안**: 이상 없음.

---

### [INFO] `form-mode.ts` 참조 위치 표기 정밀화 권장

- **target 위치**: D-2 결정 근거 1 — "`validateFormSubmission` (`form-mode.ts`) 은 … (form-mode.ts 주석 L134)"
- **충돌 대상**: 실제 파일 위치 `/Volumes/project/private/clemvion/codebase/backend/src/modules/chat-channel/shared/form-mode.ts`
- **상세**: `form-mode.ts` 는 chat-channel 모듈 내 `shared/` 에 있지만, `validateFormSubmission` 함수는 `execution-engine.service.ts` 에 위치하며 form-mode.ts 의 유틸리티를 import 하는 구조다(codebase grep 결과). Rationale 에서 "`form-mode.ts:L134`" 를 직접 인용하는 것은 구현 파일 경로가 변경되면 stale 해지는 위험이 있다. Spec Rationale 에서는 코드 경로보다 동작 사실을 기술하는 것이 일반적이다.
- **제안**: Rationale 에서 코드 파일·라인 직접 인용 대신 "publisher `continueExecution` 에서 FIRST 오류 반환" 행동 사실만 기술하고, 코드 위치는 구현 코드 주석에서 관리하도록 분리 권장. 충돌은 아니나 stale risk.

---

## 요약

Draft D-1(WS §4.2 부연)과 D-2(form.md Rationale 신설)는 기존 spec 영역(`spec/5-system/6-websocket-protocol.md`, `spec/5-system/14-external-interaction-api.md`, `spec/4-nodes/6-presentation/4-form.md`)과 직접 모순되는 내용이 없다. D-1 부연은 WS §4.2 기존 "실패 ack 형태" 주석 및 EIA §5.1 의 REST-전용 `details[]` 기술과 방향이 일치한다. D-2 Rationale 의 3개 결정 근거는 모두 기존 spec 에 이미 산재된 사실을 집약하는 형태로 data model·API 계약·상태 전이·RBAC 어느 축에서도 충돌이 확인되지 않는다. INFO 등급 정밀화 제안(EIA `details[]` 길이 표현 명확화, form.md §6.2 크로스링크 추가, 코드 라인 직접 인용 자제)만 존재하며, 채택 차단 요인은 없다.

## 위험도

NONE
