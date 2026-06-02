# 문서화(Documentation) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** `interpolate` 함수 export 시 JSDoc 없음
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/core.ts` — `export function interpolate`
  - 상세: `interpolate`가 내부 private 함수에서 `export`로 승격되었으나, 함수 자체에 JSDoc 문서가 없다. `translate` 함수에는 위에 JSDoc이 있는데 `interpolate`는 없다. 패키지 외부에서 직접 호출하는 함수가 되었으므로 동작·인자·`{{name}}` 문법·params 누락 시 동작(개발 모드 `console.warn`, 빈 문자열 반환)을 설명하는 JSDoc이 필요하다.
  - 제안: `interpolate` 위에 JSDoc 추가. 최소 `@param template`, `@param params`, `@returns`, `@example` 태그 포함.

### 발견사항 2
- **[INFO]** `translateBackendError` JSDoc이 함수 시그니처와 일부 불일치
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/backend-labels.ts` — `translateBackendError` JSDoc
  - 상세: JSDoc 본문에 "ko 로케일에서 `ERROR_KO[code]` 템플릿에 `params` 를 `{{name}}` 보간" 이라고 설명하지만, 실제로 `params`가 `undefined`여도 `interpolate`가 template 그대로 반환하는 graceful 동작이 문서화되어 있지 않다. 또한 `fallback` 파라미터가 어떤 타입인지(`string`) JSDoc에 명시되지 않았다.
  - 제안: `@param` 태그를 각 인자마다 추가하고, `params` 없을 때의 동작 명시.

### 발견사항 3
- **[INFO]** `validation-errors.en.mdx` 에 frontmatter 없음
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/05-run-and-debug/validation-errors.en.mdx`
  - 상세: 한국어 버전(`validation-errors.mdx`)에는 `title`, `title_en`, `section`, `order`, `summary`, `summary_en`, `spec`, `code` 등 전체 frontmatter가 있으나, 영문 버전(`.en.mdx`)에는 frontmatter가 전혀 없다. 프로젝트의 다른 영문 MDX 파일이 frontmatter 없이 본문만 담는 패턴인지 확인이 필요하지만, 만약 도구나 빌드 시스템이 `.en.mdx`의 frontmatter를 읽는다면 누락이 된다.
  - 제안: 프로젝트의 다른 `.en.mdx` 파일 패턴을 확인하여, 필요 시 최소 frontmatter(`title`, `section`, `order`) 추가.

### 발견사항 4
- **[INFO]** `validation-errors.en.mdx` 의 ASCII 다이어그램에 이모지 사용
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/05-run-and-debug/validation-errors.en.mdx` line 12, `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/05-run-and-debug/validation-errors.mdx` line 30
  - 상세: `└── Parallel   ← level 3 (save blocked ❌)` 와 `└── Parallel  ← 3단계 (저장 차단 ❌)` 에서 ❌ 이모지가 사용된다. 이것이 정책상 문제인지는 맥락에 따라 다르지만, 문서 내 이모지 사용이 일관되게 허용되는지 확인이 필요하다. 다른 가이드 파일이 이모지를 사용하지 않는 경우 불일치가 된다.
  - 제안: 프로젝트 문서 스타일 가이드와 일관성 확인. 불일치 시 ❌를 텍스트("blocked")로 대체.

### 발견사항 5
- **[INFO]** `editor-store.ts` 인터페이스의 `params` 필드에 JSDoc 위치가 인라인 주석
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/stores/editor-store.ts` — `EditorState.graphWarnings.results` 항목
  - 상세: `params?` 필드에 `// i18n Principle 3-C: ...` 인라인 주석이 사용되었다. TypeScript 인터페이스/타입에서는 `/** ... */` JSDoc 주석이 IDE 툴팁·타입 문서화에 더 적합하다. 동일 파일 내 `GraphWarningRuleResult` 타입(`types.ts`)에서는 `/** 영문 SoT / fallback... */` JSDoc 패턴이 사용되는데 스타일이 불일치한다.
  - 제안: `// i18n Principle 3-C: ...` 를 `/** 동적 메시지 보간 값. translateGraphWarning 에서 ko 템플릿 보간에 사용. */` 형태 JSDoc으로 교체.

