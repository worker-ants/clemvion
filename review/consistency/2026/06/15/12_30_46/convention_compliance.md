# 정식 규약 준수 검토 결과

검토 모드: `--impl-done`, scope=`spec/4-nodes/6-presentation/4-form.md`, diff-base=`origin/main`

---

## 발견사항

### INFO-1: spec `code:` frontmatter 에 신규 구현 파일 미등재
- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` lines 1-11 (frontmatter `code:` 목록)
- **위반 규약**: CLAUDE.md "정보 저장 위치" 표 — `code:` frontmatter 는 해당 spec 의 구현 파일을 나열한다 (단일 진실 원칙)
- **상세**: 이번 diff 에서 실질적 구현 파일인 `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` 와 `codebase/backend/src/modules/chat-channel/types.ts` 가 spec `code:` 목록에 없다. spec 본문(§1/§6.2/Rationale)은 `form-mode.ts` 의 `extractFormFields`·`validateFileField`·`DEFAULT_FILE_*` 를 직접 인용한다.
- **제안**: frontmatter `code:` 에 아래 두 줄 추가.
  ```yaml
  - codebase/backend/src/modules/chat-channel/shared/form-mode.ts
  - codebase/backend/src/modules/chat-channel/types.ts
  ```

### INFO-2: i18n 키 경로 표기가 spec 주석과 코드 간 경미한 불일치
- **target 위치**: `dynamic-form-ui.tsx` JSDoc (prompt_file lines 1131-1137) — `editor.runResults.{formFileMimeRejected, ...}` 형태로 키 경로 명시
- **위반 규약**: `spec/conventions/i18n-userguide.md` Principle 1 (dict 키 경유) — 위반은 아님. 다만 spec 본문 §1.5 에는 i18n 키 경로가 명시되지 않았다. 코드 JSDoc 과 spec §1.5 사이의 drift 가능성만 존재.
- **상세**: `dict/ko/editor.ts` 와 `dict/en/editor.ts` 에 4개 키(`formFileMimeRejected`, `formFileSizeExceeded`, `formFileTotalExceeded`, `formFileCountExceeded`)가 모두 `runResults` 섹션 하위에 ko/en 양쪽 동시 추가되어 있다. Principle 2(ko/en leaf parity) 충족 확인. 코드 내 `t("editor.runResults.formFileMimeRejected")` 등 실제 호출 경로와 dict 구조가 일치한다.
- **제안**: spec §1.5 에 "(i18n 키: `editor.runResults.formFile*`)" 한 줄 추가하면 독자가 코드를 탐색하지 않아도 키 위치를 알 수 있다. 규약 위반은 아니고 가독성 향상 제안이다.

### INFO-3: `VALIDATION_ERROR` 에러 코드 표기 — 규약 준수 확인
- **target 위치**: `workflow-errors.ts` JSDoc diff (prompt_file lines 848-856)
- **위반 규약**: `spec/conventions/error-codes.md` §1 의미 기반 명명, §2 안정성 정책
- **상세**: `VALIDATION_ERROR` 는 `error-codes.md §1` 이 "시스템 전역 공용 코드로 prefix 없이 쓰는 기존 카테고리" 로 명시적으로 허용한다. 이번 diff 는 신규 코드를 신설하지 않고 기존 `VALIDATION_ERROR` 를 file 검증 실패 경로에도 재사용한다 — breaking change 없음. 에러 코드 규약 준수.

---

## 요약

`spec/4-nodes/6-presentation/4-form.md` 와 관련 구현 diff 는 정식 규약(`spec/conventions/`) 을 전반적으로 잘 준수한다. i18n 규약(Principle 1·2 키 경유·ko/en parity), 에러 코드 규약(`VALIDATION_ERROR` 전역 공용 코드 재사용), 출력 포맷 규약(metadata-only payload·`output.interaction.data`), 문서 구조(Overview/본문/Rationale 3섹션 완비) 모두 규약을 따른다. 단 spec `code:` frontmatter 에 이번 변경의 핵심 구현 파일(`form-mode.ts`, `types.ts`)이 미등재된 점이 단일 진실 원칙 측면의 사소한 gap 이다(INFO 등급). CRITICAL·WARNING 등급 위반은 없다.

---

## 위험도

LOW
