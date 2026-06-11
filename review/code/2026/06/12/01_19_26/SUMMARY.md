# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 구현 완성도 높음. Critical 없음. SPEC-DRIFT(spec 갱신 누락) 3건, 사용자 가시 i18n 누락 1건, 테스트 커버리지 갭 2건이 WARNING으로 존재하나 모두 수정 가능한 범위.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/4-nodes/4-integration/2-database-query.md` §4 callout 이 구버전("INTEGRATION_CALL_FAILED fallback, 향후 통일 후보")으로 기재되어 있음. 구현이 `DB_HOST_BLOCKED` 로 이미 완성됐으므로 spec 이 낡은 케이스. | `spec/4-nodes/4-integration/2-database-query.md` line 106 | 코드 유지 + spec §4 callout 갱신: `INTEGRATION_CALL_FAILED` → `DB_HOST_BLOCKED (IntegrationError)`, "향후 통일 후보" 문구 제거, 메시지 일반화 요건 추가 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/3-error-handling.md` §1.4·§3.2 Database 에러 코드 목록에 `DB_HOST_BLOCKED` 누락. `ErrorCode` enum 확장 시 분류 표 행 추가 검토 의무(line 88 note) 미이행. | `spec/5-system/3-error-handling.md` line 80, line 223 | 코드 유지 + §1.4 Database 행에 `DB_HOST_BLOCKED (SSRF 가드 차단)` 추가, §3.2 Database 행에도 추가 |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] `spec/4-nodes/4-integration/2-database-query.md` §5.3 필드표 `output.error.code` 열거 및 §6.2 에러 코드표에 `DB_HOST_BLOCKED` 누락. 워크플로우 저자가 분기 방법을 알 수 없는 상태. | `spec/4-nodes/4-integration/2-database-query.md` line 301, line 337–345 | 코드 유지 + §6.2에 `DB_HOST_BLOCKED` 행 추가, §5.3 필드표 `output.error.code`에 추가, §5.8 D4 라우팅 목록에 추가 |
| 4 | i18n / 사용자 가이드 | 신규 ErrorCode `DB_HOST_BLOCKED`의 한국어 매핑 누락. 한국어 사용자에게 영문 message 원문이 노출됨. 대칭 코드 `HTTP_BLOCKED`는 line 584에 이미 매핑되어 있어 `DB_HOST_BLOCKED`만 빠진 상태. | `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO` 테이블 | `ERROR_KO`에 `DB_HOST_BLOCKED: "보안 정책(SSRF 방지)에 의해 해당 데이터베이스 호스트로의 연결이 차단됐어요..."` 추가 |
| 5 | Testing | MySQL 드라이버에 대한 `DB_HOST_BLOCKED` 경로 테스트 누락. SSRF 가드는 드라이버 분기 전에 실행되므로 MySQL에서도 동일하게 차단되어야 하지만, 모든 `it.each` 케이스가 PostgreSQL만 검증. | `database-query.handler.spec.ts` `SSRF host guard` describe 블록 | `mysqlIntegrationWithHost` 헬퍼 추가 + `it.each`에 MySQL 케이스(최소 1개, e.g. `127.0.0.1`) 포함 |
| 6 | Testing | `ALLOW_PRIVATE_HOST_TARGETS` env-mutation의 병렬 실행 간섭 가능성. `try/finally` 복원 패턴은 동일 파일 내 격리는 보장하나, 비동기 Promise resolve 전 다른 코루틴이 env를 읽을 가능성에 대한 명시적 격리 보장 없음. | `database-query.handler.spec.ts` lines 744–765 | `jest.isolateModules` 적용 또는 해당 describe 블록을 별도 파일로 분리. 프로젝트 Jest 설정이 파일 단위 워커 격리를 보장한다면 현 수준으로 충분. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | DNS 재바인딩 TOCTOU 경쟁 조건 — 기존에 알려진 한계이며 코드 주석으로 문서화됨. 이번 변경이 신규 도입하지 않음. | `http-safety.ts` L118-121 | 운영 환경 egress 방화벽 없는 경우 별도 티켓 추적. 이번 PR 범위 밖. |
| 2 | Security | DNS 실패 시 fail-open 정책 — 의도적 설계, 주석으로 명시됨. 이론적 DoS+SSRF 체인 가능성 존재하나 실제 내부망 접근 없음. | `http-safety.ts` L135-142 | DNS 실패를 구조화 로그(warn)로 남기면 이상 패턴 감지에 도움. 선택적 개선. |
| 3 | Security | catch 블록에서 원본 에러(차단 host/IP) 무시 — 서버 로그에도 차단 대상 host/IP 미기록. 의도적 정찰 방지 설계이나 운영 관찰가능성 갭 발생. | `database-query.handler.ts` L1813-1820 | 서버 로그에 structured field로 차단 host 기록 검토 (클라이언트 노출 없이). 선택적 개선. |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/chat-channel-adapter.md` §3.1 `DB_*` 와일드카드로 이미 커버됨. `DB_HOST_BLOCKED`는 별도 행 추가 필수 아님. | `spec/conventions/chat-channel-adapter.md` line 388 | 원한다면 `DB_*` 항목에 `(포함: DB_HOST_BLOCKED — SSRF 차단)` 주석 추가. 필수 아님. |
| 5 | Testing | `it.each` 배열과 별도 `it` 블록에서 `DB_HOST_BLOCKED → executionFailedInternal` key 단언 중복. | `execution-failure-classifier.spec.ts` lines 174–186, 190–198 | `it.each`에서 `DB_HOST_BLOCKED` 제거 후 별도 케이스에서 key + warn 로그 양쪽 검증, 또는 별도 케이스에서 warn 로그 단언만 남기는 방향 중 택일. |
| 6 | Testing | MySQL credential SSRF 차단 테스트 미비 (INFO 수준 — WARNING #5와 동일 이슈의 requirement 관점). | `database-query.handler.spec.ts` | 필수 아님. MySQL fixtures로 동일한 차단 케이스 1건 추가 권장. |
| 7 | Maintainability | SSRF 차단 에러 메시지 문자열이 핸들러별 인라인 하드코딩. 향후 3개 핸들러(HTTP/Email/DB) 간 표현 일관성 수동 관리 필요. | `database-query.handler.ts` SSRF catch 블록 | 공유 상수(`SSRF_BLOCKED_MESSAGE`) 또는 헬퍼를 `http-safety.ts`에 두어 일관성 보장. 현 범위에서는 수용 가능. |
| 8 | Maintainability | `pgIntegrationWithHost` 헬퍼가 `describe` 블록 내부 정의 — 기존 픽스처 정의 위치 컨벤션과 혼재. | `database-query.handler.spec.ts` | MySQL 등 확장 시 `describe` 외부 팩토리로 승격 권장. 현 범위에서는 LOW 위험. |
| 9 | Documentation | `spec §5.3`에 `DB_HOST_BLOCKED` 케이스 JSON 예제 없음. 기존 4개 에러 케이스는 모두 JSON 예제 있으나 SSRF 케이스 누락. | `spec/4-nodes/4-integration/2-database-query.md` §5.3 | `DB_HOST_BLOCKED` 케이스 JSON 예제 1개 추가 권장 (필수 아님). |
| 10 | Side Effect | SSRF 차단 경로의 에러 코드가 `INTEGRATION_CALL_FAILED` → `DB_HOST_BLOCKED`로 변경됨. 기존에 해당 코드를 분기 조건으로 사용하는 저장된 워크플로우가 있다면 분기 동작이 달라질 수 있음. | `database-query.handler.ts` L1812–1821 | 변경 이력/릴리스 노트에 breaking change 명시 권장. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 알려진 TOCTOU/DNS-fail-open 한계 모두 주석 문서화됨. 신규 취약점 없음. |
| requirement | LOW | 기능 완성도 높음. spec 3개 파일 갱신 누락(SPEC-DRIFT 3건 WARNING). |
| scope | (파일 없음) | output_file 미존재로 결과 미포함. |
| side_effect | LOW | 의도된 동작 변경(에러 코드 승격). 원본 예외 정보 서버 로그 미기록, 기존 워크플로우 영향 가능성 INFO. |
| maintainability | NONE | 에러 메시지 인라인 하드코딩, 테스트 중복 assert 등 INFO 수준만. |
| testing | LOW | MySQL 드라이버 차단 테스트 누락(WARNING), env-mutation 병렬 간섭 가능성(WARNING). |
| documentation | LOW | `spec/5-system/3-error-handling.md §1.4/§3.2` 동기화 확인 필요(WARNING). |
| database | NONE | DB 운영 관점 위험 없음. SSRF 가드 위치·풀 관리·타입 안전성 모두 적절. |
| user_guide_sync | WARNING | `ERROR_KO` 한국어 매핑 누락 — 한국어 사용자에게 영문 메시지 노출. |

## 발견 없는 에이전트

- **database**: DB 쿼리·인덱스·트랜잭션·마이그레이션·스키마·풀 관리 변경 없음. 지적할 DB 위험 요소 없음.
- **security**: 알려진 한계 전부 기존 코드 재사용. 신규 취약점·알려진 취약 라이브러리 추가 없음.
- **maintainability**: 위험도 NONE. 발견사항 전부 INFO 수준.

## 권장 조치사항

1. **[SPEC-DRIFT — spec 갱신 필수]** `spec/5-system/3-error-handling.md` §1.4·§3.2 Database 행에 `DB_HOST_BLOCKED` 추가 (enum 확장 시 분류 표 행 추가 의무 — line 88 note).
2. **[SPEC-DRIFT — spec 갱신 필수]** `spec/4-nodes/4-integration/2-database-query.md` §4 callout 갱신 (`INTEGRATION_CALL_FAILED` → `DB_HOST_BLOCKED`, "향후 통일 후보" 제거) + §5.3 `output.error.code` 열거 및 §6.2 에러 코드표에 `DB_HOST_BLOCKED` 행 추가.
3. **[i18n — 사용자 가시 버그]** `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO`에 `DB_HOST_BLOCKED` 한국어 매핑 추가. `HTTP_BLOCKED`와 대칭.
4. **[Testing — 드라이버 커버리지]** `database-query.handler.spec.ts`에 MySQL credential로 `DB_HOST_BLOCKED` 차단 케이스 1건 추가.
5. **[Testing — 격리 강화]** `ALLOW_PRIVATE_HOST_TARGETS` env-mutation 테스트에 `jest.isolateModules` 적용 또는 별도 파일 분리 검토.
6. **[Info — 선택적]** `spec §5.3`에 `DB_HOST_BLOCKED` 케이스 JSON 예제 추가. `spec/conventions/chat-channel-adapter.md §3.1` `DB_*` 항목에 `DB_HOST_BLOCKED` 명시 주석 추가 검토.
7. **[Info — 선택적]** SSRF 차단 에러 메시지 공유 상수화 (3개 핸들러 간 일관성).

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행** (9명): `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `user_guide_sync`
- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (5명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |

---

*scope reviewer output_file 미존재로 해당 reviewer 결과 미포함.*