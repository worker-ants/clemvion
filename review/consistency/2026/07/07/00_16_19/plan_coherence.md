# Plan 정합성 검토

## 발견사항

- **[INFO]** `mcp-client-diagnostics-followups.md` 착수 체크리스트가 실제 진행 상태보다 뒤처짐
  - target 위치: (해당 없음 — plan 자체의 체크리스트 항목)
  - 관련 plan: `plan/in-progress/mcp-client-diagnostics-followups.md` §착수 체크리스트 — "커밋", "/ai-review + fix", "/consistency-check --impl-done", "PR" 4항목이 미체크(`[ ]`)
  - 상세: 실제로는 커밋 4건(`d395fd7cc` feat → `88414653b` test → `1374638ef` refactor → `67279fa20` fix(spec)) 이 이미 존재하고, `/ai-review` 도 이미 1회 수행되었으며(`review/code/2026/07/07/00_00_54/`), `/consistency-check --impl-done` 도 이전 라운드(`review/consistency/2026/07/07/00_00_54/`, BLOCK:YES→§2.3 자기모순 Critical)를 거쳐 본 라운드(`00_16_19`, 현재 검토 대상)가 재실행 중이다. plan 문서만 초기 상태로 남아 있다.
  - 제안: 정상적인 워크플로 진행 중 발생하는 지연이며 최종 PR 전 plan 갱신이 이뤄질 것으로 예상됨(project memory `review_gate_loop_avoidance` 교훈과 일치하는 패턴: 코드 커밋 → 리뷰 → 재커밋 흐름). 다만 PR 생성 직전에는 반드시 체크리스트를 실제 상태로 갱신해 `plan/complete/` 이동 준비를 맞출 것.

- **[INFO]** `spec-update-mcp-client-diagnostics.md` draft plan 이 orphan 상태로 잔존, 이번 PR 로 더 크게 stale 화
  - target 위치: (해당 없음 — 별도 plan 문서)
  - 관련 plan: `plan/in-progress/spec-update-mcp-client-diagnostics.md` (frontmatter `worktree: spec-sync-audit`, 2026-07-06 작성) — "call-phase(`tools/call`/`resources/read`/`prompts/get`) 실패의 errors[] 누적은 아직 미구현 (follow-up)" 이라고 §구현된 사실/§8.2 에서 명시
  - 상세: 이 draft 는 `spec-sync-mcp-client-gaps.md`(동일 worktree, #840 PR) 당시 만들어진 spec 패치 초안으로 보이나, 실제로는 `spec-sync-mcp-client-gaps.md` 쪽의 "타입 확장 cluster — 착수 설계" 섹션이 확장 실행되어 §6.2/§8.2 갱신이 이미 반영됐고, 이번 PR(`mcp-client-diagnostics-followups.md`)이 call-phase errors[] 까지 마저 구현하면서 target spec 은 이 draft 가 서술하는 "call-phase 미구현" 상태를 완전히 지나쳤다. 두 plan(`spec-update-mcp-client-diagnostics.md`, `spec-sync-mcp-client-gaps.md`) 어디에서도 이 draft 파일 자체를 참조/정리하지 않아 orphan 으로 `plan/in-progress/`에 남아있다.
  - 제안: 본 PR 의 필수 정합 조건은 아님(누구도 이 draft 를 사전조건으로 참조하지 않음) — 그러나 plan hygiene 차원에서 `plan/complete/`로 이동하거나 삭제할 것을 권장. 다음 spec-sync 라운드나 plan 정리 시 처리해도 무방.

## 요약

이번 PR(`mcp-client-diagnostics-followups.md`)은 선행 plan `spec-sync-mcp-client-gaps.md`가 "범위 경계(deferred, follow-up)"로 명시적으로 남겨둔 5개 잔여 항목 중 4개(① call-phase errors[] 누적, ② 에러 message redaction, ③ Rationale 섹션 + INVALID_TOOL_ARGUMENTS prefix 공용코드 등재, ④ McpClientService/test-connection TimeoutError 소비)를 정확히 그 plan 이 규정한 경계대로 구현했다. target spec(`spec/5-system/11-mcp-client.md`)의 §2.3/§6.2/§8.2/Rationale 은 이 구현과 일치하도록 이미 갱신되어 있고(직전 커밋 `67279fa20`이 §2.3 자기모순을 정정), §3.3 capability 캐시만 "잔여(Planned)"로 정확히 남겨 선행 plan 의 범위 경계를 위반하지 않았다. 미해결 결정과 충돌하는 일방적 결정이나 후속 항목 누락은 발견되지 않았고, plan 체크리스트 지연(워크플로 진행 중 자연스러운 현상)과 이번 작업과 무관한 orphan draft plan 1건만 INFO 로 남긴다.

## 위험도
NONE
