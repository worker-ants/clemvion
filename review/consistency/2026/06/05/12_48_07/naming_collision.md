# 신규 식별자 충돌 검토 — `spec/5-system/` (exec-park-durable-resume impl-prep)

검토 모드: `--impl-prep`  
대상 범위: `spec/5-system/` (및 연동 `spec/1-data-model.md`, `plan/in-progress/exec-park-durable-resume.md`)  
검토 일시: 2026-06-05

---

## 발견사항

### [WARNING] V085 마이그레이션 번호 선점 충돌 위험

- **target 신규 식별자**: 마이그레이션 파일 `V085__execution_user_variables.sql` (plan §A3 `D2` 확정)
- **기존 사용처**: `plan/in-progress/exec-intake-queue-impl.md §PR2b` — `impl-exec-concurrency-cap` 워크트리가 동시 활성 상태이며, PR2b(워크스페이스/워크플로우 동시성 cap 구현)가 신규 마이그레이션(concurrency 관련 컬럼 추가)을 생성할 때 V085 번호를 시도할 가능성이 있다.  
  현재 상태: `impl-exec-concurrency-cap` 워크트리의 최신 마이그레이션은 `V083__execution_active_running_ms.sql` (V084 이전) — V085 를 아직 선점하지 않았으나 PR2b 코드 착수 시 경합 발생.  
  이전 consistency 검토(`review/consistency/2026/06/05/09_58_17/plan_coherence.md` W11 / `review/consistency/2026/06/05/10_12_32/SUMMARY.md` I10)에서도 동일 위험이 경고됨.
- **상세**: exec-park V084(`Execution.conversation_thread`) 이 main 랜딩된 뒤, 두 active branch(exec-park-durable-resume의 A3, impl-exec-concurrency-cap의 PR2b)가 각각 독립적으로 V085 번호를 선점하면 main 머지 시 번호 중복 에러 발생. 내용 자체는 다른 컬럼(각각 `user_variables`, concurrency 관련)이므로 기능 충돌은 없으나 Flyway 는 번호 중복을 fatal 에러로 취급한다.
- **제안**: PR-A3 착수 전 `impl-exec-concurrency-cap` PR2b 착수 상태를 확인한다. PR2b 가 먼저 V085 를 선점했다면 PR-A3 는 V086 으로 부여(`migrations.md §5/§6` rebase-renumber 절차). 두 branch 를 동시에 진행해야 하면 plan 간 번호를 사전 조율(예: exec-park 가 V085 고정, PR2b 는 V086 예약 표기).

---

### [INFO] `user_variables` 컬럼명 — 기존 `variables` 필드와의 의미 구분

- **target 신규 식별자**: `Execution.user_variables` (DB 컬럼, JSONB, V085)
- **기존 사용처**: `ExecutionContext.variables` (in-memory 런타임 필드, `spec/5-system/4-execution-engine.md §6.1`) — 시스템 `__*` + 사용자 정의분 혼합. `Execution.user_variables` 는 그 중 사용자 정의분(`__*` 제외)만 park 시 snapshot.
- **상세**: 의미 충돌은 없다. `variables` (runtime context 전체)와 `user_variables` (park snapshot, 시스템 제외분)의 역할 구분이 spec §6.1/§6.2/§7.5 에 명확히 문서화됨. 다만 `conversation_thread` 컬럼(A1 V084)이 `ExecutionContext.conversationThread` 의 스냅샷 매체인 것과 대칭 패턴이므로 혼동 가능성은 낮다.  
  `spec/1-data-model.md` line 466 과 `spec/5-system/4-execution-engine.md` line 670/729/887 에 동일 의미로 일관되게 사용됨.
- **제안**: 명명 자체는 적절하다. 구현 시 entity 파일(`execution.entity.ts`)의 TypeORM 컬럼 데코레이터 네이밍(`name: 'user_variables'`)이 A1의 `conversation_thread` 패턴(`@Column({ name: 'conversation_thread', type: 'jsonb', nullable: true })`)과 일치하도록 통일한다.

