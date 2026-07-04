# Rationale 연속성 검토 — orphan pending backstop (impl-done)

> **payload mis-scope 안내**: 전달받은 `_prompts/rationale_continuity.md` 의 target 문서 번들은 `spec/5-system/1-auth.md`·`spec/5-system/10-graph-rag.md` 만 포함하고 `## 구현 변경 사항` diff 섹션 자체가 없었다 — 실제 대상인 `spec/5-system/4-execution-engine.md`(§7.1/§7.4/§7.5/§8/Rationale)와 `recoverStuckExecutions`/`recoverOrphanPendingExecutions` 코드는 프롬프트에 전혀 포함돼 있지 않다(grep 결과 "orphan"·"recoverStuckExecutions"·"backstop" 0건, 초대(invitation) 도메인의 무관한 "backstop" 1건만 매치). 지시에 따라 `git diff origin/main...HEAD` 로 폴백해 실제 diff(spec + 코드 + plan + CHANGELOG + data-flow)를 직접 분석했다.

## 검토 대상

- diff 범위: `spec/5-system/4-execution-engine.md`(§7.1/§7.4/§8/Rationale 신규 소절), `spec/data-flow/3-execution.md`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`recoverStuckExecutions` 확장 + `recoverOrphanPendingExecutions` 신규), `plan/in-progress/orphan-pending-backstop.md`, `CHANGELOG.md`.
- 대조 SoT: 동일 문서의 §7.1(장애 복구 트리거)·§7.4(분산 실행 Recovery, "Stale 대상 한정")·§8(동시 실행 제한, admission gate·wait-timeout cancel)·`## Rationale`(PR3 크래시 re-drive, PR2b admission gate, §7.1 heartbeat→stalled-job 일원화 항목).
- 선행 컨텍스트: 같은 세션의 impl-prep 단계 검토(`review/consistency/2026/07/04/21_50_44/rationale_continuity.md`)가 이 작업 착수 **전**에 동일 관점(WARNING: §7.4 "Stale 대상 한정" 문언 갱신 + Rationale 신규 소절 필요)을 이미 지적해 두었다. 본 검토는 그 WARNING 이 impl-done 시점에 실제로 해소됐는지를 검증하는 후행 확인이다.

## 발견사항

- **[INFO]** 선행 WARNING(§7.4 "Stale 대상 한정" 문언 갱신) 이 완전히 해소됨
  - target 위치: `spec/5-system/4-execution-engine.md` §7.4 "**Stale 대상 = RUNNING(re-drive) + orphan PENDING(cancel)**" (구 문언 "Stale 대상 한정: `status='running'` 인 row 만" 을 대체)
  - 과거 결정 출처: 동일 문서 §7.4 구 문언 자체(스코프를 RUNNING 전용으로 단언) + 21_50_44 리뷰의 WARNING("함수명·docstring·§7.4/§7.5/Rationale 문언이 'RUNNING 전용'을 여러 곳에서 강하게 단언 — 갱신 없이는 문서 내부 모순 발생")
  - 상세: diff 는 "Stale 대상 한정" 표제 자체를 "RUNNING(re-drive) + orphan PENDING(cancel)" 로 교체하고, 임계값이 상태별로 다름(RUNNING=`STUCK_RECOVERY_STALE_MS`/`started_at`, PENDING=`EXECUTION_QUEUE_WAIT_TIMEOUT_MS`/`queued_at`)을 명시했다. §7.1 표·§8 라인(1088)도 동일 확장을 반영해 문서 내부 모순이 발생하지 않는다.
  - 제안: 없음 — 선행 WARNING 이 정확히 요구한 형태로 반영됨.

- **[INFO]** 신규 Rationale 소절이 "cancel not re-enqueue" 결정을 §8 기존 원칙과 정합적으로 근거 제시
  - target 위치: `spec/5-system/4-execution-engine.md` `## Rationale` → "orphan pending backstop — recoverStuckExecutions 재사용 + PENDING cancel (2026-07-04)" 소절, 특히 "PENDING 은 cancel, RUNNING 은 re-drive(상태별 상이)" 항목
  - 과거 결정 출처: §8 "동시성 cap admission gate" Rationale ("`cancelled`(+`error.code`) vs `failed`: 큐 대기 초과는 노드 실행이 시작조차 안 됨 → 취소가 의미 정합") + §8 본문 라인 1088 구버전("job 소실 orphan pending 회수는 후속 — 본 PR 스코프 아님")
  - 상세: 신규 소절은 (a) PENDING 은 진행 흔적이 없어 재구동 대상이 아니라는 논리, (b) "재큐→재검사→cancel" 과 "직접 cancel" 이 결과 등가라는 논리, (c) §8 라인 1088 이 이미 이 확장을 "후속" 으로 예고해 두었다는 계보를 모두 명시했다. 실제 코드(`markQueueWaitTimeout` — `WHERE status='pending'` 조건부 UPDATE, `EXECUTION_QUEUE_WAIT_TIMEOUT`/`cancelledBy='timeout'` 재사용, re-enqueue 경로 없음)와 spec 서술이 일치한다. RUNNING(re-drive)과 PENDING(cancel)의 방향이 반대로 보일 수 있으나 "재개할 진행 상태의 유무" 라는 단일 원칙에서 파생된 것이라 §Rationale "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (PR3)" 의 "옛 일괄 fail 대체" 결정과 충돌하지 않는다(PENDING 은애초 RUNNING 이 아니었으므로 PR3 스코프 밖).
  - 제안: 없음.

