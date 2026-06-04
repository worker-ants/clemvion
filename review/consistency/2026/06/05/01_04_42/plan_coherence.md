# Plan 정합성 검토 결과

- **검토 모드**: 구현 완료 후 검토 (`--impl-done`, scope=`spec/5-system`, diff-base=origin/main)
- **Target**: `spec/5-system` (payload 에 실린 in-scope spec: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)
- **대조한 plan**: `plan/in-progress/**` (특히 in-scope spec frontmatter `pending_plans:` 가 가리키는 `spec-sync-auth-gaps.md` · `auth-config-webhook-followups.md` · `spec-sync-mcp-client-gaps.md`, 그리고 동일 worktree(`spec-sync-audit`) 의 spec-sync 묶음, ai-context-memory 묶음)
- **git 상태**: 현 worktree 는 origin/main 과 동일 (diff 0). 본 검토는 "main 에 들어온 현재 spec 상태 ↔ in-progress plan" 의 사후 정합성 점검.

## 판정: BLOCK — NO

Critical 0. 점검 관점 5개 (미해결 결정 충돌 / 중복 작업 / 선행 plan 미해소 / 후속 항목 누락 / worktree 충돌) 전부에서 차단 사유 없음. INFO 3건만 기록 (전부 비차단, project-planner polish 또는 추적 정확도 수준).

---

## 관점별 분석

### 1. 미해결 결정과의 충돌 — 없음

in-scope spec 들이 내린 결정이 plan 의 "결정 필요" 항목을 일방 봉인하지 않는다.

- `1-auth.md §1.3` 의 LDAP/SAML 은 "미구현 · Planned" 로 명시 표기하고 추적을 `spec-sync-auth-gaps.md` 에 위임 — plan 의 미구현 항목 2건과 1:1 일치. spec 이 "구현됨" 으로 단정하지 않음.
- `11-mcp-client.md §3.3 / §6.2 / §8.2` 의 미구현 surface (`cached_capabilities`, `mcpDiagnostics` 확장 필드, 외부 MCP 진단 노출, `MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED` 의 buildTools 경로 emit) 가 전부 "미구현 (Planned)" 마커 + `spec-sync-mcp-client-gaps.md` 추적 위임으로 적시. plan 의 미구현 5항목과 정확히 대응.
- `10-graph-rag.md` 는 `status: implemented` + pending_plans 없음. §2.2/§6/§8 의 미결 항목(community detection, predicate enum 화 등) 은 모두 "P2 이후 / 본 문서 범위 밖" 으로 봉인돼 있고 이를 진행하는 in-progress plan 이 없으므로 충돌 대상 자체가 없음.
- `ai-context-memory-auto.md §5` 의 결정 항목들은 모두 `[x]` (Phase A 에서 확정) 이고 신규 `17-agent-memory.md` 로 귀결 — in-scope 3개 spec 과 다른 파일이라 결정 충돌 표면이 겹치지 않음.

### 2. 중복 작업 / 병렬 worktree 경합 — 없음

- in-scope 3개 spec 을 동시에 손대는 별도 in-progress plan 없음.
- `1-auth.md`: `spec-sync-auth-gaps.md`(LDAP/SAML 미구현 추적) 와 `auth-config-webhook-followups.md`(auth_config CRUD audit·reveal API 행·IP 추출 spec 보완) 는 **상보적**이다 — 전자는 인증 방식 surface, 후자는 auth-config/webhook 보안 wiring 으로 편집 대상 절(節)이 갈린다. 두 plan 모두 본문에서 서로를 명시 분리(`auth-config-webhook-followups.md` "다른 미구현 갭은 …", `spec-sync-auth-gaps.md` 비고 "auth_config CRUD audit 등은 … 가 추적") 해 경계를 선언. 중복 아님.
- `11-mcp-client.md`: 추적 plan 은 `spec-sync-mcp-client-gaps.md` 단일. cafe24/makeshop 백로그(`cafe24-backlog-residual.md`, `makeshop-integration.md`) 는 Internal Bridge 의 cafe24-side 메타데이터/엔드포인트를 다루지 spec/5-system/11 본문을 손대지 않음 (해당 spec 의 cafe24 디테일은 `4-nodes/4-integration/4-cafe24.md` 로 위임돼 있음).

### 3. 선행 plan 미해소 — 없음

- `1-auth.md §1.4.G` 의 V058 마이그레이션은 이미 적용 완료 전제로 Rationale 화돼 있고, 의존하던 선행 작업이 in-progress 에 미해소로 남아있지 않음.
- `auth-config-webhook-followups.md §비고` 가 review C4/C5 false positive 를 git commit(`5f62d797`/`258daca5`) + e2e 127 통과로 이미 반증 — reveal 구현은 완료 상태이므로 spec §3.2/§5 의 reveal 서술이 미구현 선행에 기대지 않음.
- mcp-client spec 이 참조하는 cafe24 Internal Bridge(`Cafe24McpToolProvider`) 자가회복(§8.6) 등은 cafe24 spec 측에서 이미 구현/등재됨.

