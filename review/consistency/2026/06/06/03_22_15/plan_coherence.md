# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (`--impl-done`, scope=`spec/5-system`, diff-base=origin/main)

---

## 발견사항

### [CRITICAL] impl-concurrency-cap-pr2b 브랜치가 spec/5-system/4-execution-engine.md 를 Phase B 이전 모델로 덮어쓸 위험

- **target 위치**: `spec/5-system/4-execution-engine.md` §4.x "구현 메모", §7.4 "Worker 동작", §7.5 rehydration, §1.1 전이표의 `waiting_for_input → waiting_for_input` 행
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`, branch `claude/impl-concurrency-cap-pr2b`)가 `spec/5-system/4-execution-engine.md`를 수정 중
- **상세**: `exec-park-durable-resume` worktree(branch `claude/exec-park-pr-b2`)는 현재 PR-B2 구현을 진행 중이며, `spec/5-system/4-execution-engine.md`에 Phase B 단계 롤아웃 현황(PR-B1 완료·PR-B2 미적용), D6 resume_call_stack(V087), slow-path 일원화, `firstSegmentBarriers`/`pendingContinuations` 제거 예정을 반영했다. 그런데 `impl-concurrency-cap-pr2b` 브랜치가 같은 파일을 동시에 수정 중이며, 그 diff에는 다음이 포함된다:
  - `waiting_for_input → waiting_for_input` 전이 설명을 **"`pendingContinuations` 가 새 인스턴스에 재등록 (§7.5)"**으로 되돌려, Phase B에서 제거 결정된 fast-path를 현재형으로 서술
  - `exec-park-durable-resume` plan을 `4-execution-engine.md` frontmatter `pending_plans`에서 **삭제**
  - §6.2 "waiting_for_input 진입 시" 행을 Phase B 이전 형태로 기술(`Execution.resume_call_stack`, `Execution.conversation_thread`, `Execution.user_variables` 컬럼 누락)
  - §4.x "구현 메모"를 `firstSegmentBarriers` + detached coroutine 메커니즘을 **현재 동작**으로 서술하는 버전으로 유지

  `impl-concurrency-cap-pr2b` 브랜치가 spec push를 하면 `exec-park-durable-resume`의 Phase B 서술이 덮어써지거나 충돌하여 merge 시 Phase B 모델이 소실될 위험이 있다. `exec-park-durable-resume` plan은 이 위험을 이미 인지하고 "진행 메모 W4"에 기록했으나, 상대 worktree의 planner 착수조건에만 명기돼 있고 현재 B2 진행 중 실제 충돌 위험이 구체화된 상태다.
- **제안**: `exec-intake-queue-impl.md` PR2b를 담당하는 worktree가 spec 변경을 push하기 전, `exec-park-durable-resume`의 PR-B2가 완료·머지될 때까지 `spec/5-system/4-execution-engine.md` 수정을 동결하거나, PR-B2 완료 후 `impl-concurrency-cap-pr2b`가 origin/main(Phase B 반영 후)으로 rebase해야 한다. 또는 exec-park plan의 "W4 조치 필요"를 즉시 `exec-intake-queue-impl.md` PR2b 착수조건에 체크포인트로 명기해야 한다.

---

### [CRITICAL] impl-concurrency-cap-pr2b 브랜치가 spec/5-system/1-auth.md 에서 Rerank Config 행을 삭제

- **target 위치**: `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스, §4.1 감사 로그
- **관련 plan**: `plan/in-progress/rag-rerank-followup.md` — "RerankConfig RBAC 행 추가(§3.2)" 및 "감사 로그 rerank_config.* 추가(§4.1)"가 완료([x])로 기록됨
- **상세**: `rag-rerank-followup.md`는 `spec/5-system/1-auth.md §3.2`에 `Rerank Config | CRUD | CRUD | R | R` 행을 추가하고 §4.1 감사 로그에 `rerank_config.*`를 추가한 것을 완료로 체크했다. 그런데 `impl-concurrency-cap-pr2b` 브랜치의 diff는 해당 행을 삭제하고 있다(`-| Rerank Config | CRUD | CRUD | R | R`). 이 브랜치가 머지되면 rag-rerank-followup이 "완료"로 간주한 spec 변경이 되돌려진다.
- **제안**: `impl-concurrency-cap-pr2b` 브랜치의 `spec/5-system/1-auth.md` 수정에서 Rerank Config 행 삭제를 제거하거나, 해당 브랜치가 origin/main (Rerank Config 이미 추가된 상태)으로 rebase해야 한다. 현재 삭제는 PR2b의 실제 의도(PR2b는 concurrency cap 구현으로 auth spec과 무관)에서 벗어난 것으로 보인다.

---

### [WARNING] impl-concurrency-cap-pr2b 브랜치가 spec/5-system/1-auth.md 의 historical-artifact 예외 주석을 제거

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답표 아래의 `> **명명 — historical-artifact 예외**` 블록
- **관련 plan**: 해당 주석은 `error-codes.md §3 historical-artifact 레지스트리` 참조를 포함하며, PR-B1 `--impl-done` W3(skipReason scope 경계)가 "본 plan 범위 밖, 후속"으로 남겨둔 항목과 연관
- **상세**: `impl-concurrency-cap-pr2b`가 해당 블록을 삭제하고 있다. 이 주석은 초대 에러코드의 `lower_snake_case` 예외를 `error-codes.md §3`에 등재한 근거 서술로, auth spec의 단일 진실(historical-artifact 정당화)이다. 임의 삭제는 spec과 error-codes 레지스트리 간 정합을 깨뜨릴 수 있다.
- **제안**: PR2b가 auth spec을 수정하는 의도가 없다면 해당 삭제를 revert하고 rebase로 정렬해야 한다.

