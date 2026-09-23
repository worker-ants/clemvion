# 테스트(Testing) 리뷰 — member-owner-toctou

## 검증 절차

- `codebase/backend`에서 `npx jest workspaces.service.spec.ts` 직접 실행 → **77 passed, 77 total** (mutate 없이 원본 그대로 실행, 저장소 변형 없음).
- `npx tsc --noEmit -p tsconfig.json` 실행 → `workspaces.service.spec.ts` / `member-remove-concurrency.e2e-spec.ts` 관련 타입 에러 **0건**(출력에 남은 에러는 전부 `src/nodes/presentation/{carousel,chart,table}/*.spec.ts`로, 이번 diff와 무관한 기존 실패).
- `codebase/backend/node_modules/typeorm/find-options/FindOperator.d.ts` 확인 → `.type`/`.value`는 공개 getter(정상적인 공개 API 사용, private 필드 poking 아님).
- `wireFindOne` 헬퍼의 `targetReads` 카운팅 로직을 손으로 추적 — `removeMember`의 실제 `findOne` 호출 순서(대상 1차 조회 → `assertAdmin`의 요청자 조회 → 0-행 시 대상 재조회)와 정확히 대응함을 확인.
- e2e 신규 블록의 `1_500` 하드코딩이 `test/helpers/concurrency.ts`의 `VACUITY_GUARD_MS`(비공개, `export` 없음)와 값은 같지만 별도로 존재함을 grep으로 확인.
- `git status --short`로 저장소 무변형 확인(위 명령들은 전부 read-only 실행이었고 조사 중 어떤 파일도 고치지 않았음).

## 발견사항

- **[WARNING]** 새 e2e 공허성 가드가 SoT 상수 `VACUITY_GUARD_MS`를 우회해 `1_500`을 중복 하드코딩한다
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:247`
  - 상세: `test/helpers/concurrency.ts:26`의 `VACUITY_GUARD_MS = 1_500`은 그 파일 헤더 주석에서
    "그 관계가 왜 필요한지와 검사 범위의 한계는 `assertGuardBelowKnownTimeouts`의 JSDoc이 SoT다 —
    여기 복제하지 않는다(두 자리에 적으면 한쪽이 낡는다)"라고 명시하고, 실제로 import 시점에
    `assertGuardBelowKnownTimeouts(VACUITY_GUARD_MS, KNOWN_LOCK_TIMEOUTS_MS)`를 호출해 그 상수가
    알려진 모든 락 타임아웃보다 짧은지 자동 검증한다. 그런데 신규 블록(`제거 중 대상이 owner로
    승격되면 지우지 않고 403이다`)은 `raceUnderHeldLock`을 쓰지 않고 직접
    `Promise.race`+`setTimeout(..., 1_500)`으로 같은 공허성 가드를 재구현하면서, 상수를 import하는
    대신 리터럴 `1_500`을 그대로 복제했다. `VACUITY_GUARD_MS`는 `concurrency.ts`에서
    `export`되어 있지 않아 애초에 import가 불가능한 상태이기도 하다. 그 결과 이 리터럴은
    `assertGuardBelowKnownTimeouts`의 검증 범위 **밖**에 있다 — 훗날 어떤 락 대기 상한이 1500ms에
    근접하도록 바뀌어도 `assertGuardBelowKnownTimeouts`는 (자신이 검사하는 상수만 보므로) 계속
    통과하고, 이 리터럴만 조용히 안전 마진을 잃는다. "두 자리에 적으면 한쪽이 낡는다"고 스스로
    적어 둔 규율을 이 신규 블록이 정확히 위반한 사례다.
  - 제안: `VACUITY_GUARD_MS`를 `concurrency.ts`에서 `export`하고 이 파일에서 import해 재사용한다.
    (`raceUnderHeldLock`으로 접을 수 없는 축이라는 plan의 판단은 타당하지만, 상수 재사용까지
    막는 이유는 없다.)

- **[WARNING]** 신규 e2e 블록이 공유 `workspaceId`를 영구 오염시키고, 순서 보존은 주석에만 의존한다
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` — `제거 중 대상이 owner로
    승격되면 지우지 않고 403이다` 블록(파일 끝, 새로 추가된 `it(...)`) 및 그 바로 위 주석
    "아래 블록은 **파일의 마지막이어야 한다**"
  - 상세: 이 테스트는 `locker.query("UPDATE workspace_member SET role = 'owner' ...")`로
    `beforeAll`에서 만든 공유 `workspaceId`에 **두 번째 owner**를 raw SQL로 만들어 놓고 되돌리지
    않는다(성공 경로든 실패 후 `ROLLBACK` 경로든 이 raw UPDATE 자체를 취소하는 동작은 성공
    시나리오에선 존재하지 않는다 — COMMIT 되면 영구적이다). 이 파일은 격리 수단으로
    "텍스트상 마지막에 두라"는 사람이 읽는 주석 하나에 의존한다. Jest 설정
    (`test/jest-e2e.json`, `maxWorkers: 1`, 랜덤 순서 옵션 없음)에서 실행 순서 자체는 결정적이라
    당장 깨지진 않지만, 이후 누군가 이 파일에 새 `it()`를 그 뒤에 추가하면(주석을 못 보고) 그
    workspace에 owner가 이미 2명이라는 전제가 깨져 원인 파악이 매우 어려운 실패를 겪게 된다 —
    구조적 가드(예: 이 테스트 전용으로 `createTeamWorkspace`를 별도 호출해 오염 범위를 그
    테스트 자신으로 좁히는 것)가 아니라 관례로만 격리를 보장하는 형태다.
  - 제안: 이 블록만 별도의 격리된 team workspace를 새로 만들어 쓰거나(파일 안에 이미
    `createTeamWorkspace` 헬퍼가 import돼 있어 비용이 크지 않다), 최소한 테스트 말미에 두 번째
    owner를 원상복구(`UPDATE ... SET role = 'editor'` 또는 해당 행 삭제)하는 cleanup을 추가해
    "마지막이어야 한다"는 제약 자체를 없앤다.

