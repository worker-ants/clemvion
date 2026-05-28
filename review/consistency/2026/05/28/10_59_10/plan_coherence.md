# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`
검토 모드: --spec (spec draft)
검토 시각: 2026-05-28

---

## 발견사항

### [WARNING] trigger-drawer-tests.md 가 제거될 authType 기반 i18n 테스트를 계획 중

- target 위치: spec-draft §5.1 — `authType` / `hmacHeader` / `hmacSecret` / `bearerToken` 4행 제거
- 관련 plan: `plan/in-progress/trigger-drawer-tests.md` line 24 — "6. authType 별 i18n 값 렌더링 (hmac / bearer / none)"
- 상세: `trigger-drawer-tests.md` 는 TriggerDetailDrawer 신규 단위 테스트를 계획 중이며, 케이스 6번이 "authType 별 i18n 값 렌더링 (hmac / bearer / none)" 을 명시한다. 본 spec draft 가 적용되면 trigger drawer 는 더 이상 `authType` 인라인 필드를 읽지 않고 `authConfigId` FK 를 통해 AuthConfig 를 참조하도록 변경된다. `trigger-drawer-tests.md` 가 정의한 케이스 6번은 의미가 바뀌거나 (authType → AuthConfig.type 으로 변경) 삭제 대상이 된다.
- 제안: `trigger-drawer-tests.md` 케이스 6번을 "authConfigId 로 바인딩된 AuthConfig.type 별 i18n 값 렌더링 (hmac / bearer_token / api_key / basic_auth)" 로 갱신 표기하거나, 본 spec draft §5.1 의 Side-effect 목록에 `trigger-drawer-tests.md` §케이스 6번 갱신 의무를 추가한다. trigger-drawer-tests.md 가 아직 미착수 단계이므로 실제 코드 충돌은 없으나 plan 표기 상 선제 반영 권장.

---

### [WARNING] spec/2-navigation/2-trigger-list.md §API 표 의 `/auth/rotate-secret` TBD 참조가 eia-secret-rotation-revoke-api.md 와 표기 혼동 유발

- target 위치: spec-draft §5.2 — `/auth/rotate-secret` 행 deprecate + 410 `GONE`
- 관련 plan: `plan/in-progress/eia-secret-rotation-revoke-api.md` — 미해결 3가지 결정 (rotation grace 기간 / rotate 응답 shape / itk revoke 후 grace)
- 상세: 현재 `spec/2-navigation/2-trigger-list.md` line 135 에 `POST /api/triggers/:id/auth/rotate-secret` 가 "v1.1 예약" 으로 등록되어 있고 "경로명·grace 기간·응답 shape 는 TBD — `plan/in-progress/eia-secret-rotation-revoke-api.md` 합의 후 확정" 이라고 EIA plan 을 직접 참조하고 있다. 그러나 `eia-secret-rotation-revoke-api.md` 의 실제 내용은 **outbound notification** secret (`POST /api/triggers/:id/notification/rotate-secret`) 의 rotation 이며, inbound webhook auth secret 과는 별도 endpoint 다.

  본 spec draft 는 `/auth/rotate-secret` 를 deprecate + 410 으로 처리하고 rotation 은 `POST /api/auth-configs/:id/regenerate` 로 흡수한다. 이 결정은 EIA plan 의 미해결 3건 결정 (outbound notification rotation 에 관한 것) 과 충돌하지 않는다. 그러나 spec 에 남아 있는 "eia-secret-rotation-revoke-api.md 합의 후 확정" 텍스트가 혼동을 줄 수 있으므로, target spec draft 적용 시 해당 참조 텍스트를 정리해야 한다.
- 제안: spec draft §5.2 에 "현재 spec 의 `eia-secret-rotation-revoke-api.md` 참조 텍스트를 함께 제거" 라는 작업 노트 추가. 또는 `plan/in-progress/eia-secret-rotation-revoke-api.md` 에 `/auth/rotate-secret` 가 본 PR 에서 deprecated 됨을 명시 (EIA plan 의 3건 결정은 outbound notification 에만 해당되므로 영향 없음임을 기록).

---

### [WARNING] spec/data-flow/audit.md (`1-audit.md`) 누락 — Side-effect 목록의 파일 경로 불일치

- target 위치: spec-draft §Side-effect 영향 영역 — "spec/data-flow/audit.md"
- 관련 plan: target 자체
- 상세: target spec draft 의 Side-effect 영향 영역에 `spec/data-flow/audit.md` 를 "audit_log 카테고리 표에 `auth_config.reveal` 추가 영향" 으로 열거한다. 그러나 실제 파일 경로는 `spec/data-flow/1-audit.md` 다. 또한 §3.2 에서 `spec/5-system/1-auth.md` §4.1 갱신 시 같이 처리한다고 명시하는데, 현재 `spec/5-system/1-auth.md` §4.1 의 audit 카테고리 행은 이미 `auth_config.*` 를 등록하고 있다 (line 328). target draft §3.2 는 이를 `auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate, auth_config.reveal, llm_config.*` 로 세분화하는 것이며, `1-audit.md` 의 `audit_log.action` 은 자유 문자열 (DB CHECK 없음) 이므로 `1-audit.md` 자체의 카테고리 표는 별도 갱신 필요성이 낮다. 그러나 파일 경로 표기는 정정이 필요하다.
- 제안: target spec draft 의 Side-effect 목록 `spec/data-flow/audit.md` → `spec/data-flow/1-audit.md` 로 정정. 아울러 `1-audit.md` 에 실제 action 열거 변경이 필요한지 확인 후 불필요하면 주석 제거.