---

### [WARNING] exec-park-durable-resume plan이 D6(resume_call_stack V087)을 미해결 결정으로 남겨두었으나 target spec은 이를 확정 서술로 포함

- **target 위치**: `spec/5-system/4-execution-engine.md` §6.2 "waiting_for_input 진입 시" 행의 (e) `Execution.resume_call_stack jsonb`(V087), §7.5 "중첩 sub-workflow 재개" 절, §Rationale D6 항목
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` — D6는 "확정 2026-06-06, 사용자 결정"으로 기록되어 있고 PR-B2 설계 메모 8(a~e)에 구체적 구현 단계가 명시됨. 단, 아직 미구현([ ] 미완료 체크박스)
- **상세**: target spec이 D6를 완료형으로 서술하고 있지만 구현은 PR-B2의 일부로 아직 착수 전이다. spec의 "D6 확정" 서술이 구현 전 spec 선행 정의인지, 이미 구현된 것인지 경계가 모호하다. 다만 plan에서 명시적으로 "project-planner 위임" 커밋으로 spec을 선행 갱신하는 것이 이 프로젝트의 SDD 패턴임을 고려하면, WARNING 수준이다. 구현 착수 전 spec 선행은 허용되나 target 문서가 이를 "구현됨"으로 혼동할 수 있는 현재형으로 기술하는 부분에 대해 plan이 후속 spec 갱신 시 "구현 예정" 표기를 명시해야 할 수 있다.
- **제안**: exec-park-durable-resume plan의 PR-B2 완료 전까지 spec의 D6 관련 절이 "PR-B2에서 구현 예정" 또는 "설계 확정, 미구현" 표식을 포함하도록 유지할 것을 plan에 메모 추가 권장.

---

### [INFO] spec/5-system/9-rag-search.md 를 rag-eval-harness 브랜치도 수정 중

- **target 위치**: `spec/5-system/9-rag-search.md`
- **관련 plan**: `rag-eval-harness-b8cc46` worktree (branch `claude/rag-eval-harness-b8cc46`)
- **상세**: `rag-eval-harness-b8cc46` 브랜치도 `spec/5-system/9-rag-search.md`를 수정 중이다. `exec-park-durable-resume`의 target scope(`spec/5-system`)에 포함되지만 rag-search는 현재 PR-B2 변경의 직접 대상이 아니므로 충돌 가능성은 낮다. 단, 두 브랜치가 같은 파일을 동시에 수정할 경우 merge 시 주의 필요.
- **제안**: 작업 완료 순서에 따라 나중에 머지되는 브랜치가 rebase로 최신 main을 반영해야 한다.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- (없음) — 후보 4건 모두 Step 1(git merge-base --is-ancestor) ACTIVE, Step 2(gh pr list) 결과 empty(PR 없음). Step 3 fallback: 4건 모두 active 로 처리.

  후보 목록:
  - `exec-park-durable-resume` (branch `claude/exec-park-pr-b2`) — Step 1 ACTIVE, Step 2 PR 없음
  - `fix-webchat-envelope-unwrap-9519af` (branch `claude/fix-webchat-envelope-unwrap-9519af`) — Step 1 ACTIVE, Step 2 PR 없음
  - `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — Step 1 ACTIVE, Step 2 PR 없음
  - `rag-eval-harness-b8cc46` (branch `claude/rag-eval-harness-b8cc46`) — Step 1 ACTIVE, Step 2 PR 없음

  stale 판정 cascade Step 1/2 모두 음성. 4건 모두 active 로 처리 — 실제 stale 이면 `cleanup-worktree-all.sh --yes --force` 실행 후 재검토 권장.

---

## 요약

`spec/5-system` 전체를 대상으로 한 Plan 정합성 검토에서 **CRITICAL 2건, WARNING 2건, INFO 1건**이 발견됐다. 가장 심각한 것은 `impl-concurrency-cap-pr2b` 브랜치(worktree `impl-exec-concurrency-cap`)가 `spec/5-system/4-execution-engine.md`와 `spec/5-system/1-auth.md`를 동시에 수정 중이며, 각각 Phase B 모델 서술을 이전 상태로 되돌리거나 `rag-rerank-followup`이 완료 처리한 RerankConfig 행을 삭제하는 충돌이다. exec-park plan은 W4로 이 위험을 이미 인지했으나 `impl-concurrency-cap-pr2b`의 spec 변경 동결이나 PR-B2 완료 후 rebase 조율이 아직 실행되지 않았다. worktree 충돌 후보 4건 중 stale 0건, active 4건 분석. `impl-concurrency-cap-pr2b`의 spec/5-system 변경은 PR-B2 완료 후 rebase가 필수 선행 조건이다.

---

## 위험도

**HIGH**
