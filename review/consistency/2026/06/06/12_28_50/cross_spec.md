### 발견사항

- **[WARNING]** spec §4.x 의 PR-B2a "완료" 주장 vs plan 의 "머지 전" 상태 불일치
  - target 위치: `spec/5-system/4-execution-engine.md` §4.x 구현 메모 (line 406, 408) — "PR-B2a(top-level 멀티턴 AI) 완료" 로 명시, §Rationale "단계적 롤아웃" (line 1271) 도 동일 기술
  - 충돌 대상: `plan/in-progress/exec-park-durable-resume.md` line 151 — "진행: 구현 완료 + nest build 통과(commit, branch claude/exec-park-pr-b2). 남음: 실패 20 테스트 turn-park 모델 재작성 → dockerized e2e(top-level 멀티턴 park→kill→재개) → /ai-review + --impl-done → 머지."
  - 상세: spec 은 PR-B2a 가 이미 main 에 머지되어 top-level 멀티턴 AI 의 turn-단위 park + slow-path 일원화가 "완료"된 것으로 서술하고 있다. 그러나 plan 추적 문서에서 PR-B2a 는 branch `claude/exec-park-pr-b2` 상태로, 20개 테스트 실패 재작성·dockerized e2e·/ai-review·--impl-done 을 남겨두고 있어 아직 머지 전이다. spec 의 "현황(2026-06-06)" 표기가 plan 의 실제 진행 상태보다 앞서 있다.
  - 제안: (a) PR-B2a 가 실제 머지되면 양쪽이 정합되어 자동 해소됨. (b) 머지 전이면 spec §4.x 구현 메모의 PR-B2a "완료" 문구를 plan 과 일치하도록 "진행(branch claude/exec-park-pr-b2, 테스트·e2e 잔여)" 로 한시적 수정 권고. `0-overview.md §6.1` 의 "실행 엔진" 행은 PR-B2a 를 언급하지 않아 충돌 없음.

- **[INFO]** spec §7.4 Worker 동작 행의 "fast-path 제거됐고" 서술과 §4.x 과도기 설명의 표현 강도 차이
  - target 위치: `spec/5-system/4-execution-engine.md` §7.4 Worker 동작 행 (line 829) — "worker-side fast-path 는 제거됐고 재개 경로는 slow-path 로 일원화된다" (과거완료형)
  - 충돌 대상: 동일 파일 §4.x (line 406) — "PR-B2b(중첩 sub-workflow D6 + full B3) 미적용 … in-memory 머신(`pendingContinuations`/`firstSegmentBarriers`/`firePayload`/detached) **완전 제거**는 아직 미반영"; §Rationale (line 1271) — "위 §7.4 '`pendingContinuations` Map 제거' 서술은 **PR-B2b 완료 시점의 최종 상태**다"
  - 상세: §7.4 Worker 동작 행은 fast-path 제거를 현재 완료된 사실로 기술하나, §4.x 구현 메모와 §Rationale 은 "`pendingContinuations`/`firstSegmentBarriers` 완전 제거는 PR-B2b 완료 시점의 최종 상태"라고 명시한다. 동일 파일 내 서술이지만 §7.4 의 과거완료형 표현이 아직 미완인 full B3 와 혼동을 일으킬 수 있다. §7.4 내의 같은 Worker 동작 행에 이미 "(PR-B1)" 취소 경로 괄호 등으로 부분 한정이 있으나, fast-path 제거 서술에 "top-level 한정" 문구가 없어 독자가 중첩 경로까지 포함한 완전 제거로 오독할 여지가 있다.
  - 제안: §7.4 Worker 동작 행의 fast-path 제거 문구에 "(top-level — PR-B1/B2a 범위; 중첩 executeInline fast-path 는 PR-B2b 에서 완전 제거 예정)" 과 같은 한정 문구를 보강하면 §4.x·§Rationale 과의 표현 일관성이 높아진다. 충돌 수준이 아니라 명명 비일관성이므로 INFO 분류.

- **[INFO]** `spec/5-system/4-execution-engine.md` pending_plans 에 `plan/in-progress/exec-park-durable-resume.md` 가 등록되어 있으며, 현재 branch `exec-park-b2b-04a2f8` 에서 PR-B2a 구현이 진행 중
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter (line 8-12)
  - 충돌 대상: `spec/1-data-model.md` §2.13 Execution 엔티티 — V084(`conversation_thread`), V085(`user_variables`), V087(`resume_call_stack`) 컬럼이 모두 spec 에 기재되어 있고, 실제 마이그레이션 파일(V084/V085/V087.sql)도 존재해 데이터 모델 충돌은 없음
  - 상세: 데이터 모델(`spec/1-data-model.md §2.13`)의 Execution 엔티티 컬럼 정의와 실행 엔진 spec 의 §6.2 저장 전략이 V084/V085/V087 마이그레이션 기준으로 일치한다. V086 은 AgentMemory 인덱스용(`spec/1-data-model.md §809`)으로 exec-park 범위 외임. 번호 충돌 없음.
  - 제안: 확인 목적의 INFO 분류. 추가 조치 불필요.

### 요약

Cross-Spec 일관성 관점의 핵심 발견은 하나다: `spec/5-system/4-execution-engine.md §4.x` 가 PR-B2a(top-level 멀티턴 AI turn-park)를 "완료"로 기술하고 있으나, `plan/in-progress/exec-park-durable-resume.md` 는 이 PR 이 branch `claude/exec-park-pr-b2` 에 머지 전임을 명시한다. 이는 spec 이 아직 랜딩하지 않은 구현 상태를 선행 기술한 spec-plan 불일치로, 현재 worktree 가 해당 PR-B2a 를 구현하는 작업 공간인 만큼 impl-prep 관점에서 implementation 이 spec 을 따라야 하는지 아니면 spec 이 아직 미머지임을 명시해야 하는지를 명확히 할 필요가 있다. 데이터 모델(Execution 컬럼 V084/V085/V087)·API 계약·상태 머신·RBAC·계층 책임 관점에서는 `spec/1-data-model.md`, `spec/0-overview.md`, `spec/4-nodes/3-ai/1-ai-agent.md` 와의 모순이 발견되지 않는다. spec 내부의 §7.4 Worker 동작 행 fast-path 기술이 §4.x 과도기 설명과 표현 강도가 달라 보강 권고한다.

### 위험도

LOW

STATUS: OK
