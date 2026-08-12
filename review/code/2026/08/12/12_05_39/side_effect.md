# 부작용(Side Effect) 리뷰 결과

델타 = backend lint warning 46→21→0 (`--max-warnings 0` 도입) + 잔여 21건 처분(7파일) +
`workspace-reflection-canary.ts` `no-unnecessary-type-assertion` 처분 + Pass 2 회귀 테스트
추가 + `package.json` `lint` 스크립트 게이트 강화 + plan 문서 갱신 + 이전 리뷰 세션(`11_06_12`)
산출물 커밋.

## 검증 방법 (독립 재실측 — 프롬프트/plan 의 주장을 그대로 믿지 않음)

1. `pnpm --filter backend lint` (실제로는 `npx eslint "{src,apps,libs,test}/**/*.ts"`) 를
   현재 워크트리에서 직접 실행 → **출력 0줄, exit 0**. 주장한 "errors 0 / warnings 0" 을
   직접 확인.
2. 커밋 `ee8e44e8f`(잔여 21건 처분 커밋)의 parent 대비, 이번 델타가 건드린 **type-only**
   주장 파일 6개를 `git show <sha>~1:<path>` / `git show <sha>:<path>` 로 scratch 에 추출하고,
   저장소에 설치된 TypeScript(`node_modules/typescript`)로 프로젝트 실제 `tsconfig` 옵션
   (`module: NodeNext`, `moduleResolution: NodeNext`, `isolatedModules`, `removeComments`,
   `target: ES2023`, `experimentalDecorators`, `emitDecoratorMetadata`, `strictNullChecks`)을
   그대로 이식해 `ts.transpileModule` 로 emit 후 md5 비교(이전 세션 `11_06_12` 의 방법론을
   재사용하되, **이번 세션이 새로 건드린 파일들**로 대상을 바꿔 독립 수행):
   - `workspace-reflection-canary.ts` : **emit 동일**
   - `executions.service.ts` : **emit 동일**
   - `ai-agent.schema.ts` : **emit 동일**
   - `render-tool-provider.ts` : **emit 동일**
   - `chat-channel-config.dto.ts` : **DIFFERENT** — diff 전문 확인 결과 `Transform` 콜백의
     `(value === 'text_only' ? 'text' : value)` 를 감싸던 여분 괄호 한 쌍이 사라진 것뿐
     (`(0, class_transformer_1.Transform)(({ value }) => (value === 'text_only' ? 'text' : value))`
     → `... => value === 'text_only' ? 'text' : value)`). 삼항 연산자 우선순위상 의미 동일.
   - `chat-channel.dispatcher.ts` : **DIFFERENT** — `const logFn = isSubFilterNull ? a : b;`
     가 `const logFn = (isSubFilterNull ? a : b);` 로, 즉 대입 우변을 감싸는 괄호 한 쌍만
     추가. 의미 동일.
   - 이 결과는 plan(`plan/in-progress/backend-lint-gate-broken-on-main.md` §후속 마지막 항목)이
     주장한 "7파일 중 5개 동일, 나머지 둘(dispatcher/dto)은 괄호 한 쌍만 다름" 과 **정확히
     일치**한다 — 주장을 재확인했을 뿐 그대로 베낀 것이 아니라 독립적으로 스크립트를 짜서
     돌린 결과다.
   - `idempotency.interceptor.ts` 도 별도로 emit 비교해 **동일**함을 확인(HttpResponseLike
     제네릭 타입 인자는 완전히 소거됨).
3. `triggers.service.ts`/`execution-engine.service.ts`/`migrate-node-output-refs.ts` 3파일은
   전 세션(`11_06_12`)이 이미 동일 방법으로 emit 동일을 증명했고(`review/code/2026/08/12/
   11_06_12/side_effect.md`), 이번 델타의 diff 는 그 세션이 검토한 diff 와 hunk 가 일치해
   재검증하지 않고 그 결과를 승계했다.
4. `handlerConsumesWorkspaceId` 시그니처(`workspace.decorator.ts:66`, `controllerClass: object`)
   를 직접 열람 — `cls`(위에서 `typeof cls !== 'function'` 로 좁혀진 `Function`)가 `object` 의
   서브타입이라 `as object` 제거가 타입 레벨에서도 안전함을 확인(`Function extends object`).
5. `package.json`(`lint` 스크립트)을 참조하는 다른 호출부를 저장소 전체에서 grep —
   `.github/workflows/backend-checks.yml:95` (`pnpm --filter backend lint`) 와
   `.claude/test-stages.sh:49` 두 곳뿐, 둘 다 이 게이트 강화의 **의도된 대상**이고 다른
   숨은 호출부는 없음(`--max-warnings` 를 다른 값으로 거는 병행 스크립트·Makefile 타깃 없음).

