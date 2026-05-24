# Consistency Check SUMMARY (--impl-done) — trigger-create-multi-provider-ui

**세션**: `review/consistency/2026/05/24/20_00_21/`
**Mode**: `--impl-done`, scope `spec/5-system/15-chat-channel.md`, diff-base `origin/main`
**결과**: **BLOCK: NO** (Critical 2건 모두 해소 commit `f4d50a4e` 직후)

## Critical (모두 해소)

| # | Checker | 발견 | 해소 |
|---|---|---|---|
| C-1 | convention-compliance | `spec/5-system/15-chat-channel.md` frontmatter `status: spec-only` / `code: []` — `spec-impl-evidence.md §3` 의 spec-only → partial 전이 의무 불이행 | frontmatter 를 `status: partial` + 본 plan 의 backend/frontend/e2e 경로 12종 `code:` 글로브 + 6개 후속 plan `pending_plans:` 등록 |
| C-2 | convention-compliance | spec `§4.1` jsonc 에 신규 `inboundSigningPlaintext` 입력 필드 미정의 — DTO/service 가 spec 보다 앞선 상태 | `§4.1` jsonc 예시에 `botToken` / `inboundSigningPlaintext` 입력 필드 추가 + provider 별 분기 / format / strip 정책 cross-link (secret-store.md §5.5 / chat-channel-adapter.md §2.3) |

## Warning (모두 해소)

| # | Checker | 발견 | 해소 |
|---|---|---|---|
| W-1 | cross-spec | CCH-AD-01 인라인 stale 의심 | 실제 `commit 0` (19646bc9) 에서 정정 완료 — false positive |
| W-2 | convention-compliance | `triggers.mdx` 의 Slack/Discord provider 절 부재 → `triggers-coverage.test.ts` 가드 무음 통과 | `### Slack 설정 방법` / `### Discord 설정 방법` h3 신설 + 각 절에 `<ImplAnchor kind="ui-entry">` + Discord callout (R-CC-13 한계) — KO/EN 동시 |
| W-3 | convention-compliance | DTO `inboundSigningPlaintext` JSDoc `@see chat-channel-adapter.md §2.3` 누락 | JSDoc `@see` 블록에 chat-channel-adapter §2.3 + 15-chat-channel §4.1 추가 |
| W-4 | plan-coherence | `chat-channel-dispatcher-split.md` frontmatter `status: backlog` 그대로 — 본 plan 완료 기준에 갱신 의무 명시했으나 미이행 | `status: ready (trigger 조건 충족 — Slack/Discord backend + GUI)` 로 전환 + Rationale 추가 |
| W-5 | convention-compliance | `secret-store.md §2.1 store/rotate 표현 불일치` — store() 가 primary 로 오인될 소지 | 본 plan 범위 밖 (별 후속 plan 권고, RESOLUTION 보류 항목 이관) |

## Info

- `swagger.md` 에 `writeOnly: true` OpenAPI property 사용 가이드 미등재 — 별 grooming sweep
- 관련 spec frontmatter (providers/{slack,discord}.md) `code:` 에 본 plan 의 신규 경로 (`triggers/page.tsx` + `chat-channel-trigger-create.e2e-spec.ts`) 추가됨

## Stale 으로 skip 한 worktree (의무 명시)

stale 6건: `chat-channel-e2e-hardening-5ff799`, `chat-channel-unverified-owner-e2e-d74fda`, `chore-stale-plan-cleanup-c7e170`, `ai-agent-formdata-size-limit-2ad8ff`, `password-hash-format-guard-60f7f2`, `fix-secret-store-root-entities-6aa869` — 모두 squash merge 완료. `./cleanup-worktree-all.sh --yes --force` 별 grooming 권고.

## TEST PASS

post-impl consistency Critical/Warning fix 후 lint / unit (4711) / build 모두 통과 — frontmatter / impl-anchor / triggers-coverage / integrations-coverage 가드 포함.
