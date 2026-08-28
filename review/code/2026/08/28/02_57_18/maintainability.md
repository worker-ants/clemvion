# 유지보수성(Maintainability) 리뷰 — `system-error-banner` (6라운드, `02_57_18`)

## 스코프 메모

이 diff 는 이미 `/ai-review` 5라운드(`01_26_11` → `01_44_22` → `02_02_18` → `02_21_19` →
`02_39_10`)를 거쳤고, 매 라운드 유지보수성 관점 CRITICAL 0 · WARNING 은 전부 반영이
기록돼 있다(`02_39_10` 시점 이미 RISK=NONE, 7명 중 6명 NONE). `git show efc04a194 --stat` 로
직전 라운드(`02_39_10`) 이후 실제 코드 변경분을 확인한 결과, `codebase/` 아래 유일한 변경은
`__tests__/use-execution-events.test.ts` 에 테스트 3건(+80줄)이 추가된 것뿐이다 —
`use-execution-events.ts` 는 1라운드(`6e35a30a6`) 이후 무변경(`git log -p` 확인). 나머지는
`plan/*.md` 체크리스트 갱신과 `review/code/2026/08/28/{01_26_11..02_39_10}/*`(harness 산출
prose 리포트) 신규 추가이며, 후자는 이전 라운드와 동일 기준으로 코드 품질 지표 적용 대상이
아니므로 제외한다.

## 재확인 결과 (직접 소스 대조)

- `extractNodeErrorPayload`(`use-execution-events.ts:84-100`, `asRecord` 헬퍼 `:52-56`,
  JSDoc `:58-83`)는 5라운드에 걸쳐 이미 검토된 형태 그대로 — 무변경.
- `handleNodeCompleted`(`:760-839`, errorPayload 블록 `:813-834`)와
  `handleNodeFailed`(`:841-935`, errorPayload 블록 `:909-931`) — 이전 라운드가 기록한
  위치·구조와 일치, 이번 diff 로 건드려지지 않음.
- 신규 테스트 3건은 전부 기존 `wrapNodeHandlerOutput()` 빌더(`:1987-1991` 부근)를 재사용 —
  래퍼 shape 을 손으로 복제하는 새 지점을 만들지 않았다.

## 발견사항

- **[INFO]** 신규 추가된 "`details` 타입 가드" failed/completed 대칭 테스트 2건이 준비·단언
  코드를 거의 그대로 반복한다
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2323-2346`
    (`— failed`) vs `:2348-2369` (`— completed`)
  - 상세: 두 `it` 블록은 `startExecution`/`seedConversation`/`bindNodeHandlers` 준비,
    `wrapNodeHandlerOutput({ error: { code, message, details: { retryable: "true",
    retryAfterSec: "30" } } })` payload, `expect(last?.systemError?.retryable).toBe(false)` /
    `expect(last?.systemError?.retryAfterSec).toBeUndefined()` 단언이 완전히 동일하고,
    차이는 호출 대상이 `failed` 인지 `completed` 인지와 `error` 최상위 필드 유무(핸들러
    payload shape 차이) 뿐이다. 이 파일이 5라운드 전에도 같은 형태의 반복(`||` 좌/우항
    가드 2건, `:2241-2277`)을 INFO 로 남긴 바 있고 그때도 "우선순위 낮음, 세 번째 유사
    조합이 생기면 `it.each` 고려"로 판정됐다 — 이번 건도 같은 성격·같은 근거다.
  - 제안: 우선순위 낮음. 두 핸들러 대칭 검증이라는 의도가 테스트명(`— failed`/`— completed`
    접미사)과 JSDoc 으로 이미 명확히 드러나 가독성 문제는 없다. 이런 "두 핸들러 대칭"
    페어가 한 벌 더 추가된다면 `it.each([["failed", failedFn], ["completed", completedFn]])`
    형태로 파라미터화하는 것을 고려할 만하다.

## 재확인 재유예 (신규 아님, 5라운드 연속 동일 사유)

아래 세 항목은 이전 라운드들이 이미 INFO 로 기록·유예했고, 이번 diff 가 해당 코드를
전혀 건드리지 않아 격상 사유가 없다. 완전성을 위해 재확인만 하고 새 발견으로 세지 않는다.

- `handleNodeCompleted`/`handleNodeFailed` 의 errorPayload 추출 → `addConversationMessage`
  블록 ~20줄 중복 (`:813-834` vs `:909-931`) — 두 핸들러가 인접 블록에서 서로 다른 로직
  (`duration`/`status` 처리)을 갖고 있어 추출 시 그 차이가 흐려질 위험이 근거로 유지.
- `asRecord(asRecord(domain)?.error)`(`:90`) 이중 언래핑 밀도 — JSDoc(`:58-83`)이 shape 을
  이미 설명, 중간 변수 도입 이득 미미.
- `payload.output` 타입 표기가 두 핸들러에서 다름(`Record<string, unknown>` vs `unknown`,
  `:769` 근방 vs `:869` 근방) — `extractNodeErrorPayload` 시그니처가 `unknown` 하나로
  통일돼 실질 동작 차이 없음, 공유 `NodeHandlerOutput` 타입 부재가 근본 원인이나 이 PR 과
  직교.

## 신규 결함 없음

이번 라운드가 추가한 3개 테스트(`details` 타입 가드 failed/completed 대칭, `details`
비-object)는 네이밍(`[가드]` 접두 + 대상 필드가 제목에 드러남)과 JSDoc(뮤테이션 예측/실측
표까지 인용)이 이 파일의 기존 컨벤션과 일관되고, 함수 길이·중첩 깊이·매직 넘버(`"true"`,
`"30"` 은 "스키마 drift" 로 명시된 의도적 오타입 fixture) 문제는 없다.

## 요약

프로덕션 코드(`use-execution-events.ts`)는 1라운드 이후 무변경이며, 5라운드에 걸쳐 지적된
유지보수성 결함(JSDoc-함수 분리, 자매 주석 낙후, fixture 5곳 손복제, `direct` 분기 커버리지
0, `||` 가드 분기 미검증)은 전부 해소가 재확인됐다. 이번 6라운드 diff 는 테스트 파일에
`details` 타입 가드 뮤테이션 테스트 3건을 추가하는 것뿐이며, 기존 `wrapNodeHandlerOutput`
빌더를 재사용해 새로운 fixture 복제를 심지 않았다. 유일한 경미한 지적은 신규 failed/
completed 대칭 가드 테스트 2건의 준비/단언 보일러플레이트 반복으로, 5라운드 전 같은 파일
같은 성격의 지적과 동일하게 우선순위 낮음(파라미터화는 세 번째 유사 조합이 생길 때
검토). 핸들러 간 ~20줄 중복·이중 언래핑 밀도·`output` 타입 표기 불일치 세 INFO 는 이번
diff 가 해당 코드를 건드리지 않아 재확인만 하고 격상하지 않는다. 유지보수성 관점에서
이 PR 은 수렴했다고 판단한다.

## 위험도
NONE
