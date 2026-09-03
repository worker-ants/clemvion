# 테스트(Testing) 리뷰

## 컨텍스트

이 changeset 은 이미 8라운드 리뷰-수정 루프(`review/code/2026/09/04/01_48_39` ~ `04_18_01`)를
거쳤고, 이번이 9번째 라운드다. 직전 라운드(8R)까지 테스트 관점 Warning 은 전부 조치됐다는
`RESOLUTION.md` 기록을, 코드를 직접 읽고 `nullable-type-lie-cast.spec.ts` ·
`source-scan.spec.ts` · `masked-reject-callers.spec.ts` 및 `repo-guards/__tests__/` 전체
(8스위트)를 재실행해 독립적으로 재확인했다 — **147/147 통과**(source-scan 포함 3스위트는
80/80). 아래는 그 위에서 새로 찾은 항목만 적는다.

## 발견사항

- **[INFO]** `findStaleSpecCasts` 가 따옴표로 감싼 객체 키(`'widenedAt': null as unknown as Date`)에서는 필드명을 놓친다 — `stripLiterals` 가 키의 따옴표 내용까지 `''` 로 지워 버려 `SPEC_CAST` 정규식의 `(\w+)\s*:` 앞에 식별자가 남지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` — `stripLiterals`(공유 정의는 `codebase/backend/src/common/__test-utils__/source-scan.ts` 의 `export function stripLiterals`) 와 `SPEC_CAST`/`findStaleSpecCasts` 조합
  - 상세: 직접 재현 확인함(`node -e`) — `stripLiterals("const f = { 'widenedAt': null as unknown as Date };")` → `"const f = { '': null as unknown as Date };"`. 이 상태에서는 `SPEC_CAST` 가 매치할 `(\w+)` 이 없어 offender 로 잡히지 않는다. 이 가드가 명시적으로 경계하는 실패 모드가 정확히 "위음성(조용한 누락)"인데(`isNullableType` docstring 이 같은 이유로 표기 변형까지 캐너리를 둔 것과 대비된다), 이 지점만 커버리지가 없다. 다만 `grep -rnE "['\"]\w+['\"]\s*:\s*(null|undefined)\s+as\s+unknown\s+as"` 로 저장소 전수를 확인한 결과 현재 이 패턴은 **0건**이라 지금 당장 결함이 발현하지는 않는다(TypeORM 컬럼명이 전부 유효 식별자라 spec fixture 도 보통 unquoted key 를 쓰는 관례와 일치).
  - 제안: `WIDENED_DECL`/`isNullableType` 급의 캐너리 하나(예: `it.each` 로 quoted-key 케이스 1건)를 추가해 이 경계를 테스트로 고정하거나, 최소한 `findStaleSpecCasts`/`stripLiterals` docstring 에 "quoted key 는 놓친다"를 한계로 명시. 지금 저장소에 이 형태가 없으므로 급하지 않지만, `WIDENED_DECL` 의 "데코레이터 1개까지만"(INFO#1, 8R) 과 같은 급의 미고정 위음성 경계다.

- **[INFO]** `SPEC_CAST` 를 겨눈 fixture 가 전부 단일 줄이라 여러 줄에 걸친 캐스트(`widenedAt:\n  null as unknown as Date,`)가 실제로 잡히는지는 테스트로 확정되지 않았다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` — `describe('넓혀진 필드를 겨눈 낡은 spec 캐스트', ...)` 내 fixture 들(`'const f = { widenedAt: null as unknown as Date };\n'` 형태 전부 한 줄)
  - 상세: `SPEC_CAST` 정규식의 `\s+`/`\s*` 는 개행을 포함하므로 동작 자체는 될 것으로 보이나(정적 판단), 실제 캐너리로 고정된 적은 없다. `prettier`/`eslint --fix` 가 긴 표현식을 여러 줄로 접는 사례가 이 changeset 안에서 이미 두 번(`withFixture` 의 "여러 줄 데코레이터" 캐너리, `isNullableType` 도입 배경) 실제 사고로 등장했던 것과 같은 축이다.
  - 제안: `it.each` 한 줄만 추가해 여러 줄 캐스트 fixture 를 캐너리로 남기면 이 경계가 "정적 판단"에서 "실측"으로 바뀐다. 필수는 아님 — 위와 마찬가지로 지금 저장소 전수에서 발현하지 않는다.

