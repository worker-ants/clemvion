# 테스트(Testing) 리뷰

대상: EIA "DB=wire" 불변식 잔여 항목 3건 — ① `finalizeCancelledExecution` 사후 오시그널 수정,
② retry-turn CANCELLED 재진입 `RETURNING` 도입, ③ REST `durationMs` 추가.

## 검증 방법

diff 를 정적으로 읽는 데 그치지 않고, 관련 3개 spec 파일(`execution-engine.service.spec.ts`,
`retry-turn.service.spec.ts`, `interaction.service.spec.ts`)을 실제로 `jest` 로 실행했고,
CHANGELOG/plan 이 주장하는 "뮤테이션 RED" 근거를 **실제로 소스를 훼손해 재현**했다(커밋된
상태이므로 `cp` 로 백업 후 mutate → 실행 → 원복). 아래 표는 그 결과다.

| # | Mutation | 예상 | 실측 |
|---|---|---|---|
| 1 | `finalizeCancelledExecution` 의 `persisted` 체크 제거(무조건 emit로 되돌림) | RED | **RED 확인** — `emitSpy` 가 1회 호출됨(claim 그대로 재현) |
| 2 | `retry-turn.service.ts` CANCELLED 분기의 `persistedDuration` 읽기 로직 제거 | RED | **RED 확인** — `1234` 대신 `600000` 수신(CHANGELOG/plan 의 "1234 vs 600000" 문구와 정확히 일치) |
| 3 | `interaction.service.ts` 의 `durationMs: execution.durationMs ?? null,` 매핑 제거 | RED | **RED 확인** — 두 신규 테스트 모두 실패 |
| 4 | `retry-turn.service.ts` 의 `finishedAt` write-back 블록(Date/string 분기) 전체 제거 | RED 기대 | **GREEN — 44/44 전부 통과.** 아무 테스트도 이 경로를 커버하지 않는다 |
| 5 | `retry-turn.service.ts` 의 실제 `.returning(['duration_ms', 'finished_at'])` 빌더 호출 제거(JS 읽기 로직은 그대로 둠) | RED 기대 | **GREEN — 44/44 전부 통과.** mock 의 `raw` 가 `.returning()` 호출 여부와 무관하게 항상 하드코딩돼 있어, 실제 SQL 빌더 체인이 깨져도 감지되지 않는다 |

1~3 은 plan/CHANGELOG 의 "뮤테이션 확인" 서술이 실제로 성립함을 확인했다(허위 주장 아님).
4~5 는 이번 diff 가 스스로 만든 **새로운 커버리지 갭**이다.

## 발견사항

