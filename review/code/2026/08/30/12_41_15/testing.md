# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 신설 함수 `hasRawUpdateReturning` 에 직접 단위 테스트가 없다 — 자매 함수 `countCalls` 는 `source-scan.spec.ts` 에 6개의 전용 테스트(주석 스트리핑·제네릭 호출·접두 충돌·줄끝 주석·URL 절단 양방향)를 갖고 있는데, 새로 추가된 `hasRawUpdateReturning` 은 같은 파일에 단 한 줄도 추가되지 않았다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:93` (함수 정의) / `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` (테스트 파일 — 이 함수에 대한 `describe`/`it` 없음, 직접 확인함)
  - 상세: 이 함수의 정규식 판정 축(선두 키워드 `UPDATE`/`DELETE`, `RETURNING` 존재, 백틱/작은따옴표/큰따옴표 3종 리터럴, `INSERT…RETURNING`·`INSERT…ON CONFLICT DO UPDATE…RETURNING` 오탐 배제) 전체가 `update-returning-rows.spec.ts` 의 `discover()` 가 **오늘 시점의 실제 `src/**` 소스**를 스캔하는 것을 통해서만 간접적으로 검증된다. 예컨대 오탐 배제 두 형태는 각각 `agent-memory.service.ts`(INSERT…RETURNING)와 `graph-extraction.service.ts`(INSERT…ON CONFLICT DO UPDATE…RETURNING)라는 **우연히 그 형태를 담고 있는 실 파일**에 의존한다. 이 파일들이 리팩터로 그 SQL 형태를 잃으면, 해당 회귀 방어는 아무 테스트 실패 없이 조용히 사라진다 — `stripComments`/`countCalls` 가 합성 fixture 로 직접 고정하는 것과 대조적이다.
  - 제안: `source-scan.spec.ts` 에 `hasRawUpdateReturning` 전용 `describe` 를 추가해 합성 문자열로 각 축(따옴표 3종·대소문자·`UPDATE`/`DELETE` 각각·`RETURNING` 유무·`INSERT…RETURNING`/`INSERT…ON CONFLICT DO UPDATE…RETURNING` 오탐 배제·제네릭 `.query<T>(`)을 직접 고정할 것.

- **[WARNING]** `hasRawUpdateReturning` 에 문서화되지 않고 테스트되지 않은 사각지대가 있다 — SQL 이 **변수에 담겨** `.query()` 에 전달되면 탐지하지 못한다. 실측(scratch 프로브)으로 확인:
  ```
  const sql = `UPDATE foo SET x = 1 WHERE id = $1 RETURNING id`;
  await this.dataSource.query(sql, [id]);
  ```
  위 형태에서 `hasRawUpdateReturning` 은 `false` 를 반환한다 (`CALL` 정규식이 `.query(` 바로 뒤에 리터럴을 요구하기 때문 — `sql` 은 식별자라 매치되지 않음).
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:97` (`CALL` 정규식) — 문서화는 같은 파일 `:86-91` "이 축이 **안** 보는 것 (의도)" 절
  - 상세: 같은 함수의 docstring 은 "이 축이 안 보는 것" 을 명시적으로 한 절 두어 QueryBuilder `.update().execute()` 배제는 설명하지만, 리터럴이 아니라 변수로 SQL 을 넘기는 흔한 리팩터(가독성을 위해 SQL 을 `const` 로 추출)에 대해서는 아무 언급이 없다. 이 가드의 존재 이유가 "헬퍼를 안 거치는 **새 지점**이 생겼는지" 감지인데, 딱 그 종류의 흔한 리팩터 한 번으로 감지가 조용히 무력화된다. 자매 정규식(`CONSUMING`, `assert-row-array.spec.ts`)은 자신의 사각지대(`let`·구조분해·체이닝)를 주석에 명시하는데, 이 함수는 그 관례를 이 지점에서 놓쳤다.
  - 제안: docstring "이 축이 안 보는 것" 절에 "SQL 이 변수에 담겨 전달되는 경우" 를 명시 추가하고, `source-scan.spec.ts` 에 이 케이스를 `false` 로 고정하는 테스트를 넣어 향후 누가 정규식을 강화하려 할 때 의도된 한계인지 실제 결함인지 판별 가능하게 할 것.

- **[WARNING]** `hasRawUpdateReturning` 기반 신규 discovery 가드는 파일 단위 **존재/부재**만 판정하고, `EXPECTED` 기반 구가드처럼 **개수 일치**는 요구하지 않는다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:191-203` (`'발견된 지점은 모두 헬퍼를 거치거나...'` 테스트)
  - 상세: `unguarded` 판정은 `countCalls(..., 'updateReturningRows') === 0` 만 본다. 한 파일에 raw `UPDATE/DELETE … RETURNING` 리터럴이 2곳 있고 헬퍼 호출이 1곳뿐이면, `countCalls` 는 0 이 아니므로 이 테스트는 "가드됨" 으로 통과시킨다 — 실제로는 한 지점이 미가드 상태다. 바로 위 `EXPECTED` 기반 구가드(`it.each`)는 정확히 이 문제를 개수 튜플로 고정해 피하는데, 신규 discovery 가드는 `EXPECTED`/`ALLOWED` 밖의 새 파일에 대해서는 그 정밀도를 갖지 않는다. 오늘 시점 발견된 7개 파일 각각이 우연히 1개 지점씩만 가진다면 지금 당장은 문제가 안 되지만, 이는 검증되지 않은 전제다.
  - 제안: 최소한 이 트레이드오프를 docstring 에 명시하거나(존재-only 는 defense-in-depth 이고 정밀 카운트는 EXPECTED 목록에 편입돼야 한다는 식), 여력이 되면 `discover()` 를 파일당 매치 카운트로 확장해 `countCalls` 와 비교하는 편이 더 강하다.

