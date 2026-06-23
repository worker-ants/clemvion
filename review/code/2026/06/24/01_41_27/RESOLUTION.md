# RESOLUTION — embed-config spec 보강 + 콘솔 e2e 리뷰

대상 SUMMARY: `review/code/2026/06/24/01_41_27/SUMMARY.md` (Critical 0, WARNING 2, INFO 11).

## 조치 항목

| # | 발견 | 조치 |
|---|---|---|
| W-1 | embed-config 공개 엔드포인트 — 비존재 path·cache 정책 spec 미명시 | **fix** — `4-security §3-①` 에 명시: 비존재 endpointPath·DB 오류·인증 webhook 모두 `{allowlist:[], enforce:false}`(HTTP 200) 동일 응답 → enumeration·allowlist 노출 없음; `Cache-Control: public, max-age=300`. (기존 `EmbedConfigService` 동작 문서화) |
| W-2 | host origin 미탐지 시 동작 미명시 | **fix** — `4-security §3-①` 에 "origin 미탐지(ancestorOrigins·referrer 모두 불가) 시 fail-open(통과)" 명시 (기존 `use-widget.ts` 동작) |
| I-4 | plan 미해결 섹션에 완료[x] 혼재 | **fix** — "미해결(genuine backlog)" / "해소된 후속" / "테스트 follow-up" 으로 분리 |
| I-5 | 3-auth-session step 0 들여쓰기 | **dismiss(파일 일관)** — step 0 2nd line 7-space 는 step 2·4 continuation 과 동일 패턴 |
| I-10 | spec `:path` vs `:endpointPath` 비일관 | **dismiss(파일 일관)** — 3-auth-session 은 step 1(기존)부터 `:path` shorthand 사용. step 0 도 `:path` 로 파일 내 일관. `:endpointPath` 로 바꾸면 오히려 intra-file 불일치. cross-file 변이는 선재 |
| I-1·2·3·6·7·8·9 (Testing/Maintainability) | e2e 타임아웃·pagination 상수·testid 셀렉터·생성 happy-path·viewer role·mockAuth 헬퍼·Dialog unit | **defer** — plan "테스트 follow-up" 에 등록(비차단). `pre` 셀렉터 동작, 핵심 흐름은 2/2 검증됨 |
| I-11 | 테스트 픽스처 자격증명 | 무조치(테스트 전용) |

## TEST 결과

- **frontend e2e (playwright)**: 통과 — `e2e/web-chat/console.spec.ts` 2/2 PASS (`PLAYWRIGHT_NO_WEBSERVER=1` + 별도 기동 dev 서버 :3012; chromium v1228 설치). webServer config 의 `npm run dev` 는 pnpm 구조라 next bin 미해석 → `pnpm exec next dev` 로 우회.
- **backend e2e (supertest)**: 무영향 — 본 변경은 spec MD + frontend e2e 테스트뿐, app/backend 런타임 코드 무변경. (직전 풀 e2e 214 PASS 유지)
- **spec 가드**: 통과 (link-integrity·frontmatter·code-paths) — 4-security/3-auth-session 편집 후 재검증.

## 보류·후속 항목
- 테스트 follow-up(생성 happy-path e2e·viewer role·mockAuth 공용 헬퍼·testid·Dialog unit) → plan "테스트 follow-up" 등록, 별도 턴.
