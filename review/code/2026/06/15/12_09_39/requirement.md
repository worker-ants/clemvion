# Requirement Review — form-file-validation (A-2 cluster)

## 발견사항

### **[INFO]** `multiple` 속성 — 미설정 `maxFiles` 시 단일 파일 모드 (spec 코드 스니펫과 차이)
- 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:262`
- 상세: spec §1.5 코드 스니펫은 `multiple={maxFiles > 1}` (유효값 기준)을 제시하며, 기본값 5가 적용되면 미설정 시에도 `multiple=true` 가 돼야 함을 암시한다. 그러나 구현은 `multiple={typeof field.maxFiles === "number" && field.maxFiles > 1}` 으로 타입 가드를 추가해, `maxFiles` 미설정(undefined) 시 `multiple=false` — 즉 단일 파일 피커가 된다. 결과적으로 노드 설정에서 `maxFiles` 를 생략하면 사용자는 파일을 1개씩밖에 선택할 수 없지만, 서버 측에선 기본 5개까지 허용한다. 기능 불일치는 UX 레벨이며 보안 위험은 없다(서버가 `maxFiles=5` 기본값을 주입해 개수 초과 재제출을 막는다).
- spec §1 주석("위 4개 file 옵션은 `formFieldSchema` 에서 `optional()` 로만 선언…대신 `extractFormFields` 가 file 필드에 한해 미설정 옵션에 기본값을 주입")은 **서버측 정규화** 맥락이고, 프런트엔드 `formConfig` 는 raw config 를 그대로 수신한다. spec §1.5 코드 스니펫의 `maxFiles > 1` 은 서버가 주입한 후의 필드 값을 전제했을 가능성이 높다.
- 제안: `multiple` 속성 판단 시 `(field.maxFiles ?? DEFAULT_FILE_MAX_FILES) > 1` 로 변경하거나, spec §1.5 코드 스니펫을 "명시 설정 시만 multiple" 로 업데이트. 현재 구현 방향이 의도적이라면 SPEC-DRIFT 로 분류 가능하나, spec 코드 스니펫이 `??` 없이 `maxFiles > 1` 을 쓰므로 판단 모호 → WARNING 으로 남겨 사람이 결정.

---

### **[INFO]** 프런트엔드 테스트 — `maxTotalSize` 클라이언트 가드 테스트 누락
- 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx`
- 상세: 신규 "file 클라이언트 검증" describe 블록이 MIME, per-file 크기, 개수 초과 케이스를 커버하나 **합계 크기 초과(maxTotalSize)** 케이스가 없다. `validateFilesClient` 에 구현은 있지만(line 98) 프런트엔드 단위 테스트로 검증되지 않는다. 서버측 `form-mode.spec.ts` 에는 `total size 초과` 케이스가 있어 백엔드는 커버됨.
- 제안: `total size` 초과 reject 케이스 1개 추가(`maxTotalSize` 초과 → 에러 메시지 + submission 에 `doc: []`).

---

### **[INFO]** `workflow-errors.ts` JSDoc 낡은 참조
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts:244`
- 상세: `FormValidationError` JSDoc 에 `chat-channel \`validateFormSubmission\` 와 동일하게 FIRST 오류만 surface` 라는 표현이 남아있다. `assertFormSubmissionValid` 는 이제 `validateScalarField` / `validateFileField` 를 직접 호출하며 `validateFormSubmission` 은 chat-channel modal 전용으로 분리됐다. 이 주석은 독자를 혼란스럽게 할 수 있다.
- 제안: `chat-channel \`validateFormSubmission\` 와 동일하게` 부분을 제거하거나 `validateScalarField` / `validateFileField` 로 업데이트.

---

### **[INFO] [SPEC-DRIFT]** spec §1.5 코드 스니펫 — `multiple` 표현이 구현과 상이
- 위치: `spec/4-nodes/6-presentation/4-form.md:101`
- 상세: spec §1.5 코드 스니펫 `multiple={maxFiles > 1}` 은 `maxFiles` 가 항상 유효한 숫자임을 전제하나, 실제 프런트엔드 `FormField` 는 raw config를 받아 `undefined` 일 수 있다. 구현이 `typeof field.maxFiles === "number" && field.maxFiles > 1` 로 방어적으로 처리한 것이 더 안전하다. spec 본문의 코드 스니펫이 구현 현실을 반영하도록 `(maxFiles ?? 1) > 1` 또는 주석 보완이 필요하다.
- 제안: 코드 유지 + spec §1.5 코드 스니펫 수정 (`spec/4-nodes/6-presentation/4-form.md §1.5` 의 `multiple={maxFiles > 1}` 을 `multiple={(maxFiles ?? 1) > 1}` 으로 또는 프로즈 설명 보충). 반영 주체: `project-planner`.

---

## 기능 완전성 점검

