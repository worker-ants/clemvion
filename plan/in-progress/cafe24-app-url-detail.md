---
worktree: cafe24-app-url-detail-a7c3f4
started: 2026-05-16
owner: developer
spec_files:
  - spec/2-navigation/4-integration.md
---

# Cafe24 Private 통합 상세 페이지 App URL 노출 + HMAC 진단 로그

## 배경

사용자가 이미 connected 상태인 Cafe24 Private 통합에서 Cafe24 admin "앱으로 가기" 호출 시 `CAFE24_INSTALL_INVALID_HMAC (403)` 응답을 받았다. 에러 페이지(`backend/.../install-error.template.ts`) 는 "통합 상세 페이지의 URL 과 일치하는지 확인하세요" 라고 안내하지만 **그 URL 이 통합 상세 페이지에 표시되지 않는다** (frontend gap).

또한 HMAC 검증 실패 3 분기(mall_id 불일치 · client_secret 부재 · HMAC 자체 불일치) 가 같은 응답 코드를 반환하지만 로그 없이 throw 만 해 운영 환경에서 원인 판별이 불가능하다.

## 결함 분류

| 결함 | 위치 | 영향 |
| --- | --- | --- |
| A. App URL 미노출 | `frontend/src/app/(main)/integrations/[id]/page.tsx` | 사용자가 에러 안내를 따라가도 URL 비교 불가 |
| B. HMAC 실패 진단 로그 부재 | `backend/.../integration-oauth.service.ts:handleInstall` (라인 1254/1264/1271) | 운영 환경에서 실패 원인 추정만 가능 |

## 작업 체크리스트

### Step 0–3 (셋업)
- [x] worktree `cafe24-app-url-detail-a7c3f4` 생성
- [x] `spec/2-navigation/4-integration.md` 전체 (Overview / 본문 / Rationale) 읽기
- [ ] `/consistency-check --impl-prep spec/2-navigation/4-integration.md` 실행 — Critical 0건 확인

### Step 4 (DOCUMENTATION)
- [ ] `frontend/src/lib/i18n/dict/ko.ts` 신규 키 추가
- [ ] `frontend/src/lib/i18n/dict/en.ts` 신규 키 추가
- [ ] `plan/in-progress/spec-update-cafe24-app-url-detail.md` 작성 — spec/2-navigation/4-integration.md §4.2 + Rationale 추가 제안 (developer 권한 밖이므로 project-planner 위임)

### Step 5–7 (테스트 + 구현)

**Backend tests**
- [ ] `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts`
  - mall_id_mismatch 시 `logger.warn` 호출 + reason 필드 확인
  - no_client_secret 시 동일
  - hmac_verify_failed 시 동일
  - tryRecoverByMallId 의 후보 0건 / 다중 매칭 / 모두 verify 실패 케이스 로그
- [ ] `backend/src/modules/integrations/integrations.service.spec.ts`
  - `toPublic` 의 cafe24 private → `appUrl` non-null 노출 + `installToken` 응답에서 제거
  - cafe24 public / 그 외 → `appUrl: null`

**Backend impl**
- [ ] `handleInstall`: 3 분기 각각 `logger.warn` 추가 (reason, urlMallId, dbMallId, dbAppType, status, statusReason, tokenPreview)
- [ ] `tryRecoverByMallId`: HMAC 후보 0건/다중 분기 로그 (이미 있는 진단 로그 보강)
- [ ] `PublicIntegration` 타입: `appUrl: string | null` 추가, `installToken` 응답 제거
- [ ] `IntegrationsService.toPublic`: cafe24 private 일 때 `buildCafe24InstallUrl(APP_URL, installToken)` 으로 `appUrl` 계산
- [ ] `buildCafe24InstallUrl` 헬퍼 / `third-party-oauth.constants.ts` 의 callback URL 헬퍼 재사용

**Frontend tests + impl**
- [ ] `frontend/src/lib/api/integrations.ts` `IntegrationDto` 에 `appUrl: string | null`
- [ ] `frontend/src/app/(main)/integrations/[id]/__tests__/app-url-card.test.tsx` 신규 RTL 테스트
- [ ] 상세 페이지에 `Cafe24AppUrlCard` 컴포넌트 추가 — App URL / Redirect URI / 안내 문구 + 복사 버튼
- [ ] 신규 등록 흐름의 `Cafe24PrivatePending` 카피 UX 패턴과 일관 유지

### Step 8 (TEST WORKFLOW)
- [ ] `cd backend && npm run lint`
- [ ] `cd frontend && npm run lint`
- [ ] `cd backend && npm test`
- [ ] `cd frontend && npm test`
- [ ] `cd backend && npm run build`
- [ ] `cd frontend && npm run build`
- [ ] `make e2e-test` (integration 영역 변경 → 필수)

### Step 9 (REVIEW WORKFLOW)
- [ ] `/ai-review` 호출
- [ ] Warning+ 이슈 조치
- [ ] `review/.../RESOLUTION.md` 작성
- [ ] TEST WORKFLOW 재실행

## 결정 사항 / Open question

- `appUrl` 최상위 필드 vs `meta.appUrl` 중첩 — 기존 `meta.appType` 와 다른 시멘틱 (URL 은 단순 hint 가 아니라 사용자에게 직접 노출되는 actionable 데이터) 이므로 최상위 필드로 결정.
- `installToken` 응답에서 완전히 제거 vs 보존 — App URL 의 path segment 로 이미 포함, 별도 필드 노출 불필요. 제거.
- Redirect URI 노출 — 신규 등록 흐름과 일관성. 사용자가 Cafe24 Developers 의 "Redirect URI" 와 비교할 수 있어야 함 → 표시.

## 영향 받는 외부 파일

- `backend/src/modules/integrations/integration-oauth.service.ts`
- `backend/src/modules/integrations/integrations.service.ts`
- `backend/src/modules/integrations/integrations.service.spec.ts`
- `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts`
- `frontend/src/lib/api/integrations.ts`
- `frontend/src/lib/i18n/dict/ko.ts`
- `frontend/src/lib/i18n/dict/en.ts`
- `frontend/src/app/(main)/integrations/[id]/page.tsx`
- `frontend/src/app/(main)/integrations/[id]/__tests__/app-url-card.test.tsx` (신규)
- `plan/in-progress/spec-update-cafe24-app-url-detail.md` (신규 — project-planner 인계)
