# 유지보수성(Maintainability) 리뷰 — `system-error-banner` (5라운드, `02_39_10`)

## 스코프 메모

이 diff 는 이미 `/ai-review` 4라운드(`01_26_11` → `01_44_22` → `02_02_18` → `02_21_19`)를
거쳤고, 매 라운드 유지보수성 관점 CRITICAL 0 · WARNING 은 전부 반영이 기록돼 있다(`02_21_19`
maintainability 는 이미 RISK=NONE). 이번 라운드에서 `codebase/` 아래 실제로 바뀐 파일은
`__tests__/use-execution-events.test.ts` 뿐이다 — `use-execution-events.ts` 는
`6e35a30a6`(1라운드 fix) 이후 무변경(`git log` 확인), `CHANGELOG.md`/`plan/*.md` 도 이전
라운드와 동일. 신규 diff 는 직전 라운드(`02_21_19`) 가 스스로 지목한 testing W1/INFO7/INFO8
을 반영한 가드 테스트 4건 추가뿐이다. `review/code/2026/08/28/{01_26_11,01_44_22,02_02_18,
02_21_19}/*`(harness 가 생성한 prose 리포트·상태 JSON)는 코드 품질 지표 적용 대상이 아니므로
이전 라운드와 동일 기준으로 이번에도 제외한다.

## 재확인 결과 (직접 소스 대조)

- `handleNodeCompleted`(`use-execution-events.ts:760-839`, errorPayload 블록 `:807-813`)와
  `handleNodeFailed`(`:841-935`, errorPayload 블록 `:904-909`) — 이전 라운드가 기록한 위치와
  정확히 일치, `extractNodeErrorPayload(payload.output)` 호출도 두 곳 모두 정상.
- `asRecord(asRecord(domain)?.error)` 이중 언래핑은 그대로 `:90` 에 위치, JSDoc(`:58-83`)이
  여전히 인접해 보완한다.
- 테스트 파일의 `wrapNodeHandlerOutput()` 빌더(`:1987-1991`)는 이번에 추가된 4개 신규 테스트
  (`:2241, :2260, :2293(배열 케이스는 미사용), :2315`) 중 3곳에서도 그대로 재사용된다 — 손복제
  없음.

## 발견사항

- **[INFO]** 새로 추가된 두 "가드" 테스트(`||` 좌항/우항 분리)가 실행 준비·단언 6줄을
  거의 그대로 반복한다
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2241-2258`
    (`message` 만 없음) vs `:2260-2277` (`code` 만 없음)
  - 상세: 두 `it` 블록은 `startExecution`/`seedConversation`/`bindNodeHandlers` 준비와
    `expect(items).toHaveLength(3)` / `expect(...every(...)).toBe(true)` 단언이 완전히
    동일하고, 차이는 `wrapNodeHandlerOutput({ error: {...} })` 안에 `code` 를 빼느냐
    `message` 를 빼느냐 한 줄뿐이다. `||` 연산자의 좌/우항을 각각 가르기 위한 의도된
    구조(이 파일이 이미 여러 곳에서 쓰는 뮤테이션-주도 테스트 관례)라 읽기에 어려움은
    없지만, 두 케이스뿐이라도 `it.each`로 표현하면 "무엇이 고정이고 무엇이 변수인지"가
    한 눈에 더 드러난다.
  - 제안: 우선순위 낮음(현재도 각 테스트 제목과 JSDoc 이 의도를 명확히 서술함). 세 번째
    유사 조합이 추가될 경우 `it.each([["message", {...}], ["code", {...}]])` 형태로
    파라미터화를 고려.

- **[INFO]** (기존 유예 재확인) `handleNodeCompleted`/`handleNodeFailed` 의 errorPayload
  추출 → `retryable`/`retryAfterSec` 계산 → `addConversationMessage` 블록이 ~20줄 거의
  동일하게 중복
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:807-835`
    (`handleNodeCompleted`) vs `:904-931` (`handleNodeFailed`)
  - 상세: diff 이전부터 있던 중복이며 4라운드 연속 defer — 두 핸들러가 `duration`/`status`
    처리 등 인접 블록에서 서로 다른 로직을 갖고 있어(`:760-806` vs `:874-902`) 추출 시 그
    차이가 흐려질 위험이 근거로 유지된다. 신규 diff 가 이 블록을 다시 건드리지 않아 격상
    사유 없음.
  - 제안: 현 판정 유지. 세 번째 호출부가 생기면 `appendSystemErrorIfMultiTurn(errorPayload,
    { nodeId, nodeLabel, nodeExecutionId, timestamp })` 류 헬퍼 추출 재검토.

- **[INFO]** (기존 유예 재확인) `asRecord(asRecord(domain)?.error)` 이중 언래핑 밀도
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:90`
  - 상세: 4라운드 연속 동일 사유(JSDoc 26줄이 shape 을 이미 설명, 중간 변수 도입 이득
    미미)로 유예. 이번 diff 는 이 라인을 건드리지 않음.
  - 제안: 현 판정 유지.

- **[INFO]** (기존 유예 재확인) `payload.output` 필드 타입 표기가 두 핸들러에서 다름
  (`Record<string, unknown>` vs `unknown`)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:769`
    (`handleNodeCompleted`), `:869` (`handleNodeFailed`)
  - 상세: `extractNodeErrorPayload` 시그니처가 `unknown` 하나로 통일돼 실질 동작 차이는
    없음. 공유 `NodeHandlerOutput` 타입 부재가 근본 원인이나 이 PR 과 직교한 별건으로
    4라운드 연속 defer.
  - 제안: 현 판정 유지. 공유 타입 도입 시(테스트의 `wrapNodeHandlerOutput` 반환 타입 포함)
    함께 정리.

## 신규 결함 없음

이번 라운드가 추가한 4개 테스트(`message`/`code` 개별 가드 2건, 배열 `output` 케이스,
`completed` 대칭 케이스)는 전부 네이밍(`[가드]` 접두, 목적이 제목에 드러남)과 JSDoc(자기
한계까지 명시 — 예: "이 테스트는 `!Array.isArray(v)` 항을 가르지 못한다"는 정직한 고지)이
이 파일의 기존 컨벤션과 일관되고, 함수 길이·중첩 깊이·매직 넘버 문제는 없다.

## 요약

프로덕션 코드(`use-execution-events.ts`)는 1라운드 이후 무변경이며, 4라운드에 걸쳐
지적된 유지보수성 결함(JSDoc-함수 분리, 자매 주석 낙후, fixture 5곳 손복제, `direct`
분기 커버리지 0)은 전부 해소가 재확인됐다. 이번 라운드 diff 는 테스트 파일에 뮤테이션
가드 4건을 추가하는 것뿐이며, 기존 `wrapNodeHandlerOutput` 빌더를 그대로 재사용해 새로운
중복을 심지 않았다. 유일한 경미한 지적은 신규 `||` 좌/우항 가드 테스트 2건의 준비/단언
보일러플레이트 반복(6줄)으로, 파라미터화하면 소폭 개선되지만 현재도 가독성엔 문제가 없어
우선순위는 낮다. 남은 세 INFO(핸들러 간 ~20줄 중복·이중 언래핑 밀도·`output` 타입 표기
불일치)는 4라운드 연속 동일 사유로 유예 유지가 타당하며, 신규 diff 가 그 코드를 건드리지
않아 격상 근거가 없다.

## 위험도
NONE
