# 부작용(Side Effect) 리뷰

## 검증 방법

핵심 코드 변경 9개(파일 1~9)의 **현재 디스크 상태 전문**을 `Read` 로 직접 열어 확인했다 —
프롬프트 diff 만이 아니라 `source-scan.ts`/`.spec.ts`, `nullable-type-lie-cast-guard.ts`,
`nullable-type-lie-cast.spec.ts` 전문을 읽고 `writeFileSync`/`rmSync`/`mkdirSync`/
`mkdtempSync`/`process.env`/`fetch`/`http.request`/`axios`/`require(` 를 8개 대상 파일 전체에
`grep` 했다. 저장소 트리에는 아무것도 쓰지 않았다(읽기 전용 `Read`/`grep`만 수행).

파일 10 이후(`review/code/2026/09/04/{01_48_39,01_49_18,02_12_38,02_35_22}/**`)는 이전 리뷰
라운드 산출물이며, 이 저장소 관례상 `review/code/**` 는 정식 커밋 대상이다(CLAUDE.md). 신규
로직이 아니라 리뷰 이력 기록물이라 side-effect 관점에서 별도로 다루지 않는다(스코프/문서화
리뷰어가 이미 반복 확인).

## 발견사항

- **[INFO]** 5개 walker 사본이 공유 함수로 수렴 — blast radius 확대, 실측으로 무해함이 확인됨
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` `collectTsFiles` 정의부
    (게이트 249행 `export function collectTsFiles`) — 소비처는
    `audit-action-binding-guard.ts`(`collectSourceFiles`, 게이트 48행),
    `engine-error-code-anchor-guard.ts`(게이트 157행 `collectTsFiles(root)` 호출),
    `masked-reject-callers-guard.ts`(`listSourceFiles`, 게이트 51행),
    `redis-fail-open-catalog-guard.ts`(`listProductionSources`, 게이트 94행),
    `nullable-type-lie-cast-guard.ts`(`collectScanTargets`, 게이트 39행)
  - 상세: 종전엔 5개 가드가 각자 독립된 `readdirSync` 재귀 walker 사본을 가져 결함이 국소적
    이었다. 지금은 전부 `collectTsFiles` 하나로 위임하므로, 그 함수 하나에 결함이 생기면
    5개 구조적 가드(감사 바인딩·엔진 에러코드 앵커·masked-reject 호출자·nullable 캐스트·
    redis fail-open 카탈로그)가 **동시에** 조용히 약해지거나 깨질 수 있다. 다만 각 노출 함수의
    시그니처(`(root: string) => string[]`)는 그대로라 외부 호출자(자매 `.spec.ts`) 관점의
    인터페이스 breaking change 는 없고, `collectTsFiles` 자신도 `source-scan.spec.ts` 에
    `describe('collectTsFiles', …)` 전용 스위트(빈 옵션/`includeSpec`/`.d.ts`/vendor skip/
    비-`.ts` 각각 개별 단언)를 갖춰 회귀 방어가 있다.
  - 제안: 조치 불필요 — 의도된 DRY 리팩터이고 전용 테스트로 하드닝돼 있다. 이후
    `collectTsFiles` 를 고치는 PR 은 5개 소비처를 함께 인지해야 한다는 점만 유의.

- **[INFO]** 3개 가드에서 파일 수집의 **필터링 동작**이 조용히 넓어짐(더 거르는 방향) — 시그니처는
  안 바뀌었지만 반환값 자체가 달라짐
  - 위치: `masked-reject-callers-guard.ts:48-51`(구 `listSourceFiles` — `.ts` 로 끝나면 전부
    포함, `.d.ts`/`sort()` 없었음) → `collectTsFiles(rootDir, { includeSpec: true })` 위임;
    `audit-action-binding-guard.ts:47-48`(구 `collectSourceFiles` — `node_modules`/`dist`
    skip 없었음) → `collectTsFiles(...)` 위임; `engine-error-code-anchor-guard.ts` 구
    `walkTsFiles`(삭제됨, `.d.ts`·`node_modules`/`dist`·`sort()` 전부 없었음) → 게이트 157행
    `collectTsFiles(root)`
  - 상세: 새 `collectTsFiles` 는 `.d.ts` 를 항상 제외하고 `node_modules`/`dist` 디렉터리를
    항상 skip 하며 항상 `sort()` 한다. 세 가드 각각 이 축 중 하나 이상을 원래 갖고 있지
    않았다. 반환값이 실제로 달라지는 잠재적 side effect이지만, `source-scan.ts` docstring
    (게이트 231~248행, "다섯 사본의 차이" 표)과 `plan/in-progress/entity-nullable-column-type-mismatch.md`
    양쪽에 리팩터 전후 5개 walker 의 파일 **집합**이 완전히 동일함(507/818/1261/818/818)을
    실측 기록해 뒀고, 근거(`src` 하위 `.d.ts` 0개·`node_modules`/`dist` 부재)도 코드 자신이
    설명한다. 즉 오늘은 관측 가능한 회귀가 없지만, **다음에 `src/` 밑에 `.d.ts` 가 생기면
    세 가드가 조용히 그 파일을 안 보게 된다**는 잠재적 동작 변화임은 사실이다.
  - 제안: 이미 인지·문서화돼 있어 추가 조치 불필요. 새로 발견된 지점은 아님(1R~3R side_effect
    /security/scope 리뷰가 이미 반복 확인) — 이번 라운드에서 직접 코드를 열어 세 가드
    각각의 정확한 원본 필터 축을 재확인한 결과 기존 판정과 일치한다.

- **[INFO]** `stripComments` 가 module-private → `export` 로 가시성 확대 (순수 additive)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:53`
    (`export function stripComments`)
  - 상세: 시그니처·동작은 그대로이고 기존 유일한 소비처(`countCalls`, 게이트 90행)에 영향
    없음. 새 소비처는 `nullable-type-lie-cast-guard.ts:235`(`findStaleSpecCasts` 내부,
    `stripLiterals(stripComments(...))`)뿐 — 순수 함수 재사용이라 breaking 요소 없음.
  - 제안: 조치 불필요.

