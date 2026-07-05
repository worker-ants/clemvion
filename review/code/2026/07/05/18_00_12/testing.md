# 테스트(Testing) 리뷰 — V-10 트리거 목록 Schedule enrichment (18_00_12)

## FOCUS 검증 결과

RESOLUTION #2 조치("batch N+1 회피" unit 테스트를 schedule 2건 fixture 로 강화)가
실제로 per-row-loop 회귀를 막는지 실측으로 검증했다.

**검증 방법**: `TriggersService.findAll` 의 배치 조회를

```ts
const schedules = await this.scheduleRepository.find({
  where: { triggerId: In(scheduleTriggerIds), workspaceId },
});
```

에서 아래처럼 per-row loop 로 의도적으로 퇴행시켜 실행:

```ts
for (const id of scheduleTriggerIds) {
  const schedules = await this.scheduleRepository.find({
    where: { triggerId: In([id]), workspaceId },
  });
  ...
}
```

- 강화된 테스트(`triggers.service.spec.ts:356-417`, 2 schedule + 1 webhook fixture)는
  `scheduleRepo.find` 가 2회 호출되어 `toHaveBeenCalledTimes(1)` 에서 **정확히 실패**했다
  (`Expected: 1, Received: 2`).
- 원본 배치 구현으로 되돌리자 다시 통과 확인. → **가드가 실효적임을 실측으로 확인**.
- 참고로 RESOLUTION 이전의 1-schedule-row fixture 였다면 이 회귀는 잡히지 않았을 것이다
  (schedule 1건에 대한 per-row loop 은 `find` 1회 호출과 관측적으로 구분 불가 — `In([id])`
  vs `In([...ids])` 는 `toHaveBeenCalledWith` 로 별도 확인하지 않는 한 동일 count).
  2건 fixture 로의 강화가 이 사각지대를 정확히 닫은 것으로 판단된다.

## 발견사항

- **[INFO]** `toHaveBeenCalledWith` 의 `In()` 매칭이 소스 배열 순서에 의존
  - 위치: `triggers.service.spec.ts:372-374` (`In(['s-trig-1', 's-trig-2'])`)
  - 상세: 프로덕션 코드가 `data.filter(...).map((t) => t.id)` 로 스케줄 트리거 id 순서를
    결정하므로, mock QB 가 반환하는 행 순서(`s-trig-1` → `w-trig` → `s-trig-2`)에 따라
    필터링된 배열이 정확히 `['s-trig-1', 's-trig-2']` 가 되어 어서션과 일치한다. 이는
    우연이 아니라 프로덕션 로직을 그대로 반영한 결정적 순서이며, 테스트가 fixture 순서를
    통제하므로 flaky 위험은 없다. 다만 향후 구현이 `Set`/`Promise.all` 등으로 순서를
    바꾸면(기능적으로는 무해) 이 어서션이 깨질 수 있어 약간의 결합도가 있다.
  - 제안: 현 상태로 충분하며 변경 불요. 향후 순서 무관성이 필요해지면
    `expect.objectContaining({ where: expect.objectContaining({ triggerId: expect.any(Object) }) })`
    또는 `In()` 의 `_value` 를 `expect.arrayContaining` 으로 완화하는 대안이 있다는 점만 기록.

- **[INFO]** 강화된 테스트의 주석("per-row findOne 루프로 퇴행하면 find 가 2회 호출돼...")과
  실제 메커니즘의 미묘한 불일치
  - 위치: `triggers.service.spec.ts:327-328`, `370`
  - 상세: 이 describe 블록의 `Schedule` repo mock 은 `useValue: { find: jest.fn() }` 로만
    구성되어 `findOne` 이 아예 존재하지 않는다(`triggers.service.spec.ts:308-309` 근방).
    따라서 실제로 `findOne` 기반 per-row loop 로 퇴행하면 `toHaveBeenCalledTimes(1)` 실패
    이전에 `TypeError: scheduleRepo.findOne is not a function` 으로 즉시 실패한다 — 주석이
    가리키는 것보다 더 강한(더 이른) 실패 모드다. 반대로 `find`(In 단건) 기반 per-row loop
    로 퇴행하는 경우는 주석·어서션 그대로 `toHaveBeenCalledTimes(1)` 이 정확히 잡는다(실측
    확인 완료). 즉 두 퇴행 변형 모두 잡히지만, 잡히는 메커니즘이 주석 설명과 정확히
    일치하지는 않는다.
  - 제안: 기능적 문제는 아니므로 필수 수정 아님. 주석을 "find 기반이든 findOne 기반이든
    per-row 로 퇴행하면 잡힌다(전자는 count, 후자는 mock 부재로 TypeError)"로 보강하면
    다음 리뷰어의 오해를 줄일 수 있다(선택 사항).

