# Consistency Check SUMMARY — URI-userinfo 마스킹 SoT 통합 (`--impl-done`)

- 모드: `--impl-done`
- 대상 diff: `git diff origin/main...HEAD` (branch `claude/mcp-userinfo-dedup`)
  - `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `SECRET_LEAK_PATTERNS` 의 URI-userinfo 정규식을 scheme-preserving(lookbehind/lookahead, `scheme://***@host`)으로 정밀화
  - `codebase/backend/src/modules/mcp/mcp-error-codes.ts` — `MCP_EXTRA_SECRET_PATTERNS` 의 중복 URL-userinfo 패턴 제거 (bare `token=` 만 잔존)
  - `spec/5-system/11-mcp-client.md` §8.2/§8.3 (표 + Rationale) spec-sync
  - `plan/in-progress/spec-sync-mcp-client-gaps.md` L79 stale 잔여-표기 정정 (plan-coherence WARNING 반영)
- checker: cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision (5/5)

## BLOCK: NO

Critical 0. WARNING 1건(plan-coherence)은 본 세션에서 즉시 해소(아래 처분).

## Critical

| # | Checker | 위배 |
|---|---------|------|
| - | - | (없음) |

## 경고 (WARNING) — 처분

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1 | plan_coherence | `plan/in-progress/spec-sync-mcp-client-gaps.md` L79 가 `task_fa96e218`(에러 message redaction) 등 4건을 여전히 "잔여" 로 표기하나, 3건은 PR #842(`plan/complete/mcp-client-diagnostics-followups.md`)로, task_fa96e218 의 URL-userinfo 서브스코프는 본 diff 로 완결됨 → 실질 잔여는 §3.3 capability 캐시뿐인데 이것이 가려져 있음 | **Fixed** — L79 를 "4건 이관 완료(PR #842) + URL-userinfo 는 본 PR 통합, 유일 잔여는 §3.3 캐시" 로 정정. `plan/complete/mcp-client-diagnostics-followups.md` 대조로 4건 완료 검증 후 반영 |

## 참고 (INFO)

| # | Checker | 항목 |
|---|---------|------|
| 1 | cross_spec | `spec/conventions/node-output.md` / `1-http-request.md` 의 `sanitizeUrlCredentials`(userinfo 전량 strip)는 본 diff 와 무관한 별개 메커니즘 — 명명 유사로 인한 향후 혼선 가능성만 (현 충돌 아님) |
| 2 | convention_compliance | `shared/utils/sanitize-error-message.ts` 가 spec 본문에 SoT 로 인용되나 frontmatter `code:` 미등재 — 본 diff 이전부터의 상태, 회귀 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | NONE | spec §8.3 표/Rationale 이 실제 코드(`MCP_EXTRA_SECRET_PATTERNS`=bare token, shared=`scheme://***@host`)와 1:1 정합. 48 test 통과 |
| rationale_continuity | NONE | whole-mask→scheme-preserving 은 실 reversal 이나 code JSDoc·commit·spec §8.3 "2026-07-10 갱신" 3곳에 신규 Rationale 동반. §8.3 "SoT 파편화 방지" 원칙을 그대로 이행 |
| convention_compliance | NONE | "새 마스킹 구현 금지·공용 SoT 재사용" 관행 정확 준수. node-output Principle 7 은 별개 sink(`sanitizeUrlCredentials`)라 무관, credential 완전 마스킹 확인 |
| plan_coherence | (WARNING→Fixed) | 위 처분. CRITICAL(결정 우회) 없음. 여타 `plan/in-progress/**` 와 충돌 없음 |
| naming_collision | NONE | 신규 export 식별자 0 (기존 배열 1개 교체 + 1개 항목 제거 + 문서/테스트 문구). 충돌 없음 |
