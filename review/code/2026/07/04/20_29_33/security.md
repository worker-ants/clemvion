# 보안(Security) Review

## 스코프 확인

Payload 는 test-only changeset (unit + e2e, PR2b §8 admission gate 회귀)이라는 설명과 일치했다.
`git diff origin/main...HEAD` (worktree: `admission-regression-6e26a2`) 로 교차 검증한 결과 동일한
10개 파일이 나왔으며, mis-scope/generic 정황은 없어 fallback 없이 payload 그대로 리뷰했다.

- 파일 1: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (unit, +44/-0)
- 파일 2: `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` (e2e, +81/-13 순)
- 파일 3~10: `review/consistency/2026/07/04/20_09_53/**` — consistency-checker 산출 문서/JSON (SUMMARY, retry_state, convention_compliance, cross_spec, meta, naming_collision, plan_coherence, rationale_continuity). 코드가 아닌 리뷰 아티팩트이며 실행 경로에 포함되지 않음.

추가로 테스트가 고정(lock-in)하는 실제 프로덕션 코드 경로
(`ExecutionEngineService.admitExecutionOrDefer`, `execution-engine.service.ts:2622-2683` 부근)도
정합성 확인을 위해 함께 열람했다 — 이 파일 자체는 이번 diff 대상이 아니다.

## 발견사항

없음 (No findings).

검토 근거:

- **인젝션**: 테스트가 검증하는 조건부 UPDATE SQL(`execution-engine.service.ts:2661-2671`)은 `$1`~`$5` 전부 파라미터 바인딩이며 문자열 보간 없음. e2e 테스트의 `db.query` 호출들(`execution-concurrency-cap.e2e-spec.ts:1613,1682,1833,1845,1906,1965` 부근)도 전부 `$1`/`$2` placeholder 사용, 리터럴 삽입 없음. unit spec 의 assertion 도 동일 파라미터 배열을 검증할 뿐 SQL 문자열을 직접 구성하지 않음.
- **하드코딩된 시크릿**: 발견 없음. 테스트 인증은 `authHeader()` 가 `registerAndLogin` 헬퍼로 획득한 런타임 토큰(`ownerToken`)을 사용, 고정 크리덴셜 없음. review 아티팩트(files 3-10)에서도 `password_changed` 같은 규약 문서상의 액션명 언급뿐, 실제 시크릿 값 없음.
- **인증/인가**: e2e 신규 케이스(`execution-concurrency-cap.e2e-spec.ts:1938-1975`, workspace-level cap 테스트)는 `createTeamWorkspace` + `X-Workspace-Id` 헤더로 별도 워크스페이스를 격리 생성해 cap 검증을 하는 정상 패턴이며, 인가 우회 시도나 우회 가능성을 만드는 변경 없음. `createCapWorkflow`/`execute`/`getStatus`/`poll` 헬퍼에 `wsId` 파라미터를 추가한 것은 멀티 workspace 시나리오 지원용 리팩터로, 기존 인가 헤더 전달 방식은 그대로 유지.
- **입력 검증**: 테스트 코드이므로 사용자 입력 검증 대상이 아님. 프로덕션 admission 경로의 `wfCap`/`wsCap` 은 `resolveConcurrencyCap` 을 통해 로드되며 이번 diff 범위 밖.
- **암호화**: 관련 없음(평문 전송/해시 알고리즘 변경 없음). 테스트는 `http://` BASE_URL 을 쓰지만 이는 기존 e2e 인프라(docker-compose 내부망) 관례로 이번 diff 로 신규 도입된 것이 아님.
- **에러 처리**: `EXECUTION_QUEUE_WAIT_TIMEOUT` 등 에러 코드 노출은 의도된 도메인 에러 계약(§8)이며 스택트레이스/내부 경로 등 민감정보 노출 아님.
- **의존성 보안**: 이번 diff 에 신규 의존성 추가 없음(`pg`, `supertest`, `@jest/globals` 등 기존 사용 패키지만 계속 사용).
- **동시성/레이스 관련 참고(정보용, 보안 취약점 아님)**: 테스트 주석(`execution-engine.service.ts:2649-2656`)이 명시하듯 이전에 조건부 UPDATE 단독으로는 TOCTOU race 가 있었고 현재는 `pg_advisory_xact_lock` 로 직렬화한다. 이번 diff 는 그 안전장치가 정확한 파라미터 순서/워크스페이스 스코프로 동작함을 회귀 고정하는 테스트이며, 오히려 동시성 방어를 강화 확인하는 방향이라 보안 리스크를 낮추는 변경.

## 요약

이번 변경은 순수 테스트 코드(unit + e2e)로, admission gate(§8)의 원자 UPDATE 파라미터 순서·cap 매핑, advisory-lock 키 스코프, 그리고 admission 결과(admitted/deferred/cancelled)별 후속 분기를 고정하는 회귀 테스트다. 검증 대상 SQL 은 전부 파라미터라이즈드 쿼리이며 문자열 보간이나 사용자 입력 직접 삽입이 없어 SQL 인젝션 위험이 없다. 하드코딩된 시크릿, 인증/인가 우회, 민감정보 노출, 취약 암호화 알고리즘 등 OWASP Top 10 관련 이슈도 발견되지 않았다. 동봉된 `review/consistency/**` 아티팩트는 실행되지 않는 문서/JSON 산출물로 보안 표면이 없다. 전반적으로 테스트 강화만 이루어진 안전한 변경이다.

## 위험도

NONE
