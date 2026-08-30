# 부작용(Side Effect) 리뷰

## 리뷰 방법

`git diff origin/main...HEAD` (41개 파일, 실질 코드 변경은 6개 + plan 1개, 나머지 33개는
`review/code/**`·`review/consistency/**` 워크플로 산출물)를 프롬프트 diff 와 대조하고,
프롬프트 크기 제한으로 생략된 `codebase/backend/src/common/utils/update-returning-rows.spec.ts`
diff 는 `git diff origin/main...HEAD -- <path>` 로 직접 확인했다. `source-scan.ts`,
`kb-stats.helper.ts` 는 `Read` 로 현재 전체 내용을 열어 diff 서술과 대조했다. 저장소 트리에는
아무것도 쓰지 않았다 (`git status --short` 최종 확인 — 이 리뷰 세션 자체의 신규 출력 디렉터리
`review/code/2026/08/30/13_46_53/` 외 잔여물 없음). 뮤테이션 검증은 수행하지 않았다 — 대상
코드가 전부 입력→출력만 있는 순수 함수이거나 읽기 전용 파일시스템 스캔이라 정적 대조로 충분히
판정 가능했다.

이번 diff 는 이미 이전 두 라운드(`review/code/2026/08/30/12_41_15/side_effect.md`,
`review/code/2026/08/30/13_15_58/side_effect.md`)가 각각 독립적으로 부작용 관점 리뷰를 마쳤고
둘 다 결함 없음(LOW)으로 처분했다. 이번 라운드가 추가로 확인해야 할 것은 그 두 라운드
**사이에 커밋된 신규 코드**(`a2ab29e2c`, `030e9a825` — `findUnguarded` 순수 함수 추출,
`ALLOWED` 3-tuple 화, 음성 캐너리 2건 추가)가 같은 결론을 유지하는지다.

## 발견사항

- **[INFO]** `findUnguarded`(`update-returning-rows.spec.ts`, 신규 순수 함수)는 부작용이 없다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — `function findUnguarded(discovered, allowed, guardCountOf)` 정의부.
  - 상세: 인자로 받은 `discovered`/`allowed`/`guardCountOf` 만 읽어 로컬 배열 `unguarded` 를 구성해 반환한다. 전역/모듈 스코프 상태를 읽거나 쓰지 않고, 파일시스템·네트워크·환경 변수 접근이 없다. 이전 형태(이전 두 라운드가 리뷰한 시점)는 `it` 본문에 인라인이었는데, 이번 변경으로 별도 함수로 추출되면서 오히려 부작용 표면이 **더 좁아졌다** — 순수 함수가 됐기 때문에 합성 스텁으로 판정 로직을 검증하는 신규 `describe('findUnguarded — 합성 입력으로 판정 로직 자체를 고정한다')` 블록도 파일시스템을 전혀 건드리지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `discover()`/`listSources()` 의 읽기 전용 재귀 파일시스템 스캔은 이전 두 라운드에서 이미 처분된 것과 동일한 성격이며, 이번 diff 로 스캔 대상·범위·쓰기 여부에 변화가 없다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 내 `listSources()`(`readdirSync`, `node_modules`/`dist` 제외)와 `discover()`(`readFileSync` + `countRawUpdateReturning`), `beforeAll` 캐싱으로 파일당 1회.
  - 상세: `writeFileSync`/`mkdirSync`/`unlinkSync`/`rmSync`/`process.env`/`global.`/`globalThis.` 를 `codebase/backend/src` diff 전체에서 grep 했으나 0건 — 쓰기·환경 변수 접근이 전혀 없음을 직접 확인했다. 스캔 루트(`SRC = join(__dirname, '..', '..')`, `update-returning-rows.spec.ts` 위치 기준 `codebase/backend/src`)도 이전과 동일하고, 순수 함수라 `beforeAll` 로 4개 `it` 이 공유해도 테스트 간 격리가 깨지지 않는다.
  - 제안: 조치 불요 — 참고로만 재확인.

- **[INFO]** `ALLOWED` 배열이 2-tuple `[경로, 사유]` → 3-tuple `[경로, 사유, 검토한 raw 지점 수]` 로 확장됐으나, 이 배열은 `update-returning-rows.spec.ts` 파일 스코프 로컬 상수이고 export 되지 않는다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — `const ALLOWED: ReadonlyArray<readonly [string, string, number]> = [...]`.
  - 상세: 형태 변경이지만 외부에 노출되는 시그니처가 아니라 이 spec 파일 내부에서만 소비된다(`new Map(ALLOWED.map(([rel, , count]) => [rel, count]))`). 다른 파일이 이 배열을 import 하는 곳이 없어(테스트 전용, `grep -rn "ALLOWED" codebase/backend/src` 결과도 이 파일 안에서만 참조) 호출자 영향이 없다.
  - 제안: 조치 불요.

