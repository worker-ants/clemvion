# 부작용(Side Effect) 리뷰

대상: `source-scan.{ts,spec.ts}` 의 `collectTsFiles` 도입 및 5개 `repo-guards/__tests__/*-guard.ts` 의
파일 수집 로직 위임 리팩터, `nullable-type-lie-cast-guard.ts` 의 `widenedEntityFields`/`findStaleSpecCasts`
신설, 관련 plan 문서 갱신.

검증: 저장소 트리는 수정하지 않았다(읽기 전용 `find` 1회로 `.d.ts`/`node_modules`/`dist` 부재를
재확인). `git status --short` 로 뮤테이션 부재 확인 완료.

## 발견사항

- **[INFO]** 공유 재귀 스캐너로 위임하며 blast radius 가 넓어짐 (의도된 설계, 실측 검증됨)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:249`(`collectTsFiles` 정의) —
    소비처는 `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:48`,
    `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:157`,
    `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:51`,
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:39`,
    `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts:94`
  - 상세: 종전에 서로 독립적이던 5개 파일-수집 구현(`walkTsFiles`/`listSourceFiles`/
    `collectSourceFiles`/`listProductionSources`/`collectScanTargets`)이 전부 새 공유 함수
    `collectTsFiles` 하나로 위임한다. 이제 `collectTsFiles` 하나에 결함이 생기면 5개 구조적
    가드(감사 바인딩·엔진 에러코드 앵커·masked-reject 호출자·nullable 캐스트·redis fail-open
    카탈로그)가 **동시에** 조용히 약해지거나 깨질 수 있다 — 종전엔 가드마다 사본이 달라 결함이
    국소적이었다. `plan/in-progress/entity-nullable-column-type-mismatch.md:260-262` 가 리팩터
    전후 5개 walker 의 파일 집합이 완전히 동일함(507/818/1261/818/818)을 실측 대조했다고
    기록하고 있고, `source-scan.spec.ts` 에 `collectTsFiles` 전용 유닛 테스트가 별도로 추가돼
    있어 회귀 방어 자체는 갖춰져 있다.
  - 제안: 조치 불필요 — 의도된 DRY 리팩터이고 검증도 갖춰져 있다. 다만 이후 `collectTsFiles`
    를 고치는 PR 은 5개 가드 소비처를 전부 인지하고 리뷰해야 한다는 점을 기록해 둔다.

- **[INFO]** `stripComments` 가시성 확대 — private → exported (순수 additive)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:53`
  - 상세: 모듈 내부에서만 쓰이던 `stripComments` 가 `export function stripComments` 로 바뀌어
    `common/__test-utils__/source-scan.ts` 의 공개 표면이 넓어졌다. 신규 `stripLiterals`(같은
    파일 `:83`)와 함께 `nullable-type-lie-cast-guard.ts` 의 `findStaleSpecCasts` 가 가져다
    쓴다(`codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:13-18`
    import). 기존 시그니처·동작은 그대로라 기존 호출자에 영향은 없다.
  - 제안: 조치 불필요.

- **[INFO]** `.d.ts`/`node_modules`·`dist` 필터링 동작이 두 가드에서 조용히 바뀜 — 오늘은 무해,
  실측으로 재확인함
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:48-51`
    (`listSourceFiles`), `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:157`
    (구 `walkTsFiles` 제거 지점)
  - 상세: 구 `masked-reject-callers-guard.ts` 의 `listSourceFiles` 는 `node_modules`/`dist` 만
    걸렀을 뿐 `.d.ts` 는 걸러지지 않았다(`.ts` 로 끝나면 전부 포함). 구 `engine-error-code-anchor-guard.ts`
    의 `walkTsFiles` 는 `.spec.ts` 만 걸렀고 `.d.ts` 도, `node_modules`/`dist` skip 도 없었다.
    새 `collectTsFiles` 는 `.d.ts` 를 **항상** 제외한다. 리뷰 중 직접
    `find codebase/backend/src -name '*.d.ts' | wc -l` 와
    `find codebase/backend/src -type d \( -name node_modules -o -name dist \)` 를 돌려
    둘 다 **0** 임을 재확인했으므로 오늘 시점 동작 차이는 없다. 다만 이는 **잠재적** 동작
    변경이다 — 나중에 스캔 루트 하위에 `.d.ts` 파일이 생기면 이 가드들이 그 파일을 더는
    보지 않게 된다(조용히).
  - 제안: 이미 인지·문서화돼 있다 — `source-scan.ts:242-245` 가 "`.d.ts` 제외와 vendor skip 은
    지금은 아무것도 안 거르지만 켜 둔다 … 나중에 `.d.ts` 가 생기면 끄고 있는 쪽이 조용히
    틀린다" 고 명시적으로 밝히고, `plan/in-progress/entity-nullable-column-type-mismatch.md:249-254`
    표에도 같은 근거가 실측과 함께 남아 있다. 추가 조치 불필요.

