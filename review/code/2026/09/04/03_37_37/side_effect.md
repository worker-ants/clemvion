# 부작용(Side Effect) 리뷰 — repo-guard walker 통합 + 낡은 spec 캐스트 가드

## 검증 방법

핵심 코드 변경 대상 8개 파일(`source-scan.ts`/`.spec.ts`, 4개 walker 소비 가드
`audit-action-binding-guard.ts`·`engine-error-code-anchor-guard.ts`·
`masked-reject-callers-guard.ts`·`redis-fail-open-catalog-guard.ts`,
`nullable-type-lie-cast-guard.ts`/`.spec.ts`)의 **현재 디스크 상태 전문**을 직접 `Read` 로
열어 확인했다(프롬프트에 diff 가 생략된 파일 1·6·7 포함). 추가로:

- `process.env`/`fetch(`/`axios`/`http.request`/`child_process`/`execSync`/`spawn(`/
  `writeFileSync`/`appendFileSync`/`unlinkSync`/`rmSync`/`mkdirSync`/`mkdtempSync` 를 8개
  파일 전체에 grep — 파일시스템 쓰기는 `source-scan.spec.ts`(`mkdtempSync`/`mkdirSync`/
  `writeFileSync`/`rmSync`, 게이트 194~216)와 `nullable-type-lie-cast.spec.ts`(`withFiles`,
  게이트 59~69)뿐이고 전부 `os.tmpdir()` 하위, `env`/네트워크/서브프로세스 매치 0건.
- `collectSourceFiles`/`listSourceFiles`/`listProductionSources`/`collectScanTargets`/
  `walkTsFiles` 5개 함수명을 `codebase/backend/src` 전체에 grep — 각자 형제 `.spec.ts`(또는
  자기 파일 내부) 외 소비처 없음을 재확인. `walkTsFiles` 는 주석 언급 1건 외 참조 0(완전
  제거, dangling caller 없음).
- `git log`/`git show 93cd244af`(HEAD, 5R 커밋)로 직전 커밋이 plan 문서만 고쳤고 판정 로직은
  4R(`59a229943`) 이후 불변임을 확인.
- 저장소 트리에는 아무것도 쓰지 않았다(읽기 전용 `Read`/`grep`/`git log`/`git show` 만 수행).
  `git status --short` 로 확인 — 이 리뷰 세션 산출물 디렉터리 외 변경 없음.

## 발견사항

- **[INFO]** 5개 walker 사본이 `collectTsFiles` 하나로 수렴 — 결함 표면(blast radius)이
  한 곳으로 합쳐짐
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:249`(`collectTsFiles`
    정의) — 소비처는 `audit-action-binding-guard.ts:48`(`collectSourceFiles`),
    `engine-error-code-anchor-guard.ts:157`(직접 호출),
    `masked-reject-callers-guard.ts:51`(`listSourceFiles`),
    `redis-fail-open-catalog-guard.ts:94`(`listProductionSources`),
    `nullable-type-lie-cast-guard.ts:39`(`collectScanTargets`)
  - 상세: 종전엔 5개 가드가 각자 독립된 `readdirSync` 재귀 walker 사본을 가져 결함이
    국소적이었다. 지금은 전부 `collectTsFiles` 하나에 위임하므로, 그 함수 하나에 결함이
    생기면 5개 구조적 가드(라이브 버그 탐지기)가 동시에 조용히 약해지거나 깨질 수 있다.
    다만 각 노출 함수의 시그니처(`(root: string) => string[]`)는 그대로라 외부 호출자
    관점의 breaking change 는 없다(grep 재확인 완료). `collectTsFiles` 자신도
    `source-scan.spec.ts:190-282` 에 전용 스위트(빈 옵션/`includeSpec`/`.d.ts`/vendor
    skip/비-`.ts`/정렬 분기 각각 개별 단언)를 갖춰 회귀 방어가 있다.
  - 제안: 조치 불필요 — 의도된 DRY 리팩터이고 전용 테스트로 하드닝돼 있다. 이후
    `collectTsFiles` 를 고치는 PR 은 5개 소비처(신규 소비처 포함)를 함께 인지해야 한다.

- **[INFO]** 3개 가드의 파일 수집 **필터링 동작**이 조용히 넓어짐(더 거르는 방향) —
  노출 시그니처는 그대로지만 반환값 자체는 이론상 달라질 수 있음
  - 위치: `masked-reject-callers-guard.ts:48-51`(구 `listSourceFiles` — `.d.ts` 배제·
    `sort()` 없었음) → `collectTsFiles(rootDir, { includeSpec: true })`;
    `audit-action-binding-guard.ts:47-48`(구 `collectSourceFiles` — `node_modules`/`dist`
    skip 없었음); `engine-error-code-anchor-guard.ts` 구 `walkTsFiles`(완전 삭제,
    `.d.ts` 배제·vendor skip·`sort()` 전부 없었음) → 게이트 157행 `collectTsFiles(root)`
  - 상세: 새 `collectTsFiles` 는 `.d.ts` 를 항상 제외하고 `node_modules`/`dist` 를 항상
    skip 하며 항상 `sort()` 한다. 세 가드 각각 이 축 중 하나 이상을 원래 갖고 있지 않았다.
    오늘은 관측 가능한 회귀가 없다 — `source-scan.ts` docstring(게이트 231~248, "다섯 사본의
    차이" 표)과 plan 문서 양쪽에 리팩터 전후 5개 walker 의 파일 **집합**이 완전히 동일함
    (507/818/1261/818/818)을 실측 기록해 뒀고, 근거(`src` 하위 `.d.ts` 0개·vendor 디렉터리
    부재)도 코드 자신이 설명한다. `engine-error-code-anchor-guard.ts`·
    `redis-fail-open-catalog-guard.ts` 는 정렬도 새로 추가됐는데, `hits[0].file` 을 단언하는
    소비 spec 이 순서 변경에 영향받지 않는지는 이전 라운드에서 직접 재현·확인됨(문서화됨).
    다만 **다음에 `src/` 밑에 `.d.ts` 가 생기면 세 가드가 조용히 그 파일을 안 보게 된다**는
    잠재적 동작 변화 자체는 사실이며 이미 여러 라운드에 걸쳐 문서화·재확인됐다.
  - 제안: 조치 불필요 — 이미 인지·문서화됨. 새로 발견된 지점 아님.

- **[INFO]** `stripComments` 가 module-private → `export` 로 가시성 확대(순수 additive)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:53`
  - 상세: 시그니처·동작 불변, 기존 소비처(`countCalls`, 게이트 90)에 영향 없음. 새 소비처는
    `nullable-type-lie-cast-guard.ts:237`(`findStaleSpecCasts` 안의
    `stripLiterals(stripComments(...))`)뿐 — breaking 요소 없음.
  - 제안: 조치 불필요.

