# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 은 절차적 merge 경합 위험(1-data-model.md 동시편집)으로, PR merge 전 rebase 로 해소 가능. 워크트리 내부 정합성은 양호.

## 전체 위험도
**MEDIUM** — 절차적 merge 경합 1건(CRITICAL 수준·절차적) + 구현/표현 상충 5건(WARNING, 다수 main-baseline FP) + INFO 10건.

## Critical (절차적 — BLOCK 아님)

| # | Checker | 위배 | 해소 |
|---|---------|------|------|
| 1 | Plan Coherence | `spec/1-data-model.md` 동시편집 — `ai-context-memory-9c7e6e`(PR OPEN)가 §1 ER + §2.23 AgentMemory 신설 편집 중 | PR merge 전 해당 PR merge 여부 확인 → rebase. 미merge 면 직렬화. §10 item 5 경고에 1-data-model.md 경합 추가 |

## 경고 (WARNING)

| # | Checker | 위배 | 상태/조치 |
|---|---------|------|-----------|
| 1 | Cross-Spec | `cross_encoder_llm` 트리거: draft "항상" vs spec "escalate 조건" | **main-baseline FP** — 워크트리 spec §3.3.2 는 이미 "항상 수행". origin/main 미반영이라 오탐. merge 시 해소 |
| 2 | Cross-Spec | draft §6 `LLMClient.rerank?()` 구 설계 잔존 vs spec `RerankClient` 별도 | draft §6 을 `RerankClient` 경로로 갱신 (조치) |
| 3 | Convention | §10 에 spec frontmatter `status` 전이 의무 누락 | `implemented → partial` 는 미정의 역전이 + #455 가 implemented+Planned 로 머지된 선례. §10 에 근거 명기(구현 PR 에서 status 관리) |
| 4 | Naming Collision | draft §2.2 `baseUrl` SSRF 참조 `§5.3` 오기 (spec 파일은 §5.5 정상) | draft §2.2 `§5.3 → §5.5` 수정 (조치) |
| 5 | Plan Coherence | §10 W5 에 `kb-quality-fba2f2` PR #457 누락 (ai-agent.md) | 본 PR 은 ai-agent.md 미편집이라 직접 무관하나 §10 W5 에 참고 추가 (조치) |

## 참고 (INFO) — 발췌

- I1: §4.1 switch 에 `// Planned` 주석 — 이미 반영됨.
- I4: draft frontmatter `worktree` 가 현 worktree 와 불일치 → 갱신 (조치).
- I5/I10: 신규 에러 코드 3종 `error-codes.md §3` "진단 전용"으로 등재 결정 유보 — 구현 PR 에서 확정.
- I7: `cross_encoder_llm` 의미 변경(escalate→항상)은 PR body 에 명시 권장.
- I8: stale worktree cleanup 권장.
- I9: `builtin` provider 명 — Planned 구현 시 `RerankProvider.Builtin` 으로 enum 네임스페이스 분리.

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | MEDIUM | WARNING 2건 모두 main-baseline FP 또는 draft staleness (조치) |
| Rationale Continuity | NONE | 8개 핵심 결정·4개 폐기 대안 정합. 번복 없음 |
| Convention Compliance | LOW | status 전이(미정의 역전이·선례), 에러코드 등재(유보) |
| Plan Coherence | MEDIUM | 1-data-model.md merge 경합(절차적·rebase), W5 보완 |
| Naming Collision | LOW | SSRF 섹션번호 오기(draft), builtin 동명(분리됨) |

## 권장 조치

1. **(merge 전 필수)** `ai-context-memory-9c7e6e` merge 여부 확인 후 `1-data-model.md` rebase.
2. draft §6 → `RerankClient` 경로 갱신.
3. draft §2.2 `§5.3 → §5.5`.
4. draft §10 W5 에 1-data-model.md(#9c7e6e)·ai-agent.md(#457) 경합 명기.
5. draft frontmatter `worktree` 갱신.
6. PR body 에 의미변경(escalate→항상)·status 유지 근거 명시.
