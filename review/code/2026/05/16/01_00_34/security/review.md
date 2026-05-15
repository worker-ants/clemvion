# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `openOAuthPopup` — 외부 URL 검증 없이 `window.open` 호출
  - 위치: `frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts` 전체 (11줄)
  - 상세: `openOAuthPopup(url: string)` 은 전달된 `url` 에 대해 어떠한 scheme 검증도 수행하지 않는다. 현재 호출 경로는 백엔드 API 응답(`res.authUrl`)을 그대로 전달하므로 실질적 위협은 낮다. 그러나 만약 미래에 이 함수가 다른 곳에서 재사용되거나 클라이언트-사이드 라우팅 파라미터 등 신뢰도가 낮은 경로로 `url` 이 유입될 경우 `javascript:` scheme을 이용한 XSS 또는 `data:` URI를 통한 피싱이 가능해진다. `window.open("javascript:alert(1)", ...)` 는 일부 브라우저에서 실행된다.
  - 제안: 함수 내부에 URL scheme 화이트리스트 검사를 추가한다. `const parsed = new URL(url); if (!["https:", "http:"].includes(parsed.protocol)) return;` 정도로 충분하다. 프로덕션 환경에서는 `https:` 만 허용하는 것이 바람직하다.

- **[INFO]** `requestScopes` API 응답의 클라이언트 측 타입 캐스팅 — 런타임 검증 부재
  - 위치: `frontend/src/lib/api/integrations.ts` lines 243–823 (diff 기준 `requestScopes` 함수)
  - 상세: `unwrap<RequestScopesResult>(data)` 는 TypeScript 제네릭 캐스팅일 뿐 런타임 shape 검증이 없다. 백엔드가 예상치 못한 구조(예: `scopesAdded` 가 배열이 아닌 경우)를 반환하면 `cafe24Pending.scopesAdded.map(...)` 에서 런타임 오류가 발생한다. 이 자체는 보안 취약점이 아니나, 응답 위변조(중간자 공격) 시나리오에서 클라이언트가 임의 scope 문자열을 렌더링하게 된다. scope 문자열은 React가 텍스트 노드로 렌더링하므로 XSS 위험은 없지만, 사용자를 혼란에 빠뜨리는 피싱 안내문이 표시될 수 있다.
  - 제안: 프로덕션 API 통신은 HTTPS로만 이루어지므로 중간자 공격 위험은 낮다. 다만 런타임 유효성 검사 라이브러리(예: Zod)를 도입해 API 응답 shape를 선언적으로 검증하면 안정성이 높아진다.

- **[INFO]** 테스트 픽스처에 하드코딩된 URL — 프로덕션 혼입 위험 없음, 양호
  - 위치: `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx` lines 163–166
  - 상세: 테스트 픽스처에 `"https://example.com/api/3rd-party/cafe24/install/abc"` 등 구체적 URL이 있으나 모두 `example.com` 도메인이며 테스트 전용이다. API 키, 토큰, 실제 시크릿이 포함되어 있지 않다. 문제없음.
  - 제안: 별도 조치 불필요.

- **[INFO]** `credentials` 필드를 UI에 직접 노출 — 테스트 픽스처에서 `mall_id` 노출
  - 위치: `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx` lines 99–103
  - 상세: `buildIntegration` 픽스처가 `credentials: { app_type: "private", mall_id: "demoshop", scopes: [...] }` 를 포함한다. 실제 프로덕션 응답에서도 `IntegrationDto.credentials` 가 그대로 내려온다면 `mall_id` 같은 식별자가 프론트엔드에 노출된다. 이 값은 현재 UI에 표시되지는 않으나 응답 페이로드에 포함된다.
  - 제안: 백엔드 API가 `credentials` 객체에서 민감 정보(client_secret 등)를 제거하고 있는지 확인이 필요하다. 프론트엔드 코드 자체보다 백엔드 직렬화 레이어에서 검토해야 할 사항이다.

- **[INFO]** OAuth popup `window.open` 반환값 미검증
  - 위치: `frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts` lines 5–10
  - 상세: `window.open()`의 반환값(`WindowProxy | null`)을 사용하지 않는다. 팝업 차단기(popup blocker)가 활성화된 경우 `null`이 반환되어 사용자에게 별도 안내 없이 조용히 실패한다. 보안 취약점이 아니라 UX 문제이나, 팝업 차단 시 사용자에게 적절한 안내가 제공되지 않아 OAuth 흐름이 완료되지 않은 채 방치될 수 있다.
  - 제안: 반환값이 `null`인 경우 toast 또는 alert로 "팝업이 차단되었습니다. 팝업 차단을 해제해 주세요."와 같은 안내를 제공한다.

## 요약

이번 변경은 Cafe24 Private 앱의 `request-scopes` API 응답에 대한 UI 분기를 프론트엔드에 추가한 것으로, 전반적으로 보안 측면에서 양호하다. 하드코딩된 시크릿이 없고, 사용자 입력을 SQL이나 명령어에 직접 삽입하는 경로도 없으며, scope 문자열은 React가 텍스트 노드로 안전하게 렌더링한다. 다만 `openOAuthPopup` 함수가 URL scheme을 검증하지 않아 향후 재사용 시 잠재적 XSS/피싱 진입점이 될 수 있고, API 응답 shape에 대한 런타임 검증이 없다는 점은 개선 여지가 있다. 모든 발견사항은 INFO 등급이며 즉각적인 보안 위협은 식별되지 않았다.

## 위험도

LOW
