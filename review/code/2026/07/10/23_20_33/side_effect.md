# 부작용(Side Effect) 리뷰

- 대상 diff base: `origin/main` (커밋 `a02db4f9a` spec + `0302bd7ea` impl, 현재 브랜치 HEAD)
- 대상 파일: `interaction.service.ts`, `responses.dto.ts`, `responses.dto.spec.ts`(신규), `interaction.service.spec.ts`, `eia-types.ts`

## CRITICAL FOCUS 검증 결과 — `getStatus()` 분기 재구조화

### 1. if/else-if → if + 삼항 재구조화의 의미론적 동치 증명

**원본(OLD)**:
```ts
const base = { interactionType, waitingNodeId: nodeExec.nodeId, ...(conversationThread ? {conversationThread} : {}) };
if (interactionType === 'buttons' && bc) {
  context = { ...base, buttonConfig: {...} };
} else if (interactionType) {
  context = { ...base, nodeOutput: out };
}
```
`base` 는 `interactionType` 값과 무관하게 **항상 무조건 계산**되지만, `context` 대입은 두 조건절 안에서만 일어난다(초기값 `let context = null` 유지).

**변경(NEW)**:
```ts
if (interactionType) {
  const base: WaitingContextBase = { interactionType, waitingNodeId: nodeExec.nodeId, ...(conversationThread ? {conversationThread} : {}) };
  context = interactionType === 'buttons' && bc
    ? { ...base, buttonConfig: {...} }
    : { ...base, nodeOutput: out };
}
```

전수 케이스 분석(변수: `interactionType ∈ {null, 'form', 'buttons', 'ai_conversation'}`, `bc ∈ {truthy-object, undefined}`):

| interactionType | bc | OLD 결과 | NEW 결과 | 동치 |
|---|---|---|---|---|
| `null` | any | 두 조건 모두 false → `context` 는 초기값 `null` 유지 | 바깥 `if` false → `context` 는 초기값 `null` 유지 | 예 |
| `'buttons'` | truthy | 1번째 조건 true → buttonConfig 변형 | 삼항 조건 true → buttonConfig 변형 | 예 |
| `'buttons'` | falsy(`undefined`) | 1번째 false, `else if(interactionType)` true → nodeOutput 변형 | 바깥 `if` true, 삼항 false → nodeOutput 변형 | 예 |
| `'form'` / `'ai_conversation'` | any | 1번째 false(`!== 'buttons'`), `else if` true → nodeOutput 변형 | 바깥 `if` true, 삼항 false(`!== 'buttons'`) → nodeOutput 변형 | 예 |

`interactionType` 은 로컬에서 `rawInteractionType === 'form' \| 'buttons' \| 'ai_conversation' ? rawInteractionType : null` 로만 산출되므로 실질적으로 `undefined` 값은 발생하지 않는다(항상 리터럴 3종 또는 `null`) — falsy 로 수렴하는 값은 `null` 하나뿐이며 위 표에 포함됨. `bc` 도 `structured.config?.buttonConfig ?? structured.buttonConfig` 로 타입이 `{buttons?: unknown} \| undefined` 이므로 falsy 값은 `undefined` 하나뿐(객체는 빈 객체라도 truthy) — 역시 표에 포함됨.

`base` 계산을 조건문 안/밖 어디에 두는지는 **순수 객체 리터럴 생성**(getter/side-effect 없음)이라 관측 가능한 차이가 없다 — `conversationThread` 는 이 분기와 무관하게 이미 위에서 (`execution.conversationThread` 존재 여부로) 계산되어 있던 상수이며, 이 리팩터로 인해 재평가되거나 다른 시점에 평가되지 않는다.

**결론: 두 형태는 `interactionType`/`bc` 의 모든 입력 조합에 대해 완전히 동치다.** 부작용 관점에서 우려할 재구조화가 아니다.

### 2. `WaitingContextBase` 타입 애너테이션

`import { ..., type WaitingContextBase } from './dto/responses.dto';` — `type` 전용 import 로 컴파일 시 완전히 소거된다. `WaitingContextBase = Pick<NodeOutputContextDto, 'interactionType' | 'waitingNodeId' | 'conversationThread'>` 는 `Pick` 이 원본 속성의 optional modifier 를 보존하므로 `conversationThread` 는 여전히 optional — `...(conversationThread ? {conversationThread} : {})` 조건부 spread 로직과 정합. **런타임 객체 shape 에 영향 없음** (타입 annotation 은 값 자체를 변경하지 않음).

