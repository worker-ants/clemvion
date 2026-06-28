---
worktree: .claude/worktrees/fix-chat-channel-e2e-xff-14a65e
started: 2026-06-28
owner: developer
spec_impact: none
---

# fix: chat-channel e2e 429 회귀 — 공개 webhook 요청에 고유 XFF 부여

## 배경

D-12 (#770, `d2342b40c`) 가 `PublicWebhookThrottleGuard` 의 IP 미식별 경로를
fail-open(`if (!ip) return true`) → 단일 공유 버킷(`UNIDENTIFIED_IP_BUCKET =
'__no_client_ip__'`, 10/분·20/시간)으로 강화했다.

e2e 요청에는 `X-Forwarded-For` 가 없어 `extractClientIpFromHeaders` 가 null 을
반환 → **모든 공개 webhook(=auth_config_id NULL) e2e 요청이 이 단일 버킷으로
collapse**. 전체 e2e 런이 ~54s(1 분 윈도우)라 10/분 한도가 binding 이 되고,
누적 공개 요청(slack 6 + discord 5 + external-interaction 5 + webhook-trigger 공개 ~5
≈ 20)이 한도를 초과 → 나중에 도는 slack/discord 가 429.

운영에서는 ingress 가 XFF 를 주입해 provider IP 별 버킷이 되므로 collapse 가
없다. e2e 도 요청마다 고유 XFF 를 부여해 동형으로 per-IP 버킷 분리한다.
**제품 코드·D-12 보안 결정 무변경** (test-env 전용 수정).

## 영향 파일 (공개 webhook e2e — auth_config_id NULL)

- `test/chat-channel-slack.e2e-spec.ts` (6 posts, 전부 공개) — FAILING
- `test/chat-channel-discord.e2e-spec.ts` (5 posts, 전부 공개) — FAILING
- `test/external-interaction.e2e-spec.ts` (5 posts, 전부 공개) — 현재 통과(순서 운),
  latent ordering bomb → 같이 수정
- `test/webhook-trigger.e2e-spec.ts` — 대부분 authConfigId(인증, quota skip).
  공개 ~5건은 위 3개 수정 후 단독으로 10/분 한도 내 → **미수정**, 런 green 으로 검증

## 작업 체크리스트

- [x] 공유 헬퍼 `test/helpers/e2e-client-ip.ts` — `nextE2eClientIp()` (RFC 5737 TEST-NET-3)
- [x] slack/discord/external-interaction 의 모든 `/api/hooks/*` POST 에
      `.set('x-forwarded-for', nextE2eClientIp())` 추가 (16 posts)
- [x] TEST WORKFLOW: lint(PASS) → unit(48 PASS) → build(PASS) → e2e(225 PASS, 0 fail).
      이전 10 fail → 0. webhook-trigger 미수정인데 green = 스코프 분석 검증.
- [x] `/ai-review` (origin/main) — Risk NONE, Critical 0 / Warning 0. INFO 9건 전부
      기존 패턴/선택적 → resolution 불요. (review/code/2026/06/28/22_29_01/SUMMARY.md)
- [x] `/consistency-check --impl-done` (providers, origin/main) — BLOCK: NO.
      WARNING 1건은 slack.md/discord.md frontmatter `code:`→`user_guide:` 건으로
      **본 PR 미수정 spec, 후속 spec-sync plan 대상**(project-planner).
      (review/consistency/2026/06/28/22_38_03/SUMMARY.md)

## 후속 (이번 PR 범위 밖)

- slack.md·discord.md frontmatter 의 `.mdx` 가이드 파일을 `code:`→`user_guide:` 로
  이동 (spec-impl-evidence §5.3 권고, telegram 기준). 기존 inconsistency, 본 e2e
  fix 와 무관 → project-planner spec-sync 위임 권장.

## 메모

- consistency-check `--impl-prep`: 본 작업은 spec 섹션 구현이 아니라 test 인프라
  회귀 fix. 제품/spec 의미 무변경 → impl-prep N/A. POST `/ai-review` 는 이행.
- 헬퍼 counter 는 jest 의 파일별 모듈 격리로 파일마다 리셋 — 파일 내 <254 호출이라
  단일 옥텟으로 충분(방어적 wraparound 포함).
