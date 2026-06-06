# Plan 정합성 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system` (대상 파일: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)
검토 기준 worktree: `exec-park-durable-resume`

---

## 발견사항

### [INFO] `spec/5-system/1-auth.md` — 미해결 갭이 pending_plans 에 등재된 상태로 일치

- target 위치: `spec/5-system/1-auth.md` frontmatter `pending_plans: [plan/in-progress/spec-sync-auth-gaps.md]`
- 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` (worktree `spec-sync-audit`)
- 상세: `--impl-done` 검토 대상인 `1-auth.md` 는 LDAP/SAML 2.0 미구현 surface 를 `spec-sync-auth-gaps.md` 에 위임한 상태다. spec 본문은 해당 항목을 "미구현·Planned" 로 명시했고, 일관성 검토가 `spec/5-system/1-auth.md` 를 읽기만 한다면 충돌은 없다. `spec-sync-auth-gaps.md` 는 LDAP/SAML spec 작성(project-planner 영역)만 다루므로 현재 `--impl-done` 분석 범위(구현 ↔ 기존 spec 정합)와 겹치지 않는다.
- 제안: 무조치. spec 에 "미구현" 표기가 이미 있어 일관성 검토가 false-positive Critical 을 낼 수 있음을 리뷰어가 인지하면 충분.

### [INFO] `spec/5-system/11-mcp-client.md` — 다수 "Planned" 항목이 spec 에 명시된 상태

- target 위치: `spec/5-system/11-mcp-client.md` §3.3, §6.2, §8.2
- 관련 plan: `plan/in-progress/spec-sync-mcp-client-gaps.md` (worktree `spec-sync-audit`)
- 상세: `mcpDiagnostics` 전체 필드·`MCP_TIMEOUT`·`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED` buildTools 경로·`cached_capabilities` 등 5개 항목이 spec 본문에 "미구현 (Planned)" 으로 명시돼 있다. `--impl-done` 분석이 이 항목을 미구현 갭으로 적발하는 것은 spec 의도(미구현 명시)와 일치하므로 정합 충돌은 없다.
- 제안: 무조치. 리뷰 결과에서 위 5개 항목이 갭으로 열거되더라도 이는 spec 설계 의도임.

### [WARNING] `impl-exec-concurrency-cap` (PR2b) 브랜치 — `spec/5-system/4-execution-engine.md` 구 모델 보유, rebase 미완료

- target 위치: 직접 대상(`1-auth.md`·`10-graph-rag.md`·`11-mcp-client.md`)은 아니나, 동일 `spec/5-system/` 폴더 내 `4-execution-engine.md` 에 영향
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` PR2b 항목 (worktree `impl-exec-concurrency-cap`)
- 상세: `exec-intake-queue-impl.md` PR2b 는 "착수 전 필수 — `exec-park-pr-b2`(PR-B2) 머지 후 `origin/main` rebase 선행" 조건이 미완료 상태다. `impl-exec-concurrency-cap` 브랜치는 `spec/5-system/4-execution-engine.md`(PR-B1/B2 이전 모델: `pendingContinuations`/`firstSegmentBarriers`/fast-path 이원화 서술) 와 `spec/1-data-model.md`(V084/V085 이전) 를 여전히 보유한다. PR-B2 가 머지되면 `4-execution-engine.md` §4.x/§7.4/§Rationale 가 완료형으로 재전환되고 `resume_call_stack`(V087) 가 추가되므로, PR2b 가 rebase 없이 push 되면 해당 서술이 덮어써지는 위험이 존재한다. 이 위험은 `exec-park-durable-resume.md` §진행 메모의 "W4 cross-branch 운영 리스크(미해결)" 로 이미 인지됐으나 아직 해소 조치가 없다.
- 제안: `exec-park-durable-resume.md` PR-B2 머지 완료 후 `exec-intake-queue-impl.md` PR2b 착수 조건(`rebase 선행`)이 이행됐는지 `impl-exec-concurrency-cap` 브랜치 planner 에게 확인 요청. PR-B2 머지 전 PR2b push 금지 명시가 이미 있으나, 이행 여부 추적 메커니즘(PR-B2 머지 이벤트 → PR2b rebase 트리거 연결) 이 부재함을 plan 에 추가 기록 권장.

### [INFO] `spec-sync-audit` worktree — `spec/5-system/1-auth.md` 와 `spec/5-system/11-mcp-client.md` 동시 접촉

- target 위치: `spec/5-system/1-auth.md` 및 `spec/5-system/11-mcp-client.md`
- 관련 plan: `spec-sync-auth-gaps.md` 와 `spec-sync-mcp-client-gaps.md` (둘 다 worktree `spec-sync-audit`)
- 상세: 두 plan 이 같은 worktree(`spec-sync-audit`)를 공유하며 각각 `1-auth.md`(LDAP/SAML spec 추가), `11-mcp-client.md`(미구현 항목 spec 작성)를 장기 계획한다. 현재 이 worktree 에서의 구체적인 spec 편집 착수 여부는 plan 본문에 미착수 상태로 표기돼 있다. `--impl-done` 은 spec 을 읽기만 하므로 현재 시점 경합은 없으나, `spec-sync-audit` 가 향후 이 두 파일을 편집하기 시작하면 그 결과가 `--impl-done` 이후 spec 에 반영되므로 재검토가 필요하다.
- 제안: `spec-sync-audit` 가 `1-auth.md`·`11-mcp-client.md` 편집을 착수하기 전, 해당 시점의 `--impl-done` 결과 갭 목록과 교차 검토해 편집 범위를 조율할 것을 권장.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보로 분석한 브랜치:

- `impl-exec-concurrency-cap` (branch `impl-exec-concurrency-cap`) — Step 1: ACTIVE (not ancestor of main). Step 2: PR 없음 (빈 결과). Step 3: fallback active 처리 — "stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장".
- `spec-sync-audit` (branch `spec-sync-audit`) — Step 1: ACTIVE. Step 2: PR 없음. Step 3: fallback active 처리 — 동일.

skip 된 stale 워크트리: **0건**. 분석 대상 후보 2건 모두 active 로 처리.

---

## 요약

`spec/5-system`(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)에 대한 `--impl-done` 정합성 검토는 Plan 차원에서 대체로 정합하다. `1-auth.md`·`11-mcp-client.md` 는 미구현 항목을 spec 본문에 명시하고 각각 `spec-sync-auth-gaps.md`·`spec-sync-mcp-client-gaps.md`(공통 worktree `spec-sync-audit`)에 위임한 상태이며, `--impl-done` 분석이 이를 갭으로 적발하더라도 spec 설계 의도와 일치한다. `10-graph-rag.md` 는 P0~P2 완료로 표기되어 있어 충돌 소지 없다. 다만 `impl-exec-concurrency-cap` 브랜치(PR2b)가 `spec/5-system/4-execution-engine.md` 의 구 모델을 여전히 보유한 상태에서 PR-B2 머지 후 rebase 선행 조건이 이행됐는지 추적이 부재한 점은 잠재적 spec 덮어쓰기 위험으로 남는다 — 현재 `exec-park-durable-resume.md` W4 로 인지됐으나 이행 확인 메커니즘이 없어 WARNING 으로 분류한다. worktree 충돌 후보 2건 중 stale 0건 skip, active 2건 분석.

---

## 위험도

LOW
