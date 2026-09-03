# 아키텍처(Architecture) 리뷰

## 메모 — 이 changeset 은 이미 9라운드 리뷰를 거쳤다

`review/code/2026/09/04/{01_48_39 ~ 04_37_28}/` 는 같은 두 작업(① `repo-guards/__tests__/` 5개
walker 사본을 `common/__test-utils__/source-scan.ts` 의 `collectTsFiles` 로 통합, ②
`| null` 로 넓혀진 엔티티 필드를 겨눈 낡은 `.spec.ts` 캐스트를 잡는 `nullable-type-lie-cast-guard.ts`
신설)에 대한 이전 라운드 산출물이다. 아키텍처 관점은 `02_35_22`·`02_57_22`·`03_17_44`·`03_37_37`·
`04_37_28` 5회 이미 수행됐고 직전(`04_37_28`)은 INFO 2건·위험도 LOW 로 수렴했다. 9R 조치
(커밋 `34ce41086`)는 `nullable-type-lie-cast.spec.ts` 의 중복 저장소 스캔 제거(단일 스캔 후
`.filter()` 파생)와 plan 체크박스 동기화뿐이라 아키텍처 표면을 바꾸지 않는다.

이번 라운드는 그 결론을 재사용하지 않고 `source-scan.ts`·`nullable-type-lie-cast-guard.ts`·
`nullable-type-lie-cast.spec.ts`와 4개 소비 가드 헤더를 직접 다시 읽어 독립 재검증했다. 새로
발견된 것은 없다 — 아래는 직전 라운드가 남긴 INFO 2건의 유효성 재확인과, 재확인 과정에서 함께
짚을 만한 INFO 1건(래퍼 명명 비대칭, 이전 라운드에서도 이미 유예 확정된 항목)이다.

## 발견사항

