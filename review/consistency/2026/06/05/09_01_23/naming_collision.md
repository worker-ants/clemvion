# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 범위: `spec/5-system/` (exec-park-durable-resume plan 관련 식별자 중심)

---

## 발견사항

### WARNING — `Execution.conversation_thread` 컬럼이 `spec/1-data-model.md §2.13`에 미등록

- **target 신규 식별자**: `Execution.conversation_thread jsonb NULL` (DB 컬럼)
- **기존 사용처**:
  - `spec/5-system/4-execution-engine.md` L726–727, L883–884: 이 컬럼에 park 스냅샷을 commit/복원하는 것으로 명세
  - `spec/conventions/conversation-thread.md` L209, L213, L286, L330, L332, §8.4: "채택 완료"로 기술
  - `spec/4-nodes/3-ai/1-ai-agent.md` L1137, L1273, L1287: 동일 컬럼명으로 cross-reference
- **상세**: 위 4개 spec 파일은 모두 `Execution.conversation_thread jsonb NULL` 를 기정사실로 언급하나, 해당 컬럼은 **`spec/1-data-model.md §2.13 Execution` 필드 테이블에 나열되어 있지 않다**. 데이터 모델의 단일 진실 문서(`spec/1-data-model.md`)에 컬럼이 없으면 구현자가 마이그레이션 번호 결정·ORM 엔티티 정의·DTO 노출 여부 등을 추측해야 한다. 또한 migration 파일도 아직 없다 — 최신은 `V082__knowledge_base_rerank.sql`.
- **제안**: 구현 착수 전(PR-A1) `spec/1-data-model.md §2.13 Execution` 테이블에 `| conversation_thread | JSONB? | durable park resume 스냅샷 — waiting_for_input 진입 직전 ExecutionContext.conversationThread 전체를 commit. rehydration(§7.5)이 여기서 무손실 복원. [conversation-thread §4·§8.4](./conventions/conversation-thread.md#84-executionconversation_thread-컬럼-채택--durable-park-resume) |` 행을 추가하고, 마이그레이션 버전(V083 예정)을 명기한다.

---

### INFO — plan Phase 0 흡수 대상인 `exec-intake-queue PR3` 식별자와 본 plan 식별자 간 네임스페이스 확인 필요

- **target 신규 식별자**: 본 plan이 Phase 0에서 흡수하는 `impl-exec-intake-queue PR3`의 rehydration 일반화 관련 식별자들 (`NodeExecution.status` 재검증·완료노드 미재실행 가드)
- **기존 사용처**: `plan/in-progress/exec-intake-queue-impl.md` (별도 worktree에서 PR3 구현 예정 항목)
- **상세**: plan §Phase 0에서 "rebase/cherry-pick 또는 PR3 머지 후 rebase"로 통합하겠다고 기술되어 있으나, `exec-intake-queue-impl.md`의 PR3 항목이 아직 별도 plan에 살아있다. 두 plan 간 중복 구현이 시작될 경우 동일 함수명·코드 경로가 상충될 수 있다. 현재 충돌 식별자가 확인되지는 않으나 단일 worktree 통합 선언(D5) 전에 exec-intake-queue plan의 PR3 항목에 "→ exec-park-durable-resume 로 이관" 표기가 완료되어야 한다 (plan §통합 결정 요건).
- **제안**: Phase 0 착수 전 `plan/in-progress/exec-intake-queue-impl.md`의 PR3 항목에 cross-link + 이관 표기 완료 여부를 확인한다. 이관 표기가 없으면 다른 개발자가 exec-intake-queue worktree에서 PR3를 중복 구현할 수 있다.

---

### INFO — `_resumeCheckpoint` 적용 범위 서술이 `spec/5-system/4-execution-engine.md §1.3` 과 plan Phase A2 사이에 일시적 불일치 예정

- **target 신규 식별자**: `information_extractor` 노드의 `_resumeCheckpoint` (Phase A2에서 확장 예정)
- **기존 사용처**:
  - `spec/5-system/4-execution-engine.md` L111–113: "`ai_agent` 노드 한정"으로 명시 ("다른 `ai_conversation` 핸들러(`information_extractor`)는 checkpoint 를 영속하지 않으며")
  - plan §A2에서 "`information_extractor` 멀티턴도 ai_agent 와 동일하게 checkpoint 저장" 하도록 확장
- **상세**: 충돌이라기보다 plan A2 완료 시 spec L111–113의 "ai_agent 한정" 문구를 동기 갱신하지 않으면 spec 내에 모순이 생긴다. plan 자체도 "A2 채택 시 … 동기 갱신" 을 명기하고 있으므로 절차 자체는 인식돼 있다. 새 식별자 충돌은 아니지만, 구현 착수 순서(A2 코드 먼저, spec 갱신 나중)로 진행되면 consistency-check에서 False Critical이 발생할 수 있다.
- **제안**: PR-A2에서 spec 갱신을 동반 커밋으로 포함한다(plan이 이미 명시하고 있으나, 구현-spec 순서를 PR 단위로 묶는 것을 재확인).

---

## 요약

`spec/5-system/` 범위의 신규 식별자 충돌 위험은 낮다. 기존 환경 변수(`CONTINUATION_WORKER_CONCURRENCY`, `EXECUTION_RUN_WORKER_CONCURRENCY`, `AI_RETRY_STATE_TTL_MINUTES`, `RESUME_BULLMQ_ATTEMPTS`)는 spec과 codebase가 이미 정합하며, BullMQ 큐 이름(`execution-run`, `execution-continuation`)·Redis 키 네임스페이스(`exec:cont:seq:`, `exec:recover:lock`)·에러 코드(`RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE`)도 spec-codebase 일치가 확인된다. 유일한 실질적 누락은 `Execution.conversation_thread jsonb` 컬럼이 `spec/conversations-thread.md`·`spec/5-system/4-execution-engine.md`·`spec/4-nodes/3-ai/1-ai-agent.md` 세 곳에서 "채택 완료"로 기술되나 단일 진실인 `spec/1-data-model.md §2.13 Execution` 필드 테이블에 아직 없다는 점이다 — PR-A1 착수 전 데이터 모델 동기화가 필요하다.

## 위험도

LOW
