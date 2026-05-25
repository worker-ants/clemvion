BLOCK: NO

# Consistency Check (impl-prep) — chat-channel renderer tech-debt

**위험도**: MEDIUM — CRITICAL 2건은 spec/conventions/chat-channel-adapter.md frontmatter status drift (spec-only → partial 미승격). 본 PR 의 W12 spec 변경 동반 처리 가능.

## Critical (해소 계획)

| # | Checker | 위배 | 해소 |
|---|---|---|---|
| C1 | convention-compliance | spec/conventions/chat-channel-adapter.md frontmatter `status: spec-only` 인데 구현 완료됨 | 본 PR 의 spec 갱신 단계에서 `partial` 로 승격 + code 글로브 추가 |
| C2 | convention-compliance | 위 frontmatter `pending_plans` 누락 | C1 함께 — chat-channel-form-native-modal / chat-channel-visual-ssr-png 등 등재 |

본 PR 이 chat-channel-adapter.md 본문에 W12 / W3 cross-ref 갱신을 수반하므로 frontmatter 갱신도 같은 PR 에 묶음. 별 PR 분리 불필요.

## WARNING (본 PR scope 또는 인접)

- W11 (cross-spec): `KeyboardHint.text` ↔ `visualNode: "text"` 동일 literal 다른 의미 — 별 PR 후보 (본 PR scope 밖)
- W11 (convention): chat-channel-adapter.md `## Overview` 누락 — 본 PR 에서 추가 가능 (선택)
- W11 (convention): R-CCA-5 앵커 깨짐 — 본 PR 에서 정정 가능 (선택)
- W11 (plan-coherence): stale plan 5건 `plan/in-progress/` 잔류 — 별 cleanup 작업

## 결정

**BLOCK: NO** — 본 PR 진행. spec/conventions/chat-channel-adapter.md frontmatter 도 본 PR 안에서 함께 갱신 (status `spec-only` → `partial`, code 채움, pending_plans 등재).