- **[WARNING]** retry-turn CANCELLED 분기의 `finishedAt` 되쓰기(Date/string 분기)가 어떤 테스트로도 커버되지 않는다 — 뮤테이션으로 실측(GREEN 유지)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:668-677` (persistedFinishedAt 분기 전체) / 대응 테스트는 `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:1308-1346` ("emit 은 로컬 재계산값이 아니라...")
  - 상세: 코드 자체 주석이 "`finishedAt` 도 같은 COALESCE 대상이다. wire 에는 안 실리지만 반쪽만 되쓰면 in-memory 가 두 시각을 섞어 갖는다"고 명시적으로 위험을 지목하는데, 새로 추가된 회귀 테스트(`emit 은 로컬 재계산값이 아니라 COALESCE 가 보존한 DB 값을 싣는다`)는 `raw` 목(mock)에 `duration_ms` 만 채우고 `finished_at` 은 아예 넣지 않는다. 그 결과 `persistedFinishedAt instanceof Date` 분기, `typeof === 'string'` 분기, `Number.isFinite` 가드 분기가 전부 실행되지 않는다. 실제로 `persistedFinishedAt` 관련 블록 10줄을 통째로 삭제한 뒤 `retry-turn.service.spec.ts` 전체(44개)를 돌려도 전부 GREEN 이었다 — "wire 에는 안 실리지만" 값이라 emit 단언으로는 절대 못 잡고, `execution.finishedAt` 자체를 단언하는 테스트가 없다.
  - 제안: `emit 은 로컬 재계산값이 아니라...` 테스트의 `raw` mock 에 `finished_at: '2026-08-15T00:00:00.000Z'`(문자열, DB 원시 반환 형태) 를 함께 채우고, 실행 후 `execArg.finishedAt`(또는 `priv()` 로 접근 가능한 in-memory execution)의 값을 단언하는 케이스를 최소 1개(Date 문자열 파싱 성공) 추가할 것. 여유가 있으면 `Date` 인스턴스로 오는 경우(드라이버가 타임스탬프를 자동 파싱하는 실제 pg 기본 동작)도 별도 케이스로 커버.

- **[WARNING]** 같은 CANCELLED 분기의 실제 `.returning(['duration_ms', 'finished_at'])` 빌더 호출이 테스트로 보증되지 않는다 — mock 의 `raw` 반환이 `.returning()` 호출과 인과적으로 연결돼 있지 않다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:655` (`.returning([...])` 호출) / mock: `retry-turn.service.spec.ts:1313-1325`
  - 상세: 테스트의 `createQueryBuilder` mock 은 `execute: jest.fn().mockResolvedValue({ affected: 1, raw: [{ id: EXEC_ID, duration_ms: PERSISTED_T1 }] })` 로 **`raw` 를 하드코딩**한다. 이 mock 은 `.returning(...)` 이 실제로 호출됐는지, 어떤 컬럼을 요청했는지와 **완전히 무관**하게 항상 같은 `raw` 를 돌려준다. 실측: 소스에서 `.returning(['duration_ms', 'finished_at'])` 호출 자체(빌더 메서드 체이닝의 그 한 줄)를 제거해도 — JS 쪽 읽기 로직(`toFiniteNumber(row?.duration_ms)` 등)은 그대로 둔 채 — `retry-turn.service.spec.ts` 44개 테스트가 전부 GREEN 이었다. 즉 이 테스트 스위트는 "RETURNING 절이 실제 쿼리에 붙어 있다"를 전혀 보증하지 않고, JS 읽기 로직만 격리 검증한다. 실제 TypeORM/PG 환경에서 `.returning()` 이 우연히 빠지면(예: 향후 리팩터링에서 메서드 체인이 끊기는 흔한 실수) 프로덕션은 다시 이 PR 이 고치려는 정확히 그 버그(DB=T1, wire=T2)로 회귀하는데, 이 unit 테스트만으로는 감지되지 않는다.
  - 제안: 최소 한 케이스에서 `returning` mock 을 `jest.fn().mockReturnThis()` 대신 스파이로 바꿔 `expect(returningSpy).toHaveBeenCalledWith(['duration_ms', 'finished_at'])` 를 단언할 것. 이런 "SQL 형태" 단언은 이미 같은 describe 블록의 자매 테스트(`finishedAt/durationMs 는 COALESCE 로 보존하고...`, L1240)가 `set`/`where`/`andWhere`/`setParameter` 에 대해 하고 있는 패턴과 동형이라 관용구 일탈이 아니다 — `returning` 만 그 목록에서 빠져 있다.

- **[INFO]** `interaction.service.ts` 의 `durationMs: execution.durationMs ?? null` — falsy-but-valid 경계값(`0`)에 대한 테스트 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:435` / 테스트: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:531-545`
  - 상세: `??`(nullish coalescing)를 정확히 써서 `0`(즉시 종결·매우 짧은 실행)을 `null` 로 오인하지 않는 구현은 맞다. 그런데 새 테스트 두 개는 `4242`(truthy) 와 `null`(RUNNING 상태의 기본값)만 커버해 `durationMs === 0` 케이스가 비어 있다. `??` 를 `||` 로 실수 치환하는 흔한 회귀는 이 두 테스트로는 잡히지 않는다(`0 || null` 도 `4242`/`null` 케이스와 결과가 같으므로).
  - 제안: `durationMs: 0` fixture 로 `expect(r.durationMs).toBe(0)` 케이스를 하나 추가해 `??`↔`||` 치환 뮤턴트를 구분 가능하게 할 것 (이 저장소 메모리에 기록된 "분기 매트릭스 완성 뒤에도 `??`/`||` 각 항은 별도 표면" 교훈과 정확히 같은 패턴).

