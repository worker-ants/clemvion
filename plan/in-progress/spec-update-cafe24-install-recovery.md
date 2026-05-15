---
worktree: cafe24-install-recovery-8b3c4d
started: 2026-05-15
owner: developer (Claude)
---

# Cafe24 install 404 자동 회복 + env-based Public 옵션 토글

## 배경

운영 사용자 보고 (2026-05-15) — 새 통합을 만들고 Cafe24 Developers 에 App URL 을 등록한 뒤 "테스트 실행" 을 클릭하니 404 `CAFE24_INSTALL_INVALID_TOKEN` 발생. URL 의 install_token (`GFirdVtcR_wcvgvj81ju4w`) 이 DB 에 없음.

가장 흔한 시나리오: 사용자가 신규 통합 폼을 여러 번 제출 (예: client_secret 오타 수정) → idempotent begin 의 credentials-change 분기로 install_token 이 재발급. 사용자가 마지막에 본 URL 만 옳고, 그 사이 Cafe24 Developers 에 등록한 옛 URL 이 stale.

별개 요청 — `.env` 에 `CAFE24_CLIENT_ID/SECRET` 가 없으면 통합 폼의 Public 옵션을 숨겨야 함. Public 은 우리 서버 env 가 필요한 반면 Private 는 사용자 자체 발급으로 항상 사용 가능.

## 결정

### install 404 자동 회복 흐름

`handleInstall` 의 install_token 직접 매칭 실패 후 회복 분기 추가:

1. 같은 `mall_id` (mallId 컬럼) 의 cafe24 row 들 조회
2. 각 row 의 `client_secret` 으로 HMAC trial 검증
3. **정확히 1개** validates → 그 row 로 진행 (OAuth authorize 또는 post-install navigation)
4. 0개 또는 2개+ → 기존 404 흐름

비용: O(N) HMAC verify (N = 같은 mall_id 의 cafe24 row 수). per-workspace 분리 + V046 partial UNIQUE 로 N 은 보통 1~2. 옛 100건 mall_id 스캔 패턴과 달리 회복 분기만 (drop-in 인덱스 안). 정상 흐름 영향 없음.

보안: HMAC 위조에는 client_secret 필요. client_secret 보유자는 정상 흐름으로도 동일 행위 가능 → 회복 흐름이 추가 권한을 부여하지 않음.

### HTML 에러 페이지

Cafe24 의 "테스트 실행" / "앱으로 가기" 는 새 탭으로 우리 URL 을 열어 사용자가 응답을 직접 본다. 기존 JSON 본문은 UX 가 빈약 (브라우저가 raw JSON 렌더). 요청 헤더 `Accept: text/html` 일 때 HTML 페이지 렌더링 — error code/message + 회복 안내 (현재 통합 상세 페이지의 App URL 확인 안내).

### env-based Public 토글

`GET /api/integrations/services` 응답의 cafe24 항목에 `meta.publicAppAvailable: boolean` 추가. `CAFE24_CLIENT_ID && CAFE24_CLIENT_SECRET` 둘 다 set 이면 true, 그 외 false.

Frontend `Cafe24ExtraFields` 가 `publicAppAvailable=false` 일 때:
- app_type 토글에서 Public 버튼 제거 (Private 만 노출)
- 기본값 `private` 강제 (state 가 stale 한 'public' 이면 useEffect 로 coerce)
- 안내 문구 변경: "Private only — this deployment has not registered a Cafe24 App Store app"

Public 제외 결정은 사용자 명시 — Private 는 Public 사용 가능 여부와 무관하게 **항상** 노출 (사용자 직접 client_id/secret 입력).

## 영향 받는 spec 섹션

- `spec/2-navigation/4-integration.md` §5.8 (Cafe24 credentials 스키마) — meta.publicAppAvailable 노출
- `spec/2-navigation/4-integration.md` §3.2 Step 2 — Public 옵션 가용성 안내
- `spec/2-navigation/4-integration.md` §9 — `/services` 응답 shape 갱신
- `spec/2-navigation/4-integration.md` ## Rationale — "Cafe24 install_token mismatch 회복 흐름" 항 추가

## 영향 받는 코드

- `backend/src/modules/integrations/integration-oauth.service.ts` — `handleInstall` 회복 분기 + `tryRecoverByMallId` helper
- `backend/src/modules/integrations/third-party-oauth.controller.ts` — Accept 헤더 분기 → HTML 렌더
- `backend/src/modules/integrations/services/install-error.template.ts` — 신규 HTML 템플릿
- `backend/src/modules/integrations/integrations.service.ts` — `getAvailableServices` 의 `meta.publicAppAvailable`
- `frontend/src/lib/api/integrations.ts` — `ServiceDefinition.meta` 타입
- `frontend/src/app/(main)/integrations/new/page.tsx` — `Cafe24ExtraFields` 의 publicAppAvailable prop

## 호환성

- 회복 흐름은 정상 흐름에 zero impact (token 매칭 시 회복 미발동).
- `meta.publicAppAvailable=true` 미설정 deployment 는 기존 동작 유지 (frontend 의 `service.meta?.publicAppAvailable !== false` 가 undefined 일 때 true 처리).
- HTML 응답은 Accept 헤더 기반이라 API 클라이언트 (JSON 기대) 영향 없음.

## 후속 작업

- [ ] spec 갱신 (Rationale 추가)
- [ ] backend 구현 + 테스트
- [ ] frontend 구현
- [ ] PR 머지 후 본 plan 을 `plan/complete/` 로 이동
