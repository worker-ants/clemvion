# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [WARNING] makeshop 통합의 expiry 정책 변경 — `06-integrations-and-config/makeshop.{mdx,en.mdx}` 갱신 누락

- 변경 파일: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`
- 매트릭스 항목: `integration-provider-change` — "통합 신규/제공자 변경" → `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키
- 누락된 동반 갱신:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/makeshop.mdx`
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/makeshop.en.mdx`
- 상세: `isCafe24RefreshCapable` → `isRefreshCapable` 일반화로 makeshop + refresh_token 보유 통합이 이제 "refresh-capable provider" 로 분류된다. 변경된 동작:
  1. 0d 임계에서 `expired` 격하 없음 (access_token 만료여도 `connected` 유지)
  2. passive `integration_expired` 알림 미발사 (7d / 3d / 0d 임계 전체)
  3. refresh_token 없는 makeshop 통합만 0d 에서 `expired + statusReason='token_expired'` 격하 + 알림 발사
  
  현재 `makeshop.mdx` / `makeshop.en.mdx` 는 토큰 갱신 행동을 "하나의 인증으로 두 가지 사용처 — 토큰 갱신 일원화" 수준으로만 언급하며, "만료 알림을 받지 않는" 동작이나 refresh_token 보유 여부에 따른 분기를 전혀 설명하지 않는다. 사용자가 "통합이 만료됐다는 알림이 오지 않는다"는 상황을 만났을 때 문서에서 근거를 찾을 수 없다.
  
- 제안: `makeshop.mdx` + `makeshop.en.mdx` 에 "토큰 갱신 및 만료" 절 신설 — refresh_token 보유 시 access_token 은 in-call proactive 갱신으로 흡수되므로 '재인증하세요' 알림이 오지 않는다는 동작 설명. refresh_token 없는 경우(비정상 설치 상태) 만 `expired` 전이 + 알림 발사됨을 명기.

---

### [WARNING] `integration-management.{mdx,en.mdx}` — "expired" 상태 진입 조건 설명이 stale

- 변경 파일: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`
- 매트릭스 항목: `integration-provider-change` — 동일 행. 사용자 안내에 영향 → 관련 user-guide 페이지
- 누락된 동반 갱신:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx`
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx`
- 상세: `integration-management.mdx` 71번 줄 callout "연동이 `expired` 또는 `error` 상태로 바뀌면 사이드바에 주의 필요 배지가 뜨고 알림이 발사돼요" 는 이제 partial-truth다. cafe24 + refresh_token, makeshop + refresh_token 통합은 access_token 만 만료돼도 `expired` 전이·알림 대상에서 제외된다. 문서 그대로면 "알림이 안 왔는데 왜?" 혼란을 야기할 수 있다.
- 제안: callout 또는 별도 섹션에 "refresh_token 자동 갱신 지원 통합(cafe24, makeshop) 은 access_token 만료에 대한 passive 알림을 보내지 않습니다. 자동 갱신이 실패할 경우에만 error 상태 전이 + active 알림이 발사됩니다." 문구 보완.

---

### [INFO] `statusReason: 'token_expired'` — i18n dict 미등록 (현재 사용자 노출 경로 없음, 예비 주의)

- 변경 파일: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` (line `integration.statusReason = 'token_expired'`)
- 매트릭스 항목: `new-backend-ui-zod-value` (semantic) — "신규 backend zod ui.label / hint / 값" → `backend-labels.ts` 적절한 매핑
- 누락된 동반 갱신: `codebase/frontend/src/lib/i18n/dict/{ko,en}/integrations.ts` 의 `token_expired` 사용자 친화 메시지
- 상세: `token_expired` 값은 현재 `expired` status 일 때만 DB 에 저장된다. `status-badge.tsx` 의 `expired` 분기(line 62-74)는 `INSTALL_TIMEOUT_REASON('install_timeout')` 만 별도 처리하고, 그 외 `statusReason` 은 `detail: undefined` 로 무시하므로 사용자에게 raw 문자열이 직접 노출되지는 않는다. 그러나 `reauthorize.test.ts` line 75 에서 `statusReason: 'token_expired'` 케이스를 테스트 중이고, 향후 `error` 상태와 혼용될 경우 `status-badge.tsx` line 59(`detail: integration.statusReason ?? undefined`)에서 raw 값이 노출될 수 있다. 예방적으로 `integrations.ts` `{ko,en}` 양쪽에 `statusReasonTokenExpired` 키 등록 권장.
- 제안: `codebase/frontend/src/lib/i18n/dict/ko/integrations.ts` 와 `en/integrations.ts` 의 "알려진 statusReason" 블록에 `token_expired` → 사용자 친화 메시지 키 추가 (예: `statusReasonTokenExpired: "토큰이 만료됐어요. 재인증해 주세요."` / `"Token has expired. Please reauthorize."`).

---

## 요약

매트릭스 총 19개 행 중 2개 trigger가 이번 변경에 매칭됐다: `integration-provider-change`(semantic) + `new-backend-ui-zod-value`(semantic). 핵심 변경은 makeshop 을 refresh-capable provider 로 분류해 access_token 만료 시 `expired` 격하·passive 알림에서 제외한 것이다. `makeshop.{mdx,en.mdx}` 및 `integration-management.{mdx,en.mdx}` 의 동반 갱신이 누락됐다(WARNING 2건). `token_expired` statusReason 의 i18n 미등록은 현재 직접 노출 경로가 없어 INFO 수준이다.

## 위험도

MEDIUM

STATUS=success ISSUES=3
