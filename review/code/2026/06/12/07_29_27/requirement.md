# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] [SPEC-DRIFT] `spec/conventions/chat-channel-adapter.md` §3.1 `DB_*` 와일드카드로 이미 커버됨 — 명시적 주석 선택 사항
- **위치**: `spec/conventions/chat-channel-adapter.md` line 388
- **상세**: 분류표의 `DB_*` 와일드카드가 `executionFailedInternal` 매핑으로 `DB_HOST_BLOCKED` 를 이미 커버한다. `execution-failure-classifier.ts` 의 `INTERNAL_CODES` Set 에 `DB_HOST_BLOCKED` 등재 + 테스트의 `executionFailedInternal` 단언이 spec §3.1 `DB_*` 패턴과 정확히 일치하므로 코드 버그 없음. `HTTP_BLOCKED` 는 동 표에 명시적으로 나열되어 있고 `DB_HOST_BLOCKED` 는 와일드카드로만 커버되는 비대칭이 존재하나, 기능 오류가 아니라 문서 명확성 갭이다.
- **제안**: 필수 아님(코드 유지). 원한다면 spec `DB_*` 행 주석에 `(포함: DB_HOST_BLOCKED — SSRF 차단)` 추가 — spec 갱신 대상(project-planner 위임).

### [INFO] `sanitizeMessage` 통과 — 고정 문자열이므로 실질 영향 없음
- **위치**: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` catch 블록 (line 228-230)
- **상세**: `IntegrationError` 메시지 `'Database host resolves to a private/loopback address blocked by SSRF policy.'` 는 고정 문자열로 host/IP 를 포함하지 않는다. `sanitizeMessage` 를 통과해도 동일 문자열이 출력되므로 정찰 면 축소 요건이 충족된다. 테스트 `not.toContain(host)` + `toMatch(/SSRF policy/i)` 가 이 요건을 명시적으로 검증한다.
- **제안**: 없음.

### [INFO] MySQL 드라이버의 `DB_HOST_BLOCKED` 경로 — 현재 커버됨
- **위치**: `codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts` (이번 변경에 추가된 MySQL 테스트 블록)
- **상세**: 이전 리뷰 라운드(review/code/2026/06/12/01_19_26)에서 MySQL 테스트 누락이 WARNING 으로 지적됐다. RESOLUTION.md 에서 FIXED 처리 확인: `mysqlIntegrationWithHost` 헬퍼 + MySQL 차단 테스트 1건(createPool 미호출 · DB_HOST_BLOCKED · 메시지 일반화 · logUsage 단언)이 현재 diff 에 포함됐다. 드라이버 분기 전 SSRF 가드 실행 보장이 MySQL 경로에서도 검증된다.
- **제안**: 없음. 기능 완전성 확인됨.

### [INFO] `ALLOW_PRIVATE_HOST_TARGETS` env-mutation 격리 — 현재 상태 수용 가능
- **위치**: `database-query.handler.spec.ts` opt-out 테스트 블록 (lines 229-250)
- **상세**: `try/finally` 복원 패턴이 사용됐다. 이전 리뷰에서 병렬 실행 간섭 가능성이 WARNING 으로 지적됐으나, RESOLUTION.md 에서 ACCEPTED 처리: Jest 는 파일 단위 worker 격리(별도 프로세스)로 파일 간 env 공유 없음 + 동일 파일 내 직렬 실행 + try/finally 복원으로 충분.
- **제안**: 없음.

### [INFO] `execution-failure-classifier.spec.ts` `it.each` 와 단독 `it` 의 `executionFailedInternal` 단언 중복
- **위치**: `execution-failure-classifier.spec.ts` (diff line 110 INTERNAL_CODES 배열 + line 122-134 단독 it 블록)
- **상세**: `it.each` 배열에 `DB_HOST_BLOCKED` 가 포함돼 `executionFailedInternal` 를 이미 검증하고, 단독 `it` 블록에서도 동일 단언이 반복된다. 단독 `it` 의 고유 가치는 warn 로그 미발생(CCH-ERR-04) 단언이다. 기능적으로 문제없으나 의도 중복이다.
- **제안**: 단독 `it` 블록에서 `expect(result.key).toBe('executionFailedInternal')` 를 제거하거나, `it.each` 에서 `DB_HOST_BLOCKED` 를 빼고 단독 케이스에서 key + warn 로그 양쪽을 검증하는 방향으로 정리 가능. 필수 아님.

## Spec Fidelity 점검

### spec/4-nodes/4-integration/2-database-query.md 일치 여부

- **§4 SSRF 가드 callout (line 106)**: 현재 워크트리 spec 이 이미 `DB_HOST_BLOCKED` 전용 코드, 메시지 일반화, `ALLOW_PRIVATE_HOST_TARGETS` opt-out 을 명시. 이전 리뷰(01_19_26)의 SPEC-DRIFT 경고는 commit 6525597c 에서 해소됐음이 RESOLUTION.md 에서 확인됨. **현재 코드와 spec 일치.**
- **§5.3 output.error.code 열거 (line 301)**: `DB_HOST_BLOCKED (SSRF 차단)` 이 현재 spec 에 등재됨. 코드·spec 일치.
- **§6.2 에러 코드표 (line 343)**: `DB_HOST_BLOCKED` 행이 현재 spec 에 포함됨. 코드·spec 일치.

### spec/5-system/3-error-handling.md 일치 여부

- **§1.4 Database 카테고리 (line 80)**: `DB_HOST_BLOCKED (SSRF 차단 — host 가 사설/loopback, 기본 ON·ALLOW_PRIVATE_HOST_TARGETS opt-out)` 가 현재 spec 에 등재됨. 코드·spec 일치.
- **§3.2 대표 에러 코드표 (line 223)**: Database 행에 `DB_HOST_BLOCKED` 포함됨. 코드·spec 일치.

### spec/conventions/chat-channel-adapter.md §3.1 (line 388)

- `DB_*` 와일드카드 패턴이 `executionFailedInternal` 로 매핑돼 `DB_HOST_BLOCKED` 를 포함. 코드의 `INTERNAL_CODES` 등재 및 테스트 단언과 일치.

### codebase/frontend/src/lib/i18n/backend-labels.ts ERROR_KO

- `DB_HOST_BLOCKED` 한국어 매핑이 line 588-589 에 추가됨. 이전 리뷰 WARNING #4(누락)는 RESOLUTION.md 에서 FIXED 처리됐고 현재 diff 에서 확인됨.

## 기능 완전성 평가

| 항목 | 상태 |
|------|------|
| ErrorCode enum 등재 (`error-codes.ts`) | 완료 |
| 핸들러 SSRF 가드 승격 (`database-query.handler.ts`) | 완료. 드라이버 분기 이전 실행 보장 |
| classifier INTERNAL_CODES 등재 (`execution-failure-classifier.ts`) | 완료. DB_* 패턴 일치, unknown-fallback warn 로그 미발생 보장 |
| i18n 한국어 매핑 (`backend-labels.ts ERROR_KO`) | 완료. HTTP_BLOCKED 대칭 |
| spec 동기화 (`2-database-query.md §4/§5.3/§6.2`, `3-error-handling.md §1.4/§3.2`) | 완료. 현재 워크트리에서 모두 반영됨 |
| 테스트 커버리지 (PG 4개 케이스 + opt-out + MySQL + classifier no-warn) | 완료 |

**에러 시나리오 경계값**: `creds.host` 가 falsy(undefined/null/빈 문자열)이면 SSRF 가드를 건너뜀 (`if (creds.host)` 조건). host 없는 연결(소켓 경로 등)을 위한 의도적 설계이며 기능 누락이 아니다.

**반환값**: 모든 경로에서 `port: 'error'` + `output.error.code = 'DB_HOST_BLOCKED'` 또는 `port: 'success'` / 다른 에러 코드로 반환 — 누락 경로 없음.

**비즈니스 로직 breaking change**: `INTEGRATION_CALL_FAILED` → `DB_HOST_BLOCKED` 승격이 기존 분기 워크플로우에 영향 가능성 있음. 의도된 설계 결정으로 RESOLUTION.md 에 "PR 본문/릴리스 노트에 명시" 처리됨.

## 요약

이번 변경(`DB_HOST_BLOCKED` 신설)은 기능 요구사항을 완전히 충족한다. `ErrorCode` enum 등재, `database-query.handler.ts` 의 SSRF 차단 → `DB_HOST_BLOCKED` IntegrationError 승격, `execution-failure-classifier.ts` INTERNAL_CODES 등재, `backend-labels.ts` 한국어 매핑까지 전 파이프라인이 일관되게 구현됐다. spec `2-database-query.md §4/§5.3/§6.2` 와 `3-error-handling.md §1.4/§3.2` 도 현재 워크트리에서 직접 확인하여 동기화됐음이 검증됐다. 이전 리뷰 라운드(01_19_26)의 WARNING 2건(i18n 누락, MySQL 테스트 누락)은 FIXED, SPEC-DRIFT 3건은 FP 반증됐으며 나머지 WARNING(env-mutation 격리)은 ACCEPTED. 현재 라운드에서 코드 버그는 발견되지 않았고, 잔여 발견사항은 모두 INFO 수준(단언 중복 정리, chat-channel-adapter §3.1 명시 주석 선택)이다.

## 위험도

LOW
