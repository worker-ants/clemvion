# Rationale 연속성 검토 결과

대상: `plan/in-progress/spec-update-exec-intake-queue-pr1.md`
기준 spec: `spec/5-system/4-execution-engine.md`, `spec/0-overview.md`

---

## 발견사항

### 발견사항 1

- **[WARNING]** `spec/5-system/4-execution-engine.md` Rationale "Phase 2 cont 후속 정리 §1" 의 "두 개뿐" 선언이 갱신 없이 무효화됨
  - target 위치: target draft §9.3 제안 변경 — `execution-run` 큐 행 신규 추가
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` → "Phase 2 cont 후속 정리 **1. task-queue 미존재 확정 (§9.3)**" (line 1199–1201)
  - 상세: 해당 Rationale 는 "실제 BullMQ 큐는 `background-execution` 과 `execution-continuation` **두 개뿐**이고, 일반 노드 실행은 `runExecution` 의 in-process while-loop 에서 직접 dispatch 한다. 별도 `task-queue` 는 존재하지 않으므로 §9.3 큐 목록과 §11 Graceful Shutdown 항목 2 모두 이를 전제로 한다." 고 명시한다. target draft 는 §9.3 에 세 번째 큐 `execution-run` 행을 추가하지만, 위 "두 개뿐" 선언을 폐기·갱신하는 새 Rationale 를 포함하지 않는다. "두 개뿐" 선언 자체는 "per-node task-queue 가 없다"는 사실을 확인하는 것이고 `execution-run` 도입과 논리적으로 양립 가능하지만, 문자적으로 §9.3 큐 목록과 §11 을 "전제로" 한다고 못 박아 뒀기 때문에 독자가 spec 과 Rationale 사이에서 혼란을 겪을 수 있다. 또한 §11 Graceful Shutdown 항목 2 는 "BullMQ `execution-continuation` / `background-execution` 의 active job 처리 중인 worker ..." 로 두 큐만 열거하는데, `execution-run` worker 종료 동작이 언급되지 않아 §11 이 stale 해진다.
  - 제안: `spec/5-system/4-execution-engine.md` Rationale "Phase 2 cont 후속 정리 §1" 의 "두 개뿐" 문구를 "세 개" 로 갱신하고, `execution-run` 이 추가된 경위(PR1 intake 큐 구현)를 한 줄 보충한다. 또는 target draft 의 spec 변경 영역에 §9.3 이미 `execution-run` 행 추가를 포함하면서 §11 Graceful Shutdown 항목 2 에 `execution-run` worker graceful shutdown 동작(신규 job consume 중단, active job 완료까지 대기)을 추가해야 함을 명시한다.

---

### 발견사항 2

- **[WARNING]** `spec/0-overview.md` Rationale §2.4 가 참조하는 실행엔진 Rationale 절 "per-node → execution-level intake 큐" 가 아직 존재하지 않음
  - target 위치: target draft 내 "관련 Rationale 발췌" → `spec/0-overview.md` Rationale §2.4 "채택" 항 (line 170 of prompt payload)
  - 과거 결정 출처: `spec/0-overview.md` `## Rationale` → "실행 엔진: Redis 큐 + 분산 워커 풀 (§2.4)"
  - 상세: `spec/0-overview.md` Rationale §2.4 는 (이미 갱신된 버전으로) "per-node task queue 를 채택하지 않은 근거는 [실행엔진 §Rationale 'per-node → execution-level intake 큐']" 로 cross-link 를 둔다. 그러나 `spec/5-system/4-execution-engine.md` `## Rationale` 에는 해당 제목의 절이 존재하지 않는다. target draft 는 §9.3 `execution-run` 행을 추가하고 §4 배너를 갱신하면서, 실제 결정 근거("왜 per-node task queue 대신 execution-level intake 큐인가")를 담는 Rationale 절 신설을 포함하지 않는다. cross-link 가 dead-link 상태로 유지된다.
  - 제안: target draft 의 spec 변경 영역(§4 또는 spec `## Rationale`)에 "per-node → execution-level intake 큐" 제목의 Rationale 절을 신설하고 배경·채택·기각 대안(per-node task-queue, aspirational §4.1–4.3 모델 등)을 기록한다. 이로써 dead-link 를 해소하고 §0-overview.md cross-link 가 정상 동작한다.

---