- **[INFO]** 세 번째 테스트("매칭 schedule row 부재")는 배치성과 무관한 별도 엣지케이스이나 적절히 분리되어 있음
  - 위치: `triggers.service.spec.ts:400-414`
  - 상세: schedule 타입 트리거이지만 `scheduleRepository.find` 가 빈 배열을 반환하는
    경우(데이터 정합성 갭 — schedule 이 삭제됐는데 trigger.type 은 여전히 'schedule' 인
    극단 케이스)를 다루며, `cronExpression`/`nextRunAt` 이 `undefined` 로 남아 있는지
    확인한다. `Object.assign` 분기를 타지 않는 경로(`scheduleByTriggerId.get(t.id)` 가
    `undefined`)를 정확히 커버해 프로덕션 코드의 `if (schedule)` 널가드를 검증한다.
  - 제안: 없음. 잘 작성됨.

- **[INFO]** 두 번째 테스트("schedule 행이 없으면 skip")는 `scheduleTriggerIds.length > 0`
  가드의 short-circuit 경로를 정확히 커버
  - 위치: `triggers.service.spec.ts:387-398`
  - 상세: webhook 행만 있는 경우 `scheduleRepository.find` 자체가 호출되지 않음을
    확인 — 불필요 쿼리 방지 최적화(성능 관점)를 검증하는 유일한 테스트. 적절하다.
  - 제안: 없음.

- **[INFO]** e2e 테스트(`schedule-trigger.e2e-spec.ts` C-2)는 unit 배치 어서션을 실제
  DB 경로로 보완
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:114-146`
  - 상세: 실제 Postgres 를 사용해 `GET /api/triggers?type=schedule` 응답에 cron/timezone/
    nextRunAt 이 채워짐을 확인한다. unit 은 mock 기반 배치 호출 횟수·인자를 검증하고,
    e2e 는 end-to-end 로 실제 값 전파를 검증 — 역할 분담이 적절하다. 다만 e2e 는 schedule
    1건만 생성하므로 "여러 스케줄 트리거가 있는 목록 페이지"의 실제 DB IN 쿼리 동작(예:
    `IN` 절에 실제 UUID 여러 개가 들어갈 때의 쿼리 정상 동작)은 unit mock 검증에만
    의존한다. 이는 unit 이 이미 강화됐고 IN 쿼리 자체는 TypeORM/Postgres 표준 기능이라
    실질 리스크는 낮다.
  - 제안: 필수 아님. 원한다면 e2e 에 schedule 2건 생성 후 목록에서 둘 다 enrich 되는지
    확인하는 케이스를 추가해 unit mock 과 완전히 대칭되는 e2e 커버리지를 얻을 수 있으나,
    현재도 회귀 방지 목적은 unit 강화로 충분히 달성됨.

- **[INFO]** Mock 구성(`mockQb`)이 페이지네이션 관련 메서드(`offset`/`limit`/`orderBy`)를
  전부 no-op stub 으로 처리해 이번 변경(enrichment 로직)에만 집중된 테스트 격리가
  잘 되어 있음
  - 위치: `triggers.service.spec.ts:284-296`
  - 상세: `mockQb` 헬퍼가 쿼리 빌더 체이닝을 최소한으로 stub 하고 `getMany`/`getCount` 만
    실제 값을 반환하도록 구성해, enrichment 로직과 무관한 필터링/정렬 세부사항이 테스트
    실패에 영향을 주지 않는다. 테스트 간 의존성 없이 각 `it` 블록이 `beforeEach` 로
    독립된 모듈을 새로 구성하므로 격리도 양호하다.
  - 제안: 없음.

## 요약

FOCUS 로 지정된 배치-vs-N+1 회귀 가드는 실측 검증 결과 **의도대로 작동**한다. schedule
2건 fixture 로 강화된 테스트는, `find` 기반이든 `findOne` 기반이든 per-row loop 로의
퇴행을 모두 탐지하며(전자는 `toHaveBeenCalledTimes(1)` 위반으로, 후자는 mock 에 없는
메서드 호출로 인한 TypeError 로), 실제로 코드를 per-row loop 로 패치해 테스트가 예상대로
실패함을 확인했고 원복 시 다시 통과함을 확인했다. 기존 1-row fixture 로는 이 회귀를
잡지 못했을 것이므로 강화는 실질적 가치가 있다. 나머지 두 개의 보조 테스트(schedule 없음
skip, 매칭 schedule 없음 graceful degrade)도 엣지케이스를 정확히 분리해 커버하고, e2e
는 실제 DB 경로로 값 전파를 보완한다. Mock 구성·테스트 격리·가독성 모두 양호하다.
발견된 사항은 전부 INFO 수준(주석과 실제 실패 메커니즘의 미묘한 불일치, `In()` 순서
결합도)이며 기능적 결함이나 회귀 위험은 없다.

## 위험도

NONE
