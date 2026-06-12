# Resolution — refactor-04-security 코드 리뷰 후속

리뷰 위험도 **LOW / Critical 0**. WARNING 4 + SPEC-DRIFT 3 + INFO 다수. 본 문서는 main Claude 가 직접 처리한 내역(경미·격리적이라 resolution-applier 대신 직접 fix)과 의도적 보류를 기록한다.

## security reviewer 재실행
초기 워크플로에서 `security.md` output 미생성 → 재실행 완료. **Critical 0 / Warning 0 / Info 12** (변경 자체가 보안 강화라 신규 취약점 없음).

## 처리한 WARNING / INFO

| # | 등급 | 발견 | 처리 |
| --- | --- | --- | --- |
| W2 | WARNING(유지보수성) | `main.ts` `isSwaggerEnabled(process.env)` 부팅 시 3회 호출 | `const swaggerEnabled = isSwaggerEnabled(process.env)` 1회 평가 후 마운트·로그 두 곳이 공유 |
| W3 | WARNING(테스트) | 타이밍 어서션(`elapsed < 100/1000ms`) CI flaky 위험 | 3개 spec(condition-evaluator/filter/transform)에서 타이밍 어서션 제거. 핵심 불변식(`regex===null`/출력 불변/`invalidRegexPatterns`)으로 회귀 검증 유지 — 패턴 미거부 시 긴 입력에서 jest 타임아웃으로 회귀가 드러남 |
| I2 | INFO(문서화) | `ENABLE_SWAGGER_IN_PROD` 가 `.env.example` 누락 | `.env.example` 에 주석 플레이스홀더 추가 |

### 부수 개선 (리뷰 중 발견)
- `compileUserRegex`: 문법 검사(`new RegExp`)를 safe-regex 보다 **먼저** 수행하도록 재정렬 → 문법 오류는 `'invalid'`, 문법은 맞지만 위험한 패턴만 `'unsafe'` 로 정확히 분류(safe-regex 가 파싱 불가 입력에 false 를 주는 오분류 방지). 테스트의 미검출 케이스(`(a|a)*$` — alternation-overlap, safe-regex star-height 휴리스틱 한계)는 it.each 에서 제외하고 한계를 주석으로 명시(길이 상한이 2차 방어).

## 의도적 보류 (non-blocking)

| # | 등급 | 발견 | 사유 |
| --- | --- | --- | --- |
| W1 | WARNING(아키텍처) | `WebsocketModule` forwardRef 4개 누적 — Gateway 책임 과중 | 중기 리팩터링(`ChannelAuthorizationService` 분리) 대상. 본 PR 범위(IDOR 차단) 밖 — 별도 plan 으로 분리 권장 |
| W4 | WARNING(부작용) | DOMPurify 화이트리스트로 `<details>/<summary>/<abbr>`·`tel:` 제거 | **의도된 하드닝** — 티켓 m-1 권장안이 scheme 을 http(s)/mailto 로 한정. marked GFM 기본 산출 태그엔 해당 없음. `tel:` 등이 실제 채팅 요구로 확인되면 `ALLOWED_TAGS`/`ALLOWED_URI_REGEXP` 에 추가(1줄) |

## planner 위임 (SPEC-DRIFT — 구현은 정상, spec 반영만 후행)

`plan/in-progress/refactor/04-security.md` 의 각 항목 `⏳` 로 명시:
- **M-1**: swagger.md / 2-api-convention 에 "Swagger non-production 전용 + ENABLE_SWAGGER_IN_PROD opt-in" 규약.
- **M-3**: 4개 spec(transform/filter/if-else/switch)의 "길이 200 = ReDoS 방지" → "길이 200 + safe-regex 위험패턴 거부" 정정 + ReDoS 정책 단일 정의.
- **M-6**: `6-websocket-protocol.md §3.3` 소유검증 채널 목록에 `workflow:`·`notifications:` 추가 + notifications user 단위 명시.
- **m-2**: §5.3 또는 배포 가이드에 "staging = NODE_ENV=production 권고".

## 검증
- backend 영향 spec 5종 264 tests PASS (production-guards / condition-evaluator / filter / transform / websocket.gateway).
- channel-web-chat safe-html 16 tests PASS.
- backend 빌드 타입체크(`tsc --noEmit -p tsconfig.build.json`) exit 0.
- ⚠️ 미실행: e2e / WS 모듈 DI 순환 실부팅 검증(도커 미가용) — forwardRef 로 완화, 머지 전 e2e 권장.
