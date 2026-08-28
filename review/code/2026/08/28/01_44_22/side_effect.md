# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** 종전에 항상 `null` 을 반환해 죽어있던 `system_error` 배너 APPEND 콜백이 프로덕션에서 처음 실질적으로 발동한다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` — `handleNodeCompleted` 내 `const errorPayload = extractNodeErrorPayload(payload.output);` 호출부(함수 `handleNodeCompleted`), `handleNodeFailed` 내 동일 패턴 호출부(함수 `handleNodeFailed`)
  - 상세: `extractNodeErrorPayload` 의 unwrap 깊이가 `rawOutput.error`(1단계)에서 `rawOutput.output.error`(2단계, `asRecord` 경유)로 바뀌었고, `handleNodeFailed` 가 이전에 넘기던 `undefined` 대신 `payload.output` 을 실제로 전달하도록 배선이 고쳐졌다. 그 결과 `useExecutionStore.getState().addConversationMessage(makeSystemErrorItem(...))` (대화창에 system_error 아이템을 append, 곧 UI 배너)가 두 호출부 모두에서 **처음으로 실제 조건을 만족해 실행**된다. PR 의 명시적 목적(CRITICAL `12_24_55` 수정)과 일치하는 의도된 활성화이지만, "이전에 한 번도 실행되지 않던 이벤트 콜백이 이 배포부터 실행된다"는 것은 side-effect 관점에서 인지해 둘 가치가 있다 — 배포 후 관측되는 신규 배너가 회귀로 오인되지 않도록.
  - 제안: 코드 조치 불요. PR 설명/배포 노트에 "이 변경으로 system_error 배너가 라이브 WS 경로에서 처음 노출된다" 를 명시(RESOLUTION.md INFO 1 에 이미 언급됨).

- **[INFO]** `extractNodeErrorPayload` 시그니처 축소(`(rawError, rawOutput)` → `(rawOutput)`) — 비공개 함수·호출부 2곳뿐, 외부 파급 없음 확인
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` 함수 `extractNodeErrorPayload` 정의부, 호출부는 `handleNodeCompleted`·`handleNodeFailed` 두 곳
  - 상세: `grep -rn "extractNodeErrorPayload" codebase/`로 직접 확인 — export 되지 않고 같은 파일의 두 콜백에서만 호출된다. 두 호출부 모두 이번 diff 에서 함께 갱신됐다. 시그니처가 좁아지면서 객체 형태 top-level `error`(`direct` 분기)를 다루는 경로가 함께 삭제됐는데, 이는 `handleNodeFailed` 상단의 `errorMessage` 추출 로직(`typeof payload.error === "string" ? ... : payload.error?.message`, status 갱신용)과는 별개 경로이므로 `updateNodeStatus`/`addNodeResult` 에 실리는 `error` 필드 처리에는 영향이 없다 — 오직 `system_error` 배너용 구조화 에러 추출 경로만 좁아졌다.
  - 제안: 없음(확인 목적 기록). 도달 가능성·커버리지 판단은 testing/maintainability 리뷰 영역.

- **[INFO]** 신규 파일 생성은 전부 프로젝트 컨벤션에 따른 예상된 산출물
  - 위치: `plan/in-progress/system-error-banner-live-ws.md`(신규 plan), `review/code/2026/08/28/01_26_11/*`(전날 `/ai-review` 세션 산출물 — RESOLUTION.md, SUMMARY.md, `_retry_state.json`, meta.json, 개별 reviewer `.md` 7종)
  - 상세: `codebase/` 밖의 `plan/in-progress/**`, `review/code/**` 신규 파일은 CLAUDE.md 의 "정보 저장 위치" 규약이 명시한 정상 산출물이며 애플리케이션 런타임에 영향을 주는 파일시스템 부작용이 아니다. 코드 자체(`use-execution-events.ts`, 테스트 파일)에는 파일 I/O 관련 변경이 없다.
  - 제안: 없음.

## 검증된 안전 항목

- **전역 변수**: 신규 전역 변수 도입 없음. `asRecord` 는 모듈 스코프 순수 함수(인자 외 상태 참조/변경 없음), export 되지 않음(`grep -n "^export"` 확인 결과 이 파일의 유일한 export 는 `useExecutionEvents` 훅이며 이번 diff 로 그 시그니처(`UseExecutionEventsOptions`/`UseExecutionEventsReturn`)는 변경되지 않았다).
- **상태 변경 경로**: `addConversationMessage`(`execution-store.ts`)는 `set((state) => ({ conversationMessages: [...state.conversationMessages, item] }))` 형태의 불변 갱신이며, 이번 diff 는 그 호출 여부/인자만 바꿨을 뿐 store 액션 자체는 건드리지 않는다. 직접 mutation 없음.
- **useCallback 의존성 배열**: `handleNodeCompleted`/`handleNodeFailed` 의 deps(`[updateNodeStatus, addNodeResult]`)는 이번 diff 로 변경되지 않았다. `extractNodeErrorPayload`/`asRecord`/`isMultiTurnAiContext`/`makeSystemErrorItem` 은 전부 모듈 스코프 순수 함수(props/state 클로저 아님)라 deps 누락에 의한 stale-closure 위험 없음.
- **네트워크 호출**: 없음 — 이미 수신한 WS payload 를 파싱하는 순수 로직 변경뿐, 신규 fetch/WS emit 없음.
- **환경 변수**: 읽기/쓰기 변경 없음.
- **테스트 파일 부작용**: 신규 헬퍼 `wrapNodeHandlerOutput(domain)` 은 호출마다 `{ output: domain, config: {}, meta: {} }` 새 객체 리터럴을 반환한다 — 5개 테스트 간 공유 mutable 참조 없음(각 `{}` 가 매 호출 독립). 테스트 격리 위험 없음.

## 요약

핵심 변경은 파일 내부 비공개 헬퍼(`extractNodeErrorPayload`)의 unwrap 깊이 교정과 그 호출 인자 배선(`undefined` → `payload.output`) 교정으로, 호출부가 파일 내부 2곳뿐이고 이번 diff 에서 함께 갱신되어 시그니처 축소로 인한 외부 파급은 없다(export 없음, grep 으로 재확인). 유일하게 주목할 부작용은 의도된 것 — 종전에 항상 `null` 로 죽어있던 `addConversationMessage`(system_error 배너 APPEND) 콜백 경로가 프로덕션에서 처음으로 실질 조건을 만족해 실행되게 된다는 점이며, 이는 PR 의 명시적 수정 목표(CRITICAL `12_24_55`)와 정확히 일치한다. 상태 변경은 여전히 기존 Zustand 액션을 통한 불변 갱신만 사용하고, 전역 변수 도입·직접 state mutation·예상 밖 파일시스템/네트워크/환경변수 접근은 발견되지 않았다. `plan/`·`review/` 신규 파일은 프로젝트 컨벤션상 정상 산출물이다.

## 위험도

LOW
