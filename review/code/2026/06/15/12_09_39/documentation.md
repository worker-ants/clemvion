# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `validateScalarField` — 함수명 변경 JSDoc 반영 완료, 하지만 SoT 라인 참조가 단수
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateScalarField` JSDoc
- 상세: JSDoc 말미 `SoT: spec/conventions/chat-channel-adapter.md §4.1 step 4 + spec/4-nodes/6-presentation/4-form.md §6.2` 는 이전 `validateFormSubmission` 의 SoT 그대로다. `validateScalarField` 는 scalar 전용이 되었으므로 SoT 에 `form.md §1` (file 제외 원칙, Principle 1.1) 을 추가하거나, 반대로 `chat-channel-adapter.md §4.1` 은 file 미수용 경로라 scalar 전용 함수의 SoT 로서 여전히 적절하다. 오류는 아니지만 `validateFileField` JSDoc 의 SoT 와 교차 일치 여부 확인 권장.
- 제안: 사소한 문서 보완 수준. 수정 권장이지만 차단 불필요.

### [INFO] `DEFAULT_FILE_*` 상수 JSDoc 블록 — 스타일 비일관성 (블록 주석 + 인라인 주석 혼합)
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L232–262
- 상세: 상수 그룹 전체에 대한 블록 JSDoc(`/** spec/4-nodes/... §1 — ... */`)이 하나 있고, 그 뒤에 각 상수마다 인라인 `/** ... */` JSDoc 이 붙는다. 그런데 첫 번째 블록 JSDoc 은 `DEFAULT_FILE_ALLOWED_MIME_TYPES` 에 붙은 것이 아니라 그 위 "그룹 설명"이며, `DEFAULT_FILE_ALLOWED_MIME_TYPES` 는 별도 `/** 문서/이미지만 허용 ... */` 인라인 주석을 가진다. TypeScript/JSDoc 파서는 `@const` 에 가장 가까운 JSDoc 블록만 인식하므로 그룹 블록 JSDoc 은 IDE에서 `DEFAULT_FILE_ALLOWED_MIME_TYPES` 에 바인딩되지 않는다. 의도는 명확하지만 툴체인 지원 관점에서 혼란 여지가 있다.
- 제안: 그룹 설명 블록을 `/* ... */` (비-JSDoc) 로 바꾸거나, 각 상수의 인라인 JSDoc 에 spec 참조를 포함시킨다.

### [INFO] `validateFileField` JSDoc — "FIRST 오류 순서, §1.5 와 동일" 표현의 spec 위치 모호성
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFileField` JSDoc
- 상세: `규칙 (FIRST 오류 순서, §1.5 와 동일)` 에서 `§1.5` 가 `spec/4-nodes/6-presentation/4-form.md §1.5` 를 가리키는지 코드 내에서 명확하지 않다. 다른 함수 JSDoc 에는 전체 경로(`spec/conventions/...`, `spec/4-nodes/...`)가 명기되어 있는데 여기만 단축 참조를 썼다.
- 제안: `(FIRST 오류 순서, spec/4-nodes/6-presentation/4-form.md §1.5 와 동일)` 으로 전체 경로 표기 통일.

### [INFO] `DynamicFormUI` — `validateFilesClient` JSDoc 의 i18n 키 참조 열거가 누락
- 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `validateFilesClient` JSDoc
- 상세: JSDoc 에 "메시지는 i18n(`editor.runResults.formFile*`)" 으로 와일드카드로 표기했다. 실제로 추가된 4개 키(`formFileMimeRejected`, `formFileSizeExceeded`, `formFileTotalExceeded`, `formFileCountExceeded`)를 나열하면 유지보수 시 i18n 키 추가/삭제 누락을 방지할 수 있다. 현재도 의미는 전달되지만 열거된 i18n 키 목록이 없으면 번역 담당자가 파일을 직접 찾아야 한다.
- 제안: 와일드카드 대신 4개 키를 명시하거나, i18n 딕셔너리 파일 경로를 참조 추가.

