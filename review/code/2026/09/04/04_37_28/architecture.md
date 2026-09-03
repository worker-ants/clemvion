# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `collectTsFiles` 등 공유 primitive 모듈이 production `dist` 에 포함되지만, 실제 소비처는 전부 build-exclude 대상이다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:1-22` (파일 헤더 docstring), 소비처는 `codebase/backend/src/repo-guards/__tests__/*.ts`(전체가 `tsconfig.build.json` `exclude: "src/repo-guards/**"`)와 `*.spec.ts`(`exclude: "**/*spec.ts"`)
  - 상세: `common/__test-utils__/source-scan.ts` 자신은 `tsconfig.build.json` 의 제외 목록에 들지 않아 `nest build` 산출물(`dist/`)에 그대로 포함된다. 그런데 이 diff 로 여기에 새로 옮겨온/추가된 함수(`collectTsFiles`·`stripComments`·`stripLiterals`·`countCalls`·`countRawUpdateReturning`·`countNullAsUnknownAsCasts` 등)의 **실제 호출부는 전부** `src/repo-guards/__tests__/**`(빌드 제외) 또는 `*.spec.ts`(빌드 제외)뿐이다 — 즉 프로덕션 런타임에는 죽은 코드가 실려 나간다. 파일 자체 docstring 이 이 트레이드오프를 이미 인지·명시하고 있고("build tsc 가 `__test-utils__` 를 컴파일하므로 의도적으로 순수 함수만 둔다"), 실제로 `node:fs`/`node:path` 외 devDependency 를 import 하지 않아 `repo-guards`/`shared/testing` 제외의 근본 이유(devDependency 가 dist 에 실려 프로덕션 설치에서 `require` 가 깨지는 것)에는 해당하지 않는다. 따라서 결함이라기보다는 "테스트 전용 로직이 프로덕션 레이어 경계(`common/`) 안에 물리적으로 위치한다"는 층위 비대칭이며, 이미 자매 디렉토리(`workspace-id-fixtures.ts` 등) 2곳과 동일한 기존 관례를 그대로 따른 것이다.
  - 제안: 현재로선 조치 불필요(순수 함수라 실피해 없음, 선행 리뷰 라운드에서 이미 검토된 트레이드오프). 다만 향후 이 파일에 devDependency 를 import 하는 함수가 추가되는 순간 `src/repo-guards/**` 와 같은 사고가 재발하므로, 그 시점엔 이 파일도 `tsconfig.build.json` exclude 에 추가하거나 devDependency-free 를 유지하는 규율을 계속 지켜야 한다.

- **[INFO]** 범용 스캔 primitive 와 두 개의 매우 도메인-특정적 predicate 가 한 모듈에 공존한다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` — `collectTsFiles`/`stripComments`/`stripLiterals`/`countCalls`(범용) vs `countRawUpdateReturning`(raw SQL UPDATE/DELETE RETURNING 전용) · `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`(nullable-cast 전용)
  - 상세: "구조적 회귀 가드가 소스를 세는·모으는 방식의 단일 출처"라는 모듈 존재 이유(§"왜 공유하나") 자체가 "세는 축"과 "모으는 축"을 하나로 모으겠다는 명시적 설계라, 완전히 근거 없는 결합은 아니다. 다만 `countRawUpdateReturning`(raw-update-returning-rows 가드 전용)·`countNullAsUnknownAsCasts`(nullable-type-lie-cast 가드 전용)는 각각 정확히 1~2개 소비처만 갖는 매우 좁은 도메인 predicate 라서, 파일이 늘어날수록 "범용 유틸 + 그때그때 붙는 전용 predicate" 형태의 준-junk-drawer 로 흘러갈 위험이 있다. 다섯 사본 walker 를 하나로 합친 이번 diff 의 방향성과는 별개 축이다.
  - 제안: 지금 단계(전용 predicate 2개)에서는 분리 비용이 이득보다 크므로 액션 불필요. predicate 종류가 3~4개를 넘어서면 `source-scan.ts` 를 "파일 수집/텍스트 정제"(범용)와 "가드별 판정 predicate"(도메인) 두 파일로 쪼개는 것을 고려할 시점이라는 판단 기준만 남겨 둔다.

## 요약

이번 diff 의 핵심은 `repo-guards/__tests__/` 아래 5개 가드가 각자 갖고 있던 `.ts` 파일 재귀 수집 로직(`collectSourceFiles`·`walkTsFiles`·`listSourceFiles`·`collectScanTargets`·`listProductionSources`)을 `common/__test-utils__/source-scan.ts` 의 `collectTsFiles` 하나로 합친 DRY 리팩터다. 축 4개(`.spec.ts` 제외·`.d.ts` 제외·`node_modules`/`dist` skip·`sort()`) 중 실제로 살아있는 축을 실측으로 가려내고, 유일하게 살아있는 `.spec.ts` 축만 `CollectTsFilesOptions.includeSpec` 옵션으로 노출한 설계는 과도한 파라미터화 없이 필요한 만큼만 추상화한 좋은 예다. 의존 방향은 `repo-guards`/`common/utils/*.spec.ts` → `common/__test-utils__` 단방향이라 순환 참조가 없고, "파서 순수 로직 / 소비 spec 분리"라는 형제 가드들의 기존 관례를 신규 가드(`nullable-type-lie-cast-guard.ts`)와 신규 유틸에도 일관되게 적용했다. 공유화로 인해 `collectTsFiles` 결함이 5개 가드에 동시에 번질 수 있는 blast-radius 확대는 있으나, 전용 spec 파일(`source-scan.spec.ts`)이 `.spec.ts`/`.d.ts`/vendor-skip/정렬 축을 정렬 분기까지 관측 가능한 픽스처로 각각 단언해 충분히 상쇄한다. `withFiles`/`withFixture` 픽스처 헬퍼 통합, `stripLiterals` 전용 테스트 추가 등 이전 리뷰 라운드(8R)에서 지적된 항목들도 diff 안에 반영되어 있다. 남은 것은 테스트 전용 로직이 빌드 제외 대상이 아닌 `common/` 레이어에 물리적으로 위치한다는 비대칭과, 범용 유틸/도메인 predicate 공존에 따른 경미한 응집도 저하뿐이며 둘 다 즉각 조치가 필요한 결함은 아니다.

## 위험도

LOW
