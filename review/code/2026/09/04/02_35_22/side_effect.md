# 부작용(Side Effect) 리뷰

대상: `source-scan.{ts,spec.ts}` 의 `collectTsFiles`/`stripLiterals` 도입, 5개
`repo-guards/__tests__/*-guard.ts` 의 파일 수집 위임, `nullable-type-lie-cast-guard.ts` 의
`widenedEntityFields`/`findStaleSpecCasts` 신설(+ 2R 리뷰 W1 에서 지적된 동명 필드 오탐을
비-null 이름 제외로 수정), 관련 plan 문서 갱신. 3라운드째 누적 diff에 대한 리뷰다.

검증: 저장소 트리는 수정하지 않았다. `git status --short` 로 확인, 뮤테이션 없음. 실제
소스(`source-scan.ts`, `masked-reject-callers-guard.ts`, `nullable-type-lie-cast.spec.ts`)를
`Read` 로 직접 열어 diff 만으로 판단하지 않고 최종 상태를 대조했다.

## 발견사항

이번 라운드(누적 diff 기준)에서 새로 발견된 CRITICAL/WARNING 급 부작용은 없다. 1R·2R 에서
이미 지적·확인된 INFO 성격의 항목이 최종 상태에서도 그대로 유효하고, 2R WARNING(W1, 동명
필드 전역 매칭 오탐)의 코드 수정이 부작용 관점에서도 안전하게 반영됐음을 재확인했다.

- **[INFO]** 공유 재귀 스캐너 위임으로 blast radius 확대 (의도된 설계, 실측 검증됨 — 재확인)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` `collectTsFiles` 정의부,
    소비처 5곳(`audit-action-binding-guard.ts:collectSourceFiles`,
    `engine-error-code-anchor-guard.ts:collectBoundCodes` 내부 호출,
    `masked-reject-callers-guard.ts:listSourceFiles`,
    `nullable-type-lie-cast-guard.ts:collectScanTargets`,
    `redis-fail-open-catalog-guard.ts:listProductionSources`)
  - 상세: 5개 구조적 가드가 하나의 공유 함수에 위임하므로, 향후 `collectTsFiles` 하나의 결함이
    5개 가드에 동시 파급될 수 있다. plan 문서에 리팩터 전후 파일 집합 동일성(507/818/1261/818/818)
    실측 기록 + `source-scan.spec.ts` 전용 유닛 테스트가 있어 회귀 방어는 갖춰져 있다.
  - 제안: 조치 불필요 — 이후 `collectTsFiles` 를 고치는 PR 은 5개 소비처 전부 리뷰 대상임을
    인지.

- **[INFO]** `.d.ts`/`node_modules`·`dist` 필터와 `sort()` 가 5개 소비처에 균일 적용되며,
  이전에는 이 축을 갖지 않았던 소비처 일부는 조용히 동작이 넓어졌다/좁아졌다
  - 위치: `masked-reject-callers-guard.ts:48-51`(`.d.ts` 배제가 새로 걸림 — 구 `listSourceFiles`
    는 `.d.ts` 도 포함했다), `engine-error-code-anchor-guard.ts` 구 `walkTsFiles` 제거 지점(정렬
    없음→있음, `.d.ts`/vendor 필터 없음→있음), `redis-fail-open-catalog-guard.ts:93-95`(정렬
    없음→있음)
  - 상세: `source-scan.ts` 의 "다섯 사본의 차이" 표(2026-09-04 실측)와 plan 문서가 이 변화를
    축별로 명시하고, `find codebase/backend/src -name '*.d.ts'` / `node_modules|dist` 디렉터리
    부재를 실측으로 재확인해 오늘 시점 관찰 가능한 차이는 없다. `engine-error-code-anchor.spec.ts`
    의 `hits[0]` 단언처럼 순서에 의존하는 케이스도 requirement 리뷰(1R)에서 직접 대조돼 있다.
  - 제안: 이미 문서화·검증된 의도적 결정. 추가 조치 불필요 — `src/` 하위에 `.d.ts` 가 생기는
    시나리오가 실제로 생기면 그때 재검토.

- **[INFO]** `stripComments` 가시성 확대 — private → exported (순수 additive)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (`export function
    stripComments`)
  - 상세: 기존 시그니처·동작 불변, `nullable-type-lie-cast-guard.ts` 의 `findStaleSpecCasts` 가
    새로 가져다 쓴다. 기존 호출자에 영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** `widenedEntityFields`/`findStaleSpecCasts` 는 순수 함수이며, 이번 라운드 수정(비-null
  이름 제외)도 지역 `Set` 조작에 그친다 — 전역 상태·모듈 스코프 가변 상태 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`
    (`widenedEntityFields` 본문의 `widened`/`nonNull` 지역 `Set`, `for (const f of nonNull)
    widened.delete(f);`)
  - 상세: 두 `Set` 모두 함수 호출마다 새로 생성되고 반환값으로만 노출된다. 모듈 레벨 `const`
    (`WIDENED_DECL`, `SPEC_CAST`)는 `RegExp` 리터럴이며 `matchAll()` 로만 소비돼(각 호출마다
    내부적으로 정규식을 복제) `lastIndex` 공유 상태 버그 클래스에 해당하지 않는다. 2R 에서
    지적된 동명 필드 오탐(W1) 수정이 이 함수 자체에 새로운 부작용 표면을 추가하지 않았음을
    확인.
  - 제안: 조치 불필요.