---

### [INFO] `restoreUserVariables` 함수명 — plan 제안, 기존 유사 패턴과의 일관성

- **target 신규 식별자**: `restoreUserVariables` (plan §A3 체크리스트에 명시된 예정 함수명)
- **기존 사용처**: `rehydrateConversationThread` (A1 구현 완료, `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` line 244). A1 은 `rehydrate*` 접두어를 사용.
- **상세**: plan 이 제안하는 `restoreUserVariables` 는 A1 의 `rehydrateConversationThread` 와 동일 역할(park snapshot → context 복원)이지만 접두어가 다르다(`restore*` vs. `rehydrate*`). 기능 중복·충돌은 없으나 코드베이스 내 명명 일관성이 떨어질 수 있다.
- **제안**: 구현 시 `rehydrateUserVariables` 로 이름을 통일해 A1 패턴(`rehydrateConversationThread`)과 대칭을 맞추는 것이 바람직하다. plan 자체의 구속력은 없으므로 구현 착수 시 결정.

---

### [INFO] `CHECKPOINT_SCHEMA_VERSION` / `schemaVersion` — 이미 구현 완료, 신규 충돌 없음

- **target 신규 식별자**: `CHECKPOINT_SCHEMA_VERSION` (상수), `schemaVersion` (checkpoint JSONB 필드)
- **기존 사용처**: A2a PR(`claude/exec-park-a2a` → main `7c32712f`)에서 이미 구현 완료. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 267 에 `const CHECKPOINT_SCHEMA_VERSION = 1` 선언, 여러 위치에서 일관 사용.
- **상세**: A3 의 미구현 식별자가 아니라 이미 존재하는 구현. spec §1.3 에도 동기화됨. 신규 충돌 없음.
- **제안**: 해당 없음.

---

### [INFO] `partialResult` / `collectionRetryCount` — IE 기존 식별자의 `_resumeCheckpoint` allow-list 편입, 충돌 없음

- **target 신규 식별자**: `partialResult`, `collectionRetryCount` — `_resumeCheckpoint` allow-list 에 information_extractor 고유 runtime state 로 추가
- **기존 사용처**: `spec/4-nodes/3-ai/3-information-extractor.md` 에서 IE 의 내부 상태 필드로 이미 존재(`output.partial.collectionRetryCount`, `_resumeState` 내부 등). A2b 구현 완료(`claude/exec-park-a2b-infoextractor`, 2026-06-05).
- **상세**: 기존 IE 필드명을 checkpoint allow-list 에 편입한 것으로, 새 이름 도입이 아님. `spec/5-system/4-execution-engine.md §1.3` 과 `spec/4-nodes/3-ai/3-information-extractor.md §_resumeState` 에서 양방향 일관 기술됨. 충돌 없음.
- **제안**: 해당 없음.

---

## 요약

target(`spec/5-system/` impl-prep, exec-park-durable-resume Phase A3) 이 도입하는 신규 식별자 중 **의미 충돌(동일 이름, 다른 의미)은 발견되지 않았다**. 주요 위험은 **마이그레이션 번호 V085 의 cross-branch 선점 경합**이며, 이는 이전 consistency 검토(W11/I10)에서도 경고된 바 있다 — `impl-exec-concurrency-cap` PR2b 가 V085 번호로 마이그레이션을 먼저 생성하면 번호 충돌이 발생한다. 기타 `user_variables` 컬럼명, `restoreUserVariables` 함수명 등은 기존 영역과 의미 혼동 소지가 없으며, `CHECKPOINT_SCHEMA_VERSION`/`partialResult`/`collectionRetryCount` 는 이미 구현 완료된 A2a/A2b 식별자로 신규 충돌 대상이 아니다.

## 위험도

LOW
