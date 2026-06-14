# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: YES (도구 오탐 — `--impl-done` bundle bug)** → main Claude 검증 결과 **실질 BLOCK 아님**. 근거 아래.

## ⚠️ 도구 오탐 (bundle bug) — C-1/C-2/W-1 무효

`--impl-done spec/5-system/14-external-interaction-api.md` 를 **단일 파일**로 호출하면 orchestrator 의 `collect_markdown_files()` 가 디렉토리를 기대해 **target spec 본문을 프롬프트에 싣지 못한다** ([[feedback_impl_done_spec_bundle_bug]]). 그 결과 checker 는 code diff 의 JSDoc 참조(`EIA-RL-06`/`R15`)만 보고 spec 정의를 못 봐 "유령 ID" 로 오탐한다.

**검증** (prompt grep): spec 본문 정의 문자열 `Terminal revoke 는 at-least-once`=**0**, `R15. Terminal token revoke`=**0**, `R14. 토큰 실패 status`=**0** / code-diff 참조 `Spec EIA §3.4 EIA-RL-06`=4. → 본문 미적재 확정.

실제 spec(커밋 5d5dfe18~)은 `§3.4` 에 **EIA-RL-06 행**, `§Rationale` 에 **R14·R15·R16** 을 모두 정의한다. 직전 `--spec` 검토(15_59_07)가 동일 spec 본문을 전수 분석해 **BLOCK: NO** (R14/R15 인지·정합 확인) 판정했다. 따라서:

| # | 판정 |
|---|------|
| C-1 (EIA-RL-06 미존재) | **오탐** — §3.4 에 존재 |
| C-2 (R15 미존재) | **오탐** — §Rationale 에 R14/R15/R16 존재 |
| W-1 (§10 reconciler 누락) | **오탐(stale)** — §10 파일 목록에 `terminal-revoke-reconciler.service.ts` 이미 추가됨(L761) |

## 실 발견 (처리)

| # | Checker | 발견 | 처리 |
|---|---------|------|------|
| W-3 | naming_collision | `TERMINAL_STATUSES` 가 `interaction.service.ts`(ReadonlySet) 와 `interaction-token.service.ts`(readonly[]) 에 동명 중복 선언 | **fix** — 본 PR 의 것을 `RECONCILE_TERMINAL_STATUSES` 로 rename (용도·타입 상이, 파일별 private — prefix 로 충돌 회피). 40 unit pass·build ✓ |
| W-2 | convention | `pending_plans` frontmatter 가 EIA-RL-06 커버 plan 명시 불명확 | **minor** — EIA-RL-06 은 본 PR 에서 spec+구현 완결(미구현 surface 아님). frontmatter 정비는 후속 |

## Checker별
| Checker | 위험도 |
|---------|--------|
| cross_spec / rationale_continuity / plan_coherence | NONE (긍정 확인) |
| convention_compliance / naming_collision | HIGH **(but C-1/C-2/W-1 = bundle-bug 오탐)** — 실 발견은 W-3(fix)·W-2(minor) |

## 결론
실질 Critical 0. C-1/C-2/W-1 은 `--impl-done` 단일파일 bundle bug 오탐(spec 본문 미적재, prompt grep 0 확인). W-3 fix 적용. spec-impl 정합은 `--spec`(15_59_07 BLOCK:NO) + ai-review ×2(Critical 0) 로 이미 입증. → `BYPASS_REVIEW_GUARD=1` push (BYPASS-JUSTIFICATION.md).
