# Rationale 연속성 검토 — spec/5-system/ (--impl-done, diff-base=origin/main)

## 검토 방법 메모

prompt 에 첨부된 target 본문은 `spec/5-system/1-auth.md` · `10-graph-rag.md` · `11-mcp-client.md` 3개만
전문 포함이고 나머지 18개(특히 이번 diff 의 실제 진원지인 `4-execution-engine.md`)는 컨텍스트 예산
초과로 생략돼 있었다. 생략을 "내용 없음"으로 취급하지 말라는 지시에 따라, 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/retry-atomic-claim-4d9e77`)에서 직접
`git diff origin/main HEAD -- spec/5-system/`, 관련 spec 파일 전문(`4-execution-engine.md` Rationale
전체, `6-websocket-protocol.md`, `4-nodes/3-ai/1-ai-agent.md` §7.9/§12.8, `conventions/node-cancellation.md`),
실제 코드(`retry-turn.service.ts`, `execution-engine.service.ts`, `state/state-machine.ts`), 그리고
직전 라운드들의 산출물(`review/consistency/2026/07/30/12_38_59/rationale_continuity.md`,
`review/consistency/2026/07/28/19_51_18/rationale_continuity.md`, `plan/in-progress/retry-turn-terminal-guard.md`)을
1차 사료로 교차검증했다.

diff 범위(`spec/5-system/`)는 `4-execution-engine.md`(+78/-6) · `6-websocket-protocol.md`(+1/-1) 두 파일뿐이며,
같은 논리적 변경의 일부로 `spec/4-nodes/3-ai/1-ai-agent.md`(+6, target 스코프 밖이나 동일 주제라 함께 확인)도
같은 커밋 체인에서 갱신됐다.

## 발견사항

- **[WARNING]** §1.1 "짝 전이는 방향과 무관하게 no-op" 불변식 서술이 같은 diff 가 도입한 FAILED-소스
  opt-in 짝 전이를 반영하지 않아, 정확히 재발한 적 있는 버그 클래스(state-machine 층은 허용·DB 가드 층은
  무조건 차단)를 향후 다시 부를 수 있는 문서 공백을 남김
  - target 위치: `spec/5-system/4-execution-engine.md` §1.1, 84-95행 (2026-07-27 "짝 전이는 방향과
    무관하게 no-op 이 될 수 있다" 콜아웃 — 이번 diff 로 변경되지 않은 기존 문단), vs. 같은 diff 가
    추가한 79-80행 표 행(`failed → running` / `failed → waiting_for_input`, 둘 다 `allowRetryReentry`
    opt-in)과 1357-1413행 신규 Rationale "retry 재진입의 원자 claim"
  - 과거 결정 출처: 같은 문서 §1.1 의 2026-07-27 콜아웃 자신 — "위 claim(재개 방향)뿐 아니라 **park
    방향(`running → waiting_for_input`)도** 대상 행이 이미 terminal 이면 적용되지 않는다... 짝 전이는
    같은 트랜잭션 안에서 Execution 행을 `SELECT … FOR UPDATE` 로 잠그고 비-terminal 을 확인한 뒤에만
    두 save 를 수행"(85-87행). 이 문단이 §1.1 상태 표에서 `failed`(COMPLETED/CANCELLED 와 함께 terminal,
    `ALLOWED_TRANSITIONS[FAILED] = []`)를 예외 없이 "terminal"로 다루는 것을 전제로 서술됐다.
  - 상세: 이번 diff 가 추가한 `failed → running`/`failed → waiting_for_input` opt-in 짝 전이는 코드
    레벨에서 **정확하고 신중하게** 구현돼 있다 — `execution-engine.service.ts` 의
    `NON_TERMINAL_OR_FAILED_STATUSES_SQL`(508-539행 부근)이 `allowRetryReentry===true` 일 때만 FAILED 를
    행-잠금 대상에 포함시키고, COMPLETED/CANCELLED 는 opt-in 여부와 무관하게 항상 제외된다. 그런데 바로
    그 위젯 코드의 JSDoc(521-532행)이 명시하듯, 이 위치가 정확히 "ai-review CRITICAL #1(2026-07-30) —
    상태머신은 허용하는데 DB 가드(`lockNonTerminalExecutionRow`)가 opts 를 전파받지 못해 재진입이 구조적으로
    절대 persist 될 수 없었다"는 **실제로 벌어졌던 8R CRITICAL 결함**(커밋 `2ca44b769` "retry 재진입 짝
    전이가 DB 가드에 막혀 절대 persist 되지 않던 결함")의 원인 그 자체다. 즉 "상태머신 층은 새 전이를
    허용하는데 DB 가드 층의 '비-terminal' 정의가 그 예외를 모르는" 층간 이음매 문제가 이 코드베이스에서
    이미 한 번 실제 프로덕션급 버그로 나타났음에도, §1.1 의 일반 불변식 선언 문단(84-95행)은 이 이음매의
    존재 자체를 언급하지 않는다 — 79-80행의 새 표 행이 state-machine 층의 opt-in 은 상세히 설명하지만,
    84-95행 콜아웃은 DB 가드 층에서 "terminal" 이 이제 opt-in 에 따라 파라미터화된다는 사실을 다루지
    않은 채 여전히 무조건적 문구("대상 행이 이미 terminal 이면 적용되지 않는다")로 남아 있다. 같은 근본
    원인(상태 전이 허용 여부의 이중 진실 소스 — TS `ALLOWED_TRANSITIONS`/`canTransition` vs SQL
    allow-list 상수)은 `plan/in-progress/retry-turn-terminal-guard.md` 의 코드 표 #21(P2, defer, "8R
    CRITICAL 자체가 이 둘의 불일치였고 수정 후에도 구조는 남는다")로 이미 아키텍처 리스크로 추적되고
    있으나, 이는 코드 구조 통합 과제로만 등재돼 있을 뿐 **spec 의 불변식 선언 문단 자체를 이 예외에
    맞춰 갱신하는 항목은 어디에도 없다**. 같은 간극이 `spec/conventions/node-cancellation.md` §2.4
    "park↔resume 짝 전이 terminal 가드"(87-91행, "비-terminal 을 확인한 뒤에만 쓴다")에도 그대로
    존재한다(이 파일은 target 스코프 밖이지만 동일 원칙을 선언하는 자매 문서).
  - 제안: `spec/5-system/4-execution-engine.md` 84-95행 콜아웃 끝에 각주를 추가 — 예) "**예외
    (2026-07-30)**: `execution.retry_last_turn` 재진입(`allowRetryReentry` opt-in, 79-80행)에 한해
    FAILED 소스 행도 이 잠금 대상에 조건부로 포함된다(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`) — 이 opt-in
    을 상태머신(`canTransition`) 쪽에만 반영하고 이 DB 가드 쪽에 반영하지 않으면 전이가 항상 무효 UPDATE
    가 되는 회귀가 재발한다(8R CRITICAL, `2ca44b769`). COMPLETED/CANCELLED 는 opt-in 과 무관하게 항상
    제외." 같은 각주를 `node-cancellation.md` §2.4 "park↔resume 짝 전이 terminal 가드" 항목에도 상호
    참조로 추가할 것.

