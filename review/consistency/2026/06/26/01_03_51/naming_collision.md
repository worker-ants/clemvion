# 신규 식별자 충돌 검토 결과

검토 범위: `03 m-4 — backend catch 변수명 통일 (eslint-plugin-unicorn@^56 catch-error-name, 49파일)`
커밋: `8f2b6d12`, diff-base: `origin/main`

---

## 발견사항

### 요구사항 ID 충돌

해당 없음. target 이 새로 부여하는 요구사항 ID 없음.

### 엔티티/타입명 충돌

해당 없음. 새 엔티티·DTO·인터페이스 도입 없음.

### API endpoint 충돌

해당 없음. 새 endpoint 도입 없음.

### 이벤트/메시지명 충돌

해당 없음. 새 이벤트·메시지 이름 도입 없음.

### 환경변수·설정키 충돌

해당 없음. 새 ENV var·설정 키 도입 없음.

---

### [INFO] eslint 플러그인 네임스페이스 `unicorn` 신규 등록

- target 신규 식별자: `eslint.config.mjs` 의 `plugins: { unicorn: eslintPluginUnicorn }` 블록
- 기존 사용처: `eslint.config.mjs` 의 다른 플러그인 키(`prettier`, `@typescript-eslint`) 와 네임스페이스 충돌 없음. `unicorn` 키는 기존 어디에도 등록되지 않음
- 상세: `eslint-plugin-unicorn` 을 preset 전체가 아닌 단일 룰(`catch-error-name`)만 활성화하는 방식으로 등록. 다른 unicorn 룰(예: `unicorn/prefer-includes`)이 `channel-web-chat` 빌드 산출물 내 third-party 코드에 `eslint-disable-next-line unicorn/*` 주석으로 이미 억제된 사례가 있으나, 이는 frontend 패키지 소관이며 backend eslint 설정과 무관함
- 제안: 현 상태 유지. 충돌 없음

---

### [INFO] `err_` 후위 언더스코어 패턴 — 기존 관습과의 일관성

- target 신규 식별자: `.catch((err_: unknown) => err_)` 형태의 프로미스 핸들러 변수 (`executions.controller.spec.ts`, `hooks.service.spec.ts`, `executions.service.spec.ts`, `workflows.controller.spec.ts`, `triggers.service.spec.ts`, `llm.service.spec.ts`, `integration-oauth.service*.spec.ts` 등 다수)
- 기존 사용처: `codebase/backend/eslint.config.mjs` 의 `argsIgnorePattern: '^_'` / `caughtErrorsIgnorePattern: '^_'` — 기존 미사용 식별자 면제 패턴은 **접두 언더스코어(`^_`)** 기반. `err_` 는 접두가 아니라 **접미** 언더스코어이므로 기존 ignore 패턴에서 면제되지 않음. 단, `err_` 는 실제로 사용(`return err_`)되므로 `no-unused-vars` 위반이 발생하지 않아 lint PASS 는 올바름
- 상세: `unicorn/catch-error-name` 의 `ignore: ['^_']` 는 접두 언더스코어(`_ignoredErr`) 만 면제. `err_` 는 이 패턴에 해당하지 않으므로 catch 파라미터 위치라면 규칙 위반이 될 수 있음. 그러나 해당 파일들에서 `err_` 는 전부 `.catch(callback)` 의 **콜백 인자**이지 `try/catch` 의 catch 파라미터가 아님 — `unicorn/catch-error-name` 은 `catch (binding)` 에만 적용되며 `.catch(fn)` 의 함수 인자에는 적용되지 않음. 따라서 실제 충돌·위반 없음. `code.handler.ts` 의 `} catch (err_)` (pre-existing, 이번 diff 대상 아님) 는 실제 catch 바인딩이며 `^_` 로 시작하지 않으므로 규칙 위반이지만, lint PASS 가 선언된 점으로 미루어 해당 파일이 이번 PR 이전부터 이 상태였거나 별도 처리가 있는 것으로 판단됨
- 제안: `err_` 후위 언더스코어 패턴은 `.catch()` 콜백 인자 전용으로 일관되게 사용하고 있으며 `unicorn/catch-error-name` 적용 범위 밖임. 혼동 방지를 위해 팀 컨벤션에 "`.catch()` 인자에서 외부 스코프의 `err` 변수와 충돌 시 `err_` 허용" 을 주석 또는 코딩 가이드에 명시하면 더욱 명확해짐. 현재 충돌·lint 위반 없음

---

### [INFO] `oauth-callback.template.ts` 의 `catch (e)` — 템플릿 문자열 내부

- target 신규 식별자: 해당 없음 (이번 diff 에서 이 파일은 미변경)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-m4-catch-name-ec6f44/codebase/backend/src/modules/integrations/services/oauth-callback.template.ts` L105 — 템플릿 리터럴 안의 HTML/JS 문자열 내 `catch (e)` 존재
- 상세: 이 `catch (e)` 는 TypeScript catch 바인딩이 아니라 template literal 내 인라인 JavaScript 문자열. ESLint 는 이를 TypeScript 소스 AST catch 절로 파싱하지 않으므로 `unicorn/catch-error-name` 규칙이 적용되지 않음. lint PASS 와 일치
- 제안: 현 상태 유지. 실제 충돌 없음

---

## 요약

이번 변경은 catch 변수 이름을 `error`/`e`/서술형에서 `err` 로 일괄 변경하는 순수 rename 리팩터링이며, 새로 도입하는 의미 있는 식별자는 `eslint-plugin-unicorn` 플러그인 네임스페이스(`unicorn`)와 lint 룰 키(`unicorn/catch-error-name`) 뿐이다. 두 식별자 모두 기존 backend eslint 설정에서 미사용 네임스페이스·룰이므로 충돌이 없다. `.catch()` 콜백 인자로 도입된 `err_` 후위 언더스코어 패턴은 `unicorn/catch-error-name` 적용 범위(try/catch 바인딩)에 해당하지 않아 규칙 충돌이 없으며, spec 영역 어느 문서도 catch 변수명 `err` 를 다른 의미로 사용하고 있지 않다.

## 위험도

NONE
