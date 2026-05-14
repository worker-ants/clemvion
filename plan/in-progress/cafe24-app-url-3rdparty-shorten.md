---
worktree: cafe24-3rdparty-url-503aa0
started: 2026-05-15
owner: developer
---

# Cafe24 App URL 100자 한도 — `/api/3rd-party/<provider>/` namespace + 토큰 단축

## 배경

Cafe24 Developers 의 **App URL** 입력 필드에 100자 제한이 있는데, 현행 install URL 이 한도 초과로 등록 자체가 불가능했다.

- 현재: `https://<host>/api/integrations/oauth/install/cafe24/<64-hex>` — 호스트 32자 가정 135자.
- 사용자 보고 (2026-05-15): "토큰 없이 등록된 상태였고, 정상 url 을 등록하려고 시도하니까 App URL 에서 허용 길이를 초과했다는 오류가 나와. 수동으로 테스트해보니 100자 제한으로 확인되는데, 우리 도메인이 변동될 수 있으니 90자 정도가 마지노선일것 같아."

## 결정 (사용자 합의)

| 항목 | 결정 |
| --- | --- |
| URL 구조 | `/api/3rd-party/<provider>/...` (provider-grouped) |
| Cafe24 install | `/api/3rd-party/cafe24/install/:token` |
| Callbacks (3종) | `/api/3rd-party/cafe24/callback`, `/api/3rd-party/google/callback`, `/api/3rd-party/github/callback` |
| 토큰 | `randomBytes(16).toString('base64url')` (22자, 128-bit) |
| 검증 정규식 | `/^[A-Za-z0-9_-]{22}$/` |
| 옛 경로 | 즉시 제거 (`/api/integrations/oauth/{install,callback}/...` 핸들러 삭제) |
| 기존 `pending_install` 행 | 마이그레이션 생략 (대부분 등록 자체 실패 상태이고 영향 없음) |

길이 검증 (호스트 32자 가정):

- Install: `https://workflow-api.getit.co.kr/api/3rd-party/cafe24/install/<22>` = **85자** ≤ 90 ✓
- Callback: `.../api/3rd-party/cafe24/callback` = 62자 ✓

호스트가 약 40자까지 확장되어도 90자 마지노선 유지.

## Phase

### Phase 1 — Spec 개정 (project-planner) — **완료 (2026-05-15)**

- [x] `consistency-checker --spec` 사전 호출 — `review/consistency/2026-05-15_02-07-22/` (Critical 0, Warning 7건 모두 draft 에 반영)
- [x] `spec/1-data-model.md`
  - [x] line 253 `install_token` 설명: "32바이트 hex" → "16바이트 base64url (no padding, 22자)"
  - [x] line 645 인덱스 주석의 라우트 경로 갱신 (`/oauth/install/cafe24/:installToken` → `/3rd-party/cafe24/install/:installToken`)
  - [x] Rationale 말미에 "install_token 형식 (32byte hex → 16byte base64url, 2026-05-15)" entry 추가
  - **V047 마이그레이션 entry 추가 안 함** — DB schema 무변경 (`install_token` 컬럼이 `String?`, 길이 제약 없음). spec 의 마이그레이션 표는 schema 변경 시점만 기록하는 컨벤션. application-level format 만 변경되었으므로 Rationale 만으로 충분.
- [x] `spec/2-navigation/4-integration.md`
  - [x] §9.2 표의 install/callback 경로 새 namespace 로 갱신 — callback 은 파라메트릭 단일 형식 `/api/3rd-party/:provider/callback` 사용
  - [x] §10.1 callback 엔드포인트 박스 새 path + social-login 구분 노트 추가
  - [x] Public/Private 본문의 라우트 표기 갱신 (line 136, 158, 177, 183, 186)
  - [x] Rationale 신규 entry "Cafe24 App URL 100자 한도 대응 — `/api/3rd-party/<provider>/` namespace 도입 (2026-05-15)" 추가
  - [x] 기존 Rationale 2 항 갱신: "install_token 을 App URL path 식별 키로 승격" + "CAFE24_INSTALL_INVALID_TOKEN(404) 보안 전제"
