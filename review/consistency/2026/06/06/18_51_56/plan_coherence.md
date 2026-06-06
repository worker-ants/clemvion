# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
Target plan: `plan/in-progress/exec-park-resume-dispatch-registry.md` (worktree: exec-park-followup-272c4f)

---

## 발견사항

### [WARNING] impl-concurrency-cap-pr2b worktree 와 execution-engine.service.ts 코드 경합
- target 위치: `exec-park-resume-dispatch-registry.md` §S3·S4 — `execution-engine.service.ts` 에 `resumeTurnRegistry`·`dispatchResumeTurn` 추가 + `driveResumeAwaited`·`driveResumeFrame` 두 분기 블록 대체
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` PR2b — `impl-concurrency-cap-pr2b` 브랜치가 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`·`execution-engine.service.spec.ts` 를 동시에 수정 중
- 상세: impl-concurrency-cap-pr2b 브랜치는 PR 미제출 상태(Step 2 결과 empty)이나 stale 신호 없음 → Step 3 fallback 으로 active 처리. 두 worktree 가 같은 `execution-engine.service.ts` 를 동시에 수정하면 머지 순서 따라 충돌 발생. exec-intake-queue-impl.md 가 이미 "PR-B2 머지 후 rebase 선행" 을 필수 조건으로 명시하고 있어 PR2b 는 현재 blocked 상태지만 rebase 시 target plan 의 변경과 충돌 가능성 있음.
- 제안: target plan 의 S3·S4 구현 전 impl-concurrency-cap-pr2b 브랜치와의 파일 수정 범위를 조율한다. target plan 완료 및 머지 후 PR2b 가 rebase 하는 순서가 안전하다. 또는 target plan 의 PR 머지 전에 PR2b 착수 조건(PR-B2 rebase 선행 필수)이 아직 미충족임을 확인해 병렬 진행이 실제로는 위험 낮음을 문서화한다.

---

### [INFO] exec-park-b2a-followup-9fdefc worktree 는 stale (PR #502 MERGED)
- target 위치: `plan/in-progress/exec-park-b2a-followup.md` (frontmatter worktree: exec-park-b2a-followup-9fdefc)
- 관련 plan: `exec-park-b2a-followup.md` — spec/5-system/7-llm-client.md·14-external-interaction-api.md 수정 완료, PR #502 MERGED
- 상세: Step 1 ancestor 검사 — ACTIVE (squash merge). Step 2 PR state — MERGED. stale skip.
- 제안: `./cleanup-worktree-all.sh --yes --force` 실행 권장 (또는 `exec-park-b2a-followup-9fdefc` worktree 수동 제거).

---

### [INFO] rag-followup-efsearch-b6c8e8 worktree 는 stale (PR #503 MERGED)
- target 위치: `plan/in-progress/rag-followup-efsearch.md` (frontmatter worktree: rag-followup-efsearch-b6c8e8)
- 관련 plan: `rag-followup-efsearch.md` — spec/5-system/4-execution-engine.md·14-external-interaction-api.md 수정 포함, PR #503 MERGED
- 상세: Step 1 ancestor 검사 — ACTIVE (squash merge). Step 2 PR state — MERGED. stale skip. 단, 체크아웃된 worktree 자체는 물리적으로 여전히 존재함.
- 제안: `./cleanup-worktree-all.sh --yes --force` 실행으로 물리 worktree 정리 권장.

---

### [INFO] spec-sync-audit worktree 는 stale (PR #443 MERGED)
- target 위치: `plan/in-progress/spec-sync-auth-gaps.md`, `plan/in-progress/spec-sync-mcp-client-gaps.md` 등 `worktree: spec-sync-audit` 참조 다수
- 관련 plan: spec-sync-audit 워크트리를 참조하는 모든 spec-sync-* 계획
- 상세: Step 1 ancestor 검사 — ACTIVE (squash merge). Step 2 PR state — PR #443 MERGED. stale skip. 브랜치는 존재하지만 body 는 main 에 흡수됨. spec-sync-auth-gaps.md·spec-sync-mcp-client-gaps.md 등이 동일 worktree 를 참조하지만 실제 worktree 체크아웃은 없는 상태(git worktree list 에 미노출) — 단순 frontmatter 메타데이터 잔존.
- 제안: spec-sync-* plan 들의 frontmatter `worktree` 항목 cleanup 고려. 별도 worktree 할당 없이 작업 진행 중으로 보임.

---

### [INFO] 미해결 결정 — exec-intake-queue-impl.md PR2b 의 "active-running 직렬화 불변식 재검증"
- target 위치: `exec-park-resume-dispatch-registry.md` 는 spec 변경 없음으로 명시. 그러나 `driveResumeAwaited`·`driveResumeFrame` 재진입 경로 구조 변경을 수행
- 관련 plan: `exec-intake-queue-impl.md` PR2b "착수 전 필수 — active-running 직렬화 불변식 재검증" — `retry_last_turn` 등 동시 active 세그먼트 경로 추가 시 `assertActiveTimeWithinLimit`↔`updateExecutionStatus` 비원자성 race 전환 우려
- 상세: target plan 은 선택 로직과 dispatcher 구조를 registry 기반으로 추출하는 순수 리팩토링이며 새 재진입 경로를 만들지 않는다고 명시. 직렬화 불변식 리스크는 target plan 이 아닌 PR2b 가 `retry_last_turn` 등을 추가할 때 발생. 충돌이나 선행 조건 미달은 아니나, target plan 완료 후 PR2b 가 참조할 때 registry 구조를 인식한 재검증이 필요함을 추적.
- 제안: 필요 시 `exec-intake-queue-impl.md` PR2b 항목에 "target plan 머지 후 registry 기반 dispatch 구조 고려한 불변식 재검증" 메모 추가.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `exec-park-b2a-followup-9fdefc` (branch `claude/exec-park-b2a-followup-9fdefc`) — Step 1 ACTIVE (squash merge), Step 2 PR #502 MERGED
- `rag-followup-efsearch-b6c8e8` (branch `claude/rag-followup-efsearch-b6c8e8`) — Step 1 ACTIVE (squash merge), Step 2 PR #503 MERGED
- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 1 ACTIVE (squash merge), Step 2 PR #443 MERGED

위 3개 worktree 가 물리적으로 정리되지 않은 상태이므로 `./cleanup-worktree-all.sh --yes --force` 실행을 권장한다.

---

## 요약

`exec-park-resume-dispatch-registry.md` 는 `spec/5-system/4-execution-engine.md` 를 직접 수정하지 않으며("spec 변경 불요") `execution-engine.service.ts` 내부 리팩토링만 수행하는 자기완결형 작업이다. 미해결 결정 우회 없음, 선행 plan 미해소 조건 없음, 후속 항목 무효화 없음. 단, `impl-concurrency-cap-pr2b` 브랜치가 동일한 `execution-engine.service.ts` 를 수정 중이며 PR 미제출·stale 신호 없음으로 active 처리된다 — 두 브랜치가 실제 병렬 진행될 경우 병합 충돌 위험이 있어 WARNING 으로 분류한다. 다만 exec-intake-queue-impl.md 이 PR2b 착수 전 "PR-B2 머지 후 rebase 선행 필수" 블로커를 명시하고 있어 실제 동시 활성 상태는 아님 — WARNING 이지만 즉시 차단 필요성은 낮다. worktree 충돌 후보 5건 중 stale 3건 skip, active 1건(impl-concurrency-cap-pr2b) + 현재 target worktree(exec-park-followup-272c4f) 분석.

---

## 위험도

LOW
