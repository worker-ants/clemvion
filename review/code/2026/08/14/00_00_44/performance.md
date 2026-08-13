# 성능(Performance) 리뷰 결과

## 검토 범위

이번 diff 의 실질 코드 변경은 TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE ... RETURNING` 에서
`[rows, rowCount]` 튜플을 돌려주는데 8개 소비 지점이 이를 행 배열로 오인하던 결함을,
신규 헬퍼 `updateReturningRows()`(`codebase/backend/src/common/utils/update-returning-rows.ts`)로
일괄 수정한 것이다. 나머지 파일(대다수)은 `plan/**`·`review/**` 문서 산출물이라 성능 관점에서
검토 대상이 아니다. 성능 관점에서 실제로 볼 것은 다음 5개 코드 파일이다.

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 헬퍼)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규 테스트, 구조적 가드 포함)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (소비 지점 2곳)
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (소비 지점 5곳)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` (소비 지점 1곳)

## 발견사항

- **[INFO]** 신규 헬퍼 `updateReturningRows()` 는 `Array.isArray` 검사 1~2회 + 인덱싱뿐인 O(1) 함수라 런타임 오버헤드가 무시할 수준이다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:36-57` (함수 본문)
  - 상세: 기존에는 UPDATE/DELETE 결과를 `rows.length`/`rows.map` 으로 직접 소비하던 자리를 `updateReturningRows(rows, detail).length`/`.map` 으로 감싸는 방식으로 바뀌었을 뿐, DB 라운드트립 수·쿼리 자체·트랜잭션 경계는 전혀 바뀌지 않았다. 함수 호출 1회 + 배열 인덱싱 1회가 추가되는 정도라 실질적인 성능 영향은 없다. 이는 정확성 버그 수정이며 성능 특성을 바꾸는 변경이 아니다.
  - 제안: 조치 불요.

- **[INFO]** N+1 신규 도입 없음 — 8개 소비 지점 모두 기존에 있던 단건 쿼리를 그대로 유지한다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:544-551`(embedding 재큐), `:578-591`(graph 재큐, 기존 `CHUNK_SIZE` 분할 루프 유지), `:751-780`(reset) / `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2943-2951`(admission UPDATE), `:8546-8551`(`updateExecutionStatus` guarded UPDATE) / `codebase/backend/src/modules/auth/auth-oauth.service.ts:146-152`(OAuth state DELETE)
  - 상세: 각 지점은 반환값을 `rows`(또는 `acquired`/`updated`/`reset`) 변수로 받아 `unknown` 타입으로 두고, 그 뒤 `updateReturningRows(...)` 로 한 번 언랩한 뒤 `.length`/`.map`/`.slice` 를 적용하는 구조로 바뀌었다. 반복문 안에서 쿼리를 추가로 호출하는 패턴은 어디에도 도입되지 않았고, `graphRequeued` 의 `CHUNK_SIZE` 배치 분할 루프(`:578-591` 부근)도 기존 로직을 그대로 유지한 채 대상 배열만 `rows` → `rowsOut` 으로 교체됐다.
  - 제안: 조치 불요.

- **[INFO]** 이번 수정으로 **오히려 사문화돼 있던 정상 admission 경로가 되살아나** 실행당 지연이 줄어드는 방향(성능 개선)이다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `admitExecutionOrDefer` (`updateReturningRows` 호출부, `:2943-2951` 및 주변 주석 `:2917-2919`, `:2934-2941`)
  - 상세: 기존 버그(`rows.length === 1` 이 항상 거짓) 때문에 모든 정상 admission 이 §7.5 크래시 재구동 경로로 새어나가 매 실행마다 `EXECUTION_ADMISSION_RETRY_DELAY_MS`(2s) 지연이 붙어 있었다(diff 내 주석 및 `review/code/2026/08/13/20_36_35/RESOLUTION.md` 서술로 교차 확인). 이번 수정은 정상 admission 판정이 실제로 `true` 가 되도록 고쳐, 그 2초 지연 우회 경로를 없앤다 — 부수적으로 성능(지연시간) 이 개선되는 방향이며 새로운 병목을 만들지 않는다.
  - 제안: 조치 불요(정보성 기록). e2e 관측치(4191→2242ms, RESOLUTION.md W8 기록)도 개선 방향과 일치한다.

- **[INFO]** 구조적 회귀 가드 테스트가 대형 소스 파일을 한 테스트 스위트 안에서 반복 `readFileSync` 한다 — 테스트 실행 시간에만 영향, 프로덕션 성능과 무관.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — `it.each(EXPECTED)` 블록(파일별 1회 읽기, 대상 3개 파일)과 별도의 `it('소비 지점 자체의 수가 늘면 알려준다', ...)` 블록이 `EXPECTED.map(([rel]) => readFileSync(...))` 로 **같은 3개 파일(`execution-engine.service.ts` 8,642줄 포함)을 다시 읽는다** — `it.each` 캡션 라인 근처(`EXPECTED` 배열 정의부)와 `소비 지점 자체의 수가 늘면 알려준다` 블록.
  - 상세: 같은 describe 블록 안에서 동일 파일 경로를 두 차례(검증 목적이 다르다는 이유로) 각각 다시 디스크에서 읽고 정규식으로 스캔한다. 대상 파일 중 `execution-engine.service.ts` 는 8,642줄로 나머지보다 훨씬 커서, 반복 읽기·매칭 비용이 가장 크게 실린다. 절대적인 CI 비용은 파일 I/O 수 ms~수십 ms 수준으로 미미하고, 자매 파일 `assert-row-array.spec.ts` 도 동일한 패턴(전용 `SRC`/regex 재구현)을 이미 쓰고 있어 이 diff 만의 새로운 습관은 아니다(별도로 `maintainability` 리뷰에서 보일러플레이트 중복으로 이미 지적됨).
  - 제안: 급하지 않음. 파일 내용을 `describe` 최상단에서 한 번만 읽어 두 테스트 블록이 공유하는 정도로 최소화할 수 있으나, 테스트 스위트 실행 시간에 미치는 영향이 미미해 우선순위는 낮다.

## 요약

이번 변경은 TypeORM `UPDATE`/`DELETE ... RETURNING` 튜플 shape 오인 버그를 O(1) 헬퍼 함수로 감싸는 순수 정확성 수정으로, 쿼리 수·트랜잭션 경계·반복문 구조·자료구조 선택 어느 것도 바꾸지 않는다. N+1 신규 도입, 블로킹 I/O 신규 도입, 불필요한 대규모 메모리 할당, 캐싱 필요성 모두 해당 없음. 오히려 execution-engine admission 경로에서는 버그로 인해 상시 발생하던 2초 지연 우회 경로가 없어져 부수적으로 성능이 개선되는 방향이다. 유일하게 언급할 만한 것은 신규 구조적 회귀 가드 테스트(`update-returning-rows.spec.ts`)가 대형 소스 파일을 테스트 스위트 내에서 중복 `readFileSync` 하는 점인데, 이는 프로덕션 코드 경로와 무관하고 CI 시간에 미치는 영향도 미미하며 자매 스펙 파일의 기존 패턴을 그대로 따른 것이라 새로운 문제로 보기 어렵다. CRITICAL/WARNING 급 성능 결함은 없다.

## 위험도

NONE
