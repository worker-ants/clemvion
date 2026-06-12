# Code Review 통합 보고서

리뷰 대상: `test-code-http-hardening` 그룹3 (C-2/C-3 후속 — 테스트 보강 + spec 문서 갱신)
diff-base: origin/main
생성일시: 2026-06-12

---

## 전체 위험도

**HIGH** — DB SSRF 가드 및 chat-channel 분류 경로 테스트 커버리지 공백 2건(CRITICAL)이 보안 동작 미검증 상태를 유발한다. spec/문서 관점 WARNING 다수는 기능 동작에는 영향이 없으나 계약 명확성·추적 가능성 개선이 필요하다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `DB_HOST_BLOCKED` SSRF 가드 테스트 전체 삭제 — 구현도 동시에 변경(`DB_HOST_BLOCKED` 전용 승격 제거 → `INTEGRATION_CALL_FAILED` fallback)됐으나 새 동작을 검증하는 테스트가 전혀 없다. 사설 host 차단이 실제로 동작하는지, 어떤 코드가 출력되는지 완전히 미검증. | `codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts` (130줄 삭제) | ① `127.0.0.1` 등 사설 host → `port: 'error'` + `output.error.code` 값 검증, ② `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 통과 검증, ③ DB 연결 풀 미생성(`connectMock` not called) 검증 — 최소 3케이스 복원 필수 |
| 2 | Testing | `CODE_MEMORY_LIMIT` / `HTTP_BLOCKED` / `DB_HOST_BLOCKED` 의 `INTERNAL_CODES` 등재 제거와 함께 chat-channel 분류 경로 검증 테스트가 삭제됐다. 이 코드들이 `execution-failure-classifier` 에 들어올 때 unknown fallback 경로로 처리되는지, warn 로그가 발생하는지 전혀 검증되지 않는다. `HTTP_BLOCKED` 는 HTTP 노드에서 실제 발생하는 코드다. | `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` (W1 describe 블록 삭제) | `HTTP_BLOCKED`, `CODE_MEMORY_LIMIT` 입력 시 `key: 'executionFailedInternal'` 반환 + warn 로그 발생 여부를 검증하는 테스트 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `LEGACY_TO_NORMALIZED` 폴백 변경 — `CODE_EXECUTION_FAILED` 고정에서 raw pass-through(`errorCode`)로 완화. 미등재 내부 코드가 `output.error.code` 에 그대로 노출될 수 있으나 테스트 없음. | `codebase/backend/src/nodes/data/code/code.handler.ts` line 420 | 미등재 에러 코드가 `output.error.code` 에 노출되는지 또는 fallback 코드로 대체되는지 검증하는 단위 테스트 추가 |
| 2 | Testing | `DB_HOST_BLOCKED` ErrorCode enum 삭제 + `http-request.handler.ts` 에서 `ErrorCode.HTTP_BLOCKED` → `'HTTP_BLOCKED'` 문자열 리터럴 변경 — 컴파일 타임 타입 체크 우회, enum 값이 변경되면 불일치 발생 가능. | `codebase/backend/src/nodes/core/error-codes.ts`, `http-request.handler.ts` line 354/363 | `assertSafeOutboundHostResolved` 예외 발생 시 `database-query` `output.error.code` 검증 테스트 추가. `ErrorCode` enum 참조 유지 또는 `http-safety.ts` 에 문자열 상수 집중 정의 검토 |
| 3 | Testing | `classifyError` 이름 변경 — 이전 `classifyCodeNodeError` 는 grep 충돌 회피 목적을 명시했으나, 변경 이유가 테스트/주석에 미기록. | `code.handler.ts` line 473, `code.handler.spec.ts` line 1 | W9 describe 코멘트 갱신해 이름 변경 이유 명시 |
| 4 | Requirement | 신규 dry-run 테스트에서 `output._dryRun` 단언 누락 — 기존 dry-run 테스트는 계약 검증을 포함하나 신규 테스트는 생략. | `http-request.handler.spec.ts` line 1092-1117 | `expect((result.output as { _dryRun?: boolean })._dryRun).toBe(true)` 단언 추가 |
| 5 | Architecture | `EXECUTION_TIMEOUT` 동명 코드 레이어 혼재 — `error-codes.md §4` 는 핸들러 내부 분류 레이어 한정으로 선언하나, `3-error-handling.md §1.4` 는 엔진 레벨과 노드 출력 레이어 설명을 동일 행에 혼재. 장기 ISP 위반 방향. | `spec/conventions/error-codes.md §4`, `spec/5-system/3-error-handling.md §1.4` | §1.4 `EXECUTION_TIMEOUT` 행을 "엔진 레벨(EIA)"과 "(Code 노드 핸들러 내부 분류, 노드 출력은 CODE_TIMEOUT)" 두 행으로 분리. 장기적으로 핸들러 내부 문자열을 `CODE_NODE_TIMEOUT_INTERNAL` 등으로 rename 계획을 Rationale 에 기록 |
| 6 | Architecture | `error-codes.md §4` 섹션 위치가 §3 "Historical-artifact 예외 레지스트리"와 동등 헤더 계층(##)으로 배치되어 레이어 책임이 불명확. | `spec/conventions/error-codes.md §4` | §4 도입문에 "§3(클라이언트 노출·§1 명명 위반 코드)와 달리 §4는 클라이언트 비노출 내부 분류 코드 — 레이어가 다르다" 비교 문구 추가 |
| 7 | Documentation | `spec/conventions/error-codes.md §4` 도입문이 §3 와의 레이어 차이를 충분히 설명하지 않아 독자 혼선 가능. (WARNING-6 과 연관, 문서 관점 세부) | `spec/conventions/error-codes.md §4` | §4 도입부에 §3 vs §4 레이어 비교 한 줄 추가 |
| 8 | Documentation | `2-code.md §4` 에서 2단 래퍼 런타임 에러 라인 오프셋(+3)을 구현 교차 검증 없이 단언. isolated-vm `compileScript` 보고 기준에 따라 실제 오프셋이 달라질 수 있음. | `spec/4-nodes/5-data/2-code.md §4` | `code.handler.ts` 라인 오프셋 보정 로직 위치를 spec 에 교차 참조하거나 "+3 (구현 파일 참조, 실제 값 검증 필요)"로 단언 완화 |
| 9 | Documentation | dry-run SSRF 생략 예외가 step 8 긴 설명 마지막 인라인 문장에 묻혀 가시성 부족 — 보안 동작 예외는 독자 주의 필요. | `spec/4-nodes/4-integration/1-http-request.md §4 step 8` | 별도 `> **dry-run 예외**: ...` callout 블록으로 분리 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | SSRF 이중 검사(URL 리터럴 + DNS rebinding) 설계 확인 — 올바른 구현. `assertSafeOutboundUrl` 커버리지(IPv6 bracket, encoded percent) 단위 테스트 권장. | `spec/4-nodes/4-integration/1-http-request.md §4 step 8` | 별도 단위 테스트로 확인 권장 |
| 2 | Security | dry-run 분기가 실제 fetch 를 수행하지 않음을 보장하는 구현 단 통합 테스트/e2e 커버리지 보강 권장. | `spec/4-nodes/4-integration/1-http-request.md §4 step 8` | dry-run 분기가 실제 fetch 를 호출하지 않음을 검증하는 통합 테스트 추가 |
| 3 | Security | `HTTP_BLOCKED` / `EMAIL_HOST_BLOCKED` 에러 메시지에도 host/IP 미포함 정책을 spec 에 명시적으로 확인/추가 권장. | `spec/4-nodes/4-integration/2-database-query.md §4`, `spec/2-navigation/4-integration.md` | 동일 정책 명시 |
| 4 | Security | `md5`/`sha1` 경고가 spec 에만 있고 런타임에 강제되지 않음. | `spec/4-nodes/5-data/2-code.md §3 helpers 표` | `code.handler.ts` 또는 helpers 모듈에서 `algorithm` 파라미터 화이트리스트 검증 또는 경고 로그 고려 |
| 5 | Security | `output.response.error` 레거시 필드에 transport 실패 메시지 전문이 담길 경우 자격증명/토큰 sanitize 여부 미확인. | `spec/4-nodes/4-integration/1-http-request.md §5.5` | 구현에서 sanitize 처리 여부 확인 |
| 6 | Security | `ALLOW_PRIVATE_HOST_TARGETS=true` 단일 플래그가 모든 통합 노드 SSRF 방어를 동시 무력화 — 프로덕션 실수 활성화 위험. | `spec/4-nodes/4-integration/1-http-request.md §4 SSRF 가드` | 프로덕션 파이프라인에서 플래그 활성화 시 경고 로그/CI 게이트 추가 권장 |
| 7 | Security | `_retry_state.json` 에 개발자 로컬 절대 경로 하드코딩 — 공개 저장소라면 이력 노출 위험. | `review/consistency/**/_retry_state.json` | 공개 저장소라면 `.gitignore` 추가 또는 상대 경로 저장 방식 검토 |
| 8 | Testing | `execution-failure-classifier.spec.ts` `.each` 배열 축소 후 unknown fallback 경로 미검증 (CRITICAL#2 와 연관, INFO 수준 세부). | `execution-failure-classifier.spec.ts` line 105 근방 | `HTTP_BLOCKED`, `CODE_MEMORY_LIMIT` 입력 → `key: 'executionFailedInternal'` + warn 로그 검증 테스트 추가 |
| 9 | Testing | `http-request.handler.ts` `ErrorCode.HTTP_BLOCKED` → `'HTTP_BLOCKED'` 문자열 리터럴 변경 — 기존 테스트는 통과하나 장기 유지보수 위험. | `http-request.handler.ts` line 354/363 | `ErrorCode` enum 참조 유지 또는 `http-safety.ts` 에 상수 집중 정의 |
| 10 | Architecture | `output.response.error` Deprecated 선언 — 제거 일정 미기재. | `spec/4-nodes/4-integration/1-http-request.md §5.5` | §Rationale 또는 필드 행에 폐기 목표 Phase/PR 명시 |
| 11 | Architecture | `EMAIL_HOST_BLOCKED` 가 `chat-channel-adapter.md §3.1` 에서 `ERROR_PORT_FALLBACK` 경유 간접 흡수 — HTTP/DB SSRF 차단 코드와 분류 경로 비대칭. | `spec/conventions/chat-channel-adapter.md §3.1` | `EMAIL_HOST_BLOCKED` 를 `executionFailedInternal` 로 명시 등재 |
| 12 | Architecture | `send_email` 성공 포트명 `'out'` vs `node-output.md` Principle 5 `port: undefined` — conventions 레이어 불일치. | `spec/conventions/node-output.md` Principle 5 | `send_email` 을 `port: 'out'`/`port: 'error'` 모델로 Principle 5 에서 분리하거나 포트명을 `success` 로 통일 |
| 13 | Architecture | `DB_HOST_BLOCKED` 신설 결정 근거가 커밋 메시지에만 있고 `2-database-query.md ## Rationale` 에 미기재 — 단일 진실 원칙 위반. | `spec/4-nodes/4-integration/2-database-query.md ## Rationale` | Rationale 에 신설 근거(구 `INTEGRATION_CALL_FAILED` fallback 문제, HTTP/Email 대칭, `ALLOW_PRIVATE_HOST_TARGETS` 통일 근거) 추가 |
| 14 | Documentation | `node-output.md` D4 주석 예시가 `HTTP_BLOCKED` 단독 — `DB_HOST_BLOCKED`, `EMAIL_HOST_BLOCKED` 미포함. | `spec/conventions/node-output.md` D4 blockquote | D4 주석 예시를 세 코드로 확장 또는 "각 Integration 노드 전용 SSRF 차단 코드"로 추상화 |
| 15 | Documentation | `error-codes.md §4` 에 `LEGACY_TO_NORMALIZED` 폴백(`CODE_EXECUTION_FAILED`) 미기재. | `spec/conventions/error-codes.md §4` | 테이블 하단에 "표에 없는 미등재 내부 코드는 `CODE_EXECUTION_FAILED` 로 폴백" 한 줄 추가 |
| 16 | Documentation | `output.response.error` Deprecated 제거 일정 미명시 — 구현자가 호환성 유지 기간을 알 수 없음. | `spec/4-nodes/4-integration/1-http-request.md §5.7` | "향후 major 버전 제거 예정" 또는 "레거시 호환 무기한 유지" 중 명시 |
| 17 | Documentation | `3-error-handling.md §3.2` Email 행에 `EMAIL_HOST_BLOCKED` 미등재 — §1.4 와 동일 파일 내 비대칭. | `spec/5-system/3-error-handling.md §3.2` | Email 행에 `EMAIL_HOST_BLOCKED` 추가 |
| 18 | Documentation | review 산출물 JSON 파일들에 trailing newline 없음 — POSIX 표준 불일치. | `review/consistency/2026/06/12/*/` JSON 파일 전체 | 생성 스크립트에서 JSON write 후 trailing newline 추가 |
| 19 | Requirement | W14 오프셋 수정(+4 → +3) 및 테스트 4건 추가 — spec §4 step2 와 일치, 기능 회귀 없음. | `code.handler.ts` JSDoc, `code.handler.spec.ts` | 없음 |
| 20 | Side Effect | spec 문서 변경 8개 모두 기존 구현 동작을 사후 문서화하는 성격 — 의도치 않은 부작용 없음. | `spec/**` | 없음 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | HIGH | DB SSRF 가드 테스트 130줄 전체 삭제 + 구현 동시 변경으로 미검증 상태(CRITICAL 2건), `LEGACY_TO_NORMALIZED` 폴백 완화 미검증(WARNING) |
| security | LOW | SSRF 이중 방어 설계 올바름. dry-run 분기 fetch 미발생 보장 테스트 권장, `ALLOW_PRIVATE_HOST_TARGETS` 프로덕션 사고 방지 추가 권장 |
| architecture | LOW | `EXECUTION_TIMEOUT` 레이어 혼재 및 `error-codes.md §4` 섹션 계층 모호성(WARNING 2건), EMAIL/send_email 포트명 conventions 불일치, Rationale 미기재 |
| requirement | LOW | 테스트 항목 전체 커버·기능 완전성 충족. dry-run `output._dryRun` 단언 누락 1건(WARNING) |
| documentation | LOW | dry-run SSRF 생략 예외 가시성 부족, 2-code.md 오프셋 단언 교차 검증 미흡, error-codes.md §4 도입문 불충분(WARNING 3건) |
| side_effect | NONE | 의도치 않은 부작용 없음 |
| api_contract | NONE | API 구현 코드 변경 없음 — 리뷰 대상 부재 |
| user_guide_sync | NONE | 유저 가이드 동반 갱신 trigger 해당 없음 |

