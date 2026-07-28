# Cross-Spec 일관성 검토 — retry-turn-cancel-guard (impl-done)

## 스코프 메모 (검토 방법)

본 세션의 `_prompts/cross_spec.md` 는 `spec/5-system/` 대상 파일 중 `1-auth.md`·`10-graph-rag.md`·
`11-mcp-client.md` 만 전문을 포함했고, 이번 diff 의 실질 대상인 `4-execution-engine.md`·
`2-api-convention.md`·`3-error-handling.md`·`6-websocket-protocol.md` 등은 "컨텍스트 예산 초과로
생략"되어 있었다(프롬프트가 명시적으로 "여기 없다는 사실을 '없음'의 근거로 삼지 말고 Read 로 직접
열라"고 지시). 실제 diff(`git diff origin/main...HEAD`)는 spec 변경 없이 코드만 변경한다 —
`codebase/backend/src/modules/execution-engine/retry-turn.service.ts`(+ spec) 의 두 종결 경로
(`completeRetryExecution`/`failRetryExecution`)에 `finalizeGuarded` 가드를 추가한 것이 전부다.
따라서 이 검토는 (1) 위 diff 를 직접 읽고, (2) 그 governing spec 인
`spec/5-system/4-execution-engine.md`·`spec/conventions/node-cancellation.md`·
`spec/5-system/6-websocket-protocol.md` 를 절대경로로 직접 열어, 코드가 구현한 계약이 spec 의
다른 영역과 모순되는지를 확인하는 방식으로 수행했다. `1-auth.md`/`10-graph-rag.md`/
`11-mcp-client.md` 는 이번 diff 와 무관해 별도 이슈를 보고하지 않는다(RBAC 매트릭스 등은 표본
점검했으나 모순 없음 확인).

---

## 발견사항

