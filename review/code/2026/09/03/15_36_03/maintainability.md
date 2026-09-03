# 유지보수성(Maintainability) 리뷰

## 개요

이 diff 는 `null as unknown as X` 이중 캐스트 8건(`User` 7 · `Schedule` 1)을 제거하고 해당
엔티티 필드 타입을 `T | null` 로 넓히는 배치 1 작업 + 회귀 방지 가드
(`nullable-type-lie-cast-guard.ts`/`.spec.ts`) 신설 + 그 사이 두 리뷰 라운드(`14_44_15`,
`15_17_01`)에서 지적된 Critical(부팅 실패)·Warning(테스트 커버리지 공백) 조치까지 포함한
누적 diff다. 코드 파일 자체(1~15번)를 대상으로 검토했고, `review/code/**`·`review/consistency/**`
아래 신규 파일(16번 이후)은 이전 리뷰 세션의 산출물(마크다운 리포트)이라 "코드" 유지보수성
관점의 대상이 아니어서 제외했다.

## 발견사항

- **[INFO]** 디렉터리 재귀 스캔(`walk`) 로직이 guard 파일마다 반복돼 이번 PR 로 5번째 사본이 생겼다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 함수
    `collectScanTargets` (신규 추가) — 형제 구현: `masked-reject-callers-guard.ts`,
    `audit-action-binding-guard.ts`(`collectSourceFiles`), `engine-error-code-anchor-guard.ts`
    (`walkTsFiles`) 등
  - 상세: `fs.readdirSync(dir, { withFileTypes: true })` 로 시작하는 사실상 동일한 재귀 walk 를
    각 가드가 필터 조건만 다르게(`.spec.ts` 제외 여부 등) 반복 구현하고 있다. `source-scan.ts`
    자신의 docstring 은 "**세는(count)**" 축은 한 곳에 모은다는 원칙을 명시하지만, "**모으는
    (walk)**" 축에는 같은 원칙이 아직 없다. 이미 이전 라운드(14_44_15 W5, 15_17_01)에서
    지적됐고, `plan/in-progress/entity-nullable-column-type-mismatch.md` "## 할 일" 에 "형제
    가드 4개를 함께 건드려야 해 이 배치에 넣지 않는다" 는 근거와 함께 명시적으로 후속 등재돼
    있다 — 방치가 아니라 의도된 이연이라 이번 배치 자체의 새 결함으로 보진 않되, 중복이 실제로
    누적되고 있다는 사실은 재확인해 둔다.
  - 제안: 조치 불요(plan 추적 확인). 다음에 이 디렉터리의 가드를 하나라도 더 만질 때
    `(root, { excludeSpec }) => string[]` 형태의 공용 walker 로 통합할 것.

- **[INFO]** `source-scan.ts` 에서 신규 함수 쌍이 기존 counter/wrapper 페어링 사이에 끼어 인접성이 깨졌다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:112-173`
    (`countRawUpdateReturning` 112 → 신규 `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`
    158-168 → `hasRawUpdateReturning` 171)
  - 상세: 파일이 지켜 온 "`countX` 정의 바로 아래 그 `hasX` 래퍼" 관례(파일 헤더의 `{@link}`
    주석도 이 인접성을 전제)가, 새 쌍이 기존 쌍 사이에 끼어들며 깨졌다. `hasRawUpdateReturning`
    을 읽으려면 자신의 count 짝(112줄)을 지나 60줄 가까이 스크롤해야 한다. 이전 라운드에서
    이미 지적됐고(INFO#6/#3) "다음에 이 파일을 만질 때 파일 끝으로 이동" 으로 판단 유지된
    사안이다 — 이번 회차의 새 결함은 아니다.
  - 제안: 조치 불요(기존 결정 유지). 다음 편집 시 신규 함수 쌍을 파일 끝으로 옮길 것.

- **[INFO]** 신규 테스트 fixture 의 duration 매직 넘버가 같은 파일 안에서 표기법이 불일치한다
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts:936`
    (`Date.now() + 3_600_000`), `codebase/backend/src/modules/auth/auth.service.spec.ts:1094`
    (`Date.now() + 86400000`)
  - 상세: 각각 1시간·24시간을 나타내는 duration 인데, 같은 diff 안에서 하나는 숫자 구분자(`_`)를
    쓰고 다른 하나는 안 쓴다. 두 값 모두 `ONE_HOUR_MS`류 이름이나 단위 주석이 없어 "왜 이
    숫자인지"를 읽는 사람이 필드명(`passwordResetExpiresAt`/`emailVerifyExpiresAt`)으로
    역산해야 한다. 실질 결함은 아니고 테스트 가독성 수준의 사소한 지적이며, 이전 라운드에서
    이미 지적되고 "diff 밖 기존 코드 표기와의 통일은 그 블록을 만질 때" 로 판단 유지됐다.
  - 제안: 우선순위 낮음. 여유가 있으면 명명 상수(`ONE_HOUR_MS`/`ONE_DAY_MS`)로 통일하거나
    최소한 숫자 구분자 표기를 `86_400_000` 으로 맞출 것.

