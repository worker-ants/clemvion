# 테스트(Testing) 리뷰

## 배경 (4라운드 누적 — 이번이 마지막 확인)

이 PR 은 이미 3라운드 리뷰(`12_41_15`→`13_15_58`→`13_46_53`)를 거치며 testing 관점에서 지적된
항목을 모두 코드 레벨로 해소한 상태다. 각 라운드의 지적과 실제 현재 코드를 직접 대조했다:

| 라운드 | testing 지적 | 현재 상태 (직접 확인) |
| --- | --- | --- |
| 1 (`12_41_15`) | `hasRawUpdateReturning` 전용 단위 테스트 부재 | `source-scan.spec.ts:67-165` `describe('countRawUpdateReturning / hasRawUpdateReturning')` 신설 확인 |
| 1 | `.query(sqlVar)` blind spot 미문서화 | `source-scan.ts:92-98` docstring 명시 확인 |
| 1 | discovery 가드가 존재-only 판정(개수 미비교) | `update-returning-rows.spec.ts:167-182` `findUnguarded` 가 `rawCount`/`guardCountOf` 개수 비교로 대체됨 확인 |
| 1 | `kb-stats.helper.spec.ts` mock 이 여전히 틀린 shape | `kb-stats.helper.spec.ts:24-27,43` 튜플 `[[{...}],1]`/`[[],0]` 로 정정 확인 |
| 2 (`13_15_58`) | `.query(sqlVar)`·2단계 중첩 제네릭이 문서화만 되고 캐너리 테스트 없음 | `source-scan.spec.ts:122-137` 음성 `it.each` 에 두 케이스 추가 확인 |
| 2 | `guardCount < rawCount` 판정(부분 커버리지)을 가르는 판별 입력이 영속 테스트에 없음(프로브 1회뿐) | `findUnguarded` 가 순수 함수로 추출되고 `describe('findUnguarded — 합성 입력으로...')` 에 부분/완전/초과 커버리지 + 허용목록 초과 케이스로 고정됨 확인 |
| 3 (`13_46_53`) | `findUnguarded` 합성 테스트 5개가 전부 `discovered` 원소 1개뿐 — 다중 unguarded 를 못 가름(조기 `break` 뮤턴트가 생존) | `update-returning-rows.spec.ts:343-369` 에 다중 원소 케이스(`unguarded 가 여럿이면 전부 보고한다`) + 역방향 케이스(`여럿 중 일부만 unguarded`) 추가 확인 |
| 3 | CTE 접두(`WITH … UPDATE … RETURNING`) blind spot 이 1라운드에 지적됐으나 SUMMARY 합성에서 누락돼 2라운드를 그냥 지나감 | `source-scan.ts:99-106` docstring + `source-scan.spec.ts:138-150` 음성 캐너리로 고정 확인 |
| 3 | `CHANGELOG.md` 의 "양성 6·음성 5" 가 2라운드 이후 실제(음성 7)와 불일치 | `CHANGELOG.md:21` "양성 6·음성 7" 로 정정 확인 — 실제 `source-scan.spec.ts` 의 음성 `it.each` 를 세어 7개(INSERT…RETURNING·INSERT…ON CONFLICT·RETURNING 없음·주석·QueryBuilder·`.query(sqlVar)`·2단계 중첩 제네릭)임을 직접 확인, CTE 캐너리는 별도 8번째 항목이 아니라 이 7개 중 하나(교체 없이 추가된 것) — 실제 세어보니 `it.each` 배열 원소가 정확히 7개 |

직접 `npx jest src/common/__test-utils__/source-scan.spec.ts
src/common/utils/update-returning-rows.spec.ts
src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` 를 실행해 **3 suites / 46 tests
전부 GREEN** 을 재확인했다(뮤테이션 없이 정적 리딩 + 실행만 수행, 저장소 파일은 건드리지
않았다 — `git status --short` 로 이번 리뷰 산출물 디렉터리 외 변경 없음을 확인).

## 발견사항