### 3. wire 상 키 노출 여부 검증 — 직렬화 경로 확인

`ExecutionStatusDto`/`ButtonsContextDto`/`NodeOutputContextDto` 는 `@ApiProperty`/`@ApiPropertyOptional`(Swagger 전용) 데코레이터만 사용하고 `class-validator`/`class-transformer` 의 `@Expose`/`@Exclude`/`@Type` 은 전혀 사용하지 않는다. 컨트롤러 응답 경로의 `TransformInterceptor`(`codebase/backend/src/common/interceptors/transform.interceptor.ts`) 는 `class-transformer` 를 전혀 쓰지 않고 단순 `map((data) => ({ data }))` 로 원본 객체를 그대로 감싼다(응답 전역에 `ClassSerializerInterceptor` 미등록 확인 — grep 결과 `plainToInstance`/`ClassSerializerInterceptor` 는 요청 검증(`validation.pipe.ts`)에서만 쓰임). 즉 실제 wire 는 `interaction.service.ts` 가 만든 **plain object 의 own enumerable property 그대로 `JSON.stringify`** 된다. DTO 클래스의 필드 타입·데코레이터 변경(`currentNode: CurrentNodeDto`, `context: ButtonsContextDto|NodeOutputContextDto`, `nullable: true` 추가 등)은 **Swagger 문서 생성에만 영향**을 주고 런타임 직렬화에는 영향을 주지 않는다. 리팩터의 "wire 불변" 주장과 부합.

### 4. `ExecutionStatusDto` 소비처 전수 확인

```
grep -rn "ExecutionStatusDto" codebase/backend/src --include="*.ts" | grep -v .spec.ts
```
결과: `interaction.service.ts`(정의·생성) + `interaction.controller.ts`(단순 반환 타입 passthrough, 필드 접근 없음: `return this.interactionService.getStatus(ctx);`) 뿐. SSE adapter(`websocket.service.ts` 등), notification 관련 모듈(`hooks.service.ts` 등)에서의 `ExecutionStatusDto`/`ButtonsContextDto`/`NodeOutputContextDto`/`CurrentNodeDto`/`WaitingContextBase` 참조는 0건(grep 확인). 컨트롤러의 `@ApiOkWrappedResponse(ExecutionStatusDto)` 는 Swagger 데코레이터로 런타임 동작과 무관. **다른 소비자에 대한 시그니처/인터페이스 파급 없음.**

## `eia-types.ts` `currentNode` 타입 변경 검증

```diff
- currentNode?: string | null;
+ currentNode?: { id: string; type: string; interactionType: ExternalInteractionType | null } | null;
```
`channel-web-chat` 저장소 전체에서 `currentNode` 를 읽는 곳은 타입 선언 자체(`eia-types.ts:132`) 뿐이며, `.currentNode` 를 실제로 destructure/사용하는 컴포넌트·훅·테스트는 0건(grep 확인, `eia-client.ts` 는 `getStatus()` 반환 타입만 통과시킴). 또한 이 변경 이전에도 **백엔드는 이미 object 를 보내고 있었다**(origin/main 기준 backend DTO 는 이미 `{id, type, interactionType}` 였음, 이번 diff 는 backend 의 실 shape 를 안 바꿈) — 즉 기존 `string | null` 타입은 애초에 wire 현실과 불일치했던 stale/오류 타입이었고, 이번 변경은 그 타입을 실제 wire 에 맞춰 **정정**한 것이다. `packages/sdk/src/client.ts` 는 이미(이번 diff 와 무관하게) object 타입으로 정의되어 있어 일관됨. **다른 소비자를 깨뜨리는 시그니처 변경 아님.**

## 기타 부작용 관점 점검

