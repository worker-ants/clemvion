이미 수행된 리뷰(`review/2026-05-14_01-29-47/security/review.md`)와 RESOLUTION.md를 교차 참조하며, 실제 diff에서 보이는 코드를 직접 분석합니다.

---

## 발견사항

### [CRITICAL — RESOLUTION.md C1에서 수정됨] `mallId` SSRF 방어 regex 미적용 (사전 수정 확인 권장)

- **위치**: `frontend/src/lib/api/integrations.ts` — `mallId?: string` 필드 (diff 파일 5)
- **상세**: 프론트엔드 API 클라이언트에서 `mallId`는 `string | undefined` 타입으로 선언되어 있고 클라이언트 측 포맷 검증 코드가 diff에 보이지 않습니다. 백엔드 `OAuthBeginDto`의 `@Matches(/^[a-z0-9-]{3,50}$/)` 데코레이터 추가가 RESOLUTION.md C1에서 완료되었다고 명시되어 있으나, 해당 DTO 파일은 이번 diff에 포함되지 않아 **실제 적용 여부를 이 diff만으로는 검증할 수 없습니다**. `mall_id`는 `https://{mall_id}.cafe24api.com/...`에 직접 삽입되므로 검증 부재 시 SSRF로 이어집니다.
- **제안**: `backend/.../integration.dto.ts`에서 `@Matches(/^[a-z0-9-]{3,50}$/)` + `@MinLength(3)` 실제 적용 여부를 별도 확인하세요.

---

### [WARNING] `clientSecret` 프론트엔드 → 백엔드 평문 전송

- **위치**: `frontend/src/lib/api/integrations.ts` +175 ~ +181
- **상세**: Private 앱 OAuth 흐름에서 `clientSecret`이 `apiClient.post("/integrations/oauth/begin", body)`를 통해 전송됩니다. RESOLUTION.md C4에서 백엔드 저장 시 AES-256-GCM 암호화가 적용되었다고 하지만, **전송 경로에서 다음 위험이 잔존합니다**:
  1. HTTP가 아닌 HTTPS 강제 여부가 diff에서 확인되지 않음
  2. 백엔드 request body 로깅 미들웨어가 `clientSecret` 필드를 마스킹하는지 불명확
  3. Nginx/proxy access log, APM(Datadog 등) trace에서 request body가 캡처될 수 있음
- **제안**: `clientSecret` 필드를 request body에서 마스킹하는 NestJS 인터셉터 또는 로거 필터 적용 여부 확인. HTTPS-only 강제 설정 검토.

---

### [WARNING] MCP Tool 이름 충돌 — `integrationId.substring(0, 8)` SID 중복 가능성

- **위치**: `cafe24-mcp-tool-provider.ts` (diff 미포함, security/review.md [INFO] 항목)
- **상세**: `sid = integrationId.substring(0, 8)` 방식으로 생성된 SID가 충돌할 경우, 다른 사용자의 Cafe24 통합 credentials로 tool call이 라우팅될 수 있습니다. UUID v4의 앞 8자 충돌 확률은 워크스페이스당 수십~수백 개 integration을 가정하면 무시할 수 없는 수준입니다. 잘못된 라우팅은 다른 사용자의 쇼핑몰 데이터를 노출하는 **데이터 격리 위반**입니다.
- **제안**: `buildTools()` 단계에서 기존 등록된 SID와 충돌 시 경고 로그 + 충돌한 두 integration ID 기록. 장기적으로 SID 길이를 12~16자로 확장하거나 충돌 감지 시 재생성.

---

### [WARNING] `clientSecret` authUrl 미포함 검증 부재 (테스트 보안 갭)

- **위치**: `integration-oauth.service.cafe24.spec.ts` — private app 테스트 (testing/review.md W9)
- **상세**: RESOLUTION.md에서 "잔여(W9)"로 명시된 항목입니다. Private 앱 흐름에서 `clientSecret`이 `authUrl` 쿼리 파라미터에 포함되면 브라우저 history, Referer 헤더, 서버 access log에서 노출됩니다. 현재 테스트가 이를 검증하지 않습니다.
- **제안**: `expect(result.authUrl).not.toContain('client_secret')` 단언 추가.

---

### [WARNING] `OAUTH_STUB_MODE` 프로덕션 가드 부재

- **위치**: `cafe24.en.mdx` + `cafe24.mdx` — 환경변수 섹션
- **상세**: 문서에서 `OAUTH_STUB_MODE=true` 설정 시 "fake tokens" 반환이라고 명시합니다. 프로덕션 환경에서 이 변수가 실수로 설정될 경우 인증이 완전히 우회됩니다. 해당 가드가 백엔드에 구현되어 있는지(예: `NODE_ENV === 'production'` 시 `OAUTH_STUB_MODE` 강제 무시) diff에서 확인되지 않습니다.
- **제안**: 백엔드에서 `NODE_ENV === 'production' && process.env.OAUTH_STUB_MODE === 'true'` 조합 시 서버 시작 실패 또는 경고 로그 처리 여부 확인.

---

### [INFO] 프론트엔드 서비스 타입 하드코딩 — 공급망 관점

- **위치**: `frontend/src/lib/integrations/mcp-capable-service-types.ts`
- **상세**: 주석에서 "Both lists must move together"라고 명시하고 있어 프론트엔드/백엔드 동기화를 수동으로 관리합니다. 새로운 `service_type`이 백엔드에만 추가되고 프론트엔드가 업데이트되지 않는 경우, 해당 integration이 MCP picker에 표시되지 않아 기능 누락이 발생합니다. 보안 취약점은 아니지만 접근 제어 우회와 유사한 결과(특정 integration 유형이 사용자에게 보이지 않음)를 낳을 수 있습니다.
- **제안**: RESOLUTION.md W4에서 단일 상수 파일 분리는 완료됨. 추가로 `/api/integrations/services` 엔드포인트를 통해 동적 조회하는 방안을 follow-up으로 추적 권장.

---

## 요약

이번 diff에서 보이는 코드 자체의 가장 큰 보안 위험은 **Private 앱 OAuth 흐름에서 `clientSecret`이 프론트엔드에서 백엔드로 전송**되는 구조입니다. 백엔드 저장 측의 암호화(C4)는 RESOLUTION.md 기준 완료되었지만, 전송 경로(로깅 마스킹, HTTPS 강제)와 authUrl에 노출되지 않는다는 테스트 검증이 잔여 과제로 남아 있습니다. SSRF 방어의 핵심인 `@Matches` 데코레이터는 RESOLUTION.md에서 수정 완료로 명시되었으나, 해당 파일이 이번 diff에 포함되지 않아 직접 검증이 불가합니다. 별도 파일(`integration.dto.ts`)을 통해 실제 적용 여부를 확인하는 것이 필수입니다. `integrationId.substring(0, 8)` 기반 SID의 충돌 가능성은 다른 사용자의 쇼핑몰 데이터로 tool call이 잘못 라우팅되는 데이터 격리 위반으로 이어질 수 있어 중요도가 높습니다.

## 위험도

**MEDIUM** — Critical 항목(SSRF, 평문 저장)은 RESOLUTION.md 기준 수정 완료이나 diff 외부 파일이라 직접 검증 불가. `clientSecret` 전송 경로 보안과 SID 충돌 위험이 미해소 상태.