# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** 이전에 항상 `null` 을 반환해 죽어 있던 `system_error` 배너 APPEND 콜백이 이번 diff 로 라이브 프로덕션에서 처음 발동한다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:813`(`handleNodeCompleted` — `extractNodeErrorPayload(payload.output)`), `codebase/frontend/src/lib/websocket/use-execution-events.ts:909`(`handleNodeFailed` — `extractNodeErrorPayload(payload.output)`)
  - 상세: 종전엔 `handleNodeFailed` 가 `extractNodeErrorPayload(payload.error, undefined)` 를 호출해 `rawOutput` 이 항상 `undefined` 였고, `handleNodeCompleted` 는 `rawOutput.error` 한 겹만 봤다. 백엔드 emit 4곳 전수가 top-level `error` 를 문자열로, 구조화 객체는 `output.output.error`(래퍼 두 겹 아래)로 보내므로 두 경로 모두 `source` 가 항상 `null` 이었다. 이번 diff(`asRecord(rawOutput)?.output` → `asRecord(...)?.error` 2단 언래핑, 84-100행)가 두 호출부를 동시에 정정해, 조건을 만족하면 `useExecutionStore.getState().addConversationMessage(...)`(823-834행, 919-930행)가 실제로 실행되기 시작한다. `addConversationMessage` 자체(`execution-store.ts:844-847`)는 `set((state) => ({ conversationMessages: [...state.conversationMessages, item] }))` — 순수 불변 스프레드이며 네트워크·타이머·localStorage 등 부가 부작용은 없음을 직접 확인했다. 즉 "부작용"이 아니라 **의도된 기능 재활성화**이고, `CHANGELOG.md`(3-20행)와 `plan/in-progress/system-error-banner-live-ws.md`(18-19행)가 "회귀가 아니라 원래 의도된 동작의 복구"임을 명시적으로 기록해 관측 시 회귀 오인 위험을 낮췄다. 3라운드에 걸친 이전 side_effect 리뷰(01_26_11·01_44_22·02_02_18)도 동일 결론을 독립적으로 재확인했으며, 이번 라운드 소스 재검사(`Read`)로도 이 결론에 변화가 없음을 확인했다.
  - 제안: 조치 불필요 — 이미 CHANGELOG/plan 에 명시됨.

- **[INFO]** `extractNodeErrorPayload` 시그니처 축소(`(rawError, rawOutput)` → `(rawOutput)`) — 호출자 영향 없음 재확인
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:84`
  - 상세: `grep -n "extractNodeErrorPayload"` 로 확인한 결과 정의 1곳(84행) + 호출 2곳(813행, 909행)뿐이며 `export` 되지 않는 모듈 내부(비공개) 함수다. 두 호출부 모두 같은 diff 에서 `extractNodeErrorPayload(payload.output)` 로 동반 수정되어 시그니처 불일치·컴파일 에러·써드파티 호출자 파급 위험이 없다.
  - 제안: 없음(확인 기록).

- **[INFO]** `direct`(객체 형태 `rawError`) 분기 제거로 구조화 에러 인식 계약이 좁아졌다 — 현재는 무영향, 향후 유의 필요
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:84-100`(`extractNodeErrorPayload` 본문, 종전 `direct`/`nested` 분기가 지금은 없음)
  - 상세: 종전 함수는 `rawError` 가 객체로 오는 경우도 수용하는 방어적 분기를 가졌으나 이번 PR 이 그 분기와 파라미터를 제거해 `rawOutput.output.error` 단일 경로만 인식하도록 좁혔다. 현재 호출부 2곳은 문자열/undefined `error` 만 넘기므로 즉시 영향은 없다(예외도 throw 되지 않고 단순 status 갱신으로 조용히 저하). 백엔드 emit 4곳 전수 실측으로 이 경로가 현재 도달 불가능함이 `review/code/2026/08/28/01_26_11/RESOLUTION.md` W4 에 근거로 남아 있다.
  - 제안: 조치 불필요(근거 기록됨). 향후 백엔드가 객체 `error` 를 다시 보내는 버전이 혼재 배포되면 이 좁아진 계약이 배너를 조용히 억제한다는 점만 유념.

