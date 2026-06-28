# RESOLUTION — webhook 인증 1MB 게이트 + 공개 webhook 보호 fix (review 15_00_36)

원 SUMMARY: RISK=MEDIUM, CRITICAL=0, WARNING=7, INFO 다수. (전체 14 reviewer 중 일부가
서버측 rate-limit 으로 미완 — 실행된 reviewer: security·performance·architecture·scope·
side_effect·maintainability·testing.) resolution 후 fresh 검증 통과.

## 조치 항목

| SUMMARY # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| W1 | Performance | W14 캐시 미구현 — Guard·Service 가 trigger 를 2회 조회 | **FIXED**: `HooksController` 가 `req.__publicWebhookTrigger`(Guard 첨부)를 `HooksService.handleWebhook(preloadedTrigger?)` 로 전달, 서비스는 `preloadedTrigger ?? findOne` 으로 단락 — webhook 당 1회 조회로 감소. 가드 쿼리와 동일(full entity)이라 안전. |
| W2 | Side Effect | `rawBody: true` 제거로 `RawBodyRequest` 타입 계약 모호 | **FIXED(명시)**: `main.ts` 에 rawBody 가 `captureRawBody` 로 채워지고 `RawBodyRequest` 소비처가 그대로 동작함을 주석 명문화. 기능 무변(build·e2e J HMAC 통과). |
| W3 | Side Effect | `captureRawBody` 빈 본문(`length===0`) 시 rawBody 미세팅 | **FIXED**: `if (buf)` 로 변경 — 빈 Buffer 도 세팅(빈 본문 서명 검증 보존). |
| W4 | Performance | full entity 로드로 불필요 컬럼 전송 | **유지(의도)**: 보안 정확성을 위해 full load 유지. partial select 재도입은 TypeORM null 버그 재현 검증 후로 deferred(리뷰어도 실측 시 개선 권고). W1 캐시로 webhook 당 1회로 제한. |
| W5 | Architecture/Security | 4xx http-error message 직접 노출 + 미로깅 | **FIXED**: 4xx 경로에 `logger.warn(원본 메시지)` 추가(운영 가시성). 메시지는 body-parser 표준 문자열(무해) 유지, 향후 타 http-errors 추가 시 sanitize 검토는 INFO 로 추적. |
| W6 | Maintainability | `catch` 중첩 깊이 3단 | **FIXED**: `mapHttpErrorLike(exception)` private 헬퍼 + `HttpErrorLike` 타입 추출로 평탄화(INFO22 이중 캐스팅 동시 해소). |
| W7 | Maintainability | e2e J/K/L 알파벳 순서 미정렬 | **조치(주석)**: "본문 크기 경계" 주제 그룹으로 의도적 인접 배치임을 주석 명시(리뷰어 허용 옵션). 신규 M 도 같은 그룹. |
| INFO 2,3 | Security | `HOOKS_MAX_BODY_BYTES` env 상한 없음 | **FIXED**: `HOOKS_MAX_BODY_BYTES_CEILING`(16MB) 클램프. |
| INFO 9,19 | Maintainability | hooks/global 파서 중복 구조 | **FIXED**: `buildBodyParsers(maxBytes)` 공통 팩토리 추출. |
| INFO 13 | Testing | guard full-entity 회귀 가드 단위 미흡 | **FIXED**: `findOne` 이 `select` 없이 호출됨을 단언하는 단위 테스트 추가. |
| INFO 14 | Testing | filter plain-Error-with-status 경로 미검증 | **FIXED**: plain Error(status=413)→413, status≥500→500 마스킹 단위 테스트 추가. |
| INFO 15 | Testing | 인증 webhook 1MB 초과 e2e 없음 | **FIXED**: e2e M(인증 HMAC >1MB → 413 PAYLOAD_TOO_LARGE) 추가. |
| INFO 16 | Documentation | Swagger 에러 코드 목록에 `PAYLOAD_TOO_LARGE` 누락 | **FIXED**: `main.ts` setDescription 목록에 추가. |
| INFO 17 | Side Effect | `/api/hooks` 하드코딩 | **FIXED**: `HOOKS_ROUTE_PREFIX` 상수 export, `main.ts` 가 사용. |
| INFO 20 | Maintainability | `buf && buf.length` 중복 조건 | **FIXED**: W3 와 함께 `if (buf)` 로 단순화. |

## 보류·후속 항목

비차단 INFO 중 의도/후속:

- **INFO 1** (4xx 메시지 sanitize 레이어): 현재 http-error 발행처는 body-parser 뿐(메시지 무해). 향후 http-errors 의존 추가 시 검토 — W5 로깅으로 가시성 확보.
- **INFO 7** (`captureRawBody` 전역 파서 rawBody 복사): 100KB 한도라 영향 제한적, 현행 허용.
- **INFO 21** (`main.ts`↔`hooks-body-parser.ts` JSDoc 중복): 경미, 현행 유지.
- **W4** (partial select 정제): 위 표 참조 — 실측 성능 이슈 시 개선.

## TEST 결과

resolution fix 후 TEST WORKFLOW 전체 재통과:

- lint: 통과 (`lint-20260628-151810`)
- unit: 통과 (`unit-20260628-151850`)
- build: 통과 (`build-20260628-151945`)
- e2e: 통과 — 224 tests (`e2e-20260628-152126`). webhook-trigger J/K/L/M(본문 크기 경계) 포함.
