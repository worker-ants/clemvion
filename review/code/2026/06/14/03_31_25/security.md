# Security Review

## 발견사항

### **[INFO]** 클라이언트 사이드 JSON 검증만 존재 (서버 신뢰 보장 없음)
- **위치**: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `handleRunWithInput`, `jsonError` useMemo (라인 1551-1560, 1652)
- **상세**: `jsonInput`에 대한 유효성 검증(`JSON.parse` 기반)이 클라이언트 UI에서만 수행된다. Submit 버튼을 `jsonError != null`일 때 disabled 처리하는 것은 브라우저 UI 보호이며, 악의적 사용자가 DevTools로 직접 API를 호출하거나 disabled 상태를 우회하면 임의 JSON을 서버에 전달할 수 있다. 단, 이는 프론트엔드 컴포넌트 레벨의 관찰이며 실제 서버 측 검증 여부는 이번 diff 범위 밖(`executionsApi`, 백엔드)이다.
- **제안**: 서버 측에서도 `input` payload의 타입/크기/스키마를 검증하고 있는지 확인. 클라이언트 검증은 UX 목적으로 유지하되 security boundary로 의존해서는 안 됨.

---

### **[INFO]** `console.error`로 내부 에러 정보 브라우저 콘솔 노출
- **위치**: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `handleLoadFromHistory` (라인 1583), `handleRun` (라인 1643), `handleRunWithInput` (라인 1670), `handleRunFromSelected` (라인 1690), `handleStop` (라인 1703), `handleExport` (라인 1726), `handleDelete` (라인 1742)
- **상세**: 모든 catch 블록에서 `console.error(..., error)` 로 원본 에러 객체(스택 트레이스, API 에러 메시지, 내부 URL 등 포함 가능)를 콘솔에 출력한다. 프로덕션 환경에서 브라우저 콘솔을 통해 공격자가 내부 시스템 정보를 추론할 수 있는 경로다. 단, 사용자에게 노출되는 토스트·알럿 메시지는 별도의 i18n 문자열로 제한되어 있어 UI단 노출은 없다.
- **제안**: 프로덕션 빌드에서 `console.error`를 제거하거나 Sentry 등 서버 사이드 에러 트래킹으로 대체. 최소한 `error.message`가 아닌 구조화된 로그 레벨을 통해 민감 정보 필터링.

---

### **[INFO]** 히스토리 실행 입력 데이터 직접 textarea 적재 — XSS 위험 없음 (확인)
- **위치**: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `handleLoadFromHistory` (라인 1580)
- **상세**: `detail.inputData`를 `JSON.stringify(..., null, 2)`로 직렬화하여 `setJsonInput`에 설정한다. 이 값은 React controlled `<textarea>`의 `value`로 바인딩되므로 HTML로 파싱되지 않아 XSS 경로가 없다. 서버에서 반환된 데이터가 그대로 텍스트로 렌더된다는 점에서 안전하다.
- **제안**: 현재 패턴은 안전함. 향후 `dangerouslySetInnerHTML`이나 `innerHTML`을 사용하는 컴포넌트로 이 데이터가 전달되지 않도록 주의.

---

### **[INFO]** `t(\`executions.triggerSource.${ex.triggerSource}\`)` — 동적 i18n 키 (서버 데이터로부터)
- **위치**: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 라인 2027
- **상세**: `ex.triggerSource`는 서버 API에서 받은 값으로 동적으로 i18n 키를 생성한다. i18n 함수가 키를 찾지 못하면 일반적으로 키 문자열 자체를 표시하므로, 서버가 예상치 못한 `triggerSource` 값을 반환할 경우 원시 API 값이 UI에 노출된다. XSS는 아니지만 정보 노출 및 예상치 못한 텍스트 렌더링 가능성이 있다.
- **제안**: 알려진 `triggerSource` 값의 화이트리스트 검증 또는 fallback 처리를 추가. 예: `t(\`executions.triggerSource.${ex.triggerSource}\`) ?? t("executions.triggerSource.unknown")`.

---

### **[INFO]** Escape 키 핸들러 DOM 탐색 — `document.activeElement` 직접 접근
- **위치**: `codebase/frontend/src/components/editor/workflow-editor.tsx` — `handleKeyDown` (라인 2359-2368)
- **상세**: `document.activeElement`를 캐스팅하여 `.closest("[data-run-results-drawer]")`로 DOM을 탐색한다. `data-*` 속성은 보안 경계가 아니며 공격자가 임의 엘리먼트에 동일 속성을 추가하여 포커스 동작을 조작할 수 있다. 단, 이 기능은 UI 보조 동작(포커스 복귀)이므로 실제 보안 영향은 미미하다.
- **제안**: 현재 사용 맥락에서 보안 위험은 낮음. 단, `data-*` 속성을 보안 경계 판단에 사용하지 않는 패턴을 유지할 것.

---

### **[INFO]** `workflowId`의 `as string` 강제 타입 캐스팅
- **위치**: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `historyQuery` queryFn (라인 1567), `run-results-drawer.tsx` 라인 2027
- **상세**: `workflowId as string`으로 null 가능성을 타입 시스템에서 억제한다. `enabled: !!workflowId` guard가 있어 실제 실행 시점에서는 안전하지만, 향후 리팩터링 시 enabled guard 제거 시 null이 API 호출에 전달될 수 있다.
- **제안**: 타입 단언 대신 `workflowId!` (non-null assertion)를 사용하거나, queryFn 내부에서 명시적 guard를 추가.

---

## 요약

이번 변경의 핵심은 프론트엔드 에디터 툴바에 "실행 히스토리 로드" 기능과 JSON 입력 실시간 검증, Escape/Ctrl+Shift+R 키보드 단축키 지원을 추가한 것이다. 보안 관점에서 하드코딩된 시크릿, SQL 인젝션, 커맨드 인젝션, CSRF, 인증 우회 등 OWASP Top 10 주요 취약점은 발견되지 않았다. 모든 API 호출은 기존 인증된 `executionsApi`/`workflowsApi` 클라이언트를 재사용하며, 사용자 입력은 React controlled 컴포넌트를 통해 텍스트로만 처리되어 XSS 경로가 없다. 서버에서 반환된 `triggerSource` 값으로 동적 i18n 키를 구성하는 패턴과 클라이언트 사이드 JSON 검증만 존재한다는 점이 가장 주의할 관찰 사항이나, 두 경우 모두 서버 측 검증을 신뢰 기반으로 두는 일반적 아키텍처를 전제하면 낮은 위험도다.

## 위험도

LOW

STATUS: SUCCESS
