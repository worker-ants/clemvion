# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `collectTsFiles` 공유화로 5개 walker 사본의 동작이 바뀌었으나(정렬 추가, `.d.ts`/`node_modules`·`dist` 필터 항상 켜짐), 노출 시그니처는 전부 유지됨
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:249` (`collectTsFiles` 정의), 소비부는 `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:48`, `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:157`, `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:51`, `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:39`, `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts:94`
  - 상세: `collectSourceFiles`/`listSourceFiles`/`listProductionSources`/`collectScanTargets` 네 함수 모두 파라미터·반환 타입(`string[]`)이 그대로라 **외부 호출자 관점의 인터페이스는 안 바뀜**(grep 으로 확인 — 각 함수의 유일한 외부 소비처는 자신의 자매 `*.spec.ts` 뿐). 내부 구현이 raw `fs.readdirSync` walk 에서 공유 `collectTsFiles` 호출로 바뀌면서: (a) 반환 순서가 항상 정렬됨(`masked-reject-callers-guard`·`redis-fail-open-catalog-guard` 의 원본은 미정렬 DFS 순서였음), (b) `.d.ts`·`node_modules`/`dist` 스킵이 새로 적용됨(`audit-action-binding-guard`·`nullable-type-lie-cast-guard` 원본은 이 필터가 없었음). 이 두 축은 plan 문서(`plan/in-progress/entity-nullable-column-type-mismatch.md`)에 5개 walker 를 리팩터 전후로 캡처해 파일 집합이 전부 동일함(507/818/1261/818/818)을 실측 기록해 뒀고, 소스 코드 주석에도 같은 근거(`src` 하위엔 `.d.ts` 0개, vendor 디렉터리 부재)가 남아 있어 관측 가능한 회귀는 없음. 다만 순서 변경은 가드가 실패 메시지에서 "몇 번째로 보고하느냐" 를 바꿀 수 있어, 순서에 의존하는 스냅샷·회귀 테스트가 있다면 영향권.
  - 제안: 현 상태로 문제 없음(문서화·실측 완료). 후속으로 순서 의존 assertion 이 있는 스펙이 있는지만 확인해 두면 충분.

- **[INFO]** `stripComments` 가 `source-scan.ts` 내부 함수에서 `export` 로 바뀜(공개 표면 확장)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:53`
  - 상세: 함수 본문·시그니처는 변경 없이 가시성만 넓어졌고, 새 소비처는 `nullable-type-lie-cast-guard.ts:189`(`findStaleSpecCasts` 내부)뿐. 순수 함수이고 기존 소비처(`countCalls`)에 영향 없음 — 인터페이스 확장이지 파괴적 변경이 아님.
  - 제안: 조치 불필요.

- **[INFO]** `nullable-type-lie-cast.spec.ts` 의 `describe('저장소 전수', …)` 블록이 `it()` 밖(describe 본문)에서 `collectTsFiles(SRC_ROOT, …)` 전체 트리 스캔 + 대상 파일 전수 `fs.readFileSync` 를 수행
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` — `describe('저장소 전수', ...)` 블록 (변경된 코드 diff 기준 새로 추가된 하단부, `entities`/`specs` 상수 선언부)
  - 상세: 이 I/O 는 Jest 테스트 수집(파일 로드) 시점에 항상 실행되며, `it()` 콜백 안이 아니라 `describe` 콜백 본문에서 즉시 평가된다. 부작용 관점에서는 파일 쓰기·전역 상태 변경이 아니라 **읽기 전용**이라 CRITICAL 수준은 아니지만, "테스트 파일을 로드하는 것만으로 저장소 전체를 스캔한다" 는 특성은 다른 관점(performance/testing) 리뷰의 영역과 겹친다. 부작용 checklist 상 문제는 없음.
  - 제안: 조치 불필요(참고용 기록). 필요하면 performance/testing reviewer 교차 확인.

- **[INFO]** 픽스처 파일시스템 쓰기는 전부 `os.tmpdir()` 격리 + `try/finally` 정리로 저장소 트리를 건드리지 않음
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` `describe('collectTsFiles', …)` 의 `beforeEach`/`afterEach`(mkdtempSync/rmSync), `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 의 `withFiles` 헬퍼(신설, 모듈 스코프로 승격)
  - 상세: 두 파일 모두 `fs.mkdtempSync(path.join(os.tmpdir(), …))` 로 격리된 임시 디렉터리를 만들고 `finally`/`afterEach` 에서 `fs.rmSync(..., { recursive: true, force: true })` 로 정리한다. `nullable-type-lie-cast.spec.ts` 의 주석 자체가 과거 실제 `users.service.ts`/`user.entity.ts` 를 직접 `writeFileSync` 로 변형했다가 복원 실패 시 서비스 파일이 변조된 채 남는 사고가 있었음을 밝히고 있어, 이번 변경은 그 결함을 없애는 방향. 부작용 없음.
  - 제안: 조치 불필요 — 오히려 과거 결함(실파일 변형)의 재발 방지로 평가.

- **[INFO]** 새 파일 8개(`review/code/2026/09/04/01_48_39/**`, `review/code/2026/09/04/01_49_18/**`)가 diff 에 포함되어 있으나 이전 리뷰 세션의 산출물(재시도 상태·메타데이터·이전 라운드 리포트)이며 이번 코드 변경과 무관
  - 위치: 파일 10~22 (`review/code/2026/09/04/01_48_39/_retry_state.json`, `meta.json`, `review/code/2026/09/04/01_49_18/*.md`, `*.json` 등)
  - 상세: 프로젝트 규약(`CLAUDE.md`)상 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 는 코드 리뷰 산출물의 정식 저장 위치이고 이 산출물들은 gitignore 대상이 아니다. 파일시스템 부작용이 아니라 의도된 커밋 대상.
  - 제안: 조치 불필요.

## 요약

핵심 리팩터(5개 walker → `collectTsFiles` 단일화, `stripComments`/`stripLiterals` 공유 술어)는 순수 함수·읽기 전용 파일시스템 스캔 범위 안에 있고, 노출 시그니처(`collectSourceFiles`/`listSourceFiles`/`listProductionSources`/`collectScanTargets`)는 전부 그대로 유지되어 외부 호출자에 영향이 없다. 내부 순서·필터 변화는 plan 문서에 실측(507/818/1261/818/818 집합 동일)으로 뒷받침되어 있고, 테스트 픽스처의 파일시스템 쓰기는 전부 `os.tmpdir()` 로 격리돼 저장소 실파일을 건드리지 않는다(과거 사고의 재발 방지 방향). 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 변경은 관측되지 않았다. 발견된 항목은 전부 INFO 수준의 참고 기록이다.

## 위험도

LOW
