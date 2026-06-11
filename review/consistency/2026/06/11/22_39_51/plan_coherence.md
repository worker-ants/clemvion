# Plan 정합성 검토 — spec/4-nodes/4-integration/1-http-request.md

검토 일시: 2026-06-11  
Target: `spec/4-nodes/4-integration/1-http-request.md`  
검토 모드: spec draft (--spec)

---

## 발견사항

### [INFO] refactor/04-security.md C-3 — "미착수" 체크박스 갱신 누락
- **target 위치**: target 전체 (§4 step 8, §4 SSRF opt-out callout, §8.2 Rationale)
- **관련 plan**: `plan/in-progress/refactor/04-security.md` §C-3 (line 70: `- [ ] 미착수`)
- **상세**: C-3 의 체크박스가 여전히 `- [ ] 미착수` 로 남아 있고 `worktree` 필드도 미기재 상태다. target 이 C-3 의 spec 모순(§4 step 8 ↔ §104 secure-by-default)을 해소하는 변경을 일방적으로 결정한 것이 아니다 — `http-ssrf-all-auth.md` 계획 문서에 "사용자 결정(2026-06-11): 옵션 A 진행" 이 명시되어 있고 refactor README §1 이 C-3 을 "planner 선행 spec 모순 해소 필요" 로 식별해 둔 상태라 target 의 §8.2 Rationale 이 그 planner 결정을 문서화한 형태다. 결정 자체의 정합성은 문제없으나, C-3 체크박스가 갱신되지 않으면 다음 진입자가 "미착수" 로 오판해 중복 작업을 착수할 수 있다.
- **제안**: `plan/in-progress/refactor/04-security.md` C-3 체크박스를 `- [x] 진행 중 (worktree http-ssrf-all-auth, spec 해소 완료 — 구현 진행 중)` 으로 갱신하고 `refactor/README.md` 우선순위 목록 #1 항목도 동기화. (developer 는 spec 쓰기 권한이 없으므로 planner 후속 또는 PR 본문에 TODO 명시 권장)

---

### [INFO] refactor/04-security.md C-3 spec 갱신 선행 요구 vs target 에서 이미 반영
- **target 위치**: target §8.2 Rationale 전체
- **관련 plan**: `plan/in-progress/refactor/04-security.md` C-3 (line 94: "spec §4 step 8 ↔ §104 모순 해소(planner)가 선행이어야 한다")
- **상세**: refactor C-3 은 "spec 모순 해소(planner)가 구현 선행 조건" 이라고 명시한다 (`refactor/README.md` line 105). target 은 planner 역할에서 바로 그 모순을 §8.2 Rationale 에 기록하며 해소한 상태다. 이는 C-3 이 요구한 선행 조건을 충족하는 올바른 절차다. 단, `http-ssrf-all-auth.md` 체크리스트에서 `/consistency-check --spec` 이 아직 미완료(`[ ]`)이므로 spec 변경의 BLOCK 판정이 남아 있다 — 현재 review 세션이 그 일부다.
- **제안**: 현황 기록 목적의 INFO. 체크리스트 나머지 단계(`/consistency-check --spec`, 구현, 테스트 등)를 순서대로 진행하면 된다.

---

### [INFO] spec-fix-prod-guards-prose.md — worktree `prod-fail-closed-guards` stale (PR #539 MERGED)
- **target 위치**: 해당 없음 (target 과 직접 관련 없음)
- **관련 plan**: `plan/in-progress/spec-fix-prod-guards-prose.md` (frontmatter `worktree: prod-fail-closed-guards`)
- **상세**: `prod-fail-closed-guards` worktree 의 branch `claude/prod-fail-closed-guards` 는 PR #539 가 MERGED 상태로 Step 2 stale 판정. 해당 plan 이 참조하는 worktree 가 이미 종결됐으므로 spec-fix-prod-guards-prose 작업을 재개할 경우 신규 worktree 배정이 필요하다. target 의 변경 범위(`1-http-request.md`)와 `spec-fix-prod-guards-prose.md` 의 변경 대상(`1-auth.md`, `3-error-handling.md`, `7-llm-client.md`, `14-external-interaction-api.md`, `conventions/secret-store.md`)은 파일 중첩 없음 — worktree 경합 위험 없음.
- **제안**: `spec-fix-prod-guards-prose.md` 재개 시 worktree 필드를 새 체크아웃으로 갱신. `./cleanup-worktree-all.sh --yes --force` 로 `prod-fail-closed-guards` stale worktree 정리 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

| worktree | branch | stale 판정 |
|----------|--------|------------|
| `prod-fail-closed-guards` | `claude/prod-fail-closed-guards` | Step 2 — PR #539 MERGED |

target(`1-http-request.md`)과 동일 파일을 수정 중인 **active worktree 는 0건** 으로 확인됨.

`prod-fail-closed-guards` worktree 가 활성으로 남아있을 이유가 없다: `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target(`spec/4-nodes/4-integration/1-http-request.md`)은 `plan/in-progress/refactor/04-security.md` C-3 이 식별한 spec 내부 모순(§4 step 8 integration-only SSRF 가드 ↔ §4 SSRF opt-out callout 의 "전 인증 방식 공통 제어")을 사용자 결정(2026-06-11 옵션 A) 에 따라 해소하는 올바른 spec 변경이다. 미해결 결정을 일방적으로 우회하거나 충돌하는 항목은 없다. 동일 spec 파일을 수정 중인 active worktree 도 없다. 식별된 이슈는 모두 추적 메모 수준(INFO)으로: refactor/04-security.md C-3 체크박스 갱신 누락(작업 완료 표시 필요), spec-fix-prod-guards-prose.md 가 참조하는 prod-fail-closed-guards worktree stale 1건. worktree 충돌 후보 1건 중 stale 1건 skip, active 0건 분석.

---

## 위험도

NONE