- **[INFO]** `SRC` 상수가 두 `describe` 블록의 로컬 선언에서 파일 모듈 스코프로 hoist 됐다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 상단 `const SRC = join(__dirname, '..', '..');`.
  - 상세: 값(`join(__dirname, '..', '..')`)은 이전과 동일하고, 이 파일 내부에서만 참조되는 `const` 라 진짜 "전역 변수" 도입이 아니다(모듈이 로드될 때마다 새로 계산되는 파일-local 상수). 다른 모듈에서 import 하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `kb-stats.helper.ts` 의 `.query<...>()` 제네릭 타입 인자 변경(`{...}[]` → `[{...}[], number]`)은 런타임 부작용이 없는 순수 타입 정정이다 — 직접 파일을 열어 재확인.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:36-38`(`refresh()` 메서드).
  - 상세: TypeScript 제네릭은 컴파일 타임에만 존재하며 SQL 리터럴·파라미터 바인딩(`[knowledgeBaseId]`)·반환값 소비 여부(여전히 미소비, `await` 만)는 diff 전후 동일하다. `refresh(knowledgeBaseId: string): Promise<void>` 공개 시그니처도 변경되지 않아 호출자(`graph-extraction.service.ts`, `graph-query.service.ts`) 영향 없음 — 이전 두 라운드가 이미 확인한 결론과 일치한다.
  - 제안: 조치 불요.

- **[INFO]** 신규 export `countRawUpdateReturning`/`hasRawUpdateReturning`(`source-scan.ts`)은 순수 함수이며 프로덕션 코드 소비자가 없다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:100-126`.
  - 상세: 인자로 받은 `src` 문자열만 정규식으로 스캔해 반환한다. 전역/모듈 스코프에 정규식을 두지 않고 함수마다 새로 생성해 `lastIndex` 잔존도 없다. 기존 `countCalls`/`stripComments` 시그니처는 변경되지 않은 additive 변경이다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/08/30/{12_41_15,13_15_58}/**`, `review/consistency/2026/08/30/12_17_21/**` 총 33개 신규 파일은 CLAUDE.md 가 정한 경로 규약(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, `review/consistency/...`)과 정확히 일치하는 워크플로 산출물이다. 전부 `new file mode` 이고 기존 파일 수정·삭제는 없다.
  - 위치: `review/code/2026/08/30/12_41_15/*`, `review/code/2026/08/30/13_15_58/*`, `review/consistency/2026/08/30/12_17_21/*`.
  - 상세: `_retry_state.json`/`meta.json` 안의 절대경로(`/Users/gehrig/...`)는 harness 가 자신의 세션 좌표(prompt_file/output_file)를 기록한 것으로, 코드 실행에 영향을 주는 부작용이 아니다(비밀값·자격증명 아님 — grep 으로 확인). `_resolution_state.json`/`_resolution_log.md` 에 기록된 커밋 SHA(`1a051bbe7`, `31ff78bfd`, `dd273828f`, `a2ab29e2c`, `030e9a825`)는 `git log` 실제 이력과 일치한다.
  - 제안: 조치 불요.

- **[정보 확인 — 새 결함 없음]** 시그니처·공개 인터페이스·환경 변수·네트워크 호출·이벤트/콜백 변경은 이번 diff 전체에서 관측되지 않았다.
  - `KbStatsHelper.refresh()` 시그니처 불변, `countCalls` 시그니처 불변, 신규 함수는 전부 additive export. `process.env`/`global.`/`globalThis.`/`writeFileSync`/네트워크 호출(`fetch`/`http`/`axios` 등) 패턴이 diff 범위(`codebase/backend/src/**`)에 0건.

## 요약

이번 diff 의 실질 코드 변경(`source-scan.ts` 신규 순수 함수 2개, `update-returning-rows.spec.ts` 의 발견형 가드 확장 — `findUnguarded` 추출·`ALLOWED` 3-tuple화·음성 캐너리 2건, `kb-stats.helper.ts`/`.spec.ts` 타입·mock 정정)는 전역 상태·환경 변수·네트워크·이벤트/콜백을 전혀 건드리지 않고, 유일한 파일시스템 접근은 이전 두 라운드가 이미 결함 아님으로 처분한 읽기 전용 재귀 스캔(`src/**`, 쓰기 없음)이다. 이 라운드에서 새로 등장한 코드(`findUnguarded` 순수 함수 추출, `ALLOWED` 배열 형태 확장)는 오히려 판정 로직을 파일시스템 의존에서 분리해 부작용 표면을 좁혔다. `kb-stats.helper.ts` 는 컴파일 타임 타입 정정뿐이라 런타임 동작·공개 시그니처 불변이다. `review/**` 하위 33개 신규 파일은 전부 이 저장소가 정한 산출물 경로 규약과 일치하는 정상 워크플로 결과물이며 기존 파일을 건드리지 않는다. CRITICAL·WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