- **전역 상태/전역 변수**: 신규 전역 변수 없음. `SSE_SEQ_PLACEHOLDER` 는 기존 모듈 상수(변경 없음, Swagger 문서 텍스트만 정정).
- **파일시스템**: `responses.dto.spec.ts`(신규 테스트)는 `Test.createTestingModule` + `SwaggerModule.createDocument` 로 인메모리 OpenAPI 문서를 생성할 뿐 `app.listen()` 을 호출하지 않는다 — 실제 포트 바인딩·파일 쓰기 없음.
- **네트워크 호출**: 없음. 테스트가 실제 HTTP 서버를 띄우지 않음(`createNestApplication()` + `init()` 만, listen 없음).
- **환경 변수**: 읽기/쓰기 없음.
- **이벤트/콜백**: `getStatus()` 흐름 자체가 REST 단발 조회이며 이번 diff 로 신규 이벤트 발행/구독이 추가되지 않음. `seq` 필드는 여전히 상수 placeholder(문서 예시값만 42→0 으로 정정, 필드 정의 자체는 무변경).
- **DTO 클래스 이름 충돌**: `ButtonsContextDto`/`NodeOutputContextDto`/`CurrentNodeDto`/`WaitingContextBaseDto` 정의는 저장소 내 유일(grep 확인) — `@ApiExtraModels` 등재로 인한 `components.schemas` 이름 충돌 없음.
- **빌드 아티팩트**: `codebase/backend/dist/**/responses.dto.d.ts` 는 `.gitignore` 로 무시되는 빌드 산출물이며 이번 diff 대상 아님.
- **`tsc --noEmit` 스팟 체크**: 백엔드 전체 기준 사전 존재하던(무관 파일들의) 오류 다수와 별개로, 이번 diff 관련해서는 `interaction.service.spec.ts` 의 **기존(사전 존재, 이번 diff 로 변경되지 않은) 라인**들이 `ButtonsContextDto | NodeOutputContextDto` 를 `Record<string, unknown>` 으로 캐스팅하는 곳에서 `TS2352`(겹치는 타입 없음 경고)를 낸다 — 이는 타입 표현력 강화(loose `Record` → 판별 union)의 **알려진 부수효과**로, 러ntime 부작용은 아니지만 별도 리뷰어(타입/빌드 관점)가 후속 조치 여부를 판단할 필요가 있다(본 리뷰의 "부작용" 범주(런타임 상태/네트워크/파일시스템/인터페이스) 밖의 컴파일 타임 이슈이므로 INFO 로만 남김).

## 작업 중 발견한 무관 이슈 (참고, 코드 리뷰 범위 아님)

리뷰 과정에서 `git stash -u` → `git stash pop` 실행 중 이 저장소(.git 공유)의 **다른 worktree/세션 소유로 보이는 stash 항목**(`backend/src/common/...` 경로, `claude/notification-actions-8806b6` 브랜치)과 일시적으로 뒤섞이는 현상을 목격했다(작업 중간 `git status` 스냅샷에 `responses.dto.ts` 가 origin/main 버전으로 되돌아간 것처럼 보이는 순간 포착). 재확인 결과 현재 워크트리는 `HEAD`(`0302bd7ea`)와 완전히 일치하는 clean 상태로 복구되었고, 남은 낯선 stash 항목은 내 소유가 아니라 판단해 건드리지 않고 그대로 두었다. **이번 코드 diff 자체가 만든 부작용이 아니라, 여러 worktree 가 `.git` 을 공유할 때 `git stash` 가 worktree-local 이 아니라 repo-global 이라서 생기는 동시성 위험**이며, 리뷰 대상 코드와는 무관하다. (본 리뷰 범위 밖이므로 등급 매기지 않음 — 참고용 기록.)

## 요약

`interaction.service.ts` 의 if/else-if → if+삼항 재구조화는 `interactionType`(`null`/`'form'`/`'buttons'`/`'ai_conversation'`) × `bc`(truthy/`undefined`) 전 조합에 대해 형식적으로 동치임을 표로 증명했다 — 관측 가능한 런타임 차이 없음. `WaitingContextBase` 타입 애너테이션은 컴파일 시 소거되는 타입 전용 구성으로 wire 에 영향 없음. `ExecutionStatusDto`/하위 variant DTO 들은 EIA 모듈 내부(`interaction.service.ts`+`interaction.controller.ts` passthrough)에서만 소비되며 SSE adapter·notification 경로 등 타 소비자와 결합되지 않아 시그니처 변경의 외부 파급이 없다. 전역 `TransformInterceptor` 가 `class-transformer` 를 쓰지 않고 원본 객체를 그대로 JSON 직렬화하므로 DTO 데코레이터/타입 변경이 Swagger 문서 이상으로 런타임 wire 를 바꿀 경로 자체가 없음을 코드로 확인했다. `channel-web-chat/eia-types.ts` 의 `currentNode` 타입 변경(`string`→object)은 아무도 `.currentNode` 를 문자열로 읽고 있지 않았고, 오히려 이전부터 실제 wire(object)와 어긋났던 stale 타입을 바로잡은 것으로 회귀가 아니다. 신규 `responses.dto.spec.ts` 는 네트워크 리스닝·파일 쓰기 없는 순수 인메모리 Swagger 문서 검증이다. 전역 변수·환경 변수·이벤트/콜백 관련 부작용도 발견되지 않았다.

## 위험도

NONE
