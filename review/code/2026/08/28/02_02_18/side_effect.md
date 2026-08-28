# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** 죽어 있던 콜백 경로(`system_error` 배너 APPEND)가 이번 diff 로 라이브 프로덕션에서 처음 발동한다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:813`(`handleNodeCompleted` — `extractNodeErrorPayload(payload.output)`), `codebase/frontend/src/lib/websocket/use-execution-events.ts:909`(`handleNodeFailed` — `extractNodeErrorPayload(payload.output)`)
  - 상세: 종전에는 `handleNodeFailed` 가 `extractNodeErrorPayload(payload.error, undefined)` 를 호출해 `rawOutput` 이 항상 `undefined` 였고, `handleNodeCompleted` 는 `rawOutput.error`(1단계)만 봤다. 둘 다 실제 emit shape(문자열 `error` + `output.output.error`)과 맞지 않아 `source` 가 항상 `null` 이었고, 두 호출부 모두에서 `useExecutionStore.getState().addConversationMessage(...)`(gate 821-833, 917-929)가 한 번도 실행되지 않았다. 이번 diff 로 두 콜사이트가 함께 정정되어(`asRecord(rawOutput)?.output` → `asRecord(...)?.error`, 2단 언래핑) 조건을 만족하면 `addConversationMessage` 가 실제로 실행되기 시작한다. `addConversationMessage` 자체는 `execution-store.ts:844-847` 의 `set((state) => ({ conversationMessages: [...state.conversationMessages, item] }))` — 순수 불변 갱신이며 네트워크·로컬스토리지·타이머 등 부가 부작용은 없음을 직접 확인했다. 즉 "부작용"은 코드 결함 자체가 아니라 **의도된 기능 활성화**이며, CHANGELOG(`CHANGELOG.md:3-20`)와 plan 문서(`plan/in-progress/system-error-banner-live-ws.md:18-19`)가 "회귀가 아니라 원래 의도된 동작의 복구"임을 명시적으로 기록해 관측 시 회귀 오인 위험을 낮췄다.
  - 제안: 조치 불필요 — 이미 CHANGELOG/plan 에 명시됨. 배포 후 모니터링에서 `system_error` 배너 노출 건수가 갑자기 나타나도 회귀로 오판하지 않도록 온콜 공유 권장(선택).