- **[INFO]** `spec/data-flow/3-execution.md` 의 인접 "폐기된 서술" 항목이 이번 주제와 같은 뿌리를
  다루면서도 여전히 갱신되지 않음 (직전 라운드 재확인)
  - target 위치: 해당 없음 — `spec/data-flow/3-execution.md` 는 이번 diff(`spec/5-system/` 스코프)에
    포함되지 않음(파일 자체가 변경 목록에 없음, `git diff origin/main HEAD -- spec/data-flow/3-execution.md`
    출력 없음)
  - 과거 결정 출처: `spec/data-flow/3-execution.md` `## Rationale` → "폐기된 서술(본 문서 이전 버전)"
    목록 — "recoverStuckExecutions 가 running 잔류 execution 을 발견하면 failed 로 마감하고 stuck node
    들도 정리한다"를 "실제 대상은 30분 stale heartbeat row 만이고 node_execution 정리는 수행하지 않는다"로
    폐기 확정한 항목
  - 상세: 이 폐기 확정은 PR3(2026-07-04, "일괄 fail" → case-B re-drive 전환) **이전** 모델 기준이다.
    PR3 이후 `failOrphanRunningNodeExecutions` 가 case-B re-drive 진입 시 한정으로 실제 node_execution
    정리를 수행하므로 "node_execution 정리는 수행하지 않는다"는 문구 자체가 이제 부분적으로 낡았다 —
    2026-07-30 12:38 세션이 이미 동일 지적을 했고 "필수는 아님"으로 분류했는데, 이번 라운드까지도 해당
    파일은 그대로다.
  - 제안: 필수는 아니나, project-planner 가 이 계열 spec 을 다음에 손볼 때 "node_execution 정리는 case B
    re-drive 진입 시 크래시 시점 구 RUNNING row 에 한해 수행한다(§3.3, `failOrphanRunningNodeExecutions`)
    — retry_last_turn 2차 claim discard 로 인한 orphan 은 이 정리 대상이 아니다" 로 갱신 검토.

