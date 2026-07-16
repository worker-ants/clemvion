# Consistency Check 통합 보고서 — `--impl-done spec/4-nodes/3-ai/` 최종 (14_57_19)

**BLOCK: NO** (본 diff 기준) — diff-introduced CRITICAL 1건은 fix+재검증으로 해소, 잔여 cross_spec CRITICAL 2건은 본 diff 무관한 pre-existing spec 자기모순(durable 앵커 완료).

이전 impl-done(14_46_28)의 WARNING 2건(convention code: 누락·plan durable 앵커) 조치 후 재검증 pass. FS-flakiness 회피 위해 5 checker 직접 Agent 실행(전수 산출).

## Checker별 결과 (raw)

| Checker | Critical | Warning | 처분 |
|---|---|---|---|
| cross_spec | 2 | 0 | **pre-existing** out-port/count_max 자기모순 — 본 diff 무관, `spec-drift-ai-agent-outport-countmax.md` durable 앵커 완료(아래) |
| rationale_continuity | 0 | 0 | 기각 대안 재도입 없음 |
| convention_compliance | 1 | 1 | C: 신규 plan stub `worktree:` 누락 → **FIX 완료**(아래). W: pending_plans 의미 확장 — 수용 |
| plan_coherence | 0 | 1 | 동일 stub `worktree:` 누락 build-guard 실패 → **FIX 완료** |
| naming_collision | 0 | 0 | 충돌 없음 (INFO: cafe24 spec describe 타이틀 stale 표기 — 아래) |

## diff-introduced CRITICAL → 해소 완료

**[convention/plan_coherence] 신규 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` frontmatter 필수 `worktree:` 누락 → `plan-frontmatter.test.ts` 실제 실패.**
- 원인: 이전 impl-done WARNING(durable 앵커) 조치로 만든 plan stub 이 `worktree:` 필드를 빠뜨림(plan-lifecycle §4 필수).
- FIX: `worktree: (unstarted)` 추가(아직 live worktree 없는 plan sentinel, 테스트가 명시 허용). 아울러 "처분:" 산문을 `- [ ]` 체크박스로 전환(stale-audit 진행률 정상화 — convention INFO 조치).
- **재검증**: `codebase/frontend` `plan-frontmatter.test.ts` → **121 passed (1 failed→0)**. CI-blocking 해소 확인.
- 이 CRITICAL 은 spec↔code 정합이 아니라 plan-frontmatter 빌드 가드 사안이며, 동일 PR 내 fix+재검증으로 종결.

## 잔여 cross_spec CRITICAL 2건 — 본 diff 무관(BLOCK 사유 아님)

out-port 요구사항-vs-기술스펙 모순, `AI_AGENT_TOOL_COUNT_MAX=128` vs Cafe24/MakeShop 카탈로그 초과 — **W4/W2 리팩터가 유발/악화시키지 않은 pre-existing spec 자기모순**이다. impl-prep(13_55_11)에서 최초 확인돼 `task_3ac39ebd` 위임됐고, 본 PR 에서 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md`(durable) + `1-ai-agent.md` pending_plans 로 **durable 이관 완료**. 코드 무변경 spec 정정이라 project-planner 트랙. 본 refactor PR 의 impl-done gate 범위 밖(item A·B 와 동일 처분).

## WARNING / INFO (수용·기록)

- convention W: spec-drift stub 을 `pending_plans:`(구현 완결성 추적 필드)에 편입 — 의미 확장. **수용**: 1-ai-agent.md `status: partial` 이고 해당 plan 이 실제로 그 spec 을 수정 예정이므로 pending_plans 계약(“spec 을 수정할 in-progress plan”)에 부합. plan_coherence 의 durable-앵커 권고를 우선.
- naming INFO: `cafe24-mcp-tool-provider.spec.ts` describe 타이틀이 제거된 `Cafe24McpToolProvider.buildJsonSchema` 를 그대로 인용(테스트 설명 문자열, 실코드 무영향). 후속 미세 정리 가능(비차단).
- naming INFO: IE `buildJsonSchema` 와 신규 `buildOperationJsonSchema` 이름 유사성 — 별개 도메인, 충돌 아님.

## 최종 판정

**BLOCK: NO.** 본 diff(W4/W2 + spec pointer/frontmatter + durable 앵커)는 spec↔code 정합하며, diff-introduced CRITICAL(worktree)은 fix+재검증 종결. pre-existing spec 자기모순 2건은 durable 앵커로 이관돼 본 게이트 범위 밖.
