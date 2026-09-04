# 유지보수성(Maintainability) 리뷰

## 사전 확인 — 이전 라운드 WARNING 해소 검증

과거 라운드(`11_02_30`)가 지적한 "`swagger-dto-contract-guard.ts` 만 형제 가드의 크로스플랫폼
경로 정규화 관례를 안 따른다"는 WARNING과, 3R(`12_17_50`)이 재실측으로 찾아낸 잔여 4곳
(`engine-error-code-anchor-guard.ts` 2곳·`audit-action-binding.spec.ts`·
`websocket-events.types.spec.ts`)은 저장소 전수 재검색으로 모두 해소된 것을 확인했다 —
`grep -rn "path\.relative(" codebase/backend/src/ codebase/backend/test/` 결과에서
`toPosixRelative`/`source-scan.ts` 자신을 제외하면 **0건**이다. `path` import 잔존 여부도
파일별로 확인했고 dead import 는 없다.

## 발견사항

- **[INFO]** `SRC_ROOT` 계산식이 이미 `export` 된 상수를 두고도 세 번째 사본으로 다시 계산됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:43`
    (`const SRC_ROOT = path.resolve(__dirname, '..', '..');`)
  - 상세: 같은 디렉터리의 `nullable-type-lie-cast-guard.ts:22` 가 이미 동일한 식을
    `export const SRC_ROOT = ...` 로 공개해 두었는데, 이번에 신설된 `swagger-dto-contract.spec.ts`
    는 이를 import 하지 않고 같은 식을 다시 계산한다. `websocket-events.types.spec.ts:46` 에도
    이미 동일 계산이 있어 이번 신설로 **세 번째 사본**이 됐다. 이 PR 자체가 "사본 5개를
    없앤 직후에 새 사본을 만들지 않기 위해" `temp-fixture.ts` 를 추출했다고 명시하는데(같은
    원칙이 이번엔 `SRC_ROOT` 에는 적용되지 않았다). 지금은 한 줄짜리 상수라 실질 위험은
    낮다(세 위치 모두 `repo-guards/__tests__/*` 또는 `modules/*` 에서 같은 상대 깊이).
  - 제안: `swagger-dto-contract.spec.ts` 가 `nullable-type-lie-cast-guard.ts` 의 `SRC_ROOT` 를
    import 하도록 바꾸거나, 세 번째 사본이 또 생기면 `common/__test-utils__/source-scan.ts` 로
    단일 출처화한다. 지금 당장 블로킹할 사안은 아니다.

- **[INFO]** `findSwaggerContractMismatches` 안 변수명 `sf` 가 형제 가드 관례(`sourceFile`)와 다름
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:46,62,119,131,135,136,137,140,173`
  - 상세: 같은 패턴(AST 파서 기반 순수 판정 가드)의 형제 파일 `production-build-devdep-guard.ts`
    는 `sourceFile` 전체 이름을 쓰는데, 이 파일은 시그니처와 본문 전체에서 `sf` 로 줄여 쓴다.
    기능에는 영향 없는 사소한 컨벤션 흔들림이다.
  - 제안: 급하지 않음. 이 파일군에 새 가드를 추가할 때 `sourceFile` 로 통일하면 grep 일관성이
    낫다.

- **[INFO]** 검증 불가능한 하드코딩 수치가 재현 명령 없이 docstring 에 박혀 있음 — 같은 파일군이
  이미 겪은 교훈과 대조됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:109-111`
    (`2026-09-04 실측: Api* 필드 1,096개 중 @Transform 동반은 18개...`)
  - 상세: 같은 디렉터리의 `nullable-type-lie-cast-guard.ts` 는 정확히 이 실수를 이미 한 번 겪고
    docstring 에 "검증되지 않는 숫자는 적지 않는다. 지금 세고 싶으면 `grep -rn '...'`" 라고
    재현 명령까지 남겨 두는 명시적 관례를 세웠다(`collectScanTargets`·`widenedEntityFields`
    두 곳). 이 파일은 숫자(1,096/18/1)만 박아 놓고 재현 방법을 남기지 않아, 저장소가 자라며
    숫자가 낡아도 아무도 알아채지 못한다.
  - 제안: 숫자 옆에 재현 명령(예: `grep -rc '@ApiProperty\(Optional\)\?(' codebase/backend/src`
    류)을 같이 적거나, 정확한 개수 대신 정성적 표현으로 낮춘다.

- **[INFO]** presence 불일치 판정식이 이름 없는 동치 비교로만 표현돼 부호가 한 번 뒤집힌 채 읽힘
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:144`
    (`if (effectiveRequired === tsOptional) {`)
  - 상세: "OpenAPI required 와 TS `?` 는 정반대여야 한다"는 규칙을 `===`(같으면 불일치)로
    표현해 읽는 사람이 함수 상단 JSDoc(92-98행)까지 거슬러 올라가야 의미가 확정된다.
  - 제안: `const presenceMismatch = effectiveRequired === tsOptional; // required 와 optional 은
    반대여야 하므로 같으면 불일치` 처럼 이름을 붙이거나 인라인 주석을 단다.

- **[INFO]** `findSwaggerContractMismatches` 의 파일 순회+AST 방문+2축 판정이 한 클로저 안에서
  중첩 4단이고, presence/null 두 판정 블록의 `push({file, line, field, axis, detail})` 구조가
  거의 동일하게 반복됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:118-168`
    (`for (file) → visit(node) 클로저 → if (api) → if (presence 불일치) / if (null 불일치)`)
  - 상세: `callDecorators`/`readBooleanOption`/`hasTopLevelNull` 로 파싱 보조 로직은 이미 잘
    분리해 뒀지만, 판정 후 `out.push(...)` 두 블록은 파일 순회 루프 안의 클로저에 그대로
    남아 있고 `file: rel, line, field,` 뼈대를 그대로 반복한다. 지금 길이(약 55줄)로는 심각한
    수준이 아니지만, 축이 하나 더 늘어나면(3번째 axis) 이 함수가 눈에 띄게 길어질 여지가
    있다.
  - 제안: 급하지 않음. 축이 늘어나는 시점에 `judgePresence(field, effectiveRequired, tsOptional)`
    / `judgeNull(...)` 형태의 순수 판정 함수로 빼내는 것을 고려.

- **[INFO]** `withFiles<T>` 의 타입 시그니처가 `T` 를 `Promise<X>` 로 추론 가능하게 열어 두지만,
  실제로 그 경로를 타면 `T` 를 반환하지 않고 예외를 던진다 — 타입이 실제 런타임 계약보다 넓다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:44-69`
    (시그니처 `fn: (paths: Record<string, string>) => T` 및 `isThenable(result)` 분기)
  - 상세: 컴파일러 관점에서 `withFiles(files, async (p) => doSomething(p))` 는 `T = Promise<X>`
    로 타입 체크를 통과한다 — 시그니처만 보면 async 콜백이 지원되는 것처럼 읽힌다. 실제로는
    `isThenable(result)` 가 참이면 값을 반환하지 않고 즉시 `throw` 하므로, 타입 수준의 계약과
    런타임 계약이 어긋난다. 지금은 JSDoc(29-42행)이 이 함정을 상세히 설명하고
    `temp-fixture.spec.ts` 가 그 throw 를 캐너리로 고정해 두어 실질 위험은 낮지만, 타입
    시그니처만 보고 호출하는 다음 사람은 컴파일 타임에는 아무 경고도 못 받는다.
  - 제안: 급하지 않음. 여유가 있으면 `fn: (paths: Record<string, string>) => T extends Promise<unknown> ? never : T` 류의 제약을 검토하거나, 최소한 시그니처 옆 한 줄 주석으로 "T 가
    Promise 여도 컴파일은 통과하지만 런타임엔 throw 한다"를 명시한다.

## 요약

이번 배치(3라운드 누적)는 유지보수성 관점에서 성숙도가 높다. 핵심 축인 크로스플랫폼 경로
정규화 불일치(과거 WARNING)는 저장소 전수 재검색으로 완전히 해소된 것을 확인했고(`path.relative(`
잔존 0건), 공유 tmpdir 픽스처(`temp-fixture.ts`) 추출은 실제 중복 5곳을 없앤 순수 리팩터라
회귀 위험이 낮다. 신규 가드(`swagger-dto-contract-guard.ts`/`.spec.ts`)는 정규식이 세 번
틀린 구체적 근거를 문서화하고 `callDecorators`/`readBooleanOption`/`hasTopLevelNull` 로 파싱
로직을 잘게 쪼개 두어 전반적으로 읽기 쉽다. 남은 것은 전부 INFO 수준의 사소한 결함이다 —
새로 생긴 `SRC_ROOT` 세 번째 사본, 파일군 관례(`sourceFile`)와 다른 축약 변수명(`sf`),
같은 파일군이 이미 세운 "재현 불가능한 숫자는 적지 않는다" 관례의 재발, 이름 없는 동치
판정식, 두 판정 블록의 얕은 구조 중복, `withFiles<T>` 타입 시그니처가 실제 런타임 계약보다
넓은 점. DTO 파일 2건(`background-run-response.dto.ts`, `create-assistant-session.dto.ts`)은
데코레이터 교체뿐인 단순 변경으로 문제 없다. 블로킹할 결함은 없다.

## 위험도

LOW
