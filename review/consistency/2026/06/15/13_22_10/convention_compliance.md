# 정식 규약 준수 검토 결과

**검토 대상**: `spec/4-nodes/6-presentation/4-form.md` (구현 완료 후 검토, diff-base=origin/main)  
**검토 일시**: 2026-06-15

---

## 발견사항

### [INFO] i18n Principle 1 준수 — 구현 측 (WARNING 없음, 확인)

- target 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `validateFilesClient` 함수
- 위반 규약: `spec/conventions/i18n-userguide.md` Principle 1 (UI 문자열 dict 키 경유)
- 상세: `validateFilesClient` 가 반환하는 오류 메시지 4종("허용되지 않은 파일 형식입니다." 등)은 `t("editor.runResults.formFileMimeRejected")` 등 dict 키 경유로 올바르게 처리되고 있다. `dict/ko/editor.ts` · `dict/en/editor.ts` 양쪽에 parity 키가 모두 등재되어 Principle 2(ko/en parity) 도 충족한다.
- 제안: 이 항목은 규약 준수 확인이며 조치 불필요.

---

### [INFO] spec frontmatter `code:` 목록 — 신규 테스트 파일 미등재

- target 위치: `spec/4-nodes/6-presentation/4-form.md` frontmatter `code:` (lines 6–13)
- 위반 규약: CLAUDE.md §정보 저장 위치 — spec 문서 `code:` 목록은 구현 파일 SoT 역할을 한다. 신규 구현 파일이 목록에 없으면 spec-impl 추적이 흐려진다.
- 상세: diff 에서 신규 추가된 파일(`codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts`, `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`, `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx`)이 spec `code:` 목록에 없다. 테스트 파일은 통상 `code:` 목록에서 제외하는 관행이므로 위반은 아니나, 구현 파일 목록 자체는 변경이 없어 기존 목록과 일치한다.
- 제안: 테스트 파일 제외 관행이 명확하므로 조치 불필요. 단, spec `code:` 목록에 현재 구현 파일이 모두 포함된 것은 확인됨.

---

### [WARNING] spec 문서 §1 — `allowedMimeTypes` 기본값 항목 수 불일치 (13종 vs 14종)

- target 위치: `spec/4-nodes/6-presentation/4-form.md` §1 FormField 표 line 46 및 §1 본문 line 51
- 위반 규약: `spec/conventions/` 직접 항목이 아닌 spec 내부 일관성 — 단일 진실 원칙(CLAUDE.md §정보 저장 위치)
- 상세: spec §1 FormField 표(line 46)는 "`allowedMimeTypes` — 미설정 시 기본 14종"으로 기술하고 있으나, 동 §1 본문(line 51)은 "아래 공유 기본값(14종 MIME / 10MB / 50MB / 5)"으로 일관 기술한다. 그러나 §1 JSON 블록(lines 82–93)에 열거된 MIME 목록을 세면 14개로, 명시 숫자와 일치한다. 구현(`form-mode.ts` `DEFAULT_FILE_ALLOWED_MIME_TYPES`)도 14종이다. 불일치는 없음 — 확인 완료.
- 제안: 조치 불필요.

---

### [INFO] spec 문서 §1 본문 참조 일관성 — `form.schema.ts:71-74` 라인 번호 하드코딩

- target 위치: `spec/4-nodes/6-presentation/4-form.md` §1 본문 line 51, `form.schema.ts:71-74` 참조
- 위반 규약: CLAUDE.md §정보 저장 위치 — spec 내 구현 파일 라인 번호 하드코딩은 코드 변경 시 즉시 stale 됨
- 상세: spec §1 주석에 `formFieldSchema (form.schema.ts:71-74)` 처럼 라인 번호를 직접 박고 있다. 이는 코드가 변경될 때 spec 이 stale 되는 패턴이다. 그러나 이는 이번 diff 로 도입된 사항이 아니라 기존 패턴이므로 본 검토 범위에서 신규 위반은 아니다.
- 제안: 향후 spec 수정 시 라인 번호 대신 함수명/export 명으로 참조 변경을 권장.

---

### [INFO] spec 문서 구조 규약 — 3섹션(Overview/본문/Rationale) 준수 확인

- target 위치: `spec/4-nodes/6-presentation/4-form.md` 전체
- 위반 규약: CLAUDE.md §문서 구조 규약 — Overview/본문/Rationale 3섹션 권장
- 상세: 문서는 §1(설정/config) · §2(설정 UI) · §3(포트) · §4(실행 로직) · §5(출력 구조) · §6(에러 코드) · §7(캔버스 요약) · Rationale 섹션으로 구성되어 있다. Overview 명시 헤딩은 없으나 도입부 1문단이 overview 역할을 대체한다. Rationale 섹션이 명시적으로 존재하고 신규 추가된 내용("file 검증은 cluster 로 분리 구현" 항목)도 Rationale 에 배치되었다. 3섹션 권장 패턴을 실질적으로 준수한다.
- 제안: 조치 불필요.

