# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

### [WARNING] integration-management.{mdx,en.mdx} — autoRefresh 통합의 expiring 제외 동작 미문서화

- **변경 파일**: `codebase/backend/src/modules/integrations/integrations.service.ts`, `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx`
- **매트릭스 항목**: `integration-provider-change` (semantic) — `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키`
- **누락된 동반 갱신**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx`
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx`
- **상세**: 이번 변경으로 `autoRefresh=true` 서비스 타입(cafe24, google, makeshop)은 connected 상태에서 토큰 만료가 7일 이내여도 `attention`/`expiring` 필터에 포함되지 않는다 (거짓 양성 방지). frontend `needsAttention()` 술어와 backend `findAll` 쿼리가 모두 이 제외 로직을 구현했다. 현재 `integration-management.mdx`/`integration-management.en.mdx` Callout(KO line 71, EN line 60)은 attention 배지 조건을 `expired` 또는 `error` 상태 전이만으로 기술하며, `connected + expiring within 7d` 분기와 autoRefresh 제외 규칙은 전혀 언급하지 않는다. 사용자가 자동 갱신 통합이 attention 목록에 나타나지 않는 이유를 가이드에서 찾을 수 없는 상태다.
- **제안**: `integration-management.mdx`/`integration-management.en.mdx` 의 attention Callout 에 다음 두 가지를 추가: (1) connected + 토큰 만료 7일 이내 분기도 attention 카운트에 포함된다는 사실, (2) autoRefresh=true 통합(Cafe24, MakeShop, Google 등)은 만료 임박 상태에서 expiring/attention 에 포함되지 않음 — 백그라운드 자동 갱신이 처리하므로 사용자 행동 불필요. 자동 갱신 실패 시에는 error/expired 전이 후 정상 포함됨.

---

### [INFO] en dict `tokenExpiresAuto` 키 문구가 코드 변경과 불일치

- **변경 파일**: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx`
- **매트릭스 항목**: `new-ui-string` (semantic, `codebase/frontend/src/**/*.tsx`) — 신규 한국어 하드코딩 없으므로 CRITICAL 아님. 기존 영문 하드코딩 문구 변경으로 인한 dict 불일치 INFO.
- **상세**: `status-badge.tsx` subLabel 이 `"Auto-renews · next in ${humanizeUntil(...)}"` 로 직접 조립되며(i18n 키 미사용), 이번 PR 에서 `"in"` → `"next in"` 으로 변경됐다. 동일 `humanizeUntil` 결과를 표시하는 두 번째 표면인 `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/[id]/page.tsx:323` Overview Token Expires 행은 `t("integrations.tokenExpiresAuto", { duration })` i18n 키를 사용하는데, en dict 값이 여전히 `"Auto-renews · in {{duration}}"` (구 wording)이다. 결과적으로 헤더 상태 배지는 `"Auto-renews · next in 2h 30m"`, 상세 페이지 Overview 행은 `"Auto-renews · in 2h 30m"` 을 노출해 동일 타임스탬프에 두 문구가 혼재한다. i18n ko/en parity 는 유지되고 있으므로 CRITICAL 조건 미해당.
- **제안**: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/lib/i18n/dict/en/integrations.ts` 의 `tokenExpiresAuto` 값을 `"Auto-renews · next in {{duration}}"` 으로 갱신. 또는 `status-badge.tsx` 도 i18n 키를 사용하도록 통합해 두 경로를 단일 진실로 수렴.

---

## 요약

매트릭스 18개 trigger 행을 대조한 결과, 변경 파일에 의미론적으로 매칭된 trigger 는 `integration-provider-change`(semantic)와 `new-ui-string`(semantic) 2건이다. `integration-provider-change` 에 대해 WARNING 1건(integration-management 양쪽 MDX 에 autoRefresh expiring 제외 동작 미문서화), `new-ui-string` 에 대해 INFO 1건(en dict tokenExpiresAuto 구문구 잔존, 헤더 배지와 Overview 행 불일치)을 식별했다. 신규 한국어 하드코딩 리터럴 없음 — i18n parity CRITICAL 없음. 신규 warning/error code 없음. 누락 2건(WARNING 1, INFO 1).

## 위험도

LOW