## 긍정적으로 확인된 점 (참고, 조치 불요)

- 단위 테스트의 `criteria.role.type`/`.value` 언팩 방식은 `FindOperator`의 공개 getter를 쓰는
  정상적인 접근이며(`sessions.service.spec.ts` 선례와 일관), `toHaveBeenCalledWith`의
  deep-equality 한계를 우회하는 타당한 선택이다.
- `wireFindOne` 헬퍼의 `targetOnReread`(2차 조회부터 다른 값을 답하는 카운터)는 실제
  `removeMember`의 `findOne` 호출 순서와 정확히 대응하도록 설계돼 있고, "행이 사라졌다(`null`)"와
  "owner로 승격됐다"를 별도 테스트로 나눠 `still?.role === 'owner'` 판정을 두 방향(반전 조건
  뮤턴트 포함)에서 모두 검증한다 — 뮤턴트 A/B/C 예측=실측 표와 실제 코드 추적이 일치함을 확인했다.
- 각 `it`가 `Test.createTestingModule`을 새로 생성해 mock을 매번 리셋하므로 유닛 테스트 간
  격리는 안전하다(전역 `clearAllMocks` 의존 없음).
- e2e 신규 블록의 `try/finally`(단언 실패 시에도 `ROLLBACK`+대기 중 요청 drain)는 커넥션 누수를
  막는 설계로 적절하다.

## 요약

핵심 프로덕션 로직(`removeMember`의 조건부 `DELETE ... WHERE role != 'owner'` + 0-행 재조회
분기)은 unit 2건 신설 + 기존 unit 리팩터 + e2e 1건 신설로 두 계층에서 상호 보완적으로
커버되며, mutation 3종을 예측=실측으로 직접 검증한 근거가 plan에 남아 있어 커버리지 자체의
공백은 찾지 못했다. 다만 새 e2e 블록에서 두 가지 테스트 위생 문제를 발견했다 — 공허성 가드
타임아웃(`1_500`)이 프로젝트가 명시적으로 금지한 "SoT 중복"을 그대로 재현했고, 파일 마지막
고정이라는 순서 의존을 사람이 읽는 주석으로만 강제해 향후 같은 파일에 테스트가 추가되면
조용히 깨질 수 있는 구조다. 둘 다 현재 동작을 그르치지는 않지만 유지보수성 관점의 WARNING으로
남긴다.

## 위험도

LOW