- **[INFO]** 신규/변경 테스트 fixture 는 전부 `os.tmpdir()` 격리 + 정리 — 저장소 실파일 불변
  (재확인)
  - 위치: `source-scan.spec.ts` 의 `beforeEach`/`afterEach`(`collectTsFiles` 픽스처),
    `nullable-type-lie-cast.spec.ts` 의 `withFiles`(신규 통합 헬퍼, W3 수정분) — `fs.mkdtempSync
    (path.join(os.tmpdir(), …))` 로 생성하고 `try/finally` 의 `fs.rmSync(dir, { recursive: true,
    force: true })` 로 정리
  - 상세: 1R WARNING W3("사본 5개를 없애는 diff 안에서 `withFiles` 라는 새 사본을 만들었다")를
    `withFixture` 를 `withFiles` 의 얇은 래퍼로 합치는 방식으로 해소했는데, 이 병합이 정리
    경로(`finally`)를 놓치거나 이중 실행하지 않는지 직접 코드를 열어 확인했다 — `withFixture`
    는 `withFiles({ 'probe.entity.ts': content }, …)` 를 그대로 위임할 뿐 자체 `mkdtempSync`/
    `rmSync` 를 갖지 않으므로 임시 디렉터리 정리는 여전히 단일 지점(`withFiles` 의 `finally`)
    에서만 일어난다 — 병합 과정에서 정리 로직이 중복되거나 빠지지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** "저장소 전수" 스캔이 `it`/`beforeAll` 이 아니라 `describe` 콜백 본문에서 즉시 실행
  (기존 관례와 일치, 읽기 전용 — 재확인)
  - 위치: `nullable-type-lie-cast.spec.ts:366-372`(`describe('저장소 전수', …)` 블록의
    `collectTsFiles(SRC_ROOT)` 두 번 호출 — `.entity.ts`/`.spec.ts` 각각)
  - 상세: 테스트 로드 시점에 `codebase/backend/src` 전체를 두 번 재귀 스캔 + 전수
    `readFileSync`(읽기 전용). 같은 파일 상단 `collectScanTargets()` 호출과 동일 패턴이라
    저장소 기존 관례를 따른 것이고, 상태 변경은 없다.
  - 제안: 조치 불필요.

- **[INFO]** `review/code/2026/09/04/{01_48_39,01_49_18,02_12_38}/**` 하위 이전 리뷰 세션
  산출물이 diff 에 포함 — 프로젝트 관례상 정상 커밋 대상(재확인)
  - 위치: 파일 10~33 (이전 라운드 `meta.json`/`RESOLUTION.md`/`SUMMARY.md`/`_retry_state.json`/
    각 reviewer `.md`)
  - 상세: `review/` 는 gitignore 대상이 아니며, 마무리 커밋에 plan 체크박스·리뷰 산출물을 함께
    담는 것이 이 저장소의 확립된 관례다. 새로운 파일시스템 부작용이 아니라 워크플로가 의도한
    산출물 축적이다.
  - 제안: 조치 불필요.

## 시그니처·인터페이스 변경 점검

- `collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`(4개 가드
  래퍼)의 **파라미터·반환 타입은 이번 diff 전후 동일**하다 — 내부 구현만 `collectTsFiles`
  위임으로 바뀌었다. 외부 호출자(형제 `.spec.ts`) 관점에서 breaking change 아님.
- `collectBoundCodes`(engine-error-code-anchor-guard.ts)는 내부에서 지역 함수 `walkTsFiles`
  대신 `collectTsFiles` 를 직접 호출하도록 바뀌었을 뿐 자신의 공개 시그니처는 불변.
- 신규 export(`collectTsFiles`, `CollectTsFilesOptions`, `stripLiterals`,
  `widenedEntityFields`, `findStaleSpecCasts`, `StaleSpecCast`)는 전부 이번 diff 로 처음
  추가된 것이라 기존 호출자에 대한 영향이 없다(순수 추가).
- 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트 발생/콜백 등록 — 이번 diff 범위 전체에서 해당
  없음(순수 정적 파일 스캔 + 정규식/AST 판정).

## 요약

이번 라운드까지 누적된 diff 는 5개 구조적 가드의 중복 파일-워커를 하나의 공유 함수로 통합하고,
넓혀진 nullable 필드를 겨눈 낡은 spec 캐스트를 잡는 새 술어를 추가한 test-utility 성격의
리팩터다. 실제 상태 변경·전역 변수·환경 변수·네트워크 호출·이벤트 배선은 관찰되지 않았고,
테스트 fixture 는 전부 `os.tmpdir()` 안에서 생성·정리돼 저장소 트리에 영향을 주지 않는다(2R
WARNING W3 로 지적된 fixture 헬퍼 중복을 병합한 뒤에도 정리 로직이 단일 지점에 남아 있음을
직접 확인). 2R WARNING(W1, 동명 필드 전역 매칭 오탐) 수정은 순수 함수 내부의 지역 `Set` 연산에
그쳐 새로운 부작용 표면을 만들지 않는다. 유일하게 주목할 부작용 성격의 변화는 (1) 5개 가드의
파일 수집 결함 표면이 하나의 공유 함수로 합쳐진 blast radius 확대와 (2) `.d.ts`/vendor
필터·정렬이 일부 소비처에 조용히 새로 적용된 점인데, 둘 다 1R·2R 에 걸쳐 개발자가 plan 문서와
docstring 에 축별 실측(파일 집합 완전 동일·`.d.ts` 0개·순서 의존 단언 무영향)과 함께 명시적으로
기록했고 이번 라운드에도 최종 코드를 직접 열어 재확인했다. 추가 조치가 필요한 CRITICAL/WARNING
급 부작용은 발견되지 않았다.

## 위험도

LOW
