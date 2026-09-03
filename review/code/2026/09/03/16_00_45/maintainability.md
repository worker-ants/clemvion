# 유지보수성(Maintainability) 리뷰

## 컨텍스트

이 diff(`origin/main...HEAD`, 브랜치 `claude/entity-nullable-batch1`)는 `null as unknown as X`
이중 캐스트 8건 제거 + 엔티티 필드 `T | null` 확장(배치 1) + 회귀 방지 가드 신설
(`nullable-type-lie-cast-guard.ts`/`.spec.ts`) + 이미 두 차례(`14_44_15`, `15_17_01`) 리뷰를 거쳐
Critical/Warning 을 전부 조치한 결과물이다. 실제 코드 변경분(`codebase/`, `plan/`)은 15개 파일·
약 672줄 추가/27줄 삭제로 작다. 프롬프트에 포함된 `review/code/2026/09/03/{14_44_15,15_17_01}/*`
는 이전 라운드 리뷰 산출물이 커밋된 것으로, 코드가 아니라 리뷰 감사 기록이라 유지보수성 관점 대상
에서 제외했다(중복처럼 보이는 반복 서술은 라운드별 델타를 기록하는 감사 추적의 정상 형태).

이전 두 라운드의 maintainability 리뷰가 이미 동일 코드를 검토했고, 그 발견사항이 이번 라운드에도
그대로 남아 있는지 소스를 직접 `Read`로 재확인했다. 아래는 그 재확인 결과 + 독립 재검토다.

## 발견사항

- **[INFO]** 디렉터리 재귀 스캔(`walk`) 로직이 5번째로 복붙되었다 — 이미 plan 에 이름으로 추적됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:33-45`
    (`collectScanTargets`)
  - 상세: `fs.readdirSync(dir, { withFileTypes: true })` 로 시작하는 사실상 동일한 재귀 walk 가
    같은 디렉터리(`repo-guards/__tests__/`) 안에 이미 4곳 더 있다(`grep -l readdirSync`로 직접
    확인: `audit-action-binding-guard.ts`, `engine-error-code-anchor-guard.ts`,
    `masked-reject-callers-guard.ts`, `redis-fail-open-catalog-guard.ts`). `source-scan.ts`(35-58줄)
    자신의 docstring은 "**세는(count)**" 축은 한 곳에 모은다는 원칙을 명시하지만 "**모으는(walk)**"
    축에는 같은 원칙이 적용돼 있지 않다. 다만 이 항목은 새로 발견한 결함이 아니다 —
    `plan/in-progress/entity-nullable-column-type-mismatch.md:159-162` 에 "형제 가드 4개를 함께
    건드려야 해 이 배치에 넣지 않는다"는 근거와 함께 후속 항목으로 이름 등재돼 있음을 직접 확인했다.
  - 제안: 조치 불요(추적됨). 다음에 이 디렉터리의 가드를 하나라도 더 만질 때
    `(root, { excludeSpec }) => string[]` 형태의 공용 walker 로 5개를 한 번에 통합할 것.

- **[INFO]** `source-scan.ts` 신규 함수쌍이 기존 counter/wrapper 인접 배치를 깨뜨린다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:112` (`countRawUpdateReturning`
    정의) ~ `:158-168`(신규 `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`) ~ `:171`
    (`hasRawUpdateReturning`)
  - 상세: 이 파일은 "`countXxx` 정의 바로 아래 그 `hasXxx` 래퍼"라는 관례를 지켜 왔는데(각 래퍼의
    `{@link}` 주석이 그 인접성을 전제), 이번 diff 가 `countRawUpdateReturning`(112줄)과 그 짝
    `hasRawUpdateReturning`(171줄) 사이에 새 쌍(158-168줄)을 끼워 넣어 33줄을 벌려 놓았다. 동작에는
    영향 없다. 이전 두 라운드에서 이미 지적되었고 "다음에 이 파일을 만질 때 파일 끝으로 이동"으로
    판단이 유지된 사안이라 이번 회차의 새 결함은 아니다.
  - 제안: 조치 불요(기존 판단 유지). 새 함수쌍은 파일 끝에 추가하는 편이 인접성을 지켰을 것이다.

