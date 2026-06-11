# Plan 정합성 검토 결과

**target**: `spec/4-nodes/4-integration/` (worktree `http-ssrf-all-auth`, plan `/plan/in-progress/http-ssrf-all-auth.md`)
**검토 모드**: 구현 완료 후 검토 (--impl-done)
**기준일**: 2026-06-11

---

## 발견사항

### [INFO] C-3 결정·구현 완료 — `refactor/04-security.md` C-3 항목 마감 미반영
- **target 위치**: `plan/in-progress/http-ssrf-all-auth.md` 체크리스트 (전 항목 [x])
- **관련 plan**: `plan/in-progress/refactor/04-security.md` §C-3 (line 70 `- [ ] 미착수`)
- **상세**: `04-security.md` 의 C-3 항목이 아직 `- [ ] 미착수` 상태다. `http-ssrf-all-auth` plan 의 체크리스트는 lint·unit·build·e2e까지 완료됐으므로 C-3 를 `✅ 완료 (2026-06-11, worktree http-ssrf-all-auth)` 로 전환해야 하고, spec 갱신 사항(step 8 "전 인증 방식 적용" + Rationale 기록)도 완료 메모로 기재해야 한다.
- **제안**: `plan/in-progress/refactor/04-security.md` C-3 항목을 C-1·C-2 와 동일 형식으로 완료 표시 + worktree 참조 추가. `http-ssrf-all-auth.md` 체크리스트에 `/consistency-check --impl-done` + `/ai-review` 잔여 항목이 `[ ]` 이므로, 완전 완료 후 `plan/complete/` 이동 시 04-security.md 동기 갱신.

---

### [INFO] `node-output-redesign/http-request.md` P3 잔여 항목 — target spec 과의 관계 추적 필요
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §5.3.2` (transport 실패 케이스 `output.response: { error }` 유지)
- **관련 plan**: `plan/in-progress/node-output-redesign/http-request.md §종합 개선안 (2026-05-16)` — transport 실패 시 `output.response: { error: <message> }` legacy 잔재 제거가 P3 미착수 항목으로 등재됨
- **상세**: target spec(`1-http-request.md §5.3.2`)은 `output.response: { error }` 를 "legacy 호환 잔재" footnote 와 함께 그대로 유지한다. 이는 `node-output-redesign/http-request.md` P3 개선안의 `[ ] Transport 실패 분기에서 output.response: { error } 제거`와 충돌하지 않는다(spec 이 deprecation 의도를 명시하고 있으므로). 단, target 변경이 이 영역을 직접 다루지 않았으므로 P3 항목이 여전히 미착수임을 확인하고 추적 메모를 갱신하는 편이 좋다. `node-output-redesign/http-request.md` 는 독립 worktree 없이 백로그 분석 문서로만 존재하므로 경합 위험은 없음.
- **제안**: 추적만 권장. `node-output-redesign/http-request.md` P3 해당 항목 옆에 "target spec 에서 deprecation 의도 유지 확인 (2026-06-11)" 메모 추가.

---

### [INFO] `spec-sync-integration-common-gaps.md` — target spec 변경과 정합, 잔여 항목 영향 없음
- **target 위치**: `spec/4-nodes/4-integration/0-common.md §4.1·§4.2` (Usage 로깅 계약, 에러 코드 목록)
- **관련 plan**: `plan/in-progress/spec-sync-integration-common-gaps.md` (worktree: `spec-sync-audit`)
- **상세**: 잔여 미구현 항목은 `⚠ Missing integration 배지` (티어3 — warningRule DSL 밖, 아키텍처 결정 필요)뿐이다. target spec 이 `0-common.md §4.2`에 `INTEGRATION_SERVICE_UNAVAILABLE` 추가 등을 반영하고 있으나, Missing integration 배지 항목은 다루지 않는다. 충돌 없음.
- **제안**: 추적 메모만 권장. `spec-sync-integration-common-gaps.md` 잔여 항목(`⚠ Missing integration 배지`)은 target 과 무관하게 독립 대기 중.

---

### [INFO] `spec-fix-prod-guards-prose.md` — 동일 worktree(`prod-fail-closed-guards`) 공유이나 stale branch
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §8 Rationale`
- **관련 plan**: `plan/in-progress/spec-fix-prod-guards-prose.md` (worktree: `prod-fail-closed-guards` — PR #539 MERGED)
- **상세**: `spec-fix-prod-guards-prose.md` 는 `prod-fail-closed-guards` worktree 를 가리키나 PR #539 가 이미 MERGED 됐다. target spec 의 Rationale §8.2 는 SSRF 가드 확장 근거를 기록하며 `spec-fix-prod-guards-prose.md` 의 W5/W8/W9/W10 와 파일이 다르다. 충돌 없음.
- **제안**: `spec-fix-prod-guards-prose.md` 의 worktree 는 stale — `./cleanup-worktree-all.sh --yes --force` 로 정리 가능. 본 plan 의 spec prose 후속(W5/W8/W9/W10)은 새 worktree 에서 처리 필요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `prod-fail-closed-guards` (branch `claude/prod-fail-closed-guards`) — Step 2 PR #539 MERGED
- `auth-refresh-rotation-atomic` (branch `claude/auth-refresh-rotation-atomic`) — Step 2 PR #537 MERGED (`spec/5-system/3-error-handling.md` 공유 후보였으나 stale)
- `unified-model-mgmt-pr4` (branch `claude/unified-model-mgmt-pr4`) — Step 2 PR #545 MERGED (`spec/5-system/3-error-handling.md` 공유 후보였으나 stale)
- `code-node-isolated-vm` (branch `claude/code-node-isolated-vm`) — Step 2 PR #546 MERGED

위 4개 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/4-nodes/4-integration/` target spec 은 plan 내 미해결 결정(`refactor/04-security.md` C-3 옵션 A) 을 사용자 승인 하에 정식으로 이행한 것이므로 결정 우회 충돌 없음. 동일 영역을 건드리는 active worktree 는 없으며 (`claude/prod-fail-closed-guards`·`auth-refresh-rotation-atomic`·`unified-model-mgmt-pr4`·`code-node-isolated-vm` 전부 MERGED stale), spec 선행 조건(`/consistency-check --spec` 3회 BLOCK:NO)도 충족됐다. 잔여 추적 사항은 (a) `refactor/04-security.md` C-3 완료 표시, (b) `node-output-redesign/http-request.md` P3 legacy 잔재 항목 추적 갱신, (c) stale worktree 4건 정리 권장 — 모두 INFO 수준이다. worktree 충돌 후보 4건 중 stale 4건 skip, active 0건 분석.

## 위험도

NONE

---

STATUS: SUCCESS