- [x] `spec/4-nodes/4-integration/4-cafe24.md`
  - [x] step 3 URL 갱신
  - [x] 본문 내 "2026-05-14 개정" blockquote 제거 (CLAUDE.md "spec 은 latest state 만" 원칙 — Warning #4)
  - [x] §10 CHANGELOG 에 "2026-05-15" 라인 추가 (history 표 → 옛 경로 표기 유지)
- [x] `spec/data-flow/integration.md` mermaid 다이어그램의 path · token 생성 라인 갱신
- **`spec/conventions/` 신규 룰 추가 안 함** — `/api/3rd-party/<provider>/` 는 현재 cafe24·google·github 3 provider 의 OAuth callback + cafe24 install 만 사용. 동일 prefix 의 endpoint 가 4개 이상으로 늘거나 다른 모듈이 재사용을 시작하면 그 시점에 `spec/conventions/routing-namespaces.md` 신규 생성으로 승격. 현시점 단일 진실은 `spec/2-navigation/4-integration.md` Rationale entry.

### Phase 2 — 구현 (developer) — **완료 (2026-05-15)**

- [x] `consistency-checker --impl-prep` 사전 호출 — `review/consistency/2026-05-15_02-20-10/` (Critical 0, Warning 8건 spec 보완·구현·ai-review 단계에서 모두 처리)
- [x] 백엔드
  - [x] 신규 `ThirdPartyOAuthController` (단일 파라메트릭 컨트롤러) — `@Controller('3rd-party')`, `cafe24/install/:installToken` + `:provider/callback`. provider 별 분리 컨트롤러 3개 안은 코드 양 대비 이점 없어 폐기.
  - [x] 토큰 발급: `randomBytes(INSTALL_TOKEN_BYTES).toString('base64url')` (공통 상수 사용)
  - [x] `INSTALL_TOKEN_PATTERN` 정규식: `/^[A-Za-z0-9_-]{22}$/` — `third-party-oauth.constants.ts` 공유 상수
  - [x] `buildCafe24InstallUrl` / `buildOauthCallbackUrl` 헬퍼로 URL 조립 3곳 통합 (DRY)
  - [x] 옛 `@Get('oauth/install/cafe24/:installToken')`, `@Get('oauth/callback/:provider')` 핸들러 삭제
  - [x] swagger `@ApiTags('Third-Party OAuth')` + `@ApiOperation`/`@ApiResponse` 갱신
  - [x] callback 에 throttle 60 req/min 추가
- [x] 프론트엔드
  - [x] i18n `cafe24PrivatePendingSteps` 안내문 갱신 (ko/en) — "전체 복사" 강조, 22자 토큰 명시
  - [x] MDX 사용자 매뉴얼 (cafe24.mdx, cafe24.en.mdx) 의 App URL/Redirect URI 6곳 갱신
- [x] 테스트
  - [x] 단위: 토큰 정규식 (21/22/23/64자 케이스), MISSING_PARAMS (mall_id/timestamp/hmac 각각), 서비스 예외 status 전파 (403/404), unsupported provider 400, FRONTEND_URL/APP_URL fallback, appUrl 정규식 매치
  - [ ] e2e: Cafe24 private 흐름 — 본 PR 범위 외 (followup `cafe24-pending-polish-followup.md` E)
- [ ] **OAuth 콘솔 재등록 (운영 작업 — 배포 직전 ⚠️ 필수)**
  - [ ] **Google Cloud Console**: `https://<host>/api/3rd-party/google/callback` 을 Authorized redirect URIs 에 **추가** (옛 `/api/integrations/oauth/callback/google` 은 롤백 보호를 위해 삭제하지 말고 한동안 병행 유지)
  - [ ] **GitHub OAuth App**: `https://<host>/api/3rd-party/github/callback` 을 Authorization callback URL 에 추가
  - [ ] **Cafe24 Developers (운영 등록자 대상 안내)**: 기존 Private 앱 등록자에게 "앱 URL / Redirect URI 재등록 필요" 안내 발송 (sales/docs 채널). 신규 등록자는 통합 화면에서 새 URL 만 발급받으므로 별도 작업 없음.
  - [ ] **배포 순서 보장**: ① OAuth 콘솔 등록 완료 → ② 백엔드 배포. 순서가 어긋나면 모든 신규 OAuth 가 `redirect_uri_mismatch` 로 실패함.

### Phase 3 — 리뷰 + PR (developer) — **진행 중**

- [x] `/ai-review` 다관점 코드 리뷰 실행 — `review/2026-05-15_02-43-55/` (Critical 1, Warning 17, Info 14)
- [x] `review/<timestamp>/RESOLUTION.md` 작성
- [ ] 본 plan 의 모든 체크박스 완료 확인 → `git mv plan/in-progress/cafe24-app-url-3rdparty-shorten.md plan/complete/` (OAuth 콘솔 재등록은 배포 직전 운영 작업이라 PR 시점에는 미체크로 둔다 — PR description 의 "배포 체크리스트" 에 포함)
- [ ] PR 생성

## 결정 (closed)

- **컨트롤러 구조** — 단일 `ThirdPartyOAuthController(:provider)` 채택. provider 분리 컨트롤러 3개 안은 callback 처리 흐름이 동일해 코드 양 대비 이점 없음.
- **swagger Tags** — `'Third-Party OAuth'` 신규 tag 채택. 기존 `'Integrations'` 와 분리해 user-facing CRUD vs 3rd-party-facing endpoints 의 분류 명확화.
- **Frontend i18n** — markdown 렌더링이 없는 문자열이라 bold(`**...**`) 구문 제거, 평문 강조로 대체.
