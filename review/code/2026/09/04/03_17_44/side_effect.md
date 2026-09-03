# 부작용(Side Effect) 리뷰 — 5R (repo-guard walker 통합 + 낡은 spec 캐스트 가드)

## 검증 방법

핵심 코드 변경 9개(파일 1~9)의 **현재 디스크 상태 전문**을 직접 `Read` 로 열어 확인했다 —
`source-scan.ts`/`.spec.ts`, `nullable-type-lie-cast-guard.ts`/`.spec.ts` 전문, 4개 walker
소비 가드(`audit-action-binding-guard.ts`·`engine-error-code-anchor-guard.ts`·
`masked-reject-callers-guard.ts`·`redis-fail-open-catalog-guard.ts`). 추가로:

- `collectSourceFiles`/`listSourceFiles`/`listProductionSources`/`collectScanTargets`/
  `walkTsFiles`/`stripComments`/`readdirSync` 를 `codebase/backend/src` 전체에 grep 해 외부
  소비처가 각자의 형제 `.spec.ts` 뿐임을 재확인(인터페이스 breaking change 없음 확증).
- `git log --oneline -15` 로 직전 커밋(`f6358ec0a`, 4R 절차 재적용)이 "주석·plan 문자열만
  변경, 판정 로직 불변"이라 자평한 것을 확인하고, `"20건"`/`"12건"`/`"48건"` 잔존을 grep 해
  전부 과거형 서술(이력 기록)이지 살아있는 주장이 아님을 직접 대조.
- 저장소 트리에는 아무것도 쓰지 않았다(읽기 전용 `Read`/`grep`/`git log` 만 수행).
  `git status --short` 로 확인 — 이 리뷰 세션 산출물 디렉터리 외 변경 없음.

파일 10 이후(`review/code/2026/09/04/{01_48_39,01_49_18,02_12_38,02_35_22,02_57_22}/**`)는
이전 리뷰 라운드 산출물이며, 이 저장소 관례상 `review/code/**` 는 정식 커밋 대상이다
(`CLAUDE.md`). 신규 로직이 아니라 리뷰 이력 기록물이라 side-effect 관점에서 별도로 다루지
않는다(스코프/문서화 리뷰어가 이미 반복 확인, 4라운드 연속 이견 없음).

## 발견사항

- **[INFO]** 5개 walker 사본이 `collectTsFiles` 하나로 수렴 — 결함 표면(blast radius)이
  한 곳으로 합쳐짐. 실측으로 무해함이 확인돼 있다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:249`(`collectTsFiles`
    정의) — 소비처는 `audit-action-binding-guard.ts:47-48`(`collectSourceFiles`),
    `engine-error-code-anchor-guard.ts:157`(직접 호출),
    `masked-reject-callers-guard.ts:48-51`(`listSourceFiles`),
    `redis-fail-open-catalog-guard.ts:93-94`(`listProductionSources`),
    `nullable-type-lie-cast-guard.ts:38-39`(`collectScanTargets`)
  - 상세: 종전엔 5개 가드가 각자 독립된 `readdirSync` 재귀 walker 사본을 가져 결함이
    국소적이었다. 지금은 전부 `collectTsFiles` 하나에 위임하므로, 그 함수 하나에 결함이
    생기면 5개 구조적 가드가 동시에 조용히 약해지거나 깨질 수 있다. 다만 각 노출 함수의
    시그니처(`(root: string) => string[]`)는 그대로라 외부 호출자(자매 `.spec.ts`) 관점의
    breaking change 는 없다(grep 재확인 — 이 4개 함수명의 유일한 소비처는 각자의 형제
    spec 뿐). `collectTsFiles` 자신도 `source-scan.spec.ts` 에 `describe('collectTsFiles', …)`
    전용 스위트(빈 옵션/`includeSpec`/`.d.ts`/vendor skip/비-`.ts`/정렬 분기 각각 개별
    단언)를 갖춰 회귀 방어가 있다.
  - 제안: 조치 불필요 — 의도된 DRY 리팩터이고 전용 테스트로 하드닝돼 있다. 이후
    `collectTsFiles` 를 고치는 PR 은 5개 소비처를 함께 인지해야 한다는 점만 유의(신규
    소비처가 추가돼도 마찬가지).

- **[INFO]** 3개 가드의 파일 수집 **필터링 동작**이 조용히 넓어짐(더 거르는 방향) —
  반환 시그니처는 그대로지만 반환값 자체는 이론상 달라질 수 있음
  - 위치: `masked-reject-callers-guard.ts:48-51`(구 `listSourceFiles` — `.d.ts`/`sort()`
    없었음) → `collectTsFiles(rootDir, { includeSpec: true })`; `audit-action-binding-guard.ts:47-48`
    (구 `collectSourceFiles` — `node_modules`/`dist` skip 없었음); `engine-error-code-anchor-guard.ts`
    구 `walkTsFiles`(삭제됨, `.d.ts`·vendor skip·`sort()` 전부 없었음) → 게이트 157행
    `collectTsFiles(root)`
  - 상세: 새 `collectTsFiles` 는 `.d.ts` 를 항상 제외하고 `node_modules`/`dist` 를 항상
    skip 하며 항상 `sort()` 한다. 세 가드 각각 이 축 중 하나 이상을 원래 갖고 있지 않았다.
    오늘은 관측 가능한 회귀가 없다 — `source-scan.ts` docstring(게이트 231~248행, "다섯
    사본의 차이" 표)과 plan 문서 양쪽에 리팩터 전후 5개 walker 의 파일 **집합**이 완전히
    동일함(507/818/1261/818/818)을 실측 기록해 뒀고, 근거(`src` 하위 `.d.ts` 0개·vendor
    디렉터리 부재)도 코드 자신이 설명한다. 다만 **다음에 `src/` 밑에 `.d.ts` 가 생기면 세
    가드가 조용히 그 파일을 안 보게 된다**는 잠재적 동작 변화 자체는 사실이며, 이 사실은
    이미 4라운드 연속으로 문서화·재확인됐다.
  - 제안: 조치 불필요 — 이미 인지·문서화됨. 새로 발견된 지점 아님.

- **[INFO]** `stripComments` 가 module-private → `export` 로 가시성 확대(순수 additive)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:53`
  - 상세: 시그니처·동작 불변, 기존 소비처(`countCalls`, 게이트 90행)에 영향 없음. 새
    소비처는 `nullable-type-lie-cast-guard.ts` 의 `findStaleSpecCasts`(`stripLiterals(
    stripComments(...))`)뿐 — breaking 요소 없음.
  - 제안: 조치 불필요.

