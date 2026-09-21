# 동시성(Concurrency) 코드 리뷰

## 범위

이번 diff 는 프로덕션 코드 변경이 **0**건이다. 아홉 개 e2e 동시성 테스트 파일(11 블록)에 손으로
복제돼 있던

```
BEGIN → 락 쿼리 → 두 요청 발사 → 공허성 가드(Promise.race, 1.5초) → COMMIT → 결과 반환
finally: ROLLBACK + pending 흡수
```

블록을 `codebase/backend/test/helpers/concurrency.ts` 의 `raceUnderHeldLock()` 로 추출하는 순수
테스트 리팩터이고, `PROJECT.md` 에 그 헬퍼 사용을 의무화하는 가이드 한 문단이 추가됐다. 나머지
파일(`plan/in-progress/e2e-race-helper.md`, `review/**` 산출물)은 계획·이전 리뷰 산출물로 실행
경로 밖이라 동시성 관점 검토 대상이 아니다.

이 정확히 같은 헬퍼 함수 본문은 이전 두 라운드(`review/code/2026/09/21/20_26_50/concurrency.md`,
`review/code/2026/09/21/20_45_43/concurrency.md`)에서 이미 검토됐고 Critical/Warning 없이 LOW 로
판정됐다. `codebase/backend/test/helpers/concurrency.ts` 를 직접 `Read` 로 재확인한 결과 함수
본문(76~116줄)은 그 라운드 이후 변경되지 않았다. 본 라운드는 (1) 그 판정을 독립적으로 재검증하고
(2) 9개 호출부 전부가 실제로 `locker`≠`db` 불변식을 지키는지 직접 확인했다.

## 검증 방법

- `codebase/backend/test/helpers/concurrency.ts` 전체를 `Read` 로 읽어 diff 게이트 줄 번호와 실제
  파일 줄 번호 일치를 확인.
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts:128` 을 읽어
  `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`(리터럴, 환경변수·비동기 초기화 의존 없음)임을 확인 —
  `VACUITY_GUARD_MS(1_500) < 5_000` 이라 모듈 로드 시점 assert 가 통과함을 검증.
- diff 에 원문이 생략된 `webauthn-credential-delete-concurrency.e2e-spec.ts` 를 `Read` 로 전체
  직접 읽음 — 이 파일이 유일하게 서로 다른 thunk(`fireDelete(idA)`/`fireDelete(idB)`)를 넘기는
  호출부라 추출 과정에서 결과-요청 매핑이 깨지기 가장 쉬운 자리이므로 별도 확인.
- 9개 호출부 전부에서 `db = createDbClient()` 와 `locker = createDbClient()` 가 별도 `Client`
  인스턴스로 생성되는지 `grep` 으로 전수 확인(auth-config·integration·member-remove·model-config·
  schedule·trigger·workflow·workspace·webauthn-credential 전부 확인됨) — 헬퍼 JSDoc 이 요구하는
  "락 커넥션 ≠ 검증 커넥션" 불변식이 실제로 지켜짐.
- 저장소 파일은 뮤테이션하지 않았다(read-only 리뷰, `git status --short` 로 확인할 변경 없음).

## 발견사항

- **[INFO]** `locker !== db` 불변식이 JSDoc 서술로만 존재하고 런타임으로 강제되지 않는다
  - 위치: `codebase/backend/test/helpers/concurrency.ts` — `@param locker` JSDoc(55-56번 줄)
  - 상세: 같은 파일의 `KNOWN_LOCK_TIMEOUTS_MS` 검사(12-36번 줄)는 이 헬퍼의 설계 철학인
    "주석이 아니라 코드로 고정한다"(23번 줄)를 실제로 실천한 사례인 반면, "`locker` 는 검증용
    `db` 와 달라야 한다"는 같은 급의 전제는 여전히 주석에만 있고 함수 본문에서 `locker !== db`
    를 검사하지 않는다. 현재 9개 호출부는 전부(`grep` 으로 전수 확인) 별도 커넥션을 쓰고 있어
    지금 당장 결함은 아니다. 다만 열 번째 호출부가 실수로 같은 클라이언트를 넘기면, 이 헬퍼는
    조용히 통과하거나(트랜잭션이 이미 그 커넥션의 락을 보유해 자기 자신을 기다리지 않는 경우도
    있어 오히려 "겹침 없음"을 만들어 공허성 가드가 조용히 실패/오탐하는 방향으로 갈 수 있다)
    디버깅하기 어려운 방식으로 깨질 수 있다.
  - 제안: `if (locker === (fires as any).db)` 식은 불가능하지만(호출 시점에 `db` 참조를 안 받음),
    최소한 함수 시작부에 `locker.query('SELECT 1')`이 아닌 형태로는 강제하기 어려우므로 실효성
    있는 런타임 체크는 어렵다는 점을 감안해도, JSDoc 옆에 "이 헬퍼는 이 불변식을 검사하지
    않는다"는 한계 고지를 명시적으로 남기면 다음 작성자가 잘못된 안전감을 갖지 않는다. blocking
    은 아니다.

## 확인했으나 결함 아닌 것 (근거만 기록)

- **`locker`/`db` 분리**: 9개 호출부 전부 `createDbClient()` 를 두 번 호출해 별도 `pg.Client` 를
  생성한다(위 검증 방법 참고) — 헬퍼가 요구하는 불변식이 실제로 지켜지고 있다.
- **`webauthn-credential-delete-concurrency.e2e-spec.ts` 의 이형 호출**: 유일하게 서로 다른
  대상(`idA`,`idB`)을 지우는 두 번째 `it` 은 `SELECT id FROM webauthn_credential WHERE id =
  ANY($1::uuid[]) FOR UPDATE` 로 두 행을 **한 문장**에서 함께 잠근다 — 별도 문장으로 나눠 잠그지
  않으므로 락 획득 순서 차이로 인한 데드락 경로가 없다. 결과는 둘 다 204 로 대칭이라
  `.sort()` 이후에도 어느 쪽이 `idA`/`idB` 인지에 의존하는 단언이 없다.
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:182-186`
- **모듈 로드 시점 assert(`KNOWN_LOCK_TIMEOUTS_MS` 루프)의 결정성**: `TRIGGER_DELETE_LOCK_TIMEOUT_MS`
  가 `5_000` 리터럴이라(`trigger-config-lock.ts:128`) import 순서에 좌우되는 레이스 없이 항상
  같은 결과로 비교된다. 이 assert 가 던지면 이 헬퍼를 import 하는 9개 e2e 파일 전부가 로드 시점에
  실패하지만, 이는 "전제가 깨지면 크게 빨리 실패한다"는 의도된 설계이지 동시성 결함이 아니다.
