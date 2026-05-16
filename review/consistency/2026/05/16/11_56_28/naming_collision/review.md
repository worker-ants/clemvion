# 신규 식별자 충돌 검토 — `spec/2-navigation/4-integration.md`

> 검토 모드: `--impl-prep` (구현 착수 전)
> 검토 시각: 2026-05-16

---

## 발견사항

### [WARNING] `/api/3rd-party/:provider/callback` vs `/api/auth/oauth/:provider/callback` — 경로 패턴 유사로 혼동 가능

- **target 신규 식별자**: `GET /api/3rd-party/:provider/callback` (`:provider ∈ {cafe24, google, github}`)
- **기존 사용처**: `spec/2-navigation/10-auth-flow.md` §8 및 §5.1 — `GET /api/auth/oauth/:provider/callback` (사용자 소셜 로그인 OAuth 콜백)
- **상세**: 두 엔드포인트 모두 `:provider/callback` 패턴이며 Google/GitHub 를 공통으로 받는다. Integration 연동 콜백은 `/api/3rd-party/:provider/callback`, 사용자 인증 콜백은 `/api/auth/oauth/:provider/callback`으로 이름이 다르지만, Google Cloud Console 및 GitHub OAuth App 에 두 redirect URI 가 동시에 등록되어야 한다는 점(target §10.1 참고 노트)에서 운영자 혼동이 발생할 수 있다. target §10.1 에서 "두 redirect URI 모두 등록 필요"라고 명시하고 있으나, 구현 시 라우터 레벨에서 경로가 겹치지 않도록 주의가 필요하다.
- **제안**: 구현 시 두 콜백 라우트를 명확히 분리 (`/api/auth/oauth/` vs `/api/3rd-party/`) 하고, 운영 가이드에서 OAuth App 설정 시 두 URI를 구별하여 안내하는 주석을 라우터 코드에 추가한다. spec 자체의 식별자 변경은 불필요 — 이미 의도적 분리가 명확하다.

---

### [WARNING] `application` Resource 메타데이터와 `credentials.app_type` — 동일 문맥에서 "application" 용어 중복

- **target 신규 식별자**: `credentials.app_type` (enum `'public' | 'private'`) — Cafe24 앱 발급 형태. target §5.8
- **기존 사용처**: `spec/conventions/cafe24-api-metadata.md` §1 디렉토리 구조의 `application.ts` — "Cafe24 앱 관리 API" Resource. 해당 파일에 주석 "⚠ Cafe24 앱 관리 API — OAuth 앱 등록(credentials.app_type)과 무관. naming collision 주의"가 이미 붙어 있음
- **상세**: `credentials.app_type` 은 우리 서비스가 Cafe24 에 등록한 앱의 종류(public/private)를 뜻하고, `application` Resource 메타데이터는 Cafe24 어드민 API 의 "앱 관리" 엔드포인트 카테고리다. 같은 Cafe24 통합 도메인 안에서 "application" 이라는 단어가 서로 다른 의미로 쓰인다. spec/conventions에서 이미 주의 표시가 있으나, 구현 시 혼동이 남아 있을 수 있다.
- **제안**: 구현 코드에서 `credentials.app_type` 관련 변수명은 `appType` 또는 `cafe24AppType` 처럼 명확화하고, `application.ts` Resource 의 변수명은 `applicationOperations` 처럼 "Operations" 접미사를 유지하여 두 개념이 소스 코드에서 섞이지 않도록 한다. spec 변경은 불필요.

---

### [WARNING] `status_reason='oauth_token_exchange_failed'` vs URL param `error=token_exchange_failed` — 유사 이름, 다른 도메인

- **target 신규 식별자**: `status_reason='oauth_token_exchange_failed'` — Integration.status_reason DB 컬럼 값. target §6 / §10.4
- **기존 사용처**: `spec/2-navigation/10-auth-flow.md` §5.4 — `{frontend_url}/callback?error=token_exchange_failed` (사용자 소셜 로그인 OAuth 콜백 에러 URL param)
- **상세**: 두 값은 서로 다른 도메인(Integration credentials vs User authentication)의 식별자이며, target Rationale에서 의도적으로 `oauth_` prefix 를 두어 분리했다고 명시됨. 그러나 grep 시 `token_exchange_failed` 문자열이 양쪽에 등장해 구현자가 혼동할 여지가 있다.
- **제안**: spec 변경 불필요(이미 Rationale 명시). 구현 시 Integration 도메인의 에러 처리 코드에 "이 값은 10-auth-flow.md의 OAuth login 에러와 무관함" 주석을 추가하는 것을 권장한다.

---

### [INFO] `install_token` 컬럼 형식 변경 — 기존 DB 행과의 호환성