- **[INFO]** "boot-only 재사용, 신규 스캐너·lock·env 미도입" 원칙 준수가 코드 레벨까지 일치
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `recoverStuckExecutions`(early-return 제거 후 `recoverOrphanPendingExecutions()` 항상 호출) + `recoverOrphanPendingExecutions` 신규 private 메서드
  - 과거 결정 출처: §7.1 "별도 heartbeat 채널을... 신설하지 않는다", §7.4 "전역 boot-lock 은 유지"·"명시적 release" 원칙, `## Rationale` "§7.1 heartbeat → stalled-job 일원화"(신규 주기 스캐너 대신 기존 메커니즘 재사용)
  - 상세: 신규 로직은 같은 `recoverStuckExecutions` 함수·같은 `exec:recover:lock` 분산 lock·같은 `onApplicationBootstrap`/test-hook 트리거 안에 위치하며, 신규 migration·env·에러코드가 없다. 21_50_44 리뷰가 사전에 우려했던 "RUNNING 회수 후 lock 을 즉시 release 하는 기존 흐름과 PENDING 스캔 추가가 충돌하지 않는가" 도 코드상 동일 `try/finally` 블록 안에서 RUNNING re-drive(fire-and-forget) 뒤 `await this.recoverOrphanPendingExecutions()` 를 동기적으로 수행하고 `finally` 에서 lock 을 release 하는 구조라 문제없다(PENDING cancel 자체는 즉시 완료되는 DB UPDATE 뿐이라 lock 보유 시간을 유의미하게 늘리지 않는다).
  - 제안: 없음.

- **[INFO]** race/멱등 안전 주장이 실제 SQL 조건과 일치
  - target 위치: Rationale "멱등·race 안전" 항목 + 코드 `markQueueWaitTimeout`(조건부 `WHERE id=:id AND status='pending'`)
  - 과거 결정 출처: §8 admission gate Rationale "TOCTOU 원자화"(advisory lock) 및 PR2b 의 "조건부 UPDATE 만으로 불충분했던 것은 서브쿼리 COUNT 스캔 때문" 이라는 선례
  - 상세: 여기서는 admission gate 와 달리 COUNT 서브쿼리가 없는 단순 상태 전이(`pending`→`cancelled`)라 advisory lock 이 불필요하다는 주장이 타당하다 — admission race 는 "여러 pending 이 같은 cap 카운트를 동시에 읽는" 문제였고, 여기는 "이 특정 execution 이 지금 pending 인가" 라는 단일 row 조건부 UPDATE 라 다른 성격이다. PR2b 의 "조건부 UPDATE 단독 불충분" 교훈을 orphan pending 케이스에 기계적으로 재적용하지 않은 것은 정확한 구분이며, Rationale 문서화도 이 구분을 명시한다("admission gate(pending→running)와 backstop(pending→cancelled)은 상호배타 status 전이라 이중 처리 없음").
  - 제안: 없음.

## 요약

impl-done 시점의 실제 변경(spec §7.1/§7.4/§8 + 신규 Rationale 소절 + `recoverOrphanPendingExecutions` 코드 + data-flow 상태표)은 착수 전(21_50_44) 검토가 지적했던 유일한 실질 우려 — "`recoverStuckExecutions` 가 RUNNING 전용이라는 §7.4 문언이 PENDING 겸용 확장 후 stale 해진다" — 를 문구 수준까지 정확히 해소했다. 신규 Rationale 소절("orphan pending backstop")은 (1) cancel(not re-enqueue) 선택 근거, (2) 같은 함수·lock·트리거 재사용 근거(신규 스캐너 미도입 원칙 유지), (3) §8 라인 1088 이 이 확장을 이미 "후속" 으로 예고해 두었던 계보를 모두 명시해 기존 Rationale 체계와 정합적으로 이어진다. RUNNING=re-drive / PENDING=cancel 이라는 상태별 분기는 "재개할 진행 흔적의 유무" 라는 단일 원칙에서 파생돼 PR3 의 "일괄 fail 대체" 결정과도 충돌하지 않는다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 — 4개 관점 모두에서 문제를 발견하지 못했다.

## 위험도

NONE

BLOCK: NO
STATUS: SUCCESS