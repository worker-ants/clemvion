스펙 파일을 모두 확인했습니다. 이제 요구사항 관점에서 분석합니다.

---

## 요구사항 코드 리뷰

### 발견사항

---

**[CRITICAL] OAuth 토큰 교환 미구현 — 스텁 처리**
- 위치: `integration-oauth.service.ts` `handleCallback()` — `syntheticCredentials` 블록
- 상세: 스펙 §10.2 Step 3은 "Authorization Code → Token 교환: provider별 토큰 엔드포인트에 code + client_secret 전송"을 요구한다. 코드에는 `stub-${randomBytes(8).toString('hex')}` 형태의 합성 토큰이 저장되며, 주석도 `"Phase C: token exchange is stubbed"`라고 명시되어 있다. 실제 token exchange 없이는 Slack/Google/GitHub 연동이 작동하지 않는다.
- 제안: Slack `https://slack.com/api/oauth.v2.access`, Google `https://oauth2.googleapis.com/token`, GitHub `https://github.com/login/oauth/access_token` 각 엔드포인트로의 실제 HTTP 교환을 구현해야 한다.

---

**[CRITICAL] credentials 암호화 미구현**
- 위치: `integration.entity.ts` `credentials` 컬럼, 마이그레이션 V008
- 상세: 스펙 §2.10은 credentials JSONB를 **"암호화 저장"** (`JSONB (encrypted)`)으로 명시한다. 현재 구현은 평문 JSONB로 저장하며 암호화 계층이 없다. access_token, password, signing_secret 같은 비밀값이 DB에 평문으로 기록된다.
- 제안: TypeORM Transformer 또는 DB-level 암호화(pgcrypto `pgp_sym_encrypt`)를 적용해야 한다.

---

**[WARNING] Step 3 연결 테스트 자동 호출 누락**
- 위치: `frontend/src/app/(main)/integrations/new/page.tsx` `TestStep` 컴포넌트
- 상세: 스펙 §3.3 "자동으로 `POST /api/integrations/preview-test`를 호출 (DB 저장 없이 메모리상 자격 증명으로 검증)"이라고 명시한다. 그러나 현재 `TestStep`은 정적으로 "Ready to save" + CheckCircle을 표시할 뿐, preview-test API를 호출하지 않는다. 비OAuth 연동에서 자격증명 유효성을 검증하지 않고 저장이 가능하다.
- 제안: `TestStep` 마운트 시 `integrationsApi.previewTest()` 자동 호출, 결과에 따라 성공/실패 UI 분기.

---

**[WARNING] `OAUTH_CONFIG_MISSING` 에러 상태코드 불일치**
- 위치: `integration-oauth.service.ts` `begin()` — `clientId` 미설정 분기
- 상세: 스펙 §9.4에서 `OAUTH_CONFIG_MISSING`은 500으로 명시되어 있다. 현재 구현은 `BadRequestException`(400)으로 던진다. 클라이언트가 서버 설정 오류를 사용자 입력 오류로 오인할 수 있다.
- 제안: `InternalServerErrorException`으로 변경.

---

**[WARNING] OAuth mode 값 불일치 — spec vs DTO**
- 위치: `dto/integration.dto.ts` `OAuthBeginDto.mode`, `integration-oauth-state.entity.ts` `OAuthStateMode`
- 상세: 스펙 §9.2에서 mode는 `'new' | 'reauthorize' | 'request-scopes'`(하이픈)으로 문서화되어 있다. 코드는 `'request_scopes'`(언더스코어)를 사용한다. 스펙을 참조해 통합을 구축하는 클라이언트가 올바른 mode 값을 알 수 없다.
- 제안: 스펙을 `'request_scopes'`(언더스코어)로 업데이트하거나, DTO에 양 형식 모두 허용 후 정규화 처리.

---

**[WARNING] AuditLog 기록 미구현**
- 위치: `integrations.service.ts`, `integration-oauth.service.ts` (전반)
- 상세: 스펙 §14 "감사 로그(AuditLog): Integration 생성·삭제·회전·재인증·scope 전환 이벤트를 `resource_type='integration'`로 기록"을 요구한다. 컨트롤러와 서비스 어디에도 AuditLog 기록 로직이 없다.
- 제안: create, remove, rotate, reauthorize, updateScope 각 메서드에 AuditLog 기록 추가.

---

**[WARNING] IntegrationUsageLog 90일 보존 정책 미구현**
- 위치: 없음 — 구현 자체 누락
- 상세: 스펙 §2.10.1 "보존 기간: 90일. 일일 배치로 기한 초과 레코드 정리"를 요구한다. `IntegrationExpiryScannerService`의 일일 배치는 만료 알림만 처리하며 usage log 정리 로직이 없다.
- 제안: 만료 스캐너에 `at < NOW() - INTERVAL '90 days'`인 `integration_usage_log` 레코드 삭제 로직 추가.

---

