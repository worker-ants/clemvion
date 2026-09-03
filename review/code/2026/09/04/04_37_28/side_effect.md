# 부작용(Side Effect) 리뷰

## 스코프 확인

`origin/main..HEAD` diff 는 107개 파일이지만, 실제 코드/문서 변경은 아래 10개뿐이고
나머지 96개는 `review/code/2026/09/04/{01_48_39..04_18_01}/**` 하위의 **과거 리뷰 라운드
산출물**(RESOLUTION.md·SUMMARY.md·meta.json·`_retry_state.json`·각 관점 리포트)이다. 이
경로는 저장소 관례상 정식 산출물 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)이고
내용은 읽기 전용 markdown/JSON 텍스트라 부작용 관점에서 검토 대상이 아니다.

실질 코드 변경:
- `codebase/backend/src/common/__test-utils__/source-scan.{ts,spec.ts}` (신규 공유 유틸)
- `codebase/backend/src/repo-guards/__tests__/{audit-action-binding-guard,engine-error-code-anchor-guard,masked-reject-callers-guard,redis-fail-open-catalog-guard,nullable-type-lie-cast-guard}.ts`
- `codebase/backend/src/repo-guards/__tests__/{masked-reject-callers,nullable-type-lie-cast}.spec.ts`
- `plan/in-progress/entity-nullable-column-type-mismatch.md`

**프로덕션 런타임 코드(엔티티 등)는 이번 diff 에 없다** — 8필드 nullable 타입 확장(배치3,
`255aa8597`)은 이미 `origin/main` 에 병합돼 있고, 이번 changeset 은 그 상태를 검증하는
**테스트 전용 repo-guard 인프라 리팩터링**이다.

## 이전 라운드 side_effect 리뷰와의 관계

`review/code/2026/09/04/04_18_01/side_effect.md` (직전 라운드)가 이미 이 리팩터링을
정밀 검토했고 INFO 3건(① `stripComments` export 승격 — 순수 additive, ② walker 통합으로
2개 가드의 파일 나열 **순서**가 DFS→정렬로 바뀜 — 원래 미정렬이던 쪽만 영향, spec 에
순서 의존 단언 없음 확인, ③ `masked-reject-callers-guard` 스캔에 `.d.ts` 필터가 새로
걸림 — 실측 0건이라 현재 무영향)만 남기고 위험도 **LOW** 로 판정했다. 그 이후 코드
변경은 커밋 `4d7888625` (`fix(guard): 리뷰 8R`) 단 하나이며, 아래에서 별도로 검토한다.
그 밖에는 위 INFO 3건의 근거(정렬·`.d.ts` 필터·export 승격)가 그대로 유효하므로 재론하지
않는다.

## 8R 커밋(`4d7888625`) 검토 — `findUntypedNullableColumns` 판정 축 교체

- **[INFO]** `findUntypedNullableColumns` 의 nullable 판정이 `tsType.includes('| null')` 에서
  `isNullableType(tsType)` 로 바뀌어 인식 범위가 넓어졌다 (검출 강화, 위험 없음)
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 함수
    `findUntypedNullableColumns` (113번째 줄 `isNullableType(tsType)` 호출) 및 그 정의
    `isNullableType` (185번째 줄)
  - 상세: 이 가드는 `src/**/*.entity.ts` 를 **읽기만** 하는 정적 분석 함수이고 CI/jest
    실행 시에만 호출된다 — 런타임 서버 코드나 전역 상태에 영향이 없다. 판정 축 변경으로
    `Date|null`(공백 없음)·`null | Date`(순서 반대) 표기도 이제 nullable 로 인식되며, 이는
    이 가드가 잡는 대상 집합을 **넓히는**(위음성을 줄이는) 방향이라 새로운 CRITICAL/WARNING
    을 만들 성격이 아니다. 저장소 엔티티 전수가 `T | null` 표준 표기만 쓴다는 것을
    docstring 이 실측으로 명시하고 있어(2026-09-04), 현재 이 판정 확장으로 새로 offender 로
    잡히는 실제 필드는 없다(전수 spec `저장소 전수` describe 가 이를 GREEN 으로 확인).
  - 제안: 조치 불필요. `isNullableType` 소비처가 이제 `widenedEntityFields` 와
    `findUntypedNullableColumns` 둘이라는 사실이 그 함수 docstring 에 명시돼 있어, 향후 한쪽만
    다시 갈라지는 재발을 막는 근거로 남아 있다.

