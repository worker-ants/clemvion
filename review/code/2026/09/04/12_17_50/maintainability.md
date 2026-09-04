# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 동일 주석이 한 파일 안에서 3회 그대로 반복된다 — 요약 한 줄로 뽑을 수 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:49-50`(`findCastOffenders`), `:123`(`findUntypedNullableColumns`), `:256`(`findStaleSpecCasts`)
  - 상세: 세 함수 모두 `// 크로스플랫폼 정규화 — 리뷰 W3, 세 자리 동시 수정.` 이라는 완전히 같은 문구를 갖고 있다(첫 자리만 형제 가드 이름까지 적어 한 문장 더 길다). 세 자리를 "동시에" 고쳤다는 이력 설명은 한 번만 있으면 충분하고, 나머지 두 자리는 이유를 다시 나열할 필요 없이 참조만 하면 된다. 코드 자체(파일→토큰화→push)는 세 함수가 다른 이유로 서로 다르게 생겼으니(관계 vs 컬럼 vs spec 캐스트) 로직 추출을 요구하는 결함은 아니다 — 순수하게 주석 DRY 문제다.
  - 제안: 첫 등장(`findCastOffenders`)에만 전체 근거를 적고, 나머지 두 곳은 `// 크로스플랫폼 정규화 — 근거는 findCastOffenders 참조.` 정도로 축약한다. 급하지 않다.

- **[INFO]** 신규 파일이 이미 export 돼 있는 `SRC_ROOT` 상수를 재계산해 두 번째 사본을 만들었다 — 이 PR 이 바로 옆에서 같은 클래스의 중복(`toPosixRelative` 8곳)을 없앤 직후다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:43`(`const SRC_ROOT = path.resolve(__dirname, '..', '..');`) — 이미 존재하는 `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:22`(`export const SRC_ROOT = ...`) 와 완전히 동일한 계산식.
  - 상세: 두 파일 모두 `repo-guards/__tests__/` 안에 있어 실제로 항상 같은 값을 내므로 지금 당장 틀릴 위험은 낮다. 하지만 이 diff 자체가 "`path.relative(...).split(path.sep).join('/')` 가 8곳 복제돼 있었다" 는 사실을 근거로 `toPosixRelative` 를 추출한 PR 이라, 바로 옆에서 새로 만든 파일이 같은 성격의 상수를 다시 계산한 것은 그 원칙이 이번엔 적용되지 않고 지나간 자리다. `architecture.md`(직전 라운드) 가 이미 INFO 로 짚었고 아직 반영되지 않았다.
  - 제안: `swagger-dto-contract.spec.ts` 가 `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 에서 export 된 `SRC_ROOT` 를 import 하도록 바꾼다. 지금 당장 필수는 아니다.

- **[INFO]** `findSwaggerContractMismatches` 한 함수가 "AST 순회 + presence 축 판정 + null 축 판정"을 함께 맡아 중첩 깊이 4단계(`for` → `visit` 의 `if isPropertyDeclaration` → `if api` → `if effectiveRequired === tsOptional` / `if nullable !== tsNull`)까지 내려간다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:113-176`(`findSwaggerContractMismatches`)
  - 상세: 함수 자체는 문서화가 잘 돼 있고 대조군 테스트가 두 축을 각각 촘촘히 덮고 있어 지금 읽기가 어렵지는 않다. 다만 두 축(`presence`/`null`)의 판정·`out.push` 블록이 같은 `if (api) { ... }` 블록 안에 나란히 있어, 세 번째 축(예: `@Transform` 아닌 다른 wire-변환 데코레이터)이 추가되면 이 함수가 계속 길어지는 형태다.
  - 제안: `checkPresenceAxis(field, effectiveRequired, tsOptional)` / `checkNullAxis(field, nullable, tsNull, hasTransform)` 처럼 축별 순수 판정 함수로 쪼개면 `visit` 은 "필드 하나에서 각 축 결과를 모아 push" 만 하게 돼 중첩이 한 단계 줄어든다. 지금 리스크가 크지 않으므로 급한 리팩터는 아니다 — 세 번째 축이 실제로 생기는 시점에 하면 된다(이 PR 이 반복해서 쓰는 "두 번째까지는 참고, 세 번째에 추출한다" 원칙과 같은 결).

## 요약

이번 배치는 유지보수성 관점에서 전반적으로 높은 수준이다 — 저장소가 8곳에 복제해 두었던 `path.relative(...).split(path.sep).join('/')` 를 `toPosixRelative`/`toPosixPath` 로 정확히 추출했고, tmpdir 픽스처 헬퍼(`temp-fixture.ts`)도 같은 이유로 공유 모듈로 승격했으며, 두 추출 모두 "왜 여기 있는가"·"몇 곳이었는가" 를 실측치로 문서화해 다음 사람이 근거를 재구성할 필요가 없다. 신규 AST 가드(`swagger-dto-contract-guard.ts`)는 정규식이 세 가지 형태로 틀렸던 이력을 대조군 테스트로 고정해 두어 회귀 방지 설계가 탄탄하다. 함수 길이·중첩·네이밍 전반은 문제 없고, 발견된 3건은 모두 INFO 수준 — 반복 주석 1건, 상수 재계산으로 생긴 소규모 중복 1건, 향후 축이 늘어날 때 대비한 함수 분리 제안 1건으로 코드 동작이나 안전성에 영향을 주지 않는다.

## 위험도

LOW