- **[INFO]** `execution-engine.service.spec.ts` 의 `finalizeCancelledExecution` 신규 describe 는 선점(0행) 음성 경로만 다룬다 — 다만 이는 실질적 갭이 아니라는 점을 확인함
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:1069-1098`
  - 상세: 자매 `finalizeFailedExecution` describe(L947)는 양성(재개 종결 성공)·음성(선점 skip) 두 케이스를 모두 갖는 반면, 새 `finalizeCancelledExecution` describe 는 음성 1건뿐이다. 다만 조사 결과 양성 경로(`persisted=true` → emit 발행, `cancelledBy:'user'`)는 기존 테스트 `Sub-Workflow(workflow) 노드에서 ExecutionCancelledError...(W15)`(L6777, 이 diff 로 변경되지 않음)가 `runExecution` catch 경로를 통해 이미 `finalizeCancelledExecution` 의 정상 emit 을 검증하고 있어 실질적으로 커버돼 있다. 발견사항이라기보다 확인 기록 — 조치 불요.

## 확인된 강점

- CHANGELOG·plan 문서가 주장한 "뮤테이션 RED→GREEN" 근거 3건(①②③) 모두 **실측으로 재현 성공**했다 — 허위/과장 서술이 아니었다.
- 새 `finalizeCancelledExecution` 테스트는 자매 `finalizeFailedExecution` 테스트와 동일한 discriminating fixture 패턴(`status: RUNNING`(stale in-memory) + `mockExecutionRepo.query.mockResolvedValueOnce([])`(DB 는 이미 terminal))을 재사용해 일관성이 좋다.
- `interaction.service.spec.ts` 의 `종결 실행은 영속된 durationMs 를 그대로 싣는다` 테스트는 `startedAt`/`finishedAt` 차이(600000ms)와 실제 `durationMs`(4242)를 의도적으로 다르게 설정해 "재계산 vs pass-through"를 구분 가능하게 만든 discriminating fixture다 — 이 저장소가 과거 반복 지적한 "분기를 못 가르는 fixture" 함정을 피했다.
- `BASE_COLUMNS` 프로젝션 리스트를 구현 리터럴을 import 하지 않고 black-box 로 재기술한 것(`interaction.service.spec.ts:1032-1039`)은 실측 뮤테이션으로 확인한 대로 실제로 `durationMs` 누락을 잡아낸다.
- `retry-turn.service.spec.ts` 상단 mock 에 `setParameter`/`returning` 을 보강하면서 남긴 주석(#1171 — 불완전한 체인이 try/catch 안에서 조용히 vacuous 해지는 문제)은 실측 가능한 과거 사고에 기반한 정당한 방어이며, 실제로 이번 diff 전체 실행(547 테스트) 이 그 보강 덕분에 무사히 통과했다.
- 세 spec 파일 전체(547 테스트, execution-engine/retry-turn/interaction)를 함께 돌려 회귀 없음을 확인 — 기존 테스트가 diff 로 깨지지 않았다.
- `mockExecutionRepo` 는 매 테스트 `beforeEach` 에서 재생성되고 각 테스트가 `createQueryBuilder` 를 로컬로 override 하므로 테스트 간 격리는 문제없다.

## 요약

CHANGELOG·plan 이 주장하는 3개 항목(①②③)의 회귀 테스트는 전부 뮤테이션으로 실측 검증했고 claim 그대로였다 — 신뢰할 수 있는 테스트다. 다만 이번 diff 가 새로 추가한 코드 중 두 부분(retry-turn CANCELLED 분기의 `finishedAt` 되쓰기 로직, 그리고 `.returning(...)` 빌더 호출 자체)은 어떤 테스트로도 지켜지지 않는다는 것을 직접 뮤테이션으로 확인했다 — 두 블록을 통째로 제거해도 44개 테스트 전부 GREEN 이다. 특히 `.returning()` 빌더 호출 누락은 이 PR 이 고치려는 원래 결함(DB=T1, wire=T2)으로 정확히 되돌아가는 회귀인데, mock 의 `raw` 가 실제 `.returning()` 호출과 인과관계 없이 하드코딩돼 있어 그 회귀를 못 잡는다는 점에서 Mock 적절성 문제이기도 하다. `durationMs===0` 경계값 테스트 부재는 상대적으로 경미한 INFO 다.

## 위험도

MEDIUM — Critical 은 없다. 다만 이번 PR 이 고치려는 결함 클래스("DB 와 wire 가 다른 값을 실었다")와 **같은 모양의 회귀**를 놓칠 수 있는 커버리지 갭(`.returning()` 빌더 호출 자체·`finishedAt` 되쓰기)이 뮤테이션으로 실측 확인됐다는 점에서 단순 INFO 보다는 무겁게 본다.
