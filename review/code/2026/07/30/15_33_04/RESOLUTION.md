# RESOLUTION — 15_33_04 (9차 라운드) — 사후 작성 (2026-07-30)

> **사후 작성 사유**: 이 라운드는 main 이 직접 처분해 `resolution-applier` 를 거치지 않았고
> RESOLUTION 작성이 누락됐다. `--impl-done`(`19_00_25`) WARNING #3 이 지적해 보완한다.
> 단일 진실은 `plan/in-progress/retry-turn-terminal-guard.md` §9차 라운드 절.

## CRITICAL #1 (testing) — 수정 (`959dfd099`)

8R 수정이 **처음 도달 가능하게 만든** "re-park(`FAILED → WAITING_FOR_INPUT`)" 경로에 회귀
안전망이 전무했다. 8R 뮤턴트 D 가 RED 였던 것은 **인자-shape 단언** 덕분일 뿐, opts 가 DB SQL
가드까지 실제로 도달하는지는 아무도 보지 않았다.

multi-turn continuation 을 통합으로 재현하려 했으나 핸들러 반환 shape 을 맞추지 못해 `FOR UPDATE`
잠금에 도달조차 못했다 — **그 시도는 철회**했고, 재시도 시 그 shape 문제를 먼저 규명하도록 plan
`#25` 에 남겼다. 대신 그 경로가 실제로 쓰는 짝 전이를 직접 겨냥한 focused 테스트 2건으로 잠갔다.

mutation: 짝 전이 분기의 opts 전파 제거 → **14건 RED**(신규 2건 포함).

측정 실수 하나를 정정했다 — 처음엔 `dbExecutionStatus` 로 persist 를 재려 했는데 짝 전이는
`manager.save` 를 쓰고 그 추적은 `mockExecutionRepo.save` 만 본다. 잠금 SQL 의 `'failed'` 포함
여부로 바꿨다.

## CRITICAL #2 (SPEC-DRIFT) — 수정

8R 이 신설한 `FAILED → WAITING_FOR_INPUT` opt-in 전이가 spec 어디에도 없었다 — **내가 상태머신을
넓히면서 §7.5 Rationale 만 손대고 §1.1 은 빠뜨린 drift 다.** §1.1 다이어그램 엣지 + 전이표 행 +
Rationale 세 번째 갈래 + `6-websocket-protocol.md` §4.2 · `1-ai-agent.md` §12.8 각 한 문단 보강.

## defer (plan 등재)

- **9R W1 (database)** — 재진입 짝 전이가 원래 실패 시점의 `error`/`finishedAt`/`durationMs` 를
  clear 하지 않은 채 non-terminal 행에 재기록한다. 특히 re-park(최빈)에서 이 모순 상태가 다음
  사용자 입력까지 장기 유지돼 `GET /executions/:id` 소비자에게 "대기 중인데 오류 메시지·완료시각이
  함께 표시" 되는 모순을 노출한다 → plan `#35`(**P2**, 신규 승격).
- **9R W2 (concurrency)** — 한 Execution 아래 형제 FAILED 멀티턴 노드의 동시 재진입 시 소유권
  모호성 → plan `#36`(P3, 신규 승격). `#20` 의 11R 증거 보강과 같은 뿌리.
- 나머지(W3~W10)는 `#18`·`#19`·`#21`~`#25` 로 등재됨.