---

### [INFO] spec `pending_plans` 갱신 여부 — `spec-sync-form-gaps.md` 잔류 적절성

- target 위치: `spec/4-nodes/6-presentation/4-form.md` frontmatter `pending_plans` (lines 4–5)
- 위반 규약: CLAUDE.md §정보 저장 위치 (plan 라이프사이클)
- 상세: frontmatter 에 `plan/in-progress/spec-sync-form-gaps.md` 가 `pending_plans` 로 남아 있다. 이번 diff 는 file 검증 구현(A-2)을 완료했으나, 동 plan 에는 file 검증 외에도 `ValidationPreset` 카탈로그 등 미구현 항목이 남아 있을 수 있다. spec §1의 `preset` 항목이 여전히 "(미구현 / Planned)"로 표기되어 있어 `pending_plans` 잔류는 정당하다. 갱신이 필요한 경우는 plan 이 전부 완료됐을 때이므로 현재는 문제 없음.
- 제안: 조치 불필요.

---

### [WARNING] `validateFormSubmission` 공개 API 유지 + `validateScalarField` 신규 export — 명명 규약 검토

- target 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — export 목록
- 위반 규약: `spec/conventions/error-codes.md` §2 (rename 안정성 / breaking change) 의 정신 — 동일 원칙이 공개 함수 API 에도 적용된다
- 상세: diff 는 `validateFormSubmission` 을 유지하면서 `validateScalarField` / `validateFileField` / `validateAllFields` 3개 신규 함수를 추가 export 한다. `validateFormSubmission` 은 `hooks.service.ts` 가 계속 사용하고 있어 제거되지 않았다. 이는 `hooks.service.ts` 가 "chat-channel native modal — scalar 전용" 이라는 명확한 이유가 있으며 JSDoc 에도 주석으로 명시되어 있다(`NOTE: scalar 전용. file 필드는 chat-channel native modal 미수용 ...`). 명명 규약(camelCase 함수명) 은 기존 패턴과 일관된다.
- 제안: 조치 불필요. 단, `validateFormSubmission` 의 현재 역할(hooks.service 전용 scalar modal path)이 spec §6.2 Rationale 의 "file 검증은 cluster 로 분리" 항목에 충분히 설명되어 있어 향후 혼란 위험은 낮다.

---

### [INFO] 출력 포맷 규약 — `FormValidationError` shape 변경 없음 확인

- target 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts`
- 위반 규약: `spec/conventions/error-codes.md` §2 (에러 코드 rename = breaking change)
- 상세: `FormValidationError` 의 `code: 'VALIDATION_ERROR'` 는 변경되지 않았다. EIA `400 VALIDATION_ERROR` + `details[{field, message, code:'INVALID_FIELD'}]` 형식도 그대로다. 이번 diff 는 JSDoc 설명을 확장했을 뿐 API 계약 자체는 불변이다.
- 제안: 조치 불필요.

---

### [INFO] API 문서 규약 (Swagger) — 해당 없음

- target 위치: diff 전체
- 위반 규약: `spec/conventions/swagger.md`
- 상세: 이번 diff 에는 Controller/DTO 변경이 없다. Swagger 데코레이터·DTO 명명 패턴 변경 사항 없으므로 swagger.md 규약 검토 대상 외.

---

### [INFO] 금지 항목 — `output` 에 config echo 없음 확인 (node-output Principle 1.1)

- target 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts`, `codebase/backend/src/modules/chat-channel/types.ts`
- 위반 규약: `spec/conventions/node-output.md` Principle 1.1 (`config` ↔ `output` 직교)
- 상세: `FormModalField` 인터페이스에 `allowedMimeTypes` · `maxFileSize` · `maxTotalSize` · `maxFiles` 필드가 추가되었다. 이 필드들은 `extractFormFields` 단계에서 정규화·기본값 주입 후 서버측 검증(`validateFileField`)에서 소비된다. `NodeHandlerOutput.output` 에 이 값들을 echo 하는 코드는 없으며, `NodeHandlerOutput.config` echo 경로는 form 핸들러의 `context.rawConfig` 에서 오는 기존 패턴으로 본 diff 가 변경하지 않았다. Principle 1.1 위반 없음.
- 제안: 조치 불필요.

---

## 요약

정식 규약(`spec/conventions/**`) 관점에서 이번 구현 diff 는 전체적으로 규약을 준수하고 있다. i18n Principle 1·2(dict 키 경유, ko/en parity), error-codes.md §2(에러 코드 안정성), node-output.md Principle 1.1(config/output 직교), chat-channel-adapter.md §4.1·§6.2(file 검증 경로 설계), swagger.md(Swagger 패턴) 모두 위반 없이 충족된다. WARNING 2건은 기존 spec 패턴과 공개 API 명명에 대한 관찰이며, 규약 직접 위반이 아니라 현재 상태의 적절성을 확인하는 수준이다. CRITICAL 위반은 발견되지 않았다.

---

## 위험도

**NONE**
