# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**MEDIUM** — retryLastTurn/applyRetryLastTurn 단위 테스트 전면 삭제로 spec 명시 동작의 회귀 보호가 소실됐으나 Critical 은 없음. 나머지 checker 는 LOW/NONE.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `retryLastTurn` / `applyRetryLastTurn` 단위 테스트 전면 삭제 — 실제 서비스 코드에 메서드 존재함에도 `_retryState` TTL/idempotency·`failed→running` 전이·WS ack 에러 코드의 회귀 보호 소실 | `execution-engine.service.spec.ts` (describe 블록 전량 삭제) | `spec/5-system/4-execution-engine.md §1.3, §1.1`, `spec/5-system/6-websocket-protocol.md §4.2`, `spec/4-nodes/3-ai/1-ai-agent.md §7.9` | `retryLastTurn`·`applyRetryLastTurn` describe 블록 복원. 또는 해당 메서드가 실제 제거/이름 변경됐다면 spec §1.3·§6-ws §4.2 동시 갱신 |
| 2 | Cross-Spec | `driveResumeDetached` JSDoc 이 옛 detach 모델("void 로 호출") 유지 — 실제 `await` 호출 및 spec §7.5 "awaited" 서술과 불일치 | `execution-engine.service.ts` line 1815-1822 JSDoc | `spec/5-system/4-execution-engine.md §7.5`, `§4 구현 메모` | JSDoc 을 "worker 가 직접 await — 단발 turn 처리기가 한 세그먼트만 처리하고 반환하므로 deadlock 위험 없음"으로 갱신 |
| 3 | Convention Compliance | `spec/5-system/4-execution-engine.md §1.1` `failed→running` 행의 `§12.2` 링크 존재 여부 미확인 — spec 내부 링크 무결성 가드 대상 | `spec/5-system/4-execution-engine.md §1.1` | `spec-link-integrity.test.ts` (build 가드) | `§12.2` 앵커 실재 확인; 없으면 링크 제거 또는 정확한 절 번호로 수정 |
| 4 | Plan Coherence | `impl-concurrency-cap-pr2b` worktree 가 spec 착수 시 Phase B 이전 서술 역행 위험 — PR-B2b 머지 후 rebase 의무가 `exec-intake-queue-impl.md` 착수조건에 미반영 가능 | `plan/in-progress/exec-intake-queue-impl.md` | `spec/5-system/4-execution-engine.md` (Phase B 서술) | `exec-intake-queue-impl.md` 착수조건에 "origin/main rebase (PR-B2b 포함) 선행" 명기; `impl-concurrency-cap` worktree owner 와 조율 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `pendingContinuations`/`firstSegmentBarriers`/`runAiConversationLoop` 등 in-memory 머신 테스트 전면 삭제 — spec full B3 제거 선언과 정합 | spec.ts (다수 describe 블록 삭제) | 무조치 |
| 2 | Cross-Spec | `CALL_STACK_SCHEMA_VERSION` / `ParkReleaseSignal` 임포트 추가 — spec §6.2/§7.5 계약과 일치 | `execution-engine.service.spec.ts` 상단 import | 무조치 |
| 3 | Cross-Spec | `driveCallStackResume`/`driveResumeFrame`/`injectInvokerOutput` 신규 단위 테스트 5종 — spec §7.5 frame-by-frame 재진입 계약과 일치 | spec.ts `describe('driveCallStackResume ...')` | 무조치 |
| 4 | Cross-Spec | `stageDurableResumeSnapshot` 테스트 신규 추가 — spec §6.2 park commit (e) resume_call_stack 영속과 일치 | spec.ts stageDurableResumeSnapshot describe | 무조치 |
| 5 | Cross-Spec | `spec/4-nodes/3-ai/1-ai-agent.md §7` 에 `runAiConversationLoop` 언급 잔존 가능성 — turn-단위 park 전환 주석 필요 | `spec/4-nodes/3-ai/1-ai-agent.md §7` | 해당 언급 있으면 "turn-단위 park(`processAiResumeTurn`)으로 대체" 주석 추가 |
| 6 | Convention Compliance | `spec/conventions/execution-context.md` 선례 목록과 `_contextKey` 정의 단락 중복 존재 — SoT 관계 불명확 | `spec/conventions/execution-context.md` | 선례 목록에 "상세 정의는 아래 단락 참조" 연결 또는 중복 제거 |
| 7 | Convention Compliance | `plan/in-progress/exec-park-durable-resume.md` 가 PR-B2b 완료 선언 후에도 `plan/complete/` 미이동 | `plan/in-progress/exec-park-durable-resume.md` | `plan/complete/`로 이동, `spec_impact` 선언 추가, `pending_plans` 에서 해당 항목 제거 (나머지 3개 plan은 in-progress이므로 status: partial 유지) |
| 8 | Convention Compliance | `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` 가 `spec/conventions/execution-context.md` `code:` 미등록 | `spec/conventions/execution-context.md` frontmatter `code:` | `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` 또는 glob 추가 |
| 9 | Convention Compliance | `codebase/backend/src/shared/execution-resume/park-release-signal.ts` 가 `spec/5-system/4-execution-engine.md` `code:` glob 미매칭 | `spec/5-system/4-execution-engine.md` frontmatter `code:` | `codebase/backend/src/shared/execution-resume/**` glob 추가 |
| 10 | Plan Coherence | plan 상단 B1/B3 체크리스트 `[ ]` 형식 미갱신 — 진행 메모에는 완료 명기 | `plan/in-progress/exec-park-durable-resume.md` §B1(L93·L94), §B3(L102·L103) | `[ ]` → `[x]` (PR-B2b, commit 2dbb31b6) 갱신 권장 |
| 11 | Plan Coherence | `exec-park-durable-resume` worktree (branch `claude/exec-park-pr-b2`) stale 미정리 — PR #494 MERGED | `.claude/worktrees/exec-park-durable-resume` | `git worktree remove .claude/worktrees/exec-park-durable-resume` 실행 권장 |
| 12 | Naming Collision | `PARK_RELEASED`(Symbol)와 `ParkReleaseSignal`(class) 이름 유사하나 역할 명확히 분리됨 | `execution-engine.service.ts` | 무조치 (코드 주석으로 이미 설명) |
| 13 | Naming Collision | `CALL_STACK_SCHEMA_VERSION`과 `CHECKPOINT_SCHEMA_VERSION` 현재 값 동일(`1`) — 의도적 독립 설계 | `resume-call-stack.types.ts`, `execution-engine.service.ts` | 무조치 (JSDoc 독립성 명시) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | retryLastTurn/applyRetryLastTurn 테스트 삭제로 spec §1.3·§6-ws §4.2 회귀 보호 소실 (WARNING); driveResumeDetached JSDoc stale (WARNING); 신규 테스트(driveCallStackResume 등)는 spec과 정합 |
| Rationale Continuity | NONE | 모든 변경이 spec Rationale 결정의 구현 실현. 기각된 대안(sticky fast-path·detach coroutine·executeInline 재호출) 재도입 없음 |
| Convention Compliance | LOW | plan 라이프사이클 미동기화(exec-park-durable-resume.md), shared/ 신설 파일 code: 미등록, §12.2 링크 검증 필요 — 모두 INFO/WARNING 수준 |
| Plan Coherence | LOW | PR-B2b 구현과 plan 체크리스트 완전 정합; impl-concurrency-cap rebase 의무 명기 필요(WARNING); B1/B3 체크박스 형식 미갱신(INFO) |
| Naming Collision | NONE | 신규 식별자 모두 기존과 충돌 없음. PARK_RELEASED/ParkReleaseSignal 역할 명확히 구분 |

