# Documentation Review

## 발견사항

### **[INFO]** `classifyError` JSDoc — `@param isolate` 태그 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` — `classifyError` 함수 JSDoc (라인 약 1395~1406)
- 상세: 함수가 `export` 되었고 두 번째 파라미터 `isolate?: ivm.Isolate`가 추가됐으나, JSDoc에 `@param isolate` 태그가 없다. 분류 우선순위(1/2/3) 설명은 본문에 잘 있으나, 파라미터의 역할(optional — used for priority-2 isDisposed check)을 공식 `@param` 태그로 명시하면 IDE hover 문서로도 노출된다.
- 제안: JSDoc에 `@param err` / `@param [isolate]` 태그를 추가하고 각각의 역할을 한 줄로 기술.

### **[INFO]** `syntaxCheck` JSDoc — `@param wrappedCode` 태그 누락
- 위치: 동일 파일 — `syntaxCheck` 함수 JSDoc
- 상세: `@returns` 태그는 추가됐으나 `@param wrappedCode` 태그가 없다. 함수가 `wrapUserCode(code)` 결과를 받는다는 사실(이미 래핑된 코드여야 함)이 문서화되어 있지 않다.
- 제안: `@param wrappedCode` — "User code already wrapped by `wrapUserCode()`." 한 줄 추가.

### **[INFO]** `LEGACY_TO_NORMALIZED` 상수 — 선언 위치가 사용 위치보다 아래
- 위치: 동일 파일 — `LEGACY_TO_NORMALIZED` 상수는 `class CodeHandler` 하단(라인 약 1389), `failure()` 메서드 내 사용(라인 약 1354)보다 뒤에 선언됨
- 상세: JavaScript/TypeScript에서 `const`는 호이스팅되지 않아 런타임 오류는 없지만(모듈 스코프 TDZ는 파일 파싱 후), 코드를 위에서 아래로 읽는 독자가 `LEGACY_TO_NORMALIZED`를 참조하는 `failure()` 코드를 먼저 보고 정의를 나중에 발견하게 된다. 인라인 주석 `W8: LEGACY_TO_NORMALIZED table replaces the triple-ternary chain`이 있으나 정의로의 이동이 직관적이지 않다.
- 제안: `LEGACY_TO_NORMALIZED`와 관련 정규식 상수들을 `class CodeHandler` 선언 앞으로 이동하거나, 현재 위치에 "defined below the class" 주석을 추가.

### **[INFO]** `ISOLATE_MEMORY_LIMIT_MB` JSDoc — W15 항목이 spec 참조만 있고 환경변수명 불일치 가능성 미언급
- 위치: 동일 파일 — `ISOLATE_MEMORY_LIMIT_MB` JSDoc
- 상세: W15 주석에서 `CODE_NODE_MEMORY_LIMIT_MB` env var 이름을 제안하고 있으나, 이것이 아직 구현되지 않은 미래 계획임을 명시하는 것이 좋다. 현재 문구 "Can be extracted to `CODE_NODE_MEMORY_LIMIT_MB` env var if runtime tuning is needed"는 이미 구현된 것처럼 읽힐 여지가 있다.
- 제안: "Not yet implemented — currently hardcoded." 또는 "TODO(W15):" 접두어 추가.

### **[INFO]** 테스트 파일 — "spoofing prevention" 케이스 설명 주석이 기댓값과 부분 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.spec.ts` — `classifyError (unit)` describe 내 두 번째 테스트 (라인 약 71~84)
- 상세: 테스트 이름은 "should NOT classify user-thrown 'Isolate was disposed' as memory when isolate is alive"이나, 테스트 본문 주석에서 "Falls through to message regex — still classifies as MEMORY"라고 결국 `EXECUTION_MEMORY_EXCEEDED`를 반환한다고 설명하고 있다. 따라서 테스트 이름이 "NOT classify … as memory"라고 쓰여 있지만 실제로는 memory로 분류된다. 테스트가 검증하는 핵심은 "priority-2(isDisposed flag)가 아닌 priority-3(regex)로 분류된다"인데 이름만으로는 그 의도가 명확하지 않다.
- 제안: 테스트 이름을 "should fall through to regex (priority 3) when isolate is alive — priority-2 isDisposed branch not triggered"처럼 실제 검증 의도를 명확히 반영하도록 변경. 현재 이름은 결과(`EXECUTION_MEMORY_EXCEEDED`로 분류됨)를 부정하는 것처럼 읽힌다.

