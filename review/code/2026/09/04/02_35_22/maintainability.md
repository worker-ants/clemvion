# 유지보수성(Maintainability) 리뷰

## 개요

이번 변경은 `repo-guards/__tests__/` 5개 가드에 **5번 복제됐던 디렉터리 워커**를
`source-scan.ts`의 `collectTsFiles()` 하나로 통합하고(DRY), `nullable-type-lie-cast-guard.ts`에
넓혀진(nullable) 엔티티 필드를 겨눈 낡은 `.spec.ts` 캐스트를 탐지하는 새 술어
(`widenedEntityFields`/`findStaleSpecCasts`)를 추가한다. 이전 리뷰 라운드(1R/2R,
`review/code/2026/09/04/01_49_18/`, `02_12_38/`)에서 이미 W1~W4가 조치됐고 RESOLUTION.md에
근거가 기록돼 있음을 확인했다. 본 라운드에서는 그 위에 남은 지점만 추가로 점검했다.

## 발견사항

- **[INFO]** `| null` 유니온 판정이 부분 문자열 매칭이라 타입 표기 순서·공백에 취약하다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:172`
    (`(tsType.includes('| null') ? widened : nonNull).add(field);`, 함수 `widenedEntityFields`)
  - 상세: `tsType.includes('| null')`은 캡처된 타입 텍스트에 리터럴 부분 문자열 `"| null"`이
    있는지만 본다. 직접 확인한 결과 `'Date | null'.includes('| null')` → `true` 지만
    `'null | Date'.includes('| null')` → `false`, `'Date|null'.includes('| null')` → `false`다.
    즉 필드가 관례와 다르게 `null | Date` 순서로 선언되거나 공백 없이 `Date|null`로 선언되면
    `widenedEntityFields`가 그 필드를 "넓혀지지 않음"으로 오판(위음성)한다. 저장소를
    `grep -rn "null | " --include="*.entity.ts"`로 훑은 결과 현재는 전부 `Type | null` 순서라
    실제로 발현하지는 않지만, 이 취약점 자체는 근접 docstring(§"이름 충돌", §"추가 데코레이터")
    어디에도 문서화돼 있지 않다. 이 가드의 존재 이유가 "낡은 캐스트가 조용히 남는 것"을 막는
    것인데, 판정 로직 자체가 같은 방식(조용한 위음성)으로 새는 지점이다.
  - 제안: `tsType.split('|').map((s) => s.trim()).includes('null')`처럼 순서·공백에 무관한
    비교로 바꾸거나, 최소한 이 취약점을 `WIDENED_DECL` 위 docstring의 "한계" 절에 나란히
    적어 INFO#1(데코레이터 1개 제한)과 같은 급으로 추적되게 한다.

- **[INFO]** `WIDENED_DECL` 정규식이 단일 라인에 다섯 개 이상의 문법 요소를 압축하고 있어
  구조를 눈으로 따라가기 어렵다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:163-164`
    (`const WIDENED_DECL = /@(?:Column|ManyToOne|OneToOne)\(...\).../g;`)
  - 상세: 데코레이터 이름 대안, 괄호 균형 처리(1중첩), 개행, 선택적 2번째 데코레이터, 필드명
    캡처, 타입 캡처가 한 줄짜리 정규식 리터럴 안에 전부 들어 있다. 바로 위 docstring이
    맥락(왜/한계)은 잘 설명하지만, 정규식 자체의 각 부분이 무엇을 매칭하는지는 정규식을
    직접 해독해야 알 수 있다. `(?:...)*`로 확장하겠다고 이미 예고된 지점이라, 그때 가서
    한 줄 리터럴을 더 늘리면 가독성이 더 나빠진다.
  - 제안: 지금 당장 바꿀 필요는 없지만(기능 변경 아님), 확장 시점에 `RegExp` 생성자 +
    문자열 조각별 주석(예: `DECORATOR_HEAD`, `OPTIONAL_SECOND_DECORATOR`, `FIELD_DECL` 을
    상수로 나눠 `new RegExp(DECORATOR_HEAD + OPTIONAL_SECOND_DECORATOR + FIELD_DECL, 'g')`)로
    분해하는 것을 고려할 만하다.

