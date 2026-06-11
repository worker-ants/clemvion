# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system, diff-base=origin/main)

---

## 발견사항

- **[WARNING]** `spec/5-system/1-auth.md §5 API 엔드포인트` 표에 `POST /api/auth-configs/:id/reveal` 누락
  - target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` 표 (§3.2 권한 매트릭스·Rationale 에는 언급, 표에는 미등재)
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §3` (project-planner 위임 목록, 미착수)
  - 상세: 구현(PR #547, merged debc90ee)은 완료됐으나 `spec/5-system/1-auth.md §5` API 표에 `POST /api/auth-configs/:id/reveal` 행이 없다. `auth-config-webhook-followups.md §3`이 이 갭을 "project-planner 영역 — spec read-only 제약으로 직접 수정 불가" 로 열거하고 있으나 아직 반영되지 않았다.
  - 제안: `plan/in-progress/auth-config-webhook-followups.md §3`의 project-planner 위임 항목으로 `spec/5-system/1-auth.md §5` 표에 reveal 엔드포인트 행을 추가한다. target spec 의 §3.2 Rationale 은 이미 정확하므로 표 행만 추가하면 된다.

- **[WARNING]** `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` 대상 목록에 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 불릿 누락
  - target 위치: `spec/5-system/1-auth.md §Rationale` "Production fail-closed 가드" 대상 bullet 목록 (현재 `JWT_SECRET`, `ENCRYPTION_KEY`, `MCP_ALLOW_INSECURE_URL` 3개만 열거)
  - 관련 plan: `plan/in-progress/spec-fix-prod-guards-prose.md §SPEC-DRIFT` (worktree: prod-fail-closed-guards, PR #539 MERGED)
  - 상세: `spec-fix-prod-guards-prose.md` 의 SPEC-DRIFT 항목은 `assertProductionConfig` 가 `OAUTH_STUB_MODE`·`LLM_STUB_MODE`도 production throw 하므로 대상 목록에 두 불릿을 추가해야 한다고 명시하고 있다. 현재 spec 본문의 "단일 블록 응집 이유" 단락에서 두 플래그를 언급하지만 대상 불릿으로는 열거되지 않았다. 구현 PR(#539)은 MERGED 됐으나 이 spec 산문 수정은 아직 적용되지 않았다. `prod-fail-closed-guards` 브랜치는 MERGED 상태이며 해당 worktree 는 이미 정리돼야 하므로, spec 수정을 위한 신규 worktree가 필요하다.
  - 제안: `plan/in-progress/spec-fix-prod-guards-prose.md` 의 SPEC-DRIFT 항목을 project-planner 가 신규 worktree 에서 처리해 `spec/5-system/1-auth.md §Rationale` 대상 목록에 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 불릿을 추가한다. 해당 plan 을 진행하는 worktree (prod-fail-closed-guards)가 이미 MERGED 됐으므로 plan 의 `worktree:` 필드 갱신도 필요하다.

- **[WARNING]** `spec/5-system/1-auth.md §5 API 엔드포인트` — IP 추출 정책·ip_whitelist fail-closed 누락 (spec/5-system/12-webhook.md 연계)
  - target 위치: `spec/5-system/1-auth.md §5` 표 및 `spec/5-system/12-webhook.md`
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §3` (project-planner 위임 목록)
  - 상세: `auth-config-webhook-followups.md §3`이 `spec/5-system/12-webhook.md`에 IP 추출 정책(CF-Connecting-IP → X-Forwarded-For → req.ip) 명시 및 ip_whitelist fail-closed 동작 명시를 요구하고 있다. 구현은 완료됐으나 spec 반영이 없다. 단, `spec/5-system/1-auth.md §2.3` 세션 정책 표에 "클라이언트 IP" 행이 이미 CF-Connecting-IP 정책을 명시하고 있어 1-auth.md 와의 cross-reference 추가로 해소 가능하다.
  - 제안: `spec/5-system/12-webhook.md`에 IP 추출 정책 명시 또는 `1-auth.md §2.3` cross-reference. 이 역시 `auth-config-webhook-followups.md §3` 목록의 project-planner 위임 항목으로 처리한다.

- **[INFO]** `spec-errcode-catalog-a09758` worktree (ACTIVE)가 `spec/5-system/3-error-handling.md` 수정 중
  - target 위치: `spec/5-system/3-error-handling.md §1.4` HTTP 에러 코드 표 및 `§3.2` 노드 카테고리 표
  - 관련 plan: `plan/in-progress/http-ssrf-all-auth-followups.md` 및 `plan/in-progress/code-node-isolated-vm-followups.md` (worktree: spec-errcode-catalog-a09758, ACTIVE — no PR yet)
  - 상세: `spec-errcode-catalog-a09758` 브랜치(commit a2918d45)가 `HTTP_TIMEOUT`(미발행) 주석을 `spec/5-system/3-error-handling.md §1.4`와 `§3.2`에 추가하는 변경이 진행 중이며 아직 PR이 없다. 현재 impl-done 분석은 origin/main 기준이므로 이 변경 전 상태를 본다. 해당 변경은 spec 정확화(구현 일치)이므로 현재 분석 결과와 기술적 충돌은 없으나, 이 worktree 의 변경이 머지되기 전에 동일 파일을 수정하는 작업을 착수해서는 안 된다.
  - 제안: `spec-errcode-catalog-a09758` 의 PR 을 먼저 올리고 머지한 뒤 `spec/5-system/3-error-handling.md` 에 대한 추가 편집 작업을 착수할 것. stale 판정 cascade Step 1/2 모두 음성 → ACTIVE 로 처리.

- **[INFO]** `spec/5-system/11-mcp-client.md §6.2` 미구현 surface — plan 추적 중, 결정 충돌 없음
  - target 위치: `spec/5-system/11-mcp-client.md §6.2` mcpDiagnostics, `§8.2` MCP_TIMEOUT emit, `§3.3` capabilities 캐시
  - 관련 plan: `plan/in-progress/spec-sync-mcp-client-gaps.md` (worktree: spec-sync-audit — MERGED 상태, plan 파일 worktree 필드 정리 필요)
  - 상세: `spec/5-system/11-mcp-client.md` 의 `pending_plans:` 가 `spec-sync-mcp-client-gaps.md` 를 가리키고 있으며, spec 본문은 미구현 항목을 "미구현 (Planned)" 으로 명시하고 있다. 현재 impl-done 범위(spec/5-system)와 충돌하는 일방적 결정 없음. 다만 이 plan 의 `worktree: spec-sync-audit` 는 PR #440/#443 MERGED 상태라 stale 된 참조다. plan 파일 worktree 필드 갱신 필요.
  - 제안: `plan/in-progress/spec-sync-mcp-client-gaps.md` 의 `worktree:` 필드를 실제 착수 worktree 또는 `(unstarted)` 로 정정한다.

- **[INFO]** `plan/in-progress/security-backlog-invitation-token-hash.md` — spec §1.5.D 결정 이미 존재, plan 주석 갱신 권장
  - target 위치: `spec/5-system/1-auth.md §Rationale "1.5.D"`
  - 관련 plan: `plan/in-progress/security-backlog-invitation-token-hash.md` (worktree: 착수 없음, priority: low)
  - 상세: `security-backlog-invitation-token-hash.md` 는 "착수 시 spec/5-system/1-auth.md §1.5.D Rationale 검토 — 해시 저장 전환 결정 여부 명시"를 요구하지만, 현재 spec §1.5.D 는 이미 "raw 저장 유지"를 명시하며 구체적 위협 모델 근거를 제공한다. 결정이 이미 spec 에 있으므로 "결정 여부 명시" 태스크는 사실상 완료된 상태다. plan 이 "재검토" 의도인지 "이미 있는 결정의 문서화" 의도인지 명확하지 않아 혼란 가능성이 있다.
  - 제안: `security-backlog-invitation-token-hash.md` 에 "§1.5.D 결정 이미 spec 에 명시됨(raw 유지) — 본 plan 의 착수는 현 결정을 번복하고 해시 저장으로 전환할 경우에만 필요" 주석을 추가해 의도를 명확히 한다.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `pr4b-kb-embedding-retire` (branch `claude/pr4b-kb-embedding-retire`) — Step 1 ancestor 검사 exit 0 (STALE). spec/5-system 파일 변경 없음 확인.
- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 2 PR #440 MERGED, PR #443 MERGED. 14개 in-progress plan 이 이 worktree 를 참조 중이며 실제 체크아웃 없음.
- `prod-fail-closed-guards` (branch `claude/prod-fail-closed-guards`) — Step 2 PR #539 MERGED.
- `auth-config-audit` (branch `claude/auth-config-audit`) — Step 2 PR #547 MERGED.
- `audit-coverage-naming` (branch `claude/audit-coverage-naming`) — Step 2 PR #543 MERGED.

위 5개 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system` 의 핵심 구현 영역(1-auth.md, 10-graph-rag.md, 11-mcp-client.md)은 진행 중인 plan 의 미해결 결정과 직접 충돌하지 않는다. 그러나 `auth-config-webhook-followups.md §3` 의 project-planner 위임 항목이 아직 미이행 상태라 `spec/5-system/1-auth.md §5 API` 표에 reveal 엔드포인트 누락 및 IP 추출 정책 누락이 잔존하며, `spec-fix-prod-guards-prose.md` 의 SPEC-DRIFT 항목(OAUTH_STUB_MODE·LLM_STUB_MODE 대상 목록 추가)도 미반영이다. `spec-errcode-catalog-a09758` 워크트리가 `spec/5-system/3-error-handling.md` 를 ACTIVE 수정 중이므로 이 파일에 대한 추가 편집 시 직렬화가 필요하다. worktree 충돌 후보 7건 중 stale 5건 skip, active 2건(audit-sot-hygiene-8fc5f1, spec-errcode-catalog-a09758) 분석.

---

## 위험도

LOW
