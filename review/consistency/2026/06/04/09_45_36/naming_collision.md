# 신규 식별자 충돌 검토 — spec-update-exec-intake-queue-pr1

검토 대상: `plan/in-progress/spec-update-exec-intake-queue-pr1.md`
검토 일시: 2026-06-04

---

## 발견사항

### 1. 요구사항 ID 충돌

target 문서는 새로운 요구사항 ID를 부여하지 않는다. 변경 내용은 기존 §4·§9.3·§11 본문의 구현 상태 서술 갱신이며 요구사항 ID 신설이 없다. 충돌 없음.

---

### 2. 엔티티/타입명 충돌

- **[INFO]** `ExecutionRunTriggerType` — 신규 TypeScript 타입 (코드에만 존재)
  - target 신규 식별자: `ExecutionRunTriggerType` (§9.3 "After" 표 비고 인용, `execution-run.queue.ts:33`)
  - 기존 사용처: spec 어휘 중 동일 이름은 없음. `Trigger.type` (`webhook` / `schedule` / `manual`) 과 값 집합이 겹치나 spec `Trigger.type` 과 타입명이 다르고, 코드 파일 주석이 "spec `1-data-model.md §2.8` 어휘를 그대로 사용 (naming collision 회피)" 라고 명시해 의도적 분리를 선언함.
  - 상세: 충돌 없음. 단, spec 에는 이 타입명이 아직 문서화되지 않아 후속 spec 갱신 시 동일 이름으로 다른 의미가 부여되지 않도록 §9.3 비고에 `ExecutionRunTriggerType` 명칭을 명시하는 것이 바람직.
  - 제안: 적용 시 §9.3 "After" 표 비고에 `ExecutionRunTriggerType` 이 `Trigger.type` 어휘와 같은 값 집합을 쓰는 subset 타입임을 한 줄 주석으로 추가 권장(현재 target 비고에 이미 `ExecutionRunTriggerType` 이 인용돼 있어 허용 수준).

- **[INFO]** `resolveExecutionRunWorkerConcurrency` — 신규 함수명
  - target 신규 식별자: `resolveExecutionRunWorkerConcurrency` (§11 "After" 표 비고 인용)
  - 기존 사용처: `resolveContinuationWorkerConcurrency` 가 동형 패턴으로 이미 존재. 코드 주석도 "동일 규약" 을 명시.
  - 상세: 명명 패턴 일관성 유지 (`resolve<큐이름>WorkerConcurrency`). 충돌 없음.

---

### 3. API endpoint 충돌

target 문서는 새로운 API endpoint 를 도입하지 않는다. 충돌 없음.

---

### 4. 이벤트/메시지명 충돌

- **[INFO]** BullMQ 큐 이름 `execution-run` — 신규 큐
  - target 신규 식별자: 큐 이름 `execution-run` (§9.3 "After" 표 신규 행)
  - 기존 사용처: 현행 spec §9.3 테이블에는 `execution-continuation` 과 `background-execution` 두 큐만 등재. `execution-run` 은 미등재 상태이므로 이름 충돌 없음.
  - 상세: Redis BullMQ 내부 키 패턴은 `bull:execution-run:*` 이 되며, 기존 `bull:execution-continuation:*` / `bull:background-execution:*` 와 구별된다. 충돌 없음.

- **[INFO]** §9.3 "Before" 와 실제 spec 본문의 불일치
  - target "Before" 블록은 `| execution-run | (target — §4) ...` 행이 기존에 존재한다고 전제하나, 실제 `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` 의 §9.3 테이블(line 981–984)에는 해당 행이 없다. 현재 spec 에 `execution-run` 행이 미존재하므로 "Before" 가 묘사하는 현황과 실제 파일이 다르다.
  - 상세: 신규 식별자 충돌 관점에서는 문제 없음(기존 행과 충돌하지 않는다). 다만 plan 문서의 "Before" 서술이 실제 spec 현황과 다르므로 적용 절차에서 편집 위치 특정 시 혼선이 생길 수 있다. 식별자 충돌은 아니며, 적용 시 line 지정을 재확인해야 하는 운용 주의 사항.

---

### 5. 환경변수·설정키 충돌

- **[INFO]** `EXECUTION_RUN_WORKER_CONCURRENCY` — 신규 ENV var
  - target 신규 식별자: `EXECUTION_RUN_WORKER_CONCURRENCY` (§11 "After" 표 신규 행)
  - 기존 사용처: spec §11 (`/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` line 1081) 에는 `CONTINUATION_WORKER_CONCURRENCY` / `SIGTERM_GRACE_MS` / `RESUME_BULLMQ_ATTEMPTS` 가 등재. `EXECUTION_RUN_WORKER_CONCURRENCY` 는 미등재. 충돌 없음.
  - 상세: `CONTINUATION_WORKER_CONCURRENCY` 와 동형 네이밍 패턴(`<큐 식별자>_WORKER_CONCURRENCY`). 의미·스코프 모두 별개로 명확히 구분된다.

- **[INFO]** §11 "Before" 기준 — target 은 §11 ENV 표에 `EXECUTION_RUN_WORKER_CONCURRENCY` 행이 이미 "(구현 시 결정)" 으로 등재돼 있다고 전제
  - 실제 spec §11 (`## 11. Graceful Shutdown`, line 1060–1081) 에는 `SIGTERM_GRACE_MS`, `RESUME_BULLMQ_ATTEMPTS`, `CONTINUATION_WORKER_CONCURRENCY` 세 행만 존재하며 `EXECUTION_RUN_WORKER_CONCURRENCY` 행이 없다.
  - 상세: 신규 식별자 충돌 관점에서는 문제 없음(동일 이름의 기존 ENV 가 없다). 다만 plan 문서의 "Before" 서술과 실제 spec 불일치가 §9.3 와 동일하게 발생. 적용 시 편집 위치 재확인 필요. §4·§9.3·§11 모두 `execution-run` 관련 행이 없는 상태이므로 "Before" 가 묘사한 `(target — §4)` / `(구현 시 결정)` 등재 상태는 target 문서 작성 시점과 현재 spec 사이에서 중간 편집이 없었던 것으로 보임.

---

### 6. 파일 경로 충돌

target 문서는 기존 spec 파일(`spec/5-system/4-execution-engine.md`)의 본문을 수정하는 것이며 새 파일을 생성하지 않는다. 충돌 없음.

---

## 요약

target 문서가 도입하는 신규 식별자(`execution-run` 큐, `EXECUTION_RUN_WORKER_CONCURRENCY` ENV var, `ExecutionRunTriggerType` 타입, `resolveExecutionRunWorkerConcurrency` 함수)는 기존 spec 및 코퍼스 어느 곳에서도 다른 의미로 사용된 사례가 없다. 네이밍 패턴도 기존 `execution-continuation` / `CONTINUATION_WORKER_CONCURRENCY` / `resolveContinuationWorkerConcurrency` 의 관례를 일관되게 따른다. 실질적인 식별자 충돌은 없으며, 유일한 운용 주의 사항은 plan 문서의 "Before" 서술이 현재 실제 spec 내용과 일부 다르다는 점(§9.3 에 `execution-run` 행 미존재, §11 에 `EXECUTION_RUN_WORKER_CONCURRENCY` 행 미존재)이다. 이는 식별자 충돌이 아니라 plan 편집 시 "Before" 기준 위치를 신규 삽입으로 처리해야 함을 의미한다.

---

## 위험도

NONE
