# 변경 범위(Scope) 리뷰

## 검토 방법

`meta.json` 기준 리뷰 대상 120개 파일 중 실제 소스/문서 변경은 10개
(`codebase/backend/src/common/__test-utils__/source-scan.{ts,spec.ts}`,
`codebase/backend/src/repo-guards/__tests__/*.ts` 7개,
`plan/in-progress/entity-nullable-column-type-mismatch.md`)이고, 나머지 110개는
`review/code/2026/09/04/{01_48_39..04_37_28}/**` 하위의 이전 리뷰 라운드 산출물(SUMMARY·
RESOLUTION·per-agent report·meta.json·`_retry_state.json`)이다. `origin/main..HEAD` 전체
diff(`git diff origin/main..HEAD`)와 각 커밋 로그(`63d5cdaa6` → `34ce41086`, 11개 커밋)를
직접 열어 대조했다.

## 발견사항

- **[INFO]** 한 브랜치/PR 에 서로 다른 두 개의 선언적 작업(①`repo-guards/__tests__/` 의
  walker 사본 5개를 `collectTsFiles` 로 통합하는 리팩터, ②넓혀진 nullable 필드를 겨눈
  낡은 `.spec.ts` 캐스트를 잡는 신규 가드 `findStaleSpecCasts`/`widenedEntityFields` 추가)가
  섞여 있다.
  - 위치: 커밋 `63d5cdaa6`(refactor) vs `46f464583`(feat) — 파일 기준으로는
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`
  - 상세: 두 작업 모두 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 사전
    등재된 "후속" 항목(walker 추출은 배치 3 리뷰 W5, 캐스트 가드는 배치 2 리뷰 W2·W3)이고,
    후자가 전자가 제공하는 `collectTsFiles`/`stripLiterals` 를 직접 소비하므로 순서상
    자연스러운 의존관계다. 임의의 무관한 기능이 끼어든 것은 아니다.
  - 제안: 조치 불필요 — 별개 PR로 쪼갤 만큼 독립적이지 않고(②가 ①의 산출물에 의존), 둘 다
    같은 plan 이 사전에 명시한 항목이다. 기록 목적의 INFO.

- **[INFO]** `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 두 체크박스
  전환 외에 "한 자리만 고치는 버릇" 회고 표(7행)와 "숫자를 어디에 쓸 수 있나" 절이 새로
  추가됐다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` — `## 한 자리만
    고치는 버릇 — 이 plan 에서 일곱 번 반복했다` 헤딩 이하
  - 상세: 이번 PR 자체의 리뷰 라운드에서 반복된 실수를 그 PR 을 추적하는 plan 문서에
    바로 기록하는 것은, git 로그에 남은 이 저장소의 반복 관례(`docs(plan): 배치 N 리뷰
    KR — …` 커밋들)와 일치한다. 체크박스 전환의 부산물이 아니라 같은 plan 문서 내 리뷰
    이력 기록 관례를 따른 것으로 판단된다.
  - 제안: 조치 불필요.

- **[INFO]** `review/code/2026/09/04/{01_48_39..04_37_28}/**` 110개 파일이 diff 에
  포함되지만, 이는 `/ai-review` fan-out 이 각 라운드마다 생성하는 표준 산출물(meta.json·
  SUMMARY·RESOLUTION·agent 리포트)이며 `review/` 는 gitignore 대상이 아니다(프로젝트
  컨벤션). 코드 변경 의도와 무관한 파일 오염이 아니라 워크플로 자체의 자기 기록이다.
  - 위치: `review/code/2026/09/04/01_48_39/` 등
  - 제안: 조치 불필요.

## 스코프 내로 확인된 사항 (근거만 남김)

- `audit-action-binding-guard.ts`: 로컬 `walk` 제거 + `collectTsFiles` 위임. `fs` import
  제거는 파일 내 `fs.` 참조가 실제로 0개임을 grep 으로 확인 — dead import 정리가 리팩터
  범위 밖 drive-by 가 아니라 그 리팩터의 직접 결과.
- `engine-error-code-anchor-guard.ts` / `masked-reject-callers-guard.ts` /
  `redis-fail-open-catalog-guard.ts`: 동일 패턴(로컬 walker → `collectTsFiles`). 세 파일
  모두 `fs.` 참조가 여전히 남아 있어 `fs` import 는 유지됨 — 일관되게 필요한 것만
  건드렸다.
- `masked-reject-callers.spec.ts`: 추가된 테스트가 `listSourceFiles` → `collectTsFiles(...,
  { includeSpec: true })` 배선을 직접 단언 — 리팩터로 바뀐 동작(스캔 대상에 `.spec.ts`
  포함)을 검증하는 것으로 리팩터 범위 내.
- `source-scan.ts`/`source-scan.spec.ts`: 신규 export(`collectTsFiles`, `stripLiterals`)와
  그 전용 테스트 — 둘 다 walker 통합·캐스트 가드 두 축이 실제로 소비하는 함수. 무관한
  export 확장 없음.
- `nullable-type-lie-cast-guard.ts`/`nullable-type-lie-cast.spec.ts`: 신규 함수
  (`widenedEntityFields`, `findStaleSpecCasts`, `isNullableType`)와 그 테스트만 추가.
  `withFixture`/`withFiles` 통합은 같은 diff 안에서 새로 생긴 중복(리뷰 W3 지적)을 그
  자리에서 해소한 것으로, 범위 밖 리팩터가 아니라 같은 PR 이 만든 결함의 자기 수정.
- 설정 파일(`tsconfig`·`eslint`·`jest` 등) 변경 없음 — `meta.json` 파일 목록에 config
  확장자가 전혀 없음을 확인.
- 엔티티·프로덕션 런타임 코드(`*.entity.ts`, 서비스 로직) 변경 없음 — 전부
  `__test-utils__`/`repo-guards/__tests__` 하위 테스트 인프라와 plan 문서로 국한.

## 요약

리뷰 대상 diff 는 `repo-guards/__tests__/` walker 통합과 그 인프라를 소비하는 신규
"넓혀진 필드 낡은 spec 캐스트" 가드 추가, 두 축으로 구성되며 둘 다 같은
`entity-nullable-column-type-mismatch.md` plan 이 사전에 명시한 후속 항목이다. 실제
런타임/엔티티 코드 변경은 전혀 없고, 변경은 `common/__test-utils__`·`repo-guards/__tests__`
디렉터리와 그 plan 문서로 정확히 국한된다. import 정리는 각 파일에서 실제로 죽은 참조에
한정되어 있고, 포맷팅·주석·설정 파일의 무관한 변경은 발견되지 않았다. `review/code/**`
하위 110개 파일은 이 저장소의 표준 리뷰 워크플로 산출물로, 스코프 위반이 아니다. 유일하게
주목할 점은 리팩터(①)와 신규 기능(②)이 한 브랜치에 묶여 있다는 것인데, ②가 ①의 산출물에
직접 의존하고 둘 다 plan 에 선언된 항목이라 결함으로 보지 않는다.

## 위험도

NONE