- **[INFO]** `countRawUpdateReturning` 의 합성 양성/음성 fixture 가 전부 **한 줄짜리 SQL 리터럴**이라, "SQL 리터럴이 여러 줄에 걸쳐 있어도(`UPDATE` 와 `RETURNING` 이 다른 줄) 여전히 탐지되는가" 라는 축은 합성 입력으로 직접 고정돼 있지 않다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.spec.ts:67-165`(`describe('countRawUpdateReturning / hasRawUpdateReturning')`, 양성 6·음성 7 전 케이스가 한 줄짜리 문자열)
  - 상세: 실제 프로덕션 지점은 대부분 여러 줄짜리 템플릿 리터럴이다 — 예컨대 이번 diff 가 함께 고친 `kb-stats.helper.ts:39-47` 의 `UPDATE knowledge_base ... RETURNING entity_count, relation_count` 자체가 8줄에 걸쳐 있다. `CALL`/`^\s*(UPDATE|DELETE)`/`\bRETURNING\b` 세 정규식 모두 `\s`(개행 포함)와 `\b` 를 쓰므로 코드를 직접 읽어 보면 멀티라인에서도 정상 동작할 것으로 보이고, 실제로 `discover()` 가 `kb-stats.helper.ts` 를 실제로 찾아낸다는 사실(`발견 자체가 공허하지 않다` 테스트가 간접적으로 이를 요구)이 이를 뒷받침한다. 다만 그 검증은 **오늘의 실제 소스가 우연히 멀티라인 형태를 담고 있는가**에 의존하는 간접 검증이지, 이 파일이 이미 확립한 관례(예: `countCalls` 의 "줄 끝 주석"·"문자열 안 URL" 축을 각각 합성 fixture 로 직접 고정)와 같은 수준의 직접 고정은 아니다. 이 PR/파일 docstring 이 반복해서 강조하는 "판정 축을 합성 입력으로 직접 고정한다" 는 원칙을 이 축에는 아직 적용하지 않은 상태다.
  - 제안: 급하지 않음(활성 버그 아님, 정규식 동작도 이미 정확함을 코드 리딩으로 확인). 여력이 있으면 양성 `it.each` 에 `` '`UPDATE t\n  SET x = 1\n  WHERE id = $1\n  RETURNING x`' `` 류의 멀티라인 백틱 케이스 하나를 추가해 이 축을 실제 소스 상태와 무관하게 고정할 것.

- **[INFO]** `findUnguarded` 를 검증하는 합성 `describe`(`update-returning-rows.spec.ts:306-379`, 7개 `it`)의 `guardCountOf` 스텁은 모두 상수 함수(`() => 1` 등) 또는 단순 삼항이라, `discover()` 가 실제로 넘기는 클로저(`countCalls(readFileSync(...), 'updateReturningRows')`, `:268-270`)가 각 `rel` 에 대해 정확히 어떤 인자로 호출되는지는 스파이로 확인하지 않는다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:266-272`(실제 `discover()`+`findUnguarded` 통합 테스트)와 `:306-379`(합성 `findUnguarded` 단위 테스트) 사이의 경계.
  - 상세: 이는 결함이 아니라 설계상 정상적인 계층 분리다 — 순수 함수(`findUnguarded`)는 합성 스텁으로, 실제 배선(`discover()` → `readFileSync` → `countCalls`)은 통합 테스트(`발견된 지점은 모두...`)로 나눠 검증하는 구조가 이미 맞다. `guardCountOf` 가 unguarded 로 분류되지 않아야 할 파일에 대해 **호출조차 안 될 수 있다**는 점(허용목록 항목은 `guardCountOf` 를 건너뜀, `:171-178`)도 `'guardCountOf 는 호출되지 않아도 된다'`(`:371-378`) 테스트가 이미 이름으로 명시하고 있어 오해의 여지가 적다. 결함으로 볼 근거가 없어 조치 불요 — 참고로만 남긴다.

