# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 코드 변경 0건의 순수 e2e 테스트 헬퍼(`raceUnderHeldLock()`) 추출 리팩터. CRITICAL 없음, WARNING 1건(문서 갱신 누락)만 발견. forced whitelist(7명) 전원 결과 확보 확인됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `PROJECT.md` §"Backend e2e 패턴 (supertest)" 절이 기존 헬퍼(`helpers/db.ts`·`helpers/auth.ts`)는 이름까지 콕 집어 안내하면서 신규 공용 헬퍼 `raceUnderHeldLock()`(동시성/race condition 검증용, 바로 위 절에서 e2e 작성 트리거로 명시된 범주)은 언급하지 않는다. 이 리팩터의 존재 이유 자체가 "다음 작성자가 또 손으로 복제하다 가드를 빠뜨리는 것"을 막는 것인데, 그 작성자가 실제로 참고하는 가이드 문서에는 헬퍼가 나타나지 않아 재발 방지 목적이 가이드 레벨에서 미완결이다. | `PROJECT.md:315-336`(특히 335-336) | `helpers/db.ts`/`helpers/auth.ts` 소개 옆에 "동시성/race condition 검증: `helpers/concurrency.ts` 의 `raceUnderHeldLock(locker, lock, fires)`" 한 줄 추가. plan 체크리스트의 마무리 커밋에서 함께 반영 가능 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/부작용/동시성 | `VACUITY_GUARD_MS`(1.5초) 공허성 가드 대기시간이 파라미터화되지 않은 전역 상수로 고정됨. 현재 11개 호출부 전부 동일 값이었음을 실측(plan §B)으로 확인해 지금은 안전하지만, 향후 `lock_timeout` 이 더 짧은 새 호출부가 이 헬퍼를 재사용하면 "겹침 실패"와 "락/애플리케이션 타임아웃"을 구분하지 못하고 가드가 조용히 오탐(무력화)될 수 있다. 이 리팩터로 인해 실패 반경이 1파일→11콜사이트로 넓어진 특성도 있음 | `codebase/backend/test/helpers/concurrency.ts:87`(선언), `:38-42`(시그니처), `:61-63`(근거 주석) | 필요해지면 `guardMs?: number` 선택 인자 추가(기본값 1500 유지)로 하위호환 유지한 채 확장. 또는 `VACUITY_GUARD_MS < TRIGGER_DELETE_LOCK_TIMEOUT_MS` 를 확인하는 assert/단위테스트 추가 |
| 2 | 유지보수성/문서화 | `VACUITY_GUARD_MS` 상수 선언이 사용 지점(67번 줄)보다 파일 아래쪽(87번 줄)에 위치하고, "트리거 삭제 경로 `lock_timeout` 5초" 라는 선택 근거가 함수 본문 인라인 주석과 상수 JSDoc 두 곳에 거의 같은 문장으로 중복 서술됨. 근거가 바뀌면 한쪽만 갱신되고 다른 쪽이 stale 로 남을 위험. 또한 다른 7개 호출부를 다루는 사람이 "트리거" 얘기만 보면 혼동할 소지 | `codebase/backend/test/helpers/concurrency.ts:60-63`, `:83-87` | 상수 선언을 함수 정의 위(import 직후)로 이동하고 근거 설명을 한 곳으로 통합. 범위를 "9개 delete-concurrency 스위트 공유, 그중 트리거/스케줄 경로의 5초 제약이 가장 타이트" 로 명시 |
| 3 | 아키텍처/부작용/테스트 | 공유 헬퍼가 Jest `expect()`(`@jest/globals`)를 내부에서 직접 호출해 공허성 가드 단언을 헬퍼 안에서 던짐. 가드를 호출부가 빠뜨릴 수 없게 만드는 의도적 설계(plan §A, #1376 재발 방지)이지만, 실패 시 스택트레이스 최상위 프레임이 각 `*.e2e-spec.ts` 가 아니라 `helpers/concurrency.ts` 로 수렴해 디버깅에 한 단계 더 필요 | `codebase/backend/test/helpers/concurrency.ts:1`, `:70` | 조치 불요(트레이드오프로 수용). 필요시 에러 메시지에 `lock.sql` 포함해 어떤 락이 실패했는지 표시 |
| 4 | 요구사항/문서화 | JSDoc `@throws` 가 "공허성 가드 실패 시"만 서술하고, 함수가 실제로 던지는 또 다른 경로(`fires.length < 2` 검증 실패)는 문서화되지 않음 | `codebase/backend/test/helpers/concurrency.ts:28` vs `:43-48` | `@throws` 를 두 항목("thunk 2개 미만 시 즉시 던짐" / "공허성 가드 실패 시")으로 보강 |
| 5 | 요구사항 | `spec/` 전체에 이 헬퍼·"동시성 e2e" 관련 문서 없음(grep 0건) — 다만 이 변경은 사용자 대면 API/비즈니스 규칙을 바꾸지 않는 테스트 인프라 리팩터라 spec 이 관여할 층이 아님. `spec_impact: none` 선언 및 `--impl-prep` consistency-check(BLOCK:NO, Critical/Warning 0)와 일치 | `spec/` 전체 | 조치 불요 |
| 6 | 스코프 | `fires.length < 2` 런타임 가드가 plan(`e2e-race-helper.md` §B/§D)에 명시되지 않았던 방어 로직으로 신규 추가됨. 헬퍼 자체의 목적(겹침 생성엔 2개 이상 필요)에 직결된 5줄짜리 안전장치라 범위를 벗어난 기능 확장으로 보기는 어려움 | `codebase/backend/test/helpers/concurrency.ts:43` | 조치 불요. 다음 확장 시 plan 체크리스트에 한 줄 기록 권장 |
| 7 | 테스트 | 공유 헬퍼(`raceUnderHeldLock`) 자체에 대한 독립 단위 테스트가 없음. 다만 실제 `pg.Client` 트랜잭션/락 타이밍에 의존하는 함수라 mock 기반 단위 테스트는 오히려 허위 안전감을 만들 위험이 있어 e2e 간접 검증(음성 대조군 11 RED)이 더 적절한 선택으로 보임 | `codebase/backend/test/helpers/concurrency.ts:38-81` | 조치 불요(YAGNI). 필요시 `fires.length<2` 케이스만 mocked `Client` 로 저비용 단위테스트 추가 가능 |
| 8 | 테스트 | JSDoc 은 `fires` 2개 이상을 지원한다고 선언하지만, 실제 11개 호출부 전부 정확히 2개뿐 — N≥3 케이스의 `Promise.all`/정렬 계약은 미검증 | `codebase/backend/test/helpers/concurrency.ts:25-26` vs 11개 호출부 | 조치 불요(YAGNI). 3자 이상 겹침을 다루는 e2e 추가 시 그 자리에서 검증 |
| 9 | 스코프 | `review/consistency/2026/09/21/19_59_55/**` 8개 파일이 diff 에 포함됨 — 무관한 변경이 아니라 프로젝트가 강제하는 `consistency-check --impl-prep` 게이트의 정상 산출물(plan 체크리스트에도 BLOCK:NO 기록) | `review/consistency/2026/09/21/19_59_55/` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견사항 없음 — SQL 파라미터 바인딩만 사용, 하드코딩 값은 기존 로컬 e2e stub, 인증/인가 단언 무변경, 신규 의존성 없음 |
| architecture | LOW | `VACUITY_GUARD_MS` 확장성(INFO), `expect()` 헬퍼 내부 결합(INFO). DRY 추출·레이어 경계 준수는 긍정적 관찰 |
| requirement | NONE | `@throws` 문서 갭(INFO), spec 문서 부재는 해당 없음(INFO). 9파일 1:1 동치성·webauthn 비대칭 케이스 정상 수용 확인 |
| scope | NONE | `fires.length<2` 가드 plan 미기재(INFO), consistency 산출물 포함은 정상(INFO). `git diff origin/main HEAD --stat` 로 19개 파일 완전 일치 확인 |
| side_effect | NONE | `VACUITY_GUARD_MS` 고정(INFO), expect 스택 위치 이동(INFO). 트랜잭션/전역상태/네트워크 부작용 없음 확인 |
| maintainability | LOW | 상수 선언 위치·근거 중복 서술(INFO 2건). DRY·SRP·정렬 로직 분리 등은 긍정적 관찰 |
| testing | NONE | 헬퍼 단독 단위테스트 부재(INFO), N≥3 미검증(INFO), expect 스택 이동(INFO). 378/378 e2e PASS 로그 직접 확인, 음성 대조군 11 RED 근거 확인 |
| documentation | LOW | `PROJECT.md` e2e 가이드 미반영(**WARNING**), `@throws` 갭·상수 근거 중복(INFO 2건). 헬퍼 JSDoc 자체는 모범적 |
| concurrency | LOW | `VACUITY_GUARD_MS` 확장성(INFO). 락 획득→발사 순서, COMMIT/ROLLBACK, unhandled rejection 흡수 등 동시성 동작 불변 확인 |

## 발견 없는 에이전트

- security (CRITICAL/WARNING/INFO 대상 미검출을 명시적으로 보고)

## 권장 조치사항

1. `PROJECT.md` §"Backend e2e 패턴 (supertest)" 절에 `raceUnderHeldLock()` 헬퍼 소개 한 줄 추가 (WARNING 해소 — 이 리팩터가 막으려는 "다음 작성자가 또 손으로 복제" 위험을 가이드 레벨에서도 차단)
2. `VACUITY_GUARD_MS` 를 향후 확장에 대비해 `guardMs?: number` 선택 인자로 열어두거나, 프로덕션 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 와의 관계를 assert 로 코드화 검토 (현재 결함 아님, 확장성 예방 조치)
3. `VACUITY_GUARD_MS` 상수 선언을 함수 정의 위로 이동하고, 중복된 근거 설명(인라인 주석 + JSDoc)을 한 곳으로 통합
4. `raceUnderHeldLock()` JSDoc `@throws` 에 `fires.length < 2` 실패 경로 추가 명시

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency (9명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **forced 전원 결과 확보됨**, 화이트리스트 미이행 없음
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(순수 테스트 리팩터, 프로덕션 코드 변경 0)와 관련성 낮음 |
  | dependency | 신규/변경 의존성 없음 |
  | database | 스키마/마이그레이션 변경 없음 |
  | api_contract | API 응답/계약 변경 없음 |
  | user_guide_sync | 최종 사용자 대면 문서 변경 대상 아님 |
