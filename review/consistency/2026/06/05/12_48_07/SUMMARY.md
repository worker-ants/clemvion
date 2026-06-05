# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

검토 모드: `--impl-prep` (Phase A3 구현 착수 전)
검토 일시: 2026-06-05
대상 범위: `spec/5-system/`, `spec/1-data-model.md`, `plan/in-progress/exec-park-durable-resume.md`

---

## 전체 위험도

**HIGH** — `impl-exec-concurrency-cap` worktree 가 main 에 이미 반영된 A1/A2b spec 결과를 역행(revert)하는 방향으로 동일 파일을 편집 중이며, A3 spec 변경과 직접 충돌한다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `impl-exec-concurrency-cap` worktree(branch `claude/impl-concurrency-cap-pr2b`)가 main 반영 완료된 A1(V084 `conversation_thread`) · A2b spec 결과를 역행 — V084 마이그레이션 삭제, `spec/conventions/conversation-thread.md §4` 영속화 표 되돌림, `spec/5-system/4-execution-engine.md §6.2·§7.5` conversation_thread 경로 제거, `spec/1-data-model.md` conversation_thread 행 삭제 | `exec-park-durable-resume.md` Phase A1·A3, `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`, `spec/conventions/conversation-thread.md` | `plan/in-progress/exec-intake-queue-impl.md` — worktree `impl-exec-concurrency-cap` | `impl-exec-concurrency-cap` worktree 의 spec diff 에서 A1 역행 부분을 제거하고 현행 main(A1 반영 상태) 기준으로 rebase 한 뒤 A3 spec 변경에 진입한다. 두 worktree 의 동일 파일 편집 직렬화 순서를 확정해야 A3 spec 변경이 안전하다. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | A3 spec 변경(`spec/1-data-model.md §2.13`, `spec/5-system/4-execution-engine.md §6.2`) 과 `impl-exec-concurrency-cap` 의 동일 파일 편집이 직접 충돌 예상. 어느 쪽이 먼저 PR을 열어도 나머지 merge 시 conflict 발생 | `exec-park-durable-resume.md §A3` — V085, `Execution.user_variables` spec 항목 | `exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`) | A3 spec 적용 전 CRITICAL #1 충돌을 해소하거나 두 worktree spec 변경의 직렬화 순서를 확정한다. |
| 2 | Plan Coherence | Phase B 선행 조건인 D3("park 중 워크플로 정의 편집 시 재개 정책") 미확정 상태. §7.5 rehydration 서술이 D3에 따라 달라질 수 있으나 plan에 판단 없이 잔류 | `exec-park-durable-resume.md §미해결 결정 D3` | `4-execution-engine.md §7.5` | Phase B 착수 전 D3를 "결정 또는 명시적 defer"로 처리. plan에 "D3는 B 착수 전 확정 또는 defer 필요" 명시 추가. |
| 3 | Rationale Continuity | plan Phase B2에서 `pendingContinuations` fast-path를 "강등(의존 금지)"으로 남기는 옵션이 spec Rationale의 "Sticky fast-path 완전 제거" invariant(`§7.4` 라우팅 원칙) 및 기각 결정과 충돌 | `exec-park-durable-resume.md` Phase B2 항목 | `spec/5-system/4-execution-engine.md §7.4` 라우팅 원칙, `## Rationale "Durable Continuation & Graceful Shutdown"` | B2 항목의 "또는 강등(의존 금지)" 구절을 제거하고 "fast-path 완전 제거"로 단일화한다. 강등을 의도한다면 §7.4 invariant와 Rationale "Sticky fast-path 제거" 결정을 함께 번복하는 새 Rationale 명시 필요. |
| 4 | Rationale Continuity | D4(turn-단위 park) Rationale 명문화 의무가 Phase B 착수 전으로 plan에 명시되어 있으나 spec에 아직 미작성. spec 갱신 없이 B1 구현 착수 시 기존 invariant를 번복하는 코드가 Rationale 없이 배포될 수 있음 | `exec-park-durable-resume.md §Spec 변경` "[Phase B 선행 — 구현 착수 전 의무]" | `spec/5-system/4-execution-engine.md §4.x`, `§7.4` | Phase B 구현 착수 전 `§4.x` 및 §7.4에 "대화 전체=단일 waiting(기각) vs turn-단위 park(채택)" Rationale를 먼저 spec에 커밋한 뒤 B1 구현 진입. |
| 5 | Naming Collision | V085 마이그레이션 번호를 `exec-park-durable-resume` A3(`user_variables`)와 `impl-exec-concurrency-cap` PR2b(concurrency 관련 컬럼)가 동시에 선점할 경합 위험. Flyway는 번호 중복을 fatal 에러로 취급 | `exec-park-durable-resume.md §A3` — V085 마이그레이션 | `exec-intake-queue-impl.md` PR2b — `impl-exec-concurrency-cap` | PR-A3 착수 전 `impl-exec-concurrency-cap` PR2b 착수 상태 확인. PR2b가 먼저 V085를 선점했다면 PR-A3는 V086으로 부여(`migrations.md §5/§6` rebase-renumber 절차). 두 branch 동시 진행 시 plan 간 번호 사전 조율. |
| 6 | Cross-Spec | `spec/5-system/4-execution-engine.md §1.1` waiting_for_input 전이 표 설명과 Phase B 목표(slow-path 일원화) 간 현행 fast-path / slow-path 이원화 서술 혼재 | `spec/5-system/4-execution-engine.md §1.1` L62, `§4.x` L406, `§7.4` L823 | `exec-park-durable-resume.md` Phase B 목표 | Phase B 착수 전 §1.1, §4.x, §7.4를 단일 갱신. A3 착수 시점에서는 차단 아님. |
| 7 | Convention Compliance | `spec/5-system/11-mcp-client.md §6.2` — `mcpDiagnostics` 미구현(Planned) 필드들이 정규 JSON 예시로 기술되어 구현자가 완성 스펙으로 오해할 수 있음 (`status: partial` + `pending_plans` 포함으로 규약은 준수) | `11-mcp-client.md §6.2` | `spec/conventions/spec-impl-evidence.md §3` | §6.2 서두에 미구현 필드 목록을 bullet으로 분리 명시 권고. 규약 위반은 아님. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | D4 turn-단위 park 모델이 `§1.1` 전이 표에 미반영 (Phase B 착수 전 의무로 plan이 이미 추적) | `spec/5-system/4-execution-engine.md §1.1` L60 | Phase B 착수 직전 spec 변경 시 §1.1 전이 표에 D4 모델 반영 및 Rationale 절 추가. |
| 2 | Cross-Spec | `spec/1-data-model.md §2.13` `user_variables` 컬럼이 spec에 이미 선언(pre-declared), plan A3 미완료 — spec-impl drift 상태 | `spec/1-data-model.md §2.13` L2537 | A3 PR 완료 후 plan 항목 체크 및 spec frontmatter `status` 갱신. |
| 3 | Cross-Spec | `§1.1` waiting_for_input→cancelled 전이 케이스와 §7.5 rehydration 실패 케이스 표가 중복 열거 — 현재는 일치하나 미래 추가 시 동시 갱신 필요 | `spec/5-system/4-execution-engine.md §1.1` L61/63, `§7.5` L907-911 | 장기적으로 §1.1 전이 표의 rehydration 케이스를 §7.5 포워드 참조만 남기고 단일화. |
| 4 | Rationale Continuity | Phase B3에서 `firstSegmentBarriers` 제거/축소 시 `spec/5-system/4-execution-engine.md §4.x` "구현 메모 — 첫 세그먼트 배리어" 블록과 불일치 예고 | `exec-park-durable-resume.md` Phase B3, `spec/5-system/4-execution-engine.md §4.x` | B3 체크박스에 "§4.x 구현 메모 firstSegmentBarriers 블록 제거/대체 서술" 항목 명시적 추가. |
| 5 | Rationale Continuity | plan §7.4 Worker 동작 행 갱신 방향이 "제거/강등" 두 방향으로 열려 있어 WARNING #3(fast-path 기각 결정)과 동일 모호성 | `exec-park-durable-resume.md §Spec 변경` "§7.4 정정(제거/강등)" | plan에서 §7.4 Worker 동작 행 갱신 방향을 "제거"로 명확히 단일화. |
| 6 | Naming Collision | `restoreUserVariables` 함수명이 A1의 `rehydrateConversationThread` 와 접두어 불일치(`restore*` vs `rehydrate*`) | plan §A3 체크리스트, A1 구현 | 구현 시 `rehydrateUserVariables`로 통일해 A1 패턴과 대칭. |
| 7 | Naming Collision | `user_variables` 컬럼명 — `ExecutionContext.variables`(runtime 전체)와 의미 구분 명확히 기술됨. 충돌 없음 | `spec/5-system/4-execution-engine.md §6.1`, `spec/1-data-model.md` | 구현 시 TypeORM 컬럼 데코레이터 네이밍을 A1 `conversation_thread` 패턴과 일치시킴. |
| 8 | Naming Collision | Stale worktree 3건(`spec-exec-intake-queue`, `impl-exec-intake-queue`, `fix-bg-context-followups`) — PR MERGED, main 반영 완료 | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 실행 권장. |
| 9 | Convention Compliance | `spec/5-system/1-auth.md §1.5.4` `invitation_*` lower_snake_case — historical-artifact 예외로 `error-codes.md §3`에 등재됨. 규약 준수. | `1-auth.md §1.5.4` | 신규 구현 시 이 코드들을 선례 삼아 lowercase 코드 추가 금지. |
| 10 | Convention Compliance | `spec/5-system/11-mcp-client.md §6.2` `skipReason` lower_snake_case — 운영 진단용 enum으로 의도된 예외. 규약 위반 아님. | `11-mcp-client.md §6.2` | `error-codes.md §3` 레지스트리에 `skipReason` 예외 등재 고려(현재 미등재). |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Plan Coherence | **HIGH** | `impl-exec-concurrency-cap` worktree 가 A1/A2b spec 결과를 역행(CRITICAL); A3 spec 변경과 동일 파일 직접 충돌(WARNING); D3 미확정(WARNING) |
| Rationale Continuity | **MEDIUM** | Phase B2 fast-path "강등" 옵션이 spec Rationale 기각 결정과 충돌(WARNING); D4 Rationale 명문화 의무 미이행(WARNING) |
| Cross-Spec | **LOW** | fast-path/slow-path 이원화 서술 혼재(WARNING, A3 착수 차단 아님); user_variables spec-impl drift(INFO) |
| Naming Collision | **LOW** | V085 번호 선점 경합(WARNING); restoreUserVariables 접두어 불일치(INFO) |
| Convention Compliance | **LOW** | 전반적 규약 준수. mcpDiagnostics 미구현 필드 명확성 개선 권고(WARNING 수준 미달) |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `impl-exec-concurrency-cap` worktree(`claude/impl-concurrency-cap-pr2b`)의 spec diff 에서 A1/A2b 역행 부분(V084 마이그레이션 삭제, `conversation-thread.md §4` 되돌림, `4-execution-engine.md §6.2·§7.5` conversation_thread 제거, `1-data-model.md` conversation_thread 행 삭제, A2b IE 확장 되돌림)을 제거하고 현행 main 기준으로 rebase 한다. 이 조치 완료 전 A3 spec 변경·코드 착수는 차단.
2. **(WARNING 해소 권고 — A3 착수 전)** V085 마이그레이션 번호 선점 여부를 `impl-exec-concurrency-cap` PR2b 와 조율. 충돌 위험 시 exec-park A3 는 V086 예약.
3. **(WARNING 해소 권고 — Phase B 착수 전)** plan Phase B2의 fast-path "강등" 옵션 구절을 "완전 제거"로 단일화하고, §7.4 Spec 변경 방향도 "제거"로 명확히 한다.
4. **(WARNING 해소 권고 — Phase B 착수 전)** `4-execution-engine.md §4.x` 및 §7.4에 D4 turn-단위 park Rationale을 spec에 커밋한 뒤 B1 구현 진입(plan 자체에 의무로 이미 명시됨).
5. **(WARNING 해소 권고 — Phase B 착수 전)** plan에 "D3는 B 착수 전 확정 또는 명시적 defer 필요" 항목 추가.
6. **(INFO 권고 — 청소)** stale worktree 3건 정리: `./cleanup-worktree-all.sh --yes --force`.
7. **(INFO 권고 — 구현 시)** A3 구현 시 함수명을 `restoreUserVariables` 대신 `rehydrateUserVariables`로 통일(A1 `rehydrateConversationThread` 패턴과 대칭).