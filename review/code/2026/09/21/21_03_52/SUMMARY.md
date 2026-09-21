# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. 프로덕션 코드(`codebase/backend/src/**`) 변경 0건, 순수 e2e 테스트
헬퍼 추출(3라운드째 누적 diff)이며 10개 reviewer 전원(강제 7명 포함)이 결과를 정상 반환했다.
남은 지적은 전부 INFO 수준이고 다수가 라운드 1·2에서 이미 지적·해소되었거나 저자가 근거를 남기고
명시적으로 기각한 항목의 재확인이다. 라우터가 제외한 4개 reviewer(dependency, database,
api_contract, user_guide_sync) 중 결과 누락으로 판단이 흐려진 부분은 없다 — 이 변경은 신규
의존성·DB 스키마·외부 API 계약·사용자 가이드 문서를 건드리지 않아 해당 영역들이 판정에 영향을
주지 않는다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | 공허성 가드의 `setTimeout` 타이머가 승자 분기가 정해져도 명시적으로 clear 되지 않는다(단, 가드 실패 경로는 즉시 테스트 RED 로 이어져 실무 영향 적음, 누적 누수 아님, 리팩터 전 9파일에 이미 있던 패턴이라 회귀 아님) | `codebase/backend/test/helpers/concurrency.ts` (`Promise.race([...])` 블록, ~99-104줄) | 필요 시 타이머 핸들을 저장해 `settled` 승자 시 `clearTimeout` 호출. 우선순위 낮음 |
| 2 | 아키텍처 / 부작용 | `KNOWN_LOCK_TIMEOUTS_MS` 가 사람이 수동으로 갱신해야 하는 화이트리스트이며, 모듈 로드 시점 검사가 이 상수와 무관한 8개 e2e 스위트까지 함께 묶는다. 라운드 2 fix 는 JSDoc 의 "검사 범위" 과장 문구만 정확히 좁혔을 뿐 이 결합·수동 등록 구조 자체는 그대로다(저자가 커밋 메시지로 명시적으로 기각한 트레이드오프) | `codebase/backend/test/helpers/concurrency.ts:7-14, 29-36` | 조치 불요(문서화된 한계, 의도된 fail-fast 설계). 장기적으로는 호출부가 자신의 타임아웃을 인자로 넘기는 방향(`expectedMaxMs`)을 고려할 수 있음 |
| 3 | 범위 | 이번 diff 대다수(46개 중 30여 개)가 실제 코드가 아니라 선행 두 `/ai-review`·`consistency-check --impl-prep` 라운드 산출물 커밋 | `review/code/2026/09/21/{20_26_50,20_45_43}/**`, `review/consistency/2026/09/21/19_59_55/**` | 조치 불요 — 프로젝트가 강제하는 게이트의 정상 부산물 |
| 4 | 유지보수성 | `PROJECT.md` 신규 안내 항목만 문장 전체가 굵게(bold) 처리돼 같은 목록의 다른 항목(레이블만 굵게)과 스타일이 어긋남 | `PROJECT.md:337` | `:343` 패턴을 따라 레이블만 굵게 하고 나머지는 평문으로 |
| 5 | 유지보수성 | `KNOWN_LOCK_TIMEOUTS_MS` 튜플의 표시용 이름 문자열이 실제 import 바인딩과 별도로 손으로 동기화돼야 함(상수 리네임 시 문자열은 컴파일 에러 없이 stale 해질 수 있음) | `codebase/backend/test/helpers/concurrency.ts:12-14` | 항목이 늘어나면 JSDoc 에 "리네임 시 문자열도 갱신" 문구 추가 고려. 현재는 조치 불요 |
| 6 | 테스트 | `raceUnderHeldLock()` 의 순수 동기 분기 둘(`fires.length < 2` 가드, `KNOWN_LOCK_TIMEOUTS_MS` 모듈 로드 시 불변식 검사)이 실제 Postgres 타이밍과 무관한데도 어떤 테스트로도 실행되지 않는다. 특히 후자는 이번 라운드에 "주석 → 코드 검사"로 막 승격된 방어인데 그 방어 자체가 미검증 | `codebase/backend/test/helpers/concurrency.ts`(`raceUnderHeldLock` 시작부 가드, 모듈 최상위 `for` 루프) | 두 분기만이라도 DB 불필요한 `concurrency.spec.ts` Jest unit 으로 분리해 직접 행사하는 것을 고려. blocking 아님 |
| 7 | 테스트 | `fires` N≥3 케이스·`lock.params` 생략 케이스가 JSDoc/시그니처상 지원 선언되지만 11개 호출부 전부 N=2 + 명시적 params 만 사용해 미검증(YAGNI로 유예 유지, 라운드 1·2 판단과 동일) | `codebase/backend/test/helpers/concurrency.ts` `@param fires` JSDoc vs 11개 호출부 | 조치 불요 |
| 8 | 문서화 | `@throws` 문구가 `BEGIN` 쿼리 자체의 실패(try 블록 밖, finally 미개입)와 `lock.sql` 실패(try 블록 안, finally 개입)를 구분하지 않음 | `codebase/backend/test/helpers/concurrency.ts:62-64` vs `:89` | 선택 사항 — "`BEGIN`/`lock.sql` 자체가 실패하면"으로 한 단어만 확장. blocking 아님 |
| 9 | 동시성 | `locker !== db`(락 커넥션 ≠ 검증 커넥션) 불변식이 JSDoc 서술로만 존재하고 런타임으로 강제되지 않음(현재 9개 호출부는 전수 확인 결과 준수 중) | `codebase/backend/test/helpers/concurrency.ts:55-56`(`@param locker`) | JSDoc 옆에 "이 헬퍼는 이 불변식을 검사하지 않는다"는 한계 고지 추가 고려. blocking 아님 |
| 10 | 요구사항 | 관련 spec 문서 부재(`spec/` 전역에 `raceUnderHeldLock`/공허성 가드 언급 0건) — spec fidelity 이슈가 아니라 spec 이 관여할 층이 아님(테스트 하네스 리팩터, `spec_impact: none`과 일치) | `spec/` 전역 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션 없음(전부 파라미터 바인딩), 하드코딩 값은 로컬 e2e stub, 인가 단언 무변경, 신규 의존성 없음 |
| performance | NONE | 알고리즘/N+1/블로킹 I/O 영향 없음. setTimeout 미정리 INFO 1건(기존 패턴 계승, 회귀 아님) |
| architecture | NONE | 단일 책임·인터페이스 분리 양호, 구조가 다른 파일(integration-rotate) 의도적 배제. INFO 2건(수동 레지스트리, 모듈 로드 시점 결합) |
| requirement | NONE | 9파일 11블록 단언·에러코드 전수 동치 확인. 라운드 2 WARNING 은 근거 남기고 명시적 기각으로 종결 |
| scope | NONE | plan 사전 계획과 실행 정확히 일치, 프로덕션 코드/assertion/제외파일/매직넘버 처리 범위 위반 없음 |
| side_effect | NONE | 트랜잭션/전역변수/네트워크/파일시스템 부작용 전수 확인, 문제 없음. INFO 2건(모듈 로드 결합 구조 잔존, 수동 레지스트리 자동감지 부재) |
| maintainability | LOW | 상수 위치·근거 중복·검사 범위 과장 등 라운드 1·2 지적 전부 해소. INFO 2건(PROJECT.md 볼드 스타일, 표시 문자열 수동 동기화) |
| testing | LOW | 378/378 e2e 회귀 없음, 정렬 비교자 전수 숫자형, 음성 대조군(뮤테이션 11 RED) 검증됨. INFO 2건(순수 동기 분기 미검증, N≥3 미검증) |
| documentation | NONE | JSDoc 모범적 완전성, 라운드 1·2 지적 전부 해소(코드가 자기 주장 범위를 스스로 좁힘). INFO 1건(`@throws` BEGIN/lock.sql 구분 부재) |
| concurrency | LOW | 핵심 락/발사/가드/finally 로직 라운드 1·2와 동일, `locker≠db` 불변식 9개 호출부 전수 준수 확인. INFO 1건(불변식 런타임 미강제) |

