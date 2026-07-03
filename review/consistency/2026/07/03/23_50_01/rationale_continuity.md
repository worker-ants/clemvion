# Rationale 연속성 검토 — spec-draft-crash-running-redrive.md

대상: `plan/in-progress/spec-draft-crash-running-redrive.md` (PR3 spec draft)
대조: `spec/5-system/4-execution-engine.md` §4.1–§4.3 / §7.1–§7.5 / §8 / `## Rationale`, `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/refactor/06-concurrency.md`

## 발견사항

### 1. [WARNING] §4.2 "active-running 직렬화 불변식" 재검증 누락 — PR2b+ 재진입 경로 재검증 의무를 이행하지 않음

- **target 위치**: Δ1(§7.1 개정), Δ2(§7.2 point 3), Δ5(Rationale 신규 항목) — "원자 re-claim + rehydration 재구동" 전체
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §4.1 PR1 구현 메모 (L412) — "active-running 직렬화 불변식 (PR2a)": *"동일 Execution 의 active 세그먼트는 항상 1개이며 두 세그먼트가 동시 실행되지 않는다"* 는 불변식이 `jobId=executionId` dedup 에 의존하고, §8 `assertActiveTimeWithinLimit`/`updateExecutionStatus` 사이 read-check-then-act 의 무-race 성이 **바로 그 불변식**에 의존한다고 명시. 이어 *"PR2b+ 재진입 경로(예: `retry_last_turn` 으로 동시 active 세그먼트가 가능해지는 설계)가 추가되면 이 불변식이 깨질 수 있으므로 PR2b 착수 전 재검증한다"* 고 **명시적 의무**를 걸어뒀다. `타임아웃을 active-running 누적 기준으로` Rationale (L1463) 도 동일하게 "PR2b+ 재진입 경로 추가 시 재검증 필요" 를 반복.
- **상세**: target 의 PR3 crash re-drive(`recoverStuckExecutions` 가 `status='running'` row 를 **BullMQ job 없이** in-process 로 재구동)는 정확히 스펙이 예고한 "PR2b+ 재진입 경로" 범주에 해당한다 — 크래시로 원래 job 이 소멸했다는 전제 하에 **같은 Execution 에 대해 새 active 세그먼트를 시작**시키는 경로이기 때문이다. 그러나 target 은 이 재진입이 §4.2 불변식("동일 Execution 의 active 세그먼트는 항상 1개")과 §8 비원자 타임아웃 판정에 미치는 영향을 전혀 재검증하지 않고, §8 `active_running_ms` 를 terminal 경계 메커니즘으로 그대로 재사용한다고만 서술한다(Δ1 L38, Δ5 L91 "신규 마이그레이션 불요… terminal 경계는 §8 `active_running_ms` 재사용"). 특히 우려되는 시나리오: 크래시가 **완전한 워커 사망이 아니라 일시적 hang/네트워크 단절**이었고 원래 프로세스가 나중에 살아나 여전히 그 Execution 을 in-process 로 굴리고 있는 상태에서, 30분 stale 임계값을 넘겨 다른 인스턴스가 `re-claim`(started_at 갱신)해 **두 번째 active 세그먼트**를 동시에 구동하면 — (a) `assertActiveTimeWithinLimit`/`updateExecutionStatus` 의 read-check-then-act 무-race 전제가 깨지고, (b) 두 세그먼트가 동시에 같은 노드를 dispatch 해 §7.3 at-least-once 경계를 넘어선 이중 실행이 발생할 수 있다. BullMQ stalled-job(§7.1) 이 아직 켜지지 않아(PR4 로 지연) 이 "원래 워커가 실은 살아있다" 케이스를 BullMQ 인프라가 걸러주지 못하는 상태에서, 30분 stale 판정만으로 안전하다고 가정하는 것은 §4.2 Rationale 이 이미 지적한 위험을 재도입하는 셈이다.
- **제안**: Δ5 Rationale 에 "§4.2 active-running 직렬화 불변식 재검증" 항목을 명시적으로 추가한다 — (i) crash re-drive 가 기존 job 종료 없이 새 active 세그먼트를 시작하는 재진입 경로임을 인정, (ii) "원래 워커가 아직 살아있는데 다른 인스턴스가 stale 판정으로 재구동" 하는 race 가 실제로 발생 불가능함을 논증(예: 원래 워커의 in-process 루프가 매 노드 dispatch 마다 자기 소유권을 재확인하는 장치가 있는지, 혹은 그런 이중구동이 §7.3 defense-in-depth per-node 재검증으로 실질 무해함을 근거로 제시), 또는 (iii) 재검증 결과 실제 위험이 있다면 완화책(예: re-claim 시에도 `started_at` 조건부 UPDATE 뿐 아니라 원 세그먼트의 생존을 배제할 별도 신호 필요)을 Δ 어딘가에 반영한다.

