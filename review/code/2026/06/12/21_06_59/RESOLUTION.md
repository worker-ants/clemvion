# Resolution — 3차 리뷰 (최종 상태: 코드 + spec drift 정정)

위험도 **MEDIUM / Critical 0**. WARNING 7. 보안 핵심(ReDoS chokepoint·IDOR 채널·CSRF·DOMPurify·prod fail-closed)은 전부 **긍정 확인**(I1~I6). 본 라운드 이후 **codebase/ 미수정**(리뷰 유효성 유지) — 처리는 spec-only(W7) + 문서/보류로 한정.

## 처리

| # | 등급 | 발견 | 처리 |
| --- | --- | --- | --- |
| W7 | WARNING(SPEC-DRIFT) | `switch.md §3` compileRegexCache 설명에 safe-regex 거부 미기재 | **수정** — `2-switch.md §3` 에 safe-regex 위험 패턴 거부 + if-else §6 동일 정책 명시 (spec-only, 코드 무변경) |

## 보류 (정당화) — codebase/ 수정 회피(리뷰 유효성 유지) + 범위/위험 판단

| # | 등급 | 발견 | 사유 |
| --- | --- | --- | --- |
| W1 | WARNING(보안) | WS `jwt.config` fallback `'fallback'` 이 `INSECURE_JWT_SECRETS` 미포함 | **기존 이슈·본 PR 범위 밖**(1·2차 리뷰도 I2 로 동일 판정). **production 실위험 ~0**: `assertProductionConfig` 가 `JWT_SECRET` 미설정/약함을 부팅 거부하므로 prod 에서 `?? 'fallback'` 경로 자체가 도달 불가(boot 이미 실패). 별도 hardening 항목으로 분리 권고(`'fallback'`→`'dev-jwt-secret'` 통일 1줄) |
| W2/I9 | WARNING/INFO(테스트) | 소켓 캐스팅 `EnrichedSocket` 미통일 + notifications userId 미설정 케이스 | 테스트 품질 개선 — 동작 정확성엔 영향 없음. codebase 수정 시 본 리뷰 무효화 → 차기 |
| W3 | WARNING(테스트) | controller-level null-origin CSRF 케이스 부재 | null-origin 거부는 **`cors-origins.spec` 에서 이미 검증**(2케이스). controller 레벨은 중복 — 차기 |
| W4 | WARNING(테스트) | `clearRefreshTokenCookie` domain 케이스 부재 | 경미 — 차기 |
| W5/I8 | WARNING/INFO(부작용) | DOMPurify 태그 제거 / COOKIE_PATH 잔존 | **의도된 하드닝/breaking** — PR 본문·릴리스 노트 명시. 스냅샷/전환기 dual-clear 는 차기 |
| W6/I14 | WARNING/INFO(부작용) | `extractClientIp` 의 `process.env` 암묵 의존 | 테스트가 env 주입/복원으로 통제. 시그니처 확장은 호출부 다수 변경 — 비용 대비 보류 |
| I7 | INFO(보안) | `buildContinuationErrorAck` 가 임의 Error.message 전달 | **기존 코드, 본 변경 무관** — 별도 항목 |
| I12/I13 | INFO(문서) | JSDoc 보강 | 차기 점진 개선 |

> I16: 2차 리뷰가 WARNING 으로 본 `clearRefreshTokenCookie` 경고 주석·`safeRegex` try/catch 는 **실제로는 이미 구현돼 있었다**(2차 분석 부정확). 본 라운드에서 정정 확인 — 현상 유지.

## 검증
- 3차 리뷰가 **현재 codebase(commit 1aa52b54) 전체를 커버** — Critical 0. 본 라운드 이후 codebase/ 무수정.
- W7 수정은 spec-only(`switch.md`) — code 리뷰 유효성 유지.
- 앞선 검증 누적: backend 2982 unit + 본 라운드 변경분 + web-chat 16 + frontend build-guard 573 PASS, 빌드 타입체크 exit 0.
- ⚠️ e2e / WS DI 실부팅: 도커 미가용 미실행(forwardRef 완화) — 머지 전 권장.
