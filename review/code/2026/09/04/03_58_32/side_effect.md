# 부작용(Side Effect) 리뷰 — repo-guard walker 통합 + 낡은 spec 캐스트 가드 (7R)

## 검증 방법

`git diff origin/main` 으로 이번 브랜치 전체 diff(83 files, +7568/-91)를 확인하고, 핵심
코드 변경 8개 파일(`source-scan.ts`/`.spec.ts`, `audit-action-binding-guard.ts`,
`engine-error-code-anchor-guard.ts`, `masked-reject-callers-guard.ts`/`.spec.ts`,
`nullable-type-lie-cast-guard.ts`/`.spec.ts`, `redis-fail-open-catalog-guard.ts`)의
**diff 전체**를 직접 `git diff` 로 열어 확인했다. `plan/in-progress/entity-nullable-column-type-mismatch.md`
diff 도 확인했다(서술 갱신뿐). 그 외 70여 개 파일은 `review/code/2026/09/04/{01_48_39,01_49_18,02_12_38,02_35_22,02_57_22,03_17_44,03_37_37}/**`
아래 이전 리뷰 라운드 산출물 커밋으로, 이 저장소 관례상(`CLAUDE.md`) 정식 추적 대상이며
markdown/JSON 리포트라 side-effect 표면이 없다.

- `git log --oneline -15` + `git show --stat d44a8b637`(HEAD, 직전 라운드 03_37_37 이후 최신
  fix 커밋)로 이번 라운드에서 03_37_37 side_effect 리뷰 이후 **실제로 바뀐 코드**가
  `masked-reject-callers.spec.ts` +35줄(새 `describe('스캔 대상에 .spec.ts 가 포함된다', …)`
  블록, `includeSpec: true` 배선 직접 단언)뿐임을 확인 — 그 델타를 diff 로 전문 확인했다.
- `process.env`/`fetch(`/`http.request`/`axios`/`child_process`/`execSync`/`spawn(` 을 8개
  핵심 파일에 grep — 0건.
- `writeFileSync`/`mkdirSync`/`rmSync`/`mkdtempSync` 사용처를 전수 확인 — 전부
  `os.tmpdir()` 하위이고 `try/finally`(`withFiles`) 또는 `afterEach`(`source-scan.spec.ts`)로
  정리됨.
- `collectScanTargets`/`listSourceFiles`/`listProductionSources`/`collectSourceFiles`/
  `walkTsFiles`/`collectTsFiles`/`stripComments`/`stripLiterals` 를 `codebase/backend/src`
  전체에 grep — 소비처는 전부 형제 가드/spec 내부뿐, 프로덕션 런타임 코드(`modules/**`)
  참조 0건.
- `WIDENED_DECL`/`SPEC_CAST`/`COLUMN_NAME` 등 모듈 스코프 정규식이 `matchAll()`(호출마다
  새 iterator) 또는 비-`g` `.exec()` 로만 쓰이는지 확인 — `g`-flag `lastIndex` 공유 상태
  버그 클래스 아님.
- 저장소 트리에는 아무것도 쓰지 않았다 — `Read`/`Bash`(`grep`/`git diff`/`git show`/`git log`/
  `git status`)만 사용. `git status --short` 로 이 세션 산출물 디렉터리 외 변경 없음을
  확인(작업 종료 시점).

## 발견사항

