# Resolution — 2차 리뷰 (M-5/m-3 추가분 포함 전체 diff)

1차 리뷰(`../19_49_22/`) 이후 추가된 M-5(refresh CSRF/SameSite)·m-3(CF-IP 게이트)·null-origin 방어를 포함한 전체 diff 재리뷰. 위험도 **MEDIUM / Critical 0**. WARNING 12 + INFO 17.

## 직접 처리 (이번 커밋)

| # | 등급 | 발견 | 처리 |
| --- | --- | --- | --- |
| W5 | WARNING(문서) | `clearRefreshTokenCookie` path-match 제약 주석 부재 | set/clear path 일치 경고 JSDoc 추가 (`refresh-cookie.ts`) |
| W6 | WARNING(테스트) | `shouldTrustCfConnectingIp` 직접 단위 테스트 부재 | `client-ip.spec.ts` 에 describe 추가(true/1 ON, 그 외 off) |
| W7 | WARNING(유지보수) | notifications authorizer `Promise.resolve` 의도 미문서화 | `channelAuthorizers` 타입 주석에 동기→Promise.resolve 통일 + ctx 의미 명시 |
| W9 | WARNING(유저가이드/문서) | README 신규 env 3종 누락 | `README.md §환경 변수 #Security` 에 `ENABLE_SWAGGER_IN_PROD`·`COOKIE_SAMESITE`·`TRUST_CF_CONNECTING_IP` 추가 |
| I1 | INFO(보안) | `safeRegex()` try/catch 부재 — regexp-tree 예외 전파 가능 | `compileUserRegex` 에서 safeRegex 호출을 try/catch 로 감싸 예외 시 fail-closed(`unsafe`) |

(null-origin CSRF 방어 = 1차 focused security 리뷰 WARNING — `isOriginAllowed` 에 `origin==='null'` 거부 추가, 본 커밋 포함)

## planner 위임 (SPEC-DRIFT — 코드 정상, spec 후행). plan 티켓 `⏳` 표기 + task 추적

| # | 발견 | spec 대상 |
| --- | --- | --- |
| W1 | `workflow:`/`notifications:` authorizer 미반영 | `6-websocket-protocol.md §3.3` |
| W2 | CF-IP 무조건 신뢰로 기술됨 | `1-auth.md §2.3` (TRUST_CF_CONNECTING_IP opt-in) |
| W3 | "길이 200" 만, safe-regex 미기재 | `4-nodes/5-data/1-transform.md` 외 (filter/switch/if-else) |
| W4 | Swagger production 비노출 정책 미기재 | `conventions/swagger.md` or `2-api-convention.md` |
| W10 | refresh 쿠키 path 정책 미기재 | `1-auth.md §2.3` (path `/api/auth`) |
| I5 | null origin 거부 정책 미기재 | (선택) auth/CORS spec |

## 의도적 보류 (non-blocking, 근거)

| # | 발견 | 사유 |
| --- | --- | --- |
| W8 | user-guide `security-2fa.mdx` 미갱신 | 변경(쿠키 path/SameSite/CSRF·env 게이트)은 **배포자 설정**이지 엔드유저 UI 동작이 아님 — 유저 가이드 대상 아님. (배포 가이드/README 로 충족) |
| W11 | `extractClientIp` 의 `process.env` 암묵 의존 | 테스트가 env 주입/복원으로 통제. 시그니처 확장은 호출부 다수 변경 — 비용 대비 효과 낮아 보류 |
| W12 | DOMPurify 태그 제거 스냅샷 테스트 | 태그 제거는 **의도된 하드닝**. 화이트리스트/제거 회귀는 기존 safe-html 테스트로 커버 |
| I2 | WS `'fallback'` JWT secret | **기존 이슈, 본 변경 범위 밖** — 별도 항목 |
| I7 | 기존 `path=/` 쿠키 잔존 | breaking 으로 PR/릴리스 노트 명시. 전환기 dual-clear 는 과한 복잡도 |
| 기타 INFO | JSDoc/테스트 일관성 등 | 점진 개선 — 차기 |

### ⚠️ 후속 주목 (별도 항목 권고)
- **ip_whitelist XFF 스푸핑**(focused 리뷰 + W11/I): `hooks.service.ts` 의 `extractClientIp` 는 XFF 첫 IP 만 쓰고 `req.ip`(trust proxy 보호) 폴백이 없다. **본 PR 의 m-3 변경이 악화시킨 것은 아니나**(CF-spoof 벡터는 오히려 제거), trust-proxy 보호를 받는 공용 `extractClientIp(req)` 로의 통합은 별도 개선 항목으로 권고.

## 검증
- 영향 spec 재실행 + 전체 affected 2982 + 본 라운드 변경분 131 PASS.
- 빌드 타입체크(tsconfig.build) exit 0.
- ⚠️ e2e / WS DI 실부팅: 도커 미가용으로 미실행 (forwardRef 완화) — 머지 전 e2e 권장.
