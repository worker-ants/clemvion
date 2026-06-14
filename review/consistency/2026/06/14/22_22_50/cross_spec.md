# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-prep` (구현 착수 전)
**Target 영역**: `spec/4-nodes/6-presentation/`
**실제 변경 파일**: `spec/4-nodes/6-presentation/4-form.md` (§Rationale 신설), `spec/5-system/6-websocket-protocol.md` (`VALIDATION_ERROR` ack 설명 보강)

---

## 발견사항

### [INFO] WS `VALIDATION_ERROR` ack payload — `details[]` 미제공 선언이 EIA 규약과 면적으로 일치하나 명시적 비교 표기 필요
- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.2 에러 코드 표 — `VALIDATION_ERROR` 행 (신규 문장: "ack payload 는 평면 `{ success:false, error, errorCode:'VALIDATION_ERROR' }` 로 field-level `details[]` 를 포함하지 않는다")
- **관련 spec**: `spec/5-system/14-external-interaction-api.md` §5.1, §EIA-IN-10, §R8
- **상세**: target 의 WS spec 변경은 WS ack 에 `details[]` 가 없다는 것을 새롭게 명시한다. EIA spec 은 REST `400 VALIDATION_ERROR` 에 `details[]`(`{field,message,code}` 배열)가 있다고 정의한다. 두 정의는 "REST=detailed, WS=plain error string"이라는 구분을 의도적으로 두고 있으며 실질적 모순은 없다. 그러나 EIA spec 의 EIA-IN-10·§5.1 표 어디에도 "WS 경로는 details[] 없음"이라는 비교 주석이 없으므로, EIA 소비자가 WS를 통해서도 field-level 세부 정보를 받을 수 있다고 오해할 여지가 있다.
- **제안**: EIA spec(`spec/5-system/14-external-interaction-api.md`) §EIA-IN-10 항목 또는 §5.1 VALIDATION_ERROR 행에 "WS 경로는 평면 `error` 문자열만 제공(details[] 없음) — 구조화 세부는 REST 경로 한정" 비고 1줄 추가 권장 (현재 WS spec 이 EIA를 cross-ref 하는 방향만 있고, EIA가 WS 구분을 명시하지 않음).

---

### [INFO] `validation.min`/`max`/`pattern` "Planned" 상태 — 3개 spec 이 일관되게 Planned 표기 중 (충돌 없음, 동기화 확인)
- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §6.2 (기존 표), §Rationale "file 검증·`validation.min`/`max`·`pattern` 분리 defer" (신규)
- **관련 spec**: `spec/5-system/14-external-interaction-api.md` §5.1 ("validation.min/max·pattern ... Planned"), `plan/in-progress/spec-sync-form-gaps.md` 체크리스트
- **상세**: form.md §6.2 표의 "`validation.min`/`max`·`pattern` ... Planned" 행, EIA spec §5.1의 동명 Planned 주석, plan/in-progress 의 미체크 항목이 모두 동일 사실을 가리킨다. 신규 Rationale 섹션은 이를 "공유 validator 확장만으로 3 경로 공통 적용"이라는 결정으로 명문화했다. 세 영역의 Planned 표기가 일관돼 있어 데이터 모델·API 계약 충돌 없음.
- **제안**: 동기화 상태 정상. 향후 `validation.min`/`max`/`pattern` 구현 시 form.md §6.2, EIA §5.1, WS §4.2 `VALIDATION_ERROR` 행 세 곳을 동시 갱신해야 함을 plan 에 명시해두면 drift 방지에 유리함.

---

### [INFO] form §Rationale "검증 지점 = publisher chokepoint" — `validateFormSubmission` 재사용 관계가 chat-channel spec과 완전히 명문화되지 않음
- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §Rationale "검증 지점 = publisher 측 `continueExecution` chokepoint (3 경로 공통)"
- **관련 spec**: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` (`validateFormSubmission` 구현), chat-channel spec (`spec/4-nodes/7-trigger/providers/telegram.md` §5.3)
- **상세**: target의 Rationale은 "공유 validator 재사용"과 "3 경로 공통 적용"을 선언한다. 실제 코드 상에서 `validateFormSubmission`은 chat-channel 모듈(`form-mode.ts`)에 정의돼 있고, `execution-engine.service.ts`의 `assertFormSubmissionValid`가 이를 재사용한다. 이 재사용 관계는 spec 어디에도 명시되지 않아, 향후 chat-channel 쪽 `validateFormSubmission`이 독립적으로 수정될 경우(minLength/maxLength 외에 min/max/pattern 추가 등) execution-engine 경로에 자동으로 적용되는지 또는 별도 추가가 필요한지 불명확하다. 계층 책임 충돌 위험의 잠재적 씨앗.
- **제안**: form.md §Rationale 또는 §6.2 "검증 지점" 주석에 "공유 `validateFormSubmission` 함수는 `src/modules/chat-channel/shared/form-mode.ts` 에 정의됨. `min`/`max`/`pattern` 구현 시 해당 함수 확장이 3 경로에 자동 적용됨"을 한 문장 추가하면 계층 책임이 명확해짐.

---

### [INFO] form §Rationale "FIRST 오류만 반환" — EIA §5.1 `details[]` 계약과의 암묵적 긴장
- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §Rationale "field 검증은 FIRST 오류만 반환 (전수 수집 아님)"
- **관련 spec**: `spec/5-system/14-external-interaction-api.md` §5.1 VALIDATION_ERROR 행, §R8, `spec/4-nodes/6-presentation/4-form.md` §Rationale (바로 아래 단락)
- **상세**: target은 "EIA `400 VALIDATION_ERROR`의 `error.details[]`는 계약상 다중 배열이지만 현 구현은 항상 길이 1"이라고 기술한다. EIA spec은 `details[]` 를 배열로 정의하고, form.md §Rationale이 이것이 "단건만 담긴다"는 사실을 명시하는 구조다. 두 문서가 모순은 아니지만, EIA spec §5.1의 `VALIDATION_ERROR` 행에는 이 "항상 길이 1" 사실이 명시되지 않아 EIA 소비자(외부 통합 개발자)가 복수 오류를 기대할 수 있다.
- **제안**: EIA §5.1 또는 §EIA-IN-10 비고에 "현 구현: `details[]`는 항상 길이 1 (FIRST 오류만, form.md §Rationale 참조)" 주석 추가 권장. 단 target 문서 자체(form.md)는 이미 이 사실을 §Rationale에서 설명하므로 신규 충돌 아님.

---

## 요약

`spec/4-nodes/6-presentation/4-form.md`에 추가된 `## Rationale` 섹션과 `spec/5-system/6-websocket-protocol.md`의 `VALIDATION_ERROR` ack 설명 보강은 다른 spec 영역(EIA, WS, chat-channel, execution-engine, plan)과 직접적인 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 충돌을 일으키지 않는다. 발견된 항목은 모두 INFO 등급으로, WS ack의 `details[]` 미제공 사실이 EIA spec에서 명시적으로 교차 언급되지 않는다는 동기화 권장 사항, chat-channel `validateFormSubmission` 재사용 관계의 계층 책임 명문화 권장, EIA `details[]` 길이 1 사실의 교차 참조 보완이다. 구현 착수 전 차단 사항은 없다.

## 위험도

NONE
