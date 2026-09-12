# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 새 가드의 두 export 함수가 같은 AST 순회 로직을 중복 구현 — 하나가 바뀌면 다른 하나가 조용히 어긋날 수 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:106-161`(`findUuidParamViolations`) 및 `:164-195`(`countIdShapedParams`)
  - 상세: 두 함수 모두 (1) 같은 `files` 배열을 순회하며 각 파일마다 독립적으로 `ts.createSourceFile(file, fs.readFileSync(...))` 로 재파싱하고, (2) `ts.isMethodDeclaration` → `node.parameters` → `ts.getDecorators(parameter)` → `decoratorCallName(d, sf) !== 'Param'` → 첫 인자가 문자열 리터럴인지 → `isIdShaped(...)` 순서로 "id-형 `@Param` 판정" 로직을 각자 다시 작성했다. `countIdShapedParams` 는 스펙 파일의 vacuity-floor(스캔이 0건이면 단언이 공허해지는 것 방지)용으로 만들어졌는데, 정작 "무엇을 id-형 파라미터로 셀 것인가"의 판정 코드 자체가 `findUuidParamViolations` 와 분리돼 있어서, 나중에 판정 조건(예: 데코레이터 인자 형태, 네임스페이스 호출 등)이 한쪽에서만 바뀌면 두 함수가 서로 다른 대상을 세게 되고 — 그 드리프트를 잡아줄 테스트가 없다(바로 이 드리프트를 막는 것이 `countIdShapedParams` 존재 이유인데, 그 자신이 별도 로직이라 같은 문제에 노출된다). 같은 디렉터리의 다른 가드들(`dto-jsdoc-citation-guard.ts`, `nullable-type-lie-cast-guard.ts` 등)은 vacuity floor 를 별도 순회 함수가 아니라 이미 만든 결과 집합의 `.length`/`.size` 로 재는 관례를 쓰는데, 이 가드만 그 관례에서 벗어났다.
  - 제안: `countIdShapedParams` 를 없애고 `findUuidParamViolations` 가 별도로 "스캔한 id-형 파라미터 총수"도 함께 반환하도록 하거나(예: `{ violations, scannedCount }`), 최소한 `for (const parameter of node.parameters) { for (const d of ts.getDecorators(parameter) ?? []) { ... } }` 블록을 `function *idShapedParamDecorators(method, sf)` 같은 공유 제너레이터로 뽑아 두 함수가 그것을 재사용하게 한다.

- **[INFO]** `ParseUUIDPipe` 존재 판정이 심볼이 아니라 텍스트 부분일치라 — 별칭 import 시 오탐 가능
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:135-141`
  - 상세: `pipes.includes('ParseUUIDPipe')` 는 `@Param(...)` 두 번째 인자 이후를 `getText(sf)` 로 이어붙인 원문 문자열에 대한 부분 문자열 검사다. `import { ParseUUIDPipe as UuidPipe } from '@nestjs/common'` 처럼 별칭을 쓰면 실제로는 파이프가 붙어 있어도 텍스트에 `'ParseUUIDPipe'` 가 없어 위반으로 오탐한다(반대로 `LegacyParseUUIDPipeAdapter` 처럼 이름에 부분 문자열만 포함된 무관한 심볼도 통과시킬 수 있다). 이 파일의 다른 함수들(`apiParamUuidFlags` 의 "객체 리터럴이 아닌 형태는 담지 않는다", `findUuidParamViolations` 의 "인자 없는 `@Param()` 은 이름이 없다")은 각자의 정적 분석 한계를 JSDoc/주석으로 명시하는 습관이 뚜렷한데, 이 부분일치 검사만 그 한계가 문서화돼 있지 않다. 실측(별칭 0건, `new ParseUUIDPipe(...)` 28건 포함 모두 리터럴 이름)으로 현재는 안전하지만, 향후 리팩터링이 별칭을 들여오면 조용히 깨진다.
  - 제안: `pipes.includes('ParseUUIDPipe')` 위에 "심볼 해석이 아니라 텍스트 부분일치 — 별칭 import 시 오탐 가능(실측 0건)" 정도의 한 줄 주석을 이 파일의 기존 문서화 관례에 맞춰 추가한다.

- **[INFO]** `findUuidParamViolations` 한 함수 안에 파일 순회·상대경로화·재귀 AST 방문·위반 수집이 모두 들어있어 중첩이 깊다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:106-161`(`for (const file of files) { ... const visit = (node) => { if (...) { for (...) { for (...) { if (...) { ... } } } } ts.forEachChild(node, visit); }; visit(sf); }`)
  - 상세: 파일 루프 → 로컬 `visit` 클로저 → 메서드 판별 → 파라미터 루프 → 데코레이터 루프 → 조건문까지 5~6단 중첩이다. 각 단계에 `continue`/`if` 로 조기 이탈해 실질 복잡도는 낮지만, 메서드 단위 위반 판정 로직(파이프·`@ApiParam` 두 축 검사)을 별도 이름 있는 함수(예: `violationsForMethod(method, sf, rel): UuidParamViolation[]`)로 뽑으면 `visit` 은 "메서드를 찾아 위임" 정도로 얕아지고, 그 로직만 독립적으로 단위 테스트할 수 있게 된다.
  - 제안: 위와 같이 메서드 단위 위반 추출을 별도 함수로 분리해 중첩 단계를 2~3단으로 낮춘다.

