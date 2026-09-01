# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `error-shape.spec.ts` 의 `SubclassName` 매핑 타입은 TS 상급 패턴(중첩 조건부 타입 + `Exclude`)이라 진입장벽이 있다
  - 위치: `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:64` (`type ErrorsModule = typeof errors;` ~ `type SubclassName = Exclude<...>` 블록, 게이트 64~74)
  - 상세: `errors.ts` 의 export 중 `ExpressionError` 하위 생성자인 키만 매핑 타입으로 골라내는 로직(`[K in keyof ErrorsModule]: ... ? K : never`)은 한 번에 읽기 쉽지 않다. 다만 바로 위(게이트 55~63)에 "왜 명시 배열이 아니라 타입 유도인지"를 설명하는 주석이 이미 붙어 있고, 이 패턴이 다른 곳에 중복되지 않고 이 캐너리 테스트 파일에 국한되어 있어 실질적 유지보수 부담은 낮다. `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md` 체크리스트에 뮤테이션 검증(7번째 하위 클래스 추가 → RED 3) 기록도 있어 근거가 실측됐다.
  - 제안: 현재로도 무방하나, 재사용 필요가 생기면 `type ExpressionErrorSubclassName<M> = ...` 형태로 이름 붙은 유틸리티 타입으로 승격해 재사용성을 높일 수 있다. 지금은 조치 불필요.

- **[INFO]** `parser.ts` 의 `case TokenType.LParen: { ... }` 블록 도입은 `no-case-declarations` ESLint 규칙 위반을 해소하는 국소 수정이며, 같은 패키지의 `evaluator.ts`(`case 'ObjectLiteral': {`, `case '-': {`)에서 이미 쓰이던 패턴과 일치한다
  - 위치: `codebase/packages/expression-engine/src/parser.ts:317`
  - 상세: 인접 주석(게이트 315~316)이 "왜 블록이 필요한지"를 명확히 설명한다. 기존 코드베이스 컨벤션(스코프가 필요한 `case` 는 중괄호로 감싼다)과 일관되므로 새로운 스타일을 도입한 것이 아니다.
  - 제안: 없음.

- **[INFO]** 7개 패키지의 `package.json` `lint` 스크립트에서 `eslint src/**/*.ts` → `eslint "src/**/*.ts"` 로 글롭을 따옴표로 감싼 변경은 셸이 글롭을 조기 확장해 `eslint` 가 받는 인자가 환경(파일 존재 여부·셸 종류)에 따라 달라지는 문제를 방지한다
  - 위치: `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,masked-markers,node-summary}/package.json:11` (7개 파일 동일 패치, `sdk`/`web-chat-sdk` 는 이미 따옴표 처리돼 있었음 — 실측: `grep -rn "\"lint\":" codebase/packages/*/package.json`)
  - 상세: 7개 파일 모두 동일한 1줄 diff로, 수작업 drift 없이 일관되게 적용됐다. 이 변경 이후 모노레포 내 `lint` 스크립트가 전부 글롭을 따옴표로 감싸는 동일 컨벤션으로 수렴한다(`backend`, `frontend` 는 별도 패턴이라 논외). 유지보수성 관점에서 개선이며 결함은 없다.
  - 제안: 없음.

- **[INFO]** `plan/` 하위 변경(신규 `plan/complete/spec-draft-avatar-storage-key.md`, 삭제된 `plan/in-progress/spec-draft-avatar-storage-key.md`, 수정된 `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md`)은 애플리케이션 코드가 아니라 작업 추적 문서다
  - 상세: `plan/complete/spec-draft-avatar-storage-key.md` 신규 생성과 `plan/in-progress/spec-draft-avatar-storage-key.md` 삭제는 완료된 draft 를 `complete/` 로 옮기는 정상적인 라이프사이클 이동이며 내용은 동일(완료 배너만 추가)하다 — 코드 중복이 아니라 git mv 에 해당한다. `expression-engine-error-shape-spec-broken-on-main.md` 는 "선재 확정" 결론을 취소선(`~~...~~`)으로 원문 보존한 채 정정 배너를 추가하는 방식이라, 정정 이력이 투명하게 남아 가독성 관점에서 바람직하다.
  - 제안: 없음 (코드 리뷰 관점에서 조치 불필요).

## 요약

이번 changeset 은 실질적으로 세 종류다: (1) 7개 패키지 `package.json` 의 `lint` 글롭 따옴표 처리(모노레포 전역 컨벤션 통일, 순수 개선), (2) `expression-engine` 테스트 파일의 타입 유도 리팩터(런타임 전수 열거 + 타입 유도 방식으로, 복잡하지만 근거 주석과 뮤테이션 검증이 딸려 있음), (3) `parser.ts` 의 `case` 블록 스코프 수정(기존 파일 내 컨벤션과 일치). 세 변경 모두 함수 길이·중첩 깊이·매직 넘버·중복 코드 문제를 새로 만들지 않으며, 오히려 셸 이식성과 lint 일관성을 높인다. 나머지 `plan/*.md` 변경은 코드가 아닌 작업 문서 이동/갱신으로 유지보수성 리스크가 없다. 전반적으로 견고하고 잘 문서화된 소품 변경이다.

## 위험도

NONE