- **[INFO]** `describe('저장소 전수', …)` 블록이 `it()`/`beforeAll` 밖(즉 Jest 테스트 **수집**
  시점)에서 저장소 전체 재귀 스캔을 수행 — 읽기 전용이나 기존 관례와 동일한 형태로 반복됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:394-400`
    (`entities`/`specs` 상수 선언 — `collectTsFiles(SRC_ROOT)` 와
    `collectTsFiles(SRC_ROOT, { includeSpec: true })` 를 describe 콜백 본문에서 즉시 호출).
    같은 파일 게이트 81행의 기존 `collectScanTargets()` 호출도 같은 패턴.
  - 상세: 파일 쓰기·전역 상태 변경이 아니라 순수 읽기이므로 CRITICAL 급 부작용은 아니다. 다만
    이 스캔이 예외를 던지면(예: 권한 오류) 개별 `it()` 실패가 아니라 **파일 전체의 테스트
    수집 자체가 실패**해 그 파일의 모든 테스트가 한꺼번에 보고되지 않는다는 점은 부작용
    checklist 상 참고할 값이 있다. 새로 도입된 패턴이 아니라 기존 관례(같은 파일 상단
    `collectScanTargets()`)를 그대로 따른 것.
  - 제안: 조치 불필요(기존 관례와 일치, 읽기 전용).

- **[INFO]** 테스트 픽스처의 파일시스템 쓰기는 전부 `os.tmpdir()` 격리 + 확실한 정리로 확인됨
  (직접 grep 재검증)
  - 위치: `source-scan.spec.ts:194-217`(`beforeEach`/`afterEach` — `mkdtempSync`/`writeFileSync`
    /`mkdirSync`/`rmSync`), `nullable-type-lie-cast.spec.ts:55-71`(신설 `withFiles` —
    `mkdtempSync`→`writeFileSync`→`try/finally` `rmSync`)
  - 상세: 8개 대상 파일 전체를 `writeFileSync|rmSync|mkdirSync|mkdtempSync` 로 grep 한 결과
    실제 호출은 이 두 지점뿐이고 전부 `os.tmpdir()` 하위 경로에서만 발생하며 `afterEach` 또는
    `try/finally` 로 확실히 정리된다. `nullable-type-lie-cast.spec.ts` 자신의 주석이 과거
    실제 `users.service.ts`/`user.entity.ts` 를 직접 변형했다가 복원 실패 시 서비스 파일이
    변조된 채 남는 사고가 있었음을 밝히고 있어(게이트 46~49행), 이번 구조는 그 결함의 재발
    방지 방향이다.
  - 제안: 조치 불필요.

## 그 외 점검한 축 (이상 없음)

- **전역 변수**: 모듈 스코프 정규식 상수(`WIDENED_DECL`·`SPEC_CAST`·`COLUMN_DECL`·
  `COLUMN_NAME`)는 전부 `matchAll()`(내부적으로 새 상태를 갖는 iterator 생성) 또는(비-`g`
  `COLUMN_NAME`) 1회성 `.exec()` 로만 소비돼 `g`-플래그 정규식의 `lastIndex` 공유 상태 버그
  클래스에 해당하지 않는다. `countCalls`/`countRawUpdateReturning`/
  `countNullAsUnknownAsCasts` 내부의 정규식(`CALL`·`pattern`)은 함수 스코프 지역 변수로,
  호출마다 새로 생성돼 공유 상태가 아예 없다.
- **시그니처 변경**: `collectSourceFiles`/`listSourceFiles`/`listProductionSources`/
  `collectScanTargets` 4개 공개 함수 모두 파라미터·반환 타입(`string[]`)이 그대로다. 외부
  호출자(각자의 형제 `.spec.ts`)에게 breaking change 없음.
- **인터페이스 변경**: `collectTsFiles`/`CollectTsFilesOptions`/`stripLiterals`/
  `widenedEntityFields`/`findStaleSpecCasts` 는 전부 신규 export(additive) — 기존 export 제거·
  타입 변경 없음.
- **환경 변수 / 네트워크 호출**: 8개 대상 파일 전체에서 `process.env`·`fetch`·`http.request`·
  `axios` 매치 0건. 파일 내 `require(...)` 언급 2건(`masked-reject-callers-guard.ts:78,81`)은
  가드가 **탐지 대상으로 삼는 코드 패턴**을 설명하는 표 안의 문자열일 뿐 실제 실행 코드가
  아니다.
- **이벤트/콜백**: 이번 diff 범위(정적 파일 스캔·정규식/AST 판정 순수 함수 + Jest
  describe/it)에 이벤트 발행·콜백 배선 변경 없음.

## 요약

핵심 리팩터(5개 walker → `collectTsFiles` 단일화, `stripComments` export 확대, `stripLiterals`/
`widenedEntityFields`/`findStaleSpecCasts` 신설)는 순수 함수·읽기 전용 파일시스템 스캔 범위
안에 있다. 노출 시그니처는 전부 유지돼 외부 호출자에 영향이 없고, 파일시스템 **쓰기**는 두
spec 파일 모두 `os.tmpdir()` 로 격리되어 저장소 실파일을 건드리지 않음을 8개 파일 전수 grep
으로 직접 재확인했다. 전역 mutable 상태·환경 변수·네트워크 호출·이벤트 배선 변경은 관측되지
않았다. 유일하게 주목할 부작용 성격의 변화는 (1) 공유 함수 도입으로 5개 가드의 결함 표면이
한 곳으로 합쳐진 것과 (2) 그 통합 과정에서 3개 가드의 내부 필터링 동작(정렬·`.d.ts`·vendor
제외)이 조용히 넓어진 것인데, 둘 다 개발자가 plan 문서·docstring 에 실측(파일 집합 완전
동일·필터 축의 사문 여부)과 함께 명시적으로 남겼고, 4라운드에 걸친 이전 side_effect/security/
scope 리뷰가 반복 검증한 내용을 이번 라운드에서 코드를 직접 열어 재확인했다. 추가 조치가
필요한 CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