### [INFO] `dynamic-form-ui.tsx` 로컬 `DEFAULT_FILE_*` 상수 — backend 와 값 동기화 의존성 미강조
- 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` L1026–1045
- 상세: JSDoc(`backend form-mode.ts 의 DEFAULT_FILE_* 상수와 값이 일치해야 한다(SoT: spec §1)`)이 있어 의도는 명확하다. 그러나 frontend 와 backend 간 공유 상수가 없는 상태에서 두 파일을 독립적으로 유지해야 하는 이유(frontend 빌드 의존성 분리, CSR 번들 최소화 등)에 대한 설명이 없다. 향후 유지보수자가 "왜 공유 모듈로 추출하지 않았는가"를 물을 때 답이 없다.
- 제안: JSDoc 에 "공유 패키지로 추출하지 않은 이유: CSR 번들 의존성 분리(frontend는 backend 모듈 직접 import 불가)" 등 한 줄 근거를 추가.

### [INFO] `assertFormSubmissionValid` JSDoc — "미적용 (Planned)" 주석 제거 확인
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` JSDoc
- 상세: 변경된 diff 에서 `**미적용 (Planned)**: type:'file' MIME/size/count` 라인이 제거되고 file 검증이 포함됨으로써 갱신되었다. 이는 올바르게 처리되었다. 단, 새 JSDoc 에 "file metadata 는 frontend(`DynamicFormUI`)가..." 라는 구체적 caller 명시가 있는데, DynamicFormUI 이외의 클라이언트(EIA REST 직접 호출, WS 경로)에서도 동일 metadata 형식이 보장되는지를 JSDoc 이 커버하지 못한다. 현재 JSDoc 은 frontend UI 경로만 명시하고 있어 EIA REST / WS 경로에서의 payload 형식에 대한 설명이 누락된다.
- 제안: "EIA REST / WS 경로에서도 동일 `{name,size,type,lastModified}[]` 형식으로 전달됨 (§1.5)" 한 줄 추가.

### [INFO] `plan/in-progress/impl-form-file-validation.md` — 체크리스트 미완료 항목 2건
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/plan/in-progress/impl-form-file-validation.md`
- 상세: 단계 4의 `인접 spec 검증 열거 동기화 필요시(EIA §5.1 / chat-channel-adapter §4.1 / websocket §4.2)` 와 `spec-sync-form-gaps.md 체크박스 [x]` 가 미완료(`[ ]`)로 남아 있다. 단계 9(REVIEW WORKFLOW)와 10(plan complete)도 미완료다. 이는 리뷰 시점에서 예상된 상태이며 코드 문서화 문제가 아니다. 단, `/ai-review --branch main` 커밋 후 수행 예정인 단계 9가 완료되어야 plan 이 닫힌다는 점을 리뷰어가 인지해야 한다.
- 제안: 해당 plan 항목은 리뷰 workflow 완료 후 체크박스 갱신 필요. 코드 문서화 리뷰 차단 사유 아님.

### [INFO] `coerceFormValue` JSDoc — file 경로 제외 명시 추가 완료, 단 기존 `Array` 설명과 미세한 불일치
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormValue` JSDoc
- 상세: 변경된 diff 에서 `Array — 빈 배열 → ''` 항목에서 `multi-select·file 메타 배열` 이 `multi-value(multi-select 등) 배열` 로 수정되었고, JSDoc 끝에 `scalar 필드 전용 — type:'file' 은 raw metadata 배열로 validateFileField 가 별도 검증` 주석이 추가되었다. 변경이 올바르게 반영되었다. 단, 코드 내 인라인 주석(`// multi-value(multi-select 등) — ...`)도 JSDoc 과 일치하게 수정되었으므로 일관성은 유지된다. 이슈 없음(정보 목적으로 기록).

## 요약

이번 변경은 `type:'file'` 필드 검증의 공유 기본값 주입 (`extractFormFields`), 새 함수 `validateFileField` 도입, `validateFormSubmission` 의 scalar core 분리(`validateScalarField`), execution-engine 의 단일 패스 파일/스칼라 혼합 검증, 프론트엔드 클라이언트 사이드 reject 로직, i18n 키 추가로 구성된다. 공개 함수 전부에 JSDoc 이 있고 spec 섹션 참조(`§1`, `§1.5`, `§6.2`)가 명기되어 있어 문서화 품질이 전반적으로 양호하다. 주요 발견사항은 모두 INFO 수준으로, 스타일 비일관성(그룹 JSDoc 혼합), i18n 키 와일드카드 표기, frontend-backend 상수 복제 근거 미명시, EIA/WS 경로 payload 설명 보완 필요 등 가독성과 유지보수성 관련 개선 권장 사항이다. CRITICAL 또는 WARNING 급 문서화 결함은 없다.

## 위험도

LOW
