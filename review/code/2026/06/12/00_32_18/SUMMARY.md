# Code Review 통합 보고서

## 전체 위험도
**LOW** — 에러 코드 wiring 정리 PR로 신규 보안 취약점·기능 결함 없음. 타입 안전성 미완성(WARNING 1건)과 spec 범위 검사 해석 모호성(WARNING 1건)이 존재하나 머지 차단 수준 아님.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 타입 안전성 | `classifyCodeNodeError` 반환 타입이 `string`으로 넓게 선언되어 `LEGACY_TO_NORMALIZED` 키 타입 안전성 강화 효과가 절반만 완성된 상태. 새 분기 추가 시 매핑 누락을 컴파일 타임에 감지 불가. | `codebase/backend/src/nodes/data/code/code.handler.ts` — `classifyCodeNodeError` 선언부 | 반환 타입을 `'EXECUTION_TIMEOUT' \| 'EXECUTION_MEMORY_EXCEEDED' \| 'CODE_RUNTIME_ERROR'` 유니온으로 좁혀 `LEGACY_TO_NORMALIZED` 키와 타입 단계에서 연결 |
| 2 | Spec 정합성 | `extractStatusCode()`가 `Number.isInteger(v)` 만 검사하여 `statusCode: 0`, `statusCode: -200` 등 RFC 비유효값이 통과. `spec/conventions/chat-channel-adapter.md §3.1` 의 `[400,499]`/`[500,599]` 범위 조건 의도와 잠재적 불일치. 테스트(W#4)는 이를 "현재 구현 동작 문서화"로 처리. | `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` — `extractStatusCode()` | spec §3.1 범위 조건 의도를 planner에게 확인 후, 범위 검사가 의도라면 `v >= 100 && v <= 599` 조건 추가; presence만 의미라면 spec 표현 개선 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | SSRF 차단 메시지에 내부 호스트명/IP가 포함될 수 있어 클라이언트로 전달 시 내부 네트워크 정보 노출 가능(OWASP A05). 이번 PR 직접 도입 아님 — 선행 D4 변경 기인, follow-up 항목 기존 등재. | `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — HTTP_BLOCKED 에러 경로 | IntegrationError message를 `"Request blocked by SSRF policy"` 일반화 문자열로 교체, 차단 IP는 서버 측 구조화 로그에만 기록 (`http-ssrf-all-auth-followups.md` 미완 항목에서 처리) |
| 2 | 보안 | `outputDetails.legacyCode`(`'EXECUTION_TIMEOUT'` 등 내부 분류 문자열)가 `output.error.details.legacyCode`로 클라이언트에 노출. 직접적 위협보다 구현 세부 정보 누수(OWASP A05) 성격. | `codebase/backend/src/nodes/data/code/code.handler.ts` — `failure()` 내 `outputDetails` 구성 | 프로덕션에서 `legacyCode`를 서버 로그에만 남기고 클라이언트 응답에서 제외 (`process.env.NODE_ENV !== 'production'` 조건 또는 환경별 필터) |
| 3 | 보안 | redirect 재검증 루프가 `authentication === "integration"` 조건에만 활성화되어 `none`/`custom` 모드에서 3xx 리다이렉트 후 SSRF 재검증이 수행되지 않을 가능성. 선행 refactor 04 C-3 이후 실제 가드 적용 범위 확인 필요. | `http-request.handler.ts` — redirect while loop | 모든 인증 방식에서 3xx 리다이렉트 후 SSRF 재검증 수행하거나, `none`/`custom`에서 3xx 미추적 동작을 코드 주석으로 명시 |
| 4 | 테스트 | `jest.spyOn(Logger.prototype, 'warn').mockImplementation(...)` 후 `mockRestore()`를 테스트 본문 인라인 마지막에 직접 호출. `expect` 단언 실패 시 `mockRestore()` 미실행으로 Logger 프로토타입이 mock 상태로 유지되어 후속 테스트 오염 가능. | `execution-failure-classifier.spec.ts` L50-61, L201-212, L216-231, L327-344 | 각 describe 블록에 `afterEach(() => jest.restoreAllMocks())` 추가 또는 `jest.config`에 `restoreMocks: true` 전역 설정 |
| 5 | 테스트 | `CODE_MEMORY_LIMIT`/`HTTP_BLOCKED`에 대한 `result.key === 'executionFailedInternal'` 단언이 상위 `it.each`(L175-194)와 하위 no-warn 블록(L201-212) 두 곳에 중복. 하위 블록의 목적(no-warn 검증)과 관심사가 혼재. | `execution-failure-classifier.spec.ts` | 하위 블록에서 `result.key` 단언 제거, warn-spy 미호출 단언만 남겨 단일 관심사 유지 |
| 6 | 테스트 | `http-request.handler.ts` SSRF 차단 경로(`HTTP_BLOCKED` 분기, `configEcho` Principle 7 미노출, `meta.durationMs` 포함 등)에 대한 단위 테스트 부재. `http-ssrf-all-auth-followups.md` 테스트 항목 미체크 상태. | `http-request.handler.ts` L354-374 | `none/custom × {IMDS, RFC1918, localhost}` 교차 조합 테스트, SSRF 차단 시 credential 미포함 단언을 후속 plan 항목으로 연결 |
| 7 | 유지보수성 | `http-request.handler.ts`에서 `HTTP_BLOCKED`만 `ErrorCode.HTTP_BLOCKED` 참조로 전환되고 `HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX` 등은 문자열 리터럴로 남아 동일 파일 내 enum 참조와 리터럴이 혼재. | `http-request.handler.ts` | 후속 plan 항목으로 등록해 나머지 error code 문자열을 `ErrorCode.*` 참조로 일괄 전환 |
| 8 | 유지보수성 | `execution-failure-classifier.ts` 신규 주석의 "refactor 04 C-3" 참조가 PR 내부 약어로, 코드베이스 신규 진입자에게 맥락 불명확. `§3.1 매핑 표` 참조와 참조 방식 일관성도 부족. | `execution-failure-classifier.ts` — `HTTP_BLOCKED` 항목 주석 | "refactor 04 C-3"를 제거하거나 `spec/conventions/chat-channel-adapter.md §3.1` 링크로 대체 |
| 9 | 유지보수성 | plan W4 체크박스(기능 무관 가독성 리팩터)와 INFO 완료 항목 간 추적이 혼재 — 함수 선언 위치 이동이 두 곳에 이중 기재. | `plan/in-progress/code-node-isolated-vm-followups.md` | plan W4 체크박스와 INFO 항목 간 추적 정합 확인 및 W4 체크박스 상태 갱신 |
| 10 | 테스트 | `plan/in-progress/code-node-isolated-vm-followups.md` 테스트 항목(null/undefined 케이스, console.warn/error 캡처, syntaxIsolate disposed 재생성, $vars copy-out 실패 fallback) 미체크 상태. | `plan/in-progress/code-node-isolated-vm-followups.md` | 최소한 `classifyCodeNodeError(null as any)` / `(undefined as any)` 케이스 단위 테스트 추가; 나머지는 plan 체크박스 진행 추적 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | SSRF 메시지 내부 IP 노출(INFO), legacyCode 클라이언트 노출(INFO), 음수 상태 코드 통과(INFO) — 신규 취약점 없음 |
| requirement | LOW | `extractStatusCode()` 범위 검사 미이행 — spec §3.1 범위 조건 해석 모호(WARNING); 나머지 요구사항 모두 충족 |
| scope | NONE | 모든 변경이 plan 항목에 대응, 범위 이탈 없음 |
| side_effect | NONE | 런타임 부작용 없음; 테스트 spy 복원 패턴(INFO) |
| maintainability | LOW | `classifyCodeNodeError` 반환 타입 `string` — 타입 안전성 절반 완성(WARNING); enum 참조 혼재, PR 약어 주석(INFO) |
| testing | LOW | 기본 커버리지 양호; spy 누수 패턴, 단언 중복, SSRF 경로 단위 테스트 부재(INFO) |
| documentation | LOW | 전반적으로 양호; `@internal` 컴파일 미강제, PR 약어 주석(INFO) |
| user_guide_sync | NONE | 18개 trigger 전체 점검 — 동반 갱신 누락 0건 |

## 발견 없는 에이전트

- **user_guide_sync**: 매트릭스 18개 trigger 전체 해당 없음 (신규 ErrorCode 추가 없음, 노드 스키마 변경 없음)
- **scope**: 모든 변경이 plan 항목에 명시적으로 대응, 의도하지 않은 범위 이탈 없음

## 권장 조치사항

1. **(WARNING — 필수)** `classifyCodeNodeError` 반환 타입을 `'EXECUTION_TIMEOUT' | 'EXECUTION_MEMORY_EXCEEDED' | 'CODE_RUNTIME_ERROR'` 유니온으로 좁혀 `LEGACY_TO_NORMALIZED` 키 완전성을 컴파일 단계에서 강제한다.
2. **(WARNING — 확인 필요)** spec §3.1 `statusCode` 범위 조건 의도를 planner에게 확인 후, 범위 검사(`v >= 100 && v <= 599`) 추가 또는 spec 표현 개선 중 하나를 결정한다.
3. **(INFO — 권고)** `execution-failure-classifier.spec.ts` 각 describe 블록에 `afterEach(() => jest.restoreAllMocks())` 추가 또는 `jest.config`에 `restoreMocks: true` 전역 설정하여 spy 누수를 방지한다.
4. **(INFO — 권고)** `CODE_MEMORY_LIMIT`/`HTTP_BLOCKED` 결과 단언 중복을 제거하여 하위 블록이 warn-spy 미호출 단언만 담도록 정리한다.
5. **(INFO — 후속 plan 항목)** `http-request.handler.ts`의 나머지 error code 문자열 리터럴(`HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX` 등)을 `ErrorCode.*` 참조로 일괄 전환하는 plan 항목 등록.
6. **(INFO — 후속 plan 항목)** SSRF 차단 경로 단위 테스트(`none/custom` 인증 모드 × SSRF 차단 조합)를 `http-ssrf-all-auth-followups.md` 기존 미체크 항목에 연결하여 후속 PR에서 처리.
7. **(INFO — 선택적)** `execution-failure-classifier.ts` `HTTP_BLOCKED` 주석의 "refactor 04 C-3" 약어를 `spec/conventions/chat-channel-adapter.md §3.1` 링크로 대체.

## 라우터 결정

라우터가 reviewer 선별을 수행했습니다 (`routing_status=done`).

- **실행 (router_safety 강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync` (8명 — 전원 router_safety 강제 포함)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (user_guide_sync 포함 전체 8명)
- **제외**: 6명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |