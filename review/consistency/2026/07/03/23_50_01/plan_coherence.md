# Plan 정합성 검토 — spec-draft-crash-running-redrive.md

검토 대상: `plan/in-progress/spec-draft-crash-running-redrive.md`
비교 plan: `plan/in-progress/exec-park-durable-resume.md`(umbrella, "## PR3 — 크래시 RUNNING 세그먼트 멱등 재개"),
`plan/in-progress/exec-intake-queue-impl.md`(PR3 L57 / PR4 L58),
`plan/in-progress/execution-engine-residual-gaps.md`(G2)
참고: `spec/5-system/4-execution-engine.md` §7.1/§7.2/§7.4/§7.5/§8/Rationale (현재 본문)

## 발견사항

### WARNING — `active_running_ms` terminal 경계가 정확히 이 크래시 시나리오에서 under-count 되는 기존 알려진 갭을 재사용하면서 미해소

- target 위치: draft Δ1 (line 37, 42) — "terminal 경계(무한 re-drive 방지) … §8 누적 active-running 한도(`EXECUTION_MAX_ACTIVE_RUNNING_MS`)로 종결", Δ5 (line 90) "신규 마이그레이션 불요 … terminal 경계는 §8 `active_running_ms`(V083) 재사용"
- 관련 spec/plan: `spec/5-system/4-execution-engine.md` §Rationale "Graceful Shutdown 시 active-running 시간 under-count 허용 (PR2a 결정)" (L1372-1380)
- 상세: 현행 spec Rationale 은 이미 다음을 명시한다 — 세그먼트 진행 경과분은 in-memory `segmentStartMs` Map 에 있다가 세그먼트 종료 시에만 `Execution.active_running_ms` 로 flush 된다. **크래시(또는 SIGTERM)로 세그먼트가 중단되면 그 경과분은 DB 에 flush 되지 않고 소실**되며, 재배달/재구동 워커는 `segmentStartMs` 가 없어 그 구간을 누적하지 못해 **active 시간을 under-count** 한다. 이 문서는 이 gap 의 해소를 명시적으로 "**PR3(세그먼트 시작 시각을 Redis/DB 로 영속 + crash 복구)에서 자연 해소된다**"(L1378)고 이미 못 박아 두었다.
  draft 의 PR3(본 문서)는 바로 이 크래시-후-재구동 시나리오를 다루면서도, terminal 경계 메커니즘으로 `active_running_ms` 누적을 그대로 채택하되 이 under-count 갭을 인지·재확인·해소하지 않는다. 결과적으로 "poison 세그먼트가 §8 한도로 반드시 종결된다"는 draft 의 핵심 안전장치(무한 re-drive 방지)가, 정확히 크래시로 반복 재구동되는 poison 세그먼트에서 **매 크래시마다 그 세그먼트의 경과분이 flush 되지 않아 누적이 실제보다 적게 잡히고, 한도 도달이 지연되거나 영영 도달하지 못할 수 있다**. side-effect 점검 목록(line 98)은 이 Rationale 문단을 "PR4 stalled 문맥이므로 무변경"이라고만 적어 두어 실제로 이 문단이 자기 자신(PR3, terminal 경계)의 전제를 건드린다는 점을 놓치고 있다.
- 제안: Δ1/Δ5 에 이 under-count 시나리오를 명시적으로 검토·기록해야 한다. 옵션: (a) crash-redrive 경로에서도 under-count 를 수용 가능한 trade-off 로 명시하고 그 근거(빈도·bound 폭)를 Rationale 에 추가, 또는 (b) 최소한 세그먼트 시작 시각(`started_at`)을 terminal 판정의 입력으로 삼아 "각 세그먼트가 최소 1회분(스테일 임계 30분)만큼은 항상 카운트된다"는 대안적 bound 를 제시. 기존 spec Rationale L1378 의 "PR3 에서 자연 해소" 문구도 draft 반영 시 정정(실제로는 미해소)하거나, draft 범위에 명시적으로 편입해야 한다.

### INFO — `recoverStuckExecutions` 전역 boot-lock 과 신규 per-row atomic re-claim 의 관계 미기술

- target 위치: draft Δ3/Δ4 (case B — `running → running` started_at 조건부 re-claim, "두 인스턴스가 같은 stale row 를 동시에 잡아도 affected=1")
- 관련 spec: `spec/5-system/4-execution-engine.md` §7.4 "Recovery (`recoverStuckExecutions`)" — 전역 분산 lock(`exec:recover:lock`, boot 시 획득, 60초 TTL, 단일 인스턴스만 recovery UPDATE 수행)
- 상세: 현재 spec 은 recovery 스캔 자체를 부팅 시 전역 lock 으로 단일 인스턴스만 수행하도록 이미 가드하고 있다. draft 는 이 위에 row 단위 원자 re-claim(`claimResumeEntry` 패턴 일반화)을 추가해 "두 인스턴스가 동시에 같은 row 를 잡아도" 라는 문구로 다중 동시 접근을 전제하는데, 이것이 기존 전역 lock 을 유지한 채의 defense-in-depth 인지, 전역 lock 을 완화/제거하는 것인지 draft 가 명시하지 않는다. 실제로는 모순이 아닐 가능성이 높다(락은 "동시 스캔 시작" 방지, row-claim 은 "스캔 겹침 시 개별 row 이중 처리" 방지로 계층이 다름) 하지만 spec 반영 시 두 메커니즘의 관계(유지/공존)를 §7.4 Recovery 소절에 한 줄이라도 명시해야 향후 구현자가 락 제거 여부를 오판하지 않는다.
- 제안: Δ4 또는 §7.4 Recovery 소절에 "전역 boot lock 은 유지되며, row 단위 claim 은 그 안에서의 추가 방어(다른 인스턴스의 늦은 부팅 스캔·락 만료 경합 등)"라는 한 문장 명시.

