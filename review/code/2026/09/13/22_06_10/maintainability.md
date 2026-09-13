# 유지보수성(Maintainability) 리뷰 — error-code-emission-axis

## 검토 범위

실질 코드 변경은 두 파일이다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
(발행 축 정규식 3종 + 공용 수집기 `collectMatches` + `GUIDE_NON_EMITTED_VOCABULARY` +
판정 함수 3종)와 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
(그 축을 소비하는 테스트 + `parseWhereRefs`/`staleGuideEntries`/`resolveSourceLines` 헬퍼).
나머지(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·`review/**`)는 문서·plan·
리뷰 산출물이라 유지보수성 관점의 실질 대상이 아니다. 프롬프트에 diff 가 생략된 두 파일은
`git diff origin/main --` 로 직접 대조하고 줄 번호는 대상 파일을 `Read`/`Grep` 으로 재확인했다
(아래 위치는 전부 원본 파일의 1-기준 실제 줄 번호).

## 발견사항

- **[WARNING]** `parseWhereRefs` 의 다중-위치 구분자(`·`)가 비검증 — 잘못된 구분자를 쓰면
  이 PR 이 이번에 고친 것과 **같은 클래스의 결함**(둘째 위치가 조용히 미검증)이 다른 경로로
  재발한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:56-63`
    (`parseWhereRefs` 정의), 소비처는 `:264-300`(테스트 본문), 데이터는
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:339-360`
    (`GUIDE_NON_EMITTED_VOCABULARY` 의 `where` 문자열 리터럴)
  - 상세: RESOLUTION 에 따르면 라운드 2 에서 `where` 가 `파일:줄` 을 **여러 개** 담을 때
    `.exec()` 단일 매치가 둘째부터 검증을 놓치는 결함을 고쳤다. 고친 방법은 `where` 문자열에
    `·`(가운뎃점) 로 이어진 여러 줄 번호를 정규식(`(\d+(?:·\d+)*)`)으로 전부 걷는 것이다.
    그런데 이 구분자는 **타입으로도 검증으로도 강제되지 않는 순수 문자열 관례**다. 만약
    다음 등록 항목이 `where: "foo.ts:10, 20"`(쉼표) 이나 `"foo.ts:10 및 20"` 처럼 `·`
    대신 다른 구분자를 쓰면, 정규식은 첫 번째 숫자(`10`)까지만 매치하고 `, 20`/` 및 20`
    은 `.ts:` 접두가 없어 아예 매치되지 않는다. `refs.length === 0` 가드(line 277)는 이
    경우를 못 잡는다 — `refs` 가 `[{file, line:10}]` 로 **비어있지 않기** 때문에, 실제로는
    둘째 위치가 통째로 미검증인데도 테스트는 GREEN 이다. 즉 방금 고친 "여러 위치 중
    일부만 검증됨" 결함이 실패 모드만 바꿔 그대로 남아 있고, 이걸 막는 유일한 방법이
    "등록자가 정확히 `·` 를 쓴다"는 사람이 지켜야 하는 규약뿐이다.
  - 제안: `where` 를 자유 문자열 대신 `{ file: string; lines: number[] }[]` 같은 구조화된
    타입으로 바꾸거나, 최소한 `parseWhereRefs` 안에서 "`\.ts:\d` 패턴이 매치 밖에 남아
    있지 않은지"(예: `where.match(/\.ts:\d/g)?.length` 와 `refs` 파생 위치 수를 비교)를
    검증해 구분자 오기재 시 테스트가 RED 로 알리게 한다.

