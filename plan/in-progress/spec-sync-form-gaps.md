---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# form (Presentation) — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/6-presentation/4-form.md

## 미구현 항목

> **구현 진척 (2026-06-14, impl-form-gaps PR)**: §5.5(durationMs) 구현. §4/§6.2·§1.5·§1 file기본값은 **파일검증
> cluster** 로 묶여 별도 PR 권장(공유 default 상수 + 서버/클라 적용 + 재-waiting 흐름). §1 ValidationPreset 은 spec
> form.md L63 이 "Planned" 명시 — 제외.
> **구현 진척 (2026-06-14, eia-form-validation PR)**: §4 step5 / §6.2 서버측 **field-level** 검증(필수/type/minLength·maxLength/select)
> 구현 — `validation.min`/`max`/`pattern` 과 file 검증은 잔존.
> **구현 진척 (2026-06-14, form-validation-minmax-pattern PR / A-1)**: §6.2 서버측 **`validation.min`/`max`(숫자 범위)·`pattern`(정규식)**
> 구현 — `validateFormSubmission`(chat-channel) 확장. file 검증 cluster 만 잔존.

- [x] §4 step5 / §6.2 서버측 폼 **field-level** 검증 (필수/type(email·number)/`validation.minLength`·`maxLength`/select·radio 선택지) — `continueExecution` publisher chokepoint 에서 노드 config 의 field 정의로 `validateFormSubmission` 수행 → 실패 시 `FormValidationError` throw (EIA `400 VALIDATION_ERROR` + `details[]` / WS `VALIDATION_ERROR` ack), publish 전 throw 라 execution `waiting_for_input` 유지(재제출 가능). EIA/WS/UI 3 경로 공통. (eia-form-validation PR — `workflow-errors.ts` `FormValidationError`·`execution-engine.service.ts` `assertFormSubmissionValid`; 테스트 `workflow-errors.spec`/`execution-engine.service.spec`/`executions.controller.spec`/`external-interaction.e2e` G)
- [x] §6.2 서버측 **`validation.min`/`max`(숫자 범위)·`pattern`(정규식) 검증** — `validateFormSubmission`(chat-channel) 확장: `type:'number'` 범위 비교(min/max) + custom regex(pattern, 잘못된 regex 방어적 통과). `FormModalField` 에 `min?`/`max?`/`pattern?` + `extractFormFields` 추출. publisher chokepoint `assertFormSubmissionValid` 재사용으로 EIA/WS/UI 3 경로 공통. (form-validation-minmax-pattern PR — `form-mode.ts`·`types.ts`; 테스트 `form-mode.spec` +7 케이스)
- [ ] §6.2 서버측 **file 검증** (MIME/크기/개수) — 위 field-level 외 `type: 'file'` 전용 검증은 미구현. **파일검증 cluster**(chat-channel `validateFormSubmission` 는 file 미지원 + 재-waiting 흐름 신규).
- [ ] §1.5 file 입력 클라이언트 검증 — `DynamicFormUI`(frontend) FileList MIME/size/count reject 없음. **파일검증 cluster**(frontend).
- [ ] §1 ValidationPreset(phone) — **보류 (spec Planned, form.md L63)**: preset 필드·카탈로그·서버 regex·UI hint 부재.
- [ ] §1 file 입력 기본값 — 13종 MIME / 10MB·50MB / count 5. **파일검증 cluster**: 공유 field schema 에 무조건 `.default()` 면 비-file 필드 config echo 오염(Principle 1.1) → file-type 한정 적용으로 §4/§1.5 와 함께.
- [x] §5.5 resumed meta.durationMs — `processFormResumeTurn` 이 resume 시 `prevStructured.meta`(durationMs=0)를 재사용하던 것을, `nodeExec.startedAt`→재개 시각 경과로 `meta.durationMs` 갱신(기존 meta 필드 보존, DB durationMs 와 동일 계산 공유). 테스트 추가.

## INFO 후속 (min/max·pattern PR 리뷰 산출 — 비차단)
- [ ] 인접 spec validation 규칙 열거 동기화 — `chat-channel-adapter.md §4.1 step 4`(validateFormSubmission SoT)·`6-system/6-websocket-protocol.md §4.2` 의 검증 규칙 열거가 min/max/pattern 미반영(구식). (impl-done 23_05_43 cross_spec INFO)
- [ ] `execution-engine.service.spec` 에 min/max·pattern 위반 시 `FormValidationError` throw 통합 케이스 1건씩 추가 — assertFormSubmissionValid 단위 커버는 충분하나 3경로 wiring 명시 검증. (ai-review 23_05_30 INFO #5)

## 비고
- 근거(claim→코드부재)는 audit findings/4-nodes.md `### spec/4-nodes/6-presentation/4-form.md` 절 참조.
- §6.1 에러 메시지 영문/한국어 차이는 spec 본문 patch 로 정정 완료.
