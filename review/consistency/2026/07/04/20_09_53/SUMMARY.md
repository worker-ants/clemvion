# consistency-check --impl-prep SUMMARY — admission 회귀 보강 (TEST-ONLY)

- 모드: `--impl-prep` scope=`spec/5-system/`
- 세션: `review/consistency/2026/07/04/20_09_53`
- 계획 작업: §8 concurrency-cap admission gate 회귀 테스트 추가 (production 코드·spec 무변경) — `exec-intake-followups.md`의 "admission 회귀 보강" 항목

## BLOCK: NO (착수 승인)

| checker | 결과 | 비고 |
| --- | --- | --- |
| cross_spec | BLOCK: NO | 신규 엔티티/엔드포인트/요구사항ID/상태전이/RBAC 없음. 테스트 대상 동작 전부 기존 §8 spec 과 일치. |
| rationale_continuity | BLOCK: NO | 테스트가 기존 불변식(advisory-lock 직렬화·조건부 UPDATE 단독 불충분·PENDING→RUNNING 한정·timeout cancel)을 고정 — 기각 대안 재도입 아님. |
| naming_collision | BLOCK: NO | 기존 e2e 파일/헬퍼(`createCapWorkflow`·`insertRunningBlocker`·`poll`) 재사용 + `§8` describe 라벨 유지 권고. |
| plan_coherence | BLOCK: NO | 항목 well-scoped·unblocked. WARNING(stale `pending_plans`)은 **#803 rebase 로 해소** (frontmatter·§4.1/§8 배너 이미 followups·구현완료로 갱신). |
| convention_compliance | ~~BLOCK: YES~~ → **검증된 오탐** | payload mis-scope(1-auth.md·10-graph-rag.md 번들, §8 본문 부재) + impl-prep 는 diff 부재가 정상. checker 스스로 "orchestrator-level target-collection miss, not a checker-specific defect" 로 귀속하고 regeneration 요청. 실 convention 위반 아님. |

## convention_compliance BLOCK 판정 근거 (오탐)

- 같은 mis-scoped payload 를 받은 cross_spec·rationale_continuity 는 **실제 §8 spec+코드로 fallback** 하여 BLOCK: NO 판정 (`4-execution-engine.md` §8 + `admitExecutionOrDefer` L2613~2692 직접 조회).
- impl-prep 모드는 착수 **전**이라 코드/테스트 diff 가 아직 없음 → "diff 를 못 찾음" 은 mode 상 정상. convention_compliance 만 이를 BLOCK 근거로 승격.
- 알려진 반복 오탐(memory: consistency-check payload mis-scope). → **작업 차단 사유 아님, 진행.**

## rebase 노트

worktree 가 stale origin/main(#803 미포함)에서 생성됨 → `git fetch` + `git rebase origin/main`(90ecea094, #803 merged 2026-07-04T11:02Z) 로 최신화. priority 3-tier + frontmatter 수정 포함. admission gate(PR2b) 는 #803 과 무관하므로 본 테스트 작업에 영향 없음.