---

## 발견 없는 에이전트

- **api_contract**: API 구현 코드 변경 없음 (spec 문서 및 review 산출물만 변경)
- **user_guide_sync**: 매트릭스 전체 18개 trigger 비해당

---

## 권장 조치사항

1. **[CRITICAL-1] DB SSRF 가드 테스트 복원** — `database-query.handler.spec.ts` 에 사설 host 차단 케이스(IPv4 loopback, RFC1918, localhost), opt-out, DB 연결 풀 미생성 검증 3케이스 이상 추가. 구현이 `INTEGRATION_CALL_FAILED` fallback 으로 변경됐으므로 새 동작 명세 확인 후 반영.
2. **[CRITICAL-2] chat-channel 분류 경로 테스트 복원** — `execution-failure-classifier.spec.ts` 에 `HTTP_BLOCKED`, `CODE_MEMORY_LIMIT` 입력 시 unknown fallback 경로 동작(`key: 'executionFailedInternal'` 반환 여부) 및 warn 로그 발생 여부 검증 테스트 추가.
3. **[WARNING-1] `LEGACY_TO_NORMALIZED` 폴백 미검증** — `classifyError` 가 미등재 코드를 그대로 pass-through 할 때 `output.error.code` 에 예상치 못한 값이 노출되지 않는지 단위 테스트 추가.
4. **[WARNING-2] ErrorCode 타입 안전성** — `ErrorCode.HTTP_BLOCKED` 문자열 리터럴 변경에 대한 장기 대응 방안 결정(enum 참조 복원 또는 상수 집중 정의). `DB_HOST_BLOCKED` 삭제 후 SSRF 차단 코드 출력 경로 통합 테스트 추가.
5. **[WARNING-5/6] spec 레이어 명확화** — `EXECUTION_TIMEOUT` 이중 레이어 혼재 해소(`3-error-handling.md §1.4` 행 분리) 및 `error-codes.md §4` 도입문에 §3 vs §4 레이어 비교 문구 추가.
6. **[WARNING-9] dry-run SSRF 생략 예외 callout 분리** — `1-http-request.md §4 step 8` 의 dry-run 예외를 별도 callout 블록으로 가시화.
7. **[WARNING-4/8] 테스트 계약·문서 보완** — dry-run 테스트 `output._dryRun` 단언 추가, `2-code.md §4` 오프셋 단언에 구현 교차 참조 추가.
8. **[INFO 군] Rationale/spec 보완** — `DB_HOST_BLOCKED` Rationale 기재, `EMAIL_HOST_BLOCKED` chat-channel 어댑터 명시 등재, `output.response.error` Deprecated 일정 명시.

---

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`).

- **실행**: `security`, `architecture`, `requirement`, `side_effect`, `testing`, `documentation`, `api_contract`, `user_guide_sync` (8명)
- **강제 포함(router_safety)**: `documentation`, `requirement`
- **제외**: 6명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 성능 관련 변경 없음 (spec 문서 + 테스트만) |
| scope | 범위 이탈 없음 |
| maintainability | 유지보수성 전담 리뷰 불필요 (architecture 에서 커버) |
| dependency | 신규 의존성 없음 |
| database | DB 스키마/쿼리 변경 없음 |
| concurrency | 동시성 관련 변경 없음 |