### 2. [WARNING] Δ1 내부 불일치 — 동일 "재구동 불가/한도 초과" 케이스에 두 개의 서로 다른 error code 배정

- **target 위치**: Δ1 §7.1 표 갱신 항목 두 곳 — L38("terminal 경계… §8 `active_running_ms`… `EXECUTION_TIME_LIMIT_EXCEEDED`→`failed`")과 L22("PR3 현행 terminal = §8 누적 active-running 한도 초과 → `EXECUTION_TIME_LIMIT_EXCEEDED` failed") vs L24("`WORKER_HEARTBEAT_TIMEOUT` 코드는 유지·의미 축소: … '재구동조차 불가/한도 초과로 종결된 잔여' 표기에만 쓰인다")
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §7.1 표(L823, "attempts 소진(terminal)" 행) 및 Rationale L1426 — `WORKER_HEARTBEAT_TIMEOUT` 은 PR4 stalled 모델에서 "**stalled 재배달 attempts 소진**"만을 의미하도록 이미 재정의가 예고돼 있다. §8 Rationale(L1460) 은 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 "엔진 누적 타임아웃" 전용 신규 코드로 명시적으로 **분리**했다("Code 노드 스크립트 타임아웃과 의미가 달라 분리").
- **상세**: target Δ1 은 한편으로 "PR3 현행 terminal = §8 누적 active-running 한도 초과 → `EXECUTION_TIME_LIMIT_EXCEEDED`" 라고 명확히 못박으면서(L22, L38), 곧이어 "`WORKER_HEARTBEAT_TIMEOUT` 은 … '재구동조차 불가/한도 초과로 종결된 잔여' 표기에만 쓰인다"(L24)고 하여 **같은 "한도 초과" 상황**에 두 번째 코드를 병기하는 것처럼 읽힌다. 두 코드가 동시에 같은 이벤트를 가리키는지, 아니면 `WORKER_HEARTBEAT_TIMEOUT` 이 실제로는 §7.5 rehydration 실패 케이스(checkpoint 부재 등, `RESUME_CHECKPOINT_MISSING`)의 또 다른 표현인지 구분이 모호하다. §8 Rationale 의 "의미 분리(rename 아닌 신설)" 원칙과 §7.1 Rationale 의 "PR4 전용 재정의" 원칙 둘 다와 충돌하지 않으려면, PR3 구간에서 `WORKER_HEARTBEAT_TIMEOUT` 이 실제로 발생하는 경로가 있는지(있다면 무엇인지), 아니면 이 코드가 PR3 기간 동안 **전혀 발생하지 않고** PR4 대비 표기만 유지되는 것인지 명확히 해야 한다.
- **제안**: Δ1 표 갱신 절을 "PR3 기간 중 실제 발동 코드는 `EXECUTION_TIME_LIMIT_EXCEEDED` 하나뿐이며, `WORKER_HEARTBEAT_TIMEOUT` 은 PR3 동안 발생하지 않고 PR4 stalled 모델의 예약어로만 존재한다" 는 식으로 단일화하거나, 정말 두 코드가 별개 케이스를 가리킨다면 그 구분 기준(예: rehydration 자체 실패 vs 시간 한도 초과)을 표에 명시한다.

### 3. [INFO] §4.1 "jobId 일반형" 선례와의 접점 미언급 — re-enqueue 없는 설계 선택의 근거 보강 여지