- **[INFO]** 신규 파일 생성 전부가 프로젝트 컨벤션에 따른 예상된 파일시스템 부작용
  - 위치: `plan/in-progress/system-error-banner-live-ws.md`(신규), `review/code/2026/08/28/{01_26_11,01_44_22,02_02_18}/**`(신규, 이전 3라운드 리뷰 산출물 커밋)
  - 상세: `plan/in-progress/**` 신규 생성은 `CLAUDE.md` "정보 저장 위치" 컨벤션에 부합한다. `review/code/**` 하위 세 라운드의 `RESOLUTION.md`/`SUMMARY.md`/개별 reviewer `.md`/`_retry_state.json`/`meta.json` 은 `/ai-review` 워크플로가 표준적으로 생성·커밋하는 산출물이며 애플리케이션 런타임에 영향을 주는 파일시스템 부작용이 아니다. `find`/`git status` 로 워크트리에 `.bak` 등 잔여 임시 파일이 없음을 직접 확인했다(02_02_18 RESOLUTION 이 언급한 리뷰어발 `.bak` 잔여물도 현재는 없음).
  - 제안: 없음.

## 검증된 안전 항목 (부작용 없음 확인)

- **전역 변수**: 새 전역 변수 도입 없음. `asRecord`(51-56행)는 순수 함수 — 인자 외 상태 참조/변경 없음.
- **상태 변경 경로**: 스토어 조작은 전부 기존 공식 Zustand 액션(`addConversationMessage`, `updateNodeStatus`, `addNodeResult`)을 통하며 직접 mutate 없음 — `execution-store.ts:844-847` 의 `set` 콜백이 불변 스프레드로 새 배열을 만듦을 소스에서 직접 확인.
- **환경 변수**: 읽기/쓰기 변경 없음.
- **네트워크 호출**: 없음. 이미 수신한 WS payload 를 파싱하는 로직 변경뿐, 신규 fetch/WS emit/API 호출 없음.
- **이벤트/콜백 등록 자체**: `handleNodeCompleted`/`handleNodeFailed` 의 `useCallback` 의존성 배열(`[updateNodeStatus, addNodeResult]`)은 diff 로 변경되지 않음 — WS 리스너 등록/해제 타이밍(`client.off`/`bind`, 1080-1081행·1154-1155행)에는 영향 없고, 콜백 **내부** 조건 충족 여부만 바뀐다.
- **테스트 파일 부작용**: 신규 `wrapNodeHandlerOutput` 헬퍼는 `describe` 블록 내부 지역 함수로 순수 객체 리터럴만 반환 — 모듈 스코프 오염·mock 잔류 없음.

## 요약

핵심 변경은 `extractNodeErrorPayload` 의 구조화 에러 언래핑 깊이를 `rawOutput.error`(1단계)에서 `rawOutput.output.error`(2단계)로 정정하고, `handleNodeFailed` 가 누락했던 `payload.output` 인자를 실제로 전달하도록 배선을 고친 것이다. 함수는 비공개·파일 내부 2개 호출부만 가지며 시그니처 축소(`rawError` 제거)도 두 호출부와 동반 수정돼 외부 파급이 없다. 유일한 실질적 "부작용"은 의도된 것이다 — 종전 결함으로 항상 `null` 을 반환해 죽어 있던 `addConversationMessage`(system_error 배너 APPEND) 경로가 라이브 WS 프로덕션에서 처음 실질 조건을 만족해 발동한다는 점이며, 이는 이 PR 의 명시적 목적과 정확히 일치하고 CHANGELOG·plan 문서에 "회귀 아님"으로 명시 기록돼 있다. `addConversationMessage` 자체는 순수 불변 Zustand 갱신이라 부가 부작용(네트워크·전역 변수·파일시스템·타이머)이 없음을 소스 레벨에서 직접 확인했다. `direct` 분기 제거로 구조화 에러 인식 계약이 다소 좁아졌으나 백엔드 emit 4곳 전수 실측으로 현재 도달 불가능함이 이전 라운드 RESOLUTION 에 근거와 함께 남아 있어 위험은 낮다. 전역 변수 신설, 상태 직접 mutation, 예상 밖 네트워크/환경변수/파일시스템 접근은 이번 라운드에도 발견되지 않았다. review/code/** 에 추가된 다수의 신규 파일(3라운드분 리뷰 산출물)은 코드가 아닌 문서이며 프로젝트 컨벤션상 정상 산출물이다.

## 위험도
LOW