- **[INFO]** 저장소 전수 스캔이 훅이 아니라 `describe` 본문에서 즉시 실행 (기존 관례와 일치, 읽기 전용)
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:298-304`
  - 상세: `저장소 전수` describe 블록이 `beforeAll`/`it` 안이 아니라 describe 콜백 본문에서 즉시
    `collectTsFiles(SRC_ROOT)` 와 `collectTsFiles(SRC_ROOT, { includeSpec: true })` 를 호출해
    `codebase/backend/src` 전체를 두 번 재귀 스캔한다(파일시스템 읽기, 쓰기 아님). 같은 파일
    상단의 기존 `collectScanTargets()` 호출(`:44`)도 같은 패턴이라 이 저장소의 기존 관례를
    그대로 따른 것이다. 읽기 전용이라 상태 변경 부작용은 없지만, 스캔 중 예외가 나면 개별
    테스트 실패가 아니라 파일 전체 수집(모든 `it`)이 실패한다는 점만 참고.
  - 제안: 기존 관례와 일치하고 읽기 전용이라 조치 불필요.

## 그 외 점검한 축 (이상 없음)

- **파일시스템 부작용**: 신규 테스트 fixture 는 전부 `os.tmpdir()` 아래에서 `fs.mkdtempSync` 로
  생성되고 `afterEach`(`source-scan.spec.ts:210-212`) 또는 `try/finally`(`nullable-type-lie-cast.spec.ts:199-204`)
  로 정리된다. 저장소 트리를 건드리는 fixture 는 없다.
- **전역 변수**: 새 module-level 상수(`WIDENED_DECL`, `SPEC_CAST` 등)는 전부 `RegExp` 리터럴이고
  `matchAll()` 로만 소비된다 — `matchAll` 은 내부적으로 정규식을 복제해 호출하므로 `g` 플래그
  정규식을 `.test()`/`.exec()` 로 반복 호출할 때 생기는 `lastIndex` 공유 상태 버그 클래스에
  해당하지 않는다.
- **환경 변수 / 네트워크 호출 / 이벤트·콜백**: 이번 diff 범위에서 전부 해당 없음 — 순수 정적
  파일 스캔·정규식/AST 판정 로직이다.
- **인터페이스 변경**: 5개 가드의 공개 함수(`collectSourceFiles`/`listSourceFiles`/
  `listProductionSources`/`collectScanTargets`)는 시그니처(파라미터·반환 타입)를 그대로
  유지한 채 내부 구현만 위임으로 바뀌었다 — 외부 호출자(형제 `.spec.ts`) 관점에서는 시그니처
  breaking change 가 아니다.

## 요약

이번 diff 는 5개 구조적 가드의 중복 파일-워커를 `common/__test-utils__/source-scan.ts` 의
`collectTsFiles` 하나로 통합하고, nullable 넓힘 축의 낡은 spec 캐스트를 잡는 새 술어
(`widenedEntityFields`/`findStaleSpecCasts`)를 추가한 test-utility 성격의 리팩터다. 실제 상태
변경·전역 변수·환경 변수·네트워크 호출·이벤트 배선은 관찰되지 않았고, 새 테스트 fixture 는 전부
`os.tmpdir()` 안에서 생성·정리돼 저장소 트리에 영향을 주지 않는다. 유일하게 주목할 부작용 성격의
변화는 (1) 5개 가드의 파일 수집 결함 표면이 하나의 공유 함수로 합쳐져 향후 그 함수 하나의 결함이
다섯 곳에 동시에 파급될 수 있다는 점과 (2) `.d.ts`/vendor 디렉터리 필터링 동작이 두 가드에서
조용히 바뀐 점인데, 둘 다 개발자가 plan 문서와 docstring 에 실측(파일 집합 완전 동일·`.d.ts` 0개)
과 함께 명시적으로 인지·기록해 뒀고 리뷰 중 직접 재확인했다. 추가 조치가 필요한 CRITICAL/WARNING
급 부작용은 발견되지 않았다.

## 위험도

LOW
