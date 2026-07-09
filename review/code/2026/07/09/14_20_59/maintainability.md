# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** JSX 자식 요소 들여쓰기가 부모 레벨과 동일하게 깨져 있음 (리팩터링 시 일부만 재정렬됨)
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:107-143` (`<select>` ~ `</div>`)
  - 상세: 이번 변경이 `parameters.map((p, i) => { ... return (...) })` 로 화살표 함수 바디를 감싸면서 `<div key={i}>` 의 직계 자식들 들여쓰기를 한 단계 늘렸다. `<div className="flex items-center justify-between">`, name `<Input>`, 신규 `{nameErr && ...}` 블록까지는 부모(`<div key={i}>`, 10칸) 대비 12칸으로 정확히 재정렬됐지만, 그 아래 `<select>`(107행), `<label>`(120행), `{p.required !== true && (...)}`(129행), description `<Input>`(137행)은 여전히 10칸으로 남아 있다. 즉 `<div key={i}>` 의 형제처럼 보이는 들여쓰기가 되어, 실제 JSX 트리 구조(모두 `<div key={i}>` 의 자식)와 코드가 눈으로 표현하는 구조가 어긋난다. 실측 결과 렌더링 자체는 정상이고(JSX 공백은 트리에 영향 없음) 이 리포의 eslint 설정(`eslint-config-next`, prettier 플러그인 미포함)도 이를 잡아내지 못해(로컬 `npx eslint` 통과 확인) 리뷰/diff 를 통해서만 드러난다. 향후 이 블록을 다시 편집하는 사람이 실제 중첩 깊이를 착각하기 쉽다.
  - 제안: `<select>` 부터 닫는 `</div>` 까지를 12칸(자식 레벨)으로 재정렬. 가능하면 `npx prettier --write`(파일 전체 reflow 는 지양— 기존 메모대로 CLI prettier 는 이 프로젝트 eslint prettier 설정과 불일치할 수 있음) 대신 에디터의 "reindent selection" 또는 수동 정렬로 이 블록만 교정.

- **[WARNING]** `saveCanvas`/`validateManualTrigger` 에 위치 기반 boolean 매개변수(`skipParamSchemaValidation`) 추가 — "boolean trap"
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:386-395`(`saveCanvas` 시그니처), `472-479`(`restoreVersion` 호출부 `/* skipParamSchemaValidation */ true`), `586-611`(`validateManualTrigger` 시그니처)
  - 상세: `saveCanvas(id, workspaceId, userId, dto, skipParamSchemaValidation = false)` 형태로 5번째 위치 인자에 boolean 하나를 추가했다. 호출부(`restoreVersion`)에서 인라인 주석(`/* skipParamSchemaValidation */ true`)으로 의미를 보완했지만, 이는 타입 시스템이 아닌 주석에 의존하는 완화책이라 다음 boolean 플래그가 하나 더 필요해지는 순간(예: 다른 예외 케이스) `saveCanvas(id, ws, uid, dto, true, false)` 식으로 순서를 외워야 하는 조합이 시작된다. `validateManualTrigger` 도 동일 패턴을 반복해 이중으로 boolean 을 전파한다.
  - 제안: `saveCanvas(id, workspaceId, userId, dto, opts?: { skipParamSchemaValidation?: boolean })` 처럼 옵션 객체로 바꾸면 호출부에서 이름이 강제로 드러나고(`{ skipParamSchemaValidation: true }`) 향후 플래그 추가도 순서 걱정 없이 확장 가능하다. 현재 호출부가 1곳뿐이라 비용은 낮다.