- **`raceUnderHeldLock()` 본문(락 획득→발사 순서, `Promise.race` 공허성 가드, `finally`
  ROLLBACK+`pending` rejection 흡수, 제네릭 `T` 스레딩)**: 이전 두 라운드에서 검증됐고 이번 diff
  로 함수 본문(76-116번 줄)이 변경되지 않았음을 재확인. 특히 가드 실패(락을 놓기 전 `pending` 이
  먼저 settle) 경로에서도 `finally` 의 `ROLLBACK`(no-op 아님, 실제로 락 해제) + `pending?.catch`
  흡수가 항상 실행돼 트랜잭션이나 unhandled rejection 이 새지 않는다.
- **`fires.length < 2` 조기 검증**: `BEGIN` 이전에 동기적으로 throw 하므로 잘못된 호출이 열린
  트랜잭션을 남기지 않는다.

## 요약

프로덕션 코드 변경이 없는 순수 테스트 헬퍼 추출/문서화이며, 핵심 동시성 로직(별도 락 커넥션으로
겹침을 강제 → 공허성 가드로 겹침을 실측 → COMMIT 으로 동시 해제 → `finally` 에서 락 해제와
pending rejection 흡수)은 이전 두 라운드에서 검증된 그대로 유지된다. 9개 호출부 전부가 `locker`
≠ `db` 불변식을 실제로 지키고 있음을 전수 확인했고, 유일하게 이형 구조(서로 다른 두 대상을 한
락 문장으로 함께 잠그는 `webauthn-credential` 두 번째 케이스)도 데드락이나 결과-요청 오매핑
경로가 없음을 확인했다. 유일한 지적은 "`locker` 는 검증용 `db` 와 달라야 한다"는 불변식이
이 헬퍼 파일 자신이 실천하는 "주석을 코드로 고정한다"는 원칙과 달리 아직 런타임으로 강제되지
않는다는 INFO 뿐이며, 현재 9개 호출부에는 영향이 없다. Critical/Warning 급 동시성 결함은
발견하지 못했다.

## 위험도

LOW