- **[INFO]** 같은 디렉터리 안에서 "스캔 루트를 어떻게 계산하는가" 관례가 파일마다 다르다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:16`
    (`export const SRC_ROOT = path.resolve(__dirname, '..', '..');`)
  - 상세: 이 파일은 모듈 로드 시점에 `__dirname` 기반 상수를 계산해 파라미터 기본값으로 쓰는 반면,
    `audit-action-binding-guard.ts:13`의 `MODULES_DIR`은 문자열 상수만 두고 루트는 호출자가 넘기는
    `repoRoot` 파라미터와 조합한다. 기능상 문제는 없지만 "루트를 어디서·어떻게 얻나" 축이 파일마다
    달라, 새 가드를 작성할 때 어느 쪽을 따라야 할지 참조 지점이 갈린다.
  - 제안: 우선순위 낮음. 위 walker 통합 작업을 할 때 루트 계산 관례도 함께 정리하면 좋다.

- **[INFO]** 신규 테스트의 시간(duration) 리터럴이 매직 넘버이고 같은 파일 안에서 표기법이 불일치한다
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts:936`
    (`passwordResetExpiresAt: new Date(Date.now() + 3_600_000)`) vs `:1094`
    (`emailVerifyExpiresAt: new Date(Date.now() + 86400000)`)
  - 상세: 하나는 1시간을 숫자 구분자(`_`)로 표기하고(`3_600_000`), 바로 아래쪽 새 테스트는 24시간을
    구분자 없이 적었다(`86400000`). 두 값 모두 단위를 드러내는 이름이나 주석이 없어, 읽는 사람이
    필드명(`passwordResetExpiresAt`/`emailVerifyExpiresAt`)으로 역산해야 의미를 알 수 있다. 실질
    결함은 아니며 같은 PR 안에서 새로 추가된 두 리터럴 사이의 표기 불일치라는 점만 지적한다.
  - 제안: 우선순위 낮음. 여유가 있으면 `ONE_HOUR_MS`/`ONE_DAY_MS` 류 명명 상수로 통일하거나 최소한
    숫자 구분자 표기를 `86_400_000`으로 맞춘다.

- **[INFO]** `findUntypedNullableColumns`의 `COLUMN_DECL` 정규식이 함수 하나에 파싱·판정 로직을
  모두 담아 조건 분기가 촘촘하다(순환 복잡도상 경계선)
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:109-126`
  - 상세: 정규식 매치 → `| null` 여부 → `type:` 존재 여부 → `@JoinColumn` 예외 여부, 4단계
    조건이 한 루프 안에 순차 `continue`로 나열돼 있다. 중첩은 얕고(파일 루프 → 매치 루프, 2단) 각
    조건에 "왜 이 조건인가"를 설명하는 docstring(59-75줄, 97-107줄)이 붙어 있어 실질적으로 읽기
    어렵지는 않았지만, 조건이 하나 더 늘면(예: 배치 2 에서 relation 예외 추가) 이 함수가 책임을
    더 떠안게 될 가능성이 있다.
  - 제안: 지금 당장 조치 불요. 조건이 하나 더 늘어난다면 `continue` 체인을 `isExempt(match, joined)`
    같은 이름 있는 술어로 뽑아내는 것을 고려.

## 강점 (긍정 관측)

- 신규 함수(`countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`/`collectScanTargets`/
  `findCastOffenders`/`findUntypedNullableColumns`)는 전부 단일 책임·짧은 길이(대부분 5-20줄)를
  유지하고, 기존 저장소 관례(`countX`/`hasX` 페어링, guard+spec 분리, `[전제]`/`[대조군]`/
  `[예외 경계]` 테스트 태깅)를 성실히 따른다.
- 신규 가드 spec(`nullable-type-lie-cast.spec.ts`)이 `os.tmpdir()` 기반 `withFixture` 합성
  fixture로 전환되어(105-114줄), 이전 라운드에서 지적된 "실제 프로덕션 소스 파일을 변형" 하던
  대조군 테스트가 형제 가드 관례(`masked-reject-callers-guard.ts`)와 일치하게 정리되었다.
- 8곳의 `null as unknown as X` → `null` 치환은 전부 한 줄짜리 순수 표기 정리로, 가독성을 오히려
  개선했다(우회 캐스트 제거).
- `user.entity.ts`의 `type: 'varchar'` 추가 4곳은 동일한 6-라인 데코레이터 형태로 일관되게
  적용됐다(21-27, 44-50, 80-86, 95-101줄).

## 요약

핵심 변경(캐스트 8건 제거 + 엔티티 필드 타입 확장 + 회귀 가드 신설)은 저장소의 기존 명명·구조
관례를 잘 따르고, 각 함수·테스트에 "왜 필요한가"를 설명하는 문서화가 충실해 유지보수성 관점에서
전반적으로 양호하다. 이전 두 라운드가 이미 찾아낸 4가지 경미한 지적(walker 5번째 복사, count/has
페어링 인접성 파손, `SRC_ROOT` 계산 관례 불일치, 시간 매직넘버)은 이번 라운드에도 코드에 그대로
남아 있음을 직접 확인했지만, walker 복사는 plan 문서에 후속 항목으로 이름까지 등재돼 있고 나머지는
전부 "다음에 그 자리를 만질 때" 처리하기로 판단이 유지된 사소한 사안들이다. 새로 지적할 만한
Critical/Warning 급 유지보수성 결함은 발견하지 못했다.

## 위험도

LOW
