# 유저 가이드 동반 갱신 (User Guide Sync) Review

## 발견사항

### [WARNING] 통합 제공자(Cafe24) OAuth invalid_scope 흐름 변경이 docs MDX에 미반영

- 변경 파일:
  - `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `rejectCafe24InvalidScope()` 신규 private 메서드 추가, `CallbackContext.requiresCafe24Approval`, `statusReason='oauth_invalid_scope'` 상태 전이 추가
  - `codebase/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` — `statusReason === "oauth_invalid_scope"` 분기 섹션 신규 렌더링
- 매트릭스 항목: `integration-provider-change` (semantic) — "백엔드의 신규/변경 provider 가 `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키 동반 갱신 누락"
- 누락된 동반 갱신:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.mdx`
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.en.mdx`
- 상세: Cafe24 OAuth 콜백에서 `?error=invalid_scope` 를 수신했을 때 `statusReason='oauth_invalid_scope'` + `last_error.details.requiresCafe24Approval` 를 기록하고 scope-tab 에 "이 권한은 카페24 별도 승인이 필요해요" 안내를 표시하는 새로운 사용자 플로우가 추가됐다. `cafe24.mdx` / `cafe24.en.mdx` 에는 기존 `invalid_scope` FAQ(scope 형식 불일치 원인)만 있고, 별도 승인 필요 케이스(`requiresApproval` 스코프 요청 → 콜백 거부 → UI 안내)에 대한 설명이 없다. 사용자가 해당 오류를 받았을 때 별도 승인 절차를 가이드 문서에서 찾을 수 없다.
- 제안: `cafe24.mdx` 의 기존 `invalid_scope` FAQ 항목에 "카페24 개발자 센터에서 별도 승인이 필요한 권한(`mall.read_privacy` 등)을 요청한 경우 연동 상세의 Scope 탭에서 별도 승인 안내를 확인하세요" 내용을 추가하고, `.en.mdx` 도 동일하게 갱신. (integration-management 계열 페이지에도 `oauth_invalid_scope` statusReason 처리 흐름을 간략 언급하면 더 완결됨)

---

## i18n parity 확인

- `integrations.cafe24RestrictedApprovalApiError` 키 — ko/en 양쪽 이미 등록됨 (기존 인프라, 이번 변경 set 에 신규 추가 없음). CRITICAL 없음.
- `scope-tab.tsx` 에 추가된 UI 문자열은 모두 기존 `t("integrations.*")` 키 참조 — 신규 하드코딩 한국어 리터럴 없음. i18n parity 위반 없음.

## backend-labels / errorCode 확인

- `OAUTH_INVALID_SCOPE` 는 `BadRequestException` 의 inline `response.code` 로만 사용(last_error.code). `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 변경 없음. `WARNING_KO` / `ERROR_KO` 매핑 요건 해당 없음.
- `statusReason='oauth_invalid_scope'` 는 `integration-status-reason.ts` 에 이미 등록된 값이며 이번 변경 set 에 신규 추가 없음. backend-labels.ts 의 statusReason 매핑 테이블도 별도로 존재하지 않음.

## 신규 섹션 디렉토리 / locale 확인

해당 없음 (신규 docs 디렉토리 생성 없음).

---

## 요약

매트릭스 총 18개 trigger 중, 변경 파일(`integration-oauth.service.ts`, `scope-tab.tsx`)은 `integration-provider-change`(semantic) trigger 1개에 매칭됩니다. i18n parity, ERROR_KO 매핑, 신규 섹션 locale 은 모두 이상 없으나, Cafe24 OAuth `invalid_scope` 콜백의 새 사용자 플로우(`statusReason='oauth_invalid_scope'` + 별도 승인 안내 분기)가 `cafe24.mdx` / `cafe24.en.mdx` 에 반영되지 않아 WARNING 1건이 발견됩니다.

## 위험도

WARNING
