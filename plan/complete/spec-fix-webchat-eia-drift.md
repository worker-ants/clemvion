---
worktree: widget-presentation-restore-357c22
started: 2026-07-11
owner: planner
spec_impact:
  - spec/0-overview.md
  - spec/2-navigation/_product-overview.md
  - spec/7-channel-web-chat/3-auth-session.md
  - spec/7-channel-web-chat/4-security.md
---

# 웹채팅 영역 사전 존재 spec drift 3건 정정 (spec-only)

> 출처: PR #901 진행 중 `/consistency-check --impl-prep spec/7-channel-web-chat/`
> (`review/consistency/2026/07/10/22_41_55/SUMMARY.md`) 가 검출한 WARNING 3건.
> 전부 #901 변경과 무관한 **사전 존재 drift** 라 그 PR 범위 밖으로 분리했다
> (`plan/complete/widget-presentation-restore.md` §5 — 본 plan 과 같은 PR 에서 함께 `complete/` 로 이동).
>
> 코드 변경 없음 — 세 건 모두 **구현이 옳고 문서가 뒤처진** 케이스다.

## 변경안

### D-1. `4-security.md` §4 — `/interact` rate-limit "Planned" 오기재

`spec/7-channel-web-chat/4-security.md:136` 이 EIA §8.4 를 인용하며
**"interact 분당 60/execution 은 Planned(미구현)"** 이라 적었으나, 자신이 근거로 든 SoT 와 직접 모순이다.

실증:
- SoT `spec/5-system/14-external-interaction-api.md:734` — "**구현됨** — `InteractionRateLimiterService`(Redis
  fixed-window, fail-open) + `InteractionRateLimitGuard`. 초과 시 `429 RATE_LIMITED` + `Retry-After`".
- 코드 `interaction.controller.ts:60` `@UseGuards(InteractionGuard, InteractionRateLimitGuard)`,
  `:66`·`:112` `@RateLimit('interact')`, `:169` `@RateLimit('status')`.

→ "두 제한의 구현 상태가 다르므로 분리 기재" 라는 전제 자체가 소멸했다. **중복 서술을 제거하고 EIA §8.4 참조로
축약**한다 — 중복 서술이 drift 재발의 원인이므로(§Rationale R-D1).

### D-2. 라이브 미리보기(NAV-WC-06) 완료 상태가 **3곳**에 stale

NAV-WC-06(라이브 미리보기) 이 `🚧 (증분 2 — 위젯 co-deploy 후)` 인데 실제로는 구현 완료다.

실증:
- `codebase/frontend/src/components/web-chat/live-preview.tsx` + `__tests__/live-preview.test.tsx`
- `codebase/frontend/src/app/(main)/w/[slug]/web-chat/page.tsx:41` 가 `LivePreview` 를 렌더(2-column 우측 sticky).
- `spec/7-channel-web-chat/5-admin-console.md` `status: implemented`, `plan/complete/web-chat-console.md` Phase 1/3 완료.

같은 사실이 **3곳에 복제**돼 있으므로 한 번에 동기화한다(안 하면 배지 flip 이 새 모순을 만든다 —
`/consistency-check --spec` WARNING #1·#2):

1. `spec/2-navigation/_product-overview.md` 요구사항 표 NAV-WC-06 행 → `✅`
2. `spec/2-navigation/_product-overview.md:23` §2 사이드바 요약 "Web Chat" 행 → `🚧 (partial…)` 제거
3. `spec/0-overview.md` §6.2(백엔드만 존재/부분 구현 🚧) 의 "임베드형 웹채팅 위젯 + SDK" 행 →
   유일한 🚧 사유였던 "라이브 미리보기는 위젯 co-deploy 후 증분 2" 가 소멸했으므로 **§6.1(구현 완료 ✅)로 승격**

### D-3. `embed-config` 응답의 `{ data }` 봉투 표기 누락 (3곳)

`GET /api/hooks/:endpointPath/embed-config` 는 전역 `TransformInterceptor` 로 `{ data: { allowlist, enforce } }` 를
반환한다(`hooks.controller.ts:61` `@ApiOkWrappedResponse(EmbedConfigDto, ...)` — 설명에도 "`{ data: ... }` 로 래핑"
명시). 그러나 spec 3곳이 unwrap 형태로만 적었다:

- `spec/7-channel-web-chat/3-auth-session.md:44` (§3 step 0)
- `spec/7-channel-web-chat/4-security.md` §3-①
- `spec/7-channel-web-chat/4-security.md` Rationale I3

**런타임 영향 없음** — 위젯이 `json.data ?? json` 폴백으로 양쪽을 받는다(`use-widget.ts:41`). 순수 문서 정정.
SoT: `spec/conventions/swagger.md` 전역 wrap 규칙 + `spec/conventions/api-convention.md` §5.1(응답 계약).

> 편집 시 주의: `4-security.md` §3-① 안에 unwrap 표기 occurrence 가 **2건**이라 실제 편집 지점은 4곳이다
> (§3-① ×2 · Rationale I3 · `3-auth-session.md` §3 step 0).

## 체크리스트

- [x] `/consistency-check --spec` BLOCK: NO (`review/consistency/2026/07/11/00_04_54`) — WARNING 3건 전부 반영
- [x] D-1 · D-2(3곳) · D-3(4곳) 반영
- [x] doc-guard(spec-link-integrity·plan-frontmatter·spec-plan-completion) + lint 통과

> `/ai-review` 는 수행하지 않는다 — 코드 변경이 없는 spec-only 변경이며, `plan/complete/spec-fix-*` 6건 전례 및
> `project-planner` SKILL 워크플로(의무는 `/consistency-check --spec` 뿐)와 정합한다
> (`/consistency-check --spec` WARNING #3). 대신 doc-guard 와 lint 로 검증한다.

## Rationale

**R-D1 — D-1 은 "정정" 이 아니라 "중복 제거".** `4-security.md` 는 EIA §8.4 를 SoT 로 인용하면서 그 내용을 자기
본문에 복제했고, EIA 가 구현 상태를 flip 했을 때 복제본만 뒤처졌다. 값을 갱신해 두면 같은 drift 가 다음 flip 에서
재발한다. 따라서 숫자·구현상태 서술을 지우고 **참조만 남긴다** — 단일 진실 원칙의 정직한 적용이다.
(SSE 동시 3/execution 도 같은 EIA §8.4 표에 있으므로 함께 참조로 정리한다.)

**R-D2 — 상태 배지는 코드로 실증하고, 미러 전부를 한 번에 올린다.** `🚧` 해제는 plan 문서의 "완료" 문구가 아니라
실제 컴포넌트·테스트 존재로 확인했다(`live-preview.tsx` + 테스트 + 페이지 렌더). plan 체크박스가 실제 상태와
어긋난 사례가 반복돼 왔으므로(백로그 과대표시), 배지 flip 근거는 항상 코드다.
또한 같은 사실이 3곳에 복제돼 있어 **한 곳만 올리면 stale 을 다른 곳으로 옮기는 셈**이다 — `--spec` checker 2명이
독립적으로 이를 지적했다. 배지 flip 은 항상 미러 전수를 함께 본다.

**R-D3 — 봉투 표기는 문서만 고친다(코드 무변경).** 클라이언트가 `json.data ?? json` 로 양쪽을 수용하므로
구현을 unwrap 으로 바꾸는 것은 불필요한 계약 변경이다. `swagger.md` 의 전역 wrap 규칙이 SoT 이고 코드가 그를
따르므로, 어긋난 쪽은 spec 서술이다.
