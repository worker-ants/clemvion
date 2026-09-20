# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** `rotate()` 의 `pessimistic_write` 대기에 상한(lock/statement timeout)이 없다 — 사용자가 반복 클릭·재시도로 같은 통합에 rotate 를 연달아 쏘면 각 대기 트랜잭션이 DB 커넥션 풀 자리를 하나씩 점유한 채 앞선 트랜잭션의 COMMIT 을 기다린다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1146` (`this.dataSource.transaction(async (manager) => { ... })` 블록 시작부, 특히 1148-1151행의 `repo.findOne({ ..., lock: { mode: 'pessimistic_write' } })`)
  - 상세: PR 자체 주석(1141행)과 `plan/in-progress/rotate-lost-update.md` §B "INFO 2" 가 이 트레이드오프를 이미 인지하고 있고, 근거로 삼은 선례(`integration-oauth.service.ts` CONC H-3, 690-732행)도 같은 설계다. 다만 CONC H-3 은 사용자가 직접·반복적으로 트리거하기 어려운 OAuth 콜백인 반면, `rotate()` 는 프런트엔드 버튼 클릭으로 임의 반복 호출이 가능한 표면이라 위험 프로파일이 약간 다르다. 임계 구간 자체(재읽기+머지+UPDATE, 외부 I/O 없음)는 짧아 정상 상황에서는 문제가 되지 않지만, 같은 행을 겨냥한 동시 요청이 다수 몰리면 커넥션 풀 고갈로 이어질 潜在적 경로가 남는다.
  - 제안: 새 결함은 아니고 설계 문서에서 이미 다룬 트레이드오프이므로 이번 PR 을 막을 사유는 아니다. 다만 rotate 엔드포인트에 요청 빈도 제한(rate limit)이나 짧은 `statement_timeout`/`lock_timeout` 을 얹는 후속 검토를 권장한다.

- **[INFO]** 트랜잭션 내부 재검증(scope/구조 검증)은 완전하지만 `authType` 은 락 안에서 다시 확인하지 않는다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1087` (최초 `entity.authType === 'oauth2'` 검사) vs 1146-1209행 트랜잭션 블록(`fresh.authType` 은 `validateCredentials` 인자로만 쓰이고 `oauth2` 여부 재검사는 없음)
  - 상세: 저장소 전수 검색 결과 `authType` 은 통합 생성(`create()`) 시점에만 쓰이고 이후 어떤 경로도 기존 행의 `authType` 을 변경하지 않는다(사실상 불변 컬럼) — 그래서 이 갭이 실제로 악용 가능한 TOCTOU 는 아니다. 다만 향후 "서비스 전환/재구성" 같은 기능이 `authType` 을 변경 가능하게 만들면, 이 재검증 누락이 조용히 실질적 문제가 된다.
  - 제안: 현재는 조치 불요. `authType` 변경 경로가 생기면 그때 락 안에서 재확인을 추가.

## 검증 참고 (뮤테이션 없이 정적 확인)

- `integration-oauth.service.ts` 의 CONC H-3 패턴과 대조해 락 순서·범위를 확인했다 — 두 흐름 모두 **단일 테이블의 단일 행(PK)** 에 대해서만 `pessimistic_write` 를 잡고, 트랜잭션 안에서 추가 행/테이블을 잠그지 않는다. 따라서 락 획득 순서 역전으로 인한 데드락 경로는 없다.
- 외부 I/O(연결 테스트, `dispatchTest`)가 트랜잭션 **밖**에서 완전히 끝난 뒤 트랜잭션이 시작되므로, 락 보유 시간에 네트워크 지연이 섞이지 않는다 — PR 이 스스로 반박하는 "기각된 advisory lock 재도입" 우려에 대한 근거가 코드와 일치한다.
- `logUsage()` 는 이 락을 잡지 않는 단발 원자적 `update()` 라서 rotate 의 트랜잭션과는 값 충돌(잠금 대기)만 있고 데드락은 없다. `save(entity)` 대신 부분 `update()` 를 유지해 `logUsage` 가 쓴 컬럼을 되돌리지 않는다는 주석의 불변식도 코드와 일치.
- 단위 테스트(`integrations.service.spec.ts` 1337-1422행)와 e2e(`integration-rotate-concurrency.e2e-spec.ts`)를 대조 확인 — e2e 는 우연한 타이밍에 기대지 않고 별도 커넥션이 `SELECT ... FOR UPDATE` 로 같은 행의 실제 Postgres 락을 쥔 채로 두 번째 rotate 요청이 반드시 그 락에서 대기하도록 강제한다(103-113행 "공허성 가드" 로 실제로 막혔음을 확인 후 진행). 판별력 주장("고치기 전 코드로 되돌리면 RED")도 plan 체크리스트(`rotate-lost-update.md` 112-114행)에 실측 근거가 함께 적혀 있어 신뢰할 만하다.
- 저장소를 뮤테이션하지 않고 `Read`/`grep` 만으로 검증했다 — 원복이 필요한 변경 없음, `git status` 오염 없음.

## 요약

이 변경은 `rotate()` 의 실제 lost-update 결함(연결 테스트가 도는 수 초 동안 요청 시작 시점 스냅샷 위에 머지해 먼저 커밋된 동시 교체를 되돌리던 문제)을 같은 모듈에 이미 검증된 패턴(외부 호출은 트랜잭션 밖, `pessimistic_write` 락 안에서 재읽기·재검증·부분 update)으로 닫는다. 락 범위가 단일 행에 한정돼 데드락 경로가 없고, 권한(scope) 재검증까지 락 안으로 옮겨 TOCTOU 를 함께 닫았으며, 단위·e2e 테스트가 실제 Postgres 행 락으로 겹침을 강제해 판별력을 실증한다. 새로 도입된 Critical/Warning 급 동시성 결함은 발견하지 못했고, 잠금 대기 상한 부재는 설계 문서가 이미 다룬 트레이드오프라 이번 PR 을 막을 사유는 아니다.

## 위험도
LOW