## 시그니처·인터페이스·전역상태·env·네트워크·이벤트 확인 (해당 없음, 직전 라운드 판정 유지)

- 공개 함수(`collectSourceFiles`, `listSourceFiles`, `listProductionSources`,
  `collectScanTargets`, `findCastOffenders`, `findUntypedNullableColumns`,
  `countNullAsUnknownAsCasts` 등)의 시그니처는 이번 diff 전체를 통틀어 불변이다 — walker
  5사본은 전부 기존 시그니처를 유지한 채 내부 구현만 `collectTsFiles` 위임으로 바뀌었다
  (`grep` 으로 옛 함수명 5개가 여전히 export 되어 있고 호출부가 그대로임을 확인).
- 전역 변수 도입·수정 없음. `WIDENED_DECL`/`SPEC_CAST`/`COLUMN_DECL` 은 모듈 스코프 `const`
  정규식(`g` 플래그)이나 전부 `matchAll` 로만 소비되어 `lastIndex` 상태 누수가 없다
  (`matchAll` 은 내부적으로 정규식을 복제한다).
- 파일시스템: 신규/변경 테스트 픽스처(`source-scan.spec.ts`, `nullable-type-lie-cast.spec.ts`
  의 `withFiles`/`withFixture`, `masked-reject-callers.spec.ts` 의 스캔-범위 테스트)는 전부
  `os.tmpdir()` 에 `mkdtempSync` 로 격리 후 `try/finally` (`afterEach`) 로 `rmSync(...,
  { recursive: true, force: true })` 정리한다. 저장소 트리에 쓰거나 지우는 경로는 없다.
  `collectTsFiles(SRC_ROOT)` 를 쓰는 "저장소 전수" 테스트도 **읽기 전용**이다.
- 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트 발행/콜백 등록·해제는 이번 diff 범위(테스트
  인프라 리팩터링 + guard 하드닝 + plan 문서)에서 발견되지 않았다.
- `plan/in-progress/entity-nullable-column-type-mismatch.md` 갱신은 저장소 관례상 정식
  위치(`plan/in-progress/`)이며 코드 실행에 영향을 주는 부작용이 아니다.

## 뮤테이션 검증

저장소 파일을 고쳐야만 재현되는 가설이 없어 뮤테이션 실험은 수행하지 않았다(코드 읽기와
과거 라운드의 실측 기록 대조만으로 충분히 판단 가능). `git status --short` 로 작업 트리에
`review/code/2026/09/04/04_37_28/` (본 리뷰 산출물 디렉터리) 외 잔여물이 없음을 확인했다.

## 요약

이번 04_37_28 라운드에서 실제로 검토가 필요한 코드 변경은 직전 라운드(`04_18_01`) 이후
추가된 단일 커밋(`4d7888625`, `findUntypedNullableColumns` 의 nullable 판정 축 하드닝)
뿐이며, 이는 테스트 전용 정적 분석 함수의 검출 정확도를 높이는 순수 함수 내부 변경으로
전역 상태·시그니처·파일시스템·환경 변수·네트워크·이벤트 어느 축에도 새로운 위험을 만들지
않는다. 그 이전에 이미 완료된 walker 통합(`collectTsFiles`) 리팩터링에 대해서는 직전
라운드 `side_effect.md` 가 남긴 INFO 3건(순서 변화·`.d.ts` 필터 신규 적용·`stripComments`
export 승격)이 여전히 유효하고 전부 실측·근거로 뒷받침된 의도된 설계 변경이라 재조치가
필요 없다. diff 의 대부분을 차지하는 `review/code/**` 하위 96개 파일은 과거 리뷰
라운드의 읽기 전용 산출물이라 부작용 표면이 없다.

## 위험도

LOW
