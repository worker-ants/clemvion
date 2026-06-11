# Plan 정합성 검토 결과

검토 범위: `spec/5-system` (구현 착수 전 검토, `--impl-prep`)
검토 일시: 2026-06-12

---

## 발견사항

### [WARNING] auth-config-webhook-followups §3 — `spec/5-system/1-auth.md §5` 에 `POST /api/auth-configs/:id/reveal` 엔드포인트 미등재

- **target 위치**: `spec/5-system/1-auth.md §5 API 엔드포인트` 표
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md §3 spec 보완` (project-planner 영역)
- **상세**: `auth-config-webhook-followups.md §3` 는 `spec/5-system/1-auth.md §5` 표에 `POST /api/auth-configs/:id/reveal` 행을 추가해야 한다고 명시하고 있다 (현재 §3.2 권한 매트릭스·Rationale 에만 언급). 이 항목은 **미착수(§2~4 미착수 잔여)** 상태이므로, spec/5-system 을 target 으로 구현을 착수하는 작업이 `1-auth.md §5` 를 수정할 경우 — 해당 엔드포인트 행 추가가 누락될 위험이 있다. 단, target 문서 자체에는 reveal 이 §3.2 · Rationale 에서 이미 정의되어 있으므로 spec 정합성 자체가 깨진 것은 아니다.
- **제안**: 구현 착수 전 `plan/in-progress/auth-config-webhook-followups.md §3` 의 "§5 reveal 행 추가" 항목이 완료됐는지 확인. 또는 현재 작업 scope 에서 `1-auth.md §5` 수정이 예정돼 있다면 reveal 행 추가를 함께 포함해 plan 항목을 병행 해소.

---

### [WARNING] spec-fix-prod-guards-prose — `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` prose 개선 미반영

- **target 위치**: `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` (OAUTH_STUB_MODE·LLM_STUB_MODE 열거 누락, 동기화 의무 미명시)
- **관련 plan**: `plan/in-progress/spec-fix-prod-guards-prose.md` (SPEC-DRIFT 항목 — assertProductionConfig 가 OAUTH_STUB_MODE·LLM_STUB_MODE 도 처리하나 spec 에 열거 안 됨)
- **상세**: `prod-fail-closed-guards.md` 의 ai-review SPEC-DRIFT(12_05_01 INFO-1 / 11_25_15 INFO-7) 로 식별됐고 `spec-fix-prod-guards-prose.md` 에서 추적 중이다. 현재 target 문서 `1-auth.md §Rationale "Production fail-closed 가드"` 의 대상 목록에 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 두 stub 플래그가 누락되어 있다. 구현(`assertProductionConfig`) 은 올바르므로 코드 위험은 없으나, spec-as-documentation 관점에서 불완전하다. 해당 plan 의 `prod-fail-closed-guards` worktree 는 실제 git branch 가 존재하지 않음을 확인 (git worktree list, git branch -a 에 없음) — PR 없음 → Step 3 fallback active 처리. 그러나 본 plan 의 scope 가 spec prose 수정(project-planner 영역)이고 구현과는 독립적이라 구현 착수 자체를 차단하지 않는다.
- **제안**: `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` 수정이 현재 작업 scope 에 포함된다면, `spec-fix-prod-guards-prose.md` 의 SPEC-DRIFT 개선(OAUTH_STUB_MODE·LLM_STUB_MODE 추가, 동기화 의무 1줄 명시)을 함께 처리해 plan 을 완료 처리.

---

### [WARNING] spec-sync-auth-gaps — LDAP/SAML 미구현 항목 구현 착수 시 충돌 위험

- **target 위치**: `spec/5-system/1-auth.md §1.3 셀프 호스팅 추가 인증 *(미구현 · Planned)*`
- **관련 plan**: `plan/in-progress/spec-sync-auth-gaps.md` (worktree: `(unstarted)`)
- **상세**: `spec-sync-auth-gaps.md` 는 §1.3 LDAP/SAML 미구현을 추적한다. target 문서 `1-auth.md` 는 이 두 항목을 "미구현 · Planned" 으로 명시해 plan 과 정합한다. 현재 구현 착수가 §1.3 LDAP/SAML 를 의도적으로 구현하려는 것이 아닌 한 충돌 없음. 단, 착수 작업이 LDAP/SAML 관련 코드를 부수적으로 변경하게 되면 `spec-sync-auth-gaps.md` 의 "미착수" 전제가 바뀌므로 plan 업데이트 필요.
- **제안**: 구현 scope 가 §1.3 에 닿지 않으면 무시. 닿는 경우 `spec-sync-auth-gaps.md` 의 해당 항목 상태를 업데이트하고 plan 연계.

---

### [WARNING] security-backlog-invitation-token-hash — `spec/5-system/1-auth.md §1.5.D` Rationale 결정 미확정

- **target 위치**: `spec/5-system/1-auth.md §1.5.D — 워크스페이스 초대 토큰을 raw 로 저장하는 이유 (Rationale)`
- **관련 plan**: `plan/in-progress/security-backlog-invitation-token-hash.md` (worktree: `main — 아직 착수 없음`, spec_impact: `spec/5-system/1-auth.md`)
- **상세**: `security-backlog-invitation-token-hash.md` 는 §1.5.D Rationale 에서 raw 저장을 정당화하는 현 설계를 검토해 해시 저장 전환 여부를 결정할 미래 작업이다. target 문서는 현재 raw 저장을 명문화한 Rationale 을 포함하고 있으며, 이 plan 은 아직 착수 전이므로 직접 충돌 없다. 단, 구현 착수 중 invitation 토큰 관련 코드를 수정하면 "결정 필요" 항목과 교차될 수 있다.
- **제안**: 구현 scope 가 invitation 토큰 저장 방식을 변경하지 않는 한 무시. 변경 예정이면 `security-backlog-invitation-token-hash.md` 의 결정(사용자 합의)을 선행.

---

### [WARNING] spec-sync-webhook-gaps — `spec/5-system/12-webhook.md` 의 미구현 갭 2건 착수 전 인지 필요

- **target 위치**: `spec/5-system/12-webhook.md §7 step 5` (chatChannel 비활성 202+ignored), `§8` (1MB body 제한)
- **관련 plan**: `plan/in-progress/spec-sync-webhook-gaps.md` (worktree: `spec-sync-audit`)
- **상세**: plan 이 식별한 두 갭 (chatChannel isActive 분기 순서, 1MB body 제한 통일)이 현재 spec 에는 목표 동작으로 명시되어 있으나 코드와 불일치 상태다. spec/5-system 을 대상으로 구현에 착수한다면, 특히 webhook 관련 코드를 수정할 경우 이 두 갭이 범위에 포함되는지 확인 필요. 포함 없이 passing 하면 갭이 계속 방치된다.
- **제안**: 현재 구현 착수가 `12-webhook.md` 와 관련 있는지 확인. 관련 있다면 `spec-sync-webhook-gaps.md` 두 항목을 scope 에 포함하거나 명시적으로 deferred 처리.

---

### [INFO] spec-sync-mcp-client-gaps — `spec/5-system/11-mcp-client.md` 미구현 5건 열거

- **target 위치**: `spec/5-system/11-mcp-client.md §3.3`, `§6.2`, `§8.2`
- **관련 plan**: `plan/in-progress/spec-sync-mcp-client-gaps.md` (worktree: `spec-sync-audit`)
- **상세**: 5개 항목(cached_capabilities, mcpDiagnostics 필드 emit, 외부 MCP provider 진단 노출, MCP_TIMEOUT/MCP_CONNECT_FAILED/MCP_LIST_FAILED buildTools 단계 emit)이 "미구현 (Planned)" 으로 spec 에 명시되어 있고 plan 도 이를 추적 중. spec 과 plan 이 정합하므로 conflict 없음. 단, 구현 착수 scope 에 §3.3·§6.2·§8.2 중 하나가 포함되면 plan 항목을 함께 체크 오프.
- **제안**: 구현 후 해당 plan 항목을 완료 처리하면 충분.

---

### [INFO] spec-sync-5-system-metrics-gap — `spec/5-system/_product-overview.md` NF-OB-02 Prometheus 미구현

- **target 위치**: `spec/5-system/_product-overview.md §NF-OB-02`
- **관련 plan**: `plan/in-progress/spec-sync-5-system-metrics-gap.md` (worktree: `spec-sync-audit`)
- **상세**: NF-OB-02 (Prometheus 메트릭 수집) 미구현 사실이 spec 에 올바르게 반영(❌ 표기 + 추적 plan 참조)되어 있고 plan 도 이를 추적 중. 정합 유지. 구현 착수가 메트릭 파이프라인을 건드리지 않으면 무영향.
- **제안**: 구현 범위에 메트릭 파이프라인이 포함되면 plan 항목 체크 오프.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석 결과:

- **`audit-coverage-naming`** (branch `claude/auth-config-audit`) — Step 2: PR MERGED. Stale. 해당 branch/worktree 는 실제 git worktree list 에 존재하지 않으며 plan §1 (AuthConfig CRUD audit) 은 PR #547 로 머지 완료. §2~4 잔여는 별도 추적.
- **`spec-sync-audit`** — Step 1: branch 미존재 (git branch -a 에 없음). Step 2: PR 없음 ([]). Step 3 fallback 이지만 branch 자체가 없으므로 git worktree 충돌 불가. 해당 이름을 참조하는 plan 다수(spec-sync-*-gaps.md 계열)는 모두 동일 brand-new branch 를 지정했던 것으로, 워크트리가 정리된 상태. active git worktree 아님 → 충돌 없음.
- **`prod-fail-closed-guards`** — Step 1: branch 미존재. Step 2: PR 없음 ([]). Step 3 fallback → active 로 간주하되 branch 자체가 없으므로 실질적 worktree 충돌 불가. "stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장" (branch 미존재 = 정리 완료로 보임).

실제 활성 git worktree 는 2개뿐 (`audit-sot-hygiene-8fc5f1` — 현 세션, `errcode-wiring-92dc2c` — codebase 전용 수정, `spec/5-system/` 미변경 확인). `errcode-wiring-92dc2c` 는 `codebase/backend/src/...` 파일만 수정 중이며 spec/5-system 에 diff 없음 → worktree 충돌 없음.

worktree 충돌 후보 총 3건, stale/branch-absent skip 3건, active worktree 충돌 0건.

---

## 요약

`spec/5-system` 전체에 대한 plan 정합성 검토 결과, **CRITICAL 항목은 없다.** `auth-config-webhook-followups.md §3` 의 `1-auth.md §5 reveal 엔드포인트 미등재`, `spec-fix-prod-guards-prose.md` 의 Rationale prose 개선 미반영, `spec-sync-auth-gaps.md` 의 LDAP/SAML 미구현 추적, `security-backlog-invitation-token-hash.md` 의 미확정 결정, `spec-sync-webhook-gaps.md` 의 webhook 갭 2건이 WARNING 수준으로 인지가 필요하다. 이 항목들은 구현 착수를 차단하지 않지만, 관련 영역(특히 `1-auth.md §5`, webhook isActive 분기, invitation 토큰)을 수정할 경우 해당 plan 을 함께 반영해야 한다. 활성 git worktree 간 충돌은 없으며 worktree 충돌 후보 3건 모두 branch 미존재(stale/정리 완료)로 skip 처리했다.

---

## 위험도

LOW