### 4. 후속 항목 누락 — 없음 (INFO 1건)

- in-scope spec 의 어떤 결정도 다른 plan 의 후속 항목을 **무효화**하지 않는다. 반대로 plan 들이 spec 변경을 후속으로 요구하는 케이스가 모두 plan 안에 명시돼 있어 추적 누락이 없다.
- `ai-agent-tool-connection-rewrite.md §3` 는 `tool_*` 재활성화 시 `1-ai-agent.md` dispatcher 분류 순서표 갱신을 후속으로 잡고 있는데, 현재 mcp-client spec 의 `mcp_*` prefix/§5.2 이름 규칙과 **직교**(prefix 다름) 임을 plan 머리말이 직접 선언 — 후속 누락 아님.
- (INFO-1) `auth-config-webhook-followups.md §3` 이 `1-auth.md` 에 대한 2건의 spec-doc 보완을 후속으로 적시: (a) §5 API 엔드포인트 표에 `POST /api/auth-configs/:id/reveal` 행 추가(현재 reveal 은 §3.2 권한 매트릭스·Rationale §3.3 와 §4.1 audit 목록에만 등장, §5 표엔 행 없음), (b) IP 추출 정책(CF-Connecting-IP→X-Forwarded-For→req.ip)/`ip_whitelist` fail-closed 를 `12-webhook.md` 에 명시 또는 `1-auth.md §2.3` cross-ref. 이는 **plan 에 이미 등재된 추적된 후속**이라 차단 아님 — project-planner 영역 polish 로 분류. (참고: §2.3 표 라인 268 에 IP 추출 정책 본문은 이미 존재하므로 (b) 는 webhook 측 cross-ref 만 남은 잔여.)

### 5. worktree 충돌 — 없음

- in-scope spec 의 pending_plans 4건 frontmatter 확인: `spec-sync-auth-gaps.md`·`spec-sync-mcp-client-gaps.md` 는 `worktree: spec-sync-audit`, `auth-config-webhook-followups.md` 는 `worktree: (unstarted)`. 동일 spec-sync-audit worktree 안의 두 plan 은 서로 다른 spec 파일(1-auth vs 11-mcp-client) 을 담당해 같은 파일 동시 편집 위험 없음.
- ai-context-memory 묶음(`ai-context-memory-auto/followup-v2/research.md`) 은 `worktree: ai-context-memory-9c7e6e` 로 격리, 편집 대상이 `4-nodes/3-ai/*` + 신규 `5-system/17-agent-memory.md` 라 in-scope 3개 spec 과 파일 경합 없음.
- 현재 검토 worktree(diff 0) 자체가 위 plan worktree 들과 분리돼 있어 경합 표면 없음.

---

## INFO (비차단)

- **INFO-1** [후속/추적] `1-auth.md §5` API 엔드포인트 표에 `reveal` 행 누락 + webhook 측 IP-추출 cross-ref 미기재 — `auth-config-webhook-followups.md §3` 가 이미 project-planner 후속으로 추적 중. spec 의 reveal 서술 자체는 §3.2/§3.3/§4.1 에 존재해 정보 부재는 아니며, §5 표 보강은 polish 수준.
- **INFO-2** [추적 정확도] `auth-config-webhook-followups.md §3` 의 "IP 추출 정책 명시" 항목은 `1-auth.md §2.3`(라인 268) 에 이미 본문이 반영돼 부분 해소 상태 — plan 의 해당 체크박스를 webhook cross-ref 잔여만 남도록 갱신하면 추적이 더 정확해짐 (비차단).
- **INFO-3** [추적 정확도] `spec-sync-mcp-client-gaps.md` 미구현 5항목과 `11-mcp-client.md` 본문의 "미구현 (Planned)" 마커(§3.3/§6.2/§8.2)가 1:1 일치 — 정합 양호. 향후 어느 항목 구현 완료 시 spec 마커 제거와 plan 체크박스 마감을 동시 처리하면 drift 없음(예방적 메모, 현 시점 액션 불요).

---

## 종합

in-scope 3개 spec(`1-auth.md` partial, `10-graph-rag.md` implemented, `11-mcp-client.md` partial)의 status·pending_plans·본문 "미구현 (Planned)" 표기가 대응 in-progress plan 의 미구현 항목 목록과 정합한다. 미해결 결정 일방 봉인·중복 편집·선행 미해소·후속 누락·worktree 경합 어느 것도 발견되지 않음. **BLOCK: NO.**