## 권장 조치사항

1. **[WARNING #1 해소 — 최우선]** `retryLastTurn` / `applyRetryLastTurn` 단위 테스트 복원 또는 spec §1.3·§6-ws §4.2 동시 갱신: 실제 서비스 코드에 해당 메서드가 존재하고 spec 이 명시한 `_retryState` TTL/idempotency·에러 코드 계약의 회귀 보호가 없다. 두 메서드가 실제로 제거됐다면 spec 갱신이 선행되어야 한다.
2. **[WARNING #2]** `driveResumeDetached` JSDoc 갱신: "void 로(detach) 호출" → "worker 가 직접 await, 단발 turn 처리기가 한 세그먼트만 처리하고 반환하므로 deadlock 위험 없음"으로 수정.
3. **[WARNING #3]** spec §1.1 `§12.2` 앵커 존재 확인 후 없으면 링크 제거 또는 올바른 절 번호 수정 (`spec-link-integrity` 가드 대상).
4. **[WARNING #4]** `plan/in-progress/exec-intake-queue-impl.md` 착수조건에 "origin/main rebase (PR-B2b 포함) 선행" 명기; `impl-concurrency-cap` worktree owner 와 조율.
5. **[INFO #7]** `plan/in-progress/exec-park-durable-resume.md` → `plan/complete/` 이동 및 `spec_impact` 선언 추가 (plan-lifecycle §3).
6. **[INFO #8, #9]** `spec/conventions/execution-context.md` 및 `spec/5-system/4-execution-engine.md` `code:` frontmatter 에 `codebase/backend/src/shared/execution-resume/**` 추가.
7. **[INFO #5]** `spec/4-nodes/3-ai/1-ai-agent.md §7` `runAiConversationLoop` 잔존 언급 확인 후 turn-단위 park 전환 주석 추가.