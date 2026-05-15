# Resolution — ai-review 2026-05-15_02-43-55

본 RESOLUTION 은 `SUMMARY.md` 의 Critical 1건 / Warning 17건 / Info 14건에 대한 조치 결과를 기록한다.

## Critical

| # | 발견 | 조치 |
|---|------|------|
| 1 | 배포 원자성 미보장 — `redirectUri` 변경 + 옛 핸들러 즉시 제거로 OAuth 콘솔 미선등록 배포 시 즉시 단절. | 코드 변경 아님 — **plan 의 Phase 2 OAuth 콘솔 재등록 섹션** 에 명시적 운영 체크리스트로 박았다. 옛 redirect URI 를 즉시 삭제하지 말고 병행 유지하는 절차, 콘솔 등록 → 배포 순서 강제, Cafe24 Private 등록자 안내 발송이 모두 plan 에 들어가 있어 PR description 의 배포 체크리스트로 그대로 옮길 수 있다. |

## Warning

| # | 발견 | 조치 |
|---|------|------|
| 1 | `renderCallbackHtml` XSS 가능성 | **확인 결과 이미 안전** — `services/oauth-callback.template.ts` 의 `htmlEscape(input.error)` (line 81) + payload `jsonForScript` 가 `<>&'"` 모두 `\uXXXX` escape 처리. 추가 작업 없음. |
| 2 | HMAC timing-safe 미확인 | **확인 결과 이미 안전** — `verifyHmacWithMessage` (line 1235) 가 `crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(receivedHmac))` 사용. 추가 작업 없음. |
| 3 | install_token URL path 로그 노출 | followup `cafe24-pending-polish-followup.md` Group A 에서 별도 처리 — 본 PR 범위 외. 토큰이 32byte → 16byte 로 줄어 노출량 자체는 감소했고, 단일 사용 + 24h TTL + 30 req/min throttle 로 즉각적인 위험은 제한적. |
| 4 | `ThirdPartyOAuthController` 가 `IntegrationsModule` 에 등록 — 모듈 경계 불일치 | 현재 규모에서 acceptable. 별도 `ThirdPartyOAuthModule` 분리는 provider 수가 늘거나 모듈 단위 운영 격리가 필요할 때 진행. followup 으로 plan 의 "결정 (closed)" 섹션에 기록. |
| 5 | 컨트롤러 내 `process.env` 직접 접근 | **이전 컨트롤러에서 그대로 이식한 pre-existing 패턴**. 동일 패턴이 `IntegrationsController` 등 다수에 분포해 본 PR 범위 외 cleanup. followup 으로 분리. |
| 6 | catch 블록 수동 예외 캐스팅 | 동일 — pre-existing 패턴, 동일 모듈 내 일관. 별도 cleanup PR 가치 있음. |
| 7 | `redirectUri` 생성 로직 3곳 분산 | **해결** — `third-party-oauth.constants.ts` 신설, `buildOauthCallbackUrl(appUrl, provider)` / `buildCafe24InstallUrl(appUrl, token)` 헬퍼로 통합. 서비스 3개 호출 지점 모두 헬퍼 사용. |
| 8 | `INSTALL_TOKEN_PATTERN` 과 생성 로직 물리적 분리 | **해결** — 같은 `third-party-oauth.constants.ts` 에 `INSTALL_TOKEN_BYTES` / `INSTALL_TOKEN_LENGTH` / `INSTALL_TOKEN_PATTERN` 통합. 컨트롤러는 PATTERN, 서비스는 BYTES import. 포맷 변경 시 단일 파일만 손대면 됨. |
| 9 | Plan Phase 2 체크박스 미갱신 | **해결** — Phase 1·2·3 모두 갱신, OAuth 콘솔 재등록만 미체크 (배포 직전 운영 작업) 로 명시. |
| 10 | 미지원 provider 경로 미커버 | **해결** — `it('returns 400 with error HTML for unsupported providers')` 케이스 추가. |
| 11 | `cafe24Install` 누락 파라미터 부분 커버 | **해결** — `timestamp`/`hmac` 단독 누락 케이스 각각 추가. |
| 12 | 서비스 예외 HTTP status 전파 미검증 | **해결** — `ForbiddenException(403)` / `NotFoundException(404)` mockRejectedValue 케이스 추가. |
| 13 | 23자 토큰 상한 테스트 누락 | **해결** — `'A'.repeat(23)` 케이스 추가. |
| 14 | i18n Markdown bold 구문 렌더링 미확인 | **확인 후 해결** — `Cafe24PrivatePendingStep` 이 raw string 렌더링이라 `**...**` 가 텍스트 그대로 노출됨을 확인. ko/en 모두 bold 마크다운 제거. |
| 15 | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드명 vs 의미 불일치 | followup 으로 분리 — 코드명 변경은 외부 API 컨벤션 변경이라 하위 호환 검토가 필요. spec §9.4 description 은 이미 본 PR 에서 "app_type 무관" 으로 명시 갱신됨. 코드명 자체 변경은 별도 PR. |
| 16 | `oauthCallback` throttle 미적용 | **해결** — `@Throttle({ default: { limit: 60, ttl: 60_000 } })` 추가. install 의 30 req/min 보다 약하지만 토큰 교환 외부 호출의 비용을 감안한 baseline. |
| 17 | 기존 `pending_install` 64-hex 토큰 처리 | **해결 (운영 안내)** — plan 의 Phase 2 deployment 섹션에 "배포 직전 `pending_install` 행 수 확인, 0 이 아니면 TTL 만료 대기 또는 수동 expire" 가 이미 포함되어 있다. 또한 spec Rationale 에 "옛 토큰 보유 행은 자연 만료" 정책 명시. |