- **[INFO]** `describe('저장소 전수', …)`/`collectScanTargets()` 가 Jest **테스트 수집
  시점**(describe 콜백 본문, `it()`/`beforeAll` 밖)에 저장소 전체 재귀 스캔 + `.entity.ts`/
  `.spec.ts` 전수 read 를 수행
  - 위치: `nullable-type-lie-cast.spec.ts:81`(`const files = collectScanTargets();`),
    `:394-400`(`describe('저장소 전수', …)` 안의 `entities`/`specs` 상수 — `collectTsFiles`
    두 번 호출)
  - 상세: 파일 쓰기·전역 상태 변경이 아니라 읽기 전용이라 CRITICAL 급은 아니다. 다만 이
    스캔이 예외를 던지면(권한 오류 등) 개별 `it()` 실패가 아니라 **그 파일의 테스트 수집
    자체**가 실패해 모든 테스트가 한꺼번에 미보고 처리된다는 점은 참고할 값이 있다. 새로
    도입된 패턴이 아니라 이 파일 상단부터 있던 기존 관례를 그대로 반복한 것.
  - 제안: 조치 불필요(기존 관례와 일치, 읽기 전용, 4라운드 연속 동일 결론).

- **[INFO]** 테스트 픽스처의 파일시스템 쓰기는 전부 `os.tmpdir()` 격리 + `try/finally`/
  `afterEach` 정리로 확인됨(직접 재검증)
  - 위치: `source-scan.spec.ts:193-217`(`beforeEach`/`afterEach` — `mkdtempSync`/
    `writeFileSync`/`mkdirSync`/`rmSync`), `nullable-type-lie-cast.spec.ts:55-71`
    (`withFiles` — `mkdtempSync`→`writeFileSync`→`try/finally` `rmSync`)
  - 상세: 8개 대상 파일 전체에서 `writeFileSync`/`rmSync`/`mkdirSync`/`mkdtempSync` 실사용은
    이 두 지점뿐이고 전부 `os.tmpdir()` 하위 경로에서만 발생하며 확실히 정리된다.
    `nullable-type-lie-cast.spec.ts` 자신의 주석(게이트 46~49행)이 과거 실제
    `users.service.ts`/`user.entity.ts` 를 직접 변형했다가 복원 실패로 서비스 파일이 변조된
    채 남았던 사고를 밝히고 있어, 이번 구조는 그 결함의 재발 방지 방향이다.
  - 제안: 조치 불필요.

## 그 외 점검한 축 (이상 없음)