- **target 위치**: 전체 draft (Δ1–Δ5) — crash re-drive 가 BullMQ job 재발행 없이 순수 DB 원자 claim + in-process 재구동으로 구현됨
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §4.1 PR1 구현 메모(L410): *"`<executionId>:run:<seq>` 일반형은 re-enqueue(크래시 재개)가 도입되는 PR3/PR4 에서 활성화한다"* — 이는 크래시 재개가 **BullMQ 재-enqueue** 로 구현될 것이라는 예고였다.
- **상세**: target 의 PR3 설계는 재-enqueue 를 전혀 사용하지 않고 `recoverStuckExecutions`(부팅 시 1회 스캔)가 직접 in-process 로 재구동한다 — 이는 §4.1 이 예고한 "jobId 일반형 활성화" 전제와 다른 경로다. 설계 자체는 합리적이나(Q1 사용자 결정과 정합, PR4 로 BullMQ 재배달을 미루는 스코프 분리), §4.1 의 옛 예고 문구가 spec 본문에 남아있으면 "PR3 이 jobId 일반형을 활성화했어야 하는데 안 했다" 는 오독을 유발할 수 있다. 이는 기각된 대안의 재도입이 아니라 **미리 언급된 구현 경로의 실제 분기**이므로 CRITICAL/WARNING 은 아니나, side-effect 점검 목록에 §4.1 L410 문구 갱신을 추가하는 편이 문서 정합에 좋다.
- **제안**: target 의 "side-effect 점검 대상" 목록에 `spec/5-system/4-execution-engine.md §4.1 PR1 구현 메모의 "jobId 일반형은 PR3/PR4 에서 활성화" 문구` 항목을 추가해, PR3 가 실제로는 재-enqueue 를 사용하지 않고 §7.1 in-process re-claim 으로 landing 했음을 반영하도록 developer 단계에서 갱신 대상으로 명시한다.

### 4. [INFO] §7.1 Rationale 앵커 "heartbeat → stalled-job 일원화" 가 dangling — target 이 참조하는 기존 Rationale 근거 문서 자체가 불완전