- **[INFO]** (재확인, 04_37_28 에서 최초 지적) 테스트 전용 primitive(`collectTsFiles` 등)가 build-exclude 되지 않는 `common/` 레이어에 물리적으로 위치한다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` 1~22 (파일 헤더 docstring)
  - 상세: `source-scan.ts` 자신은 `tsconfig.build.json` exclude 대상이 아니라 `nest build` 산출물(`dist/`)에 포함된다. 그런데 이 모듈이 내보내는 함수의 실제 소비처는 전부 `src/repo-guards/__tests__/**`(exclude 대상)와 `*.spec.ts`(exclude 대상)뿐이다 — 즉 프로덕션 런타임 관점에서는 죽은 코드가 dist 에 실려 나간다. 파일 자신의 docstring 이 "build tsc 가 `__test-utils__` 를 컴파일하므로 의도적으로 순수 함수만 둔다"고 트레이드오프를 이미 인지하고 있고, `node:fs`/`node:path` 외 devDependency 를 import 하지 않아 `repo-guards` exclude 의 근본 이유(devDependency 가 dist 에 실려 프로덕션 설치에서 `require` 가 깨지는 것)에는 해당하지 않는다. 자매 디렉토리(`workspace-id-fixtures.ts` 등)와 동일한 기존 관례를 그대로 따른 것이라 이번 diff 가 새로 만든 문제는 아니다.
  - 제안: 조치 불필요(순수 함수라 실피해 없음). devDependency 를 import 하는 함수가 이 파일에 추가되는 순간 재평가할 것 — 그 시점엔 `tsconfig.build.json` exclude 추가가 필요해진다.

- **[INFO]** (재확인, 04_37_28 에서 최초 지적) 범용 스캔 primitive 와 도메인-특정 predicate 가 한 모듈에 공존한다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` — `collectTsFiles`/`stripComments`/`stripLiterals`/`countCalls`(범용) vs `countRawUpdateReturning`(raw SQL 가드 전용, 소비처 1) · `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`(nullable-cast 가드 전용, 소비처 2)
  - 상세: 모듈 존재 이유(§"왜 공유하나")가 "세는 축"·"모으는 축"을 한곳에 모으겠다는 명시적 설계라 근거 없는 결합은 아니다. 다만 좁은 도메인 predicate 가 하나둘 더 붙을수록 "범용 유틸 + 그때그때 붙는 전용 predicate" 형태의 준-junk-drawer 로 흘러갈 위험은 여전하다. 이번 라운드에서 재확인한바 predicate 개수는 직전 라운드(2개)에서 늘지 않았다.
  - 제안: 지금 단계에서는 분리 비용이 이득보다 크므로 액션 불필요. predicate 종류가 3~4개를 넘어서면 "파일 수집/텍스트 정제"(범용)와 "가드별 판정 predicate"(도메인) 두 파일로 쪼개는 것을 고려할 시점이라는 판단 기준만 유지.

- **[INFO]** (재확인, 앞선 라운드에서 유예 확정) `collectTsFiles` 를 위임하는 1줄 래퍼 함수 이름이 소비 가드마다 다르다
  - 위치: `audit-action-binding-guard.ts:47-48`(`collectSourceFiles`) · `masked-reject-callers-guard.ts:48-52`(`listSourceFiles`) · `nullable-type-lie-cast-guard.ts:38-40`(`collectScanTargets`) · `redis-fail-open-catalog-guard.ts:93-94`(`listProductionSources`) · `engine-error-code-anchor-guard.ts:157`(래퍼 없이 `collectTsFiles` 직접 호출)
  - 상세: walker "로직"의 중복은 `collectTsFiles` 로 성공적으로 제거됐지만, 그 위에 남은 이름표는 통일되지 않았다. 지금은 전부 `collectTsFiles` 의 동의어인데도 이름만 보면 서로 다른 로직처럼 읽힌다. 각 가드의 spec 이 이미 그 이름을 참조하고 있어 통일하려면 5개 가드의 공개 표면을 동시에 건드리는 별건이 된다는 점도 이전 라운드가 이미 짚었다.
  - 제안: 지금 changeset 범위에서 조치 불필요 — 다음에 이 파일들을 개별적으로 만질 기회가 있을 때 통일을 고려.

## 요약

이 diff 의 아키텍처 핵심은 두 가지다. (1) `repo-guards/__tests__/` 5곳에 흩어져 있던 재귀
디렉터리 walker(`collectSourceFiles`·`walkTsFiles`·`listSourceFiles`·`collectScanTargets`·
`listProductionSources`)를 `common/__test-utils__/source-scan.ts` 의 `collectTsFiles` 하나로
합친 DRY 리팩터, (2) "파서 순수 로직(`*-guard.ts`) / 소비 spec(`*.spec.ts`) 분리"라는 형제
가드들의 기존 관례를 그대로 따른 신규 가드(`nullable-type-lie-cast-guard.ts`)의 추가다. 의존
방향은 `repo-guards/**`·`common/*.spec.ts` → `common/__test-utils__` 단방향이고 역방향 참조는
없어 순환 의존이 없다. `collectTsFiles` 의 `includeSpec` 옵션은 실측으로 가려낸 유일하게 살아있는
축만 노출해 과도한 파라미터화를 피했고, `widenedEntityFields` 가 계산한 `Set<string>` 을
`findStaleSpecCasts` 에 인자로 주입하는 형태는 순수 함수 간 명시적 의존성 전달(암묵적 전역 상태
없음)이라 DIP 관점에서 무난하다. 이름 매칭만으로 넓혀진 필드를 판정하는 설계(엔티티·필드 쌍이
아니라 필드명 단위)는 두 라운드(2R)를 거쳐 "동명이지만 다른 엔티티에서 non-null" 충돌 20건을
실측하고 그 이름들을 판정 대상에서 제외하는 방식으로 오탐을 없앴다 — 재현율을 낮추는 대가로
건전성을 택한 트레이드오프이며 근거가 docstring 과 대조군 테스트에 함께 남아 있다. 공유화로
인해 `collectTsFiles` 결함이 5개 가드에 동시에 번질 수 있는 blast-radius 확대는 있으나 전용
`source-scan.spec.ts` 가 `.spec.ts`/`.d.ts`/vendor-skip/정렬 축을 각각 관측 가능한 픽스처로
단언해 상쇄한다. 남은 것은 이전 라운드부터 이어진 INFO 3건 — 테스트 전용 로직이 build-exclude
대상이 아닌 `common/` 레이어에 위치하는 비대칭, 범용 유틸/도메인 predicate 공존에 따른 경미한
응집도 저하, 1줄 위임 래퍼 4종의 이름 불일치 — 이며 셋 다 즉각 조치가 필요한 결함은 아니고
이전 라운드에서 이미 근거를 갖고 유예가 확정된 항목들이다. 이번 라운드의 유일한 코드 변경(9R,
중복 스캔 제거)은 아키텍처 표면에 영향이 없다.

## 위험도

LOW
