# RESOLUTION — webhook 1MB 게이트 fix 후속 review (15_24_09)

원 SUMMARY: RISK=LOW, CRITICAL=0, WARNING=3, SPEC-DRIFT 2, INFO 다수. (전체 14 reviewer 완주.)

## 조치 항목

| SUMMARY # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| W1 | Architecture | `PublicWebhookThrottleGuard` SRP 경계(복합 책임)·`extractClientIp` 위치 | **plan 등재(defer)**: 리뷰어도 "단기 허용, 중기 리팩토링" 권고. `spec-sync-webhook-gaps.md` 에 기술부채 후속 항목으로 추적 등재. |
| W2 | Testing | non-webhook 100KB 전역 방어선 e2e 누락 | **FIXED**: e2e N(non-hooks `POST /api/workflows` 100KB 초과 → 413 PAYLOAD_TOO_LARGE) 추가 — 전역 파서 등록 회귀 가드. |
| W3 | Side Effect | `rawBody: true` 제거로 `RawBodyRequest<T>` 타입 계약 모호 | **기능 무영향 확인 + 명문화**: `RawBodyRequest<T> = T & { rawBody?: Buffer }` 는 여전히 유효(파서가 `req.rawBody` 채움) — 타입은 깨지지 않으며 build·e2e J(HMAC) 통과. `main.ts` 주석에 메커니즘 명문화 완료. 소비처 타입 전면 교체는 불필요한 churn 으로 판단, deferred. |
| I1 (SPEC-DRIFT) | Requirement | `HOOKS_MAX_BODY_BYTES_CEILING`(16MiB) spec 미기재 | **FIXED(spec)**: `12-webhook.md WH-NF-02` 에 상한 클램프 명기. |
| I2 (SPEC-DRIFT) | Requirement | `HOOKS_ROUTE_PREFIX` spec 미기재 | **FIXED(spec)**: `12-webhook.md §6` 에 상수 언급. |
| I5 | Security | clamp 시 경고 로그 부재 | **FIXED**: `resolveHooksMaxBodyBytes` 가 상한 초과 시 `Logger.warn`. |
| I8 | Testing | clamp 단위 테스트 부재 | **FIXED**: `hooks-body-parser.spec` 에 ceiling clamp 케이스 추가. |
| I11 | Maintainability | e2e J `100*1024` 매직 넘버 | **FIXED**: `GLOBAL_MAX_BODY_BYTES` import 로 교체. |
| I12 | Documentation | `captureRawBody` 빈 본문 근거 JSDoc | **FIXED(기존)**: JSDoc 에 "body-parser 는 빈 본문에도 verify 호출 → 빈 Buffer 도 세팅" 이미 명시. |

## 보류·후속 항목

- **W1** (Guard SRP·extractClientIp): plan 기술부채 항목으로 추적(위).
- **W3** (RawBodyRequest 타입 소비처 전면 교체): 기능 무영향 — 필요 시 후속.
- **I3/I4** (4xx 메시지 sanitize·fail-open 알람): 현재 위험 낮음, 후속 검토.
- **I6/I7** (full entity 컬럼·전역 rawBody 복사): 실측 시 개선.
- **I9/I10/I13/I14/I15/I16** (captureRawBody export·filter statusCode-only 케이스·JSDoc·frontmatter `code:`·spec-link 타임아웃 커밋 분리): 경미, 현행 유지.

## TEST 결과

- lint: 통과 (`lint-20260628-153612`)
- unit: 통과 (`unit-20260628-153652`)
- build: 통과 (`build-20260628-153747`)
- e2e: 통과 — 225 tests (`e2e-20260628-153927`). 신규 N(non-webhook 100KB 방어선) 포함.