- **[INFO]** `COLUMN_DECL` 정규식이 이번 배치에서 새로 추가된 가드의 핵심 판정 로직인데, 정규식
  자체의 밀도가 높아 정규식만 봐서는 의도를 파악하기 어렵다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 상수
    `COLUMN_DECL` (`@Column\((?:[^()]|\([^()]*\))*\)\s*\n\s*(\w+)\s*:\s*([^;]+);`)
  - 상세: "한 단계 중첩 괄호까지 받는 `@Column(...)` 블록 + 바로 다음 줄의 필드 선언"을 한
    정규식으로 캡처한다. 바로 위에 "`@Column(...)` 블록과 바로 뒤 필드 선언을 잡는다(한 단계
    중첩 괄호까지)"라는 한 줄 주석이 있어 최소한의 의도는 남아 있지만, `source-scan.ts` 의
    `CALL` 정규식(제네릭 중첩 처리)이 그랬듯 "왜 한 단계까지만인지" · "2단계 중첩이 생기면
    무엇이 깨지는지"에 대한 설명은 이 파일이 아니라 소비 spec(`nullable-type-lie-cast.spec.ts`)
    과 `plan/` 문서 쪽에 흩어져 있다. 순환 복잡도 자체는 낮지만(단일 정규식 매칭 루프), 정규식의
    "실패 모드"를 파악하려면 3개 파일을 오가야 한다.
  - 제안: 필수 수정 아님. 정규식 바로 위 주석에 "2단계 이상 중첩되면 이 가드가 그 필드를 놓친다
    — 저장소에 아직 그런 사례 없음" 한 줄만 추가해도 소비 spec 을 열지 않고 실패 모드를 알 수
    있다.

## 긍정적으로 확인한 점

- 새로 추가된 `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`(source-scan.ts)와 가드 쌍
  `nullable-type-lie-cast-guard.ts`/`.spec.ts`는 함수 길이·중첩 깊이·네이밍 모두 양호하다 —
  각 함수가 한 가지 일만 하고(스캔 대상 수집 / 캐스트 카운트 / 미명시 타입 컬럼 탐지), 3단
  이상 중첩이 없다.
  기존 `countX`/`hasX` 네이밍·guard+spec 분리 관례를 그대로 따랐다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:158-168`,
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`
- `nullable-type-lie-cast.spec.ts` 는 대조군 fixture 를 `withFixture` 헬퍼(`os.tmpdir()`
  기반)로 통일해 형제 가드(`masked-reject-callers.spec.ts`)와 같은 관례를 따르고, 이전 라운드
  W1(프로덕션 파일을 직접 `writeFileSync` 로 변형하던 문제)을 해소했다 — 테스트 파일 자체의
  유지보수성(재사용 가능한 fixture 헬퍼)도 개선됐다.
- 순수 캐스트 제거 지점(`auth.service.ts`/`totp.service.ts`/`schedule-runner.service.ts`/
  `schedules.service.ts`/`users.service.ts`)은 `null as unknown as X` → `null` 로 단순화돼
  오히려 가독성이 좋아졌다. `schedules.service.ts` 의 3줄 삼항식이 1줄로 줄어든 것도 같은
  이유(캐스트 제거로 줄 길이가 짧아짐)로, 별도 지적할 실익은 없다.
- 엔티티 컬럼 선언(`user.entity.ts`, `schedule.entity.ts`)의 `@Column({...})` → 필드 타입
  패턴은 파일 전체에서 일관된 스타일을 유지한다.

## 요약

핵심 변경(캐스트 8건 제거 + 타입 확장 + 회귀 가드 신설)은 저장소의 기존 관례(guard+spec 분리,
`countX`/`hasX` 페어링 명명, synthetic-fixture)를 잘 따르고 있고, 신규 함수들은 길이·중첩·
네이밍이 모두 양호하며 "왜 이 형태인지"를 설명하는 docstring 밀도도 저장소 평균 이상이다.
남은 지적은 전부 INFO 수준이며, 그중 가장 실질적인 walker 5중복은 이미 plan 문서에 근거와
함께 후속 항목으로 명시적으로 이연돼 있어 이번 배치의 결함으로 보지 않는다. count/has 페어링
인접성 붕괴·시간 상수 표기 불일치도 이전 라운드에서 이미 식별되고 낮은 우선순위로 판단 유지된
사안의 재확인이다. 새로 관측한 것은 `COLUMN_DECL` 정규식의 실패 모드 설명이 여러 파일에
흩어져 있다는 점뿐이며, 이 역시 기능적 결함이 아니라 문서 지역성의 사소한 개선 여지다. 치명적
이거나 시급한 유지보수성 문제는 없다.

## 위험도

LOW
