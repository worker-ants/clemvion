# 테스트(Testing) Review — 5라운드 (`14_33_52`)

## 배경

이 PR 은 이미 4라운드 리뷰(`12_41_15`→`13_15_58`→`13_46_53`→`14_11_02`)를 거쳤고,
직전 라운드(`14_11_02`)는 유일한 WARNING(허용목록 `ALLOWED` 의 선언 개수가 `discover()`
실측과 교차검증되지 않음)과 INFO(멀티라인 SQL 리터럴 축이 합성 fixture 로 직접 고정되지
않음, 오늘의 실제 소스 형태에 간접 결합)를 남기고 "여기서 닫는다" 로 수렴 판정했다. 이번
diff(커밋 `1d606f7d0`)는 그 두 항목을 처리한 fix 커밋이다 — 새 코드 변경은 없고,
`update-returning-rows.spec.ts`(선언-개수 일치 테스트 신설)와 `source-scan.spec.ts`(멀티라인
백틱 양성 케이스 신설), `CHANGELOG.md`/plan 배너(수치 갱신 "양성 7 · 음성 8")만 바뀌었다.

## 독립 재검증 (내가 직접 뮤테이션했다 — 보고를 그대로 받지 않았다)

저장소 트리를 건드리기 전 `source-scan.ts`·`update-returning-rows.spec.ts` 를 scratch 로
`cp` 백업한 뒤, 두 fix 가 실제로 미는지 직접 뮤테이션으로 확인하고 `cp` 로 원복했다
(`git checkout`/`restore` 미사용, 매 뮤테이션 후 `git status --short` 로 잔존 0 확인):

