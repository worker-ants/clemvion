# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done)
**Target 문서**: `spec/5-system/4-execution-engine.md`
**구현 범위**: `execution-run` intake 큐 (PR1) — `codebase/backend/src/modules/execution-engine/queues/execution-run.*`

---

## 발견사항

### [INFO] spec/5-system/4-execution-engine.md — worktree 내 spec 갱신 확인됨

- **target 위치**: 전체 파일
- **충돌 대상**: origin/main 의 동일 파일
- **상세**: `git diff origin/main...HEAD -- spec/` 결과 `spec/5-system/4-execution-engine.md` 1개 파일만 변경됐으며, 내용은 다음 4곳을 일관성 있게 갱신했다.
  1. §4 banner — "미구현(Planned)" → "PR1 구현 완료" 마킹. per-node task-queue 설명은 삭제하고 execution-level active-segment 모델로 교체.
  2. §9.2 Redis 키 테이블 — `exec:run:seq:<executionId>` 항목을 "PR3/PR4 활성화 — PR1 미사용" 으로 정정. PR1 은 jobId = executionId 직접 사용.
  3. §9.3 BullMQ 큐 목록 — `execution-run` 행의 `attempts`, `maxStalledCount`, `jobId` 정책을 PR1 실제값으로 갱신.
  4. §11 Graceful Shutdown — 항목 2에 `execution-run` 큐 추가, `EXECUTION_RUN_WORKER_CONCURRENCY` 환경변수 기본값 1 로 확정.
- **제안**: 이미 처리됨. 추가 조치 불필요.

---

### [INFO] spec/0-overview.md §2.4 — origin/main 에 이미 반영됨

- **target 위치**: 구현 코드의 `execution-run` 큐 도입
- **충돌 대상**: `spec/0-overview.md §2.4 Execution Engine` / `§2.6 Data Layer` / `§ Rationale "실행 엔진: Redis 큐"`
- **상세**: `spec/0-overview.md` 는 이번 브랜치에서 변경되지 않았으며(`git diff origin/main...HEAD -- spec/0-overview.md` 출력 없음), origin/main 버전에 이미 `execution-run` intake 큐 기술이 포함돼 있다. 즉 아키텍처 개요 레벨 spec 은 이미 업스트림에서 선행 갱신됐고 본 PR 구현과 일치한다.
- **제안**: 이미 처리됨.

---

### [INFO] spec/1-data-model.md §2.8 — Trigger.type 어휘 일치

- **target 위치**: `execution-run.queue.ts` `EXECUTION_RUN_PRIORITY` 키 및 `ExecutionRunTriggerType`
- **충돌 대상**: `spec/1-data-model.md §2.8` Trigger.type enum (`webhook / schedule / manual`)
- **상세**: 구현은 `ExecutionRunTriggerType = 'manual' | 'webhook' | 'schedule'` 으로 정의하고 코드 주석에 "spec/1-data-model.md §2.8 어휘를 그대로 사용한다(naming collision 회피)" 라고 명시했다. Trigger.type enum 과 완전히 일치한다.
- **제안**: 이미 처리됨.

---

### [INFO] spec/5-system/15-chat-channel.md §3.1 CCH-AD-05 — routing context 등록 이동

- **target 위치**: `execution-engine.service.ts` — `execute()` 에서 `runExecutionFromQueue()` 로 `registerExecutionRouting` 이동
- **충돌 대상**: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-05` (routing context 등록 의무), `spec/5-system/4-execution-engine.md §7.5 Rationale "재개 경로의 outbound routing context 재등록"`
- **상세**: CCH-AD-05 는 `execute()` 단계가 아닌 "outbound routing context 가 등록돼 있어야" 라는 결과 의무만 규정한다. §7.5 Rationale 이 "재개 경로에서 consumer 측 인스턴스에서 등록해야" 패턴을 이미 확립했고, 구현은 이를 첫 세그먼트(`execution-run` worker)에도 동일 패턴으로 적용했다. chat-channel spec 본문에 `execute()` 에서 등록하라는 명시 제약이 없으므로 충돌 없다. 테스트 `runExecutionFromQueue — worker 진입점 + routing context 재등록` describe 가 CCH-AD-05 의무를 worker 경로에서 검증한다.
- **제안**: 이미 처리됨. chat-channel spec 에 "등록 시점 = job consumer 인스턴스 (work-stealing)" 설명을 추가하면 명확성이 높아지나 필수 아님.

---

### [INFO] spec/5-system/4-execution-engine.md §4.2 jobId 형식 — 명시적 유보

- **target 위치**: `execution-run.queue.ts` `buildExecutionRunJobId()` — PR1 은 seq 없이 executionId 직접 반환
- **충돌 대상**: spec §9.2 `exec:run:seq:<executionId>` 키 / §9.3 큐 목록 이전 형식 `<executionId>:run:<seq>`
- **상세**: origin/main spec 은 jobId 를 `<executionId>:run:<seq>` 로 기술했으나, 워크트리 spec 갱신에서 "PR1 은 jobId = executionId 직접 사용(1:1 enqueue dedup)" 으로 명확히 정정했다. seq 기반 jobId 는 PR3/PR4(re-enqueue 도입 시)로 명시적 유보. 구현(`buildExecutionRunJobId = executionId`)과 갱신 spec 이 일치한다.
- **제안**: 이미 처리됨.

---

### [INFO] spec/5-system/4-execution-engine.md §11 — Graceful Shutdown 항목 2의 스탈드 job 계약

- **target 위치**: `execution-run.processor.ts` — `maxStalledCount: 0`
- **충돌 대상**: spec §11 Graceful Shutdown 항목 2, §7.1 stalled-job 재배달 (미구현 Planned)
- **상세**: PR1 은 `maxStalledCount: 0` 으로 stalled 재배달을 차단한다. spec §7.1 의 stalled-job 재배달 목표("crash 재개")는 PR4 예정이고, spec 이 "PR1 은 stalled 재배달 차단" 을 명시적으로 기술했다. §11 항목 2 도 갱신돼 `execution-run` 큐가 추가됐다. 충돌 없음.
- **제안**: 이미 처리됨.

---

## 요약

Cross-Spec 일관성 관점에서 이번 PR1(`impl-exec-intake-queue`) 구현은 **충돌하는 발견사항이 없다**. 구현이 참조하는 모든 spec 영역 — `spec/5-system/4-execution-engine.md`(§4/§9/§11), `spec/0-overview.md`(§2.4/§2.6/Rationale), `spec/1-data-model.md`(§2.8 Trigger.type), `spec/5-system/15-chat-channel.md`(CCH-AD-05) — 이 구현 내용과 일치하거나 "PR1 구현 완료" 마킹으로 정합하게 갱신됐다. spec/5-system/4-execution-engine.md 만 이번 브랜치에서 변경되며, 그 내용은 기존 "목표 아키텍처(Planned)" 표기를 "PR1 구현 완료" 로 전환하고 미구현 잔여(PR2-4)를 명시적으로 표기하는 필요한 갱신이다. 외부 영역(data-model, chat-channel, 0-overview)과의 데이터 모델·API 계약·상태 전이·RBAC 충돌은 발견되지 않았다.

## 위험도

NONE
