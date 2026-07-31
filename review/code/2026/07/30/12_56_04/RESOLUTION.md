# RESOLUTION — 12_56_04 (8차 라운드) — 사후 작성 (2026-07-30)

> **사후 작성 사유**: 이 라운드의 처분은 `resolution-applier` 가 API 오류로 중간 종료해
> main 이 직접 마무리했고, 그 과정에서 RESOLUTION 작성이 누락됐다.
> `--impl-done`(`review/consistency/2026/07/30/19_00_25`) WARNING #3 이 이 부재를 지적해 보완한다.
> 조치 내역의 단일 진실은 `plan/in-progress/retry-turn-terminal-guard.md` §8차 라운드 절이다.

## CRITICAL #1 (concurrency) — 수정 (`2ca44b769`)

`allowRetryReentry` opt-in 이 in-memory `assertTransition` 만 통과시키고 **DB 가드에 도달하지
않아**, retry 재진입의 `FAILED → RUNNING` / `FAILED → WAITING_FOR_INPUT` 짝 전이가 **동시성 없이
매 호출 실패**했다. 즉 이 기능은 한 번도 실제로 persist 된 적이 없다.

실측 확정 사항:

- `NON_TERMINAL_STATUSES_SQL` = `'pending','running','waiting_for_input'` — FAILED 배제
- `lockNonTerminalExecutionRow(manager, executionId)` — `opts` 파라미터 **없음**
- else 분기 guarded UPDATE 도 같은 상수 → **양쪽 분기 모두** FAILED 배제
- `canTransition` 의 opt-in 은 `FAILED → RUNNING` **한 쌍만**
- `reparkAiResumeTurn` 은 opts 없음, 호출부 4곳 전부 flag 미전달

**리뷰어가 지목한 2경로 외에 세 번째 잠금 소비처를 실측으로 찾았다** —
`tryLockActiveExecutionAndSaveNodeExec` 도 같은 잠금을 opts 없이 쓴다. 발견 경로: 테스트 mock 을
정직하게 고치자 `re-failure` 테스트가 즉시 실패했고, 그 지점 주석이 증상을 그대로 서술하고 있었다
("가드가 거부되면 짝 nodeExec 가 CANCELLED 로 재마킹된 뒤 `ExecutionCancelledError` 가 던져진다").

조치: state-machine opt-in 을 `FAILED → WAITING_FOR_INPUT` 까지 확장(표는 `[]` 유지) ·
`NON_TERMINAL_OR_FAILED_STATUSES_SQL` 신설 · 잠금 3소비처에 opts 전파 · orchestrator 전파.

**이 결함이 8라운드 동안 발견되지 않은 이유**: 테스트 mock 이 행 잠금을 SQL·status 와 무관하게
항상 성공으로 하드코딩했다("행 잠금 성공" 고정 주석까지 있었다).

## 검증

mutation 5/5 RED. **1차 실행에서 A(상태머신 opt-in)·C(else 분기 FAILED)가 미검출**이라 테스트를
추가해 잠갔다. 역방향 뮤턴트(opt-in 게이팅 없이 FAILED 무조건 허용 = 과잉 개방)도 RED — 가드를
여는 수정이라 이 방향 검증이 필수였다.

TEST WORKFLOW 전량 PASS. spec 링크 가드가 내가 추가한 앵커 오류(`#73-크래시-재개` → 실제
`#73-멱등성-보장`)를 잡아 정정.

## 후속 (plan 등재)

`retry-turn-terminal-guard.md` §코드 표 — `#18`(claim↔in-memory 동기화 타입 강제) ·
`#19`(메서드 길이) · `#20`(`Execution.status===FAILED` 미검증, **P2**) · `#21`(이중 SoT) ·
`#22`(opts 인라인 타입 중복) · `#23`(헬퍼 통합) · `#24`(RUNNING 유지 분기 opts 미검증) ·
`#25`(통합 continuation 시나리오).