- **[INFO]** `extractNodeErrorPayload` 시그니처 축소 — 호출자 영향 없음 확인
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:84`(`function extractNodeErrorPayload(rawOutput: unknown): {...`)
  - 상세: 시그니처가 `(rawError: unknown, rawOutput: unknown)` → `(rawOutput: unknown)` 로 축소됐다. `grep -rn "extractNodeErrorPayload" codebase/frontend/src/` 로 확인한 결과 정의 1곳 + 호출 2곳(`:813`, `:909`) 뿐이며 export 되지 않는 모듈 내부 함수다. 두 호출부 모두 같은 diff 에서 동반 수정되어(`extractNodeErrorPayload(payload.output)`) 시그니처 불일치나 컴파일 에러 위험은 없다.
  - 제안: 없음(확인 기록).

- **[INFO]** `direct` 분기(객체 형태 `rawError` 직접 파싱) 제거 — 계약이 좁아졌다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` `extractNodeErrorPayload` 함수 본문(gate 84-100, 특히 종전 `direct`/`nested` 분기가 있던 자리 — 현재는 gate 89-90 `asRecord(rawOutput)?.output` 2단 언래핑만 남음)
  - 상세: 종전 함수는 `rawError` 가 객체 형태로 오는 경우까지 수용하는 방어적 분기(`direct`)를 갖고 있었다. 이번 diff 는 그 분기와 파라미터 자체를 제거해, 구조화 에러를 오직 `rawOutput.output.error` 한 경로로만 인식하도록 계약을 좁혔다. 현재 파일 내 호출부 2곳은 모두 문자열/undefined `error` 를 넘기므로 즉시 영향은 없지만, 향후 다른 코드 경로(예: 테스트 헬퍼가 아닌 실제 legacy 백엔드 버전 혼재 환경 등)가 객체 `error` 를 계속 보낼 경우 — 이전에는 배너가 뜨고 지금은 조용히 안 뜬다(에러 자체는 throw 되지 않고 단순 status 갱신만 발생, 예외 없음). RESOLUTION.md(`review/code/2026/08/28/01_26_11/RESOLUTION.md` W4)에 emit 4곳 전수 실측으로 이 경로가 도달 불가능함이 근거로 남아 있어 현재로선 실질 위험은 낮다.
  - 제안: 조치 불필요(이미 RESOLUTION 에 실측 근거 기록됨). 향후 백엔드가 다시 객체 `error` 를 보내는 버전이 혼재 배포되는 상황이 생기면 이 좁아진 계약이 배너를 조용히 억제한다는 점만 유념.

- **[INFO]** 신규 파일 생성은 전부 프로젝트 컨벤션에 따른 예상된 파일시스템 부작용
  - 위치: `plan/in-progress/system-error-banner-live-ws.md`(신규), `review/code/2026/08/28/01_26_11/**`·`review/code/2026/08/28/01_44_22/**`(신규, 이전 두 라운드 리뷰 산출물 커밋)
  - 상세: `plan/in-progress/**` 신규 생성은 `CLAUDE.md` "정보 저장 위치" 컨벤션에 따른 정상 산출물. `review/code/**` 하위 두 라운드(`01_26_11`, `01_44_22`)의 `RESOLUTION.md`/`SUMMARY.md`/개별 reviewer `.md`/`_retry_state.json`/`meta.json` 은 `/ai-review` 워크플로가 표준적으로 생성하는 산출물이며, 애플리케이션 런타임에 영향을 주는 파일시스템 부작용이 아니다.
  - 제안: 없음.

## 검증된 안전 항목 (부작용 없음 확인)

- **전역 변수**: 새 전역 변수 도입 없음. `asRecord`(gate 51-56)는 순수 함수 — 인자 외 상태 참조/변경 없음.
- **상태 변경 경로**: 스토어 조작은 전부 기존 공식 Zustand 액션(`addConversationMessage`, `updateNodeStatus`, `addNodeResult`)을 통하며 직접 mutate 없음 — `execution-store.ts:844-847` 의 `set` 콜백이 불변 스프레드로 새 배열을 만듦을 직접 확인.
- **환경 변수**: 읽기/쓰기 변경 없음.
- **네트워크 호출**: 없음. 이번 diff 는 이미 수신한 WS payload 를 파싱하는 로직 변경뿐, 신규 fetch/WS emit/API 호출 없음.
- **이벤트/콜백 등록 자체**: `useCallback` 의존성 배열(`[updateNodeStatus, addNodeResult]`)은 diff 로 변경되지 않음 — WS 이벤트 리스너 등록/해제 타이밍(구독 lifecycle)에는 영향 없고, 콜백 **내부 로직**의 조건 충족 여부만 바뀜.
- **테스트 파일 부작용**: 신규 `wrapNodeHandlerOutput` 헬퍼(테스트 파일 내부, gate 1987-1991)는 `describe` 블록 내부 지역 함수로 순수 객체 리터럴만 반환 — 모듈 스코프 오염이나 mock 잔류 없음. `git diff --stat HEAD`(현재 커밋 상태 기준 클린) 확인 결과 이번 세션에 소스 대상 파일 자체의 미커밋 변경은 없음(3개 커밋으로 이미 반영됨: `9869afd5c`, `6e35a30a6`, `00d7c8584`).

## 요약

핵심 변경은 `extractNodeErrorPayload` 의 구조화 에러 언래핑 깊이를 `rawOutput.error`(1단계)에서 `rawOutput.output.error`(2단계)로 정정하고, `handleNodeFailed` 가 누락했던 `payload.output` 인자를 실제로 전달하도록 배선을 고친 것이다. 함수는 비공개·파일 내부 2개 호출부만 가지며 시그니처 축소(`rawError` 제거)도 두 호출부와 동반 수정돼 외부 파급이 없다. 유일하게 실질적인 "부작용"은 의도된 것 — 종전 결함으로 항상 `null` 을 반환해 죽어 있던 `addConversationMessage`(system_error 배너 APPEND) 경로가 라이브 WS 프로덕션에서 처음 실질 조건을 만족해 발동한다는 점이며, 이는 이 PR 의 명시적 목적과 정확히 일치하고 CHANGELOG·plan 문서에 "회귀 아님"으로 명시 기록되어 있다. `addConversationMessage` 자체는 순수 불변 Zustand 갱신이라 부가 부작용(네트워크·전역 변수·파일시스템·타이머)이 없음을 직접 확인했다. `direct` 분기 제거로 구조화 에러 인식 계약이 다소 좁아졌으나(객체 형태 `error` 를 더 이상 파싱하지 않음), 백엔드 emit 4곳 전수 실측으로 현재 도달 불가능함이 이전 라운드 RESOLUTION 에 근거와 함께 남아 있어 위험은 낮다. 전역 변수 신설, 상태 직접 mutation, 예상 밖 네트워크/환경변수/파일시스템 접근은 발견되지 않았다.

## 위험도
LOW
