# Rationale 연속성 검토 — spec/5-system/4-execution-engine.md (--impl-done)

## 점검 범위

- target: `spec/5-system/4-execution-engine.md` (§7.1/§7.2/§7.3/§7.5, `## Rationale` "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (§7.1/§7.2/§7.5, PR3, 2026-07-04)")
- diff: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 외 (`recoverStuckExecutions` → `reclaimStuckRunningExecution` + `redriveStuckExecution` + `driveStuckRedrive` 전환, `runStuckRecoveryScan` e2e 백도어)
- 교차 확인: `spec/data-flow/3-execution.md`, `spec/conventions/error-codes.md`, `spec/5-system/3-error-handling.md`, `spec/1-data-model.md`, `plan/in-progress/spec-draft-crash-running-redrive.md`, `plan/in-progress/exec-intake-queue-impl.md`, `plan/in-progress/execution-engine-residual-gaps.md`

## 발견사항

- **[INFO]** `exec-intake-queue-impl.md` 의 옛 "PR3" 라벨이 새 PR3(2026-07-04 crash re-drive)와 이름이 겹치며 상태 갱신이 누락
  - target 위치: `spec/5-system/4-execution-engine.md` §7.1 banner / `## Rationale` "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (§7.1/§7.2/§7.5, PR3, 2026-07-04)"
  - 과거 결정 출처: `plan/in-progress/exec-intake-queue-impl.md` L57 ("PR3 — 크래시 RUNNING checkpoint 재개"), L58 ("PR4 — stalled-job 일원화 + 관측성")
  - 상세: `exec-intake-queue-impl.md` 는 자신의 "PR3"(stalled 재배달 기반 크래시 재개)를 2026-06-06 에 이미 `exec-park-durable-resume` plan 으로 이관·미구현 확정했다. 이번 target 변경은 그와 다른 메커니즘(절대시간 30분 boot-scan 원자 re-claim)을 채택하며 스스로 "PR3"(2026-07-04)로 재명명했고, 실제로 `spec-draft-crash-running-redrive.md` §"side-effect 점검 대상" 에 "`exec-intake-queue-impl.md` PR3(L57)·PR4(L58) 상태 표기 — developer 단계에서 갱신" 이라는 자기 의무를 명시했다. 그러나 `exec-intake-queue-impl.md` L57/L58 은 여전히 옛 서술 그대로이고 체크박스도 미갱신 — 두 plan 문서에서 "PR3" 가 서로 다른 구현을 가리키는 상태로 방치돼 향후 읽는 사람(혹은 자동화된 --impl-prep)이 PR3/PR4 진행 상태를 오판할 위험이 있다. spec 본문·Rationale 자체는 새 PR3 를 정확히 서술하므로 spec 레벨의 모순은 아니고, plan 레벨의 self-declared 미이행 후속 작업이다.
  - 제안: `exec-intake-queue-impl.md` L57 을 "이관됨 + 2026-07-04 다른 메커니즘(boot-scan 원자 re-claim)으로 `4-execution-engine.md` PR3 가 별도 완료" 로 갱신하고, L58 PR4 설명을 새 spec 의 "PR4 = stalled-job 완전 대체 + `recoverStuckExecutions` 은퇴" 문구와 정합시킬 것. spec 자체 수정은 불필요.

- **[INFO]** `execution-engine-residual-gaps.md` G2 참조가 옛 PR3 이관 문구를 그대로 인용
  - target 위치: `## Rationale` "크래시/재시작 RUNNING 세그먼트 제어된 re-drive" 항목의 "errorPolicy='continue' 세그먼트 재개는 분리(defer)" 문단
  - 과거 결정 출처: `plan/in-progress/execution-engine-residual-gaps.md` L47 ("G2 의 ... `exec-intake-queue-impl.md` PR3 ... 으로 부분 해소")
  - 상세: target Rationale 은 G2 defer 를 정확히 재확인하고 있어 내용 자체는 모순 없음. 다만 근거로 남아있는 `execution-engine-residual-gaps.md` L47 의 "PR3(부분 해소)" 참조가 위 INFO#1 과 같은 이름 충돌의 연장선이다 — G2 문서가 "어느 PR3" 를 가리키는지 최신 상태에서 재확인이 필요하다(내용은 실질적으로 이번 diff 의 PR3 가 인프라 토대를 제공한다는 서술과 부합).
  - 제안: INFO#1 갱신 시 함께 `execution-engine-residual-gaps.md` L47 의 링크 텍스트도 최신 PR3 를 가리키도록 각주 보강(선택 사항, 낮은 우선순위).

