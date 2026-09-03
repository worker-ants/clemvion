# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 디렉토리 재귀 스캔(`walk`) 로직이 guard 파일마다 계속 복붙되어 5번째 사본이 생겼다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:29-41` (`collectScanTargets`)
  - 상세: 같은 디렉터리(`repo-guards/__tests__/`) 안에 `.ts` 를 재귀 수집하는 `walk` 함수가 이미
    `masked-reject-callers-guard.ts` 의 `listSourceFiles`, `audit-action-binding-guard.ts` 의
    `collectSourceFiles` 등 최소 2곳에 필터 조건만 다르게(`.spec.ts` 제외 여부, `node_modules`/`dist`
    skip 여부, `.d.ts` 제외 여부) 거의 동일한 형태로 존재한다. 이번 PR 이 `collectScanTargets` 를
    또 하나(사실상 5번째) 새로 작성해 넣으면서 그 복제를 한 벌 더 늘렸다. `source-scan.ts` 자신의
    docstring 이 "세는(count) 로직은 세 번째 가드가 생겨도 여기만 고치면 되도록 모은다" 고 명시적으로
    말하고 있어 저자가 이 종류의 중복을 이미 인지하고 있는데, 정작 "파일을 모으는(walk)" 축은 같은
    원리를 적용하지 않았다.
  - 제안: `(root, { excludeSpec, excludeDirs })` 같은 옵션을 받는 공용 walker 를
    `common/__test-utils__/` 또는 `repo-guards/__tests__/` 공용 헬퍼로 뽑아 이 파일과 형제
    guard 들이 함께 참조하게 하면, 새 guard 가 추가될 때마다 walk 로직이 한 번 더 복제되는 것을
    막을 수 있다. (이 PR 의 좁은 범위를 넘는 리팩터라면 최소한 후속 항목으로 plan 에 남길 만하다.)

- **[INFO]** 새 함수 삽입으로 `countRawUpdateReturning` ↔ `hasRawUpdateReturning` 의 기존 count+has 페어링 배치가 깨졌다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:135-172`
  - 상세: 기존 파일은 `countXxx` 정의 바로 아래에 그 "존재 여부만" 확인하는 `hasXxx` 래퍼를 붙이는
    관례였다(파일 헤더의 `{@link}` 주석도 그 인접성을 전제). 이번 diff 는 `countRawUpdateReturning`
    (112~133줄)과 그 짝 `hasRawUpdateReturning`(170~172줄) 사이에 완전히 새로운
    `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast` 쌍(135~168줄)을 끼워 넣어, 이제
    `hasRawUpdateReturning` 을 읽으려면 자신의 `count` 짝을 지나 33줄을 더 스크롤해야 한다.
  - 제안: 새 함수 쌍을 파일 맨 끝에 추가했다면 기존 쌍의 인접성이 그대로 유지됐을 것이다. 지금
    상태로도 동작에는 문제가 없으나, 다음에 세 번째 쌍이 추가되면 같은 패턴이 반복돼 파일 내
    탐색 비용이 계속 늘어난다.

- **[INFO]** 같은 디렉터리 안에서 "스캔 루트를 어떻게 받는가" 관례가 파일마다 다르다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:16` (`SRC_ROOT`)
  - 상세: 이 파일은 `path.resolve(__dirname, '..', '..')` 로 계산한 상수 기본값을 파라미터
    디폴트로 쓰는 반면, `audit-action-binding-guard.ts` 의 `collectSourceFiles(repoRoot)` 는
    호출자가 넘긴 `repoRoot` + 별도 `MODULES_DIR` 상수 조합으로 루트를 만든다. 기능상 문제는
    없지만 "루트를 어디서 계산하나" 축이 파일마다 달라 새 guard 를 작성할 때 어느 쪽을 따라야
    할지 참조 지점이 갈린다.
  - 제안: 반드시 지금 고칠 필요는 없으나, 위 WARNING 항목의 공용 walker 를 뽑는 김에 루트 계산
    관례도 함께 통일하면 좋다.

- **[INFO]** `schedule.entity.ts` 는 `nextRunAt` 만 `Date | null` 로 좁혀지고, 같은 파일의
  `lastRunAt`(`nullable: true` 이지만 여전히 `Date`)은 이번 배치에서 넓혀지지 않았다
  - 위치: `codebase/backend/src/modules/schedules/entities/schedule.entity.ts:44-45`
  - 상세: 두 컬럼이 나란히 있고 DB 상 둘 다 nullable 인데 타입 정직성이 한쪽만 회복돼, 파일만
    보면 왜 `nextRunAt` 은 `| null` 이고 `lastRunAt` 은 아닌지 국소적으로는 설명이 없다. 다만
    이 비대칭은 우연이 아니라 `plan/in-progress/entity-nullable-column-type-mismatch.md` 가
    "배치 1은 캐스트를 강제하던 8필드만" 이라고 명시적으로 범위를 좁히고, `lastRunAt` 류는
    "배치 2 후보"로 트래킹하고 있어 근거가 문서화돼 있다.
  - 제안: 조치 불요(추적 문서 존재). 다만 엔티티 파일 자체에 "동일 파일 내 나머지 nullable
    컬럼은 배치 2 대기 — plan/in-progress/entity-nullable-column-type-mismatch.md" 정도의
    한 줄 포인터가 있으면, plan 문서를 모르는 다음 리더가 이 비대칭을 결함으로 오인할 여지가
    줄어든다.

## 요약

이번 변경은 `null as unknown as X` 이중 캐스트 8건을 실제 컬럼 타입(`| null`) 확장으로 대체해
타입 시스템이 다시 정직해지도록 만드는 정리 작업으로, 코드 자체는 전반적으로 더 읽기 쉬워졌다
(우회용 이중 캐스트 제거는 순수한 가독성·타입 안전성 개선). 회귀 방지용 신규 guard/spec 쌍은
기존 `repo-guards/__tests__/` 관례(guard+spec 분리, count/has 술어를 `source-scan.ts` 로 단일화,
`[전제]`/`[대조군]` 테스트 태깅)를 성실히 따랐고, 문서화 밀도도 저장소 평균 수준으로 높다. 다만
guard 디렉터리 안에서 "디렉터리를 재귀 스캔해 `.ts` 파일을 모으는" 로직이 파일마다 계속 복붙되는
추세가 이번 PR 로 한 벌 더 늘었고(WARNING 1건), `source-scan.ts` 내 새 함수 삽입 위치가 기존
count/has 페어링 인접성을 깨는 등 경미한 구조적 정돈 여지(INFO)가 남아 있다. 치명적이거나 시급한
문제는 없다.

## 위험도

LOW