- **[INFO]** `describe('저장소 전수', …)`/`collectScanTargets()` 가 Jest **테스트 수집
  시점**(describe 콜백 본문, `it()`/`beforeAll` 밖)에 저장소 전체 재귀 스캔 + `.entity.ts`/
  `.spec.ts` 전수 read 를 수행
  - 위치: `nullable-type-lie-cast.spec.ts:81`(`const files = collectScanTargets();`),
    `:396-400`(`describe('저장소 전수', …)` 안의 `entities`/`specs` 상수 —
    `collectTsFiles` 두 번 호출)
  - 상세: 파일 쓰기·전역 상태 변경이 아니라 읽기 전용이라 CRITICAL 급은 아니다. 다만 이
    스캔이 예외를 던지면(권한 오류 등) 개별 `it()` 실패가 아니라 **그 파일의 테스트 수집
    자체**가 실패해 모든 테스트가 한꺼번에 미보고 처리된다. 새로 도입된 패턴이 아니라 이
    파일 상단부터 있던 기존 관례(같은 파일 `collectScanTargets()` 도 module 최상단에서
    이미 이렇게 쓰임)를 반복한 것이다.
  - 제안: 조치 불필요(기존 관례와 일치, 읽기 전용).

- **[INFO]** 테스트 픽스처의 파일시스템 쓰기는 전부 `os.tmpdir()` 격리 + `try/finally`/
  `afterEach` 정리로 확인됨
  - 위치: `source-scan.spec.ts:193-217`(`beforeEach`/`afterEach` —
    `mkdtempSync`/`writeFileSync`/`mkdirSync`/`rmSync`), `nullable-type-lie-cast.spec.ts:55-71`
    (`withFiles` — `mkdtempSync`→`writeFileSync`→`try/finally` `rmSync`)
  - 상세: 8개 대상 파일 전체에서 `writeFileSync`/`rmSync`/`mkdirSync`/`mkdtempSync` 실사용은
    이 두 지점뿐이고 전부 `os.tmpdir()` 하위 경로에서만 발생하며 확실히 정리된다(`finally`/
    `afterEach`). `nullable-type-lie-cast.spec.ts:46-49` 자신의 주석이 과거 실제
    `users.service.ts`/`user.entity.ts` 를 직접 변형했다가 복원 실패로 서비스 파일이 변조된
    채 남았던 사고를 밝히고 있어, 이번 구조는 그 결함의 재발 방지 방향이다.
  - 제안: 조치 불필요.

