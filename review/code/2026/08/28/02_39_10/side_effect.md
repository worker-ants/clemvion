# 부작용(Side Effect) 코드 리뷰

## 대상
- `codebase/frontend/src/lib/websocket/use-execution-events.ts`
- `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
- `CHANGELOG.md`, `plan/in-progress/system-error-banner-live-ws.md` (문서, 부작용 표면 없음)
- `review/code/2026/08/28/{01_26_11,01_44_22,02_02_18,02_21_19}/*` (이전 라운드 리뷰 산출물, 정적 문서·JSON — 부작용 표면 없음)

### 발견사항

- **[INFO]** 이번 diff 의 본질이 "죽어 있던 부수효과 경로를 되살리는 것" — production 에서 `addConversationMessage` 호출 빈도가 처음으로 0→N 이 된다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:813`, `:909` (두 호출부의 `useExecutionStore.getState().addConversationMessage(makeSystemErrorItem(...))` 호출), 근본 원인 `:84-97`(`extractNodeErrorPayload`)
  - 상세: `extractNodeErrorPayload` 가 이전에는 top-level `error`(문자열)와 `rawOutput`(한 겹 얕은 접근) 어느 경로로도 구조화 에러를 못 찾아 항상 `null` 을 반환했다. 그 결과 `handleNodeCompleted`/`handleNodeFailed` 안의 `addConversationMessage` 호출(공유 Zustand 스토어 `useExecutionStore` 뮤테이션)이 라이브 WS 경로에서 한 번도 실행되지 않았다. 이번 수정으로 이 콜백이 실제 조건 충족 시 처음으로 실행되며, 대화 스레드에 `system_error` 아이템이 append 된다. 이는 CHANGELOG(`## Unreleased — system_error 재시도 배너가...`)와 plan 문서에 "회귀가 아니라 원래 의도된 동작의 복구"로 명시적으로 기록되어 있어 **의도된 변경**이지만, 부작용 관점에서는 "동일 이벤트 핸들러가 이제 이전에 없던 공유 상태 변경(대화 히스토리 append)을 일으킨다"는 사실 자체는 운영 관측 대상으로 남는다.
  - 제안: 이미 CHANGELOG/plan 에 운영 영향이 명시되어 있으므로 추가 조치 불요. 배포 후 모니터링 시 이 배너의 신규 노출을 "새 결함"으로 오인하지 않도록 릴리즈 노트 전파만 확인.

- **[INFO]** `extractNodeErrorPayload` 시그니처 변경 (`rawError, rawOutput` 2-인자 → `rawOutput` 1-인자) — 영향 범위 확인
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:84` (정의), 호출부 `:813`, `:909`
  - 상세: 함수가 파일 스코프 `function`(비-`export`)이라 모듈 경계 밖 호출자가 없다. 저장소 전체에서 `grep -rn "extractNodeErrorPayload" codebase/` 결과 정의 1곳 + 호출 2곳(둘 다 이번 diff 에서 새 시그니처로 동반 수정됨) 외에는 참조가 없음을 확인했다. 공개 API·다른 모듈에 대한 영향 없음.
  - 제안: 조치 불요 — 시그니처 축소가 호출자 전수(2곳)와 함께 원자적으로 반영됨.

- **[INFO]** 신규 헬퍼 `asRecord` — 전역 상태 없는 순수 함수, 부작용 없음
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:52-56`
  - 상세: 입력을 검사만 하고 캐스팅해 반환하는 순수 함수. 전역 변수 도입·모듈 레벨 mutable state 없음.

- **[INFO]** 테스트의 신규 헬퍼 `wrapNodeHandlerOutput` — 호출마다 새 객체 리터럴을 반환, 테스트 간 공유 mutable 참조 없음
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:1987-1992`
  - 상세: `{ output: domain, config: {}, meta: {} }` 를 매 호출 시 새로 생성해 반환한다(`grep` 결과 8개 `it` 블록에서 개별 호출). 테스트 간 상태 오염(shared reference mutation) 위험 없음. `useExecutionStore` 자체에 대한 `getState().startExecution`/`setConversationMessages` 직접 뮤테이션은 이 diff 이전부터 있던 기존 테스트 패턴(파일 상단 `beforeEach`, line 96)이며 이번 변경이 그 격리 방식을 바꾸지 않았다.

- **[INFO]** 전역 변수·파일시스템·환경 변수·네트워크 호출 — 해당 변경 없음
  - 상세: diff 전체(`use-execution-events.ts`, 테스트 파일)에서 `process.env`, `fs.*`, `fetch`/`axios` 등 신규 I/O 호출이 없다. `CHANGELOG.md`·`plan/in-progress/system-error-banner-live-ws.md`·이전 라운드 `review/code/2026/08/28/{01_26_11,01_44_22,02_02_18,02_21_19}/*` 는 모두 정적 마크다운/JSON 산출물로 런타임 부작용 표면이 없다.

### 요약
이번 diff 의 핵심은 "죽어 있던 `addConversationMessage` 부작용 경로를 되살리는 것" 자체가 목적이며, 그 변화는 CHANGELOG·plan 문서에 명시적으로 기록되어 있어 의도치 않은 부작용이 아니다. `extractNodeErrorPayload` 의 시그니처 축소는 모듈 비공개 함수이고 호출부 2곳이 동일 diff 에서 동반 수정되어 외부 영향이 없음을 저장소 전수 grep 으로 확인했다. 신규 헬퍼(`asRecord`, `wrapNodeHandlerOutput`)는 순수 함수/팩토리로 전역 상태·공유 참조를 만들지 않는다. 전역 변수, 파일시스템, 환경 변수, 네트워크 호출, 공개 인터페이스 변경은 발견되지 않았다.

### 위험도
NONE