- **[INFO]** `discover()`(약 813개 소스 파일 재귀 스캔 + 읽기)가 새 `describe` 블록의 4개 `it` 중 3곳에서 캐시 없이 매번 독립 재실행된다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:192`, `:208`, `:220` (각 `it` 내부의 `discover()` 호출)
  - 상세: 실측(`npx jest` 로 관련 3개 스펙 파일 전체 실행) 결과 24 테스트 전체 0.97s 로, 지금 시점에는 성능 문제가 아니다(측정함). 다만 저장소 규모가 커지면 선형으로 늘어나는 중복 I/O 라 `beforeAll` 로 한 번만 계산해 재사용하는 편이 더 견고한 설계다. 차단 사유는 아니다.
  - 제안: `const found = discover();` 를 `beforeAll` 로 끌어올려 4곳이 공유하게 리팩터(선택 사항).

- **[WARNING]** (diff 밖, 회귀 위험으로 명시) `kb-stats.helper.spec.ts` 의 기존 mock 이 이번 diff 가 방금 고친 튜플 타입과 여전히 어긋난 shape 를 반환한다 — 이 PR 이 전역에서 잡으려는 바로 그 결함 클래스의 잔여 인스턴스다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` (직접 Read 로 확인한 실제 파일 줄 번호) `:19` `dataSource.query.mockResolvedValue([{ entity_count: 12, relation_count: 34 }])` — 대응 diff 는 `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` gate `:37` (`.query<[{ entity_count: number; relation_count: number }[], number]>` 로 튜플 타입 정정)
  - 상세: `kb-stats.helper.ts` 의 diff 는 `UPDATE … RETURNING` 의 실제 런타임 shape 이 행 배열이 아니라 `[rows, affectedCount]` 튜플임을 정정하고, 그 이유로 "종전 주석이 향후 소비를 초대하고 있었다" 를 명시한다. 그런데 이 diff 가 건드리지 않은 자매 스펙 파일의 mock 은 여전히 `[{ entity_count, relation_count }]`(행 배열, INSERT 형태)를 돌려준다. 오늘은 `refresh()` 가 반환값을 전혀 소비하지 않아(코드 확인함) 무해하지만, 이 PR 이 첨부한 plan 문서(`plan/in-progress/update-returning-tuple-shape.md`)는 "**mock 이 틀린 현실을 인코딩**" 을 이 결함 클래스가 4개월간 살아남은 근본 원인으로 명시적으로 반복 지적한다. 반환값 소비가 나중에 추가되면(주석이 "향후 호출자가 활용" 이라 명시적으로 초대했었다), 다음 사람은 이미 통과하는 이 mock 을 템플릿 삼아 `result[0].entity_count` 를 단언할 개연성이 높고, 그러면 정확히 같은 결함 클래스가 이 지점에서 재발한다 — 타입 정정이 방금 막으려 한 바로 그 실수를, 통과하는 테스트가 정당화해 주는 형태로.
  - 제안: mock 을 실제 shape 인 `[[{ entity_count: 12, relation_count: 34 }], 1]` 로 갱신하거나(현재 미사용이라 무해하니 원한다면 스킵 가능), 그러지 않는다면 "반환 미사용이라 mock shape 은 의도적으로 단순화했다" 는 주석을 남겨 다음 사람이 실 shape 으로 오인하지 않게 할 것.

## 요약

핵심 처방 코드(`hasRawUpdateReturning`, discovery 기반 회귀 가드, `kb-stats.helper.ts` 타입 정정)는 스캐너의 판정 축·오탐 배제·vacuity 방지 4종 테스트까지 잘 설계돼 있고 실측(직접 실행: 3개 스펙 파일 24 테스트 전부 GREEN, 0.97s)으로 확인했다. 다만 신설 함수 `hasRawUpdateReturning` 자체는 전용 단위 테스트가 없어 그 정규식의 정밀도 검증이 전적으로 "오늘의 실제 소스가 우연히 그 형태를 담고 있는가"에 의존하고 있으며, scratch 프로브로 실제로 확인한 "SQL 이 변수에 담긴 경우 탐지 못함" 이라는 사각지대는 문서에도 테스트에도 없다. discovery 가드 자체는 존재-only 판정이라 EXPECTED 목록의 정밀 카운트 대조보다 약한 보장이다. 마지막으로, diff 범위 밖이지만 이번 타입 정정과 직접 충돌하는 `kb-stats.helper.spec.ts` 의 mock 이 이 PR 이 근절하려는 정확히 그 anti-pattern(틀린 shape 의 mock)을 그대로 남기고 있어, 향후 소비자가 추가되는 순간 같은 결함 클래스가 재발할 토대가 된다.

## 위험도
MEDIUM
