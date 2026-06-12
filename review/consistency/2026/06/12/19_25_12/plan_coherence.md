# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
Target 범위: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md)
실행 worktree: `chat-channel-gaps-e5e3e8` (branch `claude/chat-channel-gaps-e5e3e8`)

---

## 발견사항

### [WARNING] spec/5-system/1-auth.md §5 API 표 — 미완 spec 갱신 항목 존재

- **target 위치**: `spec/5-system/1-auth.md §5 API 엔드포인트` 표
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md` §3 "spec 보완 (project-planner 영역)"
- **상세**: `auth-config-webhook-followups.md §3` 는 `spec/5-system/1-auth.md §5 API 엔드포인트` 표에 `POST /api/auth-configs/:id/reveal` 행 추가를 미착수 상태로 트래킹 중이다. 현재 §5 말미에는 "인증 설정 CRUD 엔드포인트 … 는 `spec/2-navigation/6-config.md §A.4` 의 표가 단일 SoT 다" 라는 위임 문장이 있어 reveal 행 추가가 의도적으로 보류되어 있다. 그러나 이 위임이 §3 요청을 영구 해소한다는 명시가 없으므로, 이 worktree 에서 구현 시 §5 표를 건드리거나 auth-configs 관련 엔드포인트를 추가할 경우 §3 미착수 항목과 충돌할 수 있다.
- **제안**: auth-configs 엔드포인트를 §5 표에 추가하는 편집은 하지 않는다 (config.md §A.4 가 SoT 이므로 일관). 구현이 auth-configs 경로를 직접 건드리는 경우 `auth-config-webhook-followups.md §3` 이 project-planner 영역임을 감안해 별도 위임하거나 §5 말미 위임 문장이 §3 을 커버함을 plan 에 명시한다.

---

### [WARNING] security-backlog-invitation-token-hash.md — §1.5.D Rationale 변경 가능성

- **target 위치**: `spec/5-system/1-auth.md §Rationale 1.5.D "초대 토큰 raw 저장 이유"`
- **관련 plan**: `plan/in-progress/security-backlog-invitation-token-hash.md` (worktree: main — 아직 착수 없음)
- **상세**: 해당 plan 은 초대 토큰을 해시 저장으로 전환할지 검토하며, 착수 시 `spec/5-system/1-auth.md §1.5.D` Rationale 를 수정한다. 현재 착수 전이지만 `priority: low` 로 in-progress 에 존재한다. 이 worktree 가 초대 토큰 저장 방식에 관한 구현(invitation 테이블 관련)을 수행하면 §1.5.D 해석이 엇갈릴 수 있다.
- **제안**: 이 worktree 에서 invitation 토큰 저장 방식을 변경하는 구현은 하지 않는다. security-backlog-invitation-token-hash.md 가 결정을 내리기 전까지 §1.5.D 는 현행 raw 저장 정책 그대로 유지.

---

### [INFO] spec-sync-mcp-client-gaps.md — 미구현 항목들은 이미 spec 에 "Planned" 명시

- **target 위치**: `spec/5-system/11-mcp-client.md §3.3 / §6.2 / §8.2`
- **관련 plan**: `plan/in-progress/spec-sync-mcp-client-gaps.md` (worktree: spec-sync-audit — not a real worktree)
- **상세**: spec-sync-mcp-client-gaps.md 가 추적하는 미구현 항목(cached_capabilities, mcpDiagnostics 전체 필드, MCP_TIMEOUT 코드 emit)은 모두 spec 본문에 "미구현 (Planned)" 으로 명시되어 있다. 구현이 이 항목들을 구현하는 것이라면 plan 과 정합하며 충돌 없음.
- **제안**: 추적용 정보. 구현 착수 후 spec-sync-mcp-client-gaps.md 의 해당 체크박스를 갱신한다.

---

### [INFO] spec-fix-prod-guards-prose.md — SPEC-DRIFT 이미 main 에 반영됨

- **target 위치**: `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"`
- **관련 plan**: `plan/in-progress/spec-fix-prod-guards-prose.md` (worktree: stale sentinel)
- **상세**: 해당 plan 의 SPEC-DRIFT 항목(`OAUTH_STUB_MODE`·`LLM_STUB_MODE` 를 §Rationale 대상 목록에 추가)은 현재 `spec/5-system/1-auth.md` 에 이미 반영되어 있다 (line 590~596). 나머지 W5·W8·W9·W10 은 다른 spec 파일(`3-error-handling.md`, `7-llm-client.md`, `14-external-interaction-api.md`, `conventions/secret-store.md`)에 해당하며 이번 target 범위 밖이다.
- **제안**: spec-fix-prod-guards-prose.md 의 SPEC-DRIFT 는 완료 처리 가능. 나머지 W5~W10 은 target 범위 외라 이번 impl-prep 에 영향 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

| worktree | branch | 판정 |
|---|---|---|
| `chat-channel-followups-residual-1be5d3` | `claude/chat-channel-followups-residual-1be5d3` | Step 2 — PR 상태 `MERGED` → **stale** |
| `refactor-04-security-286de9` | `claude/refactor-04-security-286de9` | Step 1 — `git merge-base --is-ancestor` exit 0 → **stale** |

두 worktree 모두 실제 활성 작업이 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

- `chat-channel-followups-residual-1be5d3`: Step 2, PR #(MERGED) — squash merge 케이스
- `refactor-04-security-286de9`: Step 1 ancestor 확인 (uncommitted 코드 변경 2건 있으나 spec 파일 아님)

---

## 요약

`spec/5-system/` (1-auth.md · 10-graph-rag.md · 11-mcp-client.md) 를 대상으로 한 impl-prep 검토 결과, CRITICAL 등급 충돌은 없다. 활성 worktree 는 현재 worktree(`chat-channel-gaps-e5e3e8`) 1개뿐이며 나머지 2개는 모두 stale 로 판정(skip). 주요 WARNING 2건: (1) `auth-config-webhook-followups.md §3` 의 미착수 spec 갱신 요청이 §5 표 편집 시 경합 가능 — auth-configs 엔드포인트를 §5 에 추가하지 않으면 회피 가능, (2) `security-backlog-invitation-token-hash.md` 의 invitation 저장 방식 검토가 §1.5.D 와 충돌 가능 — 저장 방식 변경 구현을 하지 않으면 회피 가능. spec-sync-mcp-client-gaps.md 의 Planned 항목들은 spec 본문에 이미 명시되어 있어 정합. worktree 충돌 후보 2건 중 stale 2건 skip, active 0건.

---

## 위험도

LOW
