# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 위배는 WARNING 이하.

## 전체 위험도
**MEDIUM** — 에러 코드 표기 규약 위반(WARNING) 및 plan cross-link 미완료(WARNING) 다수. 핵심 spec 구조·식별자 충돌은 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `4-execution-engine.md §4.x` blockquote 가 A1 완료 후에도 "검토 대상" 표현 유지 — 결정된 사안을 미결처럼 오독 유도 | `spec/5-system/4-execution-engine.md §4.x` | `plan/in-progress/exec-park-durable-resume.md §A1 완료`, `1-data-model.md §2.13`, `conversation-thread.md §8.4` | blockquote 를 "Phase B 계획, 선행조건 A1 완료(conversation_thread V084)" 로 갱신. 추적 링크를 `exec-park-durable-resume.md` 로 변경 |
| W2 | Cross-Spec | `4-execution-engine.md §7.4` Worker 동작 행이 Rationale 에서 "제거 결정"된 fast-path 를 current behavior 로 기술 — 구현 상태·Rationale·Phase B 목표가 혼재 | `spec/5-system/4-execution-engine.md §7.4` | plan `exec-park-durable-resume.md §consistency W5/I2` | §7.4 에 "현재 fast-path 존재, Phase B 완료 시 slow-path 일원화 예정" 명기 또는 Phase B PR 에서 일괄 갱신하도록 plan 의무 항목 추가 |
| W3 | Cross-Spec | `4-execution-engine.md §1.1` 상태 전이표가 D4 turn-단위 park 순환 모델을 미반영 | `spec/5-system/4-execution-engine.md §1.1` | `plan/in-progress/exec-park-durable-resume.md §Phase B / D4` | Phase B 완료 PR 에서 §1.1 다이어그램·전이표에 "멀티턴 turn-단위 park 순환 (D4)" 추가. spec 에 pending 주석으로 예고 권장 |
| W4 | Rationale Continuity | Phase B D4 turn-단위 park Rationale 이 spec 에 미명문화 — plan 이 "Phase B 선행 의무"로 요구 | `spec/5-system/4-execution-engine.md §Rationale` (항목 부재) | `plan/in-progress/exec-park-durable-resume.md §Spec 변경 [Phase B 선행 의무]` | Phase B 착수 전 §Rationale 또는 §4.x 에: (1) 단일 waiting+코루틴 누적 대안 기각 이유, (2) turn-단위 park 채택 근거(bounded 메모리+slow-path 정합), (3) rehydration 비용 수용 판단 명문화 |
| W5 | Convention Compliance | `1-auth.md §1.5.4` 초대 에러 코드가 `lower_snake_case` — `error-codes.md §1` 및 `node-output.md Principle 3.2` UPPER_SNAKE_CASE 규약 직접 위반 | `spec/5-system/1-auth.md §1.5.4` | `spec/conventions/error-codes.md §1`, `spec/conventions/node-output.md Principle 3.2` | 코드를 `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_ALREADY_USED`, `INVITATION_EMAIL_MISMATCH`, `FORBIDDEN`, `RATE_LIMITED` 로 변경. 구현 코드 문자열이 있으면 `error-codes.md §3` historical-artifact 레지스트리 등재 후 신규 코드부터 대문자 적용 |
| W6 | Convention Compliance | `10-graph-rag.md` Overview 안에 요구사항·기술 결정 대형 섹션 트리가 중첩 — 본문과 이중 구조, 3섹션 규약 위반 | `spec/5-system/10-graph-rag.md` | `CLAUDE.md` 문서 구조 규약 (Overview / 본문 / Rationale 3섹션) | `## Overview` 를 제품 정의/목적/범위 요약 수준으로 유지하고, 요구사항·기술 결정은 본문 영역으로 이동. 또는 역방향 flatten |
| W7 | Convention Compliance | `11-mcp-client.md` `skipReason lower_snake_case` 예외가 spec 본문 인라인에만 해명되고 `spec/conventions/error-codes.md §3` 예외 레지스트리 미등재 | `spec/5-system/11-mcp-client.md §6.2` | `spec/conventions/error-codes.md §3` | `error-codes.md §3` 에 `skipReason lower_snake_case` 채택 근거·적용 범위 등재. 또는 규약 §1 에 허용 조항 추가 |
| W8 | Plan Coherence | Phase 0 cross-link 미완료 — `exec-intake-queue-impl.md §PR3` 에 "exec-park 이관" 표기 없어 중복 착수 오해 유발 가능 | `plan/in-progress/exec-park-durable-resume.md §Phase 0` (미체크), `plan/in-progress/exec-intake-queue-impl.md §PR3` | D5 결정(단일 worktree 통합) | `exec-intake-queue-impl.md §PR3` 에 "→ exec-park-durable-resume Phase A2/B2 로 이관(2026-06-05 D5)" 표기 추가. `node-cancellation-infrastructure.md §2` 도 cross-note. (planner 작업) |
| W9 | Plan Coherence | `exec-intake-queue-impl.md §PR2a` 상태 stale — plan 에서 "PR #469 OPEN" 이나 실제 origin/main 에 MERGED | `plan/in-progress/exec-intake-queue-impl.md §PR2a` | origin/main ancestor 확인(V083 포함) | `exec-intake-queue-impl.md §PR2a` 를 `[x] PR #469 MERGED(2026-06-05)` 로 갱신. PR2b 착수 시 V085 번호 선점 확인 |
| W10 | Plan Coherence | D2/D3 미확정이 Phase A3·PR-B 의 spec §7.5 `variables` 복원 약속과 충돌 가능 — 구현 전 약속 패턴 | `plan/in-progress/exec-park-durable-resume.md §미해결 결정 D2, D3`, `spec/5-system/4-execution-engine.md §7.5` | `exec-park-durable-resume.md §Spec 변경` (`variables` 복원 명시 TODO 미반영) | Phase A3 착수 전 D2 확정(포함 or 분리). spec §7.5 `variables` 복원 서술은 D2 확정 + 구현 완료 후 추가. D3 는 PR-B 착수 직전까지 확정 |
| W11 | Plan Coherence | PR2b(impl-exec-concurrency-cap) 와의 V085 migration race 위험 — 두 branch 병렬 진행 | `plan/in-progress/exec-intake-queue-impl.md §PR2b`, exec-park V084 커밋 | `migrations.md §5/§6` rebase-renumber 절차 | PR-A1 머지 후 PR2b 착수 시 V085(= max+1) 재부여 확인. 동시 착수 불가피 시 두 plan 간 migration 번호 조율 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `1-data-model.md §2.13` `conversation_thread` 마이그레이션 번호 plan D1 표기(V083)와 spec 표기(V084) 불일치 | `spec/1-data-model.md §2.13`, `exec-park-durable-resume.md §D1` | plan D1 표기를 V084 로 통일하거나 "(V083 또는 V084 — rebase 시 결정)"으로 명시 |
| I2 | Cross-Spec | `4-execution-engine.md §1.3` `ai_agent` 한정 문구 — A2 완료 시 §1.3 + `3-information-extractor.md §357` + `1-ai-agent.md §703` 3곳 동기 갱신 필요 | `spec/5-system/4-execution-engine.md §1.3` | A2 PR 착수 전 plan 체크리스트에 3곳 동기 갱신 상기 표시 |
| I3 | Cross-Spec | `conversation-thread.md §7` 미결 목록 V084 항목이 취소선+채택 완료 혼재 형태로 잔존 — 스캔 시 미결 인상 | `spec/conventions/conversation-thread.md §7` | 해당 항목을 §7 목록에서 제거하거나 §8.4 로 완전 이동 |
| I4 | Rationale Continuity | `4-execution-engine.md §Rationale L1166` `_continuationCheckpoint` 기각 항목에 `conversation_thread` 결정과 cross-link 부재 | `spec/5-system/4-execution-engine.md §Rationale L1166` | L1166 에 "`conversationThread` 용 컬럼은 §8.4 전환 참조" 한 줄 cross-link 추가 권장 |
| I5 | Convention Compliance | `1-auth.md §Rationale` 항목 순서가 역순(§1.5.x 먼저, §1.4.x 나중) | `spec/5-system/1-auth.md §Rationale` | Rationale 항목을 문서 본문 섹션 번호 순(1.4.x → 1.5.x)으로 재정렬 |
| I6 | Convention Compliance | `11-mcp-client.md` 명시적 `## Overview` 섹션 없음, `## Rationale` 섹션 없음 — 설계 근거가 본문에 산재 | `spec/5-system/11-mcp-client.md` | `## Overview` 신설 + 본문 산재 결정 근거를 `## Rationale` 로 집약 |
| I7 | Convention Compliance | `spec/5-system/_product-overview.md` 에 `## Overview` 섹션 부재 | `spec/5-system/_product-overview.md` | `## Overview` 섹션 추가. 또는 CLAUDE.md 에 "system 비기능 요구사항 테이블 형태 허용" 명확화 |
| I8 | Plan Coherence | `exec-intake-queue-impl.md` 가 `exec-park-durable-resume` 를 `pending_plans` 에 미등재 — 두 plan 연결이 단방향 | `plan/in-progress/exec-intake-queue-impl.md` frontmatter | `exec-intake-queue-impl.md` 상단에 "Phase A2/B2 → exec-park-durable-resume 로 이관(D5 결정)" 메모 추가 (W8 과 동일 작업) |
| I9 | Plan Coherence | `ai-context-memory-followup-v2.md` §4 영속화 표 참조 v2 항목에 exec-park PR-A1 신규 행 추가 미인지 가능 | `plan/in-progress/ai-context-memory-followup-v2.md` | 선택적 cross-note: "exec-park PR-A1 이 §4 에 신규 행 추가함" |
| I10 | Naming Collision | `EH-DETAIL-06` 을 "v2 미래 과제" 참조 용도로 사용 — 기존 완료된 UI 요구사항 ID와 혼용, 엄밀도 약간 낮음 | `spec/conventions/conversation-thread.md §7`, `spec/4-nodes/3-ai/1-ai-agent.md §12.10` | 참조 시 "기존 EH-DETAIL-06(Preview 탭 UI)의 상세 thread view 재구성 정책"임을 한 줄로 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Phase B 미완료로 `4-execution-engine.md §4.x/§7.4/§1.1` 기술 혼재(W1~W3). A1 변경 자체의 spec 간 직접 충돌 없음 |
| Rationale Continuity | LOW | A1 번복(DB 컬럼 신설)의 Rationale 명문화 완료. Phase B D4 Rationale 미명문화(W4) — plan 이 "Phase B 선행 의무"로 이미 식별 |
| Convention Compliance | MEDIUM | `1-auth.md §1.5.4` 에러 코드 UPPER_SNAKE_CASE 위반(W5), `10-graph-rag.md` 이중 구조(W6), `11-mcp-client.md` 예외 미등재(W7). frontmatter·주요 에러 코드 invariant 준수 |
| Plan Coherence | LOW | Phase 0 cross-link 미완료(W8), PR2a stale(W9), D2/D3 미결·spec §7.5 약속 충돌 가능(W10), V085 migration race(W11). CRITICAL 없음 |
| Naming Collision | NONE | 신규 식별자(`execution.conversation_thread`, V084, `conversation-thread.md §8.4`) 모두 충돌 없이 연속 추가 |