- **[INFO]** 5개 walker 사본이 `collectTsFiles` 하나로 수렴 — 결함 표면(blast radius)이
  한 곳으로 합쳐짐
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` 의
    `collectTsFiles` 정의(신규 `export function collectTsFiles(...)`, 파일 끝부분) —
    소비처는 `audit-action-binding-guard.ts`(`collectSourceFiles`),
    `engine-error-code-anchor-guard.ts`(직접 호출), `masked-reject-callers-guard.ts`
    (`listSourceFiles`), `redis-fail-open-catalog-guard.ts`(`listProductionSources`),
    `nullable-type-lie-cast-guard.ts`(`collectScanTargets`)
  - 상세: 종전엔 5개 가드가 각자 독립된 `readdirSync` 재귀 walker 사본을 가져 결함이
    국소적이었다. 지금은 전부 `collectTsFiles` 하나에 위임하므로, 그 함수에 결함이 생기면
    5개 구조적 가드(라이브 버그 탐지기)가 동시에 조용히 약해지거나 깨질 수 있다. 각 노출
    함수의 시그니처(`(root: string) => string[]` 또는 동일 형태)는 유지돼 외부 호출자
    관점의 breaking change 는 없다. `collectTsFiles` 자신도 `source-scan.spec.ts` 에
    전용 스위트(빈 옵션/`includeSpec`/`.d.ts`/vendor skip/비-`.ts`/정렬 분기 개별 단언)를
    갖춰 회귀 방어가 있다.
  - 제안: 조치 불필요 — 의도된 DRY 리팩터이고 전용 테스트로 하드닝돼 있다. 이후
    `collectTsFiles` 를 고치는 PR 은 5개 소비처를 함께 인지해야 한다.

- **[INFO]** 3개 가드의 파일 수집 **필터링 동작**이 조용히 넓어짐(더 거르는 방향) —
  노출 시그니처는 그대로지만 반환값 자체는 이론상 달라질 수 있음
  - 위치: `masked-reject-callers-guard.ts` 의 `listSourceFiles`(구현이 구 walker →
    `collectTsFiles(rootDir, { includeSpec: true })` 로 교체 — 구 walker 는 `.d.ts` 배제·
    `sort()` 없었음), `audit-action-binding-guard.ts` 의 `collectSourceFiles`(구 walker는
    `node_modules`/`dist` skip 없었음), `engine-error-code-anchor-guard.ts`(구
    `walkTsFiles` 완전 삭제 — `.d.ts` 배제·vendor skip·`sort()` 전부 없었음 →
    `collectTsFiles(root)` 로 대체)
  - 상세: 새 `collectTsFiles` 는 `.d.ts` 를 항상 제외하고 `node_modules`/`dist` 를 항상
    skip 하며 항상 `sort()` 한다. 세 가드 각각 이 축 중 하나 이상을 원래 갖고 있지 않았다.
    오늘은 관측 가능한 회귀가 없다 — `source-scan.ts` docstring("다섯 사본의 차이" 표)과
    plan 문서 양쪽에 리팩터 전후 5개 walker 의 파일 **집합**이 완전히 동일함
    (507/818/1261/818/818)을 실측 기록해 뒀고, 근거(`src` 하위 `.d.ts` 0개·vendor 디렉터리
    부재)도 코드 자신이 설명한다. `engine-error-code-anchor-guard.ts`·
    `redis-fail-open-catalog-guard.ts` 는 정렬도 새로 추가됐는데, `hits[0].file` 을 단언하는
    소비 spec 이 순서 변경에 영향받지 않음이 이전 라운드에서 직접 재현·확인돼 문서화돼
    있다. 다음에 `src/` 밑에 `.d.ts` 가 생기면 세 가드가 조용히 그 파일을 안 보게 된다는
    잠재적 동작 변화 자체는 사실이지만, 이는 이미 여러 라운드에 걸쳐 문서화·재확인된
    지점이다.
  - 제안: 조치 불필요 — 이미 인지·문서화됨.

- **[INFO]** `stripComments` 가 module-private → `export` 로 가시성 확대(순수 additive)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (`stripComments`
    선언부, `function stripComments` → `export function stripComments`)
  - 상세: 시그니처·동작 불변, 기존 소비처(`countCalls`)에 영향 없음. 새 소비처는
    `nullable-type-lie-cast-guard.ts` 의 `findStaleSpecCasts`
    (`stripLiterals(stripComments(...))`)뿐 — breaking 요소 없음.
  - 제안: 조치 불필요.

- **[INFO]** `masked-reject-callers.spec.ts` 신규 배선 단언 테스트(이번 라운드의 유일한
  실질 코드 델타)도 tmpdir 격리 패턴을 따른다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` —
    `describe('스캔 대상에 \`.spec.ts\` 가 포함된다', …)` 블록(`it('listSourceFiles 가
    .spec.ts 를 담는다', …)`)
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), 'masked-scope-'))` 로 격리 디렉터리를
    만들고 `try/finally` 로 `fs.rmSync(dir, { recursive: true, force: true })` 정리한다.
    저장소 실파일을 건드리지 않으며, `fs`/`os`/`path` 는 이 파일 상단에 이미 import 돼
    있어 추가 import 불필요.
  - 제안: 조치 불필요.

## 그 외 점검한 축 (이상 없음)

- **전역 변수**: 모듈 스코프 정규식 상수(`WIDENED_DECL`·`SPEC_CAST`·`COLUMN_DECL`·
  `COLUMN_NAME`)는 전부 `matchAll()`(호출마다 새 iterator, 원본 뮤테이션 없음) 또는
  1회성 `.exec()`(비-`g` `COLUMN_NAME`)로만 소비돼 `g`-플래그 `lastIndex` 공유 상태
  버그 클래스에 해당하지 않는다. `countCalls`/`countRawUpdateReturning`/
  `countNullAsUnknownAsCasts` 내부 정규식은 함수 스코프 지역 변수로 매 호출 새로 생성돼
  공유 상태가 없다. `SRC_ROOT`(module-scope 상수)는 뮤터블 전역이 아니다.
- **시그니처 변경**: `collectSourceFiles`/`listSourceFiles`/`listProductionSources`/
  `collectScanTargets` 4개 공개 함수 모두 파라미터·반환 타입(`string[]`)이 그대로다. 외부
  호출자에게 breaking change 없음 — grep 재확인 완료, 각자 형제 spec(또는 자기 파일 내부)
  외 소비처 없음.
- **인터페이스 변경**: `collectTsFiles`/`CollectTsFilesOptions`/`stripLiterals`/
  `widenedEntityFields`/`findStaleSpecCasts`/`isNullableType`(module-private)은 전부 신규
  export(additive) 또는 신규 함수 — 기존 export 제거·타입 변경 없음.
- **환경 변수 / 네트워크 호출 / 서브프로세스**: 8개 핵심 파일 전체에서 `process.env`·
  `fetch`·`http.request`·`axios`·`child_process` 매치 0건.
- **이벤트/콜백**: 이번 diff 범위(정적 파일 스캔·정규식 판정 순수 함수 + Jest describe/it)에
  이벤트 발행·콜백 배선 변경 없음.
- **엔티티/런타임 코드 무변경**: 이 diff 는 `codebase/backend/src/modules/**` 의 엔티티·
  서비스 코드를 전혀 건드리지 않는다. 핵심 변경 8개 파일은 전부 `common/__test-utils__`·
  `repo-guards/__tests__` 하위 build/CI 전용 정적 가드 인프라라 프로덕션 런타임 부작용
  표면이 없다.
- **`plan/in-progress/entity-nullable-column-type-mismatch.md`**: 서술 갱신뿐, 코드 변경
  없음 — side-effect 관점 결함 없음.
- **`review/code/2026/09/04/**` 산출물**: 이전 리뷰 라운드의 기록물이며 이 저장소 관례상
  정식 커밋 대상이다. 신규 로직이 아니라 markdown/JSON 리포트라 side-effect 관점에서
  별도 표면이 없다. `_retry_state.json` 등에 담긴 절대경로는 이 worktree 경로 자체이지
  비밀정보가 아니다.

## 요약

핵심 리팩터(5개 walker → `collectTsFiles` 단일화, `stripComments` export 확대,
`stripLiterals`/`widenedEntityFields`/`findStaleSpecCasts`/`isNullableType` 신설)와 이번
라운드의 유일한 실질 코드 델타(`masked-reject-callers.spec.ts` 의 `includeSpec` 배선 직접
단언 테스트 추가)는 모두 순수 함수·읽기 전용 파일시스템 스캔 범위 안에 있고, 프로덕션
런타임 코드를 전혀 건드리지 않는 build/CI 전용 정적 가드다. 노출 시그니처는 전부 유지돼
외부 호출자에 영향이 없고, 파일시스템 **쓰기**는 두 spec 파일(`source-scan.spec.ts`,
`nullable-type-lie-cast.spec.ts`) 및 이번 라운드에 추가된 `masked-reject-callers.spec.ts`
블록 모두 `os.tmpdir()` 로 격리되어 저장소 실파일을 건드리지 않음을 직접 재확인했다. 전역
mutable 상태·환경 변수·네트워크 호출·서브프로세스·이벤트 배선 변경은 관측되지 않았다.
유일하게 주목할 부작용 성격의 변화 — (1) 공유 함수 도입으로 5개 가드의 결함 표면이 한
곳으로 합쳐진 것, (2) 그 과정에서 3개 가드의 내부 필터링(정렬·`.d.ts`·vendor 제외)이
조용히 넓어진 것 — 은 둘 다 개발자가 plan 문서·docstring 에 실측(파일 집합 완전 동일·필터
축의 사문 여부)과 함께 명시적으로 남겼고, 여러 라운드에 걸쳐 재확인됐다. 저장소 트리에는
아무것도 쓰지 않고 검증했다(`git status --short` 로 확인). 추가 조치가 필요한
CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
