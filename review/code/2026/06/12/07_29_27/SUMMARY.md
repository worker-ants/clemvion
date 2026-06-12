# Code Review 통합 보고서

## 전체 위험도
**LOW** — `DB_HOST_BLOCKED` 에러 코드 신설 변경은 전반적으로 안전하며 구현 완전성이 검증됨. 주요 주의사항은 에러 코드 변경(`INTEGRATION_CALL_FAILED` → `DB_HOST_BLOCKED`)이 기존 저장된 워크플로우에 breaking change 로 작용할 수 있다는 점이며, 릴리스 노트에 명시 필요.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용(Side Effect) | SSRF 가드 에러 코드가 `INTEGRATION_CALL_FAILED` → `DB_HOST_BLOCKED` 로 변경됨. 기존에 `INTEGRATION_CALL_FAILED` 를 분기 조건으로 사용하는 저장된 워크플로우 정의가 있다면 분기 동작이 달라지는 의미 있는 breaking change | `database-query.handler.ts` SSRF 가드 catch 블록 | 변경 이력/릴리스 노트에 "Database Query 노드 SSRF 차단 시 에러 코드가 `INTEGRATION_CALL_FAILED` 에서 `DB_HOST_BLOCKED` 로 변경됨"을 breaking change 로 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | catch 블록에서 원본 예외 정보(차단된 host/IP 포함)가 서버 로그에도 기록되지 않아 운영 관찰가능성 갭 발생. 클라이언트에 정보 미노출은 올바름 | `database-query.handler.ts` L224-231 | `catch (originalErr)` 로 원본 캡처 후 서버 구조화 로그 기록 검토. 예: `logger.warn({ blockedHost: creds.host, reason: String(originalErr) }, 'DB SSRF guard blocked')` |
| 2 | 보안 | DNS 재바인딩 TOCTOU 경쟁 조건 — 기존 한계, 신규 도입 없음. 코드에 주석으로 문서화됨 | `http-safety.ts` L118-121 | 운영 환경 egress 방화벽 부재 시 별도 티켓으로 추적. 현재 수준 수용 가능 |
| 3 | 보안 | DNS 실패 시 fail-open 정책 — 의도적 설계, 신규 도입 없음 | `http-safety.ts` L135-142 | DNS 실패를 structured warn 로그로 남기면 비정상 패턴 감지에 도움. 선택적 |
| 4 | [SPEC-DRIFT] 요구사항 | `spec/conventions/chat-channel-adapter.md §3.1` 분류표에 `DB_*` 와일드카드가 `executionFailedInternal` 로 커버하나 `HTTP_BLOCKED` 는 명시, `DB_HOST_BLOCKED` 는 와일드카드만으로 커버되는 비대칭 존재. 기능 오류 아님 | `spec/conventions/chat-channel-adapter.md` line 388 | `DB_*` 행 주석에 `(포함: DB_HOST_BLOCKED — SSRF 차단)` 추가 — spec 갱신 대상(project-planner 위임). 필수 아님 |
| 5 | 유지보수성 | `new IntegrationError('DB_HOST_BLOCKED', ...)` 처럼 문자열 리터럴 직접 사용. 같은 PR 에서 `ErrorCode.DB_HOST_BLOCKED` 가 정의되었음에도 핸들러가 이를 참조하지 않아 오타 방어 약함 | `database-query.handler.ts` SSRF catch 블록 | `new IntegrationError(ErrorCode.DB_HOST_BLOCKED, ...)` 로 enum 참조 사용. 기존 follow-up(`HTTP_BLOCKED` enum 참조화) 에 연동 처리 |
| 6 | 유지보수성 | 에러 메시지 문자열이 핸들러별 인라인 관리로 남아 3개 핸들러(HTTP/Email/DB) 간 표현 일관성이 수동 관리 대상 | `database-query.handler.ts`, HTTP/Email 핸들러 | 공유 상수 또는 헬퍼 함수로 추출 검토. 현재 단일 핸들러 추가 범위에서는 INFO 수준 |
| 7 | 유지보수성 | 픽스처 헬퍼(`pgIntegrationWithHost`, `mysqlIntegrationWithHost`)가 `describe` 블록 내부에 정의되어 기존 파일 컨벤션(모듈 최상단 정의)과 혼재 | `database-query.handler.spec.ts` `describe('SSRF host guard ...')` 내부 | `describe` 외부(기존 픽스처 상수 블록 근처)로 이동 또는 팩토리 함수 패턴으로 통일 검토 |
| 8 | 테스트 | `execution-failure-classifier.spec.ts` 에서 `DB_HOST_BLOCKED → executionFailedInternal` 분류 결과 단언이 `it.each` 배열과 단독 `it` 블록에 중복. 기능 문제 아님 | `execution-failure-classifier.spec.ts` line ~110 및 ~122 | 단독 `it` 블록에서 `expect(result.key)` 단언 제거 또는 테스트 이름을 "no CCH-ERR-04 warn log (classification via it.each above)" 로 명확화 |
| 9 | 테스트 | IPv6 loopback(`::1`) 및 IPv6 link-local(`fe80::1`) 차단 케이스가 `it.each` 에 미포함. SSRF 가드의 IPv6 처리 여부가 테스트로 미보장 | `database-query.handler.spec.ts` `it.each` 배열 | `it.each` 에 `['IPv6 loopback', '::1']` 케이스 1건 이상 추가 검토 |
| 10 | 테스트 | MySQL 드라이버에 대한 `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 테스트 미포함. PostgreSQL 경로만 opt-out 검증됨 | `database-query.handler.spec.ts` SSRF host guard describe 블록 | 중복 비용 대비 가치 낮음. 현 구조에서 skip 가능 |
| 11 | 문서화 | `spec/4-nodes/4-integration/2-database-query.md §5.3` 에 `DB_HOST_BLOCKED` 케이스 JSON 예제 없음. 다른 에러 케이스(구문 오류·커넥션 drop 등)는 각각 JSON 예제 있음 | `spec/4-nodes/4-integration/2-database-query.md §5.3` | JSON 출력 예제 1개 추가로 워크플로우 작성자 편의 향상 및 기존 에러 케이스와 대칭 완성. 필수 아님 |
| 12 | 사용자 가이드 동기화 | `EMAIL_HOST_BLOCKED` 가 `backend-labels.ts ERROR_KO` 에 미등재된 pre-existing gap 존재. 본 PR 이전부터 존재하던 문제 | `codebase/frontend/src/lib/i18n/backend-labels.ts` | 별도 follow-up 으로 `EMAIL_HOST_BLOCKED` 한국어 매핑 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 모든 발견사항 INFO 수준. SSRF 가드 위치·메시지 정찰 면 축소·opt-out 구현 모두 올바름. 운영 관찰가능성 갭(catch 블록 원본 에러 미로깅)은 선택적 개선 |
| requirement | LOW | 기능 완전성 확인. 이전 리뷰 WARNING 2건 FIXED·ACCEPTED. 잔여 발견사항 INFO 수준(단언 중복 정리, spec 명시 주석 선택). spec과 코드 전체 일치 확인됨 |
| scope | NONE | 모든 변경이 `DB_HOST_BLOCKED` 신설 단일 목적 범위 내. 불필요한 기능 확장·무관 파일 수정 없음 |
| side_effect | LOW | `INTEGRATION_CALL_FAILED` → `DB_HOST_BLOCKED` 에러 코드 변경이 기존 저장된 워크플로우에 breaking change 가능(WARNING 1건). 나머지 변경은 모두 additive |
| maintainability | NONE | 기존 `HTTP_BLOCKED`·`EMAIL_HOST_BLOCKED` 패턴 대칭 준수. 문자열 리터럴 직접 사용·픽스처 헬퍼 스코프·테스트 단언 중복은 INFO 수준 |
| testing | LOW | 핵심 차단 경로(PG 4종·MySQL·opt-out) 커버리지 충실. IPv6 loopback 케이스 미포함·MySQL opt-out 미포함은 INFO 수준 |
| documentation | NONE | 모든 spec 파일 동기화 완료. 이전 리뷰 WARNING(§1.4/§3.2 미동기화)은 FALSE POSITIVE 재확인. JSON 예제 추가·`DB_*` 명시 주석은 선택적 개선 |
| user_guide_sync | NONE | 매트릭스 trigger 1건(`new-error-code`) 매칭, `ERROR_KO` 동반 갱신 완료. `EMAIL_HOST_BLOCKED` pre-existing gap 은 본 PR 외 사항 |

## 발견 없는 에이전트

없음 — 모든 에이전트가 발견사항을 보고함 (대부분 INFO, side_effect 에서 WARNING 1건).

## 권장 조치사항

1. **(WARNING — 릴리스 노트 필수)** PR 본문 및 릴리스 노트에 "Database Query 노드 SSRF 차단 시 에러 코드가 `INTEGRATION_CALL_FAILED` 에서 `DB_HOST_BLOCKED` 로 변경됨 — 기존에 `INTEGRATION_CALL_FAILED` 를 분기 조건으로 사용하는 저장된 워크플로우 수정 필요"를 breaking change 로 명시한다.
2. **(INFO — 권장)** `new IntegrationError('DB_HOST_BLOCKED', ...)` 를 `new IntegrationError(ErrorCode.DB_HOST_BLOCKED, ...)` 로 enum 참조로 변경. 기존 `HTTP_BLOCKED` enum 참조화 follow-up 에 연동.
3. **(INFO — 권장)** `database-query.handler.ts` catch 블록에서 원본 에러 정보를 서버 구조화 로그에 기록(클라이언트 미노출 유지): `logger.warn({ blockedHost: creds.host, reason: String(originalErr) }, 'DB SSRF guard blocked')`.
4. **(INFO — 선택)** `database-query.handler.spec.ts` `it.each` 에 IPv6 loopback(`::1`) 차단 케이스 추가.
5. **(INFO — 선택)** `execution-failure-classifier.spec.ts` 단독 `it` 블록에서 `expect(result.key).toBe('executionFailedInternal')` 중복 단언 제거.
6. **(INFO — 선택, project-planner 위임)** `spec/conventions/chat-channel-adapter.md §3.1` `DB_*` 행에 `(포함: DB_HOST_BLOCKED — SSRF 차단)` 명시 주석 추가.
7. **(INFO — 선택)** `spec/4-nodes/4-integration/2-database-query.md §5.3` 에 `DB_HOST_BLOCKED` 케이스 JSON 출력 예제 추가.
8. **(INFO — 별도 follow-up)** `EMAIL_HOST_BLOCKED` 한국어 매핑을 `backend-labels.ts ERROR_KO` 에 추가(pre-existing gap).

## 라우터 결정

- **routing_status**: `done` (router 가 선별)
- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync` (8명 — 전원 router_safety 강제 포함)
- **제외**: 6명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | router 선별에 의해 생략 |
| architecture | router 선별에 의해 생략 |
| dependency | router 선별에 의해 생략 |
| database | router 선별에 의해 생략 |
| concurrency | router 선별에 의해 생략 |
| api_contract | router 선별에 의해 생략 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)