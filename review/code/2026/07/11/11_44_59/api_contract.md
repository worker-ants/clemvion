# API 계약(API Contract) 리뷰 — `eia-client-context-types-33e771`

대상: `git diff 1682777fe..HEAD` (2 commits — `964e887af` feat client types, `428134b64` test guard+links). PR #904(백엔드 closed-oneOf schematization)의 후속으로, 클라이언트 측(`@workflow/sdk`, `channel-web-chat` 위젯) `context` 타입을 백엔드 계약에 맞춰 정밀화하는 변경.

## 검증 방법

주장을 코드 읽기뿐 아니라 실제 컴파일/테스트로 실증했다:
- `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` (PR #904 산출물)와 클라이언트 신규 타입을 필드 단위 대조.
- `codebase/channel-web-chat`: `npx tsc --noEmit`, `npx vitest run src/lib/eia-events.test.ts`, `npx eslint`.
- `codebase/packages/sdk`: `npx tsc --noEmit`, `npx jest`.
- `codebase/frontend`: `npx vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` (2번째 커밋의 링크 가드).
- Base commit(`1682777fe`)을 별도 detached worktree 로 체크아웃해 **변경 전에도 동일한 tsc 에러가 존재**하는지 대조(신규 에러 유입 여부 판별).

## 답변 (요청된 5개 항목)

### (1) SDK `ExecutionStatus.context` narrowing 이 breaking change 인가

`codebase/packages/sdk/package.json`: `"version": "0.1.0"`, `private` 플래그 없음(기술적으로 publish 가능한 형태). 그러나:
- `plan/complete/eia-sdk-publish.md` 에 **사용자 확정 결정**이 있다 — "Publish 시점: internal-only(별도 지정 전까지)", "버저닝 정책: v0.x — **internal 단계 동안 minor breaking 허용**". 즉 현재 v0.x 단계에서 SDK export surface 를 좁히는 변경은 정책상 명시적으로 허용된 범주다.
- repo 전체에서 `@workflow/sdk` 소비처는 `codebase/channel-web-chat`(devDependency, `workspace:*`) 외부에 없다(grep 결과 npm registry 배포·외부 partner 소비 흔적 없음). 실제 registry publish 이력도 없다.
- 변경은 **컴파일 타임에만** 영향을 준다. `context?: Record<string, unknown> | null` → `context?: WaitingContext | null` 은 구조적으로 이전에 그 필드를 읽던 코드(예: `.context as SomeType`, `.context?.foo`)를 대부분 그대로 통과시킨다(`WaitingContext` 도 결국 object 이므로). 깨지는 경우는 "context 를 임의 키로 인덱싱"하는 코드뿐인데, 그런 소비처가 in-repo 에 없다.

**판정**: 이론상 SemVer 상 breaking(narrowing 은 export 타입의 소비자-visible 계약을 좁힘)이지만, (a) v0.x pre-1.0, (b) 정책으로 이미 "v0.x 기간 breaking 허용" 이 사용자 승인됐고, (c) internal-only(외부 소비자 부재), (d) 런타임 영향 없음 — 실질 위험은 **LOW/INFO**. `eia-sdk-publish.md` 의 "외부 publish 결정 시 v1 SemVer/마이그레이션 가이드 재논의"(§결정 #4 비고)가 이미 이 케이스를 커버하므로 이번 PR 에서 추가 조치(버전 bump·CHANGELOG)는 강제 사항 아님 — 단, 향후 실제 publish 시점에는 이런 narrowing 들을 모아 마이그레이션 노트에 반영해야 한다(이미 추적 중인 plan 항목).

### (2) 클라이언트 `WaitingContext` 가 백엔드 `ExecutionStatusDto.context`(PR #904) 를 정확히 미러하는가

`codebase/backend/.../dto/responses.dto.ts` 대조 결과:

| 필드 | 백엔드 (`WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto`) | 위젯 (`eia-types.ts`) | SDK (`client.ts`) | 일치 여부 |
|---|---|---|---|---|
| `interactionType` | `'form' \| 'buttons' \| 'ai_conversation'` (required) | `ExternalInteractionType`(동일 3값 literal union, required) | `'form' \| 'buttons' \| 'ai_conversation'`(required) | 정확히 일치 |
| `waitingNodeId` | `string` (required) | `string` (required) | `string` (required) | 일치 |
| `conversationThread` | `ConversationThread`, optional, **`\| null` 아님** | `ConversationThread`, optional, `\| null` 아님 | `Record<string, unknown>`, optional, `\| null` 아님 | present/optional 규약 일치. SDK 는 세부 shape 를 `Record<string,unknown>` 로 느슨화(SDK 는 자체 `ConversationThread` 타입을 두지 않는 기존 설계 — `context` 를 소비하지 않고 pass-through 만 하므로 무해) |
| `ButtonsContext.buttonConfig` | `{ buttons: unknown; nodeOutput: Record<string, unknown> }` (required) | `Record<string, unknown>` (required) | `Record<string, unknown>` (required) | **완전 일치는 아님** — 아래 발견사항 참조 |
| `NodeOutputContext.nodeOutput` | `Record<string, unknown>` (required) | `WaitingForInputEvent["nodeOutput"]`(named optional 필드 + index signature, SSE wire 재사용) | `Record<string, unknown>` (required) | 구조적으로 상위호환(위젯 쪽이 더 정밀한 명명 필드 제공), 백엔드 계약 위반 아님 |
| union 판별 방식 | discriminator 없음, 키 존재로 분기(`oneOf`, `discriminator` 미선언 — JSDoc 에 명시적 이유) | 동일(키 존재 분기, JSDoc 에 동일 근거 재기술) | 동일 | 일치 |

발견된 유일한 불일치는 `buttonConfig` 의 정밀도뿐 — INFO 로 아래 기재.

### (3) `conversationThread` — key-omitted optional, `api-convention §5.4` 부합?

`spec/5-system/2-api-convention.md §5.4`("부재 표현 — `null` vs 키 생략")를 직접 확인했다. 이 절은 **`EIA §5.3` `context.conversationThread` 를 키-생략 원칙의 정식 선례(기준 (a): 다른 표면과 wire parity)로 명시 인용**한다. 클라이언트 3곳(위젯 `WaitingContextBase`, SDK `WaitingContextBase`, 백엔드 `WaitingContextBaseDto`) 모두 `conversationThread?: T`(`| null` 없음)로 일관 선언돼 있다. **정확히 부합**.

### (4) 위젯 `WaitingContext` 가 `WaitingForInputEvent` 에 assignable 한가 (cast 제거 검증)

`codebase/channel-web-chat/src/widget/use-widget.ts` 에서 `parseWaitingForInput(status.context as WaitingForInputEvent)` → `parseWaitingForInput(status.context)` 로 cast 제거됨. 실측 검증:
- `npx tsc --noEmit -p codebase/channel-web-chat/tsconfig.json` — 에러 8건 발생(`presentation.test.ts` 2건, `use-widget-eager-start.test.ts` 6건, 전부 `EventSource`/`ControllableEventSource` 관련, 이번 diff 범위 밖 파일).
- 동일 명령을 base commit(`1682777fe`)에서 실행 — **동일한 8건**이 그대로 존재. 즉 **신규 컴파일 에러 0건** — cast 제거가 새 타입 에러를 유발하지 않았음을 실증.
- `use-widget.ts` 자체·`eia-types.ts`·`eia-events.test.ts` 에는 tsc 에러 없음. `WaitingForInputEvent` import 는 149행에서 여전히 사용 중(cast 제거로 unused-import 도 안 됨) — `npx eslint` 클린.
- `npx vitest run src/lib/eia-events.test.ts` — 22/22 통과(신규 `WaitingContext` union 테스트 4건 포함).

**결론: assignability 는 sound 하고, cast 제거는 안전하게 검증됐다.**

### (5) Runtime wire 변경 없음 (type-only)?

diff 12개 파일 중 실제 런타임 로직이 변경된 파일은 **0개**:
- `use-widget.ts` 는 `as` 캐스트 제거뿐(런타임 no-op, JS 출력 동일).
- `eia-types.ts`/`client.ts` 는 interface/type 선언 추가뿐(컴파일 타임 소거).
- `eia-events.ts`(실제 파서 구현)·`interaction.controller.ts`/`interaction.service.ts`(백엔드 응답 조립)는 **diff 에 없음** — 이번 두 커밋에서 전혀 건드리지 않았다.
- 백엔드 파일 3개(`chat-channel/types.ts`, `terminal-revoke-reconciler.types.ts`, `chat-channel-config.dto.ts`)는 JSDoc 상대링크 depth 정정뿐(주석 전용, `@ApiProperty` 등 데코레이터 인자 무변경) — 2번째 커밋("test guard+links")이 `spec-link-integrity` 가드를 `codebase/**` 소스로 확장하면서 걸린 사전 링크 오류 14곳을 정정한 것.
- `npx vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` — 13/13 통과, 신규 가드(`collectCodebaseSources`/`findBrokenSpecLinksInSources`)가 `eia-types.ts` 등을 스코프에 포함함을 자체 검증하는 테스트도 통과.

**결론: 순수 type-only 변경. wire 영향 없음.**

## 발견사항

- **[INFO]** SDK export surface narrowing — SemVer 관점 이론상 breaking, 그러나 프로젝트 정책상 사전 승인된 범주
  - 위치: `codebase/packages/sdk/src/client.ts:109-144`(`ExecutionStatus.context`), `codebase/packages/sdk/package.json:3`(`version: 0.1.0`)
  - 상세: `Record<string, unknown> | null` → `WaitingContext | null` 로 좁힘. `@workflow/sdk` 는 `private` 플래그가 없어 기술적으로 publish 가능한 패키지지만, `plan/complete/eia-sdk-publish.md` 의 확정 결정("internal-only" + "v0.x 기간 minor breaking 허용")이 정확히 이 케이스를 커버한다. 현재 registry publish 이력·외부 소비자 없음(in-repo 유일 소비처는 workspace 내부의 `channel-web-chat`).
  - 제안: 액션 불요. 단, 실제 npm publish 결정 시점(그 plan 의 "외부 publish 결정 시 v1 SemVer/마이그레이션 가이드 재논의" 항목)에 이번 narrowing 을 포함한 CHANGELOG/마이그레이션 노트를 작성할 것 — 이미 그 plan 에 추적됨(신규 갭 아님).

- **[INFO]** `ButtonsContext.buttonConfig` 타입 정밀도가 백엔드보다 느슨함
  - 위치: `codebase/channel-web-chat/src/lib/eia-types.ts:130-133`, `codebase/packages/sdk/src/client.ts:122-124`
  - 상세: 백엔드 `ButtonsContextDto.buttonConfig`는 `{ buttons: unknown; nodeOutput: Record<string, unknown> }`로 sub-shape 가 타입에 고정돼 있으나, 위젯·SDK 양쪽 모두 `Record<string, unknown>`(구조 정보 없는 open map)으로 선언했다. JSDoc 주석("SSE 와 동일 wire: `{ buttons, nodeOutput }`")으로 실제 shape 는 문서화돼 있고, 테스트(`eia-events.test.ts`, `client.spec.ts`)의 리터럴은 실제로 `{ buttons, nodeOutput }` 형태를 사용한다 — 즉 관행은 지켜지지만 타입 시스템이 강제하지 않는다.
  - 영향: 읽기 방향(서버 응답 역직렬화)이므로 안전한 방향의 느슨화 — 유효한 백엔드 페이로드를 거부할 위험은 없다. 계약 위반은 아니며 우선순위 낮음.
  - 제안: (선택) `buttonConfig: { buttons: unknown; nodeOutput: Record<string, unknown> }` 로 정밀화하면 백엔드와 1:1 미러가 완성되지만, 필수 아님 — 현 상태로도 API 계약 리스크는 없음.

- **[INFO]** 버전 미변경(`package.json` `0.1.0` 그대로)
  - 위치: `codebase/packages/sdk/package.json`
  - 상세: 타입 표면이 narrowing 됐음에도 SemVer patch/minor bump 없음.
  - 제안: internal-only + v0.x 정책상 문제 없음(위 첫 항목과 동일 근거). publish 정책이 activate 되기 전까지는 버전 관리 규율을 새로 요구할 필요 없음.

그 외 관점(에러 응답·요청 검증·URL/경로 설계·페이지네이션·인증/인가)은 이번 diff 범위 밖 — 신규/변경 엔드포인트, DTO 검증 로직, 라우팅, 인증 가드 변경이 전혀 없다(백엔드 3개 파일도 주석 전용). 해당 없음.

## 요약

이번 변경은 PR #904(백엔드 closed-oneOf 스키마화)가 이미 확정한 `ExecutionStatusDto.context: ButtonsContextDto | NodeOutputContextDto` 계약을 클라이언트(위젯 `eia-types.ts`, SDK `client.ts`) 타입에 그대로 미러하는 **순수 type-only** 변경이다. 필드 단위 대조 결과 `interactionType`/`waitingNodeId`/`conversationThread`(키-생략, `api-convention §5.4` 명시 선례와 정확히 부합) 는 백엔드와 완전 일치하고, `buttonConfig`/`nodeOutput` 는 안전한 방향(더 느슨하거나 더 정밀한 read-side 타입)으로만 차이가 있어 계약 위반이 아니다. SDK 의 `ExecutionStatus.context` narrowing 은 SemVer 상 이론적 breaking change 이지만 `@workflow/sdk` 가 v0.1.0·internal-only·"v0.x breaking 허용" 사용자 확정 정책 하에 있고 실제 외부 소비자가 없어 실질 위험은 낮다. 위젯의 `WaitingContext ⊆ WaitingForInputEvent` assignability 와 `use-widget.ts` 캐스트 제거는 base-commit 대비 tsc diff(신규 에러 0건)로 실증했고, eslint·vitest·jest 전부 클린하며, 실제 파서/컨트롤러 구현 파일은 diff 에 포함되지 않아 런타임 wire 는 완전히 무변경이다. 2번째 커밋이 추가한 `spec-link-integrity` 소스 확장 가드도 13/13 통과해 백엔드 3개 파일의 JSDoc 링크 depth 정정이 이 신규 가드에 의해 정확히 유발된 기계적 수정임을 확인했다.

## 위험도

LOW

STATUS: SUCCESS
