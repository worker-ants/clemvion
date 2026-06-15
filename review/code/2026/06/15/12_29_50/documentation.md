# 문서화(Documentation) 리뷰

## 발견사항

### **[WARNING]** MIME 개수 주석/스펙 불일치 — "13종" 표기 vs 실제 14개 항목

- **위치**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/types.ts` L255: `공유 기본값(13종 MIME / 10MB / 50MB / 5)`
  - `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` L35: `**SoT 는 spec §1**(13종 MIME / 10·50MB / 5)`
  - `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/spec/4-nodes/6-presentation/4-form.md` L44, L49, L105, L363: 모두 "13종 MIME" 또는 "기본 13종" 표기
- **상세**: `DEFAULT_FILE_ALLOWED_MIME_TYPES` 배열은 backend(`form-mode.ts`)와 frontend(`dynamic-form-ui.tsx`) 양쪽 모두 실제로 14개 MIME 타입을 포함한다(`image/jpeg` ~ `text/plain` 13개 + `text/csv`). 그러나 세 곳의 JSDoc 주석과 spec 문서 4개 위치가 일관되게 "13종"으로 표기하고 있어 주석/문서가 코드 현실과 어긋난다. 이전 아키텍처 리뷰(`review/code/2026/06/15/12_09_39/architecture.md`)는 같은 배열을 "14종 MIME 목록"이라고 정확히 표기했으나 코드 주석과 spec 수정은 이루어지지 않았다.
- **제안**: `form-mode.ts` JSDoc, `types.ts` JSDoc, `dynamic-form-ui.tsx` JSDoc, `spec/4-nodes/6-presentation/4-form.md` 4곳의 "13종" 표기를 "14종"으로 일괄 수정한다. spec 수정은 project-planner 위임이 원칙이나 동일 PR 내 함께 반영 가능한 경우 개발자가 직접 정정할 수 있다.

---

### **[INFO]** `validateScalarField` 공개 함수 — JSDoc 에 반환 타입 기술 없음

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L213–230 (`validateScalarField` JSDoc)
- **상세**: `validateScalarField` 는 이번 변경으로 `validateFormSubmission` 에서 추출된 새 공개 함수다. JSDoc 에 검증 규칙·순서·비-file 필드 한정 명시는 충실하나, 반환값(`{ field, message } | null`)에 대한 명시적 설명이 없다. `validateFileField` 도 동일하게 반환 설명이 JSDoc 본문이 아닌 시그니처 타입으로만 전달된다. 함수 시그니처 자체가 타입을 보여주므로 블로킹 수준은 아니나, 공개 API 가 두 가지 호출 사이트(`validateFormSubmission` 내부 + execution-engine)를 갖는 만큼 `@returns` 항목이 있으면 문서 완성도가 높아진다.
- **제안**: 두 함수 JSDoc 에 `@returns null — 통과 / `{ field, message }` — FIRST 오류` 1줄을 추가한다. 중요도는 낮아 defer 가능.

---

### **[INFO]** `FormField` 인터페이스(frontend) — 신규 필드(`maxFileSize`, `maxTotalSize`) 문서 없음

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` L7–18 (`FormField` 인터페이스)
- **상세**: 이번 변경으로 `FormField` 인터페이스에 `maxFileSize?: number`와 `maxTotalSize?: number`가 추가되었다. `maxFiles?: number`는 이전부터 존재하고 있었으나 이 세 필드 모두 인라인 주석이 없다. `allowedMimeTypes` 역시 마찬가지다. backend `FormModalField`의 대응 필드들은 `types.ts`에서 JSDoc(`§1 — 단일 파일 최대 크기 (MB)` 등)을 갖추고 있으나 frontend `FormField`는 순수 인터페이스 선언만으로 문서가 없다.
- **제안**: 단위가 MB임을 명시하는 한 줄 주석(`/** MB — 단일 파일 최대 크기. §1 기본 10 */`)을 추가하면 API 소비자의 오해(bytes vs MB 혼동)를 방지한다.

