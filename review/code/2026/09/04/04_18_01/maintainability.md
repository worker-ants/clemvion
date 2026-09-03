# 유지보수성(Maintainability) 리뷰

## 검증 방법

`git diff origin/main`(프롬프트가 생략한 5개 파일 포함: `source-scan.ts`/`.spec.ts`,
`nullable-type-lie-cast-guard.ts`/`.spec.ts`, `plan/in-progress/entity-nullable-column-type-mismatch.md`)로
실제 변경분을 직접 확인하고, 나머지 4개 가드(`audit-action-binding-guard.ts`·
`engine-error-code-anchor-guard.ts`·`masked-reject-callers-guard.ts`·
`redis-fail-open-catalog-guard.ts`)는 프롬프트에 실린 unified diff 를 그대로 대조했다. 이
changeset 은 이미 7라운드(01_49_18~03_58_32) 리뷰·조치를 거쳤으므로, 그중 유지보수성 관련
WARNING 2건(1R W3 `withFiles`/`withFixture` 중복, 7R W1 `masked-reject-callers.spec.ts` JSDoc
orphan)이 실제로 반영됐는지 코드에서 직접 재확인했다 — 둘 다 반영 확인. 저장소는 읽기만
했고 아무것도 쓰지 않았다(`git status --short` 확인 불필요 — 뮤테이션 안 함).

## 발견사항

- **[INFO]** 같은 파일 안에서 "데코레이터 인자의 1단 균형 괄호"를 매칭하는 정규식 조각이
  변경분(`WIDENED_DECL`)과 기존 코드(`COLUMN_DECL`)에 걸쳐 세 번 반복된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:78`
    (`COLUMN_DECL`, 이번 diff 밖) · `:169`(`WIDENED_DECL`, 이번 diff로 신규 추가 — 같은
    조각이 그 안에서 두 번: 필수 데코레이터용, 선택적 두 번째 데코레이터용)
  - 상세: `(?:[^()]|\([^()]*\))*` 라는 동일한 서브패턴이 `COLUMN_DECL`(78줄)에 한 번,
    `WIDENED_DECL`(169줄)에 두 번(`@(?:Column|ManyToOne|OneToOne)\(...\)` 와
    `(?:\s*@\w+\(...\)\s*\n)?` 각각) 총 세 곳에 리터럴로 박혀 있다. 이 조각 자체는 "괄호
    안에 괄호가 최대 1단만 있다"는 이 파일의 공통 가정을 표현하는데, 세 곳 중 하나만 고치면
    (예: 2단 중첩을 지원하도록 넓히면) 나머지 둘이 조용히 뒤처진다 — 이 changeset 이 바로
    이 실패 모드("한쪽만 하드닝하면 나머지에 같은 결함이 남는다")를 이유로 5개 walker 사본을
    `collectTsFiles` 로 통합한 diff 인데, 같은 파일 안에서 더 작은 스케일로 같은 패턴이
    재발했다. 다만 세 매칭 대상(`@Column` 단독 / `@Column|ManyToOne|OneToOne` 복수 /
    옵셔널 두 번째 데코레이터)이 서로 달라 단순 상수 추출만으로는 못 합치고, 문자열
    interpolation(`new RegExp` 조립)이 필요해 오히려 가독성이 떨어질 수 있다 — 그래서
    WARNING 이 아니라 INFO.
  - 제안: 조치 불필요. 다음에 이 파일의 데코레이터 파싱 축을 만질 때(예: 2단 중첩 데코레이터
    지원, INFO#1 트리거)
    `const BALANCED_PARENS = String.raw`(?:[^()]|\([^()]*\))*`;` 같은 공유 조각으로 묶는 것을
    함께 고려.

- **[INFO]** `collectTsFiles` 위임 한 줄 래퍼가 여전히 4개의 다른 이름으로 남아 있다 (기존
  결정 재확인 — 새 지적 아님)
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:47-48`
    (`collectSourceFiles`) · `masked-reject-callers-guard.ts:48,51`(`listSourceFiles`) ·
    `redis-fail-open-catalog-guard.ts:93-94`(`listProductionSources`) ·
    `nullable-type-lie-cast-guard.ts:38-40`(`collectScanTargets`) — `engine-error-code-anchor-guard.ts:157`
    는 래퍼 없이 `collectTsFiles` 를 직접 호출
  - 상세: 1R(`01_49_18`) maintainability 리뷰가 이미 지적했고, 이후 라운드들이 "5개 가드
    중 하나를 다시 만질 때" 를 재개 트리거로 명시하며 유예를 유지해 왔다. 지금도 그 상태
    그대로다 — 새로운 위험 증가는 없다.
  - 제안: 조치 불필요(기존 유예 유지). 다음에 이 파일들 중 하나를 개별적으로 만질 기회가
    생기면 이름을 통일하는 후속 정리를 고려.