## 그 외 점검한 축 (이상 없음)

- **전역 변수**: 모듈 스코프 정규식 상수(`WIDENED_DECL`·`SPEC_CAST`·`COLUMN_DECL`·
  `COLUMN_NAME`, `nullable-type-lie-cast-guard.ts:78,81,169,203`)는 전부 `matchAll()`(호출마다
  새 iterator, 원본 뮤테이션 없음) 또는 1회성 `.exec()`(비-`g` `COLUMN_NAME`)로만 소비돼
  `g`-플래그 `lastIndex` 공유 상태 버그 클래스에 해당하지 않는다. `countCalls`/
  `countRawUpdateReturning`/`countNullAsUnknownAsCasts` 내부 정규식은 함수 스코프 지역
  변수로 매 호출 새로 생성돼 공유 상태가 없다. `SRC_ROOT`(`path.resolve(__dirname, ...)`,
  게이트 21)는 module-scope 상수이지 뮤터블 전역이 아니다.
- **시그니처 변경**: `collectSourceFiles`/`listSourceFiles`/`listProductionSources`/
  `collectScanTargets` 4개 공개 함수 모두 파라미터·반환 타입(`string[]`)이 그대로다. 외부
  호출자에게 breaking change 없음 — 4개 함수명 전수 grep 재확인, 각자 형제 spec(또는 자기
  파일 내부) 외 소비처 없음.
- **인터페이스 변경**: `collectTsFiles`/`CollectTsFilesOptions`/`stripLiterals`/
  `widenedEntityFields`/`findStaleSpecCasts`/`isNullableType`(module-private)은 전부 신규
  export(additive) 또는 신규 함수 — 기존 export 제거·타입 변경 없음.
- **환경 변수 / 네트워크 호출**: 8개 대상 파일 전체에서 `process.env`·`fetch`·`http.request`·
  `axios` 매치 0건.
- **이벤트/콜백**: 이번 diff 범위(정적 파일 스캔·정규식 판정 순수 함수 + Jest describe/it)에
  이벤트 발행·콜백 배선 변경 없음.
- **엔티티/런타임 코드 무변경**: 이 diff 는 `codebase/backend/src/modules/**` 의 엔티티·
  서비스 코드를 전혀 건드리지 않는다(핵심 변경 8개 파일은 전부 `common/__test-utils__`·
  `repo-guards/__tests__` 하위 build/CI 전용 정적 가드 인프라). 프로덕션 런타임 부작용
  표면이 없다.
- **`plan/in-progress/entity-nullable-column-type-mismatch.md` (파일 9)**: 서술 갱신뿐,
  코드 변경 없음 — side-effect 관점 결함 없음.
- **`review/code/2026/09/04/**` 산출물(파일 10~70)**: 이전 리뷰 라운드의 기록물이며 이
  저장소 관례상 정식 커밋 대상이다(`CLAUDE.md`). 신규 로직이 아니라 markdown/JSON 리포트라
  side-effect 관점에서 별도 표면이 없다.

## 요약

핵심 리팩터(5개 walker → `collectTsFiles` 단일화, `stripComments` export 확대,
`stripLiterals`/`widenedEntityFields`/`findStaleSpecCasts`/`isNullableType` 신설)는 순수
함수·읽기 전용 파일시스템 스캔 범위 안에 있고, 프로덕션 런타임 코드를 전혀 건드리지 않는
build/CI 전용 정적 가드다. 노출 시그니처는 전부 유지돼 외부 호출자에 영향이 없고, 파일시스템
**쓰기**는 두 spec 파일 모두 `os.tmpdir()` 로 격리되어 저장소 실파일을 건드리지 않음을 직접
재확인했다. 전역 mutable 상태·환경 변수·네트워크 호출·서브프로세스·이벤트 배선 변경은
관측되지 않았다. 유일하게 주목할 부작용 성격의 변화 — (1) 공유 함수 도입으로 5개 가드의
결함 표면이 한 곳으로 합쳐진 것, (2) 그 과정에서 3개 가드의 내부 필터링(정렬·`.d.ts`·vendor
제외)이 조용히 넓어진 것 — 은 둘 다 개발자가 plan 문서·docstring 에 실측(파일 집합 완전
동일·필터 축의 사문 여부)과 함께 명시적으로 남겼고, `git show`로 직전 커밋이 판정 로직을
바꾸지 않고 plan 서술만 정정했음을 확인했다. 저장소 트리에는 아무것도 쓰지 않고 검증했다
(`git status --short` 로 확인). 추가 조치가 필요한 CRITICAL/WARNING 급 부작용은 발견되지
않았다.

## 위험도

LOW
