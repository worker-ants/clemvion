# Rationale 연속성 검토 결과

## 검토 범위에 대한 메모 (절차상 중요)

이번 호출의 prompt 는 `scope=spec/5-system/` 를 lexicographic 순서로 덤프하다 컨텍스트 예산을 초과해
`1-auth.md` / `10-graph-rag.md` / `11-mcp-client.md` 3개만 전문이 포함되고 나머지 14개 파일
(`2-api-convention.md` ~ `_product-overview.md`, 특히 **`4-execution-engine.md`**)은 명시적으로
생략됐다 ("여기 없다는 사실을 '해당 내용이 없다' 의 근거로 삼지 말 것 — 판정에 관련되면 Read 로
직접 열어라" 라는 경고와 함께).

현재 worktree(`retry-atomic-claim-4d9e77`)의 브랜치명·`plan/in-progress/retry-turn-terminal-guard.md`
의 열린 후속 항목("W1 — `applyRetryLastTurn` 원자 claim")·최근 커밋 이력(#1021~#1027, 전부
retry-turn/node-cancellation 영역)을 볼 때, 이번 impl-prep 게이트가 실제로 게이팅하려는 작업은
**`spec/5-system/4-execution-engine.md`/`spec/conventions/node-cancellation.md`** 영역이지 auth/
graph-rag/mcp-client 가 아니다. 프롬프트 지시에 따라 두 파일을 저장소에서 직접 Read 하여 분석했다.
아래 CRITICAL 발견은 그 결과다.

---

## 발견사항

- **[CRITICAL]** `retry_last_turn` 재진입 경로가 spec 이 반복 단언하는 "동일 turn 이중 실행 0" 불변식을 실제로 만족하지 못하는데, 그 사실을 처음 예고한 재검증 의무가 **다른 기능(크래시 re-drive)으로 잘못 해소 처리된 채 방치**되어 있다.
  - **target 위치**: `spec/5-system/4-execution-engine.md`
    - §4.2 "작업 단위 — execution-level 세그먼트", PR2a 메모 (L425): `jobId = executionId` dedup 으로 "동일 Execution 의 active 세그먼트는 항상 1개"라 선언하면서, 각주로 "**PR2b+ 재진입 경로**(예: `retry_last_turn` 으로 동시 active 세그먼트가 가능해지는 설계)가 추가되면 이 불변식이 깨질 수 있으므로 **PR2b 착수 전 재검증한다**([§Rationale](#rationale))" 라고 명시적으로 예고해 두었다.
    - §7.4 "분산 실행", 메시지 타입 행 (L906): `retry_last_turn` 은 "대상 row 는 WAITING 이 아니라 spawn 된 RUNNING 이므로 **WAITING_FOR_INPUT 사전검증을 거치지 않는다**" 라고 명시 — 즉 다른 5종 continuation 이 쓰는 `claimResumeEntry` 원자 claim 이 이 타입에는 구조적으로 적용되지 않음을 스스로 인정한다.
    - §7.4 "Worker 동시성" 행 (L914): 바로 위 행의 carve-out 을 무시하고 "재개 진입이 §7.5 의 **DB 원자 claim**으로 gate 되므로 concurrency 상향·멀티 인스턴스에서도 **'동일 turn 이중 실행 0' 불변식이 유지된다**" 라고 **모든 continuation 타입에 대해 무차별적으로** 재단언한다 — 바로 위 행과 내부 모순.
    - §8 관련 Rationale, "타임아웃을 active-running 누적 기준으로" 항목의 "타임아웃 판정 비원자성" 단락 (L1607) 과 "동시성 cap admission gate" 항목 (L1615) 도 같은 `jobId=executionId` 근거로 "동일 Execution 의 동시 active 세그먼트가 불가능"을 재사용하며 `retry_last_turn` 예외를 언급하지 않는다.
    - "park 즉시 해제 + slow-path 일원화 (Phase B)" 항목의 "불변식 보존" 단락 (L1537) 도 동일하게 전역 불변식으로 재진술한다.
  - **과거 결정 출처**: 같은 문서 `## Rationale`
    - "재개 race 보장을 DB 원자 claim — 위 'running hop 회피' 결정의 부분 수정 (§7.5, 2026-07-02)" (L1354-1362): "optimistic claim 은 §1.3 `_retryState` 소비('affected=1 인 쪽만 진행')로 이미 확립된 패턴의 **일반화**"라고 명시 — 즉 이 문서 자신이 "affected=1 CAS 패턴을 재진입 경로 전반에 일반화"하는 것을 정석으로 규정해 두었다.
    - "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (§7.1/§7.2/§7.5, PR3, 2026-07-04)" (L1364-1377): 이 항목이 "**§4.2 active-running 직렬화 불변식 재검증** (필수 이행 — §4.1 PR2a 메모가 'PR2b+ 재진입 경로 추가 시 재검증' 의무를 걸어둠)" 이라는 제목으로 위 L425 의 의무를 **자신이 이행했다고 인용**한다. 그러나 이 항목이 실제로 재검증하는 대상은 **크래시 re-drive(PR3)** 이지, L425 각주가 원래 예시로 든 **`retry_last_turn`** 이 아니다 — 이름은 같은 "재진입 경로"지만 실제로는 다른 기능이다.
  - **상세**: 코드로 교차검증한 결과, `retry_last_turn` 의 두 단계 중 spawn 단계(WS 커맨드 → `_retryState` 소비, `RetryTurnService.retryLastTurn`)만 원자적이고, **continuation job 소비 단계**(`RetryTurnService.applyRetryLastTurn`)는 원자 claim 이 아니다.
    - `continuation-execution.processor.ts` L83-86: `if (type !== 'cancel' && type !== 'retry_last_turn')` 로 `retry_last_turn` 을 `claimResumeEntry`(조건부 UPDATE) 대상에서 **명시적으로 제외**하고, 주석은 "원자 상태 전이 자체는 `applyRetryLastTurn` 내부에서 수행한다"고 적어두었다.
    - 그런데 `retry-turn.service.ts` L272-284 의 `applyRetryLastTurn` 진입부는 `findOneBy` 로 row 를 읽고 `if (spawnedRow.status !== NodeExecutionStatus.RUNNING)` 로만 분기한다 — **조건부 UPDATE 가 아니라 평범한 read-then-branch** 다. 즉 위 주석이 말하는 "원자 상태 전이"가 실제로는 존재하지 않는다.
    - `execution-continuation` 큐의 jobId 는 `${executionId}:${nodeExecutionId}:${monotonic-seq}`(§7.4, L908) 라 매 enqueue 마다 유일해, `execution-run` 큐의 `jobId=executionId` dedup 과 달리 **BullMQ 레벨에서도 "같은 논리적 재진입"의 중복 enqueue 를 막지 못한다**.
    - 이 정확한 갭은 `plan/in-progress/retry-turn-terminal-guard.md` "후속 (본 PR 밖) — W1" 이 이미 자체 식별해 두었다: "`applyRetryLastTurn` 진입부의 `spawnedRow.status !== RUNNING` 체크가 **원자 claim 이 아니다**... 중복 continuation job 전달 시 중복 LLM 턴·공유 context mutation·중복 종결 이벤트를 완전히 막지 못한다." 이 항목이 바로 현재 worktree(`retry-atomic-claim-*`)가 착수하려는 작업으로 보인다.
    - 참고로 `spec/conventions/node-cancellation.md` §2.4 마지막 항목("retry 재진입 종결 경로 terminal 가드", 구현됨 2026-07-28)은 이 중 **종료(exit) 시점**의 stale write 만 가드한다(#1024 로 이미 반영). 이번에 열려 있는 것은 **진입(entry) 시점**의 중복 처리이며, 이 둘은 서로 다른 지점이라 entry 가드가 반드시 별도로 필요하다.
  - **제안**: 코드에 atomic claim 을 추가하는 작업(W1) 자체는 §7.5 Rationale 이 이미 정한 "affected=1 CAS 패턴의 일반화" 원칙과 정확히 부합하므로 방향은 맞다. 다만 그 구현과 **반드시 동반**해 다음 spec 갱신을 짝지어야, 이번 검토가 지적한 자기모순이 그대로 남지 않는다:
    1. §4.2 L425 의 "PR2b 착수 전 재검증한다" 각주를 — crash re-drive(PR3) 항목이 아니라 — 신규로 추가할 `retry_last_turn` 전용 Rationale 항목으로 **명시적으로 재연결**한다(현재는 서로 다른 두 재진입 경로가 한 각주로 뭉뚱그려져 있다).
    2. §7.4 L906 메시지 타입 행의 "WAITING_FOR_INPUT 사전검증을 거치지 않는다"를, 새 claim 이 어디서 무엇을 조건부 UPDATE 하는지로 갱신한다(예: "대신 `applyRetryLastTurn` 진입부가 spawn 된 row 를 대상으로 자체 조건부 UPDATE(affected=1)로 중복 처리를 차단한다").
    3. §7.4 L914 "Worker 동시성" 행의 무차별적 전역 단언에 `retry_last_turn` 은 §7.5 claim 이 아니라 별도 claim 이 가드한다는 각주를 붙인다.
    4. §8 관련 두 Rationale(L1607, L1615)도 같은 각주로 교차 참조해, "jobId=executionId 만으로 충분"이라는 근거가 `execution-continuation` 큐에는 적용되지 않음을 명시한다.
    5. §7.5 "재개 race 보장을 DB 원자 claim" 항목과 대칭되는 신규 Rationale 항목을 추가해 — 어떤 race 를 막는지(중복 LLM 턴/context mutation/중복 종결 이벤트), `_retryState` 소비(spawn 단계 원자성)만으로 왜 불충분한지, node-cancellation.md §2.4 의 종료-시점 가드와 어떻게 상호보완적인지 — 를 기록한다.

- **[INFO]** 실제 프롬프트에 전문이 포함된 3개 target 파일은 검토 범위 내에서 Rationale 연속성 위반이 발견되지 않았다 (모범 사례로 참고 가능).
  - target 위치: `spec/5-system/1-auth.md` 전체, `spec/5-system/10-graph-rag.md` 전체, `spec/5-system/11-mcp-client.md` 전체.
  - 과거 결정 출처: 각 문서 자신의 `## Rationale`.
  - 상세: 세 문서 모두 과거 결정을 뒤집을 때 명시적 새 Rationale 을 동반한 사례가 확인된다 — `1-auth.md` §2.3.D("§2.3 재인증 흐름 정합화... 새 결정이 아니라 아웃라이어 서술을 이미 확정된 1.1.B-4 에 정렬한 것"), `10-graph-rag.md` "KB 단위 토큰 attribution... 종전 KB-GR-EX-07·NF-GR-05 가 이를 ✅/충족으로 오표기했던 것을 정직화(2026-07-11)", `11-mcp-client.md` "R-wontdo-cached-capabilities"(비채택 사유·재개 트리거·표기 선례까지 명시). 위 CRITICAL 항목에서 요구한 정정 방식의 실제 선례로 그대로 재사용할 수 있다.
  - 제안: 없음 — 위 CRITICAL 항목 수정 시 이 세 문서의 서술 패턴(날짜 명시 + 기각 대안 나열 + 선례 cross-link)을 템플릿으로 따를 것을 권장.

---

## 요약

이번 호출에 실제로 덤프된 target 3개 파일(`1-auth.md`/`10-graph-rag.md`/`11-mcp-client.md`)은 Rationale 연속성 관점에서 문제가 없다. 그러나 이 impl-prep 게이트가 실질적으로 겨냥하는 작업 영역(브랜치명 `retry-atomic-claim`, 열려 있는 plan 항목 "W1 — `applyRetryLastTurn` 원자 claim")은 컨텍스트 예산으로 프롬프트에서 생략된 `spec/5-system/4-execution-engine.md` 이며, 프롬프트 자체가 "생략을 근거로 삼지 말고 관련되면 직접 열어라"고 지시하여 해당 파일과 `spec/conventions/node-cancellation.md`, 그리고 실제 코드(`continuation-execution.processor.ts`/`retry-turn.service.ts`)를 직접 열어 교차검증했다. 그 결과 `4-execution-engine.md` 자신이 여러 곳(§4.2, §7.4 두 곳, §8 두 곳)에서 "동일 turn 이중 실행 0"이라는 이름 붙은 invariant 를 전역적으로 유지된다고 반복 단언하면서도, `retry_last_turn` 재진입 경로에는 그 invariant 를 실제로 지키는 메커니즘이 없다는 사실(코드로 확인됨)을 방치하고 있다. 더 나쁘게는, 이 문서가 스스로 예고해 둔 "PR2b 착수 전 재검증" 의무가 실제로는 다른 기능(크래시 re-drive)에 대한 재검증으로 대체되어 마치 해소된 것처럼 인용되고 있어, 향후 이 spec 만 읽는 사람은 `retry_last_turn` 이 이미 안전하다고 오인하게 된다. 지금 착수하려는 atomic-claim 구현 자체는 이 문서가 정한 원칙("affected=1 CAS 패턴의 일반화")과 정확히 합치하는 올바른 방향이므로 되돌릴 필요는 없지만, 구현과 동시에 위에 열거한 5곳의 spec 서술을 갱신하지 않으면 코드는 고쳐지고 spec 은 계속 자기모순 상태로 남는 "결정의 무근거 번복"이 재발한다.

## 위험도

HIGH
