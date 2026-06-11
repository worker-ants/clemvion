# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
Target: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md)

---

## 발견사항

### [INFO] spec-sync-auth-gaps.md — 1-auth.md 미해결 결정 항목이 있으나 target 과 직접 충돌 없음
- **target 위치**: `spec/5-system/1-auth.md §1.3` LDAP/SAML 블록
- **관련 plan**: `plan/in-progress/spec-sync-auth-gaps.md`
- **상세**: spec-sync-auth-gaps.md 는 §1.3 LDAP/SAML 미구현 추적을 위한 backlog plan 이다. target 의 §1.3 은 "미구현 · Planned" 로 명시 표기되어 있어 plan 과 정합. 단, 해당 plan 의 `worktree: spec-sync-audit` 가 현재 git worktree 목록에 존재하지 않음 — 물리 worktree 미생성 상태(unstarted sentinel 없이 실제 체크아웃 부재). 현재 착수 의도 없는 backlog 이므로 충돌 위험은 없다.
- **제안**: 변경 없음. spec §1.3 의 "미구현" 표기가 plan 추적과 이미 정합.

### [WARNING] auth-config-webhook-followups.md §3 — spec 보완 항목이 target(1-auth.md §5)에 미반영 상태
- **target 위치**: `spec/5-system/1-auth.md §5 API 엔드포인트` 표
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md §3`
- **상세**: auth-config-webhook-followups.md §3 이 "spec/5-system/1-auth.md §5 API 엔드포인트 표에 POST /api/auth-configs/:id/reveal 행 추가" 를 미완료 작업으로 명시 추적 중이다. target 의 현재 §5 표에는 이 엔드포인트가 없어 plan 에서 식별된 누락이 그대로 잔존. 구현 착수 전 이 gap 을 인지한 상태에서 1-auth.md 를 읽으면 API 표가 불완전하다는 점을 감안해야 한다.
- **제안**: 착수 전 `plan/in-progress/auth-config-webhook-followups.md §3` 의 spec 보완 항목(reveal 행 추가 + IP 추출 정책 cross-reference)을 먼저 처리하거나, 구현 범위에서 인지 사항으로 메모할 것.

### [WARNING] refactor/04-security.md C-1 — spec/5-system/1-auth.md §2 에 JWT secret fail-closed 명문화가 필요하나 미반영
- **target 위치**: `spec/5-system/1-auth.md §2.1/§2.3` (세션 관리), Rationale 섹션
- **관련 plan**: `plan/in-progress/refactor/04-security.md §C-1`
- **상세**: refactor/04-security.md C-1 은 "spec 갱신: `1-auth.md §2` 에 fail-closed 1줄 + Rationale (planner)" 을 C-1 이행 시 동반 필요 작업으로 명시한다. target 의 현재 1-auth.md §2 에는 JWT_SECRET 미설정 시 프로덕션 부팅 거부 정책이 기술되어 있지 않다. `plan/in-progress/security-jwt-secret-fallback.md` 가 "미착수(unstarted)" 상태로 별도 추적 중이며, refactor/04-security.md 는 동일 항목의 spec 갱신 의무를 이미 등재했다. 구현 착수 시 두 plan 이 동일 변경(jwt.config.ts 수정 + 1-auth.md 갱신)을 가리키고 있어 중복 처리 혼선 위험이 있다.
- **제안**: security-jwt-secret-fallback.md 와 refactor/04-security.md C-1 의 관계를 명시하고, spec 갱신(1-auth.md §2 fail-closed 1줄)이 어느 plan 의 범위인지 단일화할 것.

### [WARNING] refactor/04-security.md M-5 — 1-auth.md §2.1/2.3 SameSite 정책 공백이 target 에 존재하며 미결
- **target 위치**: `spec/5-system/1-auth.md §2.1` (JWT 토큰 구조), `§2.3` (세션 정책 표)
- **관련 plan**: `plan/in-progress/refactor/04-security.md §M-5`
- **상세**: M-5 는 "spec 갱신 필요 — 1-auth.md §2.1/2.3 에 SameSite 정책·CSRF 보완책 명시 (현재 완전 공백, planner)" 를 결론으로 기록한다. target 의 현 §2.1/2.3 에는 SameSite 속성 관련 내용이 전혀 없다. 이 gap 은 plan 에서 식별·추적 중이지만 아직 미해결이다. 구현 착수 전 1-auth.md 의 쿠키 정책 섹션을 읽을 때 SameSite=None 의 위험이 spec 에 명시되지 않은 채 잠복해 있음을 감안해야 한다.
- **제안**: 구현 착수(implementation plan 이 refresh 쿠키 동작을 건드리는 경우) 전, M-5 에 기술된 spec 공백을 planner 트랙으로 먼저 채우거나 현 구현이 SameSite=None 를 의도적으로 유지하는 근거를 Rationale 에 추가할 것.

### [WARNING] refactor/04-security.md M-7 — 11-mcp-client.md §1 에 MCP_ALLOW_INSECURE_URL 프로덕션 fail-closed 가드 명문화 미비
- **target 위치**: `spec/5-system/11-mcp-client.md §3.2` (credentials JSONB 스키마 하위 SSRF 정책 및 `WEBAUTHN_ALLOW_FALLBACK` 유사 환경변수 블록)
- **관련 plan**: `plan/in-progress/refactor/04-security.md §M-7`
- **상세**: M-7 은 "spec 갱신: §132 에 'production fail-closed (stub 동형)' + ALLOW_PRIVATE_HOST_TARGETS 는 warn 정책 구분 기술 (planner)" 를 요구한다. target 의 현 11-mcp-client.md §3.2 는 "운영 환경에서 절대 활성화해서는 안 된다" 고 적시하지만 fail-closed throw 를 명문화하지 않아 spec 의도 ↔ enforcement 비대칭이 남아있다. 이 spec 갱신은 미해결 상태다.
- **제안**: M-7 의 spec 갱신 항목을 planner 트랙 action 으로 별도 plan 에 등재하거나 refactor/04-security.md M-7 에서 명시적으로 planner 에 위임하는 작업 단위를 생성할 것.

### [INFO] spec-sync-5-system-metrics-gap.md — _product-overview.md NF-OB-02 미구현 추적 (spec/5-system/ 간접 관련)
- **target 위치**: `spec/5-system/_product-overview.md` (scope 내 파일)
- **관련 plan**: `plan/in-progress/spec-sync-5-system-metrics-gap.md`
- **상세**: 메트릭 수집 NF-OB-02 미구현 추적이다. target scope 에 포함되나 1-auth.md / 10-graph-rag.md / 11-mcp-client.md 본문과 직접 충돌하지 않음. `worktree: spec-sync-audit` 는 물리 worktree 미존재 상태로 착수되지 않았다.
- **제안**: 변경 없음. 별도 tracking 으로 충분.

### [INFO] spec-sync-mcp-client-gaps.md — 11-mcp-client.md 미구현 항목 추적 (plan ↔ spec 정합)
- **target 위치**: `spec/5-system/11-mcp-client.md §3.3, §6.2, §8.2`
- **관련 plan**: `plan/in-progress/spec-sync-mcp-client-gaps.md`
- **상세**: mcpDiagnostics 미구현 필드, MCP_TIMEOUT emit 미구현, cached_capabilities 미구현 등 5개 항목이 plan 에 추적 중이며 spec 본문에 "미구현 (Planned)" 으로 명시 표기되어 정합. worktree 도 `spec-sync-audit` (미착수) 이므로 현재 경합 없음.
- **제안**: 변경 없음.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검토 결과 다음 worktree 들이 stale 으로 판정됨:

- `security-fixes-0f9165` (branch `claude/security-fixes-0f9165`) — Step 1 ancestor 검사: STALE (branch HEAD 가 main 의 조상). 본 검토가 실행되는 worktree 자체가 stale branch 임.
- `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 1: ACTIVE, Step 2: PR MERGED (squash merge). spec/5-system/1-auth.md, 10-graph-rag.md, 12-webhook.md, 16-system-status-api.md, 17-agent-memory.md, 3-error-handling.md, 4-execution-engine.md, 5-expression-language.md, 6-websocket-protocol.md, 7-llm-client.md, 8-embedding-pipeline.md 를 포함하나 PR 이 MERGED 상태라 stale.
- `kb-lifecycle-groom-57cc46` (branch `claude/kb-lifecycle-groom-57cc46`) — Step 1: ACTIVE, Step 2: PR #508, #511 MERGED. stale.
- `kb-unsearchable-warning-b47e20` (branch `claude/kb-unsearchable-warning-b47e20`) — Step 1: ACTIVE, Step 2: PR #511, #508 MERGED. stale.
- `plan-complete-ai-review-backlog-85f80a` (branch `claude/plan-complete-ai-review-backlog-85f80a`) — Step 1: ACTIVE, Step 2: PR MERGED. stale.
- `trigger-schedule-sync-f88604` (branch `claude/trigger-schedule-sync-f88604`) — Step 1: ACTIVE, Step 2: PR #519 MERGED. stale.
- `plan-complete-turn-timing-aa533b` (branch `refactor-approved-batch`) — Step 1: STALE (ancestor). stale.