## 발견 없는 에이전트

security, performance, architecture, requirement, scope, side_effect, documentation — CRITICAL/WARNING 없음(INFO만 존재하거나 전무).

## 권장 조치사항

1. (선택, 우선순위 최상) `KNOWN_LOCK_TIMEOUTS_MS` 순회 검사 및 `fires.length < 2` 가드처럼 실제 DB 타이밍과 무관한 순수 동기 분기를 `concurrency.spec.ts` 같은 DB 불필요 Jest unit 으로 분리해 직접 행사 — 방금 승격된 "주석 대신 코드로 고정" 방어 자체가 현재 미검증 상태.
2. (선택) `PROJECT.md:337` 볼드 스타일을 같은 목록의 다른 항목(레이블만 굵게)에 맞춰 통일.
3. (선택) `@throws` 문구를 "`BEGIN`/`lock.sql` 자체가 실패하면"으로 넓혀 정리 경로(finally 개입 여부)가 다른 두 실패를 구분.
4. 나머지 INFO(setTimeout 미정리, 레지스트리 표시 문자열 수동 동기화, `locker≠db` 런타임 미강제, N≥3 미검증)는 모두 blocking 아님 — 문서화된 한계로 남겨두는 것으로 충분.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단(이번 diff 는 신규 의존성/lockfile 변경 없음 — 각 reviewer 도 독립적으로 "신규 의존성 없음" 확인) |
  | database | 라우터 판단(프로덕션 스키마/마이그레이션 변경 없음 — 테스트 전용 리팩터) |
  | api_contract | 라우터 판단(공개 API 시그니처/응답 계약 변경 없음 — 프로덕션 코드 변경 0건) |
  | user_guide_sync | 라우터 판단(사용자 대상 가이드 문서 변경 없음 — `PROJECT.md` 는 개발자 내부 e2e 가이드) |

  (라우팅 매니페스트에 reviewer별 상세 사유 문자열은 포함되지 않아, 위 사유는 실행된 10개 reviewer의 교차 확인 내용에 근거해 기록함. 신규 의존성 0건·프로덕션 코드 변경 0건이라는 사실은 security/performance/architecture/scope 등 다수 reviewer가 독립적으로 재확인했다.)
