# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 임시 픽스처 디렉터리 헬퍼가 같은 파일 안에서 거의 동일하게 두 번 구현됨 (신규 코드가 기존 패턴을 재사용하지 않고 복제)
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:188-204` (신규 `withFiles`) vs 같은 파일 `:109-118` (기존 `withFixture`, 이번 diff 밖)
  - 상세: 두 헬퍼 모두 "`os.tmpdir()` 에 `mkdtempSync` → 파일 write → try/finally 로 `rmSync`" 라는 동일한 골격이다. 차이는 `withFixture` 가 파일 1개(고정 이름 `probe.entity.ts`)만 다루고 `withFiles` 는 `Record<string, string>` 으로 여러 파일을 다룬다는 점뿐이다. `withFixture(content, fn)` 를 `withFixture(files: Record<string,string>, fn)` 형태로 일반화했으면 신규 `withFiles` 전체가 불필요했다. 두 헬퍼가 앞으로 각각 독립적으로 수정되면(예: cleanup 로직 변경) 한쪽만 고쳐지고 나머지가 뒤처지는 비대칭이 재발할 수 있다 — 이 리뷰 대상 diff 자체가 "walker 사본 5개" 를 하나로 합친 리팩터인데, 같은 diff 안에서 그와 유사한 종류의 복제를 새로 만든 셈이다.
  - 제안: 기존 `withFixture` 를 다중 파일을 받도록 일반화하고 `withFiles` 는 제거. 단일 파일 호출부는 `withFixture({ 'probe.entity.ts': content }, ...)` 형태로 맞추면 된다.

- **[INFO]** `WIDENED_DECL` 상수명이 실제 매칭 범위보다 좁게 읽힌다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:134-135`
  - 상세: 정규식 자체는 `@Column`/`@ManyToOne`/`@OneToOne` 데코레이터가 붙은 **모든** 필드 선언(넓혀졌는지 여부 무관)에 매치된다. "widened" 필터링은 그 다음 줄 `widenedEntityFields` 의 `if (tsType.includes('| null')) out.add(field);` 에서 별도로 이뤄진다. 이름만 보면 이 정규식 자체가 이미 nullable 로 넓혀진 선언만 고른다고 오해하기 쉽다. 이 파일의 다른 상수(`COLUMN_DECL`, `COLUMN_NAME`)는 "무엇을 잡는지" 를 이름이 정확히 반영하고 있어서 이 상수만 국소적으로 어긋난다.
  - 제안: `COLUMN_OR_RELATION_DECL` 등 매칭 범위 그대로를 나타내는 이름으로 바꾸거나, 최소한 상수 바로 위 주석에 "이 정규식 자체는 nullable 여부를 가리지 않는다 — 필터링은 호출부에서" 를 한 줄 추가.

- **[INFO]** `WIDENED_DECL` 이 데코레이터 개수 제약(추가 데코레이터 최대 1개)을 갖는데, 이 파일의 다른 정규식들과 달리 그 한계가 docstring 에 적혀 있지 않다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:128-135` (docstring + 상수)
  - 상세: `(?:\s*@\w+\((?:[^()]|\([^()]*\))*\)\s*\n)?` 부분은 `@Column`/`@ManyToOne`/`@OneToOne` 뒤에 **추가 데코레이터가 최대 1개**까지만 있는 경우를 허용한다(예: `@ManyToOne` + `@JoinColumn` 조합). 필드에 데코레이터가 2개 더 붙으면(`@Column` + `@Index` + `@Something`) 이 정규식은 매치에 실패해 해당 필드가 `widenedEntityFields` 결과에서 조용히 빠진다. 이 파일의 다른 정규식(`stripLiterals`, `countRawUpdateReturning`, `COLUMN_DECL` 등, 그리고 형제 파일 전반)은 정규식의 한계를 JSDoc `## 한계` 섹션으로 명시하는 것이 이 저장소의 확립된 관례인데, `WIDENED_DECL` 만 그 관례를 따르지 않는다.
  - 제안: 기존 관례대로 "추가 데코레이터 1개까지만 지원, 2개 이상은 미탐지(→ 결과적으로 낡은 캐스트를 놓칠 수 있음)" 를 docstring 에 적어 다음 사람이 재발견하지 않게 한다.

