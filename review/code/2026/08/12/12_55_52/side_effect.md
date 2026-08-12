# 부작용(Side Effect) Review — 누적 diff (`origin/main...HEAD`, 5번째 라운드)

## 범위 확인

델타는 backend lint `no-unsafe-*` warning 전량 처분(46→0) + `package.json` `--max-warnings 0`
게이트 도입 + 관련 12개 소스 파일 타입 강화 + `idempotency.interceptor.spec.ts` 회귀 테스트 +
README 문구 정정 + plan 문서 + 4차례 선행 리뷰 세션(`11_06_12`/`12_05_39`/`12_24_14`/`12_40_58`)
산출물 커밋으로 구성된다. 실질 코드/설정 변경은 다음 15개 파일뿐이며(나머지는 review/plan 문서),
`git diff origin/main...HEAD` 로 현재 HEAD 상태를 직접 재확인했다:

- `codebase/backend/README.md`, `codebase/backend/package.json`
- `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.{ts,spec.ts}`
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts`
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts`
- `codebase/backend/src/scripts/migrate-node-output-refs.{ts,spec.ts}`
- `plan/in-progress/backend-lint-gate-broken-on-main.md`

선행 4개 라운드의 side_effect 리뷰가 이미 프로젝트 실제 `tsconfig.json` 옵션을 이식한
`ts.transpileModule` emit 비교(md5)로 12개 소스 파일 전부를 바이트 단위 검증해 두었다(대부분
동일, `chat-channel.dispatcher.ts`/`chat-channel-config.dto.ts` 는 괄호 한 쌍만 차이 — 연산자
동일). 이번 라운드는 그 결과를 승계하되, 소스를 직접 열어 핵심 주장(시그니처 호환·호출부 인자
일치·grep 전수)을 재확인했다.

## 점검 관점별 판정

1. **의도치 않은 상태 변경 / 전역 변수** — 없음. 12개 소스 파일 모두 값 위치 변경이 아니라
   타입 주석(제네릭 인자, 콜백 파라미터 타입, `as` 단언, 지역 인터페이스 `HttpResponseLike`)
   뿐이며, 새 모듈-레벨 변수나 캐시·싱글턴 도입이 없다.
2. **파일시스템 부작용** — 없음. 이 델타(코드 12개 파일)는 파일 I/O 를 발생시키는 로직을
   전혀 건드리지 않는다. (`migrate-node-output-refs.ts` 는 CLI 스크립트지만 이번 diff 는
   `String.replace` 콜백 파라미터 타입만 바꿨고, 파일 read/write 를 수행하는 `main()`/CLI
   진입부는 diff 범위 밖이다 — 직접 확인.)
3. **시그니처 변경 / 호출자 영향** —
   - `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:89`
     `handlerConsumesWorkspaceId(cls as object, handler)` → `handlerConsumesWorkspaceId(cls, handler)`.
     소스를 직접 읽어 확인: 바로 위 `:79` `if (typeof cls !== 'function') continue;` 로 `cls`
     가 이미 `Function` 으로 좁혀진 뒤이고, `handlerConsumesWorkspaceId(controllerClass: object, …)`
     의 파라미터 타입이 `object` 라 `Function` 값을 캐스트 없이 그대로 대입 가능(구조적
     서브타입). 호출 인자·순서·개수 불변, 함수 자체의 export 시그니처도 불변.
   - `codebase/backend/src/modules/triggers/triggers.service.ts:1077` `let result;` →
     `let result: SetupResult;`. 초기화 없는 지역 변수 선언은 타입 주석 유무와 무관하게
     emit 이 `let result;` 로 동일 — 런타임 관측 불가.
   - 그 외 `m.query<{ id: string }[]>`, `.bind(...) as (message: string) => void`,
     `arr.map((b: unknown) => …)`, `@Transform(({ value }: { value: unknown }) => …)` 등은
     전부 파라미터 개수·이름·순서를 바꾸지 않는 타입 주석 추가다. 공개 함수/메서드의
     **외부에서 관측 가능한** 시그니처(파라미터 개수, 반환 타입의 런타임 shape)는 어느
     것도 바뀌지 않았다.