## 확인된 정상 항목 (재검증)

- 1R W3(`withFiles`/`withFixture` 중복) — `nullable-type-lie-cast.spec.ts:36-53` 에서
  `withFiles` 가 다중 파일을 받는 단일 구현이고, `withFixture`(55-58)는 그 얇은 래퍼로
  유지되고 있다. 재발 없음.
- 7R W1(JSDoc orphan) — `masked-reject-callers.spec.ts:11-24`(`.spec.ts` 배선을 설명하는
  JSDoc)이 바로 아래 `describe('스캔 대상에 \`.spec.ts\` 가 포함된다', …)`(25줄)를, `:45-61`
  (Manual 실행 경로 JSDoc)이 `describe('resolveTriggerParameters 직접 호출부 허용목록', …)`
  (62줄)를 각각 정확히 가리키고 있음을 직접 읽어 확인. 재발 없음.
- `source-scan.ts`/`source-scan.spec.ts`/`nullable-type-lie-cast-guard.ts`/`.spec.ts` 전체 —
  함수 길이·중첩 깊이 모두 관리 가능한 수준(가장 긴 함수도 30줄 내외, 중첩은 최대 2~3단).
  신규 함수(`collectTsFiles`, `stripLiterals`, `widenedEntityFields`, `findStaleSpecCasts`)
  전부 "왜 필요한가/왜 오탐이 없는가/한계" 절을 갖춘 JSDoc 을 일관되게 달아 이 저장소가
  확립한 "주석이 판단 기록" 관례를 유지한다. `WIDENED_DECL` 정규식의 "추가 데코레이터
  1개까지" 한계도 docstring `## 한계` 절에 명시돼 있다.
- 4개 가드(`audit-action-binding-guard.ts`·`engine-error-code-anchor-guard.ts`·
  `masked-reject-callers-guard.ts`·`redis-fail-open-catalog-guard.ts`)의 walker 치환은
  전부 `readdirSync` 기반 로컬 구현을 `collectTsFiles(...)` 한 줄 호출로 바꾸는 기계적
  치환이며, import 정리(불필요해진 `fs` 제거)도 실제 사용 여부와 일치한다.

## 요약

핵심 변경(`repo-guards/__tests__/` 5곳의 walker 사본을 `common/__test-utils__/source-scan.ts`
의 `collectTsFiles` 로 통합 + 넓혀진 nullable 필드를 겨눈 낡은 `.spec.ts` 캐스트를 잡는
`widenedEntityFields`/`findStaleSpecCasts` 신규 가드 추가)은 7라운드 리뷰를 거치며 유지보수성
관점에서 이미 매우 견고해진 상태이고, 이번 재검토에서도 CRITICAL·WARNING 급 새 결함은 없다.
앞선 라운드가 조치했다고 기록한 두 항목(픽스처 헬퍼 중복, JSDoc orphan)이 실제로 코드에
반영돼 있음을 직접 재확인했다. 새로 남긴 것은 INFO 1건뿐이다 — 같은 파일 안에서 "1단 균형
괄호" 정규식 조각이 기존 `COLUMN_DECL` 과 신규 `WIDENED_DECL` 사이에 리터럴로 세 번
반복되는데, 세 매칭 대상이 서로 달라 단순 추출로는 못 합치는 성격이라 지금 손댈 필요는
없다. 나머지 하나(래퍼 4종 이름 불일치)는 여러 라운드에 걸쳐 이미 판단·유예된 항목의
재확인일 뿐 새 위험이 아니다.

## 위험도

LOW
