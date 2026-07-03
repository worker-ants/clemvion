### 발견사항

- **[INFO]** `reclaimStuckRunningExecution` (구현 예정 메서드명) — 기존 사용처 없음, 충돌 아님
  - target 신규 식별자: (구현 노트 기준) `reclaimStuckRunningExecution` — PR3 case B(`running → running` `started_at` 조건부 re-claim)를 별도 메서드로 추출할 때 채택 예정인 이름
  - 기존 사용처: 없음. 저장소 전체(`codebase/`, `spec/`, `review/`, `plan/`)를 `reclaimStuckRunningExecution` / `Reclaim*` / `StuckRunning*` 로 grep 한 결과, 유일한 등장은 직전 spec 단계 리뷰 산출물 `review/consistency/2026/07/03/23_50_01/naming_collision.md`·`SUMMARY.md` 에서의 **명명 권고 문구 자체**뿐이다(코드·spec 본문에 실제 정의는 없음)
  - 상세: 이 이름은 spec-check 단계(`review/consistency/2026/07/03/23_50_01`)에서 "`claimResumeEntry`(waiting 전용 case A claim)와 신규 case B re-claim 을 혼동하지 않도록 별도 메서드로 추출 시 채택 권장"으로 제안된 것과 정확히 일치한다. 현재 `execution-engine.service.ts` 에는 `recoverStuckExecutions`(부팅 시 stale RUNNING 일괄 처리 전체 로직, private, L2605)와 `claimResumeEntry`(case A 전용 원자 claim, public, L899) 두 메서드만 존재하고 `reclaim*` 계열 이름은 전혀 없다. 새 이름이 기존 `claimResumeEntry` 와 접두어(`claim`)를 공유하지만 동사를 `reclaim`으로 분리하고 있어 "waiting 전용 claim" vs "재시작 re-drive re-claim" 의 의미 차이가 이름에서부터 구분된다.
  - 제안: 변경 불필요. 구현 시 다음만 확인 권장 — (1) `recoverStuckExecutions`(부팅 스캔 오케스트레이션, DB UPDATE + 분산 lock 획득/해제 포함) 내부에서 개별 row 단위 재구동을 별도 메서드로 뽑을 때, 그 메서드가 담당하는 범위(단일 조건부 UPDATE + rehydration 트리거만인지, lock 관리까지 포함인지)를 JSDoc에 명확히 표기해 `recoverStuckExecutions`(스캔 전체)와 역할이 다르다는 것이 이름만으로도 드러나게 할 것. (2) `claimResumeEntry` 와 마찬가지로 boolean 또는 affected-count 반환 계약을 문서화해 두 claim류 함수의 반환 시맨틱을 나란히 비교 가능하게 할 것(§7.5 Δ4 "affected=1 인 쪽만 진행" 패턴 일반화와 일치).

- **[INFO]** 기존 핵심 식별자 전부 신규 부여가 아니라 기존 정의 재사용 — 재확인
  - target 신규 식별자: `recoverStuckExecutions`, `claimResumeEntry`, `STUCK_RECOVERY_STALE_MS`, `EXECUTION_MAX_ACTIVE_RUNNING_MS`, `WORKER_HEARTBEAT_TIMEOUT`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`, `rehydrateContext`, `runNodeDispatchLoop`, `dispatchResumeTurn`, `EXECUTION_TIME_LIMIT_EXCEEDED`, "case A"/"case B" 라벨
  - 기존 사용처: `spec/5-system/4-execution-engine.md` §7.1(L810-830)·§7.2(L835-845)·§7.3(L855-862)·§7.4(L900-925, `recoverStuckExecutions`)·§7.5(L925-1000, `dispatchResumeTurn`/`rehydrateContext`/`runNodeDispatchLoop`/`RESUME_*`/case A·B)·§8·Rationale(L1290-1305, L1415, L1455-1461); 코드 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`recoverStuckExecutions` L2605, `claimResumeEntry` L899, `STUCK_RECOVERY_STALE_MS` L2579); `spec/conventions/error-codes.md`(L63, `WORKER_HEARTBEAT_TIMEOUT` PR3 의미 축소 이미 반영); `execution-run.queue.ts`(L71, `recoverStuckExecutions` 참조)
  - 상세: impl-prep 시점(2026-07-04) 기준으로 `spec/5-system/4-execution-engine.md` 본문은 이미 spec-check 단계 리뷰(`review/consistency/2026/07/03/23_50_01`, BLOCK:NO)를 거쳐 반영 완료된 상태이며, `spec/conventions/error-codes.md`·`3-error-handling.md`·`1-data-model.md` 동기화도 확인된다. 코드(`execution-engine.service.ts`)는 아직 옛 "일괄 FAILED" 로직(L2605-2685, `recoverStuckExecutions` 가 stale RUNNING 을 무조건 `FAILED`+`WORKER_HEARTBEAT_TIMEOUT` 마킹)을 유지 중 — spec 과 코드의 갭이 정확히 이번 구현(PR3) 범위와 일치한다. 새 요구사항 ID·엔티티·API endpoint·이벤트명·ENV 변수·config key·신규 파일 경로는 도입되지 않는다(신규 마이그레이션 불요가 spec Rationale 에 명시).
  - 제안: 변경 불필요. 구현 착수 시 `recoverStuckExecutions` 의 기존 "일괄 FAILED" 분기(L2626-2677)를 "원자 re-claim + rehydration re-drive" 로 교체하되, 기존 WAITING_FOR_INPUT 제외 로직·분산 lock(`RECOVERY_LOCK_KEY`/`RECOVERY_LOCK_TTL_SECONDS`) 은 그대로 재사용(spec Δ1/§7.4 와 일치).

### 요약

이번 impl-prep 대상(`spec/5-system/` 스코프, 실질적으로는 PR3 "크래시/재시작 RUNNING 세그먼트 제어된 re-drive" 구현)이 사용하는 모든 식별자는 기존 spec·코드에 이미 존재하는 이름의 재사용이며, 구현 노트가 언급한 신규 메서드명 `reclaimStuckRunningExecution` 은 저장소 전체에서 실제로 전무했던 이름으로 기존 `claimResumeEntry`(case A 전용)와 접두어만 공유할 뿐 의미가 명확히 분리되어 충돌 소지가 없다. 이 이름은 직전 spec-check 단계 리뷰가 정확히 이 목적으로 권고한 것과 일치하며, 요구사항 ID·엔티티·API endpoint·이벤트명·ENV/설정키·파일 경로 어느 관점에서도 CRITICAL/WARNING 급 충돌은 발견되지 않았다.

### 위험도
NONE
