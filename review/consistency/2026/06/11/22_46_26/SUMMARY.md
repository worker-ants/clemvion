# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 차단 불필요

## 전체 위험도
**LOW** — 5개 checker 모두 CRITICAL/BLOCKING 위배 없음. 가장 높은 등급은 WARNING 2건(rationale_continuity Planned action dot-prefix 누락, convention_compliance `model_config.*` 와일드카드 불명확). 나머지 전부 INFO.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Rationale Continuity | Planned action `password_change`, `2fa_enable/disable` 이 합의된 `<resource>.<verb>` dot-prefix 규약을 위반 — 구현 시 `AUDIT_ACTIONS` 에 잘못된 flat 이름으로 등록될 위험 | `spec/5-system/1-auth.md §4.1` Planned 표 (라인 364) | `spec/5-system/1-auth.md §4.1` Action naming 규약 + `spec/data-flow/1-audit.md ## Rationale` | `password_change` → `user.password_change`, `2fa_enable/disable` → `user.2fa_enabled` / `user.2fa_disabled` (또는 현재형) 으로 수정. verb 형태(현재형 vs 과거분사) 선택도 Rationale 에 명시 |
| W-2 | Convention Compliance | Planned 표의 `model_config.*` 와일드카드 표기가 불명확해 구현자가 구체 동사를 추정해야 하는 상황 | `spec/5-system/1-auth.md §4.1` Planned 표 — `설정` 카테고리 `model_config.*` 셀 | `spec/5-system/1-auth.md §4.1` 자체 Action naming 규약(구체 SoT = `AUDIT_ACTIONS`) | `model_config.create`, `model_config.update`, `model_config.delete`, `model_config.set_default` 4개로 명시하거나, "구현 시 이 4개로 `AUDIT_ACTIONS` 에 추가" 주석 기재 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `password_change`, `2fa_enable/disable` 이 `spec/data-flow/1-audit.md §1.1` Planned 섹션에 명시적으로 열거되지 않고 `등` 으로 축약됨 | `spec/5-system/1-auth.md §4.1` / `spec/data-flow/1-audit.md §1.1` | data-flow §1.1 Planned 섹션에 슬러그 명시적 열거로 동기화 |
| I-2 | Cross-Spec | Integration (Org) CRUD 매트릭스에서 9-user-profile.md §4.2 가 생성 행만 열거, 조회·수정·삭제 행 누락 | `spec/5-system/1-auth.md §3.2` / `spec/2-navigation/9-user-profile.md §4.2` | `Integration 조회(Org)`, `Integration 수정·삭제(Org)` 행 추가로 매트릭스 완성 |
| I-3 | Cross-Spec | `spec/5-system/1-auth.md §4.1` Planned 표 내 `2fa_enable/disable` dot-prefix 미준수 (W-1 과 동일 근원) | `spec/5-system/1-auth.md §4.1` | W-1 조치 시 함께 해소됨 |
| I-4 | Rationale Continuity | Planned 전체 verb 형태(현재형 vs 과거분사) 선택에 명시적 근거 없음 — `workspace.create` 등이 `integration.created` 와 다른 형식 | `spec/5-system/1-auth.md §4.1` Planned 표 | §4.1 naming 규약 문단에 형태 선택 기준 한 줄 + Rationale 단락 추가 |
| I-5 | Rationale Continuity | `workspace.transfer_ownership` 복합 동사 현재형 채택 근거 없음 | `spec/5-system/1-auth.md §4.1` 구현 표 | Rationale 에 "복합 동사 현재형 택한 이유" 한 줄 추가 |
| I-6 | Convention Compliance | `1-auth.md §1.5.4` 블록 인용이 `error-codes.md §3` 레지스트리와 이중 선언 모양새 — SoT 모호 | `spec/5-system/1-auth.md §1.5.4` 블록 인용 | 블록 인용을 "이 코드들은 `error-codes.md §3` 에 등재됨 — 근거 참조" 형식으로 축약해 SoT 명시 |
| I-7 | Convention Compliance | `10-graph-rag.md` 문서 구조 — `## Overview` 내 `### 1~8` 과 본문 `## 1~8` 이 이중 번호 계층 혼재 | `spec/5-system/10-graph-rag.md` 전체 | 향후 편집 시 두 층을 분리하거나 번호 체계 통일. 앵커 변경 시 `spec-link-integrity.test.ts` 가드 통과 필수 |
| I-8 | Convention Compliance | `document:graph_error` WebSocket 이벤트가 dead-declared 상태로 spec 에 노출 | `spec/5-system/10-graph-rag.md §6` | spec 이벤트 표에서 제거하거나 "선언만 존재, emit 없음" 명시 + 코드 union 정리 plan 등록 |
| I-9 | Convention Compliance | `MCP_HTTPS_REQUIRED` 에러 코드가 SSRF 차단·HTTPS 미충족 두 조건을 하나로 처리 — `error-codes.md §1` "의미 기술" 원칙과 미세하게 어긋남 | `spec/5-system/11-mcp-client.md §3.2` | `MCP_SSRF_BLOCKED` 분리 또는 `MCP_INSECURE_URL` 로 rename 검토 (코드가 클라이언트 분기에 사용 중이면 신규 코드 신설) |
| I-10 | Convention Compliance | `mcpDiagnostics` 미구현 필드에 대한 `pending_plans` 연결 확인 필요 | `spec/5-system/11-mcp-client.md §6.2` | `plan/in-progress/spec-sync-mcp-client-gaps.md` 존재·frontmatter `pending_plans:` 기재 여부 확인 |
| I-11 | Plan Coherence | `auth-config-webhook-followups.md §2·§3·§4` 미착수 — 본 PR 범위 밖으로 명확히 분리됨 | `plan/in-progress/auth-config-webhook-followups.md §2~§4` | 조치 불요. 후속 단계에서 순차 처리 |
| I-12 | Plan Coherence | stale worktree 2건(`claude/prod-fail-closed-guards`, `claude/unified-model-mgmt-pr4`) 디렉토리 잔존 | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| I-13 | Naming Collision | `graphTraversal` — KB RAG 응답 필드(신규)와 `ExecutionEngineService` private 필드(기존) 동명 — 런타임 충돌 없으나 가독성 혼동 | `spec/5-system/10-graph-rag.md §4.3` / `execution-engine.service.ts:845` | spec §4.3 또는 타입 정의에 "KB RAG 전용, `GraphTraversalService` 와 무관" disambiguation 한 줄 추가 |
| I-14 | Naming Collision | `GraphExtractionProcessor` vs `GraphExtractionService` — spec §2 Overview 와 §3.2 헤딩이 혼용 | `spec/5-system/10-graph-rag.md §2, §3.2` | §3.2 헤딩을 `Processor / Service 흐름` 으로 수정하거나 본문 첫 줄에 관계 명시 |
| I-15 | Naming Collision | `model_config.*` 통합 선언 후 `audit-action.const.ts` 주석·`data-flow/1-audit.md` 에 구 `llm_config.*`/`rerank_config.*` 잔존 | `codebase/backend/.../audit-action.const.ts:15` / `spec/data-flow/1-audit.md:69` | 구현 시 `AUDIT_ACTIONS` 에 `MODEL_CONFIG_*` 추가하며 주석 동시 갱신. spec 변경 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | CRITICAL/WARNING 없음. Planned action 슬러그 미명시, Integration 매트릭스 누락 — INFO 3건 |
| Rationale Continuity | LOW | Planned action dot-prefix 규약 위반(WARNING), verb 형태 근거 없음(INFO 2건) |
| Convention Compliance | LOW | `model_config.*` 와일드카드 불명확(WARNING), SoT 이중 선언·dead event·MCP 에러 코드 범위 — INFO 4건 |
| Plan Coherence | NONE | plan 체크리스트·worktree 충돌 0건. 모두 INFO. stale worktree 정리 권장 |
| Naming Collision | LOW | 런타임 충돌 없음. `graphTraversal` 동명 혼동·Processor/Service 혼용·구 action 이름 잔존 — INFO 3건 |

## 권장 조치사항

1. **(W-1 해소)** `spec/5-system/1-auth.md §4.1` Planned 표의 `password_change` → `user.password_change`, `2fa_enable/disable` → `user.2fa_enabled` / `user.2fa_disabled` 로 수정. 동시에 `spec/data-flow/1-audit.md §1.1` Planned 섹션에도 동일 슬러그 명시적 열거 동기화.
2. **(W-2 해소)** `model_config.*` 와일드카드를 4개 구체 슬러그(`model_config.create`, `model_config.update`, `model_config.delete`, `model_config.set_default`)로 전개하거나 구현 지시 주석 기재.
3. **(I-4 해소)** §4.1 naming 규약 문단에 Planned action verb 형태 기준(현재형 통일 또는 과거분사 통일) 한 줄 추가 및 Rationale 보완.
4. **(I-8 권장)** `document:graph_error` dead event 를 spec 에서 제거하거나 명시적 dead 표기 + 코드 정리 plan 등록.
5. **(I-12 권장)** stale worktree 디렉토리 정리 — `./cleanup-worktree-all.sh --yes --force`.
6. **(I-13, I-14 권장)** `graphTraversal` disambiguation 주석, `GraphExtractionProcessor/Service` 관계 명시.