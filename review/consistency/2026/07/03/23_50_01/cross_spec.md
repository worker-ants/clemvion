# Cross-Spec 일관성 검토 — spec-draft-crash-running-redrive.md

対象: `plan/in-progress/spec-draft-crash-running-redrive.md` (draft, target: `spec/5-system/4-execution-engine.md` §7.1/§7.2/§7.3/§7.5 + Rationale)

## 발견사항

### [WARNING] `spec/data-flow/3-execution.md` §3.1/§3.3 이 draft 반영 후 실제와 모순되는 canonical 서술로 남는다

- **target 위치**: draft "side-effect 점검 대상" 항목 1번째 — `spec/data-flow/3-execution.md §1.x(재시작 resume 서술) — 크래시 fail→re-drive 정합 확인(필요 시 planner 후속)`
- **충돌 대상**: `spec/data-flow/3-execution.md` §3.1 `execution.status` mermaid 상태 다이어그램(L237-253), §3.3 "비정상 종료 회수 — stale heartbeat + graceful shutdown" 표(L286-294), §1.1 L65 "crash 로 orphan 된 RUNNING row 는 §3.3 회수가 담당"
- **상세**: `data-flow/3-execution.md` 는 `spec/5-system/4-execution-engine.md` 와 별개의 SoT 영역(데이터 흐름 도메인 매핑)으로, 현재 다음을 **canonical** 서술로 명시한다.
  - mermaid: `running --> failed: retry 소진 실패 / EXECUTION_TIME_LIMIT_EXCEEDED / WORKER_HEARTBEAT_TIMEOUT / SERVER_INTERRUPTED` — `running → running` re-claim self-loop 이 없다.
  - §3.3 표: `recoverStuckExecutions` → "단일 atomic UPDATE — `failed` + `error.code='WORKER_HEARTBEAT_TIMEOUT'`. node_execution 정리는 수행하지 않는다" — draft 의 "일괄 fail 아니라 원자 re-claim + rehydration 재구동" 과 정면으로 다른 서술.
  - §3.3 제목·L65 의 "회수"(recovery) 라는 단어 자체는 draft 의 "re-claim" 방향과 우연히 호환되나, 표 안의 구체 동작(마킹=failed)은 그대로 두면 **거짓**이 된다.
  - draft 는 이 파일을 "확인(필요 시 planner 후속)" 수준으로만 명시해, 실제 갱신을 보장하지 않는다. `4-execution-engine.md` 를 반영하고 `data-flow/3-execution.md` 를 그대로 두면, 두 SoT 문서가 같은 `recoverStuckExecutions` 동작을 서로 다르게(하나는 fail-only, 하나는 re-claim+rehydrate) 기술하는 상태가 즉시 발생한다 — 이는 "필요 시" 가 아니라 **반드시 필요**.
- **제안**: draft 를 실제 spec 에 반영하는 동일 PR/커밋에서 `spec/data-flow/3-execution.md` 도 함께 갱신해야 한다 (아래 3곳):
  1. §3.1 mermaid 에 `running --> running: recoverStuckExecutions 원자 re-claim (§7.1/§7.5 case B)` self-loop 추가.
  2. §3.3 표의 `recoverStuckExecutions` 행을 "원자 re-claim(started_at 조건부 UPDATE, affected=1) → §7.5 rehydration 재구동. 재구동 반복 실패 시에만 §8 누적 active-running 한도 초과로 `failed`(`EXECUTION_TIME_LIMIT_EXCEEDED`)" 로 정정.
  3. §3.1 "`running → failed` 의 사유별 error.code" 표의 `WORKER_HEARTBEAT_TIMEOUT` 행("부팅 시 stale RUNNING 회수 (§3.3)")도 draft Δ1 의 "재구동조차 불가/한도 초과로 종결된 잔여" 의미 축소에 맞춰 갱신하거나, PR3 시점에는 이 코드가 실질적으로 발생하지 않게 됨(§8 코드로 대체)을 명시.
  - 이 갱신을 developer 단계로 미루는 대신, "side-effect 점검 대상" 항목을 "확인" 이 아니라 "갱신 필수(같은 PR)" 로 draft 자체에서 격상해 두는 것을 권장.

