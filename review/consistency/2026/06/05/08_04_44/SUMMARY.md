# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 함

## 전체 위험도
**CRITICAL** — 병렬 active worktree 2건이 target 의 핵심 코어 파일(`execution-engine.service.ts`, `spec/5-system/4-execution-engine.md`)을 동일 함수/절을 서로 반대 방향으로 동시 편집하고 있어, 착수 전 직렬화 합의가 필수.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C1 | Plan Coherence | `impl-exec-intake-queue` PR3 와 `execution-engine.service.ts` §7.5 rehydration 코어 동일 표면 충돌 — 두 plan 이 "rehydration 범위 확장 + 멱등 재개 일원화"를 독립적으로 인수, merge conflict + 설계 분기 불가피 | Phase A1/A2 (`rehydrateContext`, checkpoint 견고화), Phase B2 (`rehydrateAndResume` 일원화), SoT `spec/5-system/4-execution-engine.md §7.5` | `plan/in-progress/exec-intake-queue-impl.md` (branch `claude/impl-exec-intake-queue`, 커밋 `01bca178`, 2026-06-04, PR 부재) | exec-intake-queue PR3 를 "rehydration 소유 plan"으로 확정하고 target A2/B2 는 그 인프라를 소비/전제하는 것으로 재기술; 또는 단일 worktree 통합. target §미해결 결정에 D5(소유권/머지 순서) 추가 |
| C2 | Plan Coherence | `fix/exec-engine-park-worker-job-release`(배리어 정교화·엣지 커버리지 추가 중)와 target B1/B3(같은 배리어 통째 삭제)가 동일 함수(`armFirstSegmentBarrier`/`settleFirstSegment`)를 반대 방향으로 동시 편집 — 노력 낭비 + 직접 라인 충돌 | Phase B1 (`firstSegmentBarriers` 대기 단순화/제거), B3 (`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier` + W1/W2 로직 제거), `spec/5-system/4-execution-engine.md §4.x` | branch `fix/exec-engine-park-worker-job-release` (커밋 `c9eb02a2`, 2026-06-05 07:52, PR 부재) | fix worktree 를 먼저 main 머지 후, target Phase B 가 그 baseline 위에서 배리어 제거. 또는 fix 를 target Phase B 에 흡수 합의. target §진행 메모에 의존성 명시 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `conversationThread` "in-memory 전용 → 최대 갭" 서술이 spec §7.5/§6.2 의 "rehydration 시 outputData 에서 복원" 약속과 정반대 전제 — 어느 쪽이 현실인지 코드로 확정하기 전까지 plan A1 범위가 과대 또는 과소 | Phase A1 durability 맵 | `conversation-thread.md §4/§9.11`, `4-execution-engine.md §6.2/§7.5` | A1 착수 전 `rehydrateContext` 가 실제로 빈 thread 로만 리셋하는지 코드 확정 → plan 맵과 spec §4/§6.2/§9.11 을 한쪽으로 합치 |
| W2 | Cross-Spec / Naming Collision | D1 영속 매체 후보에 spec 이 예고한 `Execution.conversation_thread jsonb` 위치가 누락, 대신 `node_execution` JSONB 컬럼을 제안 — 위치 불일치 및 예고 컬럼명 미승계 | Phase A1 D1 | `conversation-thread.md §4` L211 (`Execution.conversation_thread jsonb NULL` 예고), `4-execution-engine.md §7.5` (outputData 에서 로드 기술) | D1 결정 시 `Execution.conversation_thread` 예고를 채택/번복 중 하나로 명시 정리; 최종 컬럼명·위치를 두 문서가 동일하게 참조하도록 plan §3 spec 변경 항목에 추가 |
| W3 | Cross-Spec / Convention Compliance | conversation-thread "신규 DB 컬럼 없음" 원칙(§4/§7/§8 세 곳 명문화)을 번복할 경우 세 곳 동기 갱신 의무 — plan 이 인지하나 §4·§7·§8 앵커를 한 PR 로 묶는다는 명시 부족 | Phase A1 D1 결정 시 | `conversation-thread.md §4`(v1 컬럼 없음)·§7 로드맵·§8 Rationale, `4-execution-engine.md §6.2`(별도 컬럼 신설 없음) | planner `consistency-check --spec` 시 §4/§7/§8 + §6.2 를 한 PR 로 동기 갱신; plan §3 에 세 앵커 명시 |
| W4 | Plan Coherence | target main 기준점(`9f30216f`)이 #468 후속 커밋(`dbb0a7ea` 배리어 arm 가드, `20f600f9` worker job 반환)보다 이전 — durability 맵·B3 제거 범위가 stale | §진행 메모 "현행 durability 맵", B3 삭제 범위 산정 | main 최신 커밋 `dbb0a7ea`/`20f600f9` | 착수 직전 `git rebase origin/main` 후 durability 맵 재검증, B3 의 "W1/W2 방어 로직 불필요해진 부분" 범위를 최신 main 기준으로 재산정 |
| W5 | Plan Coherence | Phase B "fast-path 제거"가 spec §7.4/§7.5 의 의도된 in-instance fast-path(정상 설계로 명문화)와 충돌 — spec 개정 없이 코드 선행 시 developer 의 spec read-only 규칙 위반 | Phase B2 (`pendingContinuations.has` 제거), B3 (Map 제거 검토) | `4-execution-engine.md` §7.4 L820/L835, §4.x L403 | Phase B 착수 전 project-planner 가 §4.x/§7.4/§7.5 fast-path 서술 개정; plan §3 spec 변경 목록에 §7.4 추가; B2 "제거 vs 강등" 확정 전 B3 Map 제거 보류 |
| W6 | Plan Coherence | `execution-engine.service.ts` 재개/dispatch 경로를 exec-intake PR3·node-cancellation §2 와 3-way 공유하나 target plan 이 이를 전혀 인지하지 못함 | Phase B2 멱등성 보장, A2 cross-instance 재개 | `plan/in-progress/execution-engine-residual-gaps.md` G2, `plan/in-progress/node-cancellation-infrastructure.md` §2 (branch `claude/node-cancellation-engine-6bfcaa`, 커밋 `c77df67b`) | target §리스크/§미해결 결정에 "재개/dispatch 경로 3-way 경합 → 직렬화 합의" 등록; `NodeExecution.status='cancelled'` enum 이 B2 status 가드와 겹치는지 확인 |
| W7 | Cross-Spec | `execution-engine-residual-gaps.md` 에 본 전환("park 즉시 코루틴 해제 + slow-path 일원화")의 tracking 항목이 없음 — spec §4.x L403·§7.1 이 추적 약속했으나 dangling | plan 헤더 "관련 잔여 추적: execution-engine-residual-gaps.md" | `execution-engine-residual-gaps.md` (95 lines, 해당 키워드 부재) | residual-gaps 에 본 전환 tracking 엔트리 추가, 또는 plan 과 상호 cross-link |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Plan Coherence | `claude/spec-exec-intake-queue`(커밋 `789705e8`)가 target SoT 인 `4-execution-engine.md §4/§7` 과 `residual-gaps.md` 를 현재진행형으로 재정의 중 — target 인용·전제가 머지 시 stale 화 위험 | §본문 SoT 참조 §7.4/§7.5 | CRITICAL C1 직렬화 합의에 포함해 spec-exec-intake-queue 머지 후 §7.4/§7.5 인용 재확인 |
| I2 | Cross-Spec | B2 fast-path 강등/제거는 §7.4 "항상 BullMQ enqueue" 원칙과 방향 일치 — 단 §7.4 Worker 동작 행(로컬 pendingMap 즉시 resolve) 자체를 제거하려면 §7.5 case 1 문구도 동반 정정 필요; plan §3 spec 변경 목록에 §7.4 누락 | Phase B2, plan §3 spec 변경 | §7.4 를 plan §3 spec 변경 목록에 추가 |
| I3 | Rationale Continuity | `rehydrateContext` 가 실제로 빈 thread 로 리셋하고 outputData 로 복원하지 않음을 코드 확인 — spec §7.5/§6.2 가 무손실 복원을 over-promise 한 spec↔impl drift 존재. plan A1 은 이 drift 를 정합화하는 방향 | Rationale Continuity N1 | planner spec write 시 §7.5/§6.2 의 conversationThread 복원 서술을 "약속-있음/미구현→정합화"로 Rationale 에 사실 기록 |
| I4 | Convention Compliance | A2 `information_extractor` 멀티턴 checkpoint 확장 시 spec 3곳(`4-execution-engine.md §112`, `3-information-extractor.md §357`, `1-ai-agent.md §703`)의 "ai_agent 한정" 문구 동기 갱신 필요 | Phase A2 | plan §3 spec 변경 절에 §112 등 3곳 추가 또는 A2 를 범위 밖으로 분리 결정 |
| I5 | Naming Collision | Hard 충돌 없음 — 모든 심볼이 기존 존재, 신규 도입은 미해결 결정(D1)에 묶여 미확정. 상태 enum 무변경, API endpoint/이벤트/ENV 키 신규 없음 | 전체 | 없음(정상) |
| I6 | Cross-Spec | §4.x heading 실제 명칭은 "waiting_for_input park"이나 plan 이 "durable park"로 표기 — anchor 정합 위해 정정 권고 | plan §SoT 참조 §4.x | plan 의 §4.x 참조를 spec 실제 heading 명으로 정정 |
| I7 | Convention Compliance | `spec-impl-evidence.md §2` 관례상 본 plan 을 `conversation-thread.md` + `4-execution-engine.md` 의 `pending_plans:` 에 등록 권고 | frontmatter pending_plans | planner spec write 시점에 처리 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Plan Coherence | CRITICAL | 병렬 active worktree 2건(impl-exec-intake-queue PR3, fix/exec-engine-park-worker-job-release)이 동일 코어 파일을 반대 방향 동시 편집; 추가 3-way 코드 경합(node-cancellation §2); main 기준점 stale |
| Cross-Spec | MEDIUM | conversationThread durability 맵 전제 vs spec over-promise 불일치(W1); D1 영속 위치·컬럼명 convention 예고와 어긋남(W2); residual-gaps dangling tracking(W7) |
| Rationale Continuity | LOW | "신규 DB 컬럼 없음" 원칙 번복 시 3곳 동기 의무(plan 이 이미 인지); fast-path 제거가 §Rationale 방향과 일치하나 Phase 순서 의존 강제 필요 |
| Convention Compliance | LOW | conversation-thread.md §4/§7/§8 세 앵커 한 PR 동기 갱신 의무(W3); D1 컬럼 채택 시 migrations.md §5 절차 준수 |
| Naming Collision | LOW | Hard 충돌 없음; D1 위치(Execution vs node_execution) 불일치 soft warning |