## 결정 연속성 검증 결과 (문제 없음, 근거 명시)

- **"일괄 fail → re-drive" 전환은 무근거 번복이 아니다**: target `## Rationale` 에 "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (§7.1/§7.2/§7.5, PR3, 2026-07-04)" 항목이 신설되어, 왜 지금 전환하는지·왜 BullMQ stalled 자동 재배달을 아직 켜지 않는지(PR4 분리)·§4.2 active-running 직렬화 불변식 재검증·terminal 경계·기각 대안(신규 owner/heartbeat 컬럼, 주기적 스캔)까지 명시했다. "결정의 무근거 번복" 에 해당하지 않는다.
- **합의된 invariant 우회 아님**: §1.1 상태 전이표는 `running → running`(enum 불변, 소유권 이전만)이라 전이표 자체는 무변경으로 명시. §7.3 exactly-once(완료 노드 미재실행)는 `skipExecutedNodes` 가드로 유지되고 기본 경로(§7.5 case A/cycle 재실행)는 가드 미적용으로 기존 동작 보존. §1.3 `_retryState` "affected=1 인 쪽만 진행" 패턴이 `reclaimStuckRunningExecution` 에 그대로 일반화된다고 명시하고, 실제 §1.3 본문에도 해당 패턴이 확인된다.
- **기각된 대안 재도입 없음**: 오히려 과거 Rationale "재개 race 보장을 DB 원자 claim 으로" 항목이 확립한 "affected=1 인 쪽만 진행" 원자 claim 패턴을 그대로 계승·확장하고 있다. `WORKER_HEARTBEAT_TIMEOUT` 코드명은 유지하되 의미만 재정의(PR4 예약)한다고 명시해 하위 문서(`error-codes.md`, `3-error-handling.md`, `1-data-model.md`, `data-flow/3-execution.md`)가 전부 동기화됐다.
- **암묵적 가정 충돌 없음**: e2e 테스트(`execution-crash-redrive.e2e-spec.ts`)가 "완료 노드 재실행 안 됨"(row count 불변) + "FAILED/WORKER_HEARTBEAT_TIMEOUT 로 마킹 안 됨"(옛 fail-only 회귀 가드)을 명시적으로 검증해 새 Rationale 이 선언한 계약을 코드 레벨에서 뒷받침한다.
- **zombie race 노출은 은폐되지 않고 명시**: 원 워커가 살아있는 상태에서 stale 판정될 수 있는 잔여 race 를 Rationale·§7.5 본문에 "⚠️" 표기로 명시하고, "현행 fail-path 도 동일 노출(신규 회귀 아님)" 이라는 근거로 리스크를 투명하게 문서화했다 — 은폐된 가정 충돌이 아니다.

## 요약

target 변경은 실행 엔진의 크래시/재시작 복구 정책을 "stale RUNNING 일괄 fail" 에서 "원자 re-claim + 그래프 forward re-drive" 로 전환하는 실질적 정책 번복이지만, 이 번복은 spec 자신의 `## Rationale` 에 새 항목("크래시/재시작 RUNNING 세그먼트 제어된 re-drive, PR3, 2026-07-04")으로 왜/무엇을 기각했는지까지 상세히 기록돼 있고, §1.1/§1.3/§7.3/§4.2 의 기존 invariant 는 우회 없이 재확인·일반화됐으며, 하위 spec 문서(error-codes/error-handling/data-model/data-flow) 와 e2e 테스트까지 모두 동기화됐다. Rationale 연속성 관점에서 CRITICAL/WARNING 급 위반은 발견되지 않았다. 유일한 잔여 이슈는 plan 레벨의 문서 위생 문제로, `exec-intake-queue-impl.md` 가 자신이 미리 선언한 "PR3/PR4 상태 표기 갱신" 후속 의무를 아직 이행하지 않아 두 개의 서로 다른 "PR3" 라벨이 plan 트리 안에 병존한다(spec 자체에는 영향 없음, INFO 2건).

## 위험도

LOW