### INFO — `execution-engine-residual-gaps.md` G2 의 cross-reference 가 이미 stale(2-hop)

- target 위치: draft side-effect 점검 목록 line 100 ("`execution-engine-residual-gaps.md` G2 — PR3 부분 해소(인프라 토대) 표기")
- 관련 plan: `execution-engine-residual-gaps.md` G2 (line 47) — "G2 의 장애물 3 은 `exec-intake-queue-impl.md` PR3 … 로 부분 해소된다" / `exec-intake-queue-impl.md` PR3(L57) — 이미 "→ `exec-park-durable-resume` 로 이관(직접 구현)" 로 갱신됨.
- 상세: `execution-engine-residual-gaps.md` G2 는 여전히 `exec-intake-queue-impl.md` PR3 를 가리키지만, 그 PR3 항목 자체는 이미 "exec-park-durable-resume 로 이관"이라고 갱신되어 있다. 즉 G2 → exec-intake-queue PR3 → (실제로는) exec-park-durable-resume 의 신규 "## PR3" 절, 이렇게 2-hop 스테일 참조 사슬이 이미 존재한다. draft 의 반영 계획(line 100)은 residual-gaps.md G2 자체의 텍스트 갱신만 언급하고, 이 참조 사슬을 한 번에 정리(직접 `exec-park-durable-resume.md#pr3` 를 가리키도록)할지는 명시하지 않는다. 내용 추적은 체인을 따라가면 가능해 CRITICAL/WARNING 은 아니나, 문서 갱신 시 짚고 넘어가면 좋다.
- 제안: developer 단계에서 residual-gaps.md G2 갱신 시 exec-intake-queue-impl.md 를 거치지 말고 `exec-park-durable-resume.md` "## PR3" 절을 직접 가리키도록 정정.

## 정합성 확인(문제 없음, 참고용)

- Q1(제어된 re-drive, BullMQ auto-stalled OFF)·Q2(errorPolicy='continue' defer) 는 `exec-park-durable-resume.md` "## PR3 — 크래시 RUNNING 세그먼트 멱등 재개 (스코핑 확정 2026-07-03)" 절(line 184-188)의 사용자 결정과 draft banner(line 24)가 정확히 일치.
- draft 의 "완료 노드 미재실행"/"jobId 멱등"/"per-node DB 재검증"(Δ3) 은 기존 spec §7.2/§7.3/§7.4 서술·`claimResumeEntry` affected=1 패턴(§Rationale "재개 race 보장을 DB 원자 claim 으로")과 정합 — 새 동시성 프레임워크 도입 없이 기존 패턴의 일반화로 프레이밍된 점이 spec Rationale 의 선례(§1.3 `_retryState`)와 일치.
- G2(`execution-engine-residual-gaps.md`)의 "3중 장애물 중 장애물 3 만 PR3 인프라로 부분 해소, 장애물 1·2(errorPolicy schema 노출·용어 매핑)는 별건" 프레이밍은 draft Δ5 의 서술과 정확히 일치 — 결정 우회 없음.
- `exec-intake-queue-impl.md` PR3(L57)는 이미 "exec-park-durable-resume 로 이관" 표기가 되어 있어 draft 가 이 plan 의 미해결 결정을 침해하지 않음. PR4(L58, stalled-job 일원화+관측성)는 draft 가 "Planned 유지"로 명시적으로 남겨 두어 PR4 의 존재·범위와 충돌 없음.
- 신규 마이그레이션 불요 주장(started_at·execution_node_log V035/V036·active_running_ms V083 재사용) — exec-park-durable-resume.md 의 "max 버전 참고 = V103"과 모순되는 신규 컬럼 요청이 없어 버전 충돌 없음.

## 요약

target draft 는 exec-park-durable-resume.md 의 "PR3" 스코핑 결정(Q1/Q2)과 exec-intake-queue-impl.md/execution-engine-residual-gaps.md 의 소유권·정합성 면에서는 문제가 없다 — 미해결 결정을 일방적으로 뒤집거나 선행 plan 을 무시하는 CRITICAL 급 충돌은 발견되지 않았다. 다만 draft 가 채택한 무한 re-drive 방지용 terminal 경계(§8 `active_running_ms` 누적)는, 바로 그 시나리오(크래시 후 재구동)에서 기존 spec Rationale 이 이미 문서화해 둔 "세그먼트 경과분 under-count" 갭과 정면으로 맞물리며, 이를 검토·완화하지 않은 채 재사용만 하고 있어 WARNING 으로 반영이 필요하다. 나머지 두 건(전역 recovery lock 과 row-claim 의 관계, G2 cross-reference 의 2-hop stale)은 실무적으로 치명적이지 않은 INFO 수준의 명시성 보완 항목이다.

## 위험도

MEDIUM
