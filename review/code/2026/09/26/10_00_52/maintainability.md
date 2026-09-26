# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `@HttpCode` 추가 위치가 같은 파일·같은 PR 내 다른 핸들러와 다른 데코레이터 순서를 만든다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts:157-161` (`regenerate()`)
  - 상세: 이 PR 이 새로 추가한 `@HttpCode(HttpStatus.OK)` 가 `@Post(':id/regenerate')` 바로 다음, 즉 권한 주석과 `@Roles('admin')` **앞**에 삽입됐다(`@Post → @HttpCode → 주석 → @Roles → @ApiOperation`). 같은 파일의 바로 아래 `reveal()`(160번대)은 `@Post → 주석 → @Roles → @HttpCode → @ApiOperation` 순서이고, `create()`(89번 줄대)도 `@Roles` 다음에 `@HttpCode` 다. 더 나아가 이번 PR 이 같은 패턴으로 고친 다른 6개 컨트롤러(`integrations`, `knowledge-base`, `schedules`, `workflow-assistant`, `workflows`, `workspaces`)는 전부 `@Roles`(있는 경우) 뒤, `@ApiOperation` 앞에 `@HttpCode` 를 넣었다. `regenerate()` 만 유일하게 `@Roles`/주석보다 앞에 놓여 있어, "권한 데코레이터를 라우트 데코레이터 바로 아래서 훑는다" 는 눈에 익은 스캔 순서를 이 한 자리에서만 깬다.
  - 제안: `@HttpCode(HttpStatus.OK)` 를 주석·`@Roles('admin')` 뒤, `@ApiOperation` 앞으로 옮겨 파일 내 다른 8곳(및 이 PR 이 건드린 다른 컨트롤러들)과 순서를 맞춘다.

- **[INFO]** `judgeHandler` 가 이 신규 가드 파일에서 가장 길고 분기가 많은 함수다
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts` 의 `judgeHandler` 함수(약 65줄, `export function scanHttpStatusAdvertised` 바로 위)
  - 상세: 데코레이터 순회 루프 안에서 verb 판정 · `@HttpCode` 파싱 · `@ApiExcludeEndpoint` 플래그 · `@ApiResponse` 상태 추출 · 응답 표 조회 · 미해석 응답 데코레이터 보고까지 6가지 분기를 한 `for` 루프 안에 두고, 루프 뒤에서 "제외/미해석/광고 없음" 조기 반환과 "Nest 기본값 계산 + 위반 판정"을 이어 붙였다. 도메인 자체가 요구하는 분기라 각 분기는 짧고 주석도 잘 달려 있지만, 한 함수가 "핸들러에서 정보 추출"과 "위반 여부 판정" 두 책임을 모두 지고 있어 순환 복잡도가 가장 높다(파일 내 다른 함수는 대부분 단일 책임·10~30줄).
  - 제안: 필수는 아니지만, 데코레이터 순회로 `{ verb, httpCode, excluded, advertised, unresolved }` 를 뽑아내는 부분과 "advertised 대비 actual 비교"를 두 함수로 나누면 각각을 독립적으로 테스트·이해하기 쉬워진다.

- **[INFO]** `judgeHandler` 반환 타입만 이 파일의 다른 결과 타입들과 달리 익명 인라인 타입이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts` 의 `judgeHandler` 시그니처(`): { violation: HttpStatusViolation | null; unresolved: HttpStatusUnresolved[]; checked: boolean } | null {`)
  - 상세: 같은 파일은 `HttpStatusViolation`·`HttpStatusUnresolved`·`HttpStatusScan` 을 모두 명명된 `export interface` 로 선언해 두는 일관된 스타일을 쓰는데, `judgeHandler` 의 반환값만 이름 없는 인라인 객체 타입이라 그 자리만 눈에 띄게 스타일이 갈린다.
  - 제안: `interface HandlerJudgement { violation: HttpStatusViolation | null; unresolved: HttpStatusUnresolved[]; checked: boolean }` 형태로 이름을 붙이면 파일 내 타입 선언 스타일이 통일된다.

## 요약

이번 변경의 대부분(15곳의 `@HttpCode(HttpStatus.OK)` 추가, e2e 18개 파일의 `expect([200, 201]).toContain(x)` → `expect(x).toBe(200)` 치환, `workspaces.controller.ts` 의 `ApiNoContentResponse` → `ApiOkWrappedResponse(OkResultDto)` 치환)은 기계적이고 국소적인 수정이며, 거의 모든 자리가 같은 파일·같은 PR 안의 기존 패턴(데코레이터 순서, import 정리, 정밀한 상태 코드 단언)을 그대로 따른다 — 오히려 `[200, 201]` 관용구를 단일 값으로 좁힌 e2e 변경은 가독성·의도 명확성 면에서 개선이다. 신규 가드(`http-status-advertised-guard.ts`/`.spec.ts`/fixture)는 저장소의 기존 `repo-guards` 명명·디렉터리 관례(`<name>-guard.ts` + `.spec.ts` + `fixtures/<name>/`, AST 직접 파싱, 매직 상수 대신 런타임에서 값을 읽는 방식)를 그대로 따르고 있고, 분량(319줄)도 동류 가드들의 정상 범위 안이며 각 함수와 설계 결정(왜 `@Res()` 를 면제하지 않는지, 왜 표를 손으로 안 쓰는지)에 대한 근거 주석이 촘촘하다. 유일한 실질적 흠은 `auth-configs.controller.ts` 의 `regenerate()` 한 곳에서 새로 추가된 `@HttpCode` 가 이 PR 자신이 다른 8곳에서 지킨 데코레이터 순서를 깨는 것이고, 그 외에는 가장 복잡한 함수(`judgeHandler`)의 책임 분리·반환 타입 명명 정도가 사소한 개선 여지로 남는다.

## 위험도

LOW
