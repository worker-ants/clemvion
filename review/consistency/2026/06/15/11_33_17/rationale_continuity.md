# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상: `spec/4-nodes/6-presentation/4-form.md`
구현 계획: `plan/in-progress/impl-form-file-validation.md`

---

## 발견사항

- **[WARNING]** `validation.message` 적용 범위 — 계획(plan)이 spec 약속을 침묵 축소

  - target 위치: `plan/in-progress/impl-form-file-validation.md` "설계 결정" 6번째 항 — `"file 은 validation.message override 미적용(v1) — spec §1.5 문구도 default 로 정렬."`
  - 과거 결정 출처: `spec/4-nodes/6-presentation/4-form.md §1.5` (line 105) — `"(Planned) allowedMimeTypes 미일치 시 즉시 reject + validation.message (없으면 기본 메시지 '허용되지 않은 파일 형식입니다.')"`
  - 상세: spec §1.5 는 Planned 계획 사양으로 `validation.message` 를 파일 MIME 불일치 시 사용자 정의 에러 메시지 출처로 명시하고 있다. 이 패턴은 `validation.minLength`/`maxLength` 위반 처리(§6.2 line 327)와도 일관된다 — 해당 행은 `"validation.message 가 있으면 그것을, 없으면 기본 메시지"` 로 정의돼 있다. 구현 계획은 `"validation.message override 미적용(v1)"` 이라 결정했으나, spec 에는 이 축소 결정의 근거 Rationale 이 없고, 계획 문서에도 왜 spec 약속을 v1 에서 비워두는지 명시하지 않는다. 이는 spec 에 이미 기록된 Planned 사양을 조용히 우회하는 번복에 해당한다.
  - 제안: 두 경로 중 하나를 택한다. (A) spec §1.5 의 `validation.message` 적용 약속을 구현에 포함 — scalar 필드와 동일 패턴이므로 추가 구현 비용이 작다. (B) v1 에서 제외한다면, 계획 문서에 제외 근거를 명기하고 spec §1.5 의 해당 Planned 문구를 `"(Planned, v2)"` 혹은 별도 callout 으로 갱신해 의도된 축소임을 명시해야 한다.

- **[INFO]** file 검증 위치를 `execution-engine` 단독으로 국한 — spec Rationale 의 "3 경로 공통 chokepoint" 원칙과의 범위 차이 명시 필요

  - target 위치: `plan/in-progress/impl-form-file-validation.md` "설계 결정" 1번째 항 — `"file 검증 위치 = execution-engine 경로 전용. 근거: Slack/Discord isFieldModalCompatible 가 file 제외(모달 미수용) → chat-channel modal 은 file 미도달."`
  - 과거 결정 출처: `spec/4-nodes/6-presentation/4-form.md §Rationale "검증 지점 = publisher 측 continueExecution chokepoint (3 경로 공통)"` (line 351-355) — scalar 필드 검증을 3 경로(EIA REST·외부 WS·workspace WS)가 `continueExecution` chokepoint 한 곳에서 공유하는 것을 합의 원칙으로 박고 있다.
  - 상세: 계획의 file 검증 위치 선택("execution-engine 경로 전용")은 사실상 `assertFormSubmissionValid`(execution-engine) 위치를 쓰는 것이므로, 같은 `continueExecution` chokepoint 를 통하기는 한다. 그러나 plan 문서의 표현이 "chat-channel modal 은 file 미도달이므로 execution-engine 전용" 으로 기술되어, 마치 chat-channel `validateFormSubmission` (form-mode.ts) 에는 file 로직을 추가하지 않는다는 의미로 읽힌다. 이는 3 경로 공통이라는 Rationale 원칙과 표면적 충돌처럼 보이나, chat-channel modal 경로가 file 필드를 실제로 미수용(`isFieldModalCompatible` 배제)한다는 근거가 `spec/conventions/chat-channel-adapter.md §4.1` 에 명시돼 있어 실질 충돌은 아니다. 다만 이 근거가 spec Rationale 의 "3 경로 공통" 원칙에 대한 명시적 예외 선언 없이 plan 에만 표현돼 있으므로, 형식상 Rationale 보완이 권장된다.
  - 제안: `spec/4-nodes/6-presentation/4-form.md §Rationale "검증 지점"` 항에 한 줄 추가 — `"type: 'file' 검증은 chat-channel modal 경로가 file 필드를 미수용(isFieldModalCompatible 배제, chat-channel-adapter §4.1)하므로 assertion 추가 대상 밖이며, assertFormSubmissionValid(execution-engine) 경로만 file 검증을 수행한다."` 이로써 예외 선언이 spec Rationale 에도 기록된다.

- **[INFO]** `coerceFormSubmission` 제거 — spec 에 미기록된 코드 계약 변경

  - target 위치: `plan/in-progress/impl-form-file-validation.md` "설계 결정" 마지막 항 — `"coerceFormSubmission(이제 미사용) 제거"`
  - 과거 결정 출처: `spec/4-nodes/6-presentation/4-form.md §Rationale` — `coerceFormSubmission` 함수에 대한 Rationale 기록 없음.
  - 상세: spec Rationale 에 `coerceFormSubmission` 의 존재 이유나 제거 사유가 기록되지 않아, 이 변경은 Rationale 연속성 관점에서 공백(unknown)이다. 이 함수가 어떤 보장을 제공했는지·제거 후 동일 보장을 `coerceFormValue` 로 커버하는지 spec 에 추적되지 않는다. 실질 위반 여부는 코드 수준 판단이 필요하지만, 함수 소멸에 대한 impl 결정이 spec 에 흔적이 없다는 점이 Rationale 공백이다.
  - 제안: 구현 Rationale 이 필요한 수준이 아니라면 plan 체크리스트 비고로 `"coerceFormSubmission 제거 — coerceFormValue 로 동일 보장 커버 확인"` 을 명기하는 것으로 충분하다. spec Rationale 갱신은 불필요.

---

## 요약

`spec/4-nodes/6-presentation/4-form.md` 의 Rationale 은 세 축의 합의를 기록하고 있다 — (1) 검증 실패는 FIRST 오류 단건 반환, (2) chokepoint 단일 지점(3 경로 공통), (3) file 은 metadata-only(binary 미전달). 현재 구현 계획은 이 세 축과 기본적으로 정합하며, metadata-only 채택·chokepoint 재사용·cluster 분리 필요성의 기존 Rationale 을 모두 존중하고 있다. 다만 spec §1.5 가 Planned 사양으로 명시한 `validation.message` 를 구현에서 조용히 제외하는 것이 WARNING 수준 — 이 결정이 의도된 v1 축소라면 spec §1.5 와 plan 양쪽에 명시적 근거가 동반돼야 한다. 나머지 두 항(chat-channel 예외 선언 공백·coerceFormSubmission 제거)은 INFO 수준으로 구현 진행을 차단하지 않는다.

---

## 위험도

LOW
