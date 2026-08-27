# 부작용(Side Effect) Review

## 대상
- `codebase/frontend/src/lib/websocket/use-execution-events.ts`
- `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
- `CHANGELOG.md`, `plan/in-progress/system-error-banner-live-ws.md` — 문서, 런타임 부작용 표면 없음
- `review/code/2026/08/28/{01_26_11,01_44_22,02_02_18,02_21_19,02_39_10}/*` — 이전 라운드 리뷰 산출물(정적 md/json), 런타임 부작용 표면 없음

이 diff 는 `origin/main` 대비 6개 커밋 누적분이며, 실제 런타임 부작용 표면을 가진 파일은
`use-execution-events.ts`(프로덕션 코드) 와 그 테스트 파일뿐이다. 나머지는 전부 `plan/`·
`review/` 문서 산출물(프로젝트 컨벤션상 정상 파일시스템 결과물)이다.

## 발견사항

- **[INFO]** 이전에 "죽어 있던" 콜백 경로가 프로덕션에서 처음으로 공유 상태를 변경하게 된다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` — `handleNodeCompleted` 내 `extractNodeErrorPayload(payload.output)` 호출(gate 813) 및 그 아래 `useExecutionStore.getState().addConversationMessage(...)` 호출(gate 823-834), `handleNodeFailed` 의 동일 패턴(gate 909, 919-930). 근본 원인은 `extractNodeErrorPayload` 본문(gate 84-100).
  - 상세: 종전 `extractNodeErrorPayload(rawError, rawOutput)` 는 top-level `error`(항상 문자열)를 객체로 파싱하려 하거나 `rawOutput.error`(래퍼 한 겹 얕음)만 봐서 라이브 WS 경로에서 항상 `null` 을 반환했다. 그 결과 두 핸들러 안의 `addConversationMessage`(Zustand 스토어 `conversationMessages` 배열에 `system_error` 아이템 append) 호출이 실제 조건을 만족한 적이 없었다. 이번 수정(`rawOutput.output.error` 로 언랩 + `handleNodeFailed` 가 `payload.output` 을 실제로 전달)으로 이 스토어 뮤테이션이 프로덕션에서 처음 실행 조건을 만족한다. `CHANGELOG.md`(gate 3-20 신규 항목)와 `plan/in-progress/system-error-banner-live-ws.md`(gate 18)에 "이 배포 이후 사용자가 배너를 처음 본다 — 회귀가 아니라 원래 의도된 복구"라고 명시돼 있어 **의도된 변경**이지만, "동일 이벤트 핸들러가 이전에 없던 공유 상태 변경을 새로 일으킨다"는 사실 자체는 배포/온콜 관측 시 참고할 부작용이다.
  - 제안: 코드 조치 불요 — CHANGELOG·plan 문서에 운영 영향이 이미 명시돼 있다. PR 본문에도 동일 문구가 반영되는지만 확인.

- **[INFO]** `extractNodeErrorPayload` 시그니처 축소(`rawError, rawOutput` 2-인자 → `rawOutput` 1-인자) — 비공개 함수, 호출부 전수 동반 수정으로 외부 영향 없음
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:84`(정의), 호출부 `:813`, `:909`
  - 상세: `export` 되지 않는 파일-스코프 함수이고, 저장소 전체(`grep -rn "extractNodeErrorPayload" codebase/frontend/src`)에서 정의 1곳 + 호출 2곳 외 참조가 없음을 직접 확인했다. 두 호출부 모두 같은 diff 에서 새 시그니처로 함께 수정되어 dangling 호출부가 없다. `useExecutionEvents` 훅의 공개 반환 타입(`UseExecutionEventsReturn { isConnected }`)은 변경되지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 이벤트 구독/해제 배선은 이번 diff 로 변경되지 않음
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` — `client.on("execution.node.completed", handleNodeCompleted)` / `client.on("execution.node.failed", handleNodeFailed)` (gate 1080-1081), 정리(cleanup) `client.off(...)` (gate 1154-1155), `useEffect` 의존성 배열(gate 1175-1176 부근)
  - 상세: 두 핸들러의 등록·해제 지점과 `useEffect` 의존성 배열은 diff 밖이다. 바뀐 것은 각 핸들러 **내부**에서 헬퍼로 넘기는 인자(`undefined` → `payload.output`)와 헬퍼 내부 로직뿐이며, 이벤트 구독 생명주기 자체는 그대로다.
  - 제안: 조치 불요(확인 목적 기록).

- **[INFO]** 신규 헬퍼 `asRecord` — 전역 상태 없는 순수 함수
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:51-56`
  - 상세: 인자를 검사·캐스팅만 하고 반환하며, 모듈 스코프의 mutable 변수·전역 변수를 도입하지 않는다. export 되지 않아(`grep` 결과 파일 내부 2회 호출뿐) 외부 파급도 없다.
  - 제안: 조치 불요.

- **[INFO]** 테스트 헬퍼 `wrapNodeHandlerOutput` — 호출마다 새 객체 리터럴 반환, 테스트 간 공유 mutable 참조 없음
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` — 정의(gate 1987-1992 부근), 15회 호출 지점
  - 상세: `{ output: domain, config: {}, meta: {} }` 를 매 호출 시 새로 생성한다. `useExecutionStore.getState()` 를 통한 스토어 직접 조작은 이 diff 이전부터의 기존 테스트 패턴(파일 상단 `beforeEach`)이며 이번 변경이 그 격리 방식을 바꾸지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 전역 변수·파일시스템·환경 변수·네트워크 호출 — 신규 도입 없음
  - 상세: `use-execution-events.ts`·테스트 파일 diff 전체에서 `process.env`, `fs.*`, `fetch`/`axios`/WS emit 신규 호출이 없다. `CHANGELOG.md`·`plan/in-progress/system-error-banner-live-ws.md`·이전 라운드 `review/code/2026/08/28/{01_26_11,01_44_22,02_02_18,02_21_19,02_39_10}/*` 는 전부 정적 마크다운/JSON 산출물로, 프로젝트 컨벤션(`CLAUDE.md` "정보 저장 위치")에 부합하는 예상된 파일시스템 결과물이지 애플리케이션 런타임에 영향을 주는 부작용이 아니다.
  - 제안: 조치 불요.

## 요약

핵심 변경은 파일-비공개 헬퍼 `extractNodeErrorPayload` 의 언랩 깊이 정정과 `handleNodeFailed` 의 인자 배선 교정이며, 둘 다 호출부 2곳이 같은 diff 에서 동반 수정돼 시그니처·인터페이스 파손이나 외부 파급이 없다(저장소 전수 grep 으로 확인). 이벤트 구독/해제 생명주기(`client.on`/`client.off`, `useEffect` 의존성)는 diff 밖이라 그대로다. 유일하게 주목할 부작용은 **의도된** 것 — 종전에 항상 `null` 로 죽어 있던 `addConversationMessage`(공유 Zustand 스토어에 `system_error` 아이템 append) 경로가 프로덕션에서 처음 실질 조건을 만족해 실행되며, 이는 이 PR 의 명시적 수정 목표이자 CHANGELOG/plan 문서에 운영 영향으로 이미 기록돼 있다. 전역 변수 도입, 직접적 상태 mutation(불변 갱신 원칙 위반), 예상 밖 파일시스템·네트워크·환경변수 접근, 공개 API 변경은 발견되지 않았다.

## 위험도
NONE