## 발견사항

- **[INFO]** `package.json` 의 `lint` 스크립트가 "정보성"에서 "게이팅"으로 인터페이스가
  바뀐다 — 로컬 환경 drift 에 더 민감해짐
  - 위치: `codebase/backend/package.json:20`
  - 상세: `--max-warnings 0` 추가는 `pnpm --filter backend lint` 의 exit code 계약을
    "warning 이 있어도 0" 에서 "warning 1건이라도 있으면 1" 로 바꾼다. 이는 이 PR 의
    목적 자체(게이트 도입)이므로 코드 결함이 아니지만, 사이드이펙트 관점에서 짚을 것은:
    plan 문서(`backend-lint-gate-broken-on-main.md`) 자신이 "낡은 `node_modules` 는 존재하지
    않는 `prettier/prettier` 119건을 만들어 낸다" 고 이미 실측해 기록해 뒀다 — 즉 이
    게이트는 코드가 아니라 **로컬 설치 상태**에도 반응한다. `pnpm install` 없이 오래된
    `node_modules` 로 `pnpm lint` 를 돌리면 실제 코드에 결함이 없어도 게이트가 막힐 수
    있다. 이번 델타가 새로 만든 위험은 아니고(이미 알려져 plan 에 기록됨), 강화된 게이트가
    이 기존 위험의 노출 빈도를 높인다는 점만 기록한다.
  - 제안: 조치 불요 — 이미 문서화됨. CI 는 매번 clean install 이라 영향 없고, 로컬은
    `pnpm install` 습관의 문제.

- **[INFO]** `HttpResponseLike` 도입이 `getResponse()` 의 반환 타입을 좁히지만 런타임
  가드는 그대로 유지된다 — 타입 레벨 변경만, 부작용 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:34-37`,
    `:105`, `:128`
  - 상세: `getResponse<T = any>()` 에 제네릭 인자를 붙여도 런타임에 반환되는 객체는
    이전과 동일(제네릭은 소거)하고, 소비부의 `typeof res.status === 'function'` /
    `typeof res.statusCode === 'number'` 가드도 그대로다 — 위 emit 비교로 바이트 동일 확인.
    다만 express `Response` 를 직접 박지 않고 `HttpResponseLike` 를 새로 정의한 판단은
    옳다(주석이 이유를 명시: express 타입을 박으면 두 `typeof` 가 정적으로 항상 참이 되어
    죽은 코드가 됨) — fastify adapter·테스트 mock 양쪽에서 이 인터셉터가 계속 도는 자리라
    방어를 살려 둔 설계가 맞다.
  - 판정: 문제 없음(발견 아님, 확인 목적으로만 기재).

CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 요약

이번 델타는 (1) `package.json` 의 `lint` 게이트 강화, (2) 8개 backend 소스 파일에서
라이브러리 경계의 암묵적 `any` 에 타입 주석·제네릭 인자·타입 단언만 추가, (3) 회귀
테스트 1건 추가, (4) plan 문서·이전 리뷰 세션 산출물 커밋으로 구성된다. 소스 변경
8파일 중 6파일(`workspace-reflection-canary.ts`, `executions.service.ts`,
`ai-agent.schema.ts`, `render-tool-provider.ts`, `idempotency.interceptor.ts` 및 전 세션이
검증한 `triggers.service.ts`/`execution-engine.service.ts`/`migrate-node-output-refs.ts`)는
프로젝트 실제 tsconfig 로 재현한 TypeScript emit 이 변경 전후 **바이트 단위로 동일**함을
이번 세션이 독립적으로(스크립트를 직접 짜서) 확인했고, 나머지 2파일(`chat-channel-config.dto.ts`,
`chat-channel.dispatcher.ts`)은 emit 차이가 정확히 "여분 괄호 한 쌍"뿐이며 연산자 우선순위상
의미가 동일함을 diff 로 직접 대조했다 — plan 문서의 주장과 정확히 일치했다. 함수 시그니처·
공개 인터페이스·전역 상태·환경 변수 읽기/쓰기·파일시스템·네트워크 호출·이벤트/콜백 발생
어느 것도 바뀌지 않았다. 유일하게 짚을 만한 항목은 `package.json` `lint` 스크립트의 exit
code 계약이 "정보성"에서 "게이팅"으로 바뀐다는 점인데, 이는 이 델타의 명시적 목적이고
호출부(CI 워크플로·harness test-stages)도 두 곳뿐이며 둘 다 의도된 대상이라 INFO 로만
기재한다.

## 위험도

NONE
