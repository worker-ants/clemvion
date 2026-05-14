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

### Phase 2 — 구현 (developer)

- [ ] `consistency-checker --impl-prep` 사전 호출
- [ ] 백엔드
  - [ ] 신규 `Cafe24OauthController` (또는 `Cafe24ThirdPartyController`) — prefix `'3rd-party/cafe24'`, `install/:installToken` + `callback`
  - [ ] 신규 `GoogleOauthController` — `'3rd-party/google'`, `callback`
  - [ ] 신규 `GithubOauthController` — `'3rd-party/github'`, `callback`
  - [ ] 또는 단일 `ThirdPartyOauthController` (`'3rd-party/:provider'`) 로 `:provider` 파라메트릭 유지 — 둘 중 선택은 구현 시 결정
  - [ ] 토큰 발급: `randomBytes(16).toString('base64url')`
  - [ ] `INSTALL_TOKEN_PATTERN` 정규식 변경: `/^[A-Za-z0-9_-]{22}$/`
  - [ ] `appUrl` 생성 로직: `${appUrl}/api/3rd-party/cafe24/install/${installToken}`
  - [ ] `redirectUri` 생성 로직: `${appUrl}/api/3rd-party/${service.oauthProvider}/callback`
  - [ ] 옛 `@Get('oauth/install/cafe24/:installToken')`, `@Get('oauth/callback/:provider')` 핸들러 삭제 (IntegrationsController 에서 제거)
  - [ ] swagger 갱신 (`@ApiOperation`, `@ApiResponse`)
- [ ] 프론트엔드
  - [ ] `Cafe24PrivatePendingStep` i18n 안내문: 토큰 변경 영향 (자동 반영되지만 안내문 명시: "Cafe24 Developers App URL 입력란에 아래 URL 전체를 그대로 붙여넣으세요. 100자를 넘지 않습니다." 정도)
  - [ ] (해당되면) e2e 테스트의 URL fixture 갱신
- [ ] 테스트
  - [ ] 단위: 토큰 정규식, appUrl 생성, redirectUri 생성
  - [ ] 통합: 새 라우트 200/302/404/403, 옛 라우트 404 (라우트 미존재) 확인
  - [ ] e2e: Cafe24 private 흐름 (가능하면)
- [ ] OAuth 콘솔 재등록 (운영 작업 — 배포 시 동시 진행)
  - [ ] Google Cloud Console — Redirect URI 추가
  - [ ] GitHub OAuth App — Redirect URI 추가
  - [ ] Cafe24 Developers — 테스트 시 새 URL 등록

### Phase 3 — 리뷰 + PR (developer)

- [ ] `/ai-review` 다관점 코드 리뷰 실행
- [ ] `review/<timestamp>/RESOLUTION.md` 작성
- [ ] 본 plan 의 모든 체크박스 완료 확인 → `git mv plan/in-progress/cafe24-app-url-3rdparty-shorten.md plan/complete/`
- [ ] PR 생성

## 결정 보류 / 추가 검토

- **Phase 2 컨트롤러 구조** — 신규 컨트롤러 3개 vs 단일 `ThirdPartyOauthController(:provider)` 1개. 현 코드의 `:provider` 파라메트릭을 유지하는 후자가 변경량 최소이나, provider-grouped 의 장점을 살리려면 전자. 구현 시 코드 양 비교 후 결정.
- **swagger Tags** — `'3rd-party'` 신규 tag 를 만들지, 기존 `'integrations'` 에 흡수할지.
- **Frontend appUrl 라벨/안내문** — 100자 한도 안내문구를 i18n 에 추가. 카피라이팅은 구현 시 작성.
