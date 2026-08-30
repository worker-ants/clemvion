# 부작용(Side Effect) 리뷰

## 리뷰 범위 및 방법

이번 diff(origin/main...HEAD)는 4라운드 누적분이다 — 핵심 코드 변경은 3개
(`codebase/backend/src/common/__test-utils__/source-scan.ts`,
`codebase/backend/src/common/utils/update-returning-rows.spec.ts`,
`codebase/backend/src/modules/knowledge-base/graph/{kb-stats.helper.ts,kb-stats.helper.spec.ts}`)이고
나머지 30여 개는 `CHANGELOG.md`, `plan/in-progress/update-returning-tuple-shape.md`, 그리고
`review/code/2026/08/30/{12_41_15,13_15_58,13_46_53}/**` + `review/consistency/2026/08/30/12_17_21/**`
(이전 라운드들의 리뷰/컨시스턴시 워크플로 산출물)이다. 저장소 트리에는 아무것도 쓰지 않았다 —
`Read`/`Bash`(grep, git log, git status)로만 검증했다. 실제 소스 파일을 직접 열어 프롬프트
diff 와 대조했고(`update-returning-rows.spec.ts`, `source-scan.ts`, `kb-stats.helper.ts` 전문),
`git status --short` 로 이 리뷰 세션 자신의 산출 디렉터리 외 잔여물이 없음을 확인했다(이전
라운드 RESOLUTION.md 들이 언급한 뮤테이션 프로브 파일도 남아 있지 않다).

## 발견사항

- **[INFO]** 신설 구조 가드가 테스트 실행마다 `src/**` 전체(약 800여 파일)를 재귀적으로 읽는
  파일시스템 부작용을 도입한다 — 읽기 전용이며 설계 의도다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:225`(`listSources`),
    `:247`(`discover`), `:262`(`beforeAll` 로 1회 캐싱)
  - 상세: `listSources`/`discover` 는 `readdirSync`/`readFileSync` 로 `join(__dirname, '..', '..')`
    (저장소 내부 고정 경로)를 재귀 순회한다. 쓰기·삭제는 없고 `node_modules`/`dist` 는 제외되며,
    스캔 결과는 `beforeAll` 로 한 번만 계산돼 4개 `it` 이 공유한다(이전 라운드 WARNING 이 지적한
    3회 반복 호출은 이미 해소돼 있음을 직접 확인). 이는 diff 가 스스로 명시한 설계 목표("입력
    집합을 손으로 고르지 않고 발견한다")이며, 이 저장소의 확립된 CI 환경(로컬 파일시스템,
    네트워크 격리) 밖으로 영향이 새지 않는다. 다만 "테스트 실행이 소스 트리 전체 상태에
    결합된다"는 특성 자체는 기록해 둔다 — 다른 PR 이 대량의 파일을 추가/이동하면 이 스위트의
    실행 시간과 `discovered` 배열 크기가 함께 변한다(결과가 달라지는 것은 의도된 동작).
  - 제안: 조치 불요 — 이미 3라운드에 걸쳐 같은 결론(결함 아님)에 독립 도달했고, 이번 라운드
    코드 대조로도 재확인된다.

- **[INFO]** `kb-stats.helper.ts` 의 유일한 실질 변경은 `.query<T>()` 제네릭 타입 인자이며
  런타임 동작·시그니처·호출자에 영향이 없다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:36-38`
  - 상세: `{ entity_count; relation_count }[]` → `[{ entity_count; relation_count }[], number]` 로
    TypeScript 제네릭 인자만 바뀌었다. SQL 리터럴·파라미터 바인딩(`$1`, `[knowledgeBaseId]`)은
    동일하고, 반환값은 여전히 소비되지 않는다(`await` 만, 대입 없음). `refresh(knowledgeBaseId:
    string): Promise<void>` 공개 시그니처도 불변 — 이 헬퍼를 호출하는 지점(`graph-extraction`,
    `graph-query` 서비스) 어디에도 영향이 없다.
  - 제안: 조치 불요.