4. **인터페이스 변경(공개 API)** — 유일한 실질 인터페이스 변경은
   `codebase/backend/package.json:20` 의 `"lint": "eslint ... --max-warnings 0"` 이다. 이는
   `pnpm --filter backend lint` 의 **exit code 계약**을 "warning 이 있어도 0" → "warning
   1건이라도 있으면 1" 로 바꾼다. 호출부를 저장소 전체에서 grep 하면
   `.github/workflows/backend-checks.yml:95`, `.claude/test-stages.sh:49` 두 곳뿐이고, 둘 다
   이 게이트 강화의 의도된 대상이다(README:19 도 동시에 갱신돼 실제 동작과 일치). `lint:fix`
   스크립트는 `--max-warnings` 없이 그대로 둬 자동수정 워크플로에 영향 없음. 이 변경은
   PR 의 명시적 목적이자 사이드이펙트가 아니라 **주 효과**이므로 INFO 로만 기재한다.
5. **환경 변수** — 이번 델타 어디에도 `process.env` 읽기/쓰기 추가·삭제가 없다.
6. **네트워크 호출** — 없음. `idempotency.interceptor.spec.ts` 의 신규 테스트 5건은
   `makeRedis()`/`makeContext()` 가 매 테스트마다 새 mock 객체를 반환하는 팩토리이며, 실
   Redis 연결이나 외부 HTTP 호출이 없다(직접 열람 확인 — `jest.fn()` 기반 stub 뿐).
   `security.md`/`dependency.md` 가 세 어댑터(Slack/Telegram/Discord) 실제 코드까지 열어
   확인했다는 서술도 이번 diff 범위(어댑터 자체는 미변경) 밖의 배경 확인이라 이번 판정에
   영향 없음.
7. **이벤트/콜백 변경** —
   `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` 의
   `logFn = (isSubFilterNull ? this.logger.debug.bind(this.logger) : this.logger.warn.bind(this.logger)) as (message: string) => void;`
   — 분기 조건(`isSubFilterNull`)과 각 분기가 가리키는 실제 함수(`logger.debug`/`logger.warn`)
   는 변경 전과 동일하다. `as` 단언은 컴파일 타임 전용이라 `.bind()` 가 반환하는 실제 함수
   객체·바인딩된 `this`·호출 시 인자 전달에는 영향이 없다. 이어지는 `logFn(...)` 호출부가
   문자열 인자 1개만 넘기는 것도 직접 확인했다(단언 타입과 실제 호출이 일치).
   `idempotency.interceptor.ts` 의 `getResponse<HttpResponseLike>()` 도 제네릭 인자가 소거돼
   `context.switchToHttp().getResponse()` 의 실제 반환값·이어지는 `res.status(...)` 호출
   여부는 이전과 동일. 새 이벤트 발행·구독·콜백 등록/해제는 없다.

## 발견사항

- **[INFO]** `package.json` `lint` 스크립트의 exit code 계약이 "정보성"에서 "게이팅"으로
  바뀐다(위 관점 4 참조).
  - 위치: `codebase/backend/package.json:20`
  - 상세: 이 게이트는 코드뿐 아니라 로컬 설치 상태(예: stale `node_modules` 가 유발하는
    유령 warning)에도 반응해 노출 빈도가 늘어날 수 있다는 점이 이전 라운드에서 이미
    지적·plan 문서화됨. CI 는 매 실행 clean install 이라 영향 없음.
  - 제안: 조치 불요 — 이미 문서화되고 README 도 동기화됨(`codebase/backend/README.md:19`).

CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 요약

이번 델타는 (1) 12개 backend 소스 파일에서 라이브러리 경계(`EntityManager.query`,
`Array.isArray` 의 `any[]` 좁힘, `.bind` 오버로드, `TransformFnParams.value`,
`Map.Iterator.next().value`, `ExecutionContext.getResponse()`, `Object.getPrototypeOf`)에 새던
암묵적 `any` 를 타입 주석·제네릭 인자·타입 단언·설명 주석으로만 막은 수정, (2) `package.json`
`lint` 스크립트의 exit code 계약을 "정보성"에서 "게이팅"으로 바꾸는 의도된 인터페이스 변경(호출부
2곳 모두 이 변경의 대상이고 README 도 동기화), (3) `idempotency.interceptor.spec.ts` 에 추가된
격리된 mock 기반 회귀 테스트로 구성된다. 함수 시그니처(외부 관측 가능한 파라미터 개수·이름·순서),
전역 상태, 파일시스템, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 발생 어느 표면도 이번
델타로 바뀌지 않았다. `workspace-reflection-canary.ts` 의 `as object` → 무캐스트 전환은
보안 캐너리 자리라 특히 소스를 직접 열어 `typeof cls !== 'function'` 가드 뒤라는 것을
재확인했고, 안전하다. 신규 테스트는 테스트별 fresh mock 을 써서 상태 누수가 없다.

## 위험도

NONE

STATUS: OK
