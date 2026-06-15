# 요구사항(Requirement) 리뷰

## 발견사항

---

### **[WARNING]** 서버-클라이언트 MIME 검증 비대칭 — `type: ''` (확장자 없는 파일) 처리 불일치
- **위치**: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` `validateFileField` L371, `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` `validateFilesClient` L95
- **상세**: spec §1.5 는 "`File.type === ''`(확장자 없는 파일)은 MIME 체크를 skip 한다 — 브라우저가 타입을 못 매기는 경우 거부하지 않음, 서버 검증이 최종 게이트"로 명시한다. 프론트엔드 `validateFilesClient` 는 `if (f.type && !allowedMime.includes(f.type))` 로 빈 문자열(`''`)을 올바르게 skip 한다. 그러나 서버 `validateFileField` 의 MIME 체크는 `if (typeof m.type === 'string' && !allowed.includes(m.type))` 로, `m.type === ''` 이면 `typeof '' === 'string'` 이 `true`이고 `allowed.includes('')` 는 `false`이므로 **서버가 해당 파일을 거부한다**.
  - **실제 흐름**: 사용자가 확장자 없는 파일 선택 → 클라이언트가 MIME 체크 skip → `{ type: '' }` 메타데이터 생성 → 제출 → 서버 `validateFileField` 가 `''`을 "미허용 MIME"으로 판정해 `FormValidationError` throw ("허용되지 않은 파일 형식입니다.").
  - **영향**: 사용자는 클라이언트에서 선택이 허용됐는데 서버에서 거부 당하는 불일치 경험을 한다. spec의 의도("서버 검증이 최종 게이트" — 즉, 브라우저가 타입 미판별 파일도 허용 의도)에 반한다.
  - **프론트엔드 테스트**(`dynamic-form-ui.test.tsx`)에는 `type: ''` skip 케이스가 추가됐으나, 서버 테스트(`form-mode.spec.ts`)에는 `type: ''` 케이스가 없어 이 버그가 테스트에서 잡히지 않는다.
- **제안**: 서버 `validateFileField` MIME 체크 조건을 `typeof m.type === 'string' && m.type !== '' && !allowed.includes(m.type)` 로 수정하여 클라이언트 동작과 대칭화. 서버 `form-mode.spec.ts` 에 `type: ''` 파일이 통과되는 단위 테스트 추가 필요.

---

### **[INFO]** [SPEC-DRIFT] spec 본문 "13종 MIME" 표기 오류 — 실제 목록은 14종
- **위치**: `spec/4-nodes/6-presentation/4-form.md` §1 표(L44), §1 note(L49), §1.5(L105), §Rationale(L363)
- **상세**: spec은 복수 위치에서 "13종 MIME"을 언급하나, 바로 아래 spec 본문의 JSON 목록 자체에 14종(image/jpeg, image/png, image/gif, image/webp, image/svg+xml × 5, application/pdf, application/msword, .docx, .xls, .xlsx, .ppt, .pptx × 7, text/plain, text/csv × 2 = 합계 14)이 정의되어 있다. 백엔드 `form-mode.ts` `DEFAULT_FILE_ALLOWED_MIME_TYPES` 및 프론트엔드 `dynamic-form-ui.tsx` 상수 모두 14종으로 올바르게 구현되어 있다. **코드가 옳고 spec 본문 prose의 수치("13종")만 오기**이다.
- **제안**: 코드 유지 + spec 반영. `spec/4-nodes/6-presentation/4-form.md` 내 "13종" 4개 위치를 모두 "14종"으로 정정 필요 (반영 주체: `project-planner`).

---

### **[INFO]** [SPEC-DRIFT] EIA §5.1 — `type:'file'` 검증 "Planned" 표기가 잔존
- **위치**: `spec/5-system/14-external-interaction-api.md` §5.1 L313
- **상세**: EIA spec §5.1 의 `400 VALIDATION_ERROR` 설명에 "`type: 'file'` MIME/크기/개수 검증만 별도 **Planned** ([Form §6.2](...))"로 명시되어 있다. 그러나 이번 PR(A-2)에서 `validateFileField` + `assertFormSubmissionValid` 단일 루프를 통해 EIA 경로도 file 검증을 수행하도록 구현이 완료됐다. plan `impl-form-file-validation.md` 체크리스트에 "인접 spec 검증 열거 동기화 필요시(EIA §5.1 ...) — impl-done 이 검출하면 반영" 항목이 미완료(`[ ]`)로 남아 있어 impl-done 단계를 아직 통과하지 않은 상태다.
- **제안**: 코드 유지 + spec 반영. `spec/5-system/14-external-interaction-api.md` §5.1 의 `400 VALIDATION_ERROR` 행에서 `type:'file'` "Planned" 표기 제거, 검증 항목 열거에 `file MIME/크기/개수` 추가 (반영 주체: `project-planner` — impl-done 결과에 따라).

---

### **[INFO]** [SPEC-DRIFT] WS §4.2 VALIDATION_ERROR 검증 항목 열거에 file 미포함
- **위치**: `spec/5-system/6-websocket-protocol.md` §4.2 L313
- **상세**: WS spec §4.2 의 `VALIDATION_ERROR` 항목은 "필수/type/minLength·maxLength/min·max(숫자 범위)/pattern(정규식)/select·radio 선택지"를 나열하지만 `type:'file'` MIME/크기/개수가 빠져 있다. EIA §5.1 처럼 명시적 "Planned" 표기는 없으나 실제로는 WS `submit_form` 경로도 동일 `assertFormSubmissionValid` chokepoint를 거쳐 file 검증이 적용된다.
- **제안**: 코드 유지 + spec 반영. WS §4.2 `VALIDATION_ERROR` 설명에 `type:'file'` MIME/크기/개수를 추가 (반영 주체: `project-planner`).

---

### **[INFO]** [SPEC-DRIFT] spec §1.5 `multiple` 속성 스니펫이 구현과 상이 (선행 리뷰 INFO#1 재확인)
- **위치**: `spec/4-nodes/6-presentation/4-form.md` §1.5 L101 vs `dynamic-form-ui.tsx` L269
- **상세**: spec 스니펫은 `multiple={(maxFiles ?? 1) > 1}` 이나 구현은 `multiple={typeof field.maxFiles === "number" && field.maxFiles > 1}` 이다. `maxFiles` 가 `undefined`일 때 동작은 동일하게 `false`(단일 모드)이나 표현 방식이 다르다. 선행 review `12_09_39` INFO#1 에서 이미 식별됐고 RESOLUTION에서 spec 업데이트 조치로 채택됐으나(`062bd3e1`에서 `spec/4-nodes/6-presentation/4-form.md` §1.5 스니펫을 `(maxFiles ?? 1) > 1` 로 정렬했다고 기록), 현재 spec 텍스트(L101)가 실제로 반영됐는지 위치 재확인 필요.
- **제안**: `spec/4-nodes/6-presentation/4-form.md` §1.5 L101 코드 스니펫이 `(maxFiles ?? 1) > 1` 또는 구현과 동일한 방어적 표현으로 갱신됐는지 확인 (반영 주체: `project-planner`).

---

## 기능 완전성 검토

**기본값 주입 (§1)**: `extractFormFields` 가 `type:'file'` 필드에 `allowedMimeTypes`/`maxFileSize`/`maxTotalSize`/`maxFiles` 공유 기본값을 정확히 주입하며, 비-file 필드에는 주입하지 않는다(Principle 1.1 준수). `posFinite` 가드로 `NaN`/`Infinity`/0/음수를 거부하고 기본값으로 fallback 하는 로직도 올바르다.

**서버측 검증 (§6.2)**: `validateFileField` 는 required → MIME → per-file size → total size → count 순서로 FIRST 오류를 반환한다. spec §1.5 의 검증 순서와 일치하며, 방어적 처리(비배열·비객체 element skip, `size`/`type` 미보유 시 해당 체크 skip)도 구현됐다. 단, `type:''`(빈 문자열) 처리가 클라이언트와 불일치하는 WARNING 이슈가 있다.

**실행 엔진 단일 루프 (§6.2 검증 지점)**: `assertFormSubmissionValid` 가 필드 정의 순서 단일 패스로 `type:'file'` 은 `validateFileField`, scalar는 `coerceFormValue`+`validateScalarField` 를 호출하는 구조로 spec 요건에 부합한다.

**클라이언트 가드 (§1.5)**: `validateFilesClient` 는 MIME → per-file size → total size → count 순서로 FIRST 오류를 반환하며 spec 검증 순서와 일치한다. 선택 거부 시 selection 미반영 + file input clear + 에러 문구 표시 + 제출 버튼 유지도 spec §1.5 동작 정의와 일치한다. 빈 type(`''`) skip 도 올바르다.

**i18n**: KO/EN 4개 메시지 키가 서버 하드코딩 메시지와 내용이 일치한다.

**에러 시나리오**: FormValidationError throw 후 execution `waiting_for_input` 유지(재제출 가능)가 spec §6.2와 일치하며, publish 미호출도 통합 테스트에서 검증됐다.

**엣지 케이스**: NaN/Infinity 숫자 제약 기본값 fallback, 비배열 입력 방어, null element 무시, optional 빈 배열 통과, required 빈 배열 오류 — 모두 단위 테스트에서 커버됨.

---

## 요약

이번 변경은 `type:'file'` 필드의 서버측 및 클라이언트측 검증, 공유 기본값 주입을 구현하며 spec §1·§1.5·§6.2 요건을 대체로 충실히 반영했다. 기능 완전성·비즈니스 로직·데이터 유효성·에러 시나리오 처리 대부분이 spec과 일치한다. 주요 기능 결함은 서버 `validateFileField` 의 `type:''`(빈 MIME) 처리 — 클라이언트는 이를 허용하지만 서버가 거부하여 spec §1.5 의 의도("브라우저가 타입을 못 매기는 경우 거부하지 않음")에 반하는 클라이언트-서버 불일치가 발생한다. spec fidelity 측면에서는 spec 본문의 "13종 MIME" 오기(실제 14종), EIA §5.1·WS §4.2 의 file 검증 "Planned" 또는 열거 누락 등 SPEC-DRIFT가 3건 식별됐다 — 모두 코드는 올바르고 spec 본문이 낡은 상태이므로 `project-planner` 가 spec을 업데이트해야 한다.

---

## 위험도

**MEDIUM** — `type:''` 서버-클라이언트 MIME 검증 불일치(WARNING 1건)가 실사용 시 재현 가능한 기능 결함이다. 나머지는 spec 갱신 필요 SPEC-DRIFT(INFO 3건)와 spec 오기(INFO 1건)로 코드 기능 자체에는 영향을 주지 않는다.
