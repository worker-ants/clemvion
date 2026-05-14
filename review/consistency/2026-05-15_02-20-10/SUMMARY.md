# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

---

## 전체 위험도

**MEDIUM** — Critical 없음. WARNING 8건 중 naming_collision 3건(service 레이어 3곳 + MDX 6곳 하드코딩)은 신규 라우트 추가와 **반드시 동시** 처리해야 하며, 누락 시 기존 OAuth 흐름(Google·GitHub 포함) 전체가 무효 URL을 생성함.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | Cross-Spec | `§9.2` API 표 경로 오타 — `:provider` 앞 `/` 누락 (`/api/3rd-party:provider/callback`) | `spec/2-navigation/4-integration.md` Line 667 | 동일 문서 §3.2·§10.1·§10.2 (정확히 표기됨) | Line 667 을 `/api/3rd-party/:provider/callback` 으로 수정 |
| 2 | Cross-Spec | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 설명이 SQL UNIQUE 실제 범위와 불일치 — public app 연결 상태에서 동일 `mall_id` 로 private 등록 시에도 같은 에러가 발화하지만 description 은 `private` 한정으로 기술 | `§9.4` 에러 코드 목록·`§9.2` oauth/begin 설명 | `spec/1-data-model.md §3` UNIQUE 인덱스: `(workspace_id, mall_id) WHERE service_type='cafe24'` (app_type 무관) | description 을 "동일 `(workspaceId, mall_id)` 에 cafe24 Integration 이 이미 존재(`public`/`private` 무관)" 로 수정하거나 에러 코드명을 `CAFE24_MALL_ALREADY_CONNECTED` 로 변경. §9.2 본문도 동시 갱신 |
| 3 | Convention Compliance | `§10.1` 내 "본 PR" 역사 참조 — spec 최종 상태 기술 원칙 위반 | `spec/2-navigation/4-integration.md §10.1` 엔드포인트 주석 | CLAUDE.md §프로젝트 스펙 문서 ("history 가 아닌 latest 에 대한 기술") | 괄호 주석을 현재 상태 서술("Google Cloud Console / GitHub OAuth App 에는 두 redirect URI 가 모두 등록되어 있어야 한다")로 교체 |
| 4 | Naming Collision | `redirectUri` 하드코딩 3곳 — 신규 경로 미반영 시 Google·GitHub OAuth 포함 **전체 OAuth callback 이 무효 URL 생성** | `integration-oauth.service.ts` lines 322, 785, 1049 | `spec/2-navigation/4-integration.md §10.1` 신규 경로 | line 322·785 를 `` `${appUrl}/api/3rd-party/${provider}/callback` `` 으로, line 1049 를 `` `${appUrl}/api/3rd-party/cafe24/callback` `` 으로 교체 |
| 5 | Naming Collision | `createPrivatePendingIntegration` 반환값 (`appUrl`·`callbackUrl`) 에 옛 경로 하드코딩 — 사용자에게 "Cafe24 Developers 등록용 URL" 로 잘못된 경로 표시 | `integration-oauth.service.ts` lines 962–963 | `spec/2-navigation/4-integration.md §3.2` Private 설치 5번 항 신규 경로 | 두 값을 신규 경로(`/api/3rd-party/cafe24/install/:installToken`, `/api/3rd-party/cafe24/callback`)로 교체 |
| 6 | Naming Collision | 사용자 매뉴얼 MDX 2종 6곳에 옛 경로 노출 — 매뉴얼 참고 사용자가 Cafe24 Developers에 옛 경로(404)를 직접 입력하게 됨 | `frontend/src/content/docs/06-integrations-and-config/cafe24.mdx` lines 38–39·151, `cafe24.en.mdx` lines 38–39·150·168 | `spec/2-navigation/4-integration.md §3.2` 신규 경로 | App URL 안내를 `/api/3rd-party/cafe24/install/<22자 토큰>` 로, Redirect URI 를 `/api/3rd-party/cafe24/callback` 으로 교체. Phase 2 구현과 동시 처리 필수 |
| 7 | Plan Coherence | `§13` 데이터 모델 영향 요약에 신규 필드 3종 누락 (`install_token`, `install_token_issued_at`, `mall_id`) — Phase 2 독자에게 `install_token` 의 존재 자체가 보이지 않는 상태 | `spec/2-navigation/4-integration.md §13` (lines 840–843) | `cafe24-pending-polish-followup.md` Group F (미해결 체크박스) | Phase 2 scope 에 §13 갱신 명시. `cafe24-app-url-3rdparty-shorten.md` 체크리스트에 항목 추가, `cafe24-pending-polish-followup.md` Group F 체크박스 완료 처리 |
| 8 | Plan Coherence | PR #18 (`cafe24-pending-polish-7fdb7e`) 미merge 상태에서 `Cafe24PrivatePendingStep` 동시 편집 시 merge conflict 가능 | `cafe24-app-url-3rdparty-shorten.md` Phase 2 — "i18n 안내문 '100자를 넘지 않습니다.' 명시" | `cafe24-pending-polish.md` 변경 1 (미체크), PR #18 | Phase 2 착수 전 PR #18 merge 여부 확인. 미merge 상태라면 편집 범위 확인 후 직렬화 계획을 plan 에 명시 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | install_token "path-format mismatch" 표현 — ① 라우트 레벨 포맷 검증 vs ② DB lookup miss 두 가지로 해석 가능 | `spec/2-navigation/4-integration.md` Rationale §"CAFE24_INSTALL_INVALID_TOKEN(404)" | 구현 시 DB lookup miss(no-match → 404)로 충분함을 plan 코멘트로 명시. 별도 regex guard 불필요 |
| 2 | Rationale Continuity | TTL 스캐너 `COALESCE(install_token_issued_at, created_at)` 패턴이 Rationale 에만 있고 spec 본문 스캐너 쿼리 섹션에 미반영 — 구현자가 Rationale 를 끝까지 읽지 않으면 레거시 행이 스캐너 바깥으로 빠질 위험 | `spec/2-navigation/4-integration.md` Rationale §"install_token TTL 24h" | 구현 체크리스트에 COALESCE 반영 여부 항목 추가. 착수 전 spec 본문 스캐너 쿼리 섹션 재확인 |
| 3 | Cross-Spec | `spec/1-data-model.md §3` 인덱스 표 표기 오타 — `/3rd-party/cafe24/install:installToken` (`:installToken` 앞 `/` 누락) | `spec/1-data-model.md` Line 645 | `/3rd-party/cafe24/install/:installToken` 으로 수정 |
| 4 | Cross-Spec | `spec/data-flow/integration.md` 시퀀스 다이어그램 — `/api/` prefix 생략 표기 | Lines 75, 80 | full path 로 통일하거나 파일 상단에 "경로는 `/api/` prefix 생략" 주석 추가 |
| 5 | Cross-Spec | `§4.3` rotate API 경로 오타 — `POST /api/integrations:id/rotate` (`:id` 앞 `/` 누락) | `spec/2-navigation/4-integration.md` Line 256 | `POST /api/integrations/:id/rotate` 로 수정 |
| 6 | Convention Compliance | `INTEGRATION_TEST_FAILED (422)` — swagger 컨벤션 표에 422 미포함 | `§9.4` 에러 코드 목록 | 400 으로 변경하거나, 422 채택 배경을 Rationale 에 추가하고 `spec/conventions/swagger.md` 표 갱신 |
| 7 | Naming Collision | `INSTALL_TOKEN_PATTERN` 상수 — 현재 hex 64자 패턴, 외부 참조 없음 | `integrations.controller.ts:59` | 정규식 값을 22자 base64url 패턴(`/^[A-Za-z0-9_-]{22}$/`)으로 교체. 상수명 유지 가능 |
| 8 | Naming Collision | 신규 컨트롤러 Swagger `@ApiTags` 미결정 | Phase 2 신규 컨트롤러 | `'Integrations'` 공유 또는 `'Third-Party OAuth'` 신규 태그 중 선택 후 plan 에 기록 |
| 9 | Plan Coherence | Group D swagger (`CAFE24_INSTALL_INVALID_TOKEN(404)` 등) — 구 컨트롤러 삭제 시 신 컨트롤러에 누락 가능 | `cafe24-pending-polish-followup.md` Group D | Phase 2 swagger 체크리스트에 3종 에러코드(`CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_INVALID_HMAC`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`) 신 컨트롤러 명시 포함 |
| 10 | Plan Coherence | §6 mermaid — callback 실패 시 `install_token` 보존(소거 안 됨) 텍스트 미명시 | `spec/2-navigation/4-integration.md §6` | Phase 2 scope 외. `cafe24-pending-polish-followup.md` Group F 처리 시 함께 보완 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 2건: §9.2 경로 오타, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` description 범위 불일치. INFO 3건: 표기 오타들 |
| Rationale Continuity | LOW | INFO 2건: COALESCE 패턴·포맷 검증 구현 해석 여지 — 보안 위협 없음 |
| Convention Compliance | LOW | WARNING 1건: "본 PR" 역사 참조. INFO 1건: 422 상태 코드 |
| Plan Coherence | LOW | WARNING 2건: §13 필드 누락, PR #18 미merge 충돌 가능성. INFO 2건 |
| Naming Collision | **MEDIUM** | WARNING 3건: service 레이어 3곳 + MDX 6곳 하드코딩 — 미처리 시 OAuth 전체 무효화 |

---

## 권장 조치사항

> WARNING 은 구현 착수 전/동시에 처리, INFO 는 Phase 2 이후 별도 처리 가능.

1. **[즉시·spec 수정 — 착수 전]** `spec/2-navigation/4-integration.md §9.2` Line 667 오타 수정: `/api/3rd-party:provider/callback` → `/api/3rd-party/:provider/callback`
2. **[즉시·spec 수정 — 착수 전]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` description 범위 수정 — "app_type 무관" 으로 확장. §9.2 본문 동시 갱신
3. **[즉시·spec 수정 — 착수 전]** `§10.1` "본 PR" 주석 → 현재 상태 서술로 교체
4. **[Phase 2 구현과 동시 필수]** `integration-oauth.service.ts` lines 322·785·1049 — redirectUri 신규 경로로 교체
5. **[Phase 2 구현과 동시 필수]** `integration-oauth.service.ts` lines 962–963 — appUrl·callbackUrl 신규 경로로 교체
6. **[Phase 2 구현과 동시 필수]** `cafe24.mdx` · `cafe24.en.mdx` 6곳 — 옛 경로를 신규 경로로 교체
7. **[Phase 2 착수 전 5분 확인]** PR #18 merge 여부 확인 → 미merge 시 `Cafe24PrivatePendingStep` 편집 직렬화 계획 plan 에 명시
8. **[Phase 2 scope 포함 권장]** `spec/2-navigation/4-integration.md §13` 에 `install_token`·`install_token_issued_at`·`mall_id` 행 추가. `cafe24-pending-polish-followup.md` Group F 체크박스 완료 처리
9. **[구현 체크리스트 항목]** TTL 스캐너 SQL 에 `COALESCE(install_token_issued_at, created_at)` 포함 여부 확인. `INSTALL_TOKEN_PATTERN` 정규식 22자 base64url 로 교체
10. **[Phase 2 이후 별도]** Group D swagger → 신 컨트롤러에 3종 에러코드 `@ApiResponse` 추가 후 `cafe24-pending-polish-followup.md` Group D 완료 처리