| 항목 | 결과 |
|------|------|
| 공유 기본값 상수(13종 MIME / 10MB / 50MB / 5) — backend `DEFAULT_FILE_*` 정의 | 완전 |
| `extractFormFields` — file 필드 한정 기본값 주입, 비-file 미오염(Principle 1.1) | 완전 |
| `validateFileField` — required → MIME → per-file size → total size → count 순서 | 완전 |
| `validateScalarField` 추출 — 기존 42 테스트 동작 변경 없음 | 완전 |
| `validateFormSubmission` — `validateScalarField` 재사용, 외부 계약 불변 | 완전 |
| `assertFormSubmissionValid` — 단일 패스, file/scalar 분기, cross-type FIRST 오류 보존 | 완전 |
| `coerceFormSubmission` 제거 — `coerceFormValue` per-field 로 대체 | 완전 |
| 프런트엔드 `FormField` 에 `maxFileSize`/`maxTotalSize` 추가 | 완전 |
| `validateFilesClient` — MIME → per-file size → total size → count | 완전 |
| `onChange` reject — selection 미반영 + input clear + 에러 표시 + submit 버튼 활성 유지 | 완전 |
| i18n 키 4종 (en/ko) 추가 | 완전 |
| 프런트엔드 기본 상수 — backend `DEFAULT_FILE_*` 와 값 일치 | 완전 |
| chat-channel modal(`hooks.service validateFormSubmission`) — file 미도달, 검증 불필요 | 설계 의도대로 유지 |
| Slack divergence — size/type 미보유 shape 방어적 skip | 완전 |

## Spec Fidelity 점검

`spec/4-nodes/6-presentation/4-form.md` 와의 line-level 일치 검토:

| spec 항목 | 구현 일치 여부 |
|-----------|--------------|
| §1 file 기본값: 13종 MIME | 일치 (양측 동일 목록) |
| §1 maxFileSize=10, maxTotalSize=50, maxFiles=5 | 일치 |
| §1 MB = 1024×1024 bytes | 일치 (`MB_IN_BYTES = 1024 * 1024`) |
| §1.5 검증 순서: required→MIME→per-file→total→count | 일치 (backend + frontend 모두) |
| §1.5 reject 동작: selection 미반영 + input clear + 에러 표시 + submit 활성 | 일치 |
| §6.2 `validateFileField` + `validateScalarField` 분리 단일 패스 | 일치 |
| §6.2 `coerceFormSubmission` 제거 | 일치 |
| `FormModalField` file 필드 4종 (`allowedMimeTypes?`, `maxFileSize?`, `maxTotalSize?`, `maxFiles?`) | 일치 |
| 에러 메시지 (KO): "허용되지 않은 파일 형식입니다." / "파일 크기는 {N}MB 이하여야 합니다." / "전체 파일 크기는 {N}MB 이하여야 합니다." / "최대 {N}개까지 업로드할 수 있습니다." | 일치 |
| §1.5 `multiple` 속성 스니펫 `maxFiles > 1` | spec 스니펫이 구현 실제와 미세하게 다름 (INFO SPEC-DRIFT — 위 발견사항) |

## 에러 시나리오 검토

- **비-file 필드에 file 제약 미주입**: `type !== 'file'` 분기가 명확히 분리됨.
- **`maxFileSize` 0 또는 음수**: `> 0` 조건으로 기본값 fallback.
- **빈 `allowedMimeTypes` 배열**: `mimes.length > 0` 조건으로 기본값 fallback.
- **배열이 아닌 `value` 입력**: `Array.isArray(value) ? value : []` 로 방어적 처리.
- **null/undefined element**: `filter((x) => !!x && typeof x === 'object')` 로 skip.
- **Slack shape (`{fileId, mimeType}`)**: `size`/`type` 부재 → 해당 체크 skip → null 반환.
- **`validateFilesClient` 빈 배열**: `files.length === 0` → null (required 체크는 서버에 위임).
- **`formData` 가 객체 아님**: `rawData = {}` fallback 후 각 field 의 `rawData[def.name]` 은 undefined → scalar는 `''`로 coerce, file은 `[]`로 처리.

## 요약

코드 변경은 spec `4-form.md §1 / §1.5 / §6.2` 에서 요구하는 `type:'file'` 검증 cluster 를 기능적으로 완전하게 구현했다. 공유 기본값 상수, `extractFormFields` file-only 주입, `validateFileField` 서버측 검증, `validateFilesClient` 프런트엔드 가드, 단일 패스 `assertFormSubmissionValid` 리팩터, `coerceFormSubmission` 제거, i18n 키 신설이 모두 spec 에 지정된 동작·순서·메시지·기본값과 일치한다. 발견된 이슈는 두 INFO 항목(프런트엔드 `multiple` 속성의 미설정 시 동작 + 프런트엔드 `maxTotalSize` 테스트 누락)과 하나의 낡은 JSDoc 주석으로, 기능 정확성에 영향을 주지 않는다.

## 위험도

LOW