## 검증 메모 (참고 — 확인했으나 문제 없음)

- 이번 diff 의 핵심 신규 전이(`failed → waiting_for_input`, "재진입 turn 이 계속되는 경우")는 과거
  기각된 `R2(waiting_for_retry 신설 — 기각)`의 재도입이 **아니다**: R2 는 신규 status enum 값을 요구해
  §1.3/Principle 5 재검토를 필요로 하는 안이었고, 이번 채택은 기존 `waiting_for_input` enum 값을 재사용할
  뿐 신규 enum 을 만들지 않는다 — 본문 79·1514행이 이 구분을 스스로 명시한다.
  `failed → running`(R1 의 retry 실행 경로)·`failed → waiting_for_input`(세 번째 갈래) 모두
  `allowRetryReentry` opt-in 으로만 열리고 일반 노드 실패 경로에는 번지지 않아, "일반 실패 경로에 신규
  전이를 흘리지 않는다"는 §1.1 기존 원칙과도 정합한다.
- §7.3 "orphan row 마감"(옛 "부모 Execution 종결 후 유령 running 노드가 남지 않는다")과 §Rationale "retry
  재진입의 원자 claim"(2차 claim discard 시 orphan RUNNING row 가 잔류할 수 있음) 사이의 상호 참조
  부재는 2026-07-30 12:38 세션이 MEDIUM WARNING 으로 이미 지적했다 — 현재 HEAD 는 **양쪽 모두**
  교차 참조가 추가돼 해소됨을 직접 대조로 확인했다(§7.3 887행 "스코프 주의" 각주 + §Rationale
  1396-1398행 "두 서술은 스코프가 다르며 모순이 아니다"). `1-ai-agent.md` §12.8 에도 같은 diff 체인에서
  "재진입 turn 이 계속되는 경우" 콜아웃이 추가돼 §7.9 서술과 정합함을 확인했다. 같은 세션이 제안한
  "서술 정정(날짜)" 명시 마커도 1390행에 반영돼 있다 — 세 항목 모두 원인 재작업 불필요.
- `6-websocket-protocol.md` §4.2 "재진입 종결 후 graph 진행" 문단도 같은 diff 로 re-park 갈래를 반영해
  이번 스코프 안에서 자기 정합적이다.
- "선행 판정의 스코프" 문단(1411-1413행, `exec-intake-queue-impl.md` 2026-06-06 PASS 인용)은 해당 plan
  문서 65행의 실제 문구와 대조해 정확함을 확인 — 그 PASS 는 "동일 Execution 동시 active 세그먼트 불가"
  축만 재검증했고 retry_last_turn 2차 claim 축은 다루지 않아, "스코프 밖(무효화 아님)" 서술이 사실과
  부합한다.

## 요약

이번 diff(retry_last_turn 원자 claim + 세 번째 상태 전이 갈래)는 8~12차 ai-review 라운드와 최소 2차례의
직전 `rationale_continuity` 검토를 거치며 반복적으로 다듬여져, 기각된 대안(R2 `waiting_for_retry`)의
재도입 없음·§7.3/§7.5 스코프 교차 참조 보강·`1-ai-agent.md`/`6-websocket-protocol.md` 동반 갱신·명시적
"서술 정정/철회" 날짜 마커 관행 준수 등 Rationale 연속성 관점에서 이례적으로 높은 완성도를 보인다. 다만
한 가지 실질적 공백이 남아 있다 — 상태머신(`canTransition`) 층의 opt-in 허용을 자세히 설명하는 새 표
행과 달리, DB 가드 층("terminal 행은 짝 전이에서 항상 제외된다"는 §1.1 2026-07-27 콜아웃)의 "terminal"
정의가 이제 이 opt-in 에 한해 파라미터화된다는 사실은 spec 어디에도 명시되지 않았다. 이 정확히 같은
층간 이음매 누락이 이미 한 차례(8R) 실제 결함으로 나타난 전력이 있고, 관련 아키텍처 리스크는 plan
백로그(#21)에 코드 차원으로만 등재돼 있어, spec 의 불변식 선언 자체를 갱신해 두지 않으면 향후 리팩터가
같은 결함군을 모르고 재도입할 여지가 남는다.

## 위험도

MEDIUM
