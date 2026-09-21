# 아키텍처(Architecture) 리뷰

## 대상

`codebase/backend/test/helpers/concurrency.ts` (신규) 로 아홉 파일 11 블록의 동시성 e2e
"BEGIN → 락 → 발사 → 공허성 가드 → COMMIT/ROLLBACK" 보일러플레이트를 추출한 순수 리팩터.
프로덕션 코드(`codebase/backend/src/**`) 변경은 없다. `plan/in-progress/e2e-race-helper.md` 및
`review/consistency/2026/09/21/19_59_55/**` 는 리뷰 산출물/plan 문서로 아키텍처 관점 코드 리뷰
대상이 아니라 컨텍스트로만 참고했다.

## 발견사항

- **[INFO]** 공유 상수 `VACUITY_GUARD_MS` 가 프로덕션 SoT 상수와 주석으로만 연결되고 코드로는 연결되지 않음
  - 위치: `codebase/backend/test/helpers/concurrency.ts:87` (`const VACUITY_GUARD_MS = 1_500;`), 관련 근거 주석은 `:61-63`
  - 상세: 이 값이 "1.5초여야 하는 이유"는 `codebase/backend/src/modules/triggers/trigger-config-lock.ts:128` 의
    `export const TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 보다 작아야 한다는 것인데, `trigger-`/`schedule-delete-concurrency.e2e-spec.ts`
    는 이미 같은 파일에서 `triggerConfigLockKey` 를 import 하고 있어 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 도 import 하는
    비용이 거의 없었다. 지금은 그 관계가 주석 문장으로만 존재하고 타입/런타임으로 강제되지 않는다. 이번 리팩터
    이전에도 11곳에 동일 리터럴이 중복돼 있었으니 **새로 생긴 결함은 아니지만**, 이 PR 의 존재 이유 자체가
    "손으로 지키는 불변식은 조용히 깨진다"(공허성 가드를 헬퍼로 강제 이관)인데, 정작 이 상수 자체는 여전히
    같은 종류의 손 관리 불변식으로 남아 있다. 프로덕션 쪽에서 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 를 5000ms 미만으로
    낮추면 이 헬퍼를 쓰는 11개 콜사이트 전부가 "겹침 실패"와 "락 타임아웃"을 구분하지 못하는 상태로 조용히
    퇴화하며, 컴파일 타임 신호는 없다(리팩터로 인해 실패 반경이 1파일→11콜사이트로 넓어진 점은 새로 생긴 특성).
  - 제안: `VACUITY_GUARD_MS` 를 `Math.min(1_500, TRIGGER_DELETE_LOCK_TIMEOUT_MS - 1_000)` 형태로 유도하거나,
    최소한 `VACUITY_GUARD_MS < TRIGGER_DELETE_LOCK_TIMEOUT_MS` 를 확인하는 단위 테스트/assert 를 헬퍼 모듈에 추가.

- **[INFO]** 공허성 가드 대기시간(`VACUITY_GUARD_MS`)이 호출부에서 오버라이드 불가능
  - 위치: `codebase/backend/test/helpers/concurrency.ts:38-42` (함수 시그니처), `:87` (비-export 상수)
  - 상세: 현재 11개 콜사이트가 전부 동일한 1.5초 가드로 균일하다는 실측(plan §B) 위에서 내린 의도적 설계
    (plan §D "일괄 상수화하지 않는다"는 문맥과는 다른 항목이지만 같은 방향의 결정)라 지금은 문제가 아니다.
    다만 향후 `lock_timeout` 이 더 짧은 자원(예: 1초 미만)을 위한 12번째 콜사이트가 추가되면, 이 헬퍼는
    파라미터를 제공하지 않으므로 헬퍼 자체를 수정하거나 우회 구현을 새로 만들어야 한다 — 확장 지점이
    막혀 있다는 점만 기록.
  - 제안: 필요해지면 `guardMs?: number` 선택 인자를 추가(기본값 1500 유지)해 하위 호환을 유지한 채 확장.
    지금 당장 수정할 필요는 없음(YAGNI 로 보임).

- **[INFO]** 공유 헬퍼가 Jest `expect()` 를 내부에서 직접 호출 — `test/helpers/` 안에서 이 파일이 처음
  - 위치: `codebase/backend/test/helpers/concurrency.ts:1` (`import { expect } from '@jest/globals'`), `:70` (`expect(raced).toBe('pending')`)
  - 상세: 같은 디렉터리의 `helpers/auth.ts`·`helpers/db.ts` 는 순수 HTTP/DB 헬퍼로 Jest 의존이 없는 반면,
    이 헬퍼는 "메커니즘(락 쥐고 발사하고 풀기)"과 "정책(공허성 가드 단언)"을 한 함수에 결합해 Jest 프레임워크에
    직접 의존한다. 교과서적 SRP 로는 관심사 분리 위반처럼 보이지만, 이 PR 의 핵심 동기(가드를 호출부가
    빠뜨릴 수 없게 만드는 것, plan §A "#1376 에서 가드를 빠뜨린 테스트를 썼다가 리뷰가 잡았다")를 생각하면
    **의도적이고 정당한 결합**이다 — 가드와 메커니즘을 분리 가능하게 열어두면 다시 "가드만 빠뜨리는" 실수가
    재현된다. 부작용은 단언 실패 시 스택트레이스가 호출부가 아니라 헬퍼 내부(`concurrency.ts:70`)를 가리켜
    실패 원인 파악이 한 단계 더 필요하다는 정도(단, 에러 메시지 자체(`Received: "settled"`)는 원인을 충분히
    설명한다 — plan 의 음성 대조군 실측이 이를 확인했다).
  - 제안: 조치 불요. 필요하면 JSDoc `@throws` 절에 "Jest `expect()` 실패로 던진다"는 사실을 한 줄 명시해
    포터빌리티 제약을 문서화하는 정도면 충분.

## 긍정적 관찰

- **DRY + 단일 책임**: 아홉 파일 11 블록에 손으로 복제돼 있던 "BEGIN→락→발사→공허성 가드→COMMIT, finally
  ROLLBACK+pending 흡수" 프로토콜을 제네릭 `raceUnderHeldLock<T>()` 하나로 응집시켰다. 락 SQL·발사 thunk·
  결과 정렬(도메인 지식)은 호출부에 남기고, 트랜잭션 생명주기·공허성 가드(반복되던 정확한 실수 지점)만
  헬퍼로 옮긴 경계 설정이 정확하다 — "정렬하지 않는다, 무엇으로 정렬할지는 호출부가 안다"(JSDoc `@returns`)는
  호출부 지식을 헬퍼에 새지 않게 막은 좋은 판단이다.
- **레이어 경계 준수**: 신규 헬퍼는 `pg.Client`/`@jest/globals` 외 어떤 프로덕션 모듈도 import 하지 않는다.
  `../src/modules/triggers/trigger-config-lock` import 는 `trigger-`/`schedule-delete-concurrency.e2e-spec.ts`
  에 이미 있던(이번 diff 이전부터) 것으로, 이번 리팩터가 test→src 결합을 새로 만들지 않았다.
  프로덕션 코드 변경 0건도 diff 로 확인된다.
  순환 의존성 없음.
- **인터페이스 설계**: `fires: Array<() => Promise<T>>` 로 "같은 요청 두 번"과 "서로 다른 대상 두 thunk"
  (`webauthn-credential-delete-concurrency.e2e-spec.ts` 둘째 블록) 을 모두 표현 — 처음부터 단일 콜백으로
  설계했다가 실측(plan §B)으로 배열로 고친 이력이 정직하게 문서화돼 있다. 최소 2개 이상을 런타임에 강제하는
  가드절(`fires.length < 2`)도 적절하다.
- **의도적 배제**: `integration-rotate-concurrency` 를 "구조가 다르다"(단일 발사·갱신 경합·다른 가드 형태)는
  근거로 이 추출에서 제외한 판단(plan §B)은 무리하게 하나의 추상화로 밀어넣지 않은 좋은 판단 — 억지 일반화
  안티패턴을 피했다.
- **경험적 검증**: 락 쿼리 호출을 제거하는 음성 대조군 뮤테이션으로 11개 콜사이트 전부에서 가드가 정확한
  사유(`Received: "settled"`)로 RED 가 됨을 실측 확인(plan 체크리스트) — "전부 GREEN" 만으로 만족하지 않고
  이 리팩터가 만들 수 있는 가장 위험한 실패 모드(가드가 조용히 무력화되는 것)를 직접 겨냥한 검증이다.

## 요약

프로덕션 코드에 영향이 없는 순수 테스트 인프라 리팩터로, 11곳에 중복된 동시성 레이스 오케스트레이션과
그 안에 파묻혀 있던 "공허성 가드"(가장 빠뜨리기 쉬운 부분)를 제네릭 헬퍼 함수 하나로 정확히 추출했다.
메커니즘(락/트랜잭션/가드)과 정책(락 SQL, 결과 정렬, 단언)의 경계 설정이 적절하고, 레이어 경계(test↔src)
위반이나 순환 의존성도 없다. 유일한 아쉬운 점은 헬퍼 내부 상수 `VACUITY_GUARD_MS` 가 프로덕션
`TRIGGER_DELETE_LOCK_TIMEOUT_MS` 와의 관계를 여전히 주석으로만 유지한다는 것인데, 이는 이 PR 이전부터
있던 패턴이 중앙화되며 반경만 넓어진 것이라 이번 diff 가 새로 만든 결함은 아니다. CRITICAL/WARNING 급
아키텍처 이슈는 발견되지 않았다.

## 위험도

LOW
