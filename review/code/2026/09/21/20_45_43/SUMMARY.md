# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 코드(`codebase/backend/src/**`) 변경 0건인 순수 e2e 테스트 헬퍼 추출 리팩터. Critical 없음, WARNING 1건(테스트 전용 헬퍼의 도메인 역방향 결합)만 존재하며 사용자 대면 리스크 없음. forced(router_safety) 화이트리스트 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처(결합도) | 도메인 무관 범용 e2e 헬퍼 `raceUnderHeldLock()` 이 자기 안전검사(공허성 가드 상한 assert)를 위해 트리거 도메인 전용 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 를 직접 import — SRP/DIP 역행. 이 상수가 이동·삭제되면 트리거와 무관한 7개 호출부(`auth-config`·`integration`·`member-remove`·`model-config`·`webauthn-credential`·`workflow`·`workspace`)까지 모듈 로드 시점에 동시 실패한다. 또한 이 assert 는 "프로덕션 전역 최소 잠금 상한" 이 아니라 "현재 알려진 상수 하나" 와만 비교하므로, 향후 더 짧은 `lock_timeout` 을 쓰는 신규 호출부가 추가돼도 감지하지 못한다(database·concurrency·side_effect·maintainability reviewer 도 동일 지점을 INFO 로 공통 지적). | `codebase/backend/test/helpers/concurrency.ts:4, 17-24` | 상수를 헬퍼 밖으로 빼내거나 `guardMs` 를 파라미터화하고, "가장 짧은 상한" 검증 책임은 그 상수를 아는 호출부(트리거/스케줄 스펙)에 맡긴다. 최소한 JSDoc 문구를 "현재 알려진 가장 짧은 상한(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)과만 비교 — 신규 도메인 추가 시 갱신 필요" 로 실제 검증 범위에 맞게 좁힌다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화(requirement) | 헬퍼 JSDoc `@example` 이 숫자 비교자 없는 기본 `.sort()` 사용 — 현재 예시값(`[204, 404]`)에서는 우연히 맞지만 다른 값으로 복제 시 사전식 정렬로 깨질 수 있음. 실제 11개 호출부는 전부 숫자 비교자를 씀. | `codebase/backend/test/helpers/concurrency.ts:59` | `.sort((a, b) => a - b)` 로 예시 수정. |
| 2 | 테스팅 | 이번 라운드 신규 module-load assert(`VACUITY_GUARD_MS >= TRIGGER_DELETE_LOCK_TIMEOUT_MS` throw)와 기존 `fires.length < 2` 가드, N≥3/params 생략 경로가 어떤 테스트로도 행사되지 않는 방어 코드로 남아 있음. | `codebase/backend/test/helpers/concurrency.ts:19-24, 66-71` | YAGNI로 조치 불요. 필요 시 `jest.isolateModules` 기반 저비용 단위 테스트로 throw 분기만 별도 검증 가능. |
| 3 | 문서화 | `@throws` 가 명시적 throw 두 경로(입력 검증, 공허성 가드)만 문서화하고 `locker.query(...)` 자체의 실패(락 쿼리 reject) 경로는 다루지 않음. | `codebase/backend/test/helpers/concurrency.ts` (`@throws` 블록) | 필요 시 `@throws` 에 "lock 쿼리 자체가 실패하는 경우" 한 줄 추가. blocking 아님. |

## 문제 없음으로 확인된 항목 (별도 분류)

- **보안**: SQL 인젝션 표면 없음(전 쿼리 파라미터 바인딩), 하드코딩 시크릿 없음, 인증/인가 단언 로직 무변경, 에러 메시지 정보 노출 없음, 신규 의존성 없음.
- **범위(scope)**: fix 커밋이 직전 리뷰 라운드 지적사항에만 정확히 대응, 드라이브바이 변경 없음, 프로덕션 코드 변경 0 유지, 단언 변경 0 유지, `integration-rotate-concurrency` 제외 결정 실측과 일치.
- **부작용**: 공개 시그니처·호출 순서·트랜잭션 경계·전역 상태·환경변수·네트워크 호출 전부 변경 없음.
- **DB**: 인덱스·N+1·트랜잭션·마이그레이션·스키마·커넥션 관리·SQL 인젝션·대량 데이터 전 항목 문제없음(테스트 fixture 규모, 프로덕션 쿼리 무변경).
- **유지보수성**: 함수 길이·복잡도·매직넘버·네이밍 전부 양호, 직전 라운드 WARNING/INFO(문서 미반영, 상수 위치, 근거 중복) 모두 실제로 해소됨.
- **문서화**: `PROJECT.md` 헬퍼 소개가 정확·완전, CHANGELOG 미갱신은 컨벤션상 올바른 판단.
- **유저 가이드 동반 갱신**: `doc-sync-matrix.json` 21개 trigger 전수 대조, 매칭 0건 — `codebase/backend/src/**`/`codebase/frontend/**` 변경이 없어 해당 없음.
- **동시성**: 락 획득 순서·`Promise.race` 공허성 가드·`finally` ROLLBACK/pending 흡수 로직 변경 없음, 이전 라운드 검증과 동일 결론.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 인젝션/시크릿/인증 우회 등 전 항목 문제없음 |
| architecture | LOW | 범용 헬퍼의 트리거 도메인 상수 역방향 결합(WARNING) |
| requirement | NONE | 9개 호출부 단언 전부 behavior-preserving, JSDoc 예시 사소한 INFO |
| scope | NONE | fix 커밋이 직전 라운드 지적에만 정확히 대응, 범위 이탈 없음 |
| side_effect | NONE | 시그니처/트랜잭션/전역상태 영향 없음, 결합 이슈는 INFO로 하향 |
| maintainability | NONE | 직전 라운드 지적 전부 해소, 신규 결함 없음 |
| testing | NONE | 378/378 e2e PASS 재확인, 방어 코드 미검증은 INFO |
| documentation | LOW | PROJECT.md 갱신 정확, `@throws` 경미한 누락 |
| database | NONE | 스키마·트랜잭션·인덱스 전 항목 문제없음 |
| concurrency | LOW | assert 범위가 "알려진 상수 하나" 로 한정(INFO) |
| user_guide_sync | NONE | 매트릭스 21개 trigger 매칭 0건, 해당없음 |

## 발견 없는 에이전트

requirement, scope, database, user_guide_sync — Critical/Warning 없음, 확인된 INFO 도 모두 "조치 불요" 로 종결.

## 권장 조치사항

1. (선택, blocking 아님) `raceUnderHeldLock()` 의 트리거 도메인 상수 직접 import 를 파라미터화하거나, JSDoc 문구를 "현재 알려진 가장 짧은 상한과만 비교" 로 실제 검증 범위에 맞게 좁힌다 — 다음 도메인이 이 헬퍼를 확장할 때 결합 방향과 검증 범위를 문서와 일치시키기 위함.
2. (선택) `@example` 의 `.sort()` 에 숫자 비교자를 추가해 향후 복제 시 함정을 제거한다.
3. (선택) `@throws` 에 락 쿼리 자체 실패 경로를 한 줄 추가한다.

이 세 항목 모두 착수를 막을 사안이 아니며, 현재 diff 는 병합 관점에서 안전하다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync` (11명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)
  - **제외**: 아래 표 (3명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 프로덕션 코드 변경 0, 성능 영향 없는 테스트 전용 리팩터로 router 판단 |
  | dependency | 신규/변경 의존성 없음(package.json·lockfile 무변경)으로 router 판단 |
  | api_contract | API 엔드포인트/DTO/컨트롤러 변경 없음(테스트 파일만)으로 router 판단 |
