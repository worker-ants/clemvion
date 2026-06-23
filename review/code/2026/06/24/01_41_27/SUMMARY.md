# Code Review 통합 보고서 (embed-config spec 보강 + 콘솔 e2e, 커밋 e914edfd)

router: documentation·testing·security 등 7 reviewer(코드+spec 변경 강제). **Critical 0, WARNING 2, INFO 11.**

## Critical
없음.

## WARNING — 처분 (둘 다 embed-config **기존 동작**의 spec 정밀도)
| # | 발견 | 처분 |
|---|---|---|
| 1 | Security | embed-config 공개 엔드포인트 — 비존재 path 처리·cache 정책 spec 미명시(allowlist 노출·enumeration 우려) | **fix(spec)** — 4-security §3 에 비존재/오류 시 allow-all degrade(기존 `EmbedConfigService` 동작) + 공개·캐시 성격 명시 |
| 2 | Security | host origin 미탐지(ancestorOrigins/referrer 모두 불가) 시 동작 미명시 | **fix(spec)** — 4-security §3-① 에 fail-open(통과) 명시(기존 `use-widget.ts` 동작) |

## INFO — 처분
| # | 발견 | 처분 |
|---|---|---|
| 5 | 3-auth-session step 0 들여쓰기 불일치 | **fix** |
| 10 | spec `:path`(3-auth) vs `:endpointPath`(4-security·backend) 비일관 | **fix** — `:endpointPath` 통일 |
| 4 | plan 미해결 섹션에 완료[x] 항목 혼재 | **fix** — 해소 항목 분리 |
| 1·2·3 | e2e 타임아웃/pagination 상수화·testid 셀렉터 | **defer** — 테스트 폴리시(`pre` 셀렉터 동작, testid 는 컴포넌트 변경 동반) |
| 6 | 생성 happy-path(submit→목록 갱신) e2e 미검증 | **defer** — 생성 다이얼로그 진입은 검증, full submit 흐름은 후속 |
| 7 | CreateWebChatDialog 독립 unit | **defer** — page e2e + unit 으로 부분 커버 |
| 8 | mockAuth 헬퍼 중복(workflows/list 와) | **defer** — 공용 헬퍼 추출 후속 |
| 9 | viewer role e2e | **defer** — unit RoleGate 커버 |
| 11 | 테스트 픽스처 자격증명 | 무조치(테스트 전용) |

## 처리
WARNING 2 + I-5·I-10·I-4 fix(spec/plan, 기존 동작 문서화). 테스트 INFO 는 후속 follow-up 으로 기록(비차단).
docker/e2e: frontend playwright e2e 2/2 PASS(`PLAYWRIGHT_NO_WEBSERVER`+dev 서버). backend supertest e2e 는 app 코드 무변경이라 무영향.