- **전역 변수**: 모듈 스코프 정규식 상수(`WIDENED_DECL`·`SPEC_CAST`·`COLUMN_DECL`·
  `COLUMN_NAME`)는 전부 `matchAll()`(호출마다 내부적으로 새 iterator/lastIndex 상태를 만듦,
  원본 객체를 뮤테이션하지 않음) 또는(비-`g` `COLUMN_NAME`) 1회성 `.exec()` 로만 소비돼
  `g`-플래그 정규식의 `lastIndex` 공유 상태 버그 클래스에 해당하지 않는다. `countCalls`/
  `countRawUpdateReturning`/`countNullAsUnknownAsCasts` 내부 정규식(`CALL`·`pattern`)은
  함수 스코프 지역 변수로 호출마다 새로 생성돼 공유 상태가 아예 없다. `SRC_ROOT`
  (`path.resolve(__dirname, ...)`)는 module-scope 상수이지 뮤터블 전역이 아니다.
- **시그니처 변경**: `collectSourceFiles`/`listSourceFiles`/`listProductionSources`/
  `collectScanTargets` 4개 공개 함수 모두 파라미터·반환 타입(`string[]`)이 그대로다. 외부
  호출자(각자의 형제 `.spec.ts`)에게 breaking change 없음 — grep 전수 재확인.
- **인터페이스 변경**: `collectTsFiles`/`CollectTsFilesOptions`/`stripLiterals`/
  `widenedEntityFields`/`findStaleSpecCasts`/`isNullableType`(module-private) 는 전부 신규
  export(additive) 또는 신규 함수 — 기존 export 제거·타입 변경 없음.
- **환경 변수 / 네트워크 호출**: 8개 대상 파일 전체에서 `process.env`·`fetch`·`http.request`·
  `axios` 매치 0건. `require(...)` 언급 2건(`masked-reject-callers-guard.ts`)은 가드가 탐지
  대상으로 삼는 코드 패턴을 설명하는 문자열 리터럴일 뿐 실행 코드가 아니다.
- **이벤트/콜백**: 이번 diff 범위(정적 파일 스캔·정규식 판정 순수 함수 + Jest describe/it)에
  이벤트 발행·콜백 배선 변경 없음.
- **엔티티/런타임 코드 무변경**: 이번 diff 는 `codebase/backend/src/modules/**` 의 엔티티·
  서비스 코드를 전혀 건드리지 않는다(파일 1~9 는 전부 `common/__test-utils__`·
  `repo-guards/__tests__`·`plan/` 하위). 즉 이 diff 자체는 프로덕션 런타임 부작용 표면이
  없다 — 전부 build/CI 타임 정적 가드.
- **문서-코드 일치**: 직전 커밋(`f6358ec0a`)이 "주석·plan 문자열만 변경, 판정 로직 불변"이라
  자평한 것을 코드 diff 관점에서 재확인 — `widenedEntityFields`/`findStaleSpecCasts`/
  `isNullableType`/`collectTsFiles` 의 실행 로직은 4R(`59a229943`) 이후 변경이 없다.
  `"20건"`/`"12건"`/`"48건"` 잔존 3건은 전부 과거형 서술("…였다", "…를 확인해 놓고")이지
  살아있는 수치 주장이 아니다 — 깨진 상호참조 없음.

## 요약

핵심 리팩터(5개 walker → `collectTsFiles` 단일화, `stripComments` export 확대,
`stripLiterals`/`widenedEntityFields`/`findStaleSpecCasts`/`isNullableType` 신설)는 순수
함수·읽기 전용 파일시스템 스캔 범위 안에 있고, 프로덕션 런타임 코드를 전혀 건드리지 않는
build/CI 전용 정적 가드다. 노출 시그니처는 전부 유지돼 외부 호출자에 영향이 없고, 파일시스템
**쓰기**는 두 spec 파일 모두 `os.tmpdir()` 로 격리되어 저장소 실파일을 건드리지 않음을
직접 재확인했다. 전역 mutable 상태·환경 변수·네트워크 호출·이벤트 배선 변경은 관측되지
않았다. 유일하게 주목할 부작용 성격의 변화 — (1) 공유 함수 도입으로 5개 가드의 결함 표면이
한 곳으로 합쳐진 것, (2) 그 과정에서 3개 가드의 내부 필터링(정렬·`.d.ts`·vendor 제외)이
조용히 넓어진 것 — 은 둘 다 개발자가 plan 문서·docstring 에 실측(파일 집합 완전 동일·필터
축의 사문 여부)과 함께 명시적으로 남겼고, 이번까지 5라운드 연속(1R~4R side_effect/security/
scope 리뷰 + 이번 라운드의 직접 코드 재열람·grep 재확인)에서 동일 결론이 재확인됐다. 직전
docs-only 커밋도 판정 로직을 바꾸지 않았음을 확인했다. 추가 조치가 필요한 CRITICAL/WARNING
급 부작용은 발견되지 않았다.

## 위험도

LOW
