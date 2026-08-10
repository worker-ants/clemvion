# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 디렉터리 트리 순회(스택 기반 walk) 로직이 3벌로 중복됐다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:43-70` (`walkPlanMarkdown`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:132-152` (`collectSpecMarkdown`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:320-344` (`collectCodebaseSources`)
  - 상세: 세 함수 모두 "스택에 dir push → pop → `readdirSync(withFileTypes)` → 디렉터리면 조건부 push, 파일이면 조건부 push, 끝나면 `relPath.localeCompare` 로 정렬" 이라는 동일한 골격을 반복한다. `plan-scan.ts` 상단 주석 자체가 "손으로 순회하는 walker 가 저장소에 네 벌 있었고 서로 접두 처리가 달랐다"는 과거 실패를 설명하며 이번 PR 에서 plan 트리 walker 2벌을 `walkPlanMarkdown` 하나로 합쳤다고 밝히는데, 정작 spec 트리(`collectSpecMarkdown`)·codebase 소스 트리(`collectCodebaseSources`) walker 는 여전히 별도 구현으로 남아 있어 "네 벌 → 세 벌" 로 줄었을 뿐 동일 패턴의 반복이라는 근본 문제는 재발 여지가 있다. recurse 옵션·skip 판정(`archive` vs `CODEBASE_SKIP_DIRS` vs 없음)·파일 확장자 필터만 다르므로 공통 스켈레톤을 뽑아 파라미터화할 수 있는 형태다.
  - 제안: `walkTree(root, { skipDir(name), includeFile(name) })` 같은 공용 순회 헬퍼로 셋을 파생시키는 리팩터를 고려. 지금 당장 강제할 정도는 아니나, 향후 네 번째 walker 가 또 손으로 추가되는 것을 막으려면 스코프를 명시적으로 좁혀야 한다(이 PR 이 고치려는 "같은 실수의 재발" 패턴 그대로이므로).

