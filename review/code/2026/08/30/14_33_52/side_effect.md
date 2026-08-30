# 부작용(Side Effect) 리뷰

## 리뷰 범위 및 방법

이번 diff(`origin/main...HEAD`)는 5라운드 누적분이며, 실질 코드 변경은 5개 파일뿐이다
(`git diff --stat origin/main...HEAD -- codebase/` 로 직접 확인):

1. `codebase/backend/src/common/__test-utils__/source-scan.ts` — `countRawUpdateReturning`/`hasRawUpdateReturning` 신규
2. `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` — 위 함수 전용 테스트
3. `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 발견형 구조 가드(`listSources`/`discover`/`findUnguarded`) 신설
4. `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` — `.query<T>()` 제네릭 타입 인자 정정
5. `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` — mock 을 튜플 shape 로 정정

나머지 58개 파일은 `CHANGELOG.md`, `plan/in-progress/update-returning-tuple-shape.md`, 그리고
`review/code/2026/08/30/{12_41_15,13_15_58,13_46_53,14_11_02}/**` + `review/consistency/2026/08/30/12_17_21/**`
(선행 4라운드 리뷰/컨시스턴시 워크플로 산출물, 전부 `new file mode`)이다.

직접 대조 검증: 3개 핵심 소스 파일(`source-scan.ts`, `update-returning-rows.spec.ts`,
`kb-stats.helper.ts`)을 `Read` 로 전문 열람했고, `kb-stats.helper.spec.ts` 전문도 확인했다.
직전 라운드(`14_11_02`) side_effect 리포트를 읽고 그 결론(LOW, 신규 부작용 없음)을 그대로
받지 않고 최신 커밋(`1d606f7d0` — `git show --stat`)의 diff 를 별도로 대조해 이번 라운드의
델타가 **테스트 파일(`.spec.ts`)·`CHANGELOG.md`·`plan/`·리뷰 산출물에만 국한**되고
`kb-stats.helper.ts`(프로덕션 유일 소스)를 포함한 어떤 프로덕션 코드도 건드리지 않았음을
직접 확인했다. 저장소 트리에는 아무것도 쓰지 않았다 — `Read`/`Bash`(git show, git diff,
git status)만 사용. `git status --short` 결과 이 세션 자신의 출력 디렉터리
(`review/code/2026/08/30/14_33_52/`) 외 잔여물 없음.

## 발견사항

- **[INFO]** 신설 구조 가드가 테스트 실행마다 `src/**` 전체(약 800여 파일)를 재귀적으로 읽는
  파일시스템 부작용을 도입한다 — 읽기 전용이며 설계 의도다. (4라운드 연속 동일 결론)
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 함수 `listSources`(약 229행)·`discover`(약 251행), `beforeAll` 캐싱(약 266행)
  - 상세: `readdirSync`/`readFileSync` 로 `join(__dirname, '..', '..')`(저장소 내부 고정 경로)를 순회한다. 쓰기·삭제 없음, `node_modules`/`dist` 제외, `beforeAll` 로 1회만 계산해 5개 `it` 이 공유한다(코드로 직접 확인). diff 가 스스로 명시한 목표("입력 집합을 손으로 고르지 않고 발견한다")이며 저장소 밖으로 영향이 새지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `kb-stats.helper.ts` 의 유일한 실질 변경은 `.query<T>()` 제네릭 타입 인자이며 런타임 동작·공개 시그니처·호출자에 영향이 없다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:36-38`
  - 상세: `{ entity_count; relation_count }[]` → `[{ entity_count; relation_count }[], number]` 로 타입 인자만 변경. SQL 리터럴·파라미터 바인딩(`$1`, `[knowledgeBaseId]`)은 동일, 반환값은 여전히 미소비(`await` 만, 대입 없음). `refresh(knowledgeBaseId: string): Promise<void>` 시그니처 불변 — TypeScript 제네릭은 컴파일 타임에 지워지므로 호출자(`graph-extraction`/`graph-query` 서비스) 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** 신규 export `countRawUpdateReturning`/`hasRawUpdateReturning` 은 순수 함수, 기존 공개 API 에 대한 breaking change 아님.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` 함수 `countRawUpdateReturning`(112행)·`hasRawUpdateReturning`(136행)
  - 상세: 인자로 받은 `src` 문자열만 정규식으로 스캔해 값을 반환. 전역 상태·환경 변수·파일시스템·네트워크 접근 없음. `CALL` 정규식은 함수 스코프 지역 변수라(123-124행) `matchAll` 호출 간 `lastIndex` 잔존 문제 없음. 기존 `countCalls`/`stripComments` 시그니처 불변.
  - 제안: 조치 불요.

- **[INFO]** 이번 라운드 델타(commit `1d606f7d0`)는 테스트/문서 전용 — 프로덕션 코드 변경 없음.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.spec.ts`(양성 캐너리 1건 추가), `codebase/backend/src/common/utils/update-returning-rows.spec.ts`(개수-일치 테스트 1건 추가), `CHANGELOG.md`, `plan/in-progress/update-returning-tuple-shape.md`
  - 상세: `git show --stat 1d606f7d0` 로 직접 확인 — `kb-stats.helper.ts`/`kb-stats.helper.spec.ts`/`source-scan.ts` 는 이 커밋에서 건드려지지 않았다. `findUnguarded` 함수 자체도 이 커밋에서 수정되지 않고(직전 라운드에서 이미 확정) 그 판정을 검증하는 테스트만 늘었다.
  - 제안: 조치 불요.

- **[INFO]** 환경 변수, 네트워크 호출, 이벤트/콜백 발생·변경은 이번 diff 범위에서 관측되지 않음.
  - 위치: 전체 diff
  - 상세: `process.env` 읽기/쓰기 없음, `fetch`/`http`/외부 SDK 호출 없음, `EventEmitter`·WebSocket·Nest 이벤트 발행 코드 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/08/30/{12_41_15,13_15_58,13_46_53,14_11_02}/**` 및 `review/consistency/2026/08/30/12_17_21/**` 58개 신규 파일은 이 프로젝트가 의무화한 코드 리뷰/컨시스턴시 체크 워크플로가 정해진 경로에 남기는 예상된 산출물.
  - 위치: 위 경로 전체 (전부 `new file mode`)
  - 상세: 기존 파일 수정·삭제 없음. `_resolution_state.json`/`_retry_state.json` 등의 로컬 절대경로는 이 워크트리 자신의 경로일 뿐 자격증명·시크릿 아님.
  - 제안: 조치 불요.

## 뮤테이션/재현 검증

이번 라운드에서 별도 뮤테이션은 수행하지 않았다 — 프로덕션 코드가 이번 델타에서 전혀
건드려지지 않았고, 핵심 로직(`countRawUpdateReturning`, `findUnguarded`)이 순수 함수라
정적 대조만으로 부작용 여부를 충분히 판단 가능했다. 이전 4라운드가 이미 같은 코드 경로에
대해 뮤테이션(정규식 되돌리기·판정 로직 되돌리기·다중 unguarded·허용목록 선언값 등)으로
"부작용이 아니라 의도된 동작"임을 반복 실증해 둔 상태이며, 이번 라운드 자체 검증으로도
`git show --stat 1d606f7d0`(델타가 테스트/문서 전용임을 확인)와 `git status --short`(세션
잔여물 없음)만으로 결론이 유지됨을 재확인했다.

## 요약

핵심 변경 5개 — (1) `source-scan.ts` 순수 정적분석 함수 2개, (2) `source-scan.spec.ts`/
`update-returning-rows.spec.ts` 의 저장소 소스 트리 읽기 전용 재귀 스캔 신규 발견형 가드,
(3) `kb-stats.helper.ts` 의 `.query<>()` 제네릭 타입 인자를 실제 런타임 shape(`[rows,
count]` 튜플)에 맞게 정정, (4) `kb-stats.helper.spec.ts` mock 을 그 튜플 shape 로 동기화 —
어느 것도 전역 상태 변경, 파일 쓰기/삭제, 공개 함수 시그니처 변경, 환경 변수 접근, 네트워크
호출, 이벤트/콜백 변경을 유발하지 않는다. 유일하게 기록해 둘 특성(신설 가드가 매 테스트
실행마다 `src/**` 전수를 파일시스템에서 읽어 들이는 것)은 diff 가 스스로 명시한 설계
의도이자 읽기 전용·저장소 내부 한정이라 위험이 없으며, 4라운드에 걸쳐 side_effect 관점에서
반복 검토되고 이번 라운드의 직접 코드·커밋 대조로도 같은 결론이다. 이번 라운드의 실질
델타(`1d606f7d0`)는 테스트 캐너리 2건 추가와 문서 정정뿐이라 새로운 부작용 표면을 전혀
열지 않는다. 새로 도입된 CRITICAL·WARNING 급 부작용은 발견되지 않았다.

## 위험도
NONE