### **[INFO]** spec 파일 — 에러 코드 정규화 매핑 표와 본문 설명 간 `EXECUTION_MEMORY_EXCEEDED` 언급 일관성 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/spec/4-nodes/5-data/2-code.md` — §5.3 공통 필드 표 아래 "에러 코드 정규화 매핑" 박스 (라인 약 2553~2560)
- 상세: spec diff에서 `output.error.code` 표에 `CODE_MEMORY_LIMIT` 추가와 `legacyCode` 표에 `EXECUTION_MEMORY_EXCEEDED` 추가가 이루어졌고, §5.3.3 예시 JSON도 추가됐다. 내용 자체는 일관적이다. 다만 §7.2 리소스 제한 표에서 "초과 시 isolate 가 실행을 중단하고 `CODE_MEMORY_LIMIT` 로 `error` 포트 분기"라는 설명이 이미 있으며 신규 분류 우선순위(isDisposed flag) 로직에 대한 설명이 spec에 없다.
- 제안: §7.2 또는 §5.3.3 아래에 "분류 방식: `isolate.isDisposed` 플래그(priority 2) → 메시지 regex(priority 3) 순서로 판단" 한 줄 추가. 구현 세부사항이지만 장애 분석 시 참조 가치가 있다.

### **[INFO]** `backend-labels.ts` — `ERROR_KO` 신규 항목 주석에 메모리 한도 값 하드코딩
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/frontend/src/lib/i18n/backend-labels.ts` — `CODE_MEMORY_LIMIT` 한국어 메시지 (라인 약 2044~2045)
- 상세: `"코드 실행 중 메모리 한도(128MB)를 초과했어요."`에 128MB 수치가 하드코딩됐다. `ISOLATE_MEMORY_LIMIT_MB` 상수를 변경할 경우 이 메시지도 수동으로 같이 업데이트해야 하며, 두 곳의 동기화 의존성이 문서화되지 않았다.
- 제안: 주석에 `// NOTE: Keep in sync with ISOLATE_MEMORY_LIMIT_MB in code.handler.ts when the limit changes.` 추가.

### **[INFO]** `wrapUserCode` JSDoc — 라인 오프셋 정보의 정확성 확인 필요
- 위치: 동일 핸들러 파일 — `wrapUserCode` JSDoc W14 주석
- 상세: "wrapper prepends a 4-line header"라고 명시되어 있는데 실제 래퍼를 보면 `(async () => {` / `"use strict";` / `const __user = async () => {` / `<user code>` / `};` / `const __result = await __user();` / `return __result === undefined ? undefined : JSON.stringify(__result);` / `})()` 구조다. 사용자 코드 앞에 오는 줄은 3줄(`(async () => {`, `"use strict";`, `const __user = async () => {`)이므로 오프셋은 +3일 수 있다. "4-line header" 수치가 실제 구조와 맞는지 재확인이 필요하다.
- 제안: 실제 래퍼 구조를 카운트하여 주석의 "+4" 수치를 검증하고 필요 시 수정.

---

## 요약

이번 변경은 `classifyError` 함수의 `export` 노출·파라미터 확장, `syntaxCheck`의 JSDoc 추가, `BOOTSTRAP_SOURCE`·`wrapUserCode`에 실행 순서·라인 오프셋 경고 주석 추가, `LEGACY_TO_NORMALIZED` 리팩터링, spec 문서의 에러 코드 표·차단 API 목록 갱신, i18n 파일의 code 노드 에러 코드 번역 추가로 구성된다. 전반적으로 인라인 주석이 풍부하고 spec 문서와 구현 간 동기화가 잘 이루어졌다. 주요 문서화 개선 포인트는 `classifyError`·`syntaxCheck`의 `@param` 태그 미완성, 테스트 이름의 의미 모호성(spoofing prevention 케이스), i18n 문자열 내 하드코딩된 메모리 수치의 동기화 의존성 미주석, `wrapUserCode` 라인 오프셋 수치 정합성이며 모두 INFO 수준으로 기능에는 영향이 없다.

## 위험도

LOW