- **[WARNING]** 파라미터 이름 식별자 정규식이 프론트/백엔드에 중복 정의되고, 백엔드 쪽은 이름 있는 상수조차 아님
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:15` (`const PARAM_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;`) vs `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:77` (동일 리터럴이 `if (... !/^[A-Za-z_][A-Za-z0-9_]*$/.test(def.name)) ...` 조건문 안에 인라인)
  - 상세: 동일한 비즈니스 규칙(식별자 형식)이 두 레이어에 독립적으로 하드코딩되어 있다. 프론트 쪽은 그나마 이름 붙은 상수 + "Mirror of the backend identifier rule" 주석으로 드리프트 위험을 스스로 명시했지만, 백엔드 쪽은 상수화조차 안 돼 있어 검색으로 "이 정규식이 어디서 쓰이는지" 찾기 더 어렵다. 이 모노레포는 `@workflow/graph-warning-rules` 처럼 프론트/백엔드가 동일 규칙을 공유하는 패키지 선례가 있어, 이번 방식은 그 컨벤션에서 벗어난다.
  - 제안: 최소 조치로 백엔드 쪽 정규식을 `resolve-trigger-parameters.ts` 상단에 이름 있는 상수(`PARAM_NAME_PATTERN` 등)로 승격하고 export, 프론트는 (신설이 부담되면) 해당 상수를 참조하도록 문서화. 이상적으로는 `packages/` 공유 패키지로 이전.

- **[INFO]** `validateManualTrigger` 내부에 두 가지 다른 에러 응답 스타일이 공존
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:593-601`(plain-string `BadRequestException`, 기존 코드) vs `615-621`(신규 `BadRequestException({ code, message, details })`)
  - 상세: 같은 메서드 안에서 트리거 존재/중복 검사는 문자열 하나만 던지는 레거시 스타일을, 새로 추가된 파라미터 스키마 검증은 `{code, message, details}` 구조화 스타일을 쓴다. 기존 두 줄은 이번 diff 의 수정 대상이 아니라 그대로 둔 것이 합리적이지만, 한 함수 내 스타일 혼재가 다음 유지보수자에게 "이 함수의 에러 컨벤션이 무엇인지" 헷갈리게 할 수 있다.
  - 제안: 즉시 조치 불요(스코프 밖). 이 메서드를 다시 손댈 기회가 있으면 기존 두 throw 도 `{code, message}` 구조로 통일 검토.

- **[INFO]** e2e 테스트의 `poll()` 헬퍼가 공유되지 않고 파일마다 재정의됨(이번 신규 파일도 동일 패턴 답습)
  - 위치: `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts:54-69`
  - 상세: 동일한 상태-폴링 로직이 `workflow-execution.e2e-spec.ts`, `execution-park-resume.e2e-spec.ts` 등 기존 10개 e2e 파일에 이미 각자 복제돼 있고, `test/helpers/` 에는 공유 버전이 없다. 이번 신규 파일도 그 기존(비최적) 컨벤션을 그대로 따른 것이라 이번 diff 가 새로 만든 문제는 아니다.
  - 제안: 이번 PR 스코프에서 조치 불요. 후속으로 `test/helpers/execution.ts` 같은 공유 폴링 헬퍼 추출을 백로그로 고려.

## 요약

핵심 버그 수정 로직(엔진 재진입 durable input을 `reentryWorkflowInput` 헬퍼 하나로 추출해 3개 호출부 중복을 제거, `loadTriggerParameterSchema` 의 조회 키 교체)은 네이밍이 명확하고 기존 코드베이스의 장문 주석 컨벤션과도 일관되어 가독성이 좋다. 반면 방어적으로 추가된 hardening 계층에서는 몇 가지 유지보수성 부채가 보인다: `trigger-configs.tsx` 리팩터링 과정에서 JSX 자식 블록 절반의 들여쓰기가 재정렬되지 않아 구조를 눈으로 오독하기 쉽고(lint 로도 안 잡힘), `saveCanvas`/`validateManualTrigger` 에 위치 기반 boolean 플래그가 추가돼 향후 확장 시 조합 폭발 위험이 있으며, 파라미터 이름 식별자 정규식이 프론트/백엔드에 중복(백엔드는 상수화조차 안 됨)돼 두 레이어가 조용히 어긋날 여지를 남겼다. 모두 기능 결함은 아니며 개별적으로는 사소하지만, 세 건이 겹치면 다음 변경 시 인지 비용을 높인다.

## 위험도

LOW