- **[WARNING]** `SpecMdFile` 타입 이름이 "spec 이 아닌" 파일들(plan 문서, `.ts`/`.tsx` 코드 소스)까지 표현하도록 재사용된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:119-122` (인터페이스 정의), `spec-links.ts:320` (`collectCodebaseSources(): SpecMdFile[]` — 실제로는 `.ts`/`.tsx` 소스), `plan-scan.ts:73-80`→`spec-links.ts:291-295` (`findBrokenPlanLinks` 가 `PlanMdFile[]` 를 `findBrokenLinksInFiles(files: SpecMdFile[], ...)` 에 구조적 타이핑으로 통과)
  - 상세: `SpecMdFile`은 이름상 "spec markdown 파일"을 뜻하지만 `findBrokenLinksInFiles` 의 공유 파라미터 타입으로 격상되며 plan 문서(`PlanMdFile`, 구조는 동일하나 이름이 다른 별개 인터페이스)와 코드 소스 파일(마크다운도 아님)까지 이 이름으로 통과한다. 구조적 타이핑 때문에 컴파일은 되지만, 코드를 읽는 사람이 `collectCodebaseSources(): SpecMdFile[]` 시그니처만 보고 "spec 마크다운 파일 목록"으로 오독하기 쉽다.
  - 제안: 공유 파라미터/리턴 타입을 `MdFile`(또는 `SourceFile`) 같은 도메인 중립 이름으로 바꾸고, `SpecMdFile`은 실제로 spec markdown 만 다루는 좁은 용도로 한정.

- **[INFO]** `{ absPath, relPath }` 형태의 파일 레코드 인터페이스가 최소 3곳에서 독립적으로 재정의됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:24-27` (`PlanMdFile`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:119-122` (`SpecMdFile`), `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:31-37` (`SpecRecord`, 같은 두 필드를 포함한 상위집합)
  - 상세: 세 인터페이스가 구조적으로 동일한 `absPath`/`relPath` 쌍을 각자 선언한다. 지금은 문제없이 동작하지만(구조적 타이핑), 한쪽에서 필드를 늘리거나(`basename` 처럼) 이름을 바꿀 때 나머지가 조용히 갈라질 위험이 있다.
  - 제안: 공용 `interface MdFileRef { absPath: string; relPath: string }` 를 한 곳(예: `plan-scan.ts` 또는 별도 `md-file.ts`)에 두고 나머지가 `extends`/재사용하도록 정리하면 "같은 개념이 파일마다 다른 이름"이라는 drift 여지를 없앨 수 있다. 필수는 아니고 다음 손댈 때 정리해도 무방.

- **[INFO]** 완료-plan 최소 개수 하한 `5` 가 세 테스트에 하드코딩되어 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:72`, `:158`, `:170` (`toBeGreaterThan(5)`)
  - 상세: 각 자리에 "discovery 가 죽으면 vacuous 해지는 걸 막는 하한"이라는 취지 주석이 붙어 있어 의도는 명확하지만, 동일한 매직 넘버 `5` 가 세 곳에 흩어져 있어 향후 하한 기준을 바꿀 때(예: 6으로) 한 곳을 놓치기 쉽다.
  - 제안: `const MIN_EXPECTED_PLANS = 5;` 같은 이름 있는 상수로 모아 세 자리에서 참조하면 의도 전달과 일괄 변경 모두 쉬워진다.

- **[INFO]** `walkPlanMarkdown` 의 `bucket` 매개변수가 원시 `string` 으로 열려 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:45`
  - 상세: 실제 호출부는 `"in-progress"` / `"complete"` 두 리터럴만 넘긴다(`plan-scan.ts:74`, `:79`). `bucket: string` 으로 두면 오타(`"in-progres"` 등)가 나도 타입 시스템이 잡아주지 못하고 `walkPlanMarkdown` 이 조용히 빈 배열을 반환한다.
  - 제안: `bucket: "in-progress" | "complete"` 로 좁혀 오타를 컴파일 타임에 잡는다.

- **[INFO]** `decodeAnchor` 헬퍼가 사용부보다 한참 뒤(파일 최하단)에 정의되어 있다
  - 위치: 정의 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:362-368`, 사용 `spec-links.ts:207`, `:238`
  - 상세: 함수 선언이 호이스팅되어 동작에는 문제없으나, `findBrokenLinksInFiles` 를 위에서 아래로 읽을 때 `decodeAnchor` 가 무엇인지 파일 끝까지 가야 확인할 수 있어 국소적 가독성이 떨어진다.
  - 제안: `headingSlugs`/`slugify` 근처(같은 "slug 계산" 관심사) 로 옮기면 관련 헬퍼가 한데 모인다. 사소한 정리라 급하지 않음.

## 요약

이번 변경은 plan 라이프사이클 검사 로직(`plan-scan.ts`)을 별도 순수 함수 모듈로 추출하고, 합성 fixture 로 negative-path 를 실제로 증명하는 테스트(`plan-scan.test.ts`)를 추가했으며, 기존 `plan-frontmatter.test.ts`/`spec-links.ts` 가 그 단일 구현을 공유하도록 정리한 리팩터다. 각 함수가 짧고 단일 책임을 지키고, 네이밍이 목적을 잘 드러내며, 왜 이런 구조가 됐는지(과거 실패 사례·트레이드오프)를 설명하는 주석이 이례적으로 충실해 향후 유지보수자가 "왜"를 다시 조사할 필요가 적다. 매직 넘버나 과도한 중첩·순환 복잡도 같은 심각한 문제는 없다. 다만 스택 기반 디렉터리 순회 골격이 두 파일에 걸쳐 3벌 반복되고 있는 점, 그리고 `SpecMdFile` 타입이 spec 이 아닌 대상(plan 문서·코드 소스)까지 구조적 타이핑으로 흘러들어가는 점은 이 PR 이 스스로 경계하는 "같은 로직이 여러 곳에서 조용히 갈라진다"는 실패 패턴과 같은 종류이므로, 다음 손댈 때 공용 헬퍼/타입으로 한 번 더 수렴시키는 것을 권한다.

## 위험도
LOW
