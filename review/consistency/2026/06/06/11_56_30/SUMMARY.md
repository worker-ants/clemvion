# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**MEDIUM** — 동일 spec 파일(4-execution-engine.md, 14-external-interaction-api.md)의 다중 worktree 동시 수정이 실질적 병합 위험을 형성. 그 외는 LOW 이하.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `0-overview.md §2.4` durable 컬럼 목록 미동기 — `conversation_thread`/`user_variables`/`resume_call_stack` 신규 컬럼이 overview 에 미반영 | `spec/0-overview.md §2.4 Execution Engine` | `spec/5-system/4-execution-engine.md §6.2` | `0-overview.md §2.4` 에 "durable park 상태는 V084/V085/V087 세 컬럼으로 무손실 영속" 한 줄 추가 |
| W2 | Cross-Spec | `13-replay-rerun.md §14.3` 에 rehydration 컬럼(`conversation_thread`/`user_variables`) 언급 전혀 없음 — re-run spec 독자가 과거 모델로 오해 가능 | `spec/5-system/13-replay-rerun.md §14.3` | `spec/5-system/4-execution-engine.md §7.5` | §14.3 에 "재개 시 두 컬럼에서 무손실 복원([§7.5](./4-execution-engine.md#75-resume-after-restart-rehydration))" 단서 추가 |
| W3 | Cross-Spec | `conversation-thread.md §4` "실행 중" 행의 "복원 불가" 문구가 park 해결 후에도 현재 시제로 잔존 — 해소된 갭이 여전히 존재한다는 오해 유발 | `spec/conventions/conversation-thread.md §4 "실행 중" 행` | `spec/conventions/conversation-thread.md §8.4` 채택 결정 | §4 해당 문구를 "park 이전에는 복원 불가였으나 park 스냅샷으로 해소 — §4 'waiting_for_input park 진입 시' 행이 실질적 무손실 보장 제공" 으로 정정 |
| W4 | Convention-Compliance | `spec/5-system/1-auth.md §1.5.4` 의 invitation 에러코드 lower_snake_case 예외가 `error-codes.md §3`(SoT)와 본문 양쪽에 중복 정의 — 갱신 시 동기 누락 위험 | `spec/5-system/1-auth.md §1.5.4` 각주 | `spec/conventions/error-codes.md §3` historical-artifact 레지스트리 | `1-auth.md §1.5.4` 각주를 `error-codes.md §3` 링크 참조 한 줄로 단축 |
| W5 | Convention-Compliance | `appstore-orders.md` 응답 파라미터 wrapper row 설명에 정렬 파라미터 설명이 오기재 — `_overview.md §7.2` 의 `(응답 객체)` 규약 미준수 | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` `order` wrapper row (GET·POST 두 operation) | `spec/conventions/cafe24-api-catalog/_overview.md §7.2` | 두 operation 의 `order` wrapper row 설명을 `(응답 객체)` 로 교체 |
| W6 | Plan-Coherence | `impl-exec-concurrency-cap`(branch `claude/impl-concurrency-cap-pr2b`)이 `spec/5-system/4-execution-engine.md` 를 동시 수정 중 — PR 미생성 상태라 active 처리, W4 경고 미해소 | `spec/5-system/4-execution-engine.md` | `plan/in-progress/exec-intake-queue-impl.md` worktree `impl-exec-concurrency-cap` | PR-B2 머지 후 `exec-intake-queue-impl.md` PR2b 착수조건에 "origin/main 기준 rebase 완료 확인" 명기 |
| W7 | Plan-Coherence | `impl-exec-concurrency-cap`이 `spec/5-system/14-external-interaction-api.md` 도 동시 수정 — 머지 순서 의존 발생 | `spec/5-system/14-external-interaction-api.md` | `plan/in-progress/exec-intake-queue-impl.md` | PR-B2 머지 후 해당 브랜치 즉시 rebase, 충돌 여부 확인 |
| W8 | Plan-Coherence | exec-park D6 미구현 설계안이 spec §7.5 에 완료형 알고리즘으로 기술 — PR-B2b 구현 후 미갱신 시 spec↔impl drift 발생 가능 | `spec/5-system/4-execution-engine.md §7.5 D6 절` | `plan/in-progress/exec-park-durable-resume.md` Phase B PR-B2b | `exec-park-durable-resume.md` PR-B2b 체크리스트에 "spec §7.5 D6 절·§Rationale D6 구현 완료 플립" 항목 추가 |
| W9 | Naming-Collision | `exec-park D6` 레이블이 AI 노드 spec(`1-ai-agent.md`, `3-information-extractor.md`, `2-text-classifier.md`)의 기존 `D6` 레이블(output 경로 단일화)과 동명 — 교차 참조 시 혼동 가능 | `spec/5-system/4-execution-engine.md §7.5 exec-park D6` | `spec/4-nodes/3-ai/1-ai-agent.md` D6, `spec/4-nodes/3-ai/3-information-extractor.md` D6 | spec 내 참조 시 "exec-park D6" 전체 형태 유지(이미 경고 주석 삽입됨). `1-ai-agent.md` D6 항목에 역방향 경고 한 줄 추기 (필수 아님) |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `4-execution-engine.md §7.5` 경고 주석 삽입 완료 — `1-ai-agent.md` 에 역방향 경고 없음 | `spec/4-nodes/3-ai/1-ai-agent.md` D6 항목 | 역방향 경고 한 줄 추기 (필수 아님) |
| I2 | Cross-Spec | `1-data-model.md` `resume_call_stack` 행에 구현 상태 단서 누락 (항상 `NULL` 상태) | `spec/1-data-model.md §2.13 resume_call_stack` | 행 끝에 "(V087 컬럼 추가 완료, park stage·재귀 rehydration 로직은 PR-B2b 구현 예정 — 그 전까지 항상 `NULL`)" 단서 추가 |
| I3 | Cross-Spec | Information Extractor 동기화 완료 확인 — `1-ai-agent.md §703` spot-check 권장 | `spec/4-nodes/3-ai/1-ai-agent.md §703` | "ai_agent · information_extractor" 로 갱신됐는지 confirm |
| I4 | Rationale-Continuity | `resume_call_stack` vs `_continuationCheckpoint` 구분이 `1-data-model.md` 에는 간접 참조만 | `spec/1-data-model.md resume_call_stack` 항목 | "`_continuationCheckpoint` 기각과 직교 목적 — 상세: §Rationale exec-park D6" 한 줄 인라인 주석 추가 (선택) |
| I5 | Rationale-Continuity | PR-B2 → B2a/B2b 세분화 후 plan 파일과 spec Rationale 의 B1/B2 서술 동기화 필요 가능성 | `plan/in-progress/exec-park-durable-resume.md`, `spec/5-system/4-execution-engine.md §Rationale` | plan 완료 시 최종 확인 |
| I6 | Rationale-Continuity | SSE wire 필드 주의 blockquote 제거 근거가 diff 내 미문서화 — `fix-webchat-sse-field-map` plan 완료/폐기 여부 불명 | `spec/5-system/14-external-interaction-api.md §6.2`, `spec/7-channel-web-chat/0-architecture.md §3` | `fix-webchat-sse-field-map` plan 완료·폐기 처리 여부 확인 |
| I7 | Convention-Compliance | `spec/5-system/1-auth.md §Rationale` 항목이 본문 섹션 번호 역순 배치 (1.5.* → 1.4.*) | `spec/5-system/1-auth.md §Rationale` | 1.4.* → 1.5.* 오름차순 재정렬 |
| I8 | Convention-Compliance | `spec/5-system/10-graph-rag.md` Overview 섹션이 요구사항 전체 흡수 — 3섹션 권장 구조와 거리 있음 | `spec/5-system/10-graph-rag.md` | §3~7 요구사항을 본문 h2 로 승격하거나 예외 명문화 |
| I9 | Convention-Compliance | `spec/5-system/11-mcp-client.md` — `## Overview` 미사용, `## Rationale` 없음 | `spec/5-system/11-mcp-client.md` | Rationale 섹션 집약 또는 예외 명문화 |
| I10 | Convention-Compliance | `skipReason` lower_snake_case 가 자체 선언으로 처리됐으나 `error-codes.md §3` 미등재 | `spec/5-system/11-mcp-client.md §6.2` | `error-codes.md §3` 에 skipReason 항목 등재 또는 §Overview 에 예외 경계 추가 |
| I11 | Convention-Compliance | `_overview.md` frontmatter 없음 — 밑줄 prefix 면제 규칙 정상 적용 확인 | `spec/conventions/cafe24-api-catalog/_overview.md` | 없음 (면제 정상) |
| I12 | Convention-Compliance | `application.md §표` 섹션명이 다른 resource.md 와 일관성 불명 | `spec/conventions/cafe24-api-catalog/application.md` | `_overview.md §1` 에 "표 섹션 h2 명칭은 `## 표` 로 통일" 한 줄 추가 |
| I13 | Plan-Coherence | `spec-sync-auth-gaps.md` plan — `spec/5-system/1-auth.md` pending이나 본 worktree 수정 없어 충돌 없음 | `spec/5-system/1-auth.md` | 착수 시 worktree 충돌 재점검 |
| I14 | Plan-Coherence | `execution-engine-residual-gaps.md` G2 — exec-park Phase A/B 완료로 "인프라 부재" 전제 일부 충족 | `spec/5-system/4-execution-engine.md §11` | PR-B2 완료 후 G2 장애물 상태 재점검 |
| I15 | Plan-Coherence | stale worktree 2건(`rag-eval-harness-b8cc46`, `rag-eval-plan-hygiene-279c3e`) — 각각 PR #488/#489 MERGED | `.claude/worktrees/` | `cleanup-worktree-all.sh --yes --force` 실행 권장 |
| I16 | Naming-Collision | `CALL_STACK_SCHEMA_VERSION` vs `CHECKPOINT_SCHEMA_VERSION` — 이름 구조 유사, 의미 다름. spec 에 "독립 상수" 명시 | `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` | 현행 유지 |
| I17 | Naming-Collision | `LLM_STUB_MODE` 환경 변수 — `.env.example` 미등재 여부 확인 필요 | `codebase/backend/src/modules/llm/llm.service.ts` | `OAUTH_STUB_MODE` 등재 여부 확인 후 동일 패턴 적용 |
| I18 | Naming-Collision | `ResumeCallStack`/`ResumeCallStackFrame` 신규 타입 — 기존 충돌 없음, 명명 관례 일치 | `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` | 없음 |
| I19 | Naming-Collision | `processAiResumeTurn` vs `runAiConversationLoop` — 역할 분리 명확, 동일 파일 내 private | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` | 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | CRITICAL 0건. `0-overview.md`, `13-replay-rerun.md`, `conversation-thread.md §4` 가 신규 durable 컬럼을 충분히 반영하지 않아 독자 오해 여지 (W1~W3) |
| Rationale-Continuity | NONE | CRITICAL·WARNING 0건. `resume_call_stack` vs `_continuationCheckpoint` 구분, PR-B2 세분화, SSE 필드 제거 모두 합의 원칙 유지 (INFO 3건) |
| Convention-Compliance | LOW | CRITICAL 0건. 에러 코드 이중 정의(W4), appstore-orders wrapper 오기재(W5) 두 WARNING. 나머지 문서 구조 INFO |
| Plan-Coherence | MEDIUM | CRITICAL 0건. `impl-exec-concurrency-cap` 과 동일 spec 파일 동시 수정(W6·W7)이 실질적 병합 위험. D6 미구현 spec 기재(W8)는 flip 의무 동반 |
| Naming-Collision | LOW | CRITICAL 0건. `exec-park D6` 레이블 동명 혼동 가능(W9)이나 경고 주석 삽입 완료. 신규 식별자 전체 고유 |

---

## 권장 조치사항

1. **(병합 위험 해소 — W6·W7)** PR-B2 머지 전·후 `impl-exec-concurrency-cap` 브랜치가 `origin/main`(PR-B2 포함) 기준으로 rebase 함을 `exec-intake-queue-impl.md` 착수조건에 명기.
2. **(PR-B2b 체크리스트 보강 — W8)** `exec-park-durable-resume.md` PR-B2b 항목에 "spec §7.5 D6 절·§Rationale D6 구현 완료 플립" 추가하여 spec↔impl drift 방지.
3. **(Cross-Spec 단서 추가 — W1~W3)** `spec/0-overview.md §2.4`, `spec/5-system/13-replay-rerun.md §14.3`, `spec/conventions/conversation-thread.md §4` 에 각 WARNING 제안대로 단서·링크 추가 (spec 편집 권한: project-planner).
4. **(에러코드 SoT 정리 — W4)** `spec/5-system/1-auth.md §1.5.4` 각주를 `spec/conventions/error-codes.md §3` 링크 한 줄로 단축.
5. **(catalog wrapper 오기재 수정 — W5)** `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` `order` wrapper row 설명을 `(응답 객체)` 로 교체.
6. **(D6 역방향 경고 — W9)** `spec/4-nodes/3-ai/1-ai-agent.md` D6 항목에 역방향 경고 한 줄 추기 (선택적, 실제 충돌 없음).
7. **(stale worktree 정리 — I15)** `cleanup-worktree-all.sh --yes --force` 로 MERGED PR 대응 worktree 제거.
8. **(LLM_STUB_MODE 환경 변수 — I17)** `OAUTH_STUB_MODE` 등재 여부 확인 후 `.env.example` 동일 패턴 적용.