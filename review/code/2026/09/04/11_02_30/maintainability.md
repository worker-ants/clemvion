# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `findSwaggerContractMismatches` 의 상대경로가 형제 가드들의 크로스플랫폼 정규화 관례를 안 따름
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:125`
  - 상세: `const rel = path.relative(srcRoot, file);` 로 끝난다. 같은 디렉터리의 다른 가드 4곳
    (`engine-error-code-anchor-guard.ts:170,196`, `masked-reject-callers-guard.ts:140`,
    `nullable-type-lie-cast-guard.ts:48,117,246`, `production-build-devdep-guard.ts:119`)
    은 전부 `path.relative(...).split(path.sep).join('/')` 로 윈도우 백슬래시를 정규화한다.
    이 파일만 그 단계를 빼먹었다 — 일관성 관점(점검 관점 8)에서 저장소 관례를 벗어난다.
    현재는 `ContractMismatch.file` 이 assert 대상이 아니라 리포팅용이라 CI(POSIX)에서는
    드러나지 않지만, 다음 사람이 이 필드를 스냅샷 비교 등에 쓰기 시작하면 플랫폼별로
    조용히 달라진다.
  - 제안: `path.relative(srcRoot, file).split(path.sep).join('/')` 로 맞춘다.

- **[INFO]** docstring 에 검증 불가능한 하드코딩 수치 — 바로 옆 형제 파일이 남긴 교훈과 충돌
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:109-111`
    (JSDoc `2026-09-04 실측: Api* 필드 1,096개 중 @Transform 동반은 18개...`)
  - 상세: 같은 디렉터리의 `nullable-type-lie-cast-guard.ts` 는 정확히 이 실수를 이미 한 번
    겪고 docstring 에 "검증되지 않는 숫자는 적지 않는다. 지금 세고 싶으면
    `grep -rn '...'`" 라고 재현 명령까지 남겨 뒀다(같은 파일군의 명시적 관례).
    이 파일은 숫자(1,096/18/1)만 박아 놓고 재현 방법을 남기지 않아, 저장소가 자라면서
    이 숫자가 낡아도 아무도 알아채지 못한다.
  - 제안: 숫자 옆에 재현 명령(예: 이 가드 자신을 실행하는 스크립트나 `ts-node` 한 줄)을
    같이 적거나, 정확한 개수 대신 "소수" 같은 정성적 표현으로 낮춘다.

- **[INFO]** presence 불일치 판정식이 이름 없는 동치 비교로만 표현돼 즉시 읽히지 않음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:141`
    (`if (effectiveRequired === tsOptional) {`)
  - 상세: "OpenAPI required 와 TS `?` 는 정반대여야 한다" 는 규칙을 `===`(즉 "같으면 불일치")
    로 표현해 부호가 한 번 뒤집힌 채 읽힌다. 함수 상단 JSDoc(96-98행)에 서술은 있지만,
    이 한 줄만 보면 "같은데 왜 mismatch 지?" 라는 재확인이 필요하다.
  - 제안: `const presenceMismatch = effectiveRequired === tsOptional; // required 와 optional 은 반대여야 하므로 같으면 불일치` 처럼 이름을 붙이거나 인라인 주석을 단다.

- **[INFO]** 변수명 `sf` 가 이 디렉터리의 기존 관례(`sourceFile`)와 다름
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:46, 62, 119` 등 파일 전역
  - 상세: 같은 패턴(AST 파서 기반 가드)의 형제 파일
    `production-build-devdep-guard.ts:48` 는 `sourceFile` 전체 이름을 쓴다. 이 파일은
    시그니처(`callDecorators`, `readBooleanOption`)와 본문 전체에서 `sf` 로 줄여 쓴다.
    기능에는 영향 없지만 같은 코드베이스 안에서 같은 개념에 다른 이름이 쓰이는
    사소한 컨벤션 흔들림이다.
  - 제안: 굳이 고칠 필요는 없으나, 이후 이 파일군에 새 가드를 추가할 때는 `sourceFile` 로
    맞추는 편이 grep 일관성에 낫다.

- **[INFO]** `findSwaggerContractMismatches` 하나가 "파일 순회 + AST 방문 + 2축 판정"을 한 함수/클로저 안에서 처리해 중첩이 4단
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:113-173`
  - 상세: `for (file) → visit(node) 클로저 → if (api) → if (mismatch)` 로 중첩이 4단이다.
    `callDecorators`/`readBooleanOption`/`hasTopLevelNull` 로 파싱 보조 로직은 이미 잘
    분리해 뒀지만, 마지막 "판정 후 push" 두 블록(presence·null)은 파일 순회 루프 안의
    클로저에 그대로 남아 있다. 지금 길이(약 60줄)와 형제 가드들의 유사 구조
    (`production-build-devdep-guard.ts` 의 `collectRuntimeModuleSpecifiers` 도 같은
    "루프+visit 클로저" 형태)를 감안하면 심각한 수준은 아니지만, 판정 축이 하나 더
    늘어나면(예: 3번째 axis) 이 함수가 더 길어질 여지가 있다.
  - 제안: 급하지 않음. 축이 늘어날 때 `judgePresence(field, effectiveRequired, tsOptional)` /
    `judgeNull(...)` 형태의 순수 판정 함수로 빼내는 것을 고려.

## 요약

이번 변경의 핵심은 `swagger-dto-contract-guard.ts`/`.spec.ts` 신설과 `temp-fixture.ts` 공유
헬퍼 추출이다. `temp-fixture.ts` 는 두 spec 파일에 흩어질 뻔한 `withFiles`/`withFixture` 를
한 곳으로 모아 사본 재생산을 막았고, JSDoc 에 "왜 이렇게 됐는가"를 남겨 다음 사람이 같은
실수를 반복하지 않게 했다 — 잘된 리팩터다. 새 가드(`swagger-dto-contract-guard.ts`)는
정규식이 세 번 틀린 구체적 사례를 문서화하고 `callDecorators`/`readBooleanOption`/
`hasTopLevelNull` 로 파싱 로직을 잘게 쪼개 두어 전반적으로 읽기 쉽다. DTO 파일 2건
(`background-run-response.dto.ts`, `create-assistant-session.dto.ts`)은 데코레이터
교체뿐인 단순 변경으로 문제없다. 발견된 것은 전부 사소한 결함이다 — 형제 가드들과 다른
경로 정규화 누락(WARNING 1건), 이 파일군 자신이 이미 겪은 "하드코딩 수치" 교훈의 재발
여지, 이름 붙이지 않은 동치식, 변수명 관례 이탈, 판정 로직의 얕은 중첩(모두 INFO). 기능
자체를 위협하는 결함은 없다.

## 위험도

LOW