## 권장 조치사항

1. **(BLOCK 해소 — C1)** exec-intake-queue PR3 를 "rehydration 소유 plan"으로 확정, target A2/B2 는 그 인프라를 전제하는 것으로 재기술. target §미해결 결정에 D5(소유권·머지 순서) 추가 후 직렬화 합의.
2. **(BLOCK 해소 — C2)** `fix/exec-engine-park-worker-job-release` 를 먼저 main 머지 후 target Phase B 착수. 또는 fix 를 target Phase B 에 흡수 합의. target §진행 메모에 의존성 명시.
3. **(W4 — 선행 필수)** `git rebase origin/main` 후 durability 맵·B3 제거 범위를 최신 main 기준으로 재검증.
4. **(W1 — A1 착수 전)** `rehydrateContext` 코드 확인으로 conversationThread 실제 복원 여부 확정 → plan 맵과 spec §4/§6.2/§9.11 을 한 방향으로 합치.
5. **(W5 — Phase B 착수 전)** project-planner 가 `4-execution-engine.md §4.x/§7.4/§7.5` fast-path 서술 개정 선행; B2 "제거 vs 강등" 확정 전 B3 Map 제거 보류.
6. **(W2/W3 — D1 결정 시)** D1 을 기존 `NodeExecution.outputData`/`_resumeCheckpoint`/ExecutionContext-Redis 확장 우선 검토; 컬럼 신설이 불가피하면 conversation-thread.md §4/§7/§8 + `4-execution-engine.md §6.2` 를 한 PR 로 동기 갱신(planner 선행 + `consistency-check --spec`).
7. **(W6)** target §리스크에 "재개/dispatch 3-way 경합(exec-intake PR3·node-cancellation §2)" 등록 후 직렬화 순서 합의.
8. **(W7)** `execution-engine-residual-gaps.md` 에 본 전환 tracking 엔트리 추가 또는 상호 cross-link.