# Cross-Spec 일관성 검토 결과

검토 대상: `spec/4-nodes/6-presentation/4-form.md` (--impl-done, diff-base=origin/main)
검토 범위: 구현 diff 가 다른 spec 영역과 충돌하는지 분석

---

## 발견사항

### [WARNING] EIA spec §5.1 의 file 검증 "Planned" 표기 — 구현 완료로 인해 stale

- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §6.2 — file MIME/크기/개수 검증이 구현 완료됐음을 명시. `assertFormSubmissionValid` chokepoint 에서 `validateFileField` 가 EIA·WS·UI 3 경로 공통 적용.
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §5.1 line 313
  - 원문: `"type: 'file'` MIME/크기/개수 검증만 별도 **Planned** ([Form §6.2](../4-nodes/6-presentation/4-form.md#6-에러-코드))`
- **상세**: EIA spec 의 `submit_form` `400 VALIDATION_ERROR` 에러 설명 행이 file 검증 항목을 여전히 `**Planned**` 로 표기하고 있다. 그러나 본 diff 에서 `validateFileField` 가 publisher chokepoint(`assertFormSubmissionValid`) 에 통합되어 EIA REST `submit_form` 경로에서도 file MIME/크기/개수 위반이 `400 VALIDATION_ERROR + details[]` 로 실제 반환된다. EIA spec 에서 Planned 로 남아 있으면 구현과 spec 이 모순되며, EIA 클라이언트 개발자가 file 검증이 구현되지 않았다고 오해할 수 있다.
- **제안**: `spec/5-system/14-external-interaction-api.md` §5.1 의 해당 행에서 `**Planned**` 표기를 제거하고 file 검증도 동일 chokepoint 에서 수행됨을 명시한다. 참고 형식: `"EIA·WS·UI 3 경로 공통. `type: 'file'` MIME/크기/개수 검증도 동일 chokepoint 에서 수행 ([Form §6.2](../4-nodes/6-presentation/4-form.md#6-에러-코드))"`

---

### [WARNING] WS spec §4.2 `VALIDATION_ERROR` 에러 코드 설명에 file 검증 항목 누락

- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §6.2 및 Rationale — `validateFileField` 가 scalar 와 같은 단일 패스에서 수행되어 WS ack `VALIDATION_ERROR` 로 매핑됨을 명시.
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.2 line 313
  - 원문: `"VALIDATION_ERROR | submit_form 의 field 검증 실패 (필수/type/minLength·maxLength/min·max(숫자 범위)/pattern(정규식)/select·radio 선택지)"`
- **상세**: WS spec 의 `VALIDATION_ERROR` 설명은 scalar 검증 규칙 열거만 있고 `type: 'file'` 의 MIME/크기/개수 항목이 누락되어 있다. 구현 상 `validateFileField` 결과도 동일 `VALIDATION_ERROR` ack 로 표면되므로, WS spec 에서 이 항목을 열거하지 않으면 WS 클라이언트 구현자가 file 검증 에러를 `VALIDATION_ERROR` ack 로 처리해야 한다는 사실을 spec 에서 알 수 없다.
- **제안**: `spec/5-system/6-websocket-protocol.md` §4.2 `VALIDATION_ERROR` 행 끝에 `·type:'file' MIME/크기/개수` 항목 추가.

---

### [INFO] frontend `dynamic-form-ui.tsx` 의 `DEFAULT_FILE_*` 상수 미러 관계 — spec 에 명시됨, 실제 값 일치 확인 필요

- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §1 — "기본값 상수 SoT: backend `form-mode.ts` `DEFAULT_FILE_*` (frontend `dynamic-form-ui.tsx` 가 동일 값 미러)"
- **충돌 대상**: 구현 diff `dynamic-form-ui.tsx` 의 상수 정의
- **상세**: spec 은 backend `form-mode.ts` 를 단일 진실(SoT)로 지정하고 frontend 가 미러한다고 명시한다. 구현 diff 에서 두 파일이 동일한 13종 MIME 목록 / 10MB / 50MB / 5 값을 독립 선언하고 있으며 현재는 일치한다. 다만 두 런타임이 별도 상수를 유지하는 구조는 향후 drift 위험이 내재한다. spec 은 이미 이를 `아키텍처 백로그 B-1` 으로 추적 중임을 frontend 코드 주석에서 언급하고 있으나, spec 본문에는 해당 백로그 참조가 없다.
- **제안**: spec §1 의 "기본값 상수 SoT" 문구에 백로그 추적 주석(`runtime 공유 패키지 추출은 아키텍처 백로그 B-1`)을 inline 추가하거나, 별도 action 없이 현 상태 유지 가능 (drift 위험은 낮으며 spec 이 이미 SoT 를 명시하므로 INFO 등급).

---

### [INFO] `image/gif` — allowedMimeTypes 기본 목록에 포함되나 spec 설명 불일치 가능성

- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §1 allowedMimeTypes 기본값 목록 — `image/gif` 포함.
- **충돌 대상**: spec §1 의 "실행 파일·스크립트·아카이브 제외" 설명
- **상세**: spec 설명은 "문서/이미지만 허용"이라고 하며 기본 목록에 `image/gif` 가 포함되어 있고 구현도 동일하게 `image/gif` 를 포함한다. 일관성 충돌은 아니지만, gif 는 animation 을 포함할 수 있어 일부 보안 정책에서 별도 처리하는 경우가 있다. 현재 spec 과 구현이 일치하므로 충돌 없음. 단순 동기화 참고 수준.
- **제안**: 별도 조치 불필요. spec 과 구현이 정합한다.

---

## 요약

Cross-Spec 일관성 관점에서 이번 구현(form file validation — `validateFileField` + `DEFAULT_FILE_*` 기본값 주입 + frontend 클라이언트 가드)은 target spec(`spec/4-nodes/6-presentation/4-form.md`)과 코드 간 정합이 잘 맞는다. 그러나 **인접 두 spec 파일이 구현 완료 이전 상태의 "Planned" 표기를 그대로 보유**하고 있어 WARNING 2건이 발생한다. `spec/5-system/14-external-interaction-api.md` §5.1 의 `400 VALIDATION_ERROR` 에러 행에 file 검증이 Planned 로 표기되어 구현 사실과 직접 모순되며, `spec/5-system/6-websocket-protocol.md` §4.2 의 `VALIDATION_ERROR` 에러 코드 설명에서 file 검증 항목이 누락되어 있다. 두 항목 모두 구현 완료를 반영하도록 해당 spec 파일을 갱신해야 한다. 데이터 모델 충돌, API 계약 충돌, 요구사항 ID 충돌, 상태 전이 충돌, RBAC 충돌은 발견되지 않았다.

## 위험도

MEDIUM