- **target 위치**: 간접 — target 은 §7.1 을 개정하면서 기존 §7.1 본문의 "heartbeat 채널 신설 안함, BullMQ stalled 로 일원화" 논리를 그대로 유지(§7.1 "미응답 시 동작" 행에 PR4 표기 유지)한다.
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` L816 이 `[§Rationale "§7.1 heartbeat → stalled-job 일원화"](#rationale)` 를 인용하지만, 실제 `## Rationale` 절(L1245–1493)에는 그 제목의 항목이 **존재하지 않는다** (grep 결과 0건).
- **상세**: 이는 target 의 결함이 아니라 기존 spec 의 기존 결함(누락된 Rationale 항목)이다. 다만 target 이 §7.1/§7.5 를 상당 부분 개정하면서도 이 dangling 앵커를 고치지 않고 지나가므로, PR3 반영 시 이 기회에 항목을 보강하면 향후 "왜 heartbeat 인프라를 새로 안 만들고 BullMQ stalled 에 의존했는가" 를 둘러싼 재검토 요구가 재발하지 않는다.
- **제안**: target 반영 시 `## Rationale` 에 "§7.1 heartbeat → stalled-job 일원화" 항목을 신설(또는 기존 어딘가에 이미 있다면 앵커를 정정)해 dangling 참조를 해소한다. PR3 의 신규 Δ5 항목과 인접하므로 같은 커밋에서 처리하기 용이하다.

## 정합성 확인 완료 항목 (문제 없음)

아래는 프롬프트가 특별히 우려한 지점들이나, 조사 결과 기존 Rationale 과 정합했다.

- **§7.1 BullMQ stalled "Planned" 유지 + §7.2 point 3 "구현" 승격 공존**: 모순 아님. §7.1 이 다루는 대상(mid-operation 크래시의 즉시 재배달, "다른 워커가 이어받음")과 §7.2 point 3(재시작 시 stale RUNNING 을 recovery loop 로 재개)은 원래부터 스펙상 **별개 트리거**(job stall 검출 vs 부팅 시 스캔)였다. target 은 point 3 만 구현 승격하고 point 2(stalled 검출)는 Planned 로 명확히 분리 유지 — `exec-park-durable-resume.md` L184-188 의 "Q1 = 제어된 re-drive, BullMQ auto-stalled OFF 유지, PR4 로 분리" 사용자 결정과 정확히 일치한다.
- **"controlled re-drive via recovery loop" 가 기각된 대안의 재도입인지**: 아니다. target Δ5 의 "기각 대안" (a) 신규 owner/heartbeat 컬럼, (b) recovery loop 주기적 스캔 추가는 기존 spec/plan 어디에도 이전에 명시적으로 검토·기각된 이력이 없는 **새로운 기각**이며, 과거 결정과 충돌하지 않는다. 오히려 "별도 heartbeat 채널 신설 안함"(§7.1 L816 기존 원칙)과 방향이 일치한다.
- **at-least-once 경계 vs DB-atomic-claim(§7.5, 2026-07-02) Rationale**: 정합. target Δ3/Δ5 의 "완료 노드 미재실행(exactly-once) / RUNNING-at-crash 노드 재실행(at-least-once) / Integration 멱등은 노드 설정 책임" 서술은 §7.3 기존 원칙(외부 API 노드 멱등은 노드 설정에서 관리) 그대로다. `running → running` re-claim 을 §7.5 의 "affected=1 인 쪽만 진행" DB 원자 claim 패턴의 일반화로 명시한 것도 2026-07-02 Rationale(`재개 race 보장을 DB 원자 claim 으로`)이 스스로 "기존 패턴의 일반화" 라고 선언한 성격과 부합 — 새 동시성 프레임워크 도입이 아니라 확립된 패턴 재사용이라는 서술이 일관된다. §1.1 원자성 표(상태 enum 무변경, 소유권 이전만)로 처리한 것도 §7.5 Rationale 의 claim 설계 원칙과 일치.
- **full B3 / per-node task queue 기각과의 관계**: target 의 "임의 노드 타입 커버" 일반화는 `exec-park-durable-resume.md` L181("waiting 노드 rehydration 의 node-type 일반화는 이미 full B3 로 완료")·spec Rationale L1402("per-node task queue 기각은 *모든 노드* 분산이지, park 재개의 중첩 확장이 아니므로 재도입 아님")과 같은 논리 구조를 그대로 계승한다 — 크래시 세그먼트 재구동도 "한 세그먼트 = 한 프로세스" 전제를 유지한 채 그래프 forward 만 재개하므로 per-node task queue 재도입이 아니다.

## 요약

target draft 는 §7.2 point 3 의 오래된 미이행 약속("재시작 시 running 을 체크포인트에서 resume")을 실제로 이행하면서 §7.1 BullMQ stalled 자동 재배달은 사용자 결정(Q1)에 따라 의도적으로 PR4 로 분리하는 구조를 취하고 있으며, 이 분리 자체와 "기각 대안" 서술은 기존 spec/plan 의 Rationale 과 대체로 정합하고 기각된 대안의 무단 재도입도 발견되지 않았다. 다만 두 가지 실질적 공백이 있다 — (1) §4.2 Rationale 이 "PR2b+ 재진입 경로 추가 시 active-running 직렬화 불변식·§8 비원자 타임아웃 판정을 재검증하라"고 명시적으로 걸어둔 의무를 target 이 이행하지 않은 채 crash re-drive(정확히 그런 재진입 경로)를 도입하고 있고, (2) Δ1 내부에서 "한도 초과/재구동 불가" 시나리오에 `EXECUTION_TIME_LIMIT_EXCEEDED` 와 `WORKER_HEARTBEAT_TIMEOUT` 두 코드가 명확한 구분 없이 병기돼 §8/§7.1 Rationale 이 각각 확립한 "코드 의미 분리" 원칙과 마찰을 일으킨다. 두 건 모두 CRITICAL 한 원칙 위반이라기보다 spec 반영 전에 정리하면 해소되는 WARNING 수준이며, 그 외 dangling Rationale 앵커·§4.1 jobId 예고 문구 미갱신은 INFO 수준의 문서 정합 보완 사항이다.

## 위험도

MEDIUM