**[WARNING] 이메일 알림 옵션 미구현**
- 위치: `integration-expiry-scanner.service.ts` `run()` — notification 생성 부분
- 상세: 스펙 §11.3 "사용자별 프로필 설정 `notifyIntegrationExpiryByEmail` 토글 활성화 시 `Notification.channel = 'both'`로 생성"을 요구한다. 현재 스캐너는 무조건 `channel: 'in_app'`으로 고정 생성한다.
- 제안: 수신자의 프로필 설정을 조회해 `channel` 값 결정.

---

**[WARNING] `beforeunload` 이탈 경고 미구현**
- 위치: `frontend/src/app/(main)/integrations/new/page.tsx`
- 상세: 스펙 §3.6 "`beforeunload`에서 입력 중인 자격 증명이 있으면 경고"를 요구한다. 현재 구현에는 해당 가드가 없다.
- 제안: `useEffect`에서 credentials가 비어있지 않을 때 `window.addEventListener('beforeunload', handler)` 추가.

---

**[WARNING] 권한 규칙 — 조회 범위 필터링 미확인**
- 위치: `integrations.service.ts` `findAll()` (diff 누락)
- 상세: 스펙 §8 "조회: Personal → 본인 것만, Organization → 모든 멤버"를 요구한다. `findAll`의 실제 구현이 diff에서 누락되어 확인 불가능하다. Personal 연동을 `createdBy = userId`로 필터링하지 않으면 다른 사용자의 Personal 연동이 노출될 수 있다.
- 제안: `findAll` 쿼리에서 scope=personal인 경우 `createdBy = userId` 조건 적용 여부 검증 필요.

---

**[WARNING] OAuth 팝업 타임아웃 미처리**
- 위치: `frontend/src/app/(main)/integrations/new/page.tsx` OAuth message handler
- 상세: 스펙 §3.5 "팝업이 5분 내 복귀하지 않으면 타임아웃 에러 표시, 사용자는 재시도 가능"을 요구한다. 현재 message listener에 타임아웃 처리가 없다.
- 제안: OAuth begin 후 5분 타이머 설정, 만료 시 에러 상태 표시 및 재시도 버튼 활성화.

---

**[WARNING] Activity 쿼리 최대값 검증 누락**
- 위치: `dto/integration.dto.ts` `ActivityQueryDto`, `integrations.controller.ts` `activity()`
- 상세: 스펙 §9.3 "`limit`(기본 20, **최대 100**), `days`(기본 7, **최대 30**)"을 명시한다. 컨트롤러는 `Number.isFinite` 체크만 하며 최대값 클램핑이 없다. `limit=99999`를 허용한다.
- 제안: `Math.min(limit, 100)`, `Math.min(days, 30)` 적용.

---

**[INFO] 서비스 유형 필터 단일 선택 — 스펙은 다중 선택**
- 위치: `integrations/page.tsx`, `dto/integration.dto.ts` `ListIntegrationsQueryDto.serviceType`
- 상세: 스펙 §2.3 "서비스 유형 칩 | **다중 선택 가능**. 선택 없음 = 전체"를 요구한다. 현재 구현은 단일 `serviceType` 쿼리 파라미터만 지원하며, UI 칩도 단일 선택으로 동작한다.
- 제안: `serviceType[]` 배열 파라미터 지원으로 확장.

---

**[INFO] 스캐너 DB 쿼리 — `tokenExpiresAt IS NOT NULL` 미적용**
- 위치: `integration-expiry-scanner.service.ts` `run()` — TypeORM find 조건
- 상세: 스펙 §11.1 "대상: Integration WHERE `token_expires_at IS NOT NULL`"이나, 쿼리는 `LessThanOrEqual(horizon)` 조건만 사용하고 인-코드에서 `if (!integration.tokenExpiresAt) continue`로 처리한다. `token_expires_at IS NULL`인 레코드까지 DB에서 불러온 후 필터링하는 비효율 발생.
- 제안: TypeORM find 조건에 `tokenExpiresAt: Not(IsNull())` 추가.

---

**[INFO] 키보드 단축키 `N` 미구현**
- 위치: `integrations/page.tsx`
- 상세: 스펙 §2.5 "키보드 `N` 단축키 허용"을 요구한다. 현재 구현에 없다.
- 제안: `useEffect`에서 `keydown` 이벤트 리스너로 `N` 키 처리 추가.

---

### 요약

구현은 Integration 모듈의 전체 골격(엔티티, 마이그레이션, OAuth 상태 머신, 만료 스캐너, 권한 기반 CRUD)을 충실히 갖추고 있으나, **두 가지 Critical 결함**이 있다: (1) OAuth 토큰 교환이 stub으로 처리되어 실제 서비스 연동이 불가능하고, (2) credentials가 평문으로 저장되어 보안 요구사항을 위반한다. 기능 완전성 측면에서는 Step 3 preview-test 자동 호출 누락, AuditLog 미기록, usage log 90일 보존 정책 미구현, 이메일 알림 채널 미처리 등 다수의 Warning 수준 누락이 발견된다. 권한 규칙 중 Personal 조회 필터링은 diff 누락으로 검증이 불가능해 별도 확인이 필요하다.

### 위험도

**HIGH**