# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
Target 문서: `spec/4-nodes/4-integration/` (전체)
분석 기준: `plan/in-progress/**` vs target spec 변경 내용 (branch `claude/db-host-blocked-7df9f7`)

---

## 발견사항

### [WARNING] spec-errcode-catalog 브랜치와 `spec/5-system/3-error-handling.md` 동시 편집
- **target 위치**: `spec/5-system/3-error-handling.md` §1.4 노드 레벨 에러코드 카탈로그 — Database 행
- **관련 plan**: 활성 브랜치 `claude/spec-errcode-catalog-a09758` (PR #551 OPEN)
- **상세**: `db-host-blocked-7df9f7` 가 `3-error-handling.md` §1.4 카탈로그 테이블의 Database 행에 `DB_HOST_BLOCKED` 를 추가한다. 동시에 `spec-errcode-catalog-a09758` (PR #551 OPEN, active) 도 동일 파일의 HTTP 행 + `HTTP_TIMEOUT`(미발행) 주석 + Code 노드 섹션을 수정하고 있다. 서로 다른 테이블 행/섹션이므로 논리적 충돌은 없으나, 두 브랜치가 같은 파일을 편집한 상태에서 PR #551 이 먼저 머지되면 `db-host-blocked` 를 머지할 때 3-error-handling.md 에서 git merge conflict 가 발생한다. 머지 순서·충돌 해소 없이 PR push 하면 Database 행 추가 또는 HTTP 주석 추가 중 하나가 유실될 수 있다.
- **제안**: `db-host-blocked` 를 PR 제출 또는 머지 전에 PR #551(`spec-errcode-catalog`) 의 머지 결과를 origin/main 에서 pull 하여 `3-error-handling.md` 충돌을 해소한 뒤 진행. 또는 통합 조율자(`/merge-coordinate`)를 통해 두 PR 의 직렬화 순서를 명시.

### [INFO] `http-ssrf-all-auth-followups.md` "(기획 결정) DB_HOST_BLOCKED 신설" 항목 완료 처리 확인
- **target 위치**: `plan/in-progress/http-ssrf-all-auth-followups.md` §코드 항목
- **관련 plan**: `plan/in-progress/http-ssrf-all-auth-followups.md` (worktree: `(unstarted)`)
- **상세**: 해당 항목이 `- [ ]` 에서 `- [x]` 로 완료 표시되고 결정 내용이 인라인 기술되어 있다. "(기획 결정)" 은 planner 결정을 요구하는 마커였으나, 브랜치 diff 확인 결과 `2-database-query.md` 와 `3-error-handling.md` spec 동기화가 함께 이뤄졌으므로 결정이 실제로 반영된 상태다. 단, `http-ssrf-all-auth-followups.md` 의 `worktree: (unstarted)` 가 갱신되지 않아 추적 메타데이터가 현재 작업 worktree 를 반영하지 않는다.
- **제안**: frontmatter `worktree` 를 `db-host-blocked-7df9f7` 로 갱신하거나, 해당 항목 완료 후 plan/complete 이동 기준 검토.

### [INFO] `spec-sync-integration-common-gaps.md` "⚠ Missing integration 배지" 티어3 잔여 — target 과 비충돌
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약
- **관련 plan**: `plan/in-progress/spec-sync-integration-common-gaps.md` (worktree: `spec-sync-audit`) — 해당 worktree 미존재 확인됨
- **상세**: 마지막 미완료 항목 "§5 ⚠ Missing integration 배지 — 티어3 (아키텍처 결정 필요, 보류)" 은 target 변경(DB_HOST_BLOCKED)과 영역이 다르므로 충돌 없음. `worktree: spec-sync-audit` 로 기재된 worktree 가 `git worktree list` 에 존재하지 않아 plan frontmatter 가 stale 상태.
- **제안**: `spec-sync-integration-common-gaps.md` frontmatter `worktree` 를 정리하거나 plan/complete 로 이동.

### [INFO] `errcode-wiring-92dc2c` 브랜치가 `http-ssrf-all-auth-followups.md` 동시 편집
- **target 위치**: `plan/in-progress/http-ssrf-all-auth-followups.md`
- **관련 plan**: `claude/errcode-wiring-92dc2c` (PR #550 OPEN)
- **상세**: `errcode-wiring-92dc2c` 도 `plan/in-progress/http-ssrf-all-auth-followups.md` 를 수정한다. `db-host-blocked-7df9f7` 도 동일 plan 파일을 수정. 두 브랜치가 같은 plan 파일을 동시에 편집 중이므로 plan 파일 머지 충돌 가능성. 논리적으로는 수정 항목이 다를 가능성이 높음. stale 판정: Step 1 ACTIVE(ancestor 아님), Step 2 PR #550 OPEN. active 로 처리.
- **제안**: 머지 순서 직렬화 또는 마지막 머지 시 plan 파일 충돌 수동 해소.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `pr4b-kb-embedding-retire` (branch `claude/pr4b-kb-embedding-retire`) — Step 1 ancestor 검사 STALE (branch HEAD 가 origin/main 의 조상). Step 2 PR 쿼리 결과 `[]` (GitHub PR 없음).

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`db-host-blocked-7df9f7` 브랜치의 `DB_HOST_BLOCKED` 신설은 `http-ssrf-all-auth-followups.md` 에 명시된 사용자 결정 요구 항목의 이행이며, 미해결 결정 우회에 해당하지 않는다. spec 변경(`2-database-query.md`, `3-error-handling.md`) 내용도 follow-up plan 이 명시한 범위(§4/§6.2 + §1.4 동기)와 일치한다. 선행 plan 미해소·중복 작업·후속 항목 누락 관점에서도 위반 없음. 가장 주의할 사항은 `spec-errcode-catalog-a09758` (PR #551 OPEN) 와 `3-error-handling.md` 를 동시에 수정하는 파일-레벨 경합으로, 논리적 충돌은 없으나 직렬화 없이 머지하면 git merge conflict 가 발생한다. worktree 충돌 후보 3건 중 stale 1건(pr4b-kb-embedding-retire) skip, active 2건(spec-errcode-catalog, errcode-wiring) 분석.

---

## 위험도

LOW