- **[INFO]** `hasRawUpdateReturning` 은 여전히 프로덕션 소비자가 없고(자기 자신의 테스트 파일에서만 호출), 이는 2·3라운드에서 이미 "두 번째 소비자 생기기 전까지 현행 유지"로 명시적으로 유예된 상태다 (`13_46_53` RESOLUTION INFO #1 과 같은 계열). 새로 지적할 것 없음 — 재확인만.

## 회귀 테스트 유효성

`EXPECTED`(3파일 정확한 개수) 큐레이션 가드, `CONSUMING` 정규식 기반 "소비 지점 수 증가 감지" 테스트, `assert-row-array.spec.ts` 자매 가드는 이번 diff 로 로직이 바뀌지 않았고 직접 코드 대조로 확인했다. `kb-stats.helper.spec.ts` 의 세 번째 테스트("propagates DB errors")는 mock shape 변경과 무관해 그대로 유효하다. `SRC` 상수 hoist·`MIN_REASON_LENGTH` 상수화도 순수 리팩터라 회귀 위험 없음.

## 테스트 격리 · 가독성

`discover()` 결과를 `beforeAll` 로 1회 캐싱해 4개 `it` 이 공유하지만 순수 함수(파일시스템만 읽고 변형하지 않음)라 격리 위반 없음 — 어떤 `it` 도 `discovered` 를 mutate 하지 않는다는 것을 코드로 직접 확인했다. `findUnguarded` 합성 테스트 7개는 각자 독립된 리터럴 입력을 쓰고 공유 상태가 없어 임의 순서로 실행 가능하다. 각 테스트 설명이 판정 축("부분 커버리지", "허용목록 파일의 raw 지점이 허용 수를 넘으면", "unguarded 가 여럿이면 전부 보고한다 — 첫 건에서 멈추지 않는다")을 명확히 표현해 가독성이 높다 — 특히 "왜 이 테스트가 필요한가"를 인라인 주석으로 남기는 패턴(예: `:344-345` "위 케이스들이 전부 discovered 원소를 하나만 써서...")이 다음 리뷰어가 커버리지 의도를 재구성하는 비용을 낮춘다.

## Mock 적절성

`kb-stats.helper.spec.ts` 의 mock 이 실제 드라이버 계약(`[rows, affectedCount]` 튜플)과 정확히 일치하도록 정정됐다. 다만 `refresh()` 가 반환값을 소비하지 않으므로(코드 확인), 이 mock 정정 자체는 **오늘 실행되는 어떤 단언도 바꾸지 않는다** — 순수하게 향후 회귀(다음 사람이 이 mock 을 템플릿 삼아 잘못된 shape 을 소비하는 코드를 작성하는 것)를 막는 예방적 조치다. 이 점은 테스트 자체의 주석(`:19-23`)이 스스로 명시하고 있어 오해의 여지가 없다 — 결함이 아니라 의도된 설계.

## 요약

이 diff 는 4라운드에 걸쳐 자신의 판정 축("새 raw UPDATE/DELETE...RETURNING 지점이 조용히 미가드로 남는가")과 같은 형태의 결함을 스캐너·판정 로직·검증 자체에서 반복 발견하고 그때마다 합성 입력으로 직접 고정해 왔다. 이번 라운드에서 이전 세 라운드의 testing WARNING 7건을 코드로 직접 대조 확인한 결과 **전부 해소돼 있었다**(`hasRawUpdateReturning` 전용 테스트, blind spot 문서화+캐너리 4종(`.query(sqlVar)`·2단계 중첩 제네릭·CTE 접두), `findUnguarded` 순수 함수 추출과 다중/단일 원소·역방향 합성 테스트, `kb-stats.helper.spec.ts` mock shape 정정, `CHANGELOG.md` 수치 정정). 관련 3개 스펙 파일을 직접 실행해 46/46 GREEN 을 재확인했다. 새로 남는 것은 활성 버그가 아닌 INFO 2건뿐이다 — (1) 판정 축 중 "멀티라인 SQL 리터럴에서도 탐지되는가"가 합성 fixture 로 직접 고정되지 않고 실제 소스(`discover()`)를 통한 간접 검증에만 의존하는 점, (2) `findUnguarded` 합성 테스트와 실제 `discover()` 배선 사이의 계층 분리는 의도된 설계로 결함이 아니라는 확인. 둘 다 이 PR 이 이미 확립한 "합성 입력으로 판정 축을 고정한다"는 관례를 완전히 소진했는지에 대한 사소한 잔여 갭이지, 새 회귀 경로는 아니다.

## 위험도
NONE
