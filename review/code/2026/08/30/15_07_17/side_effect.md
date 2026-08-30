# 부작용(Side Effect) 리뷰

## 리뷰 범위 및 방법

이번 diff(`origin/main...HEAD`)는 6라운드 누적분이다. 실질 코드 변경은 5개 파일뿐이고
(`git diff --stat origin/main...HEAD -- codebase/` 로 확인):

1. `codebase/backend/src/common/__test-utils__/source-scan.ts` — `countRawUpdateReturning`/`hasRawUpdateReturning` 신규(순수 함수)
2. `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` — 위 함수 전용 양성/음성 캐너리
3. `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 발견형 구조 가드(`listSources`/`discover`/`findUnguarded`) 신설
4. `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` — `.query<T>()` 제네릭 타입 인자 정정
5. `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` — mock 을 튜플 shape 로 정정 (+ 최신 커밋 `e5b237377` 에서 인라인 주석을 영어→한국어로 번역, 코드·단언 불변)

나머지는 `CHANGELOG.md`, `plan/in-progress/update-returning-tuple-shape.md`, 그리고
`review/code/2026/08/30/{12_41_15,13_15_58,13_46_53,14_11_02,14_33_52}/**` +
`review/consistency/2026/08/30/{12_17_21,14_43_41}/**`(선행 라운드 리뷰/컨시스턴시 워크플로
산출물, 전부 `new file mode`)다.

직접 대조 검증: `git diff origin/main...HEAD -- <5개 핵심 파일>` 전문을 읽고 각 함수 본문을
직접 확인했다. 이번 라운드의 유일한 신규 커밋(`e5b237377`, `15:07:10`)을 `git show`로
단독 대조한 결과 `kb-stats.helper.spec.ts` 두 인라인 주석의 언어(영→한)만 바뀌었고 mock
값·단언·SQL·타입은 1글자도 바뀌지 않았다 — 이번 라운드는 실질적으로 **부작용 표면이
전혀 늘지 않는 comment-only 델타**다. 저장소 트리에는 아무것도 쓰지 않았다(`Read`/`Bash`
grep·git show·git status 만 사용). `git status --short` 결과 이 세션 자신의 출력
디렉터리(`review/code/2026/08/30/15_07_17/`) 외 잔여물 없음.

## 발견사항

- **[INFO]** 신설 구조 가드가 테스트 실행마다 `src/**` 전체(약 800여 파일)를 재귀적으로 읽는
  파일시스템 부작용을 도입한다 — 읽기 전용이며 설계 의도다. (6라운드 연속 동일 결론)
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 함수 `listSources`(약 121행)·`discover`(약 251행), `beforeAll` 캐싱(약 265행)
  - 상세: `readdirSync`/`readFileSync` 로 `join(__dirname, '..', '..')`(저장소 내부 고정 경로)를 순회한다. `writeFileSync`/`unlinkSync`/`rmSync`/`mkdirSync` grep 결과 0건 — 쓰기·삭제 없음(직접 확인). `node_modules`/`dist` 는 명시적으로 제외되고, 스캔 결과는 `beforeAll` 로 1회만 계산돼 여러 `it` 이 공유한다. diff 가 스스로 명시한 설계 목표("입력 집합을 손으로 고르지 않고 발견한다")이며 저장소 밖으로 영향이 새지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `kb-stats.helper.ts` 의 유일한 실질 변경은 `.query<T>()` 제네릭 타입 인자이며 런타임 동작·공개 시그니처·호출자에 영향이 없다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:36-38`(`.query<[{ entity_count: number; relation_count: number }[], number]>`)
  - 상세: `{ entity_count; relation_count }[]` → `[{ entity_count; relation_count }[], number]` 로 TypeScript 제네릭 인자만 바뀌었다. SQL 리터럴·파라미터 바인딩(`$1`)은 동일. `grep -rn "kbStats.refresh"` 로 호출부 3곳(`graph-query.service.ts:194,243`, `graph-extraction.service.ts:255`)을 직접 확인 — 전부 `await this.kbStats.refresh(...)` 형태로 반환값을 대입·소비하지 않는다. `refresh(knowledgeBaseId: string): Promise<void>` 공개 시그니처도 불변.
  - 제안: 조치 불요.

- **[INFO]** 신규 export `countRawUpdateReturning`/`hasRawUpdateReturning` 은 순수 함수, 기존 공개 API 에 대한 breaking change 아님.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:112`(`countRawUpdateReturning`), `:136`(`hasRawUpdateReturning`)
  - 상세: 인자로 받은 `src` 문자열만 정규식으로 스캔해 값을 반환. 전역 상태·환경 변수(`process.env` grep 0건)·파일시스템·네트워크 접근 없음. `CALL` 정규식은 함수 스코프 지역 변수(매 호출 재생성)라 `matchAll` 호출 간 `lastIndex` 잔존 문제 없음. `grep -rn "hasRawUpdateReturning|countRawUpdateReturning"` 결과 `hasRawUpdateReturning` 은 자기 테스트 파일 외 소비자 없음(선행 라운드가 이미 "두 번째 소비자 등장 전까지 현행 유지"로 처분한 항목과 동일 — 재상정하지 않음), `countRawUpdateReturning` 은 두 신규 스펙 파일에서만 소비됨. 기존 `countCalls`/`stripComments` 시그니처는 이 diff 에서 변경되지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 이번 라운드의 유일한 신규 커밋(`e5b237377`)은 주석 언어 번역뿐 — 부작용 표면 변화 없음.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` (두 `it` 블록의 인라인 주석)
  - 상세: `git show e5b237377`로 대조한 결과 `dataSource.query.mockResolvedValue([[{ entity_count: 12, relation_count: 34 }], 1])` / `[[], 0]` 등 mock 값·단언·구조는 직전 라운드(`14_33_52`)와 바이트 단위로 동일하고, 두 곳의 인라인 주석만 영어에서 한국어로 바뀌었다. 실행 경로·전역 상태·시그니처에 대한 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** 환경 변수, 네트워크 호출, 이벤트/콜백 발생·변경은 이번 diff 범위에서 관측되지 않음.
  - 위치: 전체 diff
  - 상세: `process.env` 읽기/쓰기 없음, `fetch`/`http`/외부 SDK 호출 없음, `EventEmitter`·WebSocket·Nest 이벤트 발행 코드 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/08/30/{12_41_15,13_15_58,13_46_53,14_11_02,14_33_52}/**` 및 `review/consistency/2026/08/30/{12_17_21,14_43_41}/**` 신규 파일은 이 프로젝트가 의무화한 코드 리뷰/컨시스턴시 체크 워크플로가 정해진 경로에 남기는 예상된 산출물.
  - 위치: 위 경로 전체 (전부 `new file mode`)
  - 상세: 기존 파일 수정·삭제 없음. `_resolution_state.json`/`_retry_state.json` 등의 로컬 절대경로는 이 워크트리 자신의 경로일 뿐 자격증명·시크릿이 아니다.
  - 제안: 조치 불요.

## 뮤테이션/재현 검증

이번 라운드에서 별도 뮤테이션은 수행하지 않았다 — 이번 델타(`e5b237377`)가 주석 언어
번역뿐이라 실행 경로에 변화가 없고, 핵심 로직(`countRawUpdateReturning`, `findUnguarded`)은
이전 라운드에서 정적 대조와 반복 뮤테이션(정규식 되돌리기·판정 로직 되돌리기·다중
unguarded·허용목록 선언값 교차검증 등)으로 이미 "부작용이 아니라 의도된 동작"임이
실증돼 있다. 이번 라운드는 `git show e5b237377`(델타가 주석 2곳뿐임을 확인)와
`git status --short`(세션 잔여물 없음)로 그 결론이 흔들리지 않음을 재확인했다.

## 요약

핵심 변경 5개 — (1) `source-scan.ts` 순수 정적분석 함수 2개, (2) `source-scan.spec.ts`/
`update-returning-rows.spec.ts` 의 저장소 소스 트리 읽기 전용 재귀 스캔 신규 발견형 가드,
(3) `kb-stats.helper.ts` 의 `.query<>()` 제네릭 타입 인자를 실제 런타임 shape(`[rows,
count]` 튜플)에 맞게 정정, (4) `kb-stats.helper.spec.ts` mock 을 그 튜플 shape 로 동기화 —
어느 것도 전역 상태 변경, 파일 쓰기/삭제, 공개 함수 시그니처 변경, 환경 변수 접근, 네트워크
호출, 이벤트/콜백 변경을 유발하지 않는다. 유일하게 기록해 둘 특성(신설 가드가 매 테스트
실행마다 `src/**` 전수를 파일시스템에서 읽어 들이는 것)은 diff 가 스스로 명시한 설계
의도이자 읽기 전용·저장소 내부 한정이라 위험이 없으며, 5라운드에 걸쳐 side_effect 관점에서
반복 검토돼 왔다. 이번(6번째) 라운드의 실질 델타는 주석 언어 번역 1건뿐이라 새로운 부작용
표면을 전혀 열지 않는다. 새로 도입된 CRITICAL·WARNING 급 부작용은 발견되지 않았다.

## 위험도
NONE
