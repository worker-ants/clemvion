# Code Review 통합 보고서

## 전체 위험도
**LOW** — 에러 코드 wiring 정리 PR. Critical 발견 없음. Warning 1건(상수 선언 위치), 나머지 전부 INFO.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | `LEGACY_TO_NORMALIZED` 상수가 사용 위치(`failure()` ~L1936) 보다 아래(~L1975)에 선언되어 코드 탐색을 저해함. `RE_TIMED_OUT`, `RE_MEMORY_LIMIT`, `RE_ISOLATE_DISPOSED` 도 동일한 역전 배치. plan W4/INFO 항목에 이미 등록되어 있으나 현재 PR에 반영 안 됨. | `codebase/backend/src/nodes/data/code/code.handler.ts` | `LEGACY_TO_NORMALIZED` 및 `RE_*` 상수를 `CodeHandler` 클래스 선언 이전으로 이동; `classifyCodeNodeError`와 함께 배치하면 논리적 응집성도 향상 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | SSRF 에러 메시지(`SSRF_BLOCKED: hostname "..."`)가 차단 호스트명/IP를 `output.error.message`에 노출 가능. 이번 PR 범위 외, follow-up 목록에 이미 등재됨. | `codebase/backend/src/nodes/integration/http-request/http-safety.ts` | 클라이언트 노출 메시지를 "Request blocked by SSRF policy" 등 일반화; 세부 정보는 구조화 로그에만 기록 |
| 2 | 보안 | `outputDetails.legacyCode`(내부 분류 코드 문자열)가 `output.error.details.legacyCode`로 클라이언트까지 전달될 수 있음. | `codebase/backend/src/nodes/data/code/code.handler.ts` `failure()` | `legacyCode`를 서버 측 로그 전용으로 처리하거나 `process.env.NODE_ENV !== "production"` 조건으로 제한 |
| 3 | 보안 | `statusCode: 0` 및 음수 HTTP 상태 코드가 `extractStatusCode()`에서 유효값으로 통과해 i18n 플레이스홀더에 포함될 수 있음. 테스트에서 의도된 한계로 명시. | `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` `extractStatusCode()` | HTTP 유효 범위 검사(`v >= 100 && v <= 599`) 추가 또는 DTO 레이어에서 범위 강제 |
| 4 | 보안 | redirect 재검증 루프가 `authentication === "integration"` 조건에만 활성화. none/custom에서 3xx 동작이 비대칭적으로 분기됨. | `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` redirect while loop | 인증 방식과 무관하게 재검증 적용하거나, none/custom에서 3xx를 따라가지 않는 동작을 주석으로 명시 |
| 5 | 요구사항 | SSRF redirect 5홉 초과 예외가 `HTTP_BLOCKED` 대신 `HTTP_TRANSPORT_FAILED`로 라우팅됨 (spec §4 step8과 불일치). 선행 D4 변경 기인, 본 PR 책임 없음. | `http-request.handler.ts` L417 / 내부 catch 블록 | 별도 계획으로 리디렉트 초과 오류를 외부 catch 또는 `buildPreflightErrorOutput` 경로로 분리 |
| 6 | 테스트 | `warnSpy.mockRestore()`가 `afterEach` 대신 테스트 본문 인라인 호출. 단언 실패 시 spy 누수로 같은 파일 내 이후 테스트의 Logger.warn 상태 오염 가능. | `execution-failure-classifier.spec.ts` L50-61, L216-231, L327-344 | 각 describe에 `afterEach(() => jest.restoreAllMocks())` 추가 또는 jest.config `restoreMocks: true` 전역 설정 |
| 7 | 테스트 | `CODE_MEMORY_LIMIT`/`HTTP_BLOCKED` 분류 결과(`result.key === "executionFailedInternal"`)가 두 `it.each` 블록에서 중복 검증됨. | `execution-failure-classifier.spec.ts` L175-194, L201-212 | 하위 블록에서 `result.key` 단언 제거 또는 상위 목록에서 두 코드를 제거해 의도 단일화 |
| 8 | 테스트 | `http-request.handler.ts`의 HTTP_BLOCKED 경로 단위 테스트 부재. as const 타입 보장으로 런타임 동작 변화 없어 즉시 필수 아님. | `plan/in-progress/http-ssrf-all-auth-followups.md` 미체크 항목 | 후속 plan 항목으로 none/custom × {IMDS, RFC1918, localhost} 교차 조합 테스트 추가 |
| 9 | 유지보수성 | `classifyCodeNodeError` 반환 타입이 `string`으로 넓게 선언되어 `LEGACY_TO_NORMALIZED` 키 타입 안전성 저해. | `code.handler.ts` `classifyCodeNodeError` 선언부 | 반환 타입을 `'EXECUTION_TIMEOUT' \| 'EXECUTION_MEMORY_EXCEEDED' \| 'CODE_RUNTIME_ERROR'` 유니온으로 좁힘 |
| 10 | 유지보수성 | `http-request.handler.ts` 내 `HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX` 등 나머지 error code literal이 아직 `ErrorCode.*` 참조로 미전환. 파일 내 일관성 부분적. | `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` | 나머지 HTTP error code literal을 `ErrorCode.*`로 일괄 전환하는 후속 plan 항목 추가 |
| 11 | 문서화 | `ALLOW_PRIVATE_HOST_TARGETS=true` (SSRF 가드 opt-out) 환경변수가 코드 주석에만 언급되고 `.env.example` 또는 배포 가이드에 기재 여부 불확실. | `codebase/backend/src/nodes/core/error-codes.ts` L534-536 | `.env.example` 또는 운영 가이드에 기본값(false)·용도·보안 위험 경고 포함하여 기재 |
| 12 | 문서화 | `execution-failure-classifier.ts` 내 "refactor 04 C-3" 참조가 PR 내부 약어로 코드베이스 신규 진입자에게 맥락 불명확. | `execution-failure-classifier.ts` L365-370 | spec 링크(`spec/conventions/chat-channel-adapter.md §3.1`)로 교체 또는 보완 권고 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | SSRF 메시지 호스트 노출(INFO), legacyCode 클라이언트 전달(INFO), statusCode 범위 미검증(INFO). 하드코딩 시크릿·인젝션·인증 우회 없음. |
| requirement | LOW | plan 체크리스트 W1~W4 모두 정합. redirect 5홉 초과 → HTTP_TRANSPORT_FAILED 불일치는 선행 변경 기인(INFO). CRITICAL/WARNING 없음. |
| scope | (파일 없음 — 재시도 필요) | — |
| side_effect | NONE | 런타임 UX 변화 없음. 의도된 변경만. 부작용 없음. |
| maintainability | LOW | LEGACY_TO_NORMALIZED 선언 위치 역전(WARNING), 테스트 spy 중복/누수 패턴(INFO), classifyCodeNodeError 넓은 반환 타입(INFO). |
| testing | LOW | warnSpy afterEach 미격리(INFO), HTTP_BLOCKED 경로 단위 테스트 누락(INFO). 핵심 변경 커버리지 양호. |
| documentation | LOW | ALLOW_PRIVATE_HOST_TARGETS 배포 문서화 불확실(INFO), @internal JSDoc 컴파일 효과 없음(INFO). plan 상태 반영 정확. |