- **[INFO]** 4개 가드 파일에 이름만 다른 `collectTsFiles` 1줄 래퍼가 남아 있다 — 이미 추적된
  의도적 유예이며 새 조치 불필요
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
    (`collectSourceFiles`) · `.../masked-reject-callers-guard.ts` (`listSourceFiles`) ·
    `.../nullable-type-lie-cast-guard.ts` (`collectScanTargets`) ·
    `.../redis-fail-open-catalog-guard.ts` (`listProductionSources`)
  - 상세: 네 함수 모두 본문이 `return collectTsFiles(...)` 한 줄뿐인데 이름이
    `collect*`/`list*`로 갈리고 대상 인자도 제각각이다(`repoRoot` vs `rootDir` vs `root` vs
    `srcDir`). `plan/in-progress/entity-nullable-column-type-mismatch.md`와
    `review/code/2026/09/04/01_49_18/RESOLUTION.md`를 확인한 결과 이 비대칭은 이번 라운드
    이전에 이미 지적됐고(W5 완료 서술 · RESOLUTION "래퍼 이름 4종 잔존") 각 가드의 호출부가
    이미 그 이름에 맞춰 쓰이고 있어 통합 비용 대비 이득이 낮다는 이유로 의도적으로 남겨둔
    것으로 보인다. 새 조치를 요구하지 않는다 — 기록 확인 목적으로만 남긴다.

- **[INFO]** `listSourceFiles`(masked-reject-callers-guard.ts)의 JSDoc이 새 동작(`.d.ts` 제외)을
  반영하지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` —
    `export function listSourceFiles(rootDir: string): string[]` 선언부 바로 위 주석
    (`/** \`src/\` 하위 \`.ts\` 전수 (node_modules·dist 제외). */`, diff 밖이라 게이트 없음)
  - 상세: 리팩터 전 `listSourceFiles`는 `.ts` 전체(즉 `.d.ts`·`.spec.ts` 포함)를 모았다.
    새 구현은 `collectTsFiles(rootDir, { includeSpec: true })`라 `.spec.ts`는 여전히
    포함하지만 `.d.ts`는 이제 항상 제외한다(현재 `src` 하위 `.d.ts` 0개라 동작 자체는
    inert — `source-scan.ts` docstring의 실측 표에 이미 근거가 있다). 다만 이 함수 바로 위
    주석 문구는 리팩터 전과 동일하게 "node_modules·dist 제외"만 언급해 `.d.ts` 처리 여부를
    명시하지 않는다. 지금은 무해하지만, 나중에 `.d.ts` 파일이 하나라도 생기면 이 주석만 보고
    "전수"라고 오해할 소지가 있다.
  - 제안: 이번 diff 범위는 아니므로 급하지 않다 — 다음에 이 함수를 만질 때 주석에
    "`.d.ts` 제외"를 명시하면 된다.

## 요약

핵심 변경(5개 사본 워커 → `collectTsFiles()` 단일화, `stripLiterals` 전용 테스트 추가,
넓혀진 필드 겨눈 낡은 spec 캐스트 가드 신설)은 유지보수성 관점에서 뚜렷한 개선이다.
`source-scan.ts`/`nullable-type-lie-cast-guard.ts`의 docstring은 "왜"와 "실측 근거"를
함께 남겨 다음 사람이 판단을 되짚을 수 있게 했고, 이전 리뷰 라운드가 지적한 커버리지·중복·
문서 결함(W1~W4)이 실제로 조치된 흔적을 RESOLUTION.md와 코드 양쪽에서 확인했다. 함수 길이·
중첩 깊이·순환 복잡도 모두 낮게 유지됐고 dead import 등 리팩터 잔재도 없었다. 남은 지점은
전부 INFO 급이며, 그중 가장 눈에 띄는 것은 `widenedEntityFields`의 `| null` 판정이 타입 표기
순서·공백에 취약한 부분 문자열 매칭이라는 점 — 지금은 저장소 컨벤션(`Type | null` 고정 순서)
덕에 발현하지 않지만, 이 가드의 존재 이유(조용한 누락 방지)와 정면으로 닿는 지점이라 문서화는
해둘 가치가 있다.

## 위험도

LOW