---

### [INFO] cafe24-mcp-label-i18n active worktree 가 spec/1-data-model.md 동시 편집

- target 위치: spec-draft §1 — `spec/1-data-model.md` §2.17 AuthConfig 갱신
- 관련 plan: worktree `cafe24-mcp-label-i18n` (branch `claude/cafe24-mcp-label-i18n`, PR OPEN)
- 상세: `cafe24-mcp-label-i18n` worktree 는 현재 `spec/1-data-model.md` §2.10.1 (IntegrationUsageLog) 에 `api_label` / `api_method` / `api_path` 3개 컬럼을 추가하는 변경을 진행 중이다. target spec draft 는 동일 파일의 §2.17 (AuthConfig) 영역을 변경한다. 두 변경은 서로 다른 섹션이므로 의미론적 충돌은 없다. 단, 실제 spec 갱신 (spec draft → 실제 파일 write) 시 동일 파일을 동시에 편집하므로 git merge 시 hunk 충돌 가능성이 있다. stale 판정: Step 1 ACTIVE (branch HEAD 가 main 의 조상 아님) / Step 2 PR OPEN → active worktree.
- 제안: 양 쪽 편집이 서로 다른 섹션이므로 CRITICAL 아님. 실제 spec 갱신 시 양 worktree 중 하나가 먼저 main 에 머지된 후 나머지가 rebase 하도록 순서 조율 권장. merge 충돌 방지를 위해 `spec/1-data-model.md` 의 병렬 편집 상황을 해당 plan 담당자에게 공유.

---

### [INFO] eia-secret-rotation-revoke-api.md 미해결 결정 3건 — 본 spec draft 와 독립 확인

- target 위치: spec-draft §Side-effect 영향 영역
- 관련 plan: `plan/in-progress/eia-secret-rotation-revoke-api.md` — 미해결 3건 (rotation grace 기간 / rotate 응답 shape / itk revoke 후 grace)
- 상세: target draft 는 이 plan 의 영향 점검을 명시하고 있으며 분석 결과 실제 충돌 없음. `eia-secret-rotation-revoke-api.md` 의 endpoint `POST /api/triggers/:id/notification/rotate-secret` 는 outbound EIA notification HMAC secret 을 다루며, target 이 deprecate 하는 `POST /api/triggers/:id/auth/rotate-secret` (inbound webhook auth secret) 와 완전히 다른 endpoint 다. EIA plan 의 미해결 결정 3건은 outbound 영역에 한정되므로 target 의 진행을 block 하지 않는다.
- 제안: 추적 메모 용도. `eia-secret-rotation-revoke-api.md` 에 "inbound webhook auth secret rotation 은 `auth-config-webhook-wiring` PR 에서 `POST /api/auth-configs/:id/regenerate` 로 흡수됨 — 본 plan 의 미결 3건은 outbound notification 에만 적용" 한 줄 추가 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 및 stale 판정 결과:

- `integration-activity-api-label-ed0a6e` (branch `claude/integration-activity-api-label-ed0a6e`) — Step 1 non-ancestor (ACTIVE 의심) → Step 2 PR MERGED. **stale skip** — integration-activity API label PR 이 이미 머지됨. worktree 가 활성으로 남아 있을 이유 없음.

- `cafe24-mcp-label-i18n` (branch `claude/cafe24-mcp-label-i18n`) — Step 1 non-ancestor → Step 2 PR OPEN. **active** — 위 §INFO 항목에서 분석.

- `frontend-csr-only-a985da` (branch `claude/frontend-csr-only-a985da`) — Step 1 non-ancestor → Step 2 PR not found (no remote PR). Step 3 fallback: **active**. 본 worktree 가 편집하는 `spec/0-overview.md` / `spec/conventions/frontend-rendering.md` 는 target 의 편집 대상과 겹치지 않아 worktree 충돌 위험 없음.

stale skip 된 `integration-activity-api-label-ed0a6e` worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target spec draft (`spec-draft-auth-config-webhook-wiring.md`) 는 plan 정합성 관점에서 전반적으로 정합하다. 미해결 결정 2건 (frontmatter status 격상 시점 / `none` 제거 호환성)은 모두 target 자신이 인지하고 §미해결 에 명시하고 있으며, 이를 일방적으로 결정하지 않았다. 선행 plan 미해소로 인한 blocking 사항도 없다. 주요 주의사항은 3가지다: (1) `trigger-drawer-tests.md` 의 authType 기반 테스트 케이스 6번이 target 변경으로 무효화되므로 plan 갱신 필요 (WARNING), (2) `spec/2-navigation/2-trigger-list.md` 의 EIA plan 참조 텍스트가 deprecation 후에도 잔존하면 혼동 유발 가능 (WARNING), (3) Side-effect 목록의 `spec/data-flow/audit.md` 경로 표기 오류 정정 필요 (WARNING). worktree 충돌 후보 3건 분석 결과 stale 1건 skip, active 2건 분석 — 의미론적 충돌은 cafe24-mcp-label-i18n 과 spec/1-data-model.md 동일 파일 편집(서로 다른 섹션) 으로 merge hunk 충돌 위험만 존재하며 CRITICAL 수준은 아니다.

---

## 위험도

LOW
