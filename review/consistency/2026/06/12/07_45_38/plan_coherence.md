# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (`--impl-done`, scope=`spec/4-nodes/4-integration/`, diff-base=`origin/main`)

---

## 발견사항

### 1. [WARNING] `DB_HOST_BLOCKED` 신설이 pending 결정 항목을 선행 해소했으나 plan 미해소 처리
- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §4 SSRF 가드 callout, §6.2 에러 코드 표, §Rationale
- **관련 plan**: `plan/in-progress/http-ssrf-all-auth-followups.md` "코드" 절
  - `- [ ] **(기획 결정) DB_HOST_BLOCKED 신설**: Database Query SSRF 차단이 generic INTEGRATION_CALL_FAILED 로 surface … 신설 시 2-database-query §4/§6.2+3-error-handling §1.4 동기.`
- **상세**: `http-ssrf-all-auth-followups.md` 는 `DB_HOST_BLOCKED` 신설을 "(기획 결정)" 표기로 열어두었다 — project-planner 합의가 선행돼야 함을 뜻한다. 현재 target(db-host-blocked-7df9f7 worktree)이 이 결정을 합의 없이 spec 에 직접 반영했다. plan 항목은 여전히 `[ ]` 미완료 상태다. 또한 plan 항목은 `3-error-handling §1.4` 동기를 조건으로 명시했으나, main HEAD 기준 `spec/5-system/3-error-handling.md` §1.4 Database 코드 표(`DB_QUERY_FAILED · DB_CONNECTION_ERROR · DB_CONSTRAINT_VIOLATION · DB_PERMISSION_DENIED`)에 `DB_HOST_BLOCKED` 가 없다 — 조건 이행 미완.
- **제안**: (1) `plan/in-progress/http-ssrf-all-auth-followups.md` 의 `DB_HOST_BLOCKED` 항목을 `[x]` 완료 처리하고 결정 근거(2-database-query §Rationale 기술 완료)를 주석 추가. (2) `spec/5-system/3-error-handling.md` §1.4 Database 열에 `DB_HOST_BLOCKED` 추가(HTTP `HTTP_BLOCKED`·Email `EMAIL_HOST_BLOCKED` 대칭 패턴)해 plan 조건 이행.

---

### 2. [INFO] `spec/5-system/3-error-handling.md` §1.4 Database 코드 표 누락
- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §6.2 — `DB_HOST_BLOCKED` 등재
- **관련 plan**: `plan/in-progress/http-ssrf-all-auth-followups.md` "코드" 절 (`3-error-handling §1.4 동기` 명시)
- **상세**: target spec 이 `2-database-query.md` 에는 `DB_HOST_BLOCKED` 를 신설했으나 `spec/5-system/3-error-handling.md` §1.4 cross-spec 동기화를 누락했다. 워크플로 저자가 SSRF 차단 코드를 에러 처리 공통 카탈로그에서 조회할 때 이 코드를 찾을 수 없다.
- **제안**: 본 worktree(db-host-blocked) 에서 `spec/5-system/3-error-handling.md` §1.4 Database 표에 `DB_HOST_BLOCKED` 를 추가. `HTTP_BLOCKED` (HTTP 행) / `EMAIL_HOST_BLOCKED` (Email 행) 대칭 패턴과 일치.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보: target spec 파일 영역과 겹치는 수정을 가진 active worktree 4건.

- `spec-errcode-catalog-a09758` (branch `claude/spec-errcode-catalog-a09758`) — `spec/4-nodes/4-integration/1-http-request.md`, `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md` 수정. Step 1: ACTIVE(squash merge 라 ancestor 아님). Step 2: PR state **MERGED**. → **STALE** skip.
- `errcode-wiring-92dc2c` (branch `claude/errcode-wiring-92dc2c`) — `codebase/backend/src/nodes/core/error-codes.ts` 수정(spec 파일 아님). Step 1: ACTIVE. Step 2: PR state **MERGED**. → **STALE** skip.
- `audit-sot-hygiene-8fc5f1` (branch `claude/audit-sot-hygiene-8fc5f1`) — `spec/4-nodes/4-integration/` 미접촉. Step 1: ACTIVE. Step 2: PR state **MERGED**. → **STALE** skip.
- `pr4b-kb-embedding-retire` (branch `claude/pr4b-kb-embedding-retire`) — HEAD == `origin/main` HEAD(`a1ad25f6`). Step 1: **STALE**. → STALE skip.

총 4건 모두 stale. 활성 체크아웃이 남아 있으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target spec(`spec/4-nodes/4-integration/`)은 D4 error 포트 라우팅, SSRF 전 인증 공통 적용, durationMs 명명 통일 등 주요 plan(http-ssrf-all-auth, http-ssrf-all-auth-followups, spec-sync-integration-common-gaps) 결정들과 전반적으로 정합하게 작성됐다. 주요 미결 사항: (1) `DB_HOST_BLOCKED` 신설이 `http-ssrf-all-auth-followups.md` 의 미결 "(기획 결정)" 항목을 합의 없이 선행 해소했고 plan 항목이 미완료(`[ ]`)로 남아 있어 plan 갱신이 필요하다(WARNING). (2) 신설 코드가 `spec/5-system/3-error-handling.md` §1.4 Database 코드 카탈로그에 미등재됐고 이는 plan 항목의 명시 조건(`3-error-handling §1.4 동기`)이 미이행된 상태다(INFO). worktree 충돌 후보 4건은 Step 1/Step 2 cascade 에서 모두 stale(squash MERGED / HEAD==main) 로 판정해 CRITICAL 분류에서 제외했다.

---

## 위험도

LOW
