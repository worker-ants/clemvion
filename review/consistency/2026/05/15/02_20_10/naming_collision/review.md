충분한 정보를 수집했습니다. 명명 충돌 점검 결과를 보고합니다.

---

## 발견사항

---

### **[WARNING]** `redirectUri` 생성 로직 — 서비스 내 3곳 하드코딩

- **target 신규 식별자**: `/api/3rd-party/:provider/callback`
- **기존 사용처**: `backend/src/modules/integrations/integration-oauth.service.ts`
  - line 322: `` `${appUrl}/api/integrations/oauth/callback/${service.oauthProvider}` ``
  - line 785: `` `${appUrl}/api/integrations/oauth/callback/${provider}` ``
  - line 1049: `` `${appUrl}/api/integrations/oauth/callback/cafe24` ``
- **상세**: 옛 경로를 그대로 사용하는 redirectUri 문자열이 서비스 레이어에 3곳 분산되어 있음. 새 라우트를 추가하고 옛 라우트를 삭제하면서 이 문자열들을 업데이트하지 않으면, Google/GitHub OAuth 도 포함한 **전체 OAuth callback이 무효 URL을 생성**한다. 구현 시 반드시 동시에 수정해야 함.
- **제안**: line 322, 785를 공통 헬퍼 `` `${appUrl}/api/3rd-party/${provider}/callback` ``으로 교체; line 1049를 `` `${appUrl}/api/3rd-party/cafe24/callback` ``으로 교체.

---

### **[WARNING]** `appUrl` 생성 로직 — Private install URL 하드코딩

- **target 신규 식별자**: `/api/3rd-party/cafe24/install/:installToken`
- **기존 사용처**: `backend/src/modules/integrations/integration-oauth.service.ts:962-963`
  - `` appUrl: `${appUrl}/api/integrations/oauth/install/cafe24/${installToken}` ``
  - `` callbackUrl: `${appUrl}/api/integrations/oauth/callback/cafe24` ``
- **상세**: `createPrivatePendingIntegration`이 반환하는 `appUrl`/`callbackUrl`이 옛 경로를 그대로 사용. 이 값이 FE에 전달되어 사용자에게 "Cafe24 Developers에 등록할 App URL"로 표시된다. 옛 경로를 삭제한 후 기존 `pending_install` 행에 저장된 URL이 있는 경우 사용자가 혼란을 겪을 수 있음.
- **제안**: 새 경로로 교체. 기존 `pending_install` 행은 TTL 스캐너로 만료 처리되므로 migration 불필요(plan §결정 내용과 일치).

---

### **[WARNING]** 사용자 매뉴얼 MDX — 옛 경로 2종 4곳 노출

- **target 신규 식별자**: `/api/3rd-party/cafe24/install/:token`, `/api/3rd-party/cafe24/callback`
- **기존 사용처**:
  - `frontend/src/content/docs/06-integrations-and-config/cafe24.mdx:38` — App URL: `…/api/integrations/oauth/install/cafe24`
  - `frontend/src/content/docs/06-integrations-and-config/cafe24.mdx:39,151` — Redirect URI: `…/api/integrations/oauth/callback/cafe24`
  - `frontend/src/content/docs/06-integrations-and-config/cafe24.en.mdx:38,39,150,168` — 동일 영문 버전 4곳
- **상세**: 사용자가 매뉴얼을 참고해 Cafe24 Developers에 직접 URL을 입력하는 안내문. 새 경로로 교체하지 않으면 사용자가 옛 경로(404)를 등록하게 됨. Phase 2 구현과 동시에 수정 필요.
- **제안**: App URL 안내는 `…/api/3rd-party/cafe24/install/<22자 토큰>` 형식 임을 명시(토큰은 UI에서 복사). Redirect URI는 `…/api/3rd-party/cafe24/callback`으로 교체.

---

### **[INFO]** `INSTALL_TOKEN_PATTERN` — 로컬 상수, 외부 참조 없음

- **target 신규 식별자**: `/^[A-Za-z0-9_-]{22}$/` (22자 base64url)
- **기존 사용처**: `backend/src/modules/integrations/integrations.controller.ts:59` — `const INSTALL_TOKEN_PATTERN = /^[a-f0-9]{64}$/` (모듈 로컬, `export` 없음)
- **상세**: 외부에서 임포트하는 곳이 없으므로 충돌 없음. 해당 파일 내 교체만 필요.
- **제안**: 정규식 값을 22자 base64url 패턴으로 교체. 상수명은 그대로 유지 가능.

---

### **[INFO]** Swagger `@ApiTags` — 신규 컨트롤러 태그 결정 필요

- **기존 사용처**: `integrations.controller.ts:77` — `@ApiTags('Integrations')` (한국어 설명: `'외부 서비스 통합(OAuth/API Key) 관리'`)
- **상세**: 신규 `ThirdPartyOauthController`(또는 provider별 컨트롤러)에서 사용할 태그가 결정되지 않음. plan의 미결 항목(`swagger Tags`) 에 해당.
- **제안**: 새 OAuth callback/install 경로는 사용자 직접 호출이 아닌 OAuth redirect 목적이므로 Swagger 문서화 우선순위가 낮음. 기존 `'Integrations'` 태그 공유 또는 `'Third-Party OAuth'` 신규 태그 중 선택.

---

## 요약

새 `/api/3rd-party/<provider>/` namespace 자체의 명명 충돌은 없음. **핵심 위험은 service 레이어 내 redirectUri/appUrl 하드코딩 3곳과 MDX 문서 6곳**으로, 신규 라우트 추가와 동시에 갱신하지 않으면 기존 OAuth 흐름(Google·GitHub 포함) 전체가 무효 URL을 사용하게 된다. 컨트롤러 이름·`INSTALL_TOKEN_PATTERN`·`ALLOWED_OAUTH_PROVIDERS` 등 식별자 충돌은 없음.

## 위험도

**MEDIUM** — 기능 명명 충돌은 없으나, 구현 시 반드시 동시 처리해야 하는 **연동 변경점 4개(service 3곳 + MDX 6곳)** 가 존재.