### 발견사항 3

- **[INFO]** `maxStalledCount:0` 으로 stalled 재배달 차단한 이유가 spec Rationale 에 미기록
  - target 위치: target draft §9.3 `execution-run` 행 After 텍스트: "maxStalledCount:0 (stalled 재배달 차단 — PR4 에서 멱등 rehydration 과 함께 상향)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` "Phase 2 cont 후속 정리 §3 heartbeat 기반 Recovery" (line 1209–1217) — stalled 재배달이 §7.1 heartbeat 모델(Planned)과 결합해야 안전하다는 방향 언급
  - 상세: target draft 의 §4 배너 After 와 §9.3 표 비고에 `maxStalledCount:0` 의 의도(stalled 재배달 사전 차단, PR4 stalled recovery와 결합해 상향)가 briefly 명시되어 있다. 이는 §7.1 heartbeat 기반 recovery(Planned)와의 연동 전제를 품고 있으나, 실행엔진 `## Rationale` 에 "`execution-run` 큐의 `maxStalledCount:0` 선택 이유" 항이 없다. `execution-continuation` 큐의 `removeOnComplete`/`removeOnFail`/`attempts` 결정에는 이미 충분한 Rationale 가 있으므로 신규 큐도 동일 수준의 근거 기록이 권장된다.
  - 제안: 실행엔진 spec `## Rationale` 에 "`execution-run` 큐 초기 옵션 선택" 절을 짧게 추가해 `attempts:1` (멱등 보장 불가 상태에서 재시도 없음), `maxStalledCount:0` (stalled 재배달 비활성 — PR4 멱등 rehydration 전 활성화 위험), `removeOnFail:false` (실패 job 보존 목적) 각각의 근거를 기록한다.

---

### 발견사항 4

- **[INFO]** §11 ENV 표 구조 변경 — `EXECUTION_RUN_WORKER_CONCURRENCY` 추가가 §11 Graceful Shutdown worker 동작 항목 2 갱신과 짝을 이루어야 함
  - target 위치: target draft §11 ENV 표 `EXECUTION_RUN_WORKER_CONCURRENCY` 행 추가
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §11 Graceful Shutdown 항목 2 (line 1067): "BullMQ `execution-continuation` / `background-execution` 의 active job 처리 중인 worker 는 현재 노드를 완료까지 진행. 신규 job consume 중단."
  - 상세: `EXECUTION_RUN_WORKER_CONCURRENCY` ENV 행 추가는 `execution-run` worker 의 존재를 §11 에 암묵적으로 전제한다. 그러나 §11 항목 2 는 두 기존 큐만 명시한다. target draft 는 §11 ENV 표만 변경하고 항목 2 본문(worker 열거)은 변경 범위 밖으로 명시("범위 외" 섹션에 없음)하지 않는다. 이는 발견사항 1 의 파생 이슈이나 독립적으로 체크할 필요가 있다.
  - 제안: target draft 의 "범위 외" 섹션에 "§11 항목 2 본문의 `execution-run` worker 언급 추가는 별도 spec 변경 또는 본 draft 범위에 포함" 으로 명시하거나, 해당 변경을 draft 에 포함한다.

---

## 요약

target draft 는 PR1 구현을 spec 에 동기화하는 SPEC-DRIFT 수정으로 방향은 올바르다. 그러나 `spec/5-system/4-execution-engine.md` Rationale "Phase 2 cont 후속 정리 §1" 의 "두 개뿐" 선언이 새 Rationale 없이 무효화되고(WARNING), `spec/0-overview.md` Rationale §2.4 가 cross-link 로 참조하는 "per-node → execution-level intake 큐" Rationale 절이 실행엔진 spec 에 아직 존재하지 않는(WARNING) 두 가지 Rationale 연속성 갭이 있다. 두 WARNING 은 명시적으로 기각된 결정을 재도입하거나 합의 원칙을 위반하는 것이 아니라, 결정 번복·신규 결정을 기록하는 Rationale 갱신·신설이 누락된 경우다. target draft 를 적용하기 전에 실행엔진 spec `## Rationale` 에 (a) "두 개뿐 → 세 개" 갱신 + `execution-run` 도입 경위, (b) "per-node → execution-level intake 큐" 신규 절 추가가 동반돼야 Rationale 연속성이 유지된다.

---

## 위험도

MEDIUM
