# 테스트(Testing) 리뷰 결과

## 검토 방법

프롬프트 diff(93k 토큰, 100개 파일 나열)는 6개 실제 코드/신규 plan 파일 외에 `review/code/**`·
`review/consistency/**` 산출물(5라운드 누적, 94개 파일)이 대부분을 차지한다. 이 리뷰는 실제 소비
대상인 코드 변경(`update-returning-rows.ts`/`.spec.ts`, `auth-oauth.service.ts`/`.spec.ts`,
`execution-engine.service.ts`/`.spec.ts`, `knowledge-base.service.ts`/`.spec.ts`, `assert-row-array.spec.ts`)
에 집중했고, 프롬프트에서 diff 가 생략된 파일은 저장소에서 직접 `Read`/`Grep` 하여 현재 상태를
확인했다. `review/**` 산출물 자체는 과거 라운드의 자기-리뷰 기록이라 이번 라운드의 "테스트 코드"
평가 대상이 아니지만, 그 안에 기록된 조치(뮤테이션 결과 등)가 현재 코드에 실제로 반영됐는지는
직접 코드를 열어 교차 검증했다.

## 발견사항

- **[INFO]** `auth-oauth.service.ts` 의 `handleCallback`(소셜 로그인 콜백) 튜플-shape 수정에 대해
  실제 pg 드라이버(또는 testcontainer)를 태우는 통합/e2e 테스트가 없다 — 여전히
  `dataSource.query` 를 mock 한 단위 테스트만 존재한다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.spec.ts` (테스트 전체, `handleCallback`
    describe 블록), 대응 소스 `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`handleCallback`)
  - 상세: 이번 결함 클래스 전체(engine 2곳·KB 5곳·auth-oauth 1곳)의 근본 원인은 "mock 이 실제
    TypeORM 드라이버 shape 을 잘못 인코딩해 GREEN 이 아무것도 증명하지 않았다"는 것이었다
    (`update-returning-rows.spec.ts:36-39` JSDoc, `plan/in-progress/update-returning-tuple-shape.md:79`
    "e2e 는 최종 상태만 봤다"). 이번 수정으로 `auth-oauth.service.spec.ts` 는 실측 shape
    (`[[validState], 1]`/`[[], 0]`)을 mock 값으로 반영해 **단위 테스트 자체의 신뢰도**는 크게
    개선됐지만, mock 이 실제 드라이버 shape 과 다시 어긋나는 미래의 재발(예: TypeORM 마이너
    업그레이드로 shape 이 또 바뀌는 경우)은 여전히 이 단위 테스트만으로는 잡을 수 없다 — mock
    값 자체가 다시 틀리면 같은 방식으로 GREEN 이 나온다. `codebase/backend/test/` 아래 OAuth
    콜백을 태우는 e2e 스펙은 존재하지 않는다(grep 결과 0건). 개발자도 이를 인지하고 있고
    (`plan/in-progress/update-returning-tuple-shape.md:207` "소셜 로그인 성공률 — 0% 에서
    회복되는지" 를 배포 후 관측 항목으로 등재), engine 의 admission 경로는 실제로
    `execution-concurrency-cap` e2e 로 타이밍 회귀까지 실측했지만(`:166-184`, 4191ms→2242ms)
    auth-oauth 경로는 같은 수준의 e2e 보강이 없다는 비대칭이 남는다.
  - 제안: OAuth 콜백을 실제로 왕복시키는 e2e(스텁 OAuth provider 사용 가능)를 추가하면 이 결함
    클래스의 재발을 가장 강하게 막을 수 있다. 다만 외부 provider mock 구성 비용이 있어 이번 PR
    범위 내 필수로 보기보다는, 이미 plan 에 등재된 배포 후 관측(성공률 회복 확인)과 별개로 후속
    e2e 백로그로 명시 등재할 것을 권한다.

- **[INFO]** `updateReturningRows` 는 `[null, 1]`, `[undefined, 1]` 처럼 첫 원소가 배열도 아니고
  전체가 배열도 아닌 게 아닌 "형태가 이상한 튜플"(첫 원소가 `null`/객체 등)에 대한 테스트가 없다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts` (`updateReturningRows` 함수 —
    `if (Array.isArray(result[0])) { return result[0] as T[]; } return result as T[];` 두 줄),
    대응 spec `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (전체 `it`/`it.each` 블록)
  - 상세: 현재 spec 은 (a) 정상 튜플 `[[{id}],1]`, (b) 0행 튜플 `[[],0]`, (c) 행 배열 직접
    `[{id}]`/`[]`, (d) 완전 비-배열(`undefined`/`null`/객체)의 4가지 형태만 커버한다. 만약 드라이버가
    `[null, 1]` 처럼 첫 원소가 배열이 아닌 값(비-배열이지만 falsy)을 돌려주는 극단 상황이면
    `Array.isArray(result[0])` 이 `false` 가 되어 `return result as T[]` 분기로 빠지고, 그 결과
    `[null, 1]` 자체가 "행 배열"로 오인되어 `.length === 2`(항상 참)·`.map(r => r.id)` 가
    `null.id` 로 터지는 경로가 열린다. 실측 근거(JSDoc)상 이 shape 이 실제로 발생한다는 증거는
    없어 매우 낮은 확률의 이론적 엣지 케이스지만, 이 헬퍼 자체가 "드라이버 shape 을 못 믿는다"는
    전제로 만들어졌다는 점을 고려하면 이 조합만 비어 있는 점은 기록해 둘 값어치가 있다.
  - 제안: 필수는 아님. 추가하려면 `updateReturningRows([null, 1], 'ctx')` 가 현재 무엇을
    반환/던지는지 최소 1건만 고정해 두면 향후 동작 변경 시 의도치 않은 회귀를 잡을 수 있다.

## 회귀·기존 테스트 유효성 확인 (직접 대조)

- `assert-row-array.spec.ts` 의 구조적 가드(`자매 지점 전수`)는 `execution-engine.service.ts` 의
  `queries:3, guards:1` 을 기대하는데, 실제 소스(`assertRowArray` 호출 1곳 — `lockNonTerminalExecutionRow`,
  `updateReturningRows` 호출 2곳 — admission·`updateExecutionStatus`)와 정확히 일치함을 grep 으로
  확인했다. 이 가드는 실제로 3개 라운드 전 자기 자신의 편집(assertRowArray → updateReturningRows
  치환)에 의해 RED 로 떨어졌던 이력이 있고(`20_36_35/RESOLUTION.md` "부수 발견"), 지금은 그 갱신이
  반영된 상태다.
- `update-returning-rows.spec.ts` 의 `EXPECTED` 카운트(`execution-engine:2`, `knowledge-base:5`,
  `auth-oauth:1`)도 각 파일의 `updateReturningRows(` 호출 수와 grep 으로 대조해 일치를 확인했다.
- `knowledge-base.service.ts` 의 5개 소비 지점(재추출 CAS·재임베딩 CAS·embedding 재큐·graph
  재큐·reset) 전부에 `detail` 인자가 실제로 채워져 있음을 확인했다(타입 시그니처가 필수로 승격돼
  있어 컴파일러도 강제한다) — 직전 라운드(`22_45_24`) WARNING 1 이 지적한 5곳 누락은 현재 상태에서
  해소돼 있다.
- `execution-engine.service.ts:533` 상당 지점(embedding 재큐 분기, KB 파일 기준)이 `unknown` 타입으로
  통일돼 있음을 확인했다 — `23_07_11` maintainability WARNING("형제 분기 중 한쪽만 옛 제네릭 잔존")이
  지적한 지점은 현재 상태에서 수정돼 있다.
- `knowledge-base.service.spec.ts` 의 판별 테스트(embedding 재큐 2건, graph 재큐 3건)가 서로 다른
  개수의 fixture(`2` vs `3`)를 사용해, 튜플 길이가 항상 2 라는 함정("2 로는 분기를 못 가른다")을
  피하고 있음을 확인했다 — 프로젝트 교훈("분기를 못 가르는 fixture")이 실제로 반영돼 있다.
- `execution-engine.service.spec.ts` 최상위 `beforeEach`(255번째 근방)가 매 테스트마다 서비스·mock
  을 재생성해, `mockExecutionRepo.manager.transaction` 을 테스트별로 재할당하는 다수의 admission
  테스트 사이에 mock 오염이 없음을 확인했다(테스트 격리 양호).
- `retry-turn.service.spec.ts` 는 드라이버 인터페이스(`mockDriver.updateExecutionStatus`) 레벨에서
  `mockResolvedValueOnce(false)` 를 주입하므로, 이번 튜플-shape 수정과 무관하게 계속 유효하다 —
  이 관찰은 `plan/in-progress/retry-turn-terminal-guard.md` 의 소급 정정 배너("단위 테스트는 잘못이
  없다")와 일치한다(직접 코드 확인으로 재검증 완료).

## 요약

리뷰 대상 diff 는 이미 5차례의 `/ai-review`+RESOLUTION 라운드(`20_36_35`→`22_45_24`→`23_07_11`→
`23_27_48`→`23_46_00`)를 거치며 testing 관점 CRITICAL 이 순차적으로 해소돼 온 결과물이며, 이번
리뷰에서 직접 코드를 열어 대조한 결과 이전 라운드가 주장한 조치(구조적 가드 값 일치, KB 5곳
`detail` 보강, 판별 fixture 값 분리, `unknown` 타입 통일, mock 격리)가 실제로 현재 상태에
반영돼 있음을 확인했다. `updateReturningRows` 헬퍼 자체의 정상/예외/판별 경로, 8개 소비 지점
전부의 실측-shape 회귀 가드, `it.each` 를 통한 엣지 케이스(undefined/null/객체) 커버는 테스트
품질 관점에서 이미 높은 수준이다. 남은 갭은 두 건 모두 INFO 수준이다: (1) `auth-oauth` 소셜 로그인
콜백 경로에 실제 드라이버/e2e 검증이 없어 "mock 이 실제 shape 과 다시 어긋나는" 같은 클래스의
재발을 이 테스트만으로는 못 막는다(이미 배포 후 관측으로 부분 보완됨), (2) `updateReturningRows`
가 `[null, 1]` 류의 이론적 극단 shape 에 대한 명시적 테스트가 없다. 둘 다 CRITICAL/WARNING 급
결함은 아니며, 전반적으로 이 diff 의 테스트 커버리지·격리·회귀 방지 설계는 견고하다.

## 위험도

LOW
