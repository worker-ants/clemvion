# Plan 정합성 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done)
**Target 범위**: `spec/4-nodes/4-integration/` (branch `claude/db-host-blocked-7df9f7`)
**검토 일시**: 2026-06-12

---

## 발견사항

### [WARNING] `spec/5-system/3-error-handling.md` 동일 줄 경합 — `spec-errcode-catalog-a09758` (PR #551, OPEN)
- **target 위치**: `spec/5-system/3-error-handling.md` §1.4 노드별 에러코드 표 Database 행 및 §3.2 INTERNAL_CODES 표 Database 행
- **관련 plan**: PR #551 `claude/spec-errcode-catalog-a09758` (OPEN) — commit `cf6baa11`/`a2918d45`
- **상세**: 본 branch(`db-host-blocked`)와 `claude/spec-errcode-catalog-a09758`(PR #551) 양쪽이 `spec/5-system/3-error-handling.md` 의 동일 두 줄을 수정한다. 본 branch 는 §1.4 Database 행과 §3.2 Database 행에 `DB_HOST_BLOCKED` 를 추가하고, spec-errcode-catalog-a09758 도 동일 두 줄에 `DB_HOST_BLOCKED` 를 추가한다(내용 동일). spec-errcode-catalog-a09758 은 추가로 HTTP 행의 `HTTP_TIMEOUT`에 "(미발행)" 주석, `EXECUTION_TIMEOUT` 설명 확장 등을 포함한다. merge 순서에 따라 충돌 또는 중복 적용이 발생할 수 있다.
- **제안**: `spec-errcode-catalog-a09758`(PR #551)이 먼저 머지되면 본 branch 는 rebase 후 `3-error-handling.md` 의 Database 행 hunk 를 제거(이미 반영). 반대 순서라면 spec-errcode-catalog 가 rebase 시 동일 hunk 를 skip. 두 PR 의 merge 순서를 미리 조율 권장.

---

### [WARNING] `codebase/backend/src/nodes/core/error-codes.ts` 동일 파일 경합 — `errcode-wiring-92dc2c` (PR #550, OPEN)
- **target 위치**: `codebase/backend/src/nodes/core/error-codes.ts`
- **관련 plan**: PR #550 `claude/errcode-wiring-92dc2c` (OPEN)
- **상세**: 본 branch 는 `DB_HOST_BLOCKED: 'DB_HOST_BLOCKED'` 를 DB 섹션에 추가한다. PR #550 은 같은 파일의 `HTTP_BLOCKED` 상수 위에 한국어 주석 2줄을 추가한다. 변경 라인이 서로 달라 자동 3-way merge 가 가능하나, PR #550 이 먼저 머지되면 본 branch 는 rebase 가 필요하다.
- **제안**: PR #550 머지 후 rebase 로 해소. 라인 거리가 충분하므로 자동 merge 기대 가능.

---

### [INFO] `plan/in-progress/http-ssrf-all-auth-followups.md` 동일 파일 경합 — `errcode-wiring-92dc2c` (PR #550, OPEN)
- **target 위치**: `plan/in-progress/http-ssrf-all-auth-followups.md`
- **관련 plan**: PR #550 `claude/errcode-wiring-92dc2c`
- **상세**: 본 branch 는 `DB_HOST_BLOCKED` 신설 항목을 `[x]` 체크한다. PR #550 은 같은 파일에서 `HTTP_BLOCKED enum 참조화` 항목을 `[x]` 체크한다. 서로 다른 줄이므로 충돌 가능성 낮음.
- **제안**: PR #550 머지 후 rebase 시 자동 합산 기대.

---

### [INFO] `http-ssrf-all-auth-followups.md` "기획 결정" 항목 — 결정 근거 확인
- **target 위치**: `plan/in-progress/http-ssrf-all-auth-followups.md` — `(기획 결정) DB_HOST_BLOCKED 신설` 항목
- **관련 plan**: `http-ssrf-all-auth-followups.md`
- **상세**: 원래 항목은 `(기획 결정)`으로 표기돼 사용자 승인이 선행 조건이었다. 본 branch 의 plan 변경에 "사용자 결정=신설, PR db-host-blocked 그룹2b"가 명시돼 있어 사용자 결정이 수렴된 후 구현된 것이 확인된다. 미해결 결정 우회 아님.
- **제안**: 현상 유지. 추가 조치 불필요.

---

### [INFO] `spec-sync-integration-common-gaps.md` 잔여 티어3 항목 — `⚠ Missing integration` 배지
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §5 — `⚠ Missing integration` 배지
- **관련 plan**: `plan/in-progress/spec-sync-integration-common-gaps.md` 미해결 티어3 항목
- **상세**: target spec 의 §5 표에 `⚠ Missing integration` 배지가 "미구현 (티어3)" 으로 기술돼 있고, 해당 plan 에서 별도 추적 중이다. 본 branch 의 변경은 `2-database-query.md` 에 집중되며 배지·warningRule 과 무관하다.
- **제안**: 현상 유지. 별도 plan 에서 독립 추적.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `pr4b-kb-embedding-retire` (branch `claude/pr4b-kb-embedding-retire`) — Step 1: `git merge-base --is-ancestor` exit 0 (branch HEAD = main HEAD `a1ad25f6`) → STALE. 유효 변경 없음.
- `http-ssrf-all-auth` (branch `claude/http-ssrf-all-auth`) — Step 1: ACTIVE(exit 1, squash merge로 hash 변경). Step 2: PR #549 state `MERGED` → STALE.

위 두 worktree 는 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/4-nodes/4-integration/` 및 연관 파일에 대한 본 branch(`db-host-blocked-7df9f7`)의 변경은 이미 사용자 결정이 내려진 follow-up 항목을 구현한 것으로, 미해결 결정 우회나 선행 조건 미충족 문제는 없다. 동시 OPEN 상태인 PR #550(`errcode-wiring-92dc2c`)과 PR #551(`spec-errcode-catalog-a09758`)이 같은 파일들(`spec/5-system/3-error-handling.md`, `error-codes.ts`, `http-ssrf-all-auth-followups.md`)을 수정하고 있어 merge 순서에 따른 rebase 또는 충돌 해소가 필요하다. 특히 PR #551 과는 `3-error-handling.md` 의 동일 Database 행을 동일 내용으로 수정하고 있어 중복 적용 위험이 가장 높다. worktree 충돌 후보 4건 중 stale 2건(`pr4b-kb-embedding-retire`, `http-ssrf-all-auth`) skip, active 2건(`errcode-wiring-92dc2c`, `spec-errcode-catalog-a09758`) 분석.

---

## 위험도

MEDIUM