- **[INFO]** DRY 리팩터 이후에도 동일한 한 줄 래퍼가 4개의 서로 다른 이름으로 남아 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:47-49` (`collectSourceFiles`), `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:48-52` (`listSourceFiles`), `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:38-40` (`collectScanTargets`), `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts:93-95` (`listProductionSources`) — 그리고 `engine-error-code-anchor-guard.ts:157` 는 래퍼 없이 `collectTsFiles` 를 직접 호출한다.
  - 상세: 이번 diff 는 "walker 로직" 자체의 중복(readdirSync 재귀)은 `collectTsFiles` 하나로 성공적으로 걷어냈다. 다만 각 가드 파일에 남은 한 줄짜리 래퍼 함수는 이름이 전부 다르다(`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`) — 지금은 전부 `collectTsFiles` 를 그대로 전달하는 동의어다. 각 가드의 spec 이 그 이름을 이미 참조하므로 diff 범위에서 통일하지 않은 것은 합리적인 선택이지만, 다음에 이 코드를 보는 사람은 네 함수가 서로 다른 로직을 가진다고 오인하기 쉽다(실제로 리팩터 전에는 각기 미묘하게 달랐다 — 그래서 plan 문서가 "다섯 사본" 표를 남겨 뒀다).
  - 제안: 지금 당장 통일할 필요는 없지만(각 파일 상단 docstring 이 `collectTsFiles` 위임임을 이미 명시하고 있어 실질적 위험은 낮음), 다음에 이 파일들을 만질 때 래퍼 이름도 `collectSourceFiles` 한 가지로 맞추는 후속 정리를 고려할 만하다.

## 요약

이번 diff 의 핵심은 `repo-guards/__tests__/` 5곳에 흩어져 있던 디렉터리 재귀 walker 를 `source-scan.ts` 의 `collectTsFiles` 하나로 합친 것과, 그 위에 "넓혀진 nullable 필드를 겨눈 낡은 `.spec.ts` 캐스트" 를 잡는 새 가드(`widenedEntityFields`/`findStaleSpecCasts`)를 추가한 것이다. 전반적으로 유지보수성 관점에서 우수하다 — 중복 제거가 실제 동작 불변(리팩터 전후 파일 목록 집합 동일)을 실측으로 검증했고, 새 함수마다 "왜 필요한가/왜 오탐이 없는가/한계는 무엇인가" 를 다루는 JSDoc 이 이 저장소의 확립된 문서화 관례를 일관되게 따른다. 테스트도 대조군·전제(premise) 단언·저장소 전수 검증을 갖춰 vacuous 하지 않다. 발견된 항목은 전부 경미하다: 새로 추가된 spec 헬퍼(`withFiles`)가 같은 파일의 기존 헬퍼(`withFixture`)를 일반화하지 않고 거의 동일한 로직을 다시 구현했고(WARNING), `WIDENED_DECL` 정규식은 이름이 실제 매칭 범위보다 좁게 읽히며 이 파일의 다른 정규식들과 달리 한계(추가 데코레이터 1개 제약)가 docstring 에 적혀 있지 않다(INFO), 그리고 통합된 `collectTsFiles` 위에 남은 4개의 서로 다른 이름의 한 줄 래퍼가 다음 독자에게는 서로 다른 로직처럼 보일 수 있다(INFO). 코드를 바꾸지 않고 넘어가도 무방한 수준이나, 다음에 이 파일들을 만질 기회가 있으면 함께 정리할 만하다.

## 위험도

LOW