## 권장 조치사항

1. **(W5 — 즉시)** `spec/5-system/1-auth.md §1.5.4` 초대 에러 코드를 `UPPER_SNAKE_CASE` 로 변경. 구현 코드 문자열이 있으면 `error-codes.md §3` 레지스트리 등재.
2. **(W8+I8 — 중복 착수 방지, planner)** `exec-intake-queue-impl.md §PR3` 에 이관 표기 + cross-link 추가. PR2a 상태 MERGED 로 갱신(W9). plan D1 마이그레이션 번호 V084 로 통일(I1).
3. **(W4 — Phase B 착수 전 의무)** `4-execution-engine.md §Rationale` 에 D4 turn-단위 park Rationale 명문화 — Phase B 첫 PR 에 포함 필수.
4. **(W1~W3 — Phase B PR 체크리스트)** `§4.x` blockquote·`§7.4` Worker 행·`§1.1` 전이표 갱신을 Phase B PR 의무 항목으로 추가.
5. **(W10 — A3 착수 전)** D2 확정 후 spec §7.5 `variables` 복원 서술 추가. D3 는 PR-B 착수 직전까지 확정.
6. **(W11 — 동시 진행 조율)** PR-A1 머지 후 PR2b 착수 시 V085 rebase-renumber 확인.
7. **(W6~W7 — 중기 개선)** `10-graph-rag.md` Overview/본문 이중 구조 해소, `error-codes.md §3` 에 `skipReason` 예외 등재.