## 강점 (참고용, 조치 불필요)

- **Mock 미사용, 실제 fs + tmpdir**: `node:fs` 의 non-configurable 프로퍼티 문제로 spy 를 포기하고 `mkdtempSync` 기반 실파일 픽스처로 전환한 것(`source-scan.spec.ts` 상단 주석, `withFiles`/`withFixture` 통합)이 명시돼 있다 — mock 과 실제 동작의 괴리 위험이 구조적으로 낮다.
- **테스트 격리**: 모든 픽스처가 `os.tmpdir()` 하위 고유 디렉터리를 쓰고 `try/finally`(`afterEach` 포함)로 정리한다. 사본으로 흩어져 있던 `withFixture` 를 `withFiles` 로 통합하면서 단일 파일 호출부는 얇은 래퍼로 남겨 회귀 위험이 낮다.
- **엣지 케이스 매트릭스**: `| null` 표기 변형(공백 없음·순서 반대·표준)을 `widenedEntityFields` 와 `findUntypedNullableColumns` 양쪽에 대칭 `it.each` 로 고정했고(8R 에서 비대칭이 드러나 수정됨), `stripLiterals` 는 이스케이프 따옴표·다중 리터럴·알려진 한계(중첩 백틱)까지 개별 케이스로 갖춘다.
- **Vacuous-test 방지**: `masked-reject-callers.spec.ts` 의 "[전제] 허용목록이 `.spec.ts` 를 실제로 담고 있다", `nullable-type-lie-cast.spec.ts` 저장소 전수 블록의 "[전제] 엔티티·spec 대상이 비어 있지 않다"/"[전제] 넓혀진 필드가 실제로 있다" 는 모두 이 저장소가 이미 겪은 "GREEN 이 증거가 아니다" 실패 모드를 명시적으로 차단한다.
- **회귀 안전망**: `collectTsFiles` 도입이 다섯 사본을 대체하는 리팩터인데, plan 문서(`entity-nullable-column-type-mismatch.md`)에 리팩터 전후 파일 목록 집합 동일성을 실측(507/818/1261/818/818)으로 기록했고, `masked-reject-callers.spec.ts` 는 `includeSpec: true` 옵션이 빠져도 아무 테스트가 안 죽었던 실제 사각지대(6R)를 배선 캐너리로 직접 막아 뒀다.
- **테스트 용이성**: `widenedEntityFields`/`findStaleSpecCasts`/`collectTsFiles` 모두 파일 경로 배열을 인자로 받는 순수 함수라 fs 경계가 얕고, DI 없이도 실제 fs 기반 단위 테스트가 자연스럽다.

## 요약

핵심 신규 로직(`collectTsFiles`, `stripLiterals`, `widenedEntityFields`, `findStaleSpecCasts`,
`isNullableType`)은 정상 경로·표기 변형·이름 충돌·주석/리터럴 오탐 방지까지 이미 촘촘한
`it.each`/대조군 테스트로 덮여 있고, 8라운드에 걸쳐 실제 뮤테이션(정렬 회귀, 옵션 배선,
자매 함수 비대칭)으로 검증된 이력이 코드·plan 문서에 남아 있다. 직접 재실행한 결과도
전부 GREEN(repo-guards 8스위트 147/147)이라 회귀 없음을 확인했다. 이번 라운드에서 새로
찾은 것은 `findStaleSpecCasts` 의 quoted-key 위음성과 멀티라인 캐스트 미검증 두 가지뿐이며,
둘 다 저장소 전수에서 현재 미발현(grep 으로 확인)이라 결함이 아니라 **아직 캐너리로
고정되지 않은 경계**다 — `WIDENED_DECL` 의 "데코레이터 1개까지만" 한계와 같은 급이라
INFO 로 남긴다. Critical/Warning 급 갭은 발견하지 못했다.

## 위험도

LOW
