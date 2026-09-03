# 유지보수성(Maintainability) 코드 리뷰

## 개요

이 diff 는 `null as unknown as X` 이중 캐스트 8건을 제거하고 관련 엔티티 필드를 `T | null` 로
넓히는 배치 1 작업 + 회귀 방지 가드(`nullable-type-lie-cast-guard.ts`/`.spec.ts`) 신설 + 직전
리뷰 라운드(`14_44_15`)에서 지적된 W1~W4 를 조치한 재검토 대상이다. 직전 라운드의 CRITICAL
(`User` 4개 컬럼 `@Column({ type: ... })` 누락)은 이번 diff 의 `user.entity.ts` 에서 이미
`type: 'varchar'` 로 반영되어 있고, W1(가드 spec 이 프로덕션 파일을 `writeFileSync` 로 변형)도
`nullable-type-lie-cast.spec.ts` 의 `withFixture` 합성 fixture 전환으로 해소되어 있다.

## 발견사항

- **[INFO]** `repo-guards/__tests__/` 안에서 "디렉터리를 재귀 스캔해 `.ts` 파일을 모으는" 로직이
  이번 파일로 5번째 사본이 된다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:29`
    (`collectScanTargets`) — 형제 구현: `masked-reject-callers-guard.ts:50` 부근,
    `engine-error-code-anchor-guard.ts:106`(`walkTsFiles`),
    `audit-action-binding-guard.ts:47`(`collectSourceFiles`)
  - 상세: 네 곳 모두 `fs.readdirSync(dir, { withFileTypes: true })` 로 시작하는 사실상 동일한
    재귀 walk 를 각자 구현하고 있고, 이름도 `collectScanTargets`/`collectSourceFiles`/
    `walkTsFiles` 로 제각각이다. `source-scan.ts` 자신의 docstring 은 "**세는**" 축은 한 곳에
    모은다는 원칙을 명시하지만 "**모으는(walk)**" 축에는 같은 원칙이 적용돼 있지 않다. 이미
    직전 리뷰(W5)에서 지적되었고 `plan/in-progress/entity-nullable-column-type-mismatch.md`
    할 일 목록에 "형제 가드 4개를 함께 건드려야 해 이 배치에 넣지 않는다" 는 근거와 함께
    명시적으로 후속 등재되어 있다 — 방치가 아니라 **의도된 이연**이므로 이번 배치의 결함으로
    보진 않되, 실제로 중복이 누적되고 있다는 사실 자체는 재확인해 둔다.
  - 제안: 그대로 plan 의 후속 항목으로 진행. 다음에 이 디렉터리의 가드를 하나라도 더 만질 때
    `(root, { excludeSpec }) => string[]` 형태의 공용 walker 로 4개(+신규 5번째)를 한 번에
    통합할 것.

- **[INFO]** `source-scan.ts` 에서 신규 함수 쌍이 기존 counter/wrapper 페어링 사이에 끼어
  인접성이 깨진다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:112-172`
    (`countRawUpdateReturning` 112 · 신규 `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`
    158-168 · `hasRawUpdateReturning` 170)
  - 상세: `countRawUpdateReturning` 과 그 래퍼 `hasRawUpdateReturning` 은 원래 인접했는데,
    이번에 추가된 `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast` 쌍이 그 사이에 끼어들며
    형제 쌍의 counter-wrapper 인접성이 깨졌다. 직전 리뷰(INFO#6)에서 이미 지적되어 "다음에 이
    파일을 만질 때 파일 끝으로 이동" 으로 판단 유지된 사안이라 이번 회차의 새 결함은 아니다.
  - 제안: 조치 불요(기존 결정 유지). 다음 편집 시 신규 함수 쌍을 파일 끝으로 옮길 것.

- **[INFO]** 신규 테스트 fixture 의 시간 상수가 매직 넘버이며 같은 파일 안에서 표기법이
  불일치한다.
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts:936`
    (`Date.now() + 3_600_000`), `:1094` (`Date.now() + 86400000`)
  - 상세: 각각 1시간·24시간을 나타내는 duration 인데 하나는 숫자 구분자(`_`)를 쓰고 다른 하나는
    안 쓴다. 같은 파일 안에서 형식이 갈리는 것 외에, 두 값 모두 단위를 드러내는 이름이나 주석이
    없어 "왜 이 숫자인지"는 읽는 사람이 필드명(`passwordResetExpiresAt`/`emailVerifyExpiresAt`)
    으로 역산해야 한다. 실질 결함은 아니고 테스트 가독성 수준의 사소한 지적이다.
  - 제안: 우선순위 낮음. 여유가 있으면 `ONE_HOUR_MS`/`ONE_DAY_MS` 류 명명 상수로 통일하거나
    최소한 숫자 구분자 표기를 `86_400_000` 으로 맞출 것.

## 요약

핵심 변경(캐스트 제거 + 타입 확장 + 신규 가드)은 저장소의 기존 guard+spec 관례, 자매 counter/
wrapper 명명 규약(`countX`/`hasX`), synthetic-fixture 관례를 그대로 따르고 있어 일관성이 높다.
직전 라운드에서 지적된 CRITICAL(타입 누락)과 W1(프로덕션 파일 변형 fixture)은 이번 diff 에서
이미 해소되어 있는 것으로 확인된다. 신규 함수(`countNullAsUnknownAsCasts`/
`findUntypedNullableColumns` 등)는 길이·중첩·네이밍 모두 양호하며 각 규칙 뒤에 "왜" 를 설명하는
docstring 이 충실하다. 남은 지적은 전부 INFO 수준이고, 그중 가장 실질적인 walker 중복(5번째
사본)은 이미 plan 문서에 근거와 함께 후속 항목으로 명시적으로 이연되어 있어 이번 배치의
결함으로 보지 않는다.

## 위험도

LOW
