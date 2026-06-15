# 요구사항(Requirement) 리뷰 결과

리뷰 범위: form file validation 구현 diff (spec/4-form.md, EIA spec, WS spec, consistency 체크 산출물)

---

## 발견사항

### [WARNING] `multiple` 속성 — 구현과 spec §1.5 의 표현식이 다름

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` line 159
- 상세: spec §1.5 (4-form.md line 103) 는 `multiple={(maxFiles ?? 1) > 1}` 로 기술한다 — `maxFiles` 미설정 시 기본값 1 을 적용해 단일 파일 모드로 떨어진다. 그러나 코드 line 159 는 `multiple={typeof field.maxFiles === "number" && field.maxFiles > 1}` 이다. `maxFiles` 가 undefined 이면:
  - spec 표현식: `(undefined ?? 1) > 1` = `1 > 1` = `false` (단일)
  - 구현: `typeof undefined === "number"` = `false` → `multiple={false}` (단일)
  두 결과는 동일하다 — 기능적 동치. 그러나 spec 이 `(maxFiles ?? 1) > 1` 형식(nullish coalescing)을 명시했는데 코드는 타입 가드 형태를 택했다. 동작 결과가 동일하므로 기능 위반은 아니나 spec 이 명시한 표현식과 구현 형식이 다르다.
  단, **주의할 엣지 케이스**: spec 표현식은 `maxFiles` 가 `null` 인 경우도 `(null ?? 1) > 1 = false` 로 처리하지만, 코드 표현식은 `typeof null === "number"` = false → `false` 로 동일하다. `maxFiles = 0` 인 경우는 spec: `(0 ?? 1) > 1 = 0 > 1 = false`, 코드: `typeof 0 === "number" && 0 > 1 = false` — 동일. 이 관점에서 모든 입력값에 대해 결과가 일치한다.
  결론: 기능적으로 동치이나 spec §1.5 가 `(maxFiles ?? 1) > 1` 를 literal 시그니처로 표기한다. spec 이 구현보다 명확한 의미를 주므로 spec 표현식으로 구현을 정렬하는 것을 권장한다.
- 제안: `multiple={typeof field.maxFiles === "number" && field.maxFiles > 1}` → `multiple={(field.maxFiles ?? 1) > 1}` 으로 변경해 spec §1.5 literal 표현식과 정렬. 현재 동작에 버그는 없으나 spec 드리프트 방지를 위해 권장.

### [WARNING] `validation.message` override — spec §6.2 와 구현 간 불일치 (spec 이 권위)

- 위치: spec/4-nodes/6-presentation/4-form.md §6.2 line 333; `form-mode.ts` `validateScalarField` 함수
- 상세: spec §6.2 표 (line 333) 는 `validation.minLength`/`maxLength` 위반 처리 행에 `"(validation.message 가 있으면 그것을, 없으면 기본 메시지)"` 라고 명시한다. 그러나 `validateScalarField` 구현은 `def.validation.message` 를 전혀 참조하지 않고 항상 하드코딩된 기본 메시지를 반환한다. `FormModalField` 타입에는 `minLength`/`maxLength`/`min`/`max`/`pattern` 은 있으나 `message` 필드가 없다 — `extractFormFields` 가 `validation.message` 를 `FormModalField` 에 복사하지 않는다. 즉 spec 이 정의한 `validation.message` override 동작이 구현되지 않았다.
  spec §1.5 의 callout (line 113)은 file 에 대해 `"validation.message override 는 v1 에서 file 에 미적용"` 이라 명시하며 "현 scalar 검증도 동일하게 기본 메시지를 쓴다" 고 부연한다. 이는 scalar 도 실질적으로 message override 가 미구현임을 인정하는 주석이다. 그러나 spec §6.2 표는 scalar(`minLength`/`maxLength`) 위반에 `validation.message` 를 쓴다고 명시하므로 spec 내부 모순이 존재한다.
- 방향 판단: spec §6.2 표가 요구사항 권위 (구현 명세)이고, §1.5 callout 은 현 구현 상태 설명이다. spec §6.2 표의 약속이 구현되지 않은 것은 **코드가 spec 요구사항을 미충족**한 상태다. 다만 consistency checker(rationale_continuity.md 12_30_46)가 "현 scalar 검증도 동일하게 기본 메시지를 쓴다" 고 표현하며 이를 의도된 v1 결정으로 해석했다는 점에서, 이 상황이 의도적 v1 축소인지 미구현 버그인지 판단이 모호하다.
  결론: 불명확한 의도이므로 SPEC-DRIFT 가 아닌 WARNING 으로 등록. spec §6.2 의 `validation.message` 적용 약속이 구현에 반영되지 않았으며, 사람이 의도 여부를 확인해야 한다.
- 제안: (A) `FormModalField` 에 `message?: string` 추가, `extractFormFields` 에서 `validation.message` 를 복사, `validateScalarField` 에서 반환 message 에 적용. spec §6.2 요구사항 충족. (B) v1 에서 의도적으로 제외한다면, spec §6.2 해당 행을 `"동상 — 기본 메시지 사용 (validation.message override 는 향후 과제)"` 로 갱신해 spec 내 모순을 해소. 현재 spec §1.5 callout 은 있으나 §6.2 표 자체는 수정되지 않았다.

### [INFO] frontend `renderFileField` 의 `accept` 속성 — 미설정 시 기본 MIME 목록 미적용

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` line 158
- 상세: spec §1.5 line 105 는 `"accept 는 사용자 명시 allowedMimeTypes 값을 그대로 콤마 결합 (미설정 시 accept 미부여 — 단, 아래 클라이언트 가드는 미설정 필드에 §1 기본 MIME 목록을 적용한다)"` 고 설명한다. 코드 line 158 은 `accept={(field.allowedMimeTypes ?? []).join(",") || undefined}` 이며, `allowedMimeTypes` 미설정 시 `accept` 를 미부여한다. 동시에 `validateFilesClient` (line 93-95) 는 미설정 시 `DEFAULT_FILE_ALLOWED_MIME_TYPES` 를 적용한다. 즉 `<input>` 의 `accept` 는 미설정 시 브라우저 파일 선택기에서 필터링이 없지만, 선택 후 `onChange` 에서 `validateFilesClient` 가 기본 MIME 목록으로 검증한다. 이는 spec 의 의도("accept 미부여 + 클라이언트 가드에서 기본값 적용")와 정확히 일치하므로 spec 준수.
  참고: 서버가 `extractFormFields` 에서 기본값을 주입하므로, `formConfig` 를 통해 받은 field 의 `allowedMimeTypes` 는 이미 채워져 있을 것이다. 즉 실제 런타임에서 `field.allowedMimeTypes` 가 undefined 로 오는 경우는 server 기본값 주입이 누락된 경우만이다 — 방어적 처리.