### [INFO] `spec/conventions/error-codes.md` §`WORKER_HEARTBEAT_TIMEOUT` 행이 PR3 중간 상태(re-drive)를 반영하지 못함

- **target 위치**: draft Δ1 "`WORKER_HEARTBEAT_TIMEOUT` 코드는 유지·의미 축소: … 재구동조차 불가/한도 초과로 종결된 잔여 표기에만 쓰인다"
- **충돌 대상**: `spec/conventions/error-codes.md` L63 — 현재 "(현) 부팅 시 절대 30분 stale RUNNING 일괄 회수, (target) BullMQ stalled-job 재배달 attempts 소진" 두 단계만 기술하고 PR3 의 중간 단계(제어된 re-claim + rehydration, 실패 시 실제 terminal 코드는 `EXECUTION_TIME_LIMIT_EXCEEDED`)를 반영하지 않는다.
- **상세**: 모순은 아니나("현재"/"target" 이분 서술은 여전히 유효한 골격), draft 가 §7.1/§8 조합으로 `WORKER_HEARTBEAT_TIMEOUT` 발생 경로를 사실상 없애고(§8 코드로 대체) "재구동조차 불가한 잔여" 표기로 좁힌다는 내용이 이 규약 문서에는 반영되지 않아 두 문서 사이에 설명 granularity 차이가 생긴다.
- **제안**: `error-codes.md` 의 해당 행에 PR3 반영 시점을 함께 갱신(또는 최소한 `4-execution-engine.md §7.1` cross-ref 유지로 충분 — 필수는 아니고 동기화 권장 수준).

### [INFO] `spec/5-system/3-error-handling.md` §1.4 의 `WORKER_HEARTBEAT_TIMEOUT` 설명도 같은 동기화 대상

- **target 위치**: 위와 동일 Δ1
- **충돌 대상**: `spec/5-system/3-error-handling.md` L76 — "active 세그먼트 job 이 BullMQ stalled 재배달 attempts 를 모두 소진(terminal worker failure) → `failed`" (§7.1 target 서술만 인용, PR3 현재 상태 언급 없음)
- **상세**: 직접 모순은 아님(§7.1 target 상태를 그대로 인용) — 다만 PR3 반영 후 실제 terminal 경로가 §8 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 사실상 이동한다는 draft 의 요지가 이 문서에는 반영되지 않는다.
- **제안**: 낮은 우선순위 — `4-execution-engine.md §7.1` 갱신 후 병행 확인 권장. 차단 요소 아님.

### [INFO] Rationale L1372 (§7.4, graceful shutdown under-count) — draft 셀프체크 결과 실제 무모순 확인됨

- **target 위치**: draft "side-effect 점검 대상" 2번째 — `spec/5-system/4-execution-engine.md §7.4 Rationale L1372 … PR4 stalled 문맥이므로 무변경, 단 §7.1 개정과 모순 없는지 확인`
- **충돌 대상**: `spec/5-system/4-execution-engine.md` L1372-1374 (SIGTERM 중단 세그먼트가 "stalled-job(§7.1)" 으로 재배달되면 `segmentStartMs` 부재로 active 시간 under-count)
- **상세**: 검증 결과 이 서술은 PR4(BullMQ stalled 자동 재배달)가 실제로 켜진 이후를 전제로 한 trade-off이며, PR3(draft)는 `maxStalledCount:0`/`attempts:1` 을 그대로 유지하므로 이 조합은 아직 발생하지 않는다 — draft 의 "무변경, 모순 없음" 판단은 **정확**하다. 별도 조치 불요, 정보성 확인만 기록.
- **제안**: 없음 (draft 판단 유지).

### [INFO] `plan/in-progress/execution-engine-residual-gaps.md` G2 defer 근거는 실제 기록과 일치

