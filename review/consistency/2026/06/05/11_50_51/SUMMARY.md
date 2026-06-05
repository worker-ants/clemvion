# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 위배는 WARNING 이하이며 Phase B 착수 전 spec 선행 갱신 의무로 관리 가능.

## 전체 위험도
**MEDIUM** — Phase B 착수 전 반드시 처리해야 할 spec 갱신 의무(pendingContinuations/fast-path 서술 제거 + turn-단위 park Rationale 명문화) 2건이 WARNING 으로 복수 checker 에서 공통 지적됨. 나머지는 LOW/NONE.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec + Rationale Continuity (중복 통합) | `pendingContinuations` / fast-path 서술이 spec 에 잔류 — Rationale 가 명시 기각한 sticky fast-path 와 혼재. Phase B 구현 착수 시 spec-코드 충돌 발생 | `spec/5-system/4-execution-engine.md` §1.1 전이표(L62), §4.x 구현 메모, §7.4 Worker 동작 행, §7.5 case 1 | plan `exec-park-durable-resume.md §Spec 변경` "Phase B 선행 의무" + §Rationale "Sticky fast-path 제거" | Phase B 착수 전 §1.1 전이표·§4.x 구현 메모·§7.4 Worker 동작 행·§7.5 case 1 에서 pendingContinuations/fast-path 서술 제거 또는 Phase B 이전 과도기 주석 표시 |
| W2 | Cross-Spec + Rationale Continuity (중복 통합) | D4(turn-단위 park) 채택 Rationale 가 spec 에 미기재 — plan 이 "Phase B 착수 전 의무"로 명시한 항목 미이행 | `spec/5-system/4-execution-engine.md` §Rationale 또는 §4.x (해당 항목 부재) | plan §Spec 변경 "Phase B 선행 의무: D4 turn-단위 park Rationale 명문화" | Phase B 착수 전 §Rationale 에 (1) 기존 "대화 전체=단일 waiting" 대비 차이, (2) 채택 근거(메모리 bounded + slow-path 일원화 정합), (3) 기각 대안("단일 waiting + 코루틴 누적 수용") 추가 |
| W3 | Convention Compliance | `spec/5-system/1-auth.md` Overview 섹션 누락 — 3섹션 구조(Overview/본문/Rationale) 중 Overview 만 없음 | `spec/5-system/1-auth.md` 파일 상단 | CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장" | frontmatter 아래, `## 1. 인증` 앞에 `## Overview` 섹션(1~2문단 목적·범위 요약) 추가 |
| W4 | Convention Compliance | `spec/5-system/11-mcp-client.md` Overview + Rationale 섹션 모두 부재 — 3섹션 구조에서 가장 크게 이탈 | `spec/5-system/11-mcp-client.md` 전체 | CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장" | `## 1. 개요` 를 `## Overview` 로 리네임하거나 앞에 추가; 파일 말미에 `## Rationale` 섹션 신설(stdio 미지원·세션 비풀링·skipReason naming 결정 집약) |
| W5 | Plan Coherence | Phase B3(`pendingContinuations` 제거) 완료 후 `continuation-resume-optional-followups.md` 의 "double-drive optimistic lock" 항목 전제 소멸 — 열린 TODO 로 방치 위험 | `continuation-resume-optional-followups.md` §멀티 인스턴스 double-drive optimistic lock | plan Phase B3 결정 | Phase B3 완료 후 해당 항목에 "fast-path 제거(Phase B3)로 전제 소멸 — 닫힘" 표기 추가; 현재 Phase B spec 변경 계획에 후속 플래그 메모 등재 |
| W6 | Plan Coherence | `node-cancellation §2` 와의 직렬화 순서가 Phase 0 에서 "확정" 표시이나 실제 결론(D6)이 plan 에 미기재 | `exec-park-durable-resume.md` §Phase 0 | `plan/in-progress/node-cancellation-infrastructure.md §2` (unstarted) | Phase A2/B 착수 전 D6 결정(node-cancellation §2 선행/후행)을 plan 에 명시; `WAITING_FOR_INPUT` 재개 경로 건드리지 않는다는 범위 구분 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | A2b(IE checkpoint) — spec 선반영 vs plan "분리, 후속" 불일치 | `spec/5-system/4-execution-engine.md §1.3`, `spec/4-nodes/3-ai/3-information-extractor.md §5.4`, `spec/4-nodes/3-ai/1-ai-agent.md §1.3` | A2b 실제 구현 상태 확인; 미구현이면 spec "Planned" 표시 또는 구현 완료 시 plan A2b 완료 갱신 |
| I2 | Cross-Spec | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `pending_plans` 에 `exec-park-durable-resume` 미등록 | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter | `pending_plans` 에 `plan/in-progress/exec-park-durable-resume.md` 추가 |
| I3 | Cross-Spec | `waiting_for_input → waiting_for_input` 전이 — Phase B 이후 삭제 예정 항목 잔류 | `spec/5-system/4-execution-engine.md §1.1` L62 | W1 §1.1 갱신 작업에 포함해 Phase B 와 함께 처리 |
| I4 | Rationale Continuity | §4.x "현재 재개 경로와 알려진 한계" 배너 — Phase B 완료 후 "코루틴 in-process 생존" 사실-오류로 잔류 가능 | `spec/5-system/4-execution-engine.md §4.x` 구현 메모 배너 | Phase B PR spec 체크리스트에 "§4.x 배너 fast-path/coroutine-alive 문구 교체" 항목 추가 |
| I5 | Rationale Continuity | A2b(IE checkpoint) — "ai_agent 한정" 문구 3곳 갱신 선행 필요 | `4-execution-engine.md §1.3`, `3-information-extractor.md L357`, `1-ai-agent.md L703` | A2b 착수 시 문구 3곳 갱신 + §Rationale 에 "A2b 에서 IE 로 확장 완료" append |
| I6 | Convention Compliance | `spec/5-system/10-graph-rag.md §Overview` 헤딩에 불필요한 parenthetical `(제품 정의)` | `spec/5-system/10-graph-rag.md` L29 | `## Overview (제품 정의)` → `## Overview` 로 단순화 |
| I7 | Convention Compliance | `1-auth.md §1.5.4` lower_snake_case 에러 코드 — historical-artifact 예외 등재 상태, 관리된 예외 | `spec/5-system/1-auth.md §1.5.4` | 추가 조치 불필요. 신규 에러 코드는 UPPER_SNAKE_CASE 준수 확인 |
| I8 | Convention Compliance | `11-mcp-client.md §6.2` `skipReason` lower_snake_case — 운영 진단용 enum 의도적 설계, 문서화됨 | `spec/5-system/11-mcp-client.md §6.2` | `spec/conventions/node-output.md §3.2` 에 "운영 진단용 식별자는 lower_snake_case 허용" 한 줄 추가 권장 |
| I9 | Convention Compliance | `10-graph-rag.md §6` `document:graph_error` dead-declared 이벤트 — spec 에 사실 기반 주석 있음 | `spec/5-system/10-graph-rag.md §6` | `plan/in-progress/` 에 dead-declared 이벤트 정리 추적 항목 추가 권장 |
| I10 | Plan Coherence | `exec-intake-queue-impl.md` worktree `impl-exec-concurrency-cap` — PR #469 MERGED, stale | `plan/in-progress/exec-intake-queue-impl.md` | `cleanup-worktree-all.sh` 로 worktree 정리 권장 |
| I11 | Plan Coherence | `spec-frontmatter-status-migration-027c17` worktree — 원격 미추적, PR 미발견, Fallback active 처리 | worktree `spec-frontmatter-status-migration-027c17` | 실제 비활성이면 정리 후 재검토; Phase B 이후 G2 직렬화 권장 |
| I12 | Plan Coherence | D2(user-defined variables 영속) 미결 — §7.5 rehydration 서술 범위 불확정 | `exec-park-durable-resume.md §D2` | Phase B spec 착수 전 D2 결론 명시; "variables 제외" 결론 시 §7.5 에 명시적 제외 사유 추가 |
| I13 | Plan Coherence | `3-execution.md §1.1/§2.2` mermaid — Phase B 완료 후 더욱 stale 화 예정 | `spec/data-flow/3-execution.md §1.1/§2.2` | `exec-park-durable-resume.md §Spec 변경` 에 Phase B 완료 후 triggerable 메모 추가 권장 |
| I14 | Naming Collision | `RESUME_BULLMQ_ATTEMPTS` — spec 에서 env 변수처럼 언급, 구현은 코드 상수, `.env.example` 미등재 | `spec/5-system/4-execution-engine.md §7.5`, `spec/5-system/3-error-handling.md §93` | spec 에서 env override 가능/코드 상수 여부 명확화; override 가능하면 `.env.example` 추가 |
| I15 | Naming Collision | `schemaVersion` JSONB 내부 키 — 범용 이름이나 코드베이스 내 충돌 없음, 설계상 공유 의도 필드 | `_resumeCheckpoint.schemaVersion` | 추가 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | pendingContinuations/fast-path 잔류 + D4 Rationale 미기재 (Phase B 착수 전 의무) |
| Rationale Continuity | MEDIUM | §7.4 Worker 동작이 기각된 fast-path 와 혼재 + turn-단위 park Rationale 미기록 |
| Convention Compliance | LOW | 1-auth.md / 11-mcp-client.md Overview·Rationale 섹션 미구비 (2건 WARNING) |
| Plan Coherence | LOW | double-drive optimistic lock 전제 소멸 미처리 + node-cancellation D6 결론 미기재 |
| Naming Collision | NONE | 의미 충돌 없음. INFO 2건은 명확화 권장 수준 |