### 발견사항 6
- **[INFO]** `no-internal-refs.test.ts` 파일 상단 주석에 `GRAPH_WARNING_KO` 추가 누락
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts` lines 1977-1978
  - 상세: 파일 상단 주석(lines 1977-1978)에는 금지 항목 목록이 서술되어 있는데 `"Internal i18n mapping table names (ERROR_KO / WARNING_KO / LABEL_KO / HINT_KO / GROUP_KO / ITEM_LABEL_KO / OPTION_LABEL_KO)"` 라고 되어 있고 새로 추가된 `GRAPH_WARNING_KO`가 이 설명 목록에 빠져 있다. 실제 정규식(`FORBIDDEN` 배열)에는 추가되었지만 사람이 읽는 코드 상단 설명에는 반영되지 않았다.
  - 제안: line 1977 주석에 `GRAPH_WARNING_KO`를 목록에 추가하여 코드와 주석 일치 유지.

### 발견사항 7
- **[INFO]** `validation-errors.mdx` 영문 `summary_en` 과 `.en.mdx` 본문의 첫 문장이 미묘하게 다름
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/05-run-and-debug/validation-errors.mdx` frontmatter `summary_en` vs `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/05-run-and-debug/validation-errors.en.mdx` 첫 줄
  - 상세: `summary_en: "When the canvas save is rejected or a warning badge appears — covering Parallel nesting rules and how to fix them."` 이지만 `.en.mdx` 첫 문장은 `"This page covers when a canvas save is rejected or a warning badge appears — and how to fix it."` 으로 미묘하게 다르다. 콘텐츠 자체로는 문제없으나, summary와 본문 첫 줄이 의도적으로 다른지 실수인지 명확하지 않다.
  - 제안: 의도적 차이라면 그대로 두고, 동일 표현을 원한다면 통일.

### 발견사항 8
- **[INFO]** `plan/in-progress/backend-msg-i18n-impl.md` frontmatter `worktree` 값이 "(미정)"으로 남아 있음
  - 위치: `/Volumes/project/private/clemvion/plan/in-progress/backend-msg-i18n-impl.md` frontmatter
  - 상세: `worktree: (미정 — 구현 착수 시 생성)` 으로 남아 있는데, 실제로 이 변경은 `parallel-p2-w1w2` 워크트리에서 진행되고 있다. plan 라이프사이클 문서에 따르면 `worktree` frontmatter에 실제 워크트리 이름을 명시해야 한다.
  - 제안: `worktree: parallel-p2-w1w2` 로 업데이트.

## 요약

전체적으로 이 변경은 문서화가 잘 되어 있다. `types.ts`의 `GraphWarningRule.evaluate` 반환 타입과 `GraphWarningRuleResult`에 JSDoc이 신규 추가되었고, `backend-labels.ts`의 `ERROR_KO`·`GRAPH_WARNING_KO`·`translateBackendError`·`translateGraphWarning` 모두 JSDoc이 충실하다. 사용자 가이드 MDX 2종(ko/en)이 신규 추가되어 end-user facing 문서화도 완료되었으며, plan 문서도 각 Phase 완료 상태가 체계적으로 기록되어 있다. 발견된 항목들은 모두 INFO 수준으로, 주요 문서화 갭은 없다: (1) 새로 public으로 승격된 `interpolate` 함수 JSDoc 누락, (2) `no-internal-refs.test.ts` 상단 주석에 `GRAPH_WARNING_KO` 열거 누락, (3) plan frontmatter의 `worktree` 미정 상태, (4) `editor-store.ts` 인터페이스 필드의 `//` vs `/** */` 스타일 불일치가 경미한 개선 여지로 남아 있다.

## 위험도

NONE
