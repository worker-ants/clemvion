# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 불필요.

## 전체 위험도

**MEDIUM** — 다수의 WARNING 이 존재하나 모두 spec 보완 수준이며, 현 worktree 구현 대상(`spec/5-system/4-execution-engine.md` Durable Continuation / Graceful Shutdown)에 직접 차단을 요구하는 항목은 없다.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | convention_compliance | `1-auth.md` 에러 코드 6종이 `lower_snake_case` — `UPPER_SNAKE_CASE` 규약 위반 | `spec/5-system/1-auth.md §1.5.4` | `spec/conventions/node-output.md` Principle 3.2, `spec/5-system/3-error-handling.md` 에러 코드 카탈로그 | `INVITATION_NOT_FOUND` 등 대문자로 변경 후 `3-error-handling.md` 에 공식 등재 |
| W2 | convention_compliance | `1-auth.md` frontmatter `status: spec-only` 이지만 본문에 V058 migration 운영 적용 및 WebAuthn 구현 경로 명기 — 라이프사이클 위반 | `spec/5-system/1-auth.md` frontmatter | `spec/conventions/spec-impl-evidence.md §3` | `status: partial` 또는 `implemented` 로 변경, `code:` 에 구현 경로 채우기, `pending_plans:` 등록 |
| W3 | convention_compliance | `1-auth.md` 에 `## Overview` 섹션 없어 3섹션 구조 불완전 | `spec/5-system/1-auth.md` | CLAUDE.md Spec 문서 3섹션 구성 규약 | `1-auth.md` 에 `## Overview` 섹션 추가 |
| W4 | convention_compliance | `11-mcp-client.md §6.2` `skipReason` 값이 `lower_snake_case` — 인라인 예외 근거는 있으나 컨벤션 미등록 | `spec/5-system/11-mcp-client.md §6.2` | `spec/conventions/node-output.md` Principle 3.2 | `spec/conventions/node-output.md` Principle 3.2 에 진단용 enum 예외 조항 추가 |
| W5 | convention_compliance | `1-auth.md §5` API 엔드포인트 표에서 `{ data: ... }` wrapper 유무 혼재 | `spec/5-system/1-auth.md §5` | `spec/conventions/swagger.md §2-5`, `spec/5-system/2-api-convention.md` | wrapper 일관 적용 |
| W6 | rationale_continuity | `recoverStuckExecutions` 에서 30분 `started_at` 임계값 → heartbeat 기반으로 교체한 결정 근거가 Rationale 에 없음 | `spec/5-system/4-execution-engine.md §7.4` | 동 파일 main 브랜치 §7.4 | `Durable Continuation (2026-05-24)` Rationale 에 교체 이유 한 단락 추가 |
| W7 | rationale_continuity | rehydration 실패 단말 상태를 Execution=`cancelled` / NodeExecution=`failed` 로 이분한 근거가 Rationale 에 없음 | `spec/5-system/4-execution-engine.md §1.1, §2` | 동 파일 main 브랜치 `waiting_for_input → failed` Rationale | `Durable Continuation` Rationale 에 이분 사유 추가 |
| W8 | cross_spec | WebAuthn 모듈 분리 결정(§1.4.H)이 §5 API 목록 독자에게 혼란 유발 | `spec/5-system/1-auth.md §1.4.H` vs `§5 API 엔드포인트` | 동일 파일 내부 | `§5` WebAuthn 엔드포인트 앞에 module host 인라인 참조 추가 |
| W9 | cross_spec | `10-graph-rag.md §2.1` KnowledgeBase 추가 컬럼 표에 `reextract_status` 누락 | `spec/5-system/10-graph-rag.md §2.1` | `spec/1-data-model.md §2.11 KnowledgeBase` | `§2.1` 표에 해당 행 추가 또는 SoT 각주 명시 |
| W10 | cross_spec | RBAC 매트릭스 `Auth Config` / `LLM Config` 의 Admin=CRUD 설정이 `spec/2-navigation/` 화면 spec 과 대조 미확인 | `spec/5-system/1-auth.md §3.2` | `spec/2-navigation/` | 화면 spec 과 권한 서술 교차 확인 |
| W11 | cross_spec | Internal Bridge (`cafe24`) provider 의 `McpToolProvider` 처리 대상 `service_type` 집합이 명시되지 않아 routing 경계 불명확 | `spec/5-system/11-mcp-client.md §6.2 skipReason` vs `§3.1` | 동일 파일 §3.1 | `§6.1` 또는 `§3.1` 에 명시 |
| W12 | plan_coherence | `spec/5-system/1-auth.md §1.5.1` Rate Limit 값이 "구현 시 결정"으로 미확정 | `spec/5-system/1-auth.md §1.5.1` | — | `1-auth.md` 구현 착수 전 결정 |
| W13 | plan_coherence | `11-mcp-client.md` `status: spec-only` 이나 구현 plan 없음 | `spec/5-system/11-mcp-client.md` | `plan/in-progress/ai-agent-tool-connection-rewrite.md` | 결정 기록 완료 후 진행 |
| W14 | naming_collision | `INVALID_EXECUTION_STATE` 가 spec(`6-websocket-protocol.md`, `4-execution-engine.md`)에는 등장하나 반환 조건 불완전, codebase 미구현 | `spec/5-system/6-websocket-protocol.md §4.2`, `spec/5-system/4-execution-engine.md §7.4` | `plan/in-progress/workflow-resumable-execution.md §2.9` | Phase 2 §2.9 task 완료 시 추가 |
| W15 | naming_collision | `INVALID_EXECUTION_STATE` (WS 전용) vs `INVALID_STATE` (REST 공용 422) — 유사 이름 혼동 가능성 | `spec/5-system/6-websocket-protocol.md §4.2` | `spec/5-system/3-error-handling.md line 42` | `§4.2` 에러 코드 표에 "WS 전용, REST `INVALID_STATE` 와 별개" 주석 한 줄 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 |
|---|---------|------|------|
| I1 | cross_spec | `1-auth.md §5` 에 `GET /api/auth/verify-email`, `POST /api/auth/resend-verification` 미수록 | `spec/5-system/1-auth.md §5` |
| I2 | cross_spec | JWT payload `workspaceId` 와 `X-Workspace-Id` 헤더 간 워크스페이스 전환 흐름 미명시 | `spec/5-system/1-auth.md §2.2, §3.3` |
| I3 | cross_spec | AuditLog / LoginHistory 경계 원칙 미반영 | `spec/5-system/1-auth.md §4.1` vs `spec/1-data-model.md §2.18` |
| I4 | cross_spec | `10-graph-rag.md §6` 채널명 교차 확인 미완 | `spec/5-system/10-graph-rag.md §6` vs `spec/5-system/8-embedding-pipeline.md §8` |
| I5 | cross_spec | `11-mcp-client.md §8.3` `node_execution_id` NOT NULL 인데 Test Connection 호출 시 usage log 미생성 예외 미명시 | `spec/5-system/11-mcp-client.md §8.3` |
| I6 | rationale_continuity | `§9.3 BullMQ 큐 목록` `task-queue` 행에 "구현 검증 후 확정/삭제" 미확정 표기 잔류 | `spec/5-system/4-execution-engine.md §9.3` |
| I7 | rationale_continuity | `§11` Graceful Shutdown 항목 3에 `Durable Continuation Rationale` cross-reference 링크 없음 | `spec/5-system/4-execution-engine.md §11` |
| I8 | rationale_continuity | `§10.9` outer 메시지 스키마 SoT 불명확 | `spec/4-nodes/6-presentation/0-common.md §10.9` |
| I9 | convention_compliance | `code:` migration glob 가드 파일명 변경 시 stale 위험 | `spec/5-system/10-graph-rag.md` frontmatter |
| I10 | convention_compliance | `11-mcp-client.md` `status: spec-only` TTL 90일 위험 | `spec/5-system/11-mcp-client.md` |
| I11 | convention_compliance | `10-graph-rag.md §Overview` 구현 완료 현황 블록이 Overview 목적 초과 | `spec/5-system/10-graph-rag.md` |
| I12 | plan_coherence | `2fa-webauthn-followups.md` 항목 2/3/10 미완료 잔류 | `plan/in-progress/2fa-webauthn-followups.md` |
| I13 | plan_coherence | `10-graph-rag.md` frontmatter 갱신이 현 worktree 에만 있고 main 미반영 | `spec/5-system/10-graph-rag.md` |
| I14 | plan_coherence | PR MERGED 상태 stale worktree 2건 잔류 | `.claude/worktrees/` |
| I15 | naming_collision | `RESUME_BULLMQ_ATTEMPTS` 가 spec 에는 ENV 변수로 등재되어 있으나 코드에서는 상수로 선언 | `spec/5-system/4-execution-engine.md §11` |
| I16 | naming_collision | `SERVER_SHUTTING_DOWN` 이 `spec/5-system/3-error-handling.md` 공용 에러 코드 표에 미등재 | `spec/5-system/4-execution-engine.md §11` |
| I17 | naming_collision | `queued: true` + `resumed: true` 동시 성립 케이스 의미론 명확 서술 필요 | `spec/5-system/6-websocket-protocol.md §4.2` |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | W8, W9, W11 |
| Rationale Continuity | MEDIUM | W6, W7 |
| Convention Compliance | MEDIUM | W1, W2, W5 |
| Plan Coherence | LOW | W12, W13 (defer 가능) |
| Naming Collision | LOW | W14, W15 |

## 현 worktree 직접 처리 권고

1. **[W14] `INVALID_EXECUTION_STATE` 반환 조건 완성** — Phase 2.9 task 로 진행 — 본 worktree에서 spec 추가 권고 (project-planner 위임 필요 가능).
2. **[W15] `INVALID_EXECUTION_STATE` vs `INVALID_STATE` 주석** — `§4.2` 에러 코드 표에 WS 전용 명시.
3. **[I6] `task-queue` 미확정 표기 정리** — Phase 2.8 task.
4. **[I15] `RESUME_BULLMQ_ATTEMPTS` ENV/상수 차이 인라인 노트**.

W6/W7/W1/W2/W5/W8~W13/W4 등 나머지는 본 worktree 구현 대상 외 — defer.