- 제안: 없음 — spec 정합.

### [INFO] `validateFilesClient` 에서 `required` 빈 배열 체크 없음

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` line 86-118
- 상세: `validateFilesClient` 는 `files.length === 0` 이면 즉시 `null` 을 반환한다 (line 91). 즉 필수 필드(`required: true`)인데 파일를 선택하지 않으면 클라이언트 가드를 통과한다. 그러나 이 경우 `onChange([])` 로 빈 배열이 fieldState 에 들어가고, 서버 `validateFileField` 가 `required + metas.length === 0` 으로 검증 실패를 잡는다. spec §1.5 는 클라이언트 가드가 "MIME → per-file size → total size → count" 를 검사한다고 명시하며, 빈 파일 케이스의 클라이언트 단 required 검증은 명시하지 않는다. 서버가 최종 게이트이므로 기능상 누락이 아니지만, UX 관점에서 `required: true` + 파일 0개 제출 시 서버 왕복 후에야 에러를 보여준다.
  이는 spec 이 명시적으로 정의하지 않은 영역이므로 spec 위반은 아니다.
- 제안: 선택적 UX 개선 — `validateFilesClient` 에서 `if (field.required && files.length === 0)` 도 처리해 서버 왕복 없이 "필수 입력 항목입니다." 표시 가능. 단 spec 변경 없이 구현 개선에 해당한다.

### [INFO] `validateFileField` 의 MIME 체크 skip 조건 — `typeof m.type === 'string' && m.type !== ''`

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` lines 373-383
- 상세: 서버 `validateFileField` 는 `m.type !== ''` 이면서 `allowedMimeTypes` 밖이면 reject 한다. 빈 문자열 MIME 은 skip — spec §1.5 의 `"확장자 없는 파일(File.type === '')은 MIME 체크를 skip 한다"` 와 정합. 그러나 코드는 `typeof m.type === 'string'` 체크도 포함하는데, 이는 Slack 등 chat-channel 의 다른 file shape(`{fileId, mimeType}`)이 `size`/`type` 미보유라 자연 bypass 된다는 §1.5 divergence 를 구현한 것이다. spec 정합.

### [INFO] `coerceFormSubmission` 제거 후 `validateFormSubmission` 과 `validateAllFields` 공존

- 위치: `form-mode.ts`
- 상세: `validateFormSubmission` (scalar-only, hooks.service 용) 과 `validateAllFields` (file+scalar 단일 패스, assertFormSubmissionValid 용) 두 함수가 공존한다. spec Rationale 은 "file 필드는 native modal 미수용이라 hooks.service 경로에 도달하지 않으므로 `validateFormSubmission` 에 file 로직을 추가하지 않는다" 고 명시한다. 구현이 Rationale 과 정합한다. `validateFormSubmission` 의 JSDoc 도 이 사실을 "scalar 전용 경로" 로 명시한다.
- 제안: 없음 — 정합.

---

## 요약

form file validation 구현(서버측 `validateFileField`, `validateAllFields`, `extractFormFields` 기본값 주입; frontend `validateFilesClient`, `renderFileField`; spec 갱신 3종)은 전반적으로 spec 의 핵심 요구사항을 충족한다. 파일 MIME/크기(단일·합계)/개수 검증이 서버 chokepoint(`assertFormSubmissionValid`)와 클라이언트 가드(`validateFilesClient`) 양쪽에 구현됐고, FIRST 오류 순서(required → MIME → per-file size → total → count)가 spec Rationale 정의와 일치하며, 기본값 주입(`extractFormFields`)·14종 MIME 목록·10MB/50MB/5 수치가 spec §1 과 코드 양쪽에서 일치한다. spec 갱신 3종(4-form.md, EIA §5.1, WS §4.2)도 구현 완료 상태를 올바르게 반영한다. 두 가지 주의 사항이 있다: (1) `multiple` 속성 표현식이 spec §1.5 literal 과 다르나 기능적 동치이며(WARNING), (2) spec §6.2 표의 `validation.message` override 약속이 scalar 검증에서도 미구현된 상태가 spec 내부 모순을 만들어 요구사항 이행 여부 판단이 사람의 결정을 필요로 한다(WARNING).

---

## 위험도

LOW