- **[INFO]** 대형 tracker 문서(`plan/in-progress/spec-draft-nullable-notation-followups.md`)가 3,100줄을 넘어 계속 누적
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 diff 는 3107~3177줄 구간)
  - 상세: 이번 변경 자체는 이 문서의 관례(체크박스 → `[x]` 전환 + `> **해소**` 인용구 부기)를 정확히 따르고 있어 문제는 없다. 다만 문서 전체가 55KB·3100줄을 넘어 단일 파일로 계속 성장 중이라, 리뷰 프롬프트에서도 "프롬프트 크기 제한으로 내용이 실리지 않았다"는 경고가 뜰 정도다. 코드는 아니지만 항목을 찾고 상호 참조하는 유지보수 비용이 점점 커지는 형태다.
  - 제안: 프로젝트 컨벤션(`plan-lifecycle.md`) 범위 밖 사안이라 이번 PR 에서 조치할 것은 아니지만, 완료된 상위 섹션을 주기적으로 `plan/complete/` 로 이관하는 정리 주기를 두면 향후 탐색 비용을 줄일 수 있다.

그 외 리뷰 대상 파일들(`auth.controller.ts` / `triggers.controller.ts` 의 `@ApiParam({format:'uuid'})` 추가, `sample.controller.ts` 대조군 fixture, `param-uuid-pipe.spec.ts`, MDX 문서 6곳, `backend-labels.ts`/`backend-labels.test.ts` 주석 재귀속)은 네이밍·함수 길이·중복·일관성 면에서 특이사항이 없다. 특히 `-guard.ts`/`.spec.ts`/`fixtures/` 3분할 구조는 저장소의 기존 `repo-guards` 관례(`dto-class-name-collision-guard.ts` 등)와 정확히 일치하고, 각 정적 분석 함수마다 한계를 명시하는 주석 습관도 일관되게 유지되고 있다.

## 요약

이번 변경은 컨트롤러 데코레이터에 한두 줄을 추가하는 수준의 국소 수정과, 그것을 영구히 고정하는 AST 기반 repo-guard 신설, 그리고 문서 내 오귀속 정정(에러 코드·환경변수명)으로 구성된다. 전반적으로 가독성이 높고 네이밍이 명확하며, 저장소의 기존 `repo-guards` 관례와 주석 문서화 습관을 잘 따른다. 유일하게 눈에 띄는 구조적 흠은 신규 가드 파일에서 "위반 탐지"와 "vacuity-floor 카운트"라는 두 함수가 같은 AST 순회 로직을 독립적으로 중복 구현한 것으로, 이는 이 저장소의 다른 가드들이 택한 관례(결과 집합의 길이로 vacuity 를 재는 방식)에서 벗어나며 두 판정이 향후 조용히 어긋날 잠재 위험을 남긴다. 나머지는 INFO 수준의 사소한 개선 여지다.

## 위험도

LOW
