# Cross-Spec 일관성 검토 결과

**검토 모드**: --impl-prep  
**대상 변경**: 06-concurrency M-2 — ShutdownStateService `registerInFlight` early-return 제거 (Option A 채택)  
**검토 시각**: 2026-06-24

---

## 발견사항

### [WARNING] Option A 채택 vs Plan 문서 "권장: B" 미갱신

- **target 위치**: 검토 대상 변경 설명 (Option B 의도적 거절 선언)
- **충돌 대상**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/06-concurrency.md` §M-2 (line 135: "**권장**: B")
- **상세**: plan 문서는 "권장: B — A 만으로는 §11.2 가 이미 약속한 '신규 job consume 중단' 을 달성 못함" 으로 명시하고 있다. 이번 구현은 Option A 만 채택하고 B 를 "BullMQ `queue.pause()` 가 전역 Redis 플래그 — 타 인스턴스 stall" 이유로 거절한다. 이 거절 근거는 타당하지만, plan 문서의 "권장 B" 서술이 잔존하면 후속 리뷰어가 "왜 권장안을 따르지 않았나" 또는 "B 가 아직 미구현인가" 로 혼란을 겪을 수 있다.
- **제안**: plan 문서 §M-2 의 "권장: B" 를 "채택: A (B 거절 — `queue.pause()` 는 전역 Redis 플래그, 타 인스턴스 stall 위험. `@nestjs/bullmq WorkerHost` framework shutdown 이 §11.2 신규 consume 중단을 이미 충족)" 로 갱신하거나, 구현 완료 후 결정 근거를 inline 기록한다.

---

### [INFO] §11.2 "신규 job consume 중단" 이행 수단 — spec 미명시

- **target 위치**: Option B 거절 근거 ("execution workers 가 `@nestjs/bullmq WorkerHost` 라 framework 가 shutdown 시 worker close — §11.2 신규 consume 중단 이미 충족")
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §11.2`
- **상세**: §11.2 는 "신규 job consume 중단" 을 계약으로 명시하지만, 그 이행이 명시적 `pause()` 호출인지 framework-level worker close 인지를 spec 이 특정하지 않는다. Option A 가 `@nestjs/bullmq WorkerHost` 의 내장 shutdown 동작에 의존해 §11.2 를 만족한다고 주장하는데, 이 framework 의존 이행 경로가 spec 어디에도 기술되지 않는다. 향후 BullMQ 버전 업그레이드 / framework 교체 시 조용히 §11.2 계약이 깨질 수 있다.
- **제안**: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §11` 하위에 "신규 consume 중단은 `@nestjs/bullmq WorkerHost` 의 framework-level `onApplicationShutdown` → worker.close() 경로로 이행되며, 별도 `queue.pause()` 를 호출하지 않는다 — `queue.pause()` 는 전역 Redis 플래그로 타 인스턴스까지 stall 시키므로 multi-instance 환경에서 금지" 를 Rationale 또는 Phase 1 구현 범위 노트로 추가한다. 이는 "spec 변경 불요(spec 이 옳고 구현이 따라감)" 라는 본 변경의 전제와 모순이 아님 — 행동 계약(§11.2)은 옳고, 이행 수단의 명세를 보완하는 것이다.

---

### [INFO] `data-flow/3-execution.md §3.3` 의 `registerInFlight` 서술과 변경 후 상태 동기화

- **target 위치**: 변경 대상 `registerInFlight` 동작
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/data-flow/3-execution.md §3.3` (§3.3 표 "대상" 셀)
- **상세**: `data-flow/3-execution.md §3.3` 는 "`registerInFlight` 로 본 인스턴스가 추적 중인 NodeExecution/Execution 만" drain 대상으로 기술한다. 현재 구현의 `if(shuttingDown) return` 은 shutdown 중 시작된 노드를 추적에서 누락시켜 이 서술과 모순이 된다. Option A 구현(early-return 제거) 후에는 data-flow 서술과 일치하게 된다 — 충돌이 아니라 구현이 spec 을 따라가는 정합화임. 단, 현재 data-flow 문서가 "shutdown 중 시작된 노드도 추적 대상"임을 명확히 단언하지 않는다.
- **제안**: 구현 후 `/Volumes/project/private/clemvion/spec/data-flow/3-execution.md §3.3` 표의 "대상" 셀에 "shutdown 중 `registerInFlight` 된 노드 포함(early-return 없음)" 부연 추가를 선택적으로 검토. INFO 등급이므로 차단 요건 없음.

---

## 요약

M-2 변경(Option A: `registerInFlight` early-return 제거)은 `spec/5-system/4-execution-engine.md §11.4` 및 `spec/data-flow/3-execution.md §3.3` 의 계약("본 인스턴스가 추적 중인 NodeExecution 을 `failed` + `SERVER_INTERRUPTED` 로 마킹")과 직접 충돌이 없으며, "spec 이 옳고 구현이 따라감" 전제가 spec 내용과 일치한다. 주요 긴장점은 plan 문서(`06-concurrency.md`) 가 "권장 B" 로 기술된 채 잔존해 Option A 단독 채택 결정이 문서화되지 않는다는 것(WARNING)과, §11.2 의 "신규 consume 중단" 이행 수단이 spec 에 명시되지 않아 framework 의존 사실이 spec 에서 추론 불가능하다는 것(INFO)이다. 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC 차원의 충돌은 없다.

---

## 위험도

LOW