## 발견 없는 에이전트

- **side_effect**: 의도치 않은 전역 상태 변경, 파일시스템 접근, 환경 변수 변경, 네트워크 호출, 이벤트 리스너 변경 없음.

## 권장 조치사항

1. **(WARNING — 이번 PR 또는 즉시 후속)** `LEGACY_TO_NORMALIZED`, `RE_TIMED_OUT`, `RE_MEMORY_LIMIT`, `RE_ISOLATE_DISPOSED` 상수를 `CodeHandler` 클래스 선언 이전으로 이동 (`code.handler.ts` — plan W4 항목과 연계).
2. **(INFO — 즉시 권고)** `execution-failure-classifier.spec.ts`의 `warnSpy` 복원을 `afterEach(() => jest.restoreAllMocks())`로 전환해 단언 실패 시 spy 누수 위험 제거.
3. **(INFO — 후속 plan)** `ALLOW_PRIVATE_HOST_TARGETS` 환경변수를 `.env.example` 및 운영 가이드에 기재 (기본값 false, SSRF 가드 opt-out, 보안 위험 경고 포함).
4. **(INFO — 후속 plan)** `http-request.handler.ts` 내 나머지 HTTP error code literal(`HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX`)을 `ErrorCode.*` 참조로 일괄 전환.
5. **(INFO — 후속 plan)** redirect 5홉 초과 오류를 `HTTP_BLOCKED`로 정확히 분류하도록 외부 catch 분리 (spec §4 step8 정합).
6. **(INFO — 후속)** `classifyCodeNodeError` 반환 타입을 좁은 유니온으로 좁혀 `LEGACY_TO_NORMALIZED` 키 타입 안전성 강화.
7. **(INFO — 후속)** HTTP_BLOCKED SSRF 차단 경로에 대한 `http-request.handler.spec.ts` 단위 테스트 추가 (plan 미체크 항목 연계).

## 라우터 결정

라우터가 reviewer 를 선별함 (`routing_status=done`).

- **실행 (강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명 — 전부 `router_safety` 강제 포함)
- **제외**: 7명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | router 에 의해 생략 |
| architecture | router 에 의해 생략 |
| dependency | router 에 의해 생략 |
| database | router 에 의해 생략 |
| concurrency | router 에 의해 생략 |
| api_contract | router 에 의해 생략 |
| user_guide_sync | router 에 의해 생략 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)

---

> 재시도 필요: `scope` reviewer output_file 부재 (1건).