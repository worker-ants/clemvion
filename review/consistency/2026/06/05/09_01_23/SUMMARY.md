# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 수준 발견 없음. WARNING 9건(cross-spec 2, rationale 2, plan 4, convention 1)이 존재하나 구현 착수를 즉시 차단할 직접 모순은 없음.

## 전체 위험도
**MEDIUM** — `Execution.conversation_thread` 컬럼의 단일 진실(spec/1-data-model.md) 미반영, D1 미확정 상태에서의 Phase A1 착수 위험, Phase 0 선행 조건 미완료, fast-path Rationale-본문 불일치가 복합적으로 존재.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `Execution.conversation_thread` 컬럼이 data-model 단일 진실에 누락 — 마이그레이션 작성 시 구현자 누락 위험 | `spec/1-data-model.md §2.13 Execution` (컬럼 없음) | `spec/conventions/conversation-thread.md §4/§8.4`, `spec/5-system/4-execution-engine.md §7.5` (채택 완료로 기술) | PR-A1 착수 전 `spec/1-data-model.md §2.13` 테이블에 `conversation_thread | JSONB? | …` 행 추가, 마이그레이션 버전(V083 예정) 명기 |
| W2 | Cross-Spec | Phase B 완료 후 `§4.x` 첫 세그먼트 배리어/fast-path 구현 메모가 과거 모델을 계속 서술하는 미래 drift 예고 | `spec/5-system/4-execution-engine.md §4.x` (L402–404), §1.1 상태전이 테이블 | `plan exec-park-durable-resume §B1/B2/B3` | plan B 완료 시 §4.x 배리어 메모·§1.1 `pendingContinuations` 재등록 표현·§7.4 Worker 동작 행을 "park 즉시 해제 + slow-path 일원화" 모델로 교체 |
| W3 | Rationale Continuity | fast-path Rationale은 이미 제거 선언, spec 본문 §7.4/§7.5는 여전히 fast-path 정상 동작으로 서술 — 구현자 오독 위험 | `spec/5-system/4-execution-engine.md §7.4 Worker 동작 행, §7.5 case 1 다이어그램` | Rationale "Durable Continuation & Graceful Shutdown — Sticky fast-path 제거" | plan "Spec 변경" 항목에 §7.4/§7.5 본문 정정을 동기 포함하거나, project-planner 가 spec PR-A1 에 함께 반영 |
| W4 | Rationale Continuity | D4(turn-단위 park) 결정을 뒷받침하는 Rationale 이 spec 어디에도 없음 — 향후 "무근거 번복"으로 오인 위험 | `plan exec-park-durable-resume Phase B1 (D4 확정)` | `spec/5-system/4-execution-engine.md §4.x, §7.4/§7.5` (현행 spec: "대화 전체 = 단일 waiting" 전제) | plan "Spec 변경" 항목에 "D4 turn-단위 park Rationale 명문화 (§4.x 또는 신규 §Rationale)" 추가. 최소 내용: 기존 방식과의 차이, D4 채택 근거(메모리 bounded + slow-path 일원화 정합), 기각 대안 |
| W5 | Plan Coherence | D1 미확정 상태에서 Phase A1 착수 금지 — `conversation_thread` 컬럼 전제 미승인 | `plan exec-park-durable-resume Phase A1 전체` | plan §미해결 결정 D1 "사용자 승인 시 확정" 조건 미완료; `spec/conventions/conversation-thread.md §4 L211` "향후 검토" 상태 | D1을 착수 전 사용자에게 명시적 승인 획득 후 plan "(확정 2026-06-05)" 표기로 갱신, 그 후 Phase A1 진입 |
| W6 | Plan Coherence | Phase 0 선행 조건(exec-intake-queue PR3: rehydration 일반화) 미구현 상태에서 Phase A 착수 금지 | `plan exec-park-durable-resume §Phase 0` (체크리스트 전항목 미체크) | `plan exec-intake-queue-impl.md §PR3` (미착수) | Phase A 착수 전 Phase 0 완료 필수. exec-intake-queue PR3 코드를 본 worktree 에 흡수(rebase/cherry-pick 또는 PR3 선행 머지 후 rebase) |
| W7 | Plan Coherence | `impl-exec-concurrency-cap` worktree 가 `4-execution-engine.md §8` 활성 수정 중 — exec-park 의 §4.x/§6.2/§7.4/§7.5 수정과 PR 병합 순서 충돌 후보 | `plan exec-park-durable-resume §Spec 변경 (4-execution-engine.md §4.x, §6.2, §7.4, §7.5)` | `plan exec-intake-queue-impl.md §spec-update-pr2a-timeout` (worktree: `impl-exec-concurrency-cap`, ACTIVE) | `impl-exec-concurrency-cap` 의 spec PR(§8)을 먼저 머지하거나, exec-park spec PR 착수 시 해당 diff 확인 후 충돌 최소화 전략(cherry-pick 순서, rebase base 맞추기) 수립 |
| W8 | Plan Coherence | `conversation-thread.md §4/§7/§8` 동시 수정 — `ai-context-memory-followup-v2` plan 의 §4 후속 편집 시 stale 컨텍스트 위험 | `plan exec-park-durable-resume §Spec 변경 (conversation-thread.md §4/§7/§8)` | `plan ai-context-memory-followup-v2.md` (§4 DB 컬럼 조항, §7 v2 로드맵 항목) | exec-park PR-A1 편집 시 `ai-context-memory-auto.md` 가 추가한 §4 블록(L213–L216) 훼손 방지 + `ai-context-memory-followup-v2.md` 에 cross-note 추가 |
| W9 | Convention Compliance | `spec/5-system/11-mcp-client.md §6.2` 의 `skipReason` `lower_snake_case` 예외가 `error-codes.md §3` 레지스트리에 미등재 | `spec/5-system/11-mcp-client.md §6.2` | `spec/conventions/error-codes.md §3` historical-artifact 레지스트리 (미등재) | `error-codes.md §3` 에 `skipReason` 값들의 `lower_snake_case` 예외를 명시 등재 또는 해당 spec 섹션에 규약 예외 cross-reference 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | plan Phase A2 의 `information_extractor` checkpoint 확장이 `§1.3` "ai_agent 한정" 문구와 착수 후 일시 불일치 예정 (plan 이 3곳 동기 갱신 의무 인지) | `spec/5-system/4-execution-engine.md §1.3` (L111–113) | PR-A2 전 project-planner 가 "ai_agent 한정" 문구 3곳 사전 갱신 |
| I2 | Cross-Spec | `spec/1-data-model.md` frontmatter 에 `exec-park-durable-resume.md` 미등록 (Phase A1 이 data-model 변경 수반) | `spec/1-data-model.md` (frontmatter 없음) | `spec/1-data-model.md` 에 `pending_plans:` frontmatter 추가 또는 `spec-impl-evidence.md` 연동 추적 명시 |
| I3 | Cross-Spec | Phase 0 흡수 결정(D5)이 `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 에 중복 추적 위험 | `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` | Phase 0 완료 시 `exec-intake-queue-impl.md` PR3 이관 표기와 동시에 spec frontmatter 정합 갱신 |
| I4 | Rationale Continuity | A2 `information_extractor` checkpoint 확장: 기존 Rationale "일반화는 후속 작업"으로 열어뒀으므로 번복 아님, 단 확장 Rationale 필요 | `spec/5-system/4-execution-engine.md` Rationale "ai_agent 한정" 항목 | A2 구현 후 Rationale 에 "information_extractor state 호환성 판단, allow-list 정책 적용 방식" 단락 추가 |
| I5 | Rationale Continuity | B3 `firstSegmentBarriers` 제거: Rationale 방향 일치, spec §4.x 구현 메모 갱신 누락 위험 | `spec/5-system/4-execution-engine.md §4.x 구현 메모` | plan "Spec 변경" 항목에 §4.x 구현 메모의 `firstSegmentBarriers` 서술 정리 포함 |
| I6 | Plan Coherence | D2(user-defined variables 복원 범위)·D3(park 중 워크플로 편집 시 재개 정책) 미확정 — Phase A3/PR-B 범위·안전성 불확실 | `plan exec-park-durable-resume §미해결 결정 D2, D3` | D1 승인 시 D2·D3 도 동시 확인, plan 에 "(확정)" 표기. D3 는 PR-B 불변식 보장에 직접 영향 |
| I7 | Plan Coherence | `node-cancellation-infrastructure.md §2` 담당 worktree(`node-cancellation-engine`) git worktree list 미발견 — Phase 0 직렬화 순서 확정 항목 답 불명 | `plan exec-park-durable-resume §Phase 0` | Phase 0 착수 시 `node-cancellation §2` 현재 진행 상태(branch 존재·담당자) 확인 후 직렬화 순서 명문화 |
| I8 | Plan Coherence | stale worktree 5건 cleanup 권장 (MERGED PR): `impl-exec-intake-queue`, `spec-exec-intake-queue`, `fix-bg-context-followups`, `kb-quality-fba2f2`, `agent-memory-admin-ui-455467` | 각 worktree | `.claude/tools/cleanup-worktree-all.sh --yes --force` 실행 권장 |
| I9 | Naming Collision | exec-intake-queue PR3 이관 표기 미완료 시 중복 구현 위험 | `plan/in-progress/exec-intake-queue-impl.md §PR3` | Phase 0 착수 전 PR3 항목에 "→ exec-park-durable-resume 이관" cross-link 완료 여부 확인 |
| I10 | Naming Collision | PR-A2 spec 갱신을 구현 커밋과 별도 PR 로 분리하면 consistency-check False Critical 발생 가능 | `spec/5-system/4-execution-engine.md §1.3` L111–113 | PR-A2 에서 spec 갱신을 동반 커밋으로 묶어 제출 |
| I11 | Convention Compliance | `spec/5-system/1-auth.md §1.5.4` 에러 코드 `lower_snake_case` 표기 (규약: `UPPER_SNAKE_CASE`) — API 계약 값이므로 구현 착수 전 수정 권장 | `spec/5-system/1-auth.md §1.5.4` 에러 응답 표 | `INVITATION_NOT_FOUND` 등 6개 코드를 `UPPER_SNAKE_CASE` 로 변경. codebase 에 이미 lowercase 정착 시 `error-codes.md §3` historical-artifact 레지스트리 등재 |
| I12 | Convention Compliance | `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 와 `## 1. 개요` 이중 정의, 구조 비일관 | `spec/5-system/10-graph-rag.md` 전체 구조 | 두 섹션 통합 또는 동일 영역 파일과 구조 통일 |
| I13 | Convention Compliance | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — POST 응답 표 `order` wrapper 설명이 정렬 파라미터 설명으로 잘못 복사됨 | `application/appstore-orders.md` POST 응답 표 `order` 행 | 설명을 `(응답 객체)` 로 수정 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `Execution.conversation_thread` 컬럼이 `spec/1-data-model.md §2.13` 에 미등록 (마이그레이션 누락 위험). fast-path spec 본문-Rationale drift |
| Rationale Continuity | MEDIUM | spec §7.4/§7.5 본문이 Rationale 이 제거 선언한 fast-path 를 정상 동작으로 서술. D4 turn-단위 park Rationale 부재 |
| Convention Compliance | LOW | `skipReason` 예외 레지스트리 미등재(WARNING). 에러 코드 대소문자 불일치·문서 구조 비일관(INFO) |
| Plan Coherence | MEDIUM | D1 미확정 Phase A1 착수 위험. Phase 0 선행 조건 미충족. spec 동시 수정 충돌 후보 2건. stale worktree 5건 |
| Naming Collision | LOW | `Execution.conversation_thread` data-model 미등록(Cross-Spec W1 과 동일 발견). 나머지 기존 식별자 충돌 없음 |