- **[INFO]** 신규 export `countRawUpdateReturning`/`hasRawUpdateReturning` 은 순수 함수이고
  기존 공개 API 에 대한 breaking change 가 아니다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:112`(`countRawUpdateReturning`),
    `:136`(`hasRawUpdateReturning`)
  - 상세: 두 함수 모두 인자로 받은 `src` 문자열만 정규식으로 스캔해 값을 반환한다. 전역
    상태·환경 변수·파일시스템·네트워크 접근이 없다. `CALL` 정규식은 함수 호출마다 새로
    생성되는 지역 변수라(`:123-124`) `matchAll` 호출 간 `lastIndex` 잔존 문제도 없다. 기존
    `countCalls`/`stripComments` 는 이 diff 에서 시그니처가 바뀌지 않았다(순수 추가). 다만
    `hasRawUpdateReturning` 은 프로덕션 코드는 물론 `update-returning-rows.spec.ts` 의 신규
    가드에서도 쓰이지 않고(그쪽은 `countRawUpdateReturning` 을 직접 씀 — `:5`, `:251`) 오직
    자기 자신의 `source-scan.spec.ts` 에서만 소비된다. 이 사실은 2라운드 리뷰
    (`review/code/2026/08/30/13_15_58/side_effect.md` INFO)가 이미 "두 번째 소비자가 생기기
    전까지 현행 유지" 로 처분해 둔 항목이라 새 결함으로 재상정하지 않는다 — 다만 인터페이스
    관점에서 "쓰이지 않는 export" 라는 사실 자체는 side effect 축이 아니라 유지보수성 축에
    가까워 별도 조치를 요구하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 환경 변수, 네트워크 호출, 이벤트/콜백 발생·변경은 이번 diff 범위(핵심 코드 3개
  파일 + 문서/plan + 리뷰 산출물)에서 관측되지 않았다.
  - 위치: 전체 diff
  - 상세: `process.env` 읽기/쓰기 없음, `fetch`/`http`/외부 SDK 호출 없음, `EventEmitter`·
    WebSocket·Nest 이벤트 발행 코드 변경 없음. `kb-stats.helper.ts` 의 클래스 상단 주석(4-19행,
    이번 diff 밖)이 과거 `kb:graph_stats_updated` WebSocket broadcast 가 dead path 였다는
    이력을 설명하지만, 이번 diff 는 그 부분을 건드리지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/08/30/{12_41_15,13_15_58,13_46_53}/**` 및
  `review/consistency/2026/08/30/12_17_21/**` 하위 30여 개 신규 파일은 이 프로젝트가 의무화한
  코드 리뷰/컨시스턴시 체크 워크플로가 정해진 경로(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`,
  `review/consistency/...`)에 남기는 예상된 산출물이다 — 신규 파일 생성만 있고 기존 파일 수정·
  삭제는 없다(전부 `new file mode`). `_resolution_state.json`/`_retry_state.json` 등에 로컬
  절대경로가 다수 등장하나 이 워크트리 자신의 파일시스템 경로일 뿐 자격증명·시크릿이 아니다
  (보안 리뷰어가 이미 같은 결론).
  - 위치: `review/code/2026/08/30/{12_41_15,13_15_58,13_46_53}/*`, `review/consistency/2026/08/30/12_17_21/*`
  - 제안: 조치 불요.

## 뮤테이션/재현 검증

이번 라운드에서 별도 뮤테이션은 수행하지 않았다 — 핵심 코드가 순수 함수(`countRawUpdateReturning`,
`findUnguarded`) 위주라 부작용 여부는 정적 대조만으로 충분히 판단 가능했고, 이전 3라운드가 이미
같은 코드 경로에 대해 뮤테이션(정규식 되돌리기·판정 로직 되돌리기·다중 unguarded 등)으로 "부작용이
아니라 의도된 동작" 임을 반복 실증해 둔 상태다. 대신 `git status --short` 로 이 세션이 저장소를
오염시키지 않았음을 확인했고, `grep -rn "hasRawUpdateReturning"` 로 소비자 범위를 직접 재확인했다.

## 요약

핵심 변경 3가지 — (1) `source-scan.ts` 에 순수 정적분석 함수 2개 신설, (2)
`update-returning-rows.spec.ts` 에 저장소 자신의 소스 트리를 읽기 전용으로 재귀 스캔하는 신규
발견형 가드(`listSources`/`discover`/`findUnguarded`) 신설, (3) `kb-stats.helper.ts` 의
`.query<>()` 제네릭 타입 인자를 실제 런타임 shape(`[rows, count]` 튜플)에 맞게 정정 — 어느 것도
전역 상태 변경, 파일 쓰기/삭제, 공개 함수 시그니처 변경, 환경 변수 접근, 네트워크 호출,
이벤트/콜백 변경을 유발하지 않는다. 유일하게 기록해 둘 특성은 신설 가드가 매 테스트 실행마다
`src/**` 전수를 파일시스템에서 읽어 들인다는 점인데, 이는 diff 가 스스로 명시한 설계 의도(입력
집합을 손으로 고르지 않고 발견한다)이자 읽기 전용·저장소 내부 한정이라 위험이 없다 — 3라운드에
걸쳐 side_effect 관점에서 반복 검토됐고 이번 라운드의 직접 코드 대조로도 같은 결론이다. 새로
도입된 CRITICAL·WARNING 급 부작용은 발견되지 않았다.

## 위험도
LOW