| # | 뮤턴트 | 대상 | 예측 | 실측 (직접 실행) |
|---|--------|------|------|------|
| 1 | `ALLOWED` 의 `kb-stats.helper.ts` 선언 개수 `1` → `99` | 신설 "선언 개수가 실측과 정확히 일치한다" 테스트 | 그 테스트만 RED | **RED 1/23** — `"kb-stats.helper.ts: 선언 99 vs 실측 1"`, 나머지 22개 GREEN. 정확히 표적 |
| 2 | `CALL` 정규식의 백틱 캡처를 `` `[^`]*` `` → `` `[^`\n]*` `` (개행 차단) | 신설 멀티라인 양성 캐너리 | 그 캐너리 + 실제 소스가 멀티라인인 기존 케이스들 RED | **RED 4/45** — 신설 캐너리 1건 + `discover()` 가 실제 멀티라인 소스(`kb-stats.helper.ts` 등)를 못 찾아 생긴 3건. 나머지 41개 GREEN |

두 뮤턴트 모두 원복 후 관련 3개 스펙 파일을 재실행해 **48/48 GREEN**, `git status --short`
로 리뷰 산출물 디렉터리 외 잔존 변경 없음을 확인했다. RESOLUTION(`14_11_02` MUT-D/MUT-E)이
보고한 수치(RED 1/45, RED 4/45)와 내가 독립적으로 얻은 결과가 정확히 일치한다 — 보고를
재현으로 검증했다.

## 정량 주장 대조 (지어낸 숫자가 없는지)

- `source-scan.spec.ts` 의 `it.each` 원소를 직접 세었다: 양성 `describe` 블록 **7개**,
  음성 `describe` 블록 **8개** — `CHANGELOG.md:21-22` 와 plan 배너(`:365-366`)의
  "양성 7 · 음성 8" 주장과 정확히 일치.
- `ts-node` 로 `countRawUpdateReturning(kb-stats.helper.ts 소스)` 를 직접 호출해 `1` 을
  확인 — `ALLOWED` 의 선언값(`1`)과 일치, 그리고 새로 신설된 "선언 개수가 실측과 정확히
  일치한다" 테스트가 GREEN 인 것과 정합.
- `npx jest source-scan.spec.ts update-returning-rows.spec.ts kb-stats.helper.spec.ts`
  실행: **3 suites / 48 tests 전부 GREEN** (뮤테이션 전/후 모두 재확인).

## 문서화된 blind spot 이 오늘의 소스 트리 기준으로도 여전히 정확한지 확인

`source-scan.ts` docstring 이 "오늘 저장소에 CTE 접두 형태 사용처 없음(전수 확인)", "raw
UPDATE/DELETE 지점은 지금까지 전부 리터럴"이라고 주장하는데, 이건 시점이 지나면 낡을 수
있는 검증 가능한 주장이라 직접 재검증했다.

- CTE 접두(`WITH … AS (… UPDATE/DELETE … RETURNING`) 패턴을 `.query(` 호출 주변에서
  정규식으로 grep — **0건**. 주장 유효.
- `.query(변수, …)` 형태(리터럴이 아닌 SQL 전달)를 `.spec.ts` 제외 전수에서 grep — 2건
  발견(`database-query.handler.ts:374,437`)했으나 이는 워크플로 "database-query" 노드가
  **사용자가 설정한 외부 DB 커넥션**에 `pg`/`mysql2` 클라이언트로 직접 실행하는 것이라
  TypeORM `DataSource.query()` 의 `[rows, count]` 튜플 계약과 무관하고(반환 shape 을
  `result.rows`/`Array.isArray(rawRows)` 로 이미 올바르게 처리), 애초에 이 가드가 감시하는
  "내부 애플리케이션 DB에 대한 raw UPDATE…RETURNING" 대상도 아니다 — 오탐 없음, 주장 유효.

## 발견사항

- **[정보 확인 — 발견 없음]** 직전 라운드(`14_11_02`)의 WARNING 1건·INFO 1건 모두 이번
  fix 커밋으로 코드 레벨에서 정확히 해소됐음을 직접 뮤테이션 재현으로 확인했다(위 표).
  새로 발견한 testing 관점 결함은 없다.

- **[INFO, carry-forward — 조치 불요]** `kb-stats.helper.spec.ts` 의 mock shape 정정
  (`[rows]` → `[[rows], count]`)은 `refresh()` 가 반환값을 소비하지 않으므로 오늘 실행되는
  어떤 단언도 바꾸지 않는 **예방적 정정**이다. 이는 결함이 아니라 3~4라운드에서 이미
  같은 성격으로 확인된 사항이며, 테스트 자체의 인라인 주석(`:19-23`)이 그 사실을 명시하고
  있어 재지적하지 않는다.

- **[INFO, carry-forward — 조치 불요]** `findUnguarded` 합성 테스트의 `guardCountOf` 스텁이
  전부 상수/단순 삼항이라, 실제 `discover()` 배선이 넘기는 클로저가 각 `rel` 에 대해 정확히
  어떤 인자로 호출되는지를 스파이로 확인하지는 않는다. 순수 함수(`findUnguarded`)와 실제
  I/O 배선(`discover()`)을 분리 검증하는 의도된 계층 구조이고, 4라운드에서 이미 "결함
  아님" 으로 판정됐다 — 재지적하지 않는다.

## 회귀 테스트 유효성

`EXPECTED` 큐레이션 가드, `CONSUMING` 정규식 기반 소비-지점 감지 테스트, `assert-row-array.spec.ts`
자매 가드는 이번 diff 로 로직이 바뀌지 않았다(직접 diff 대조로 확인). 새로 추가된 두 테스트
(선언-개수 일치, 멀티라인 캐너리)는 기존 22/41개 테스트를 GREEN 으로 유지한 채 정확히
표적화된 RED 만 낸다 — 위 뮤테이션 표가 그 판별력을 증명한다.

## 테스트 격리·가독성

신설 테스트 2건 모두 기존 `beforeAll`/`describe` 구조에 자연스럽게 편입됐고, 독립된 리터럴
입력을 쓰거나(`선언 개수 일치` 는 기존 `discovered`/`ALLOWED` 를 읽기만 함) 순수 문자열
fixture(`멀티라인 캐너리`)라 공유 상태·실행 순서 의존이 없다. 테스트 이름이 판정 축("선언
개수가 실측과 정확히 일치한다 — 부풀리면 그만큼 조용히 미검증", "멀티라인 백틱 리터럴 —
`UPDATE` 와 `RETURNING` 이 다른 줄")을 명확히 표현해 가독성이 높다.

## 요약

직전 라운드가 남긴 WARNING 1건·INFO 1건은 이번 fix 커밋으로 정확히 해소됐다 — 내가 직접
저장소 밖 scratch 백업 후 동일한 두 뮤턴트를 재현해, RESOLUTION 이 보고한 수치(RED 1/45,
RED 4/45)와 정확히 일치하는 결과를 얻었다(재현 성공, 보고를 그대로 받지 않고 독립 검증).
정량 주장(양성 7·음성 8, `kb-stats.helper.ts` raw count 1)도 `it.each` 직접 카운트와
`ts-node` 직접 호출로 대조해 지어낸 숫자가 없음을 확인했다. docstring 이 주장하는 두
blind-spot 관찰("CTE 접두 사용처 없음", "raw 지점은 전부 리터럴")도 오늘의 소스 트리
기준으로 재검증해 여전히 유효함을 확인했다(변수-SQL 2건 발견했으나 TypeORM 이 아닌
사용자-설정 외부 DB 커넥션이라 이 가드의 대상 밖). 새로 발견한 testing 관점 결함은 없고,
남은 INFO 2건은 모두 4라운드 전에 이미 "결함 아님" 으로 판정된 항목의 재확인이다. 이 PR 은
5라운드에 걸쳐 자기 자신의 판정 축과 같은 형태의 결함을 스캐너·판정 로직·검증 자체에서
반복 발견하고 그때마다 합성 입력으로 고정해 왔으며, 이번 라운드는 그 마지막 겹이
정확히 막혔음을 독립 재현으로 확인하는 라운드였다.

## 위험도
NONE