**unified-model-mgmt-5af7ee** (branch `claude/unified-model-mgmt-5af7ee`) — Step 1: ACTIVE, Step 2: gh pr list 결과 empty(PR 없음). stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 `cleanup-worktree-all.sh --yes --force` 실행 후 재검토 권장. 이 worktree 는 spec/5-system/1-auth.md, 10-graph-rag.md, 17-agent-memory.md, 7-llm-client.md, 8-embedding-pipeline.md, 9-rag-search.md 를 수정하므로, 실제 active 인 경우 target spec/5-system/ 와 worktree 경합이 발생한다. 단, 본 검토 시점에서 stale 여부를 확정할 수 없어 CRITICAL 이 아닌 WARNING 으로 격하함.

### [WARNING] unified-model-mgmt-5af7ee — spec/5-system/ 중 1-auth.md 포함 6개 파일과 worktree 경합 가능성
- **target 위치**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/7-llm-client.md` 등
- **관련 worktree**: `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-5af7ee`)
- **상세**: Step 1(ancestor) ACTIVE, Step 2(gh pr) empty — stale 불명확. 실제 active 이면 target 범위(spec/5-system/)의 6개 파일을 동시에 수정하는 경합이 존재한다. stale 판정 cascade 불확정.
- **제안**: `cleanup-worktree-all.sh --yes --force` 를 실행하거나, `gh pr list --head claude/unified-model-mgmt-5af7ee --state all` 로 수동 재확인 후 stale 이면 정리, active 이면 해당 worktree 와 조율 후 착수할 것.

해당 worktree 들이 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md) 에 대한 구현 착수 전 검토 결과, CRITICAL 등급 충돌은 없다. 진행 중 plan 들(`spec-sync-auth-gaps.md`, `auth-config-webhook-followups.md`, `security-jwt-secret-fallback.md`, `refactor/04-security.md`, `spec-sync-mcp-client-gaps.md`)은 각기 target spec 의 특정 섹션에 대한 미완 작업을 추적하고 있으며, 이들은 미해결 결정을 일방적으로 우회하거나 서로 모순된 결정을 내리지 않는다. 주요 WARNING 은 (1) auth-config-webhook-followups §3 의 1-auth.md §5 API 표 gap 미반영, (2) refactor/04-security.md C-1 의 JWT secret fail-closed spec 갱신 미완 (security-jwt-secret-fallback.md 와 중복 추적), (3) M-5 SameSite 정책 공백, (4) M-7 MCP_ALLOW_INSECURE_URL fail-closed spec 갱신 미완이다. worktree 충돌 후보 8건 중 stale 7건 skip(Step 1 ancestor 또는 Step 2 MERGED), unified-model-mgmt-5af7ee 1건은 stale 불명확(Step 1/2 음성)으로 active 처리하여 spec/5-system/ 경합 가능성을 WARNING 으로 보고.

---

## 위험도

LOW