## 권장 조치사항

1. **(착수 전 필수)** D1(Execution.conversation_thread 컬럼 채택)을 사용자에게 명시적 승인 획득 후 plan 갱신. 동시에 D2·D3 도 확정.
2. **(착수 전 필수)** Phase 0 완료: exec-intake-queue PR3(rehydration 일반화 + 멱등 재개) 코드를 본 worktree 에 흡수.
3. **(PR-A1 전)** `spec/1-data-model.md §2.13 Execution` 에 `conversation_thread JSONB?` 컬럼 행 추가 + 마이그레이션 버전 명기 (W1 해소).
4. **(spec PR 착수 전)** `spec/5-system/4-execution-engine.md §7.4/§7.5` 본문에서 fast-path(`pendingContinuations` 즉시 resolve, case 1 다이어그램) 서술을 제거/강등 — Rationale 이 이미 선언한 변경을 본문에 반영 (W3 해소).
5. **(plan 갱신)** D4 turn-단위 park Rationale 명문화 항목을 plan "Spec 변경" 에 추가 — 기존 "대화 전체 = 단일 waiting" 방식 대비 채택 근거·기각 대안 기록 (W4 해소).
6. **(충돌 예방)** `impl-exec-concurrency-cap` 의 `4-execution-engine.md §8` spec PR 을 exec-park spec PR 보다 먼저 머지하거나, 착수 시 rebase base 조율 (W7 해소).
7. **(충돌 예방)** `ai-context-memory-followup-v2.md` 에 "exec-park PR-A1 이 conversation-thread.md §4 DB 컬럼 조항 변경" cross-note 추가 (W8 해소).
8. **(병행 권장)** stale worktree 5건 cleanup 실행 (I8).
9. **(병행 권장)** `error-codes.md §3` 에 `skipReason` lower_snake_case 예외 등재 (W9 해소).

---