- **target 위치**: draft Δ5 "errorPolicy='continue' 세그먼트 재개는 분리(defer)"
- **충돌 대상**: `plan/in-progress/execution-engine-residual-gaps.md` G2 (L45-67)
- **상세**: G2 의 "장애물 3(cross-instance mid-execution 재개 인프라 부재)이 PR3 로 부분 해소되나 장애물 1·2(schema 노출·용어 매핑)는 남는다"는 draft Δ5 서술과 정확히 일치. 요구사항 ID·상태 충돌 없음 — 정보성 확인.
- **제안**: 없음.

## 항목별 요약 (점검 관점 6가지)

1. **데이터 모델 충돌** — 없음. draft 는 기존 컬럼(`started_at`, `execution_node_log`, `active_running_ms`)만 재사용하며 신규 컬럼/enum 값을 추가하지 않는다. `spec/1-data-model.md` §2.13 Execution 표와 직접 모순 없음.
2. **API 계약 충돌** — 해당 없음. draft 는 내부 recovery loop 동작만 다루며 외부 REST/WS API 계약을 변경하지 않는다.
3. **요구사항 ID 충돌** — 없음. draft 는 새 요구사항 ID 를 부여하지 않고, 기존 error code(`WORKER_HEARTBEAT_TIMEOUT`, `EXECUTION_TIME_LIMIT_EXCEEDED`, `RESUME_CHECKPOINT_MISSING` 등)만 참조한다.
4. **상태 전이 충돌** — **`spec/5-system/4-execution-engine.md` §1.1 자체와는 무모순**(draft Δ4 가 "case B 의 running→running re-claim 은 enum 변화가 아니므로 §1.1 전이표 무변경" 이라고 명시하고, 실제 §1.1 은 이미 `waiting_for_input → waiting_for_input` self-loop 패턴을 갖고 있어 정합적). 그러나 **`spec/data-flow/3-execution.md` §3.1/§3.3 의 별도 상태 다이어그램/표와는 위 WARNING 대로 충돌**한다 — 같은 도메인 엔티티(Execution)의 상태 머신이 두 영역에서 다르게 기술되는 전형적 케이스.
5. **권한·RBAC 모델 충돌** — 해당 없음.
6. **계층 책임 충돌** — 없음. `recoverStuckExecutions`(엔진 인프라)와 노드 설정(Integration 멱등)의 책임 분리는 §7.3 기존 원칙과 draft 가 명시적으로 정합시킨다("엔진은 완료 노드 미재실행까지만 보장, Integration 멱등은 노드 설정 책임").

## 요약

draft 자체가 대상으로 삼는 `spec/5-system/4-execution-engine.md` §7.1/§7.2/§7.3/§7.5 내부 정합성은 높다 — 기존 §1.1 상태 전이표, §7.4 원자 claim 패턴, §7.3 Integration 멱등 위임 원칙과 잘 맞물리며, 관련 plan(`exec-park-durable-resume.md` PR3 스코핑, `execution-engine-residual-gaps.md` G2)의 사실관계와도 어긋나지 않는다. 다만 draft 가 "side-effect 점검 대상" 으로만 가볍게 표기한 `spec/data-flow/3-execution.md` 는 **동일 Execution 엔티티의 상태 머신을 별도 mermaid 다이어그램·표로 canonical 기술**하고 있어, 이 파일을 함께 갱신하지 않으면 두 spec 영역이 `recoverStuckExecutions` 의 동작(fail-only vs re-claim+rehydrate)을 서로 다르게 서술하는 상태가 실제로 발생한다. 이는 단순 동기화 권장을 넘어, 실제 반영 시 반드시 같은 변경 단위로 처리해야 하는 WARNING 급 사안으로 판단한다. 그 외 `error-codes.md`/`3-error-handling.md` 의 관련 언급은 낮은 우선순위의 표현 granularity 차이(INFO)에 그친다.

## 위험도

MEDIUM