- **[INFO]** `where` 검증 테스트 본문이 이중 루프 + 다중 `continue` 를 인라인으로 담고
  있어, 그 조합 로직 자체는 별도 단위 테스트 대상이 아니다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:264-300`
    (`it("where 의 파일:줄 이 실제로 그 토큰을 담는다...")`)
  - 상세: `parseWhereRefs` 와 `resolveSourceLines` 는 각각 별도 `describe` 로 경계 대조군을
    갖췄지만(`:302-315`, `:566-579` 부근), 그 둘을 엮어 "누락 항목을 모으는" 상위 오케스트레
    이션(중첩 for-of 2단 + `continue` 2회 + 조건부 `broken.push`)은 이 `it()` 안에만 있고
    자체 단위 테스트가 없다. RESOLUTION.md(`review/code/2026/09/13/19_51_33/RESOLUTION.md`
    INFO 처분표 #4)가 "부분 고침 — 파싱은 분리, 트리 탐색은 남김"으로 이미 낮은 우선순위로
    기록해 둔 항목과 같은 지점이다.
  - 제안: 우선순위 낮음(이미 트래킹됨). 등록 목록이 더 커지면 `computeNonEmittedOffenders`
    처럼 이 조합도 export 된 순수 함수로 뽑아 테스트하는 편이 일관적이다.

- **[INFO]** 리뷰 라운드 폴더 경로가 프로덕션 소스 JSDoc 에 영구 인용으로 박혀 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:251-252`,
    `:277`, `:441`, `:472-474` 등 (예: `` `review/consistency/2026/09/13/18_40_54`
    plan_coherence INFO#3` ``, `` `review/code/2026/09/13/19_23_22` maintainability
    WARNING#7` ``)
  - 상세: 이 저장소 자체 관례상 `review/**` 는 SoT 가 아니고(`plan/complete/archive` 처럼
    영구 보관 대상도 아님), 오래된 리뷰 세션 폴더가 나중에 정리·보관되면 소스 코드
    docstring 이 가리키는 "왜 이렇게 짰는지"의 근거가 깨진 링크로 남는다. 설계 근거 자체
    (`matchAll` 로 `lastIndex` 오염을 피한다, 판정을 정본 함수로 합쳤다 등)는 코드에 남을
    가치가 있지만, "몇 라운드 몇 시각 세션의 몇 번째 지적이 이걸 발견했다"는 서지 정보는
    커밋 메시지나 CHANGELOG 쪽 몫에 가깝다. 다만 이 파일은 이미 기존에도(존재 축 관련
    주석) 같은 스타일을 유지해 온 파일이라(`scope.md` 도 동일하게 확인) 이번 diff 가 새로
    도입한 패턴은 아니며, 심각도를 낮게 둔다.
  - 제안: 조치 강제하지 않음 — 다만 이 축이 앞으로도 늘어나면(§발행 축 JSDoc 자체가
    "다섯 번째 축이 추가되면" 을 이미 언급) 리뷰-세션 서지 인용은 점점 늘어나는 방향이라,
    언젠가 별도 CHANGELOG/plan 링크로 옮기는 편이 파일을 가볍게 유지한다.

- **[INFO]** `collectCatalogCodes` 는 실행 본문이 2줄인데 JSDoc 이 그 20배(~38줄)에 이른다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:394-434`
    (JSDoc `:394-431`, 함수 본문 `:432-434`)
  - 상세: JSDoc 이 "탈출구가 오늘 발화하지 않는다"는 시점 의존적 실측 결과와 그 실측이
    한 번 틀렸다가 정정된 이력, 남겨두는 이유(트래커 항목이 나중에 발화시킨다)까지 전부
    담고 있어 정보 밀도는 높지만, 함수 자체가 하는 일("한 정규식으로 카탈로그 코드를
    걷는다")을 파악하려는 독자가 그 사실에 도달하기까지 많은 서사를 통과해야 한다. 같은
    패턴이 `computeNonEmittedOffenders`(`:461-479`, 본문 4줄에 JSDoc 15줄)에도 반복된다.
  - 제안: 지금 당장 조치가 필요한 결함은 아니다(이 파일의 기존 스타일과 일치, 테스트가
    "0회 발화" 를 단언으로 고정해 서술이 조용히 stale 해지는 것은 막아 둠). 다만 "함수가
    무엇을 하는가"(1~2문장)와 "왜 이런 형태인가/이력"을 문단으로 분리해 앞에 짧은 요약을
    두면 훑어보기 비용이 줄어든다.

- **[INFO]** 로컬 변수명 `sets` 가 지나치게 일반적 — 실제로는 발행 축 전용 4-집합 번들
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:158-163`
  - 상세: 982줄짜리 파일 안에서 `sets` 라는 이름은 문맥 없이는 무엇의 집합인지 알 수 없다
    (실제로는 `messagePrefixes`/`quotedLiterals`/`catalogCodes`/`registered` 네 개를 묶은
    "발행 축 판정 입력"). 바로 위 주석("판정 정본에 넘길 네 집합")이 의도를 설명하긴
    하지만, 이름 자체가 스코프를 드러내면 주석 의존도가 줄어든다.
  - 제안: `nonEmittedSets` 또는 `emissionAxisSets` 정도로 좁히면 파일 뒤쪽에서 재등장할 때도
    바로 식별된다. 낮은 우선순위.

- **[INFO]** 상한/재인용 검사 쌍이 두 허용목록 사이에 거의 동일한 형태로 반복
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:317-330`
    (`GUIDE_NON_EMITTED_VOCABULARY` 용)과 `:450-459`(`GUIDE_EXTERNAL_VOCABULARY` 용)
  - 상세: "상한 N건을 넘지 않는다" 단언과 "여전히 인용된다" 단언이 두 `describe` 에 구조적으로
    복제돼 있다. 후자는 이미 `staleGuideEntries` 공용 헬퍼로 판정 로직 중복은 제거했지만,
    `it()` 골격(제목·구조) 자체는 두 곳에 남아 있다.
  - 제안: 각 본문이 1~3줄이라 지금 추출 비용 대비 이득이 낮다(실패 메시지 추적성도
    떨어질 수 있음) — 조치 불필요, 세 번째 유사 목록이 생기면 그때 `it.each` 형태로
    통합을 재검토.

## 긍정적으로 확인한 점

- `collectMatches` 로 세 수집기(`collectQuotedLiterals`/`collectMessagePrefixes`/
  `collectCatalogCodes`)의 근접 중복을 실제로 제거했고(정규식·그룹 번호만 파라미터화),
  `matchAll` 채택으로 이 파일에 이미 4곳 있는 수동 `lastIndex` 리셋 관용구를 다섯 번째로
  늘리지 않은 판단이 합리적이다.
- `isMessagePrefixOnly`/`computeNonEmittedOffenders` 를 스캐너 쪽으로 export 해 판정 로직
  소유권을 존재 축과 같은 위치로 맞췄고, 베이스라인 단언과 대조군이 같은 함수를 호출하도록
  합쳐 "헬퍼 테스트 ≠ 호출부 테스트" 형태의 재발을 막았다 — 이 저장소가 이미 이름 붙인
  결함 클래스에 대한 정확한 대응이다.
- `GUIDE_EXTERNAL_VOCABULARY` ↔ `GUIDE_NON_EMITTED_VOCABULARY` 두 목록을 "거울상"으로
  명시하고 제약이 정반대임을 표로 문서화한 것은 다음 사람이 두 목록을 합치려는 실수를
  막는 데 실질적으로 기여한다.
- 네이밍은 기존 파일 컨벤션(`collect*`/`is*`/`compute*`, `UPPER_SNAKE` 상수)과 일관적이다.

## 요약

이번 배치의 실질 코드는 `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`
두 파일이며, 판정 로직을 정본 함수로 합치고 근접 중복 수집기를 제네릭 헬퍼로 통합하는 등
직전 라운드들이 지적한 유지보수성 결함을 실제로 해소했다. 남은 것은 대체로 낮은 우선순위의
관찰이다 — 유일하게 조치를 권하는 항목은 `parseWhereRefs` 의 다중-위치 구분자(`·`)가
타입/검증으로 강제되지 않아, 등록자가 다른 구분자를 쓰면 이 PR 이 방금 고친 "위치 일부
미검증" 결함이 실패 모드만 바꿔 조용히 재발할 수 있다는 점이다. 그 외 서사형 JSDoc 이
함수 본문보다 압도적으로 길고 리뷰 세션 폴더를 영구 인용하는 패턴은 이 파일의 기존 스타일과
일치해 새로 도입된 문제가 아니며, 축이 늘어날 때 누적 비용으로만 관찰해 두면 된다.

## 위험도

LOW