- **target 신규 식별자**: `install_token` 형식 — 16바이트 base64url no-padding (22자, `^[A-Za-z0-9_-]{22}$`). target §5.8 / Rationale "Cafe24 App URL 100자 한도 대응"
- **기존 사용처**: `spec/1-data-model.md` §2.10 — `install_token: String?` 컬럼 (길이 제약 없음). Rationale에서 "옛 32바이트 hex (64자)는 폐기"라고 명시
- **상세**: 데이터 모델 spec의 `String?` 컬럼 타입은 길이 비제약이므로 스키마 마이그레이션은 불필요하다. 그러나 기존에 발급된 64자 hex 토큰이 DB에 남아있을 경우, 신규 22자 토큰과 동일 컬럼에 혼재한다. `install_token` 파셜 인덱스를 통한 조회에서 두 형식이 모두 매칭된다(길이 무관). 애플리케이션 레이어에서 토큰 길이 검증을 새 형식(`^[A-Za-z0-9_-]{22}$`)으로만 진행하면 구버전 토큰이 붙은 row를 `CAFE24_INSTALL_INVALID_TOKEN`(404)으로 거부하게 된다.
- **제안**: 구현 시 HMAC 검증 전 토큰 형식 validation에서 22자 base64url 정규식만 허용함을 명확히 하고, 마이그레이션 가이드에서 기존 64자 hex `install_token`을 보유한 `pending_install` 행은 스캐너가 24h TTL 로 자연히 `expired`처리됨을 명시하는 것을 권장한다. spec 변경 불필요.

---

### [INFO] `cafe24_operator_id` — 내부 `User.id` (UUID)와 필드명 유사도

- **target 신규 식별자**: `credentials.cafe24_operator_id` — Cafe24 API 응답 body의 `user_id` 값을 저장하는 JSONB 필드. target §5.8
- **기존 사용처**: `spec/1-data-model.md` §2.1 — `User.id` (UUID PK). `spec/1-data-model.md` §2.14 — `NodeExecution.id`, `Execution.executed_by` (FK → User)
- **상세**: 내부 엔티티에서 "user id"는 UUID 형식의 우리 시스템 식별자를 뜻하지만, `cafe24_operator_id`는 Cafe24 측에서 발급한 문자열 식별자다. target Rationale에서 "내부 User.id UUID와의 혼동 회피 위해 별도 명명"이라고 이미 설명되어 있어 spec 레벨에서 의도적 분리다.
- **제안**: 구현 코드에서 `credentials.cafe24_operator_id`를 역직렬화할 때 타입을 `string`(not UUID)으로 명확히 타이핑하여 내부 User UUID와 혼용하지 않도록 한다. spec 변경 불필요.

---

### [INFO] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (409) — 기존 `INTEGRATION_IN_USE` (409)와 HTTP 상태코드 공유

- **target 신규 식별자**: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (409) — 동일 `(workspaceId, mall_id)` cafe24 Integration 이미 존재 시. target §9.4
- **기존 사용처**: `spec/2-navigation/4-integration.md` §9.4 — `INTEGRATION_IN_USE` (409) (삭제 차단). `spec/conventions/swagger.md` §2-4 — 중복/충돌은 409 사용 컨벤션
- **상세**: 두 코드 모두 HTTP 409를 사용하지만 에러 코드 문자열이 달라 클라이언트가 code 필드로 구분할 수 있다. 충돌 없음. swagger 컨벤션과도 일관성이 있다.
- **제안**: 에러 코드 구분이 이미 명확하므로 추가 조치 불필요. 확인 사항.

---

## 요약

`spec/2-navigation/4-integration.md`는 Cafe24 App URL 흐름(`/api/3rd-party/cafe24/install/:installToken`), `install_token` 형식 단축(64자 hex → 22자 base64url), `pending_install` 상태 전이 개정, `oauth/begin` Private 앱 응답 형식 등을 포함하는 통합 관리 화면 spec이다. 신규 식별자 대부분은 기존 코퍼스에서 다른 의미로 사용 중인 경우가 없으며, 잠재적 혼동 지점은 (1) 소셜 로그인 콜백과 통합 OAuth 콜백의 경로 패턴 유사성, (2) Cafe24 `application` Resource 메타데이터와 `credentials.app_type`의 "application" 용어 중복, (3) `status_reason='oauth_token_exchange_failed'`와 auth-flow의 `token_exchange_failed` URL param 유사도 세 가지다. 세 항목 모두 spec 내부에서 이미 의도적 분리가 명시되어 있어 CRITICAL 충돌은 없다. 구현 단계에서 혼동을 방지하기 위한 코드 주석·타이핑 강화를 권장한다.

---

## 위험도

LOW
