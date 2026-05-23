# 보안(Security) 리뷰 — render-form-options-and-state-fix

## 발견사항

### **[INFO]** `allowedMimeTypes` 클라이언트 가드는 명세에 있으나 현재 PR 구현에서는 누락
- 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `case "file":` 블록
- 상세: spec §1.5 는 파일 선택 시 `allowedMimeTypes` / `maxFileSize` / `maxTotalSize` / `maxFiles` 에 대한 클라이언트 사이드 실시간 검증(reject)을 명문화하고 있다. 그러나 현재 PR 에서 추가된 `case "file":` 구현은 `accept` HTML attribute 설정과 `multiple` flag 만 처리하고, 초과 파일 크기·MIME 불일치·개수 초과에 대한 명시적 reject 로직이 없다. `accept` attribute 는 브라우저별로 우회 가능하므로 클라이언트 레벨 방어가 spec 약속 대비 불완전하다.
- 제안: 파일 선택 `onChange` 핸들러 안에서 `fileList` 를 순회하며 `allowedMimeTypes`, `maxFileSize`, `maxTotalSize`, `maxFiles` 를 검증하고 조건 위반 시 `onChange([])` 로 reject 하거나 사용자에게 오류 메시지를 표시하도록 구현을 추가한다. 단, 서버 측에서도 동일 검증이 이루어지고 있다면 클라이언트 가드는 UX 보조 수단으로서 보안 임팩트는 제한적이다.

### **[INFO]** 파일 메타데이터의 `name` 필드가 서버에서 별도 새니타이징 없이 LLM 에 전달될 수 있음
- 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` `toFileMetadata()` 함수
- 상세: `file.name` 은 사용자가 임의로 지정한 파일명이다. 파일명에 특수 문자, 경로 구분자(`../`), 마크업 유사 문자(`<script>` 등) 가 포함될 수 있다. 현재 구현은 `file.name` 을 그대로 메타데이터 객체에 담아 `onSubmit` 콜백으로 전달하며, 이 데이터는 최종적으로 LLM tool_result 에 포함된다. LLM prompt injection 관점에서 악의적으로 조작된 파일명이 LLM 의 응답 흐름에 영향을 줄 수 있는 경로가 된다. LLM 의 신뢰 경계 내에서 이를 어떻게 처리하는지 별도 가드가 필요하다.
- 제안: 서버 측(`render-tool-provider` 또는 `form_submitted` 처리 레이어)에서 파일명 등 사용자 제공 문자열을 LLM tool_result 에 포함할 때 길이 제한 및 제어 문자 제거를 적용하는 것을 검토한다. 프론트엔드에서도 `file.name` 을 전달 전에 255자 이내로 truncate 하는 방어를 추가할 수 있다.

### **[INFO]** `backfillFormOptionValues` 에서 LLM 이 emit 한 비-string 타입 값이 그대로 보존됨 (number, boolean, object)
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` `backfillFormOptionValues()` 함수 (라인 379–388)
- 상세: 코드에서 `v === undefined || v === null || (typeof v === 'string' && v.length === 0)` 조건만 backfill 트리거로 삼고, number / boolean / object 타입 값은 그대로 통과시킨다. 이는 spec §10.5 step 4 의 의도된 설계(frontend 에서 `String(value) === String(opt.value)` coerce 로 처리)이지만, LLM 이 `object` 타입 값을 emit 하는 경우 DOM `value` attribute 는 `[object Object]` 로 변환되어 예측 불가능한 동작을 유발할 수 있다. 이는 기능적 이슈이자 부분적으로 데이터 무결성 이슈다.
- 제안: object 타입 option value 에 대해 추가 가드(예: `typeof v === 'object'` 인 경우도 backfill 처리)를 검토하거나, 최소한 테스트 케이스에서 object 타입 emit 케이스를 명시적으로 다루어 예상 동작을 문서화한다.

### **[INFO]** `fieldInputId` 에서 `field.name` 을 DOM id 에 직접 사용
- 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` `fieldInputId()` 함수
- 상세: `dyn-form-${field.name || "field"}-${idx}` 패턴으로 DOM id 를 생성한다. `field.name` 은 LLM 이 emit 한 값으로, 특수 문자나 CSS selector 에 유효하지 않은 문자가 포함될 경우 `document.getElementById()` 등의 DOM 조회 및 CSS 적용에 이상이 생길 수 있다. 직접적인 보안 취약점은 아니나 LLM 제어 문자열이 DOM 속성에 반영되는 경로임을 인지해야 한다.
- 제안: `field.name` 을 DOM id 에 사용할 때 영숫자와 `-`, `_` 만 허용하는 가벼운 새니타이징(`replace(/[^a-zA-Z0-9_-]/g, '_')`)을 적용한다.

### **[INFO]** 하드코딩된 시크릿 없음, 인증/인가 로직 변경 없음, 암호화 관련 변경 없음
- 위치: 변경된 모든 파일
- 상세: 이번 PR 의 변경은 form option value backfill 로직, DynamicFormUI state 안정화, file 타입 UI 구현에 집중되어 있다. API 키 / 비밀번호 / 토큰 등 하드코딩된 시크릿이 존재하지 않으며, 인증·인가 로직, 세션 관리, 암호화 알고리즘 변경이 없어 해당 영역의 취약점은 이번 변경에 도입되지 않았다.

### **[INFO]** SQL 인젝션 / 커맨드 인젝션 / 경로 탐색 취약점 없음
- 위치: 변경된 모든 파일
- 상세: 변경 범위가 프런트엔드 React 컴포넌트와 백엔드 in-memory 데이터 변환 helper 로 한정되어 있다. 데이터베이스 쿼리, 시스템 명령 실행, 파일시스템 경로 조작이 포함되지 않아 해당 인젝션 카테고리의 취약점은 없다.

### **[INFO]** 에러 처리에서 민감 정보 노출 없음
- 위치: `backfillFormOptionValues`, `renderField`, `DynamicFormUI`
- 상세: 에러 핸들링 경로에서 스택 트레이스나 내부 구조 정보가 사용자에게 노출되는 패턴이 없다. 예외 발생 시 상위 레이어가 처리하는 구조다.

---

## 요약

이번 변경은 LLM 이 emit 한 form option value 충돌 버그 수정과 DynamicFormUI 상태 안정화를 목적으로 하며, 보안 관점에서 치명적인 취약점은 발견되지 않았다. 주요 관찰 사항은 세 가지다. 첫째, spec §1.5 가 요구하는 파일 MIME 타입·크기·개수 클라이언트 검증이 현재 구현에서 누락되어 있어 spec 이행이 불완전하다(보안보다는 기능적 gap). 둘째, 사용자 제공 파일명이 새니타이징 없이 LLM tool_result 경로에 포함될 수 있어 LLM prompt injection 의 잠재적 매개체가 된다. 셋째, LLM emit 값이 DOM id 에 직접 반영되는 패턴이 있어 가벼운 입력 가드를 권장한다. 전체적으로 인증·인가·암호화·인젝션 등 주요 OWASP 카테고리에서 신규 취약점이 도입되지 않았으며, 변경된 로직의 side-effect 범위가 명확히 제한되어 있다.

## 위험도

LOW
