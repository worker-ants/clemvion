# Cross-Spec 일관성 검토 결과

**대상**: refactor 03 m-3 — `integrations/new/page.tsx` 1444→448줄 behavior-preserving 분할  
**커밋**: 174bd906 + review-fix 77a04a4f  
**검토 모드**: impl-done (구현 완료 후)

---

## 발견사항

### 1. INFO — `OAuthCallbackPayload.mode` 표기 불일치 (기존 표기 비일관성)

- **target 위치**: `/codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts` line 8
- **충돌 대상**: `spec/2-navigation/4-integration.md §9.2` (OAuth callback payload 정의)
- **상세**: spec §9.2 의 공식 callback payload 에서 `"request-scopes"` (하이픈)을 사용하나, 코드 타입과 spec Rationale 행(line 1342)에서는 `request_scopes` (언더스코어)를 혼용한다. 이번 추출이 기존 `page.tsx` 의 인라인 타입을 그대로 이동한 것이며 신규 불일치를 도입하지 않았다. 기존부터 존재하던 표기 혼용이 훅 파일로 옮겨온 것이다.
- **제안**: spec §9.2 의 callback mode 값을 `"request_scopes"` (언더스코어)로 통일하거나, 반대로 코드 타입을 `"request-scopes"` (하이픈)으로 통일. 단, 실제 런타임 값(backend 가 내려주는 문자열)을 먼저 확인해 양측 중 올바른 쪽을 SoT 로 결정. 이번 리팩터 범위 밖이므로 별도 sync 작업 권장.

### 2. INFO — `integrationPreviewId` vs `previewToken` 명칭 차이

- **target 위치**: `use-oauth-popup-return.ts` — `previewToken` 상태로 통일
- **충돌 대상**: `spec/2-navigation/4-integration.md §3.5`
- **상세**: spec §3.5 는 팝업 복귀 시 수신하는 임시 식별자를 `integrationPreviewId` 로 부르고, §9.2 API 스키마와 코드는 이를 `previewToken` 으로 부른다. 두 이름이 같은 개념의 다른 표기로 혼재한다. 이번 리팩터가 도입한 불일치가 아니며 기존 page.tsx 코드가 동일하게 `previewToken` 을 사용하고 있었다.
- **제안**: `spec/2-navigation/4-integration.md §3.5` 의 `integrationPreviewId` 를 `previewToken` 으로 통일하도록 동기화 권장.

---

## 요약

이번 m-3 리팩터는 `integrations/new/page.tsx` 의 인라인 컴포넌트(AuthStep, TestStep, Cafe24PrivatePendingStep, MakeshopPendingStep)와 로직(OAuth 팝업 상태 기계, beforeunload 가드)을 spec §3.5/§3.6 이 명시한 경계 그대로 분리했다. 분리 결과물은 spec 정의 동작(팝업 5분 타임아웃, popup.closed 폴링 + 1.5s bail, beforeunload 이탈 가드, Cafe24/MakeShop pending_install 폴링)과 일치하며, 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 어느 관점에서도 기존 spec 과의 실질적 모순이 발견되지 않는다. 발견된 2건은 모두 INFO 등급으로, 이번 리팩터 이전부터 존재하던 spec 내 표기 비일관성이 추출을 통해 가시화된 것이다.

---

## 위험도

NONE