## 권장 조치사항

1. **[Phase B 착수 전 필수]** `spec/5-system/4-execution-engine.md` §1.1 전이표·§4.x 구현 메모·§7.4 Worker 동작 행·§7.5 case 1 에서 `pendingContinuations`/fast-path 서술 제거 및 Phase B 이후 모델("park 즉시 코루틴 해제 + slow-path 일원화")로 교체 (W1 해소)
2. **[Phase B 착수 전 필수]** `spec/5-system/4-execution-engine.md §Rationale` 에 D4 "turn-단위 park 채택" 항목 추가 — 기존 모델 대비 차이·채택 근거·기각 대안 포함 (W2 해소)
3. **[Phase B3 완료 직후]** `continuation-resume-optional-followups.md` 의 "double-drive optimistic lock" 항목을 "전제 소멸 — 닫힘"으로 표기 (W5 해소)
4. **[Phase A2/B 착수 전]** `exec-park-durable-resume.md §Phase 0` 에 D6 결정(node-cancellation §2 직렬화 순서) 명시 (W6 해소)
5. **[권장]** `spec/5-system/1-auth.md` 에 `## Overview` 섹션 추가 (W3 해소)
6. **[권장]** `spec/5-system/11-mcp-client.md` 에 `## Overview` + `## Rationale` 섹션 추가 (W4 해소)
7. **[권장]** `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `pending_plans` 에 `exec-park-durable-resume` 등재 (I2)
8. **[권장]** `RESUME_BULLMQ_ATTEMPTS` env/상수 역할 spec 명확화 및 필요 시 `.env.example` 추가 (I14)
9. **[정리]** `impl-exec-concurrency-cap` worktree 정리 권장 (PR #469 MERGED — I10)