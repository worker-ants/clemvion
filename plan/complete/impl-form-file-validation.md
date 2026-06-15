---
worktree: form-file-validation-8d2360
started: 2026-06-15
owner: developer
spec: spec/4-nodes/6-presentation/4-form.md
tracks: plan/in-progress/spec-sync-form-gaps.md (A-2 / A-3 / file 기본값)
---

# A-2 파일검증 cluster — type:'file' 서버측 + 클라이언트 검증 + 공유 기본값

> form spec §6.2 의 마지막 Planned 기능 갭(파일검증) 구현. min/max·pattern(#610)·field-level(#608)은 이미 구현됨.
> 코드+동반 spec 은 같은 PR (분리 시 impl-done/plan-coherence 차단 — #608 교훈).

## 설계 결정 (확정)

- **file 검증 위치 = execution-engine 경로 전용**. 근거: Slack/Discord `isFieldModalCompatible` 가 file 제외(모달 미수용) →
  chat-channel modal(`hooks.service.ts:470` validateFormSubmission)은 file 미도달. file 제출은 EIA REST / WS / workspace UI
  `submit_form` 만 발생(frontend metadata-only 배열). 따라서 `assertFormSubmissionValid` 가 검증 지점.
- **검증 대상 = metadata 필드(`size`/`type`/개수)**. binary 미전달(§1.5). 각 항목 `{name,size,type,lastModified}`.
- **공유 기본값(file-type 한정)**: 13종 MIME / maxFileSize 10MB / maxTotalSize 50MB / maxFiles 5. file 필드에만 주입
  (Principle 1.1 — 비-file 필드 config echo 오염 금지). MB = 1024×1024 bytes(MiB).
- **검증 순서(FIRST 오류, §1.5 planned 순서 유지)**: required → MIME(첫 위반) → per-file size → total size → count.
  scalar 필드와 동일 단일 패스(필드 정의 순서)로 cross-type 순서 보존.
- **메시지**: 기본 메시지(서버/클라 공통). file 은 `validation.message` override 미적용(v1) — spec §1.5 문구도 default 로 정렬.
- `validateFormSubmission` 의 per-field scalar core 를 `validateScalarField(value,def)` 로 추출(외부 동작 불변, 42 테스트 유지).
  execution-engine 단일 루프가 file → `validateFileField`, scalar → `coerceFormValue`+`validateScalarField` 순서대로 호출.
  `coerceFormSubmission`(이제 미사용) 제거 — `coerceFormValue` 로 동일 보장 커버 확인(INFO 5). `coerceFormValue`(단위 테스트 존재) 유지.

## impl-prep 후속 결정 (consistency 11_33_17, BLOCK NO)

- **WARNING 1 (validation.message) → 옵션 B**: 현 scalar `validateFormSubmission` 도 `validation.message` 를 honor 하지 않고 하드코딩 기본 메시지를 쓴다(form-mode.ts 확인). file 도 동일 기본 메시지(v1)로 구현하고 spec §1.5 의 `validation.message` 약속을 default 메시지로 정렬(scalar 와 일관). message override 는 향후 scalar/file 공통 과제.
- **WARNING 2 (Slack divergence) → 채택**: `validateFileField` 는 `size`(number)/`type`(string) 부재 시 해당 체크 skip(방어적). Slack shape(`{fileId,mimeType,...}`)는 size/MIME 미보유라 자연 bypass. form.md §1.5 에 chat-channel 어댑터 divergence 주석 추가, §6.2 검증 지점에 file 은 frontend metadata-only 경로 대상임을 명시.
- **INFO 4 → 채택**: §Rationale 에 file 검증 execution-engine 전용 근거(chat-channel modal 이 file 미수용) 1줄 추가.
- INFO 1/2/3/6/7/10 → 본 cluster 범위 밖, defer.

## 작업 체크리스트

### 0~3 게이트
- [x] consistency-check --impl-prep spec/4-nodes/6-presentation/4-form.md (BLOCK NO, 11_33_17 — WARNING 2건 비차단)

### 4 DOCUMENTATION (spec — 같은 PR)
- [x] form §1 file 기본값 주석 Planned→구현 (extractFormFields 주입 + MB=1024² 명시)
- [x] form §1.5 클라이언트 검증 Planned→구현 (default 메시지 정렬 + Slack divergence 주석)
- [x] form §6.2 file 행 Planned→구현
- [x] form §6.2 "검증 지점" 주석 file 포함(단일 패스 validateScalarField/validateFileField), "file Planned" 제거
- [x] form §Rationale file cluster 구현 반영 + execution-engine 전용 근거(INFO4) + coerceFormSubmission 제거 근거(INFO5)
- [x] 인접 spec 검증 열거 동기화 — impl-done(12_30_46) WARNING 검출 → EIA §5.1·WS §4.2 file 항목 추가(Planned 제거) + form.md frontmatter code: form-mode.ts/types.ts 등재(INFO#3)
- [ ] spec-sync-form-gaps.md 체크박스 [x] (file 3행) — 10단계에서

### 9 REVIEW WORKFLOW
- [x] /ai-review --branch main (12_09_39): RISK LOW, Critical 0, Warning 3 → 전부 조치(RESOLUTION.md). fix 062bd3e1
- [x] /consistency-check --impl-done (12_30_46): BLOCK NO. Cross-Spec WARNING 2(EIA/WS Planned 잔류) → 인접 spec 동기화로 해소
- [x] fresh /ai-review (12_29_50): RISK MEDIUM, Critical 0, Warning 6 → W1(빈 MIME 기능 결함)·W4(13→14종)·W3/W6(추출)·W5 전부 조치(RESOLUTION.md). fix 2eab022a/744c6509
- [ ] fresh /ai-review #2 (2eab022a 커버 — 수렴 확인) — 진행 중

### 5~7 TDD (코드)
- [x] form-mode.ts: 공유 default 상수 + FormModalField file 필드(types.ts) + extractFormFields file-default 주입
- [x] form-mode.ts: validateScalarField 추출 + validateFileField 신규
- [x] execution-engine.service.ts: assertFormSubmissionValid 단일 루프(file/scalar) + coerceFormSubmission 제거 + JSDoc
- [x] dynamic-form-ui.tsx: file onChange reject(MIME/size/total/count) + 에러 표시 + FormField maxFileSize/maxTotalSize + i18n(editor.runResults.formFile*)
- [x] 테스트: form-mode.spec(validateFileField·extractFormFields default), execution-engine.service.spec(file 통합 + D 후속 min/max·pattern 통합 1건씩), dynamic-form-ui.test(reject)
- [x] (ISSUE-FIX) pre-existing 게이트: plan/complete/form-validation-minmax-pattern.md spec_impact 보강

### 8 TEST WORKFLOW
- [x] lint(PASS) / unit(PASS) / build(PASS) / e2e(192 PASS) — eslint --fix 무관 3파일 revert, web-chat·packages 환경 준비

### 9 REVIEW WORKFLOW
- [ ] /ai-review --branch main (커밋 후) → resolution → fresh review
- [ ] /consistency-check --impl-done spec/4-nodes/6-presentation/4-form.md (BLOCK NO)

### 10 plan complete
- [ ] spec-sync-form-gaps.md 잔여(ValidationPreset 보류만) 확인 후 본 plan 처리
