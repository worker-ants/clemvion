# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. testing reviewer 가 뮤테이션 실측으로 확인한 WARNING 2건(신규 fail-open 경로의 로그 검증 공백, 직전 라운드가 "plan 기록" 으로 처분했던 항목의 실제 미기록)이 가장 무겁고, documentation·security 의 저위험 WARNING 이 뒤따른다. forced 7명(security, requirement, scope, side_effect, maintainability, testing, documentation) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `storeEntry()` catch 블록의 `logger.warn` 호출을 제거해도 전체 테스트가 GREEN — 같은 파일의 sibling 경로(Redis GET/SET 실패)는 `jest.spyOn(Logger.prototype,'warn')` 으로 로그-제거 뮤테이션을 잡도록 설계됐는데, 이번 diff 가 새로 추가한 직렬화-실패 테스트 2건만 이 관행을 따르지 않는다. 뮤테이션으로 25/25 GREEN 생존 실측 확인 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:228-233` (storeEntry catch) / 테스트 `idempotency.interceptor.spec.ts:676`, `:701` | 두 신규 테스트(또는 그중 하나)에 `jest.spyOn(Logger.prototype,'warn')` 추가, `toHaveBeenCalledWith(expect.stringContaining('cache 직렬화 실패'))` 단언. 기존 fail-open 테스트와 동일 패턴이라 비용 낮음 |
| 2 | testing | 직전 라운드(`18_07_36`) RESOLUTION 이 "캐시 엔트리 내부 `responseJson` 손상 무방비" 를 "plan 백로그에 기록" 하겠다고 처분했으나, 같은 커밋(`147075a51`) 의 plan diff 어디에도 그 기록이 없다 — 약속과 결과가 어긋난다. 이대로 `complete/` 로 넘어가면 이 커버리지 갭 자체가 영구히 사라짐 | `review/code/2026/08/12/18_07_36/RESOLUTION.md:55` (처분 표) / `plan/in-progress/backend-lint-gate-broken-on-main.md:561-562` (실제 존재하는 유일한 인접 항목, `responseJson` 손상은 미언급) / 실제 무방비 코드: `idempotency.interceptor.ts:137`, `:143` | `plan/in-progress/backend-lint-gate-broken-on-main.md:561` 인근에 "캐시 엔트리 내부 `responseJson` 손상 — `intercept()` 137·143행 무방비 `JSON.parse`, 선재 갭(`18_07_36` testing INFO 1)" 항목을 실제로 추가 |
| 3 | documentation | 테스트 파일 모듈 docstring(세 번째 describe "Redis 런타임 장애 fail-open" 요약)이 직전 라운드(`18_07_36`)가 같은 describe 블록에 추가한 직렬화-실패 방어 테스트 2건을 반영하지 않음 — 오래된 주석, 기능 영향 없음 | `idempotency.interceptor.spec.ts:17-19` (모듈 docstring) / 누락 테스트: `:676`, `:701` (describe 블록: `:548-719`) | 19행 뒤에 직렬화 실패 방어 테스트 언급 한 문장 추가, 또는 두 테스트를 별도 describe 로 분리해 이름을 내용에 맞춤 |
| 4 | security | Idempotency 캐시 키(`redisKey`)가 execution/인증 컨텍스트로 스코프되지 않아 이론상 cross-execution 응답 재현이 가능 — 이번 diff 가 캐시 대상을 409/410 에러 응답까지 넓히며 노출 표면이 커졌다. 단, 직전 라운드(`18_07_36` RESOLUTION INFO 7·8)에서 이미 발견·"이번 PR 범위 밖" 으로 유예된 선재 갭이며 신규 회귀 아님 | `idempotency.interceptor.ts:95` (`redisKey = REDIS_KEY_PREFIX + rawKey`), 판정 `:255-257` | 캐시 키에 `executionId`(가드 검증 후 신뢰 가능한 `req.interaction.executionId` 등)를 포함해 `interaction:idempotency:${executionId}:${rawKey}` 로 네임스페이스 분리. 별도 후속 작업 트래킹 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 캐시된 에러 응답은 원 예외 payload 를 그대로 replay — 스택트레이스·내부 식별자 없어 새 정보 노출 없음. `400 VALIDATION_ERROR` 는 `isErrorStatusCacheable()` 이 명시적으로 제외해 캐시 안 됨(회귀 테스트로 고정) | `idempotency.interceptor.ts:186-201`, `:135-140` | 조치 불요 |
| 2 | security | `MAX_KEY_LENGTH`(200자) + SHA-256 body hash — 입력 검증/DoS 방어 적절 | `idempotency.interceptor.ts:23`, `:259-271` | 조치 불요 |
| 3 | requirement | §R8 원문(닫힌 목록 2xx/409/410, 400·5xx 제외)과 구현이 line-level 로 정확히 일치. 단위 테스트 25/25 재실행 통과 확인 | `spec/5-system/14-external-interaction-api.md:1055-1059` ↔ `idempotency.interceptor.ts:255-257`,`:172-178`,`:186-201` | 없음 |
| 4 | requirement | CHANGELOG 의 두 사실 주장(원 결함 도입 시점 2026-05-21, `requestId` 비재현)을 `git log`/`http-exception.filter.ts` 로 직접 검증 — 정확 | `CHANGELOG.md:8`,`:28-29` | 없음 |
| 5 | requirement | `IDEM-1`/`IDEM-3` e2e 가 상태코드만이 아니라 Redis 엔트리 자체를 직접 관측 — "캐시 재현" 과 "우연한 재처리" 를 실제로 가른다 | `external-interaction.e2e-spec.ts:418-434`,`:538-541` | 없음 |
| 6 | requirement | (범위 밖) `spec/data-flow/15-external-interaction.md:98` mermaid 다이어그램이 캐시 적재 주체를 `Svc->>Q`로 표기하나 실제는 `IdempotencyInterceptor` — 이번 diff 변경분 아닌 선재 서술 | `spec/data-flow/15-external-interaction.md:98` | 이번 PR 범위 밖. 추후 `Idem->>Q` 로 정정 권장 |
| 7 | scope | 전체 61개 파일 중 실질 파일 7개(소스 1·테스트 2·CHANGELOG·plan 2·spec SoT 1)만 단일 의도(§R8 정합화)에 대응. 나머지 52개는 5차례 리뷰/consistency 서브에이전트의 표준 산출물로, 각 라운드 fix 커밋에 동봉되어 있음을 `git show --stat` 으로 확인 | `git diff origin/main...HEAD --stat` 전량 대조 | 없음 |
| 8 | scope | `spec/data-flow/15-external-interaction.md` 의 developer 편집(캐비트 1줄 삭제)은 근거 커밋·선례·`spec-draft-eia-r8-alignment.md` 사후 planner 기록이 모두 갖춰져 있어 스코프 확장 아님 | `spec/data-flow/15-external-interaction.md` (git diff 1줄) | 없음 |
| 9 | side_effect | 직전 라운드(`18_07_36`) 지적 갭 — 직렬화-실패 fail-open 테스트 부재 — 이 이후 커밋(`147075a51`)에서 실제로 닫혔음을 확인(단, 위 WARNING #1 처럼 로그 검증까지는 못 미침) | `idempotency.interceptor.spec.ts:676-718` | 없음 |
| 10 | side_effect | 함수 시그니처·공개 인터페이스·전역 상태·환경 변수·파일시스템 변경 없음. `intercept`/생성자 무변경, 신규 메서드 전부 private/모듈 비공개 | `idempotency.interceptor.ts:88`,`:77-86` | 없음 |
| 11 | side_effect | 이번 라운드 유일 diff(`02e80d699`)는 `plan/**`·`review/consistency/**` 문서뿐 — 런타임 부작용 표면 0 | `plan/in-progress/spec-draft-eia-r8-alignment.md`, `review/consistency/2026/08/12/18_27_29/**` | 없음 |
| 12 | side_effect | (누적 재확인, 의도된 변경) 캐시 SET 빈도 증가·409/410 예외 재현이 클라이언트 관측 가능 인터페이스를 바꿈 — CHANGELOG·spec·테스트로 이미 문서화·검증됨 | `idempotency.interceptor.ts:135-140`,`:186-201`, `CHANGELOG.md:19-29` | 없음 |
| 13 | side_effect | `storeEntry` 의 Redis SET 이 fire-and-forget — 응답 반환과 캐시 적재 완료 사이 이론적 틈. 선행 라운드(`18_07_36`)에서 이미 유예 확정, 실 flaky 미관측 | `idempotency.interceptor.ts:234-240` | 조치 불요(유예 확정) |
| 14 | maintainability | (선재·4라운드 연속 유예) `JSON.parse` 가 두 지점에서 타입만 다르게 반복. `intercept()` 길이도 같은 사유로 유예 | `idempotency.interceptor.ts:137`,`:143` | 지금 손대지 말 것 — 재설계 diff 를 흐린다는 판단 반복 확인 |
| 15 | maintainability | `cacheTapped()` 성공 채널 판정이 `200`/`300` 리터럴 인라인 — 주석으로 근거 설명돼 있어 가독성 영향 미미 | `idempotency.interceptor.ts:177` | 선택 사항, 지금 불필요 |
| 16 | maintainability | (선재·4라운드 연속 유예) `IDEM-1`/`IDEM-2` e2e 셋업 블록(~25줄) 반복 — 파일 전체 확립된 관행 | `external-interaction.e2e-spec.ts:375-399`,`:452-476` | 조치 불요, 5·6번째 늘면 헬퍼 추출 고려 |
| 17 | maintainability | `isErrorStatusCacheable()` named 함수 추출 — 두 소비처가 단일 출처 공유, JSDoc 에 오답 근거 명시. 긍정 확인 | `idempotency.interceptor.ts:255-257` | 없음 |
| 18 | testing | 신규 e2e 3건이 Redis 엔트리 직접 관측(상태코드만 비교하던 최초 fixture 가 두 구현을 못 가른다는 것을 뮤테이션으로 확인 후 교체한 이력이 plan 에 남음), `makeThrowingHandler` 로 실제 error 채널 재현, 테스트 간 격리 양호, 25/25 GREEN·`tsc --noEmit` 신규 오류 없음 | `idempotency.interceptor.spec.ts:101-105`, `external-interaction.e2e-spec.ts:369-563`, `backend-lint-gate-broken-on-main.md:544-547` | 없음 |
| 19 | documentation | CHANGELOG·구현 docstring·spec 미러·plan 체크리스트·e2e 신규 블록이 5라운드 누적 최종 상태 기준 모두 사실과 정합 | `CHANGELOG.md:3-29`, `idempotency.interceptor.ts:39-257`, `external-interaction.e2e-spec.ts:361-550`, `spec/data-flow/15-external-interaction.md:258`, plan 파일 다수 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | idempotency 캐시 키 미스코프(선재, 유예됨) 재확인. 신규 결함 없음 |
| requirement | NONE | §R8 line-level 일치, CHANGELOG/e2e 재검증 완료. 신규 CRITICAL/WARNING 없음 |
| scope | NONE | 실질 파일 7개 전부 단일 의도에 대응, 드라이브바이 없음 |
| side_effect | LOW | 이번 라운드 코드 변경 0(문서만), 런타임 부작용 표면 없음. fire-and-forget SET 은 선재 유예 항목 |
| maintainability | NONE | 신규 구조적 결함 없음, 잔여 전부 4라운드 연속 유예 항목 |
| testing | MEDIUM | 신규 fail-open 테스트가 로그 검증 누락(뮤테이션 생존 실측) + plan 기록 약속 미이행 |
| documentation | LOW | 테스트 모듈 docstring stale(경미), 나머지 정합 |

## 발견 없는 에이전트

없음 — forced 7명 전원이 최소 1건 이상의 발견(WARNING 또는 INFO)을 보고함.

## 권장 조치사항

1. `storeEntry()` 직렬화-실패 신규 테스트 2건에 `jest.spyOn(Logger.prototype,'warn')` 단언 추가 — 로그-제거 뮤테이션(fail-open 이 조용해지는 회귀)을 잡도록 sibling 테스트와 동일 패턴 적용 (`idempotency.interceptor.spec.ts:676`, `:701`).
2. `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 `responseJson` 내부 손상 갭을 실제로 기록 — 직전 라운드가 이미 "기록하겠다" 처분했으나 누락됨.
3. 테스트 파일 모듈 docstring(17-19행)을 갱신해 세 번째 describe 에 추가된 직렬화-실패 방어 테스트 2건을 반영.
4. (후속, 이번 PR 비차단) idempotency 캐시 키를 `executionId` 로 네임스페이스 분리하는 별도 작업 트래킹.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — forced 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 관련성 낮음(idempotency 캐시 조건 정정, 성능 영향 없는 로직 재배선) |
  | architecture | router 판단상 관련성 낮음(구조 변경 없는 단일 결함 수정) |
  | dependency | router 판단상 관련성 낮음(신규 외부 의존성 추가 없음) |
  | database | router 판단상 관련성 낮음(DB 스키마/쿼리 변경 없음, Redis 캐시만 대상) |
  | concurrency | router 판단상 관련성 낮음(동시성 제어 로직 변경 없음) |
  | api_contract | router 판단상 관련성 낮음(공개 API 계약 무변경, 내부 캐시 판정만 수정) |
  | user_guide_sync | router 판단상 관련성 낮음(사용자 가이드 대상 표면 변경 없음) |