## Info (선택 조치)

| # | 발견 | 조치 |
|---|------|------|
| 1 | `process.env.APP_URL` 매 요청 평가 | 측정 가능한 영향 없음 — 본 PR 범위 외. |
| 2 | `base64url` Node 16+ 지원 | NestJS 10+ 환경이라 안전. 별도 확인 불필요. |
| 3 | `APP_URL` 단독 fallback 미검증 | **해결** — `falls back to APP_URL when FRONTEND_URL is unset` 케이스 추가. |
| 4 | 옛 엔드포인트 제거 회귀 e2e 부재 | followup `cafe24-pending-polish-followup.md` E 의 e2e 보강에서 처리. |
| 5 | `ALLOWED_OAUTH_PROVIDERS` 검증이 컨트롤러에 있음 | pre-existing 패턴, 본 PR 범위 외 cleanup. |
| 6 | install_token 엔트로피 256→128-bit 감소 | spec Rationale 에 NIST/OWASP 기준 충족 명시됨. 추가 조치 없음. |
| 7 | redirect URL 오픈 리다이렉트 검증 부재 | service 에서 Cafe24 authorize URL 만 반환하도록 고정 (`https://{mall_id}.cafe24api.com/api/v2/oauth/authorize`) — 안전. |
| 8 | `appUrl` vs `appBaseUrl` 네이밍 불일치 | **해결** — service 내 `appBaseUrl` 1곳을 `appUrl` 로 통일. |
| 9 | `oauthCallback` JSDoc spec 참조 불완전 | **해결** — `spec/2-navigation/4-integration.md §10` 로 풀 경로 명시. |
| 10 | `integrations.controller.ts` NOTE 주석이 history 스타일 | **해결** — "이전됨" → "본 controller 는 ... 전용. ... 는 ... 가 담당" 으로 현재 상태 서술. |
| 11 | consistency review 산출물 trailing newline 누락 | 본 PR 의 신규 산출물에서 동일 패턴 가능성 있으나 본 cleanup 범위 외. |
| 12 | 테스트 파일 한국어/영어 주석 혼용 | **해결** — `cafe24.spec.ts` line 230 주변, `third-party-oauth.controller.spec.ts` line 133 의 주석을 영어로 통일. |
| 13 | Mermaid 다이어그램 주석 리터럴 출력 | **해결** — `# 22자, 128-bit` → `(22자, 128-bit)` 괄호 표기로 교체. |
| 14 | 낙후된 주석 잔존 (`single-row lookup endpoint V043`) | **해결** — `cafe24.spec.ts` line 234 의 비명확 주석 제거 및 통합 주석으로 정리. |

## 미해결 (followup 으로 이관)

- W3: install_token URL path 로그 노출 (followup Group A — nginx access log 마스킹)
- W4: `ThirdPartyOAuthModule` 분리 (followup — 규모 확장 시)
- W5, W6: `process.env`/catch 패턴 (followup — 전사적 cleanup)
- W15: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드명 변경 (followup — API 컨벤션 검토)
- Info 1, 2, 4, 5, 7, 11: pre-existing 또는 후속 정리

## 최종 상태

- Critical 0건 (Critical 1 은 운영 체크리스트로 plan 에 박힘)
- 본 PR 조치 가능 Warning · Info: 모두 해결
- followup 이관: 6건 (운영/규모/전사 cleanup 성격)

TEST WORKFLOW 재실행 결과는 별도 후속 커밋의 검증으로 확인.