---

### **[INFO]** `handleError` / `errors` 상태 — 인라인 주석 이미 존재, 충분함

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` L961–978
- **상세**: `// spec §1.5 — file 선택 클라이언트 검증 실패 메시지 (필드명 → 메시지).` 주석이 있어 `errors` 상태의 목적이 명확하다. `handleError` 의 불변 최적화(`prev[name] === undefined` 조기 반환) 로직도 코드 자체가 의도를 표현한다. 추가 주석 불필요.

---

### **[INFO]** `coerceFormValue` JSDoc 내 잔존 문구 — "단일 file 메타 등" 인라인 주석

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L4386
- **상세**: `// 객체(단일 file 메타 등) — 비어있지 않은 것으로 간주(required 통과), 형식 규칙 미해당.` 주석이 남아있다. `coerceFormValue`의 JSDoc(`scalar 필드 전용 — type:'file' 은 raw metadata 배열로 validateFileField 가 별도 검증.`)과 함께 보면 "file 메타"가 이 경로를 타는 경우는 의도적으로 제거되었으므로, 인라인 주석의 "file 메타 등" 예시가 약간 혼동을 줄 수 있다. 실제로 이 분기는 `type:'file'` 필드가 아닌 다른 객체 타입(예: 중첩 JSON 객체 값)에 해당된다.
- **제안**: 해당 인라인 주석을 `// 객체(JSON 등) — required 통과 판정용, 형식 규칙 미해당.`처럼 file 메타 참조를 제거하면 `coerceFormValue`의 scalar-only 역할이 더 명확해진다. 낮은 우선순위.

---

### **[INFO]** 테스트 파일 섹션 주석 — 문서화 품질 양호

- 변경된 테스트 파일들(`form-mode.spec.ts`, `execution-engine.service.spec.ts`, `dynamic-form-ui.test.tsx`)은 `§6.2`, `§1`, `A-2` 등 spec 참조와 한국어 의도 설명이 일관되게 달려 있어 테스트 자체가 사양 문서 역할을 충실히 수행한다. 추가 주석 권장 없음.

---

### **[INFO]** README / CHANGELOG 업데이트 — 해당 없음

- 이번 변경은 내부 서버측 검증 로직 추가 및 프론트엔드 파일 선택 가드 추가로, 외부 공개 API(엔드포인트, 응답 스키마)에 영향이 없다. 프로젝트가 별도 사용자 대면 CHANGELOG나 API 문서를 관리하는 증거가 없으므로 업데이트 필요성 없음.

---

### **[INFO]** 환경변수 / 설정 옵션 문서 — 해당 없음

- 새 환경변수나 설정 옵션이 도입되지 않았으므로 설정 문서 업데이트 불필요.

---

## 요약

이번 변경의 문서화 품질은 전반적으로 높다. 주요 공개 함수(`validateScalarField`, `validateFileField`, `validateFormSubmission`, `assertFormSubmissionValid`)는 모두 상세한 JSDoc을 갖추고 있으며, 인라인 주석은 복잡한 분기 로직(MIME 검증 skip 조건, NaN/Infinity fallback, Slack divergence)을 충실히 설명한다. spec 참조 방식도 `SoT: spec/...` 패턴으로 일관되어 있다. 단, 주목할 결함은 `DEFAULT_FILE_ALLOWED_MIME_TYPES` 배열이 실제로 14개 항목을 포함하고 있음에도 `types.ts` JSDoc, `dynamic-form-ui.tsx` JSDoc, `spec/4-nodes/6-presentation/4-form.md` 4개 위치가 모두 "13종"으로 표기하는 사실적 불일치다. 코드 변경 주석 정확성 관점에서 이는 경미하지 않은 오류이며, 향후 MIME 목록 변경 시 혼동을 야기할 수 있다. 나머지 발견사항은 모두 선택적 개선 수준이다.

## 위험도

LOW

STATUS: SUCCESS
