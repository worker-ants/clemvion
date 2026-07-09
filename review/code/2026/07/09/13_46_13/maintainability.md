# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** 신규 `reentryWorkflowInput` 헬퍼가 삽입되면서 기존 `runNodeDispatchLoop` JSDoc 블록이 자신이 설명하는 함수와 분리됨(orphaned doc comment)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1417-1478` (실측 확인)
  - 상세: `runNodeDispatchLoop` 를 설명하는 40줄짜리 JSDoc(`@returns`/`@throws`/`@internal` 포함, 1417~1454행)이 원래는 바로 그 함수 선언 바로 위에 있었다. 이번 diff 는 그 JSDoc 닫는 `*/` (1454행) 바로 다음 줄에 새 `reentryWorkflowInput` 사설 메서드(자체 JSDoc 포함, 1455~1475행)를 삽입했고, `runNodeDispatchLoop` 의 실제 선언(`// C-1 step4` 주석 + `public async runNodeDispatchLoop`)은 그 뒤(1477~1478행)에야 나온다. 즉 코드 순서가 `[runNodeDispatchLoop 용 JSDoc] → [reentryWorkflowInput 용 JSDoc + 메서드] → [runNodeDispatchLoop 실제 선언]` 이 되어, JSDoc 주석과 그것이 설명하는 선언 사이에 다른 선언이 끼어 있다. TS/JSDoc 파서·에디터 hover·TypeDoc 등 "주석은 바로 다음에 오는 선언에 연결된다"는 규칙을 쓰는 도구들은 이제 이 40줄짜리 doc 을 `runNodeDispatchLoop` 이 아니라 `reentryWorkflowInput` 에 연결하거나(잘못된 문서 노출), `runNodeDispatchLoop` 에는 아무 doc 도 없는 것으로 처리할 수 있다. 향후 이 근처를 리팩터링하는 개발자가 "이 JSDoc 이 어느 함수 것인지" 를 오독하기 쉽다.
  - 제안: `reentryWorkflowInput` (및 그 JSDoc)을 `runNodeDispatchLoop` 의 JSDoc 보다 **앞**으로 옮기거나, `runNodeDispatchLoop` 본문이 끝난 **뒤**로 옮겨 원래 JSDoc이 자신의 대상 선언에 바로 인접하도록 되돌린다.

- **[INFO]** `trigger-configs.tsx` 의 JSX 블록 들여쓰기 불일치가 이번 diff 에도 그대로 남아 있음 (기존 리뷰에서 이미 지적·의도적 보류된 항목)
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:107-143` (실측 확인, 여전히 존재)
  - 상세: `parameters.map((p, i) => (...))` 암묵적 반환을 `{ const nameErr = ...; return (...); }` 블록 반환으로 바꾸면서, `name` `<Input>`/에러 `<span>` 까지는 12칸으로 늘었지만 그 아래 `<select>`/`<label>`/`{p.required !== true && (...)}`/description `<Input>`/닫는 `</div>` 는 이전 10칸 들여쓰기에 그대로 남아 같은 반환 블록 안에서 들여쓰기 레벨이 두 갈래로 섞여 있다. `npx eslint`(prettier/prettier 규칙 포함) 는 통과함을 재확인했으므로 CI 를 막지는 않으나, 파일을 읽을 때 중첩 구조 파악이 눈으로는 어렵다. 직전 리뷰 라운드(`review/code/2026/07/09/11_08_21/maintainability.md`, `RESOLUTION.md` W9)에서 동일 지점이 이미 지적됐고 "프로젝트 lint(eslint)가 raw prettier --check 보다 권위 있다"는 근거로 의도적으로 보류된 항목이라 이번엔 재차단 사유로 올리지 않는다 — 다만 실제 코드 가독성은 여전히 개선 여지가 있어 기록만 남긴다.
  - 제안: 에디터 재포맷(`eslint --fix`)으로 들여쓰기를 12칸으로 통일. 기능·CI 영향은 없으므로 우선순위는 낮음.

- **[INFO]** 이전 라운드 WARNING 들이 이번 diff 로 적절히 해소됨 (참고, 액션 불필요)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2092`, `:2433-2434`, `:3214-3216`, `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:565-572`
  - 상세: 직전 라운드(`11_08_21/maintainability.md`)가 지적한 "재진입 durable input 로직이 3곳에 각기 다른 언어·분량의 주석으로 중복"·"4번째 구조적 동일 지점(retry-turn.service.ts)만 동기화 안 됨" 문제는 `reentryWorkflowInput` 사설 메서드로 규칙을 한 곳에 모으고, 3개 호출부는 `// workflowInput 규칙은 reentryWorkflowInput 참조.` 로 통일(모두 한국어로 언어 일관성도 회복)했으며, `retry-turn.service.ts` 는 "왜 이 지점만 helper 를 안 쓰는지"를 명시적으로 교차 참조하는 주석을 추가했다. 의도는 잘 달성됐고 회귀 위험이 낮아졌다. (위 첫 WARNING 은 이 리팩터 자체가 아니라 그 삽입 *위치*에 대한 것이다.)

## 요약

이번 diff 의 핵심 로직(엔진 재진입 durable input, `type` 기반 트리거 조회, 저장 시점 스키마 검증, 프론트 인라인 이름 검증)은 네이밍이 명확하고 함수 길이·중첩·매직넘버 측면에서 특별한 문제가 없으며, 직전 리뷰 라운드가 지적한 "3곳 중복 로직·언어 불일치·4번째 지점 미동기화" WARNING 은 `reentryWorkflowInput` 헬퍼 추출과 교차 참조 주석으로 잘 해소됐다. 다만 그 추출 과정에서 기존 `runNodeDispatchLoop` 의 대형 JSDoc 블록과 실제 함수 선언 사이에 새 메서드가 끼어들어가 doc-주석과 대상 선언의 인접성이 깨졌다(도구/가독성 문제, 기능 영향 없음). `trigger-configs.tsx` 의 JSX 들여쓰기 혼재는 이미 알려진·의도적으로 보류된 사안으로 이번 리뷰에서 새로 차단할 사유는 아니다.

## 위험도

LOW