- **[WARNING]** `spec/5-system/4-execution-engine.md` §1.1 이 retry 재진입(replay) 취소 보존
  여부를 **자기 문서의 최신 서술 + 2개의 다른 spec 영역과 정반대로 기술**
  - target 위치: `spec/5-system/4-execution-engine.md` §1.1 상태 전이표 77행(`failed→running`
    row) 및 Rationale "`failed → running` 재진입 전이" 1454행(`git blame` 상 각각
    2026-06-10/2026-06-06 작성, 이후 미갱신)
  - 충돌 대상:
    1. **같은 파일** 79~92행(§1.1 "짝 전이는 방향과 무관하게 no-op 이 될 수 있다", 2026-07-27
       커밋 `72e3193f7`/#1023 신설)
    2. `spec/conventions/node-cancellation.md` §2.4 "DB 관측 취소 가드"(특히 "확인 없이 쓰면
       턴 진행 중 도착한 Stop 이 덮여 **취소가 지연되는 게 아니라 소실**된다" 및 Rationale
       "왜 짝 전이에 terminal 가드가 필요한가")
    3. **`spec/5-system/6-websocket-protocol.md` 375행** ("`execution.retry_last_turn` 에러
       코드" 절의 "replay 중 cancel" 항목) — `git blame` 상 **2026-05-30, 커밋 `3213a4a55f`
       (원 기능 PR #361)** 로 이 기능 최초 도입 시점부터 이미 존재하던 서술
  - 상세: 77/1454행은 "retry replay 가 RUNNING 으로 도는 중 도착한 cancel 은 **graceful
    no-op**이며 … **replay 가 park 없이 그 turn 에서 종결되면 cancel 은 무효과로 흘려보내진다**"
    라고 명시한다 — 즉 park 를 거치지 않고 그 턴 안에서 완료/실패로 끝나면 도중에 도착한 Stop
    이 **유실**된다는 서술이다. 그런데 (1) 같은 문서 79~92행은 "DB 가 이미 terminal 이면 어느
    쪽도 쓰지 않고 `false` 를 반환 … 이 가드가 없으면 사용자 Stop 이 지연되는 게 아니라
    **소실**된다"고 정반대로 규정하고, (2) `node-cancellation.md §2.4` 도 동일하게 "취소 소실"을
    막는 것이 가드의 존재 이유라고 서술하며, (3) **`6-websocket-protocol.md:375` 는 최초
    기능 도입 시점부터 "replay turn 진행 중 cancel 이 도달하면 turn 을 조기 종료하고 Execution
    을 cancelled 로 마감 — `execution.completed`/`execution.failed` 는 발사되지 않는다"고
    이미 명시**하고 있었다. 이번 diff 의 `finalizeGuarded()`(retry-turn.service.ts)는 바로 이
    (2)(3) 쪽 계약을 코드로 구현한 것이다: `canTransition(live.status, target)` 이 거짓이면
    (=DB 정본이 이미 `cancelled`) 저장·이벤트 emit 을 모두 skip 하고, 신규 회귀 테스트
    ("정본이 이미 CANCELLED 면 FAILED/COMPLETED 로 전이를 시도조차 하지 않는다",
    `retry-turn.service.spec.ts:789`·`:805`)가 "park 도달 여부와 무관하게 cancel 이 항상
    보존된다"를 실측으로 고정한다. 결과적으로 77/1454행의 "park 없이 종결되면 cancel 유실"
    서술은 (a) 같은 문서 다른 절, (b) 자매 컨벤션 문서, (c) 이 기능이 원래부터 의도했던
    WS 프로토콜 서술, (d) 지금 merge 되는 코드·테스트 네 가지 모두와 어긋나는 **유일하게
    낡은 진술**이다. 이 서술을 그대로 두면 향후 개발자가 "retry replay 중 park 없는 종결에서는
    취소가 유실되는 것이 사양"이라고 오독해, `#1021`/`#1022`/`#1023`/본 PR 이 순차적으로 닫아온
    "Stop 이 조용히 사라지는" 결함 클래스를 다른 경로에서 재도입할 위험이 있다.
  - 제안: `spec/5-system/4-execution-engine.md` §1.1 77행과 Rationale 1454행에서 "replay 가
    park 없이 그 turn 에서 종결되면 cancel 은 무효과로 흘려보내진다"(및 "graceful no-op ...
    다음 park 에서 비로소 발효") 서술을 삭제하고, 79~92행/`node-cancellation.md §2.4`/
    `6-websocket-protocol.md:375` 와 합치하도록 "DB 재조회 guarded 전이로 cancel 은 park
    도달 여부와 무관하게 항상 보존되며, 그 턴은 `cancelled` 로 조기 종결된다"로 정정할 것.
    이 정정은 `plan/in-progress/retry-turn-terminal-guard.md` 최하단 "project-planner 위임"
    항목이 이미 (2)만 근거로 동일하게 지목해 두었다 — 위 (3)(6-websocket-protocol.md:375,
    원 기능 최초 도입 시점부터의 서술이라는 사실)을 함께 근거로 추가하면 project-planner 결정이
    더 쉬워진다(이미 원래 의도가 그것이었다는 방증). `spec/` 쓰기 권한은 project-planner 에 있다.

- **[WARNING]** `spec/conventions/node-cancellation.md` 의 frontmatter `code:` 목록과 §6
  구현 현황 표가 이번 diff 로 넓어진 "§2.4 DB 관측 취소 가드"의 실제 구현 표면을 반영하지 못함
  — 계층 책임(어느 서비스가 이 계약을 지키는가) 서술이 코드보다 좁다
  - target 위치: `spec/conventions/node-cancellation.md` frontmatter `code:`(4~13행, 명시적
    파일 나열 — glob 아님) + §6 표 "§2.4 park↔resume 짝 전이 terminal 가드" 행(184행 부근,
    근거로 `execution-engine.service.ts` 만 나열)
  - 충돌 대상: 이번 diff `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
    (`finalizeGuarded`, `completeRetryExecution`/`failRetryExecution`가 소비)
  - 상세: `execution-engine.md` 는 `code:` 가 `codebase/backend/src/modules/execution-engine/**`
    glob 이라 `retry-turn.service.ts` 를 자동 포괄하지만, `node-cancellation.md` 는 파일을
    명시적으로 나열하는 방식이라 이번에 추가된 파일이 evidence 목록에서 누락된다. 더 중요한
    점은 §Rationale "C-1 god-class strangler-fig 분할"이 `RetryTurnService` 를
    `ExecutionEngineService` 와 **분리된 독립 서비스**로 명시하는데, `node-cancellation.md §6`
    은 "park↔resume 짝 전이 terminal 가드" 책임을 `execution-engine.service.ts` 하나에만
    귀속시킨다 — 이번 diff 이후 그 책임(§2.4 가 규정하는 "DB 관측 취소 가드")은 **두 번째
    서비스에도 독립 구현**됐다. 게다가 두 구현의 **메커니즘이 다르다** — 코드 주석이 명시하듯
    `execution-engine.service.ts` 의 `finalizeCancelledExecution` 은 앱 레벨 `??` 병합(SELECT~
    UPDATE 사이 창에 취약)을 쓰는 반면, `retry-turn.service.ts` 의 `finalizeGuarded` 는 SQL
    `COALESCE` (그 창을 신뢰하지 않는 방식)을 쓴다. 이 차이 자체가 잘못은 아니나(diff 주석이
    의도적 선택이라고 밝힘), spec 이 "이 계약을 지키는 계층"을 하나로만 서술하는 채 방치하면
    독자는 두 메커니즘이 존재한다는 사실도, 그 사이 안전성 차이도 알 수 없다.
  - 제안: `node-cancellation.md` §6 표에 `retry-turn.service.ts`(`finalizeGuarded`) 행을
    추가하고, `completeRetryExecution`/`failRetryExecution` 의 CANCELLED 멱등 분기가
    `COALESCE` 를 쓰는 이유(SELECT~UPDATE 창 회피)를 한 줄 각주로 남길 것. frontmatter `code:`
    에도 파일 추가. `plan/in-progress/retry-turn-terminal-guard.md` 최하단이 이미 이 항목을
    project-planner 위임으로 명시했다(본 발견은 그 항목에 위 "메커니즘 상이" 근거를 보강한다).

- **[WARNING]** `retry-turn.service.ts` 의 `failRetryExecution` CANCELLED 분기가 emit 하는
  `execution.cancelled` WS 페이로드가 `6-websocket-protocol.md` §4.1 의 `cancelledBy` 필수
  계약을 충족하지 못함 (pre-existing — 이번 diff 가 그 라인을 손댔으나 갭은 새로 만든 것이 아님)
  - target 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
    `failRetryExecution` 의 `eventEmitter.emitExecution(executionId, EXECUTION_CANCELLED,
    { status: finalStatus })` 호출(이번 diff 가 `status: execution.status` →
    `status: finalStatus` 로 직접 수정한 바로 그 라인)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.1(179행) — `execution.cancelled`
    페이로드 `{ executionId, cancelledBy, duration, error? }`, `cancelledBy:
    'user'|'system'|'timeout'` **필수** 닫힌 union
  - 상세: 코드 전수 확인 결과, `EXECUTION_CANCELLED` 를 emit 하는 다른 모든 경로
    (`execution-engine.service.ts` 의 4개 호출부 — `finalizeCancelledExecution` 등)는 전용
    헬퍼 `emitCancellationEvent(executionId, { cancelledBy, error?, logContext })` 를 거쳐
    `cancelledBy` 를 채우는데, `retry-turn.service.ts` 의 `failRetryExecution` 만 이 헬퍼를
    쓰지 않고 `eventEmitter.emitExecution` 을 직접 호출해 `{ status: finalStatus }` 만 싣는다.
    `emitExecutionEvent`(websocket.service.ts)는 `executionId`/`seq`/`timestamp` 만 자동
    주입하고 도메인 필드는 채우지 않으므로, 이 경로의 wire 페이로드는 `cancelledBy`·`duration`
    이 모두 빠진 채 나간다. 개발자 자신의 5차 라운드 ai-review 가 이미 이 갭을
    `W1(api_contract)` 로 식별해 "pre-existing, 이 PR 은 `status` 필드만 바꿨을 뿐 `cancelledBy`
    는 원래부터 없었다"고 범위 밖(defer)으로 남겨 두었다 — 즉 이번 diff 가 만든 회귀는 아니다.
    소비자(`chat-channel.dispatcher.ts`)가 `result` 부재를 방어적으로 처리해 크래시는 없으나,
    계약 위반 자체는 여전히 살아 있다.
  - 제안: `failRetryExecution` 의 CANCELLED 분기도 `emitCancellationEvent`(또는
    `cancelledBy:'user'` 를 포함하는 동등 헬퍼)를 재사용하도록 developer 후속 작업 항목으로
    명시 등재할 것(이미 `retry-turn-terminal-guard.md` 5R 섹션에 W1 로 등재돼 있으므로, 이번
    검토는 그 항목이 spec 계약 위반이라는 사실을 cross-spec 관점에서 재확인하는 역할).

---

## 요약

이번 diff(`retry-turn.service.ts` 의 `finalizeGuarded` 도입)는 spec 을 변경하지 않는 순수 코드
수정이지만, 그 코드가 실제로 구현한 "cancel 은 park 도달 여부와 무관하게 항상 보존된다"는 계약은
governing spec 3곳(`4-execution-engine.md` 자기 문서의 최신 절, `node-cancellation.md §2.4`,
그리고 이 기능이 2026-05-30 최초 도입될 때부터 있었던 `6-websocket-protocol.md:375`)과는
합치하지만, 같은 `4-execution-engine.md` §1.1 의 더 오래된 절(77/1454행, 2026-06-06/10 작성 후
미갱신)과는 정반대로 남아 있다 — 새로 코드가 실증한 사실이 자기 문서 안의 낡은 문장을 결정적으로
반증한 사례다. 이 모순은 이번 PR 이 새로 만든 것이 아니라 `#1023`(2026-07-27)이 79~92행만
신설하고 77/1454행을 갱신하지 않아 남은 것이며, developer 자신도 `plan/in-progress/
retry-turn-terminal-guard.md` 하단에 project-planner 위임 항목으로 이미 지목해 두었다(본 검토는
그 지목이 정확함을 3개 spec 파일 교차 확인으로 검증하고, 4번째 근거(6-websocket-protocol.md 의
원 도입 시점 서술)를 추가한다). 그 외 `node-cancellation.md` 의 구현 현황 표/`code:` 목록이
`retry-turn.service.ts` 를 누락해 "이 계약을 누가 지키는가"에 대한 계층 책임 서술이 코드보다
좁고, `failRetryExecution` 의 CANCELLED emit 이 WS `cancelledBy` 필수 계약을 여전히 충족하지
못한다(개발자 스스로 pre-existing 으로 확인·defer). 데이터 모델·RBAC 매트릭스·요구사항 ID
축에서는 이번 diff 와 관련된 모순을 발견하지 못했다. 세 발견 모두 이미 developer 의 plan 문서가
project-planner 위임으로 추적 중인 항목과 일치하며, 새로운 미지의 리스크라기보다는 "알려졌으나
아직 실행되지 않은 spec 정정"이 이번 게이트에서 공식 확인된 것으로 해석하는 것이 정확하다.

## 위험도

MEDIUM
