# 신규 식별자 충돌 검토 — 03 m-4: backend catch 변수명 통일

검토 모드: --impl-prep (구현 착수 전)

## 발견사항

### INFO: eslint-plugin-unicorn 패키지명 신규 도입 — 기존 ESLint 플러그인과 중첩 없음

- target 신규 식별자: `eslint-plugin-unicorn` (devDependency), `'unicorn/catch-error-name'` (rule key)
- 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/eslint.config.mjs` — 현재 `@eslint/js`, `typescript-eslint`, `eslint-plugin-prettier` 만 사용 중. `package.json` devDependencies 에 unicorn 없음
- 상세: 새 rule key `'unicorn/catch-error-name'` 은 기존 `@typescript-eslint/*` / `prettier/*` 네임스페이스와 완전히 별개다. 충돌 없음.
- 제안: 없음 (신규 네임스페이스).

### INFO: `caughtErrorsIgnorePattern: '^_'` (기존) 과 unicorn ignore `'^_'` 은 동일 패턴 — 중복이지만 충돌 없음

- target 신규 식별자: unicorn `catch-error-name` 의 `ignore: ['^_']` 패턴
- 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/eslint.config.mjs:54` — `@typescript-eslint/no-unused-vars` 의 `caughtErrorsIgnorePattern: '^_'`
- 상세: 두 규칙이 `_` prefix 를 각자 독립적으로 무시한다. 의미가 동일하므로 `_err` / `_e` 계열 catch param 은 양쪽 규칙 모두에서 허용 상태로 일관된다. 충돌 없음.
- 제안: 없음 (동일 의도, 이중 명시는 각 룰의 자체 책임 범위).

### INFO: 기존 `err` 로컬 변수(`const err = ...`)와 catch param `err` 가 같은 파일에 공존 — 스코프 충돌 없음

- target 신규 식별자: catch 파라미터 `err` (eslint --fix 로 rename 될 기존 `error`, `e`, `emitErr` 등)
- 기존 사용처: 아래 파일들에 `const err = ...` / `let err = ...` 형태의 로컬 변수가 이미 존재하며, 동일 파일 안에 catch 블록도 있음
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:141` — `const err = new Error(...)`
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/integration/send-email/send-email.handler.ts:88` — `const err = new Error(...)`
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts:472` — `const err = obj.error ...`
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts:437` — `const err = ...`
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/data/code/code.handler.ts:490` — `const err = error as CodeExecutionError`
- 상세: catch 절은 ES2015+ 에서 자체 블록 스코프를 생성한다. catch 파라미터 `err` 는 `{ }` 블록 안에서만 유효하며, 함수 본문의 `const err` 와 스코프가 분리되어 shadowing/충돌이 발생하지 않는다. TypeScript 컴파일러와 ESLint 모두 이를 별개 바인딩으로 처리한다.
- 제안: 없음 — 스코프 충돌 없음. 단 가독성 차원에서 같은 함수 안에 로컬 `const err` 와 catch `err` 가 공존하는 경우 리뷰 시 의도 혼동 가능성이 있으므로, --fix 후 해당 파일의 로컬 변수 이름을 더 구체적인 이름(예: `abortErr`, `parseErr`)으로 자발적 정리를 고려할 수 있다. 단, 이는 m-4 범위 밖이므로 본 리팩터링 PR 에서 강제 불필요.

### INFO: `pool.on('error', (err) => {...})` 의 `err` 파라미터 — unicorn 규칙 미적용 대상

- target 신규 식별자: catch 파라미터 rename (unicorn catch-error-name 적용)
- 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:401` — `pool.on('error', (err) => {`
- 상세: `unicorn/catch-error-name` 은 `try/catch` 절의 catch 바인딩 파라미터에만 적용된다. EventEmitter `.on('error', callback)` 같은 일반 콜백 파라미터에는 적용되지 않는다. 현재 `err` 로 이미 명명되어 있어 rename 대상도 아님. 충돌 없음.
- 제안: 없음.

## 요약

03 m-4 는 `eslint-plugin-unicorn` 을 추가하고 `catch-error-name` 단일 규칙(name: 'err', ignore: '^_')을 활성화해 catch 파라미터를 `err` 로 일괄 통일하는 behavior-preserving 리팩터링이다. 새로 도입되는 식별자는 ESLint rule key 네임스페이스(`unicorn/`)뿐이며, 기존 `@typescript-eslint/*` / `prettier/*` 네임스페이스와 충돌하지 않는다. `_` prefix ignore 패턴은 기존 `no-unused-vars` 설정과 의미가 동일해 중복이지만 충돌이 아니다. catch 파라미터 `err` 이름은 이미 코드베이스 다수파(190/270+ 블록)이며, 로컬 변수 `err` 와의 스코프 충돌은 ES 블록 스코프 규칙으로 원천 차단된다. spec/conventions 어디에도 catch 변수명을 지정하는 별도 식별자가 없어 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로 차원의 충돌은 전혀 없다.

## 위험도

NONE

STATUS: OK
