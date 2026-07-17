---
worktree: is-conversation-output-restructure-08f20e
started: 2026-07-17
owner: developer
---

# `isConversationOutput` 화이트리스트 drift 구조적 차단 (백로그 E)

> 작성일: 2026-07-17
> 트리거: PR #961 ai-review — architecture reviewer *"`isConversationOutput` 의 반복적 heuristic OR-체인 확장 — 이번 회귀 계열의 반복 진원지"*
> 선행: PR [#959](https://github.com/worker-ants/clemvion/pull/959) (Inv-8) · [#961](https://github.com/worker-ants/clemvion/pull/961) (rag 행)

## 배경 — 같은 버그가 세 번 났다

`isConversationOutput` 은 대화 UI 전체의 게이트다. 여기서 false 가 나오면 **미리보기 탭이 통째로 사라진다**. 그런데 그 판정의 한 축인 `CONVERSATION_END_REASONS` 는 **backend enum 을 손으로 베껴온 사본**이다:

| 시점 | 누락값 | 증상 |
|---|---|---|
| #959 이전 | `error` | **오류로 끝난 대화의 미리보기 소실** (사용자 제보) |
| #959 이전 | `condition` | 조건 라우팅으로 끝난 대화도 동일 소실 |
| 현재 | ? | 아래 §감사 참조 |

`error`·`condition` 누락은 우연이 아니라 **구조의 필연**이다 — 목록을 손으로 유지하는 한 다음 값이 추가될 때 또 빠진다.

## 근본 원인 — endReason 에 단일 SoT 가 없다 (2026-07-17 실측)

backend 의 `endReason` 도메인이 **4곳에 흩어져 선언**돼 있고 서로 다르다:

| 위치 | 선언 | 비고 |
|---|---|---|
| `nodes/core/node-handler.interface.ts:428` | `'user_ended' \| 'max_turns' \| 'condition' \| 'error'` | **인터페이스 계약** (엔진 → 핸들러) |
| `nodes/ai/ai-agent/ai-turn-executor.ts:3147·3198·3420` | 동일 4값 | 위 계약의 구현부 반복 |
| `nodes/ai/information-extractor/information-extractor.handler.ts:55-61` | `'completed' \| 'max_turns' \| 'user_ended' \| 'timeout' \| 'max_retries' \| 'error'` | **IE 자체 유니온 — 계약보다 넓다** (`completed`·`timeout`·`max_retries` 추가, `condition` 없음) |
| `ai-turn-executor.ts:1883` · `information-extractor.handler.ts:579` | `endReason: 'out'` | 유니온에 **없는 값** (단일턴 종결) |

frontend 사본(`output-shape.ts` `CONVERSATION_END_REASONS`)은 6값 — 위 어느 선언과도 정확히 일치하지 않는다.

### 감사 결과

- **`'out'` — 무해**: 단일턴 종결(`{ extracted \| response, endReason:'out', turnCount:1 }`)로 **`result.messages` 가 없다**. `looksLikeConversationEnd = hasResultMessages && …` 가 먼저 걸러 화이트리스트에 없어도 영향 없음.
- **`'completed'` — 생산됨 (초안 오류 정정)**: 초안은 "backend emit 지점 미발견" 이라 적었으나 **틀렸다** — `endReason: 'completed'` 형태만 grep 해서 **인자로 넘기는 호출부를 놓쳤다**. 실제로는 `buildMultiTurnFinalOutput(state, 'completed', …)` (IE L842) 로 생산된다. `max_turns`(L845)·`max_retries`(`runResult.forcedEnd`) 도 같은 형태.
- **`'timeout'` — 죽은 값**: IE 유니온(L60)에 선언만 있고 생산자가 없으며 `portForEndReason` 에 case 조차 없다(default → `'error'`). **다만 선언된 이상 언제든 살아나고, 그때 화이트리스트에 없으면 즉시 미리보기 소실이다** (= `error` 가 그랬던 그대로).

→ **현재 화이트리스트는 우연히 맞다.** 문제는 순전히 **구조** — 손으로 유지되고 가드가 없다. 값 하나하나의 현재 도달 가능성은 부차적이다.

## 추가 발견 — 기존 가드의 컴파일타임 체크가 거짓 음성 (2026-07-17 실측)

확장하려던 [`interaction-type-exhaustiveness.test.ts`](../../codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts) 자체에 결함이 있다.

```ts
// 주석 (L54-55): "If you add a value to the type, the next line
//                 errors until ENUM_VALUES includes it."
const _typecheck: ReadonlyArray<WaitingInteractionType> = ENUM_VALUES;
```

**주석의 주장이 거짓이다.** `ReadonlyArray<T> = VALUES` 는 `VALUES ⊆ T` (각 원소가 T 에 대입 가능) 만 검사하고, `T ⊆ VALUES` 는 검사하지 않는다. 즉 **유니온에 값을 추가해도 컴파일이 통과**한다.

격리 실측:

| 구조 | `type T = "a"\|"b"\|"c"`, `VALUES = ["a","b"]` | 결과 |
|---|---|---|
| `const _t: ReadonlyArray<T> = VALUES` (기존) | `'c'` 누락 | **에러 없음 — 미검출** |
| `type Missing = Exclude<T, (typeof VALUES)[number]>;`<br>`const _n: [Missing] extends [never] ? true : never = true;` | 동일 | `error TS2322: Type 'true' is not assignable to type 'never'` — **검출** |

→ `WaitingInteractionType` · `ConversationTurnSource` 두 가드 모두 **런타임 grep 절반만 살아있고 컴파일타임 절반은 죽어 있다**. `#960`("Workflow 계약 충돌로 BLOCK 이 거짓 음성") 과 같은 계열 — **가드를 신뢰했는데 안 잡고 있던** 경우다.

E 가 이 파일을 건드리는 김에 **함께 고친다** (같은 파일·같은 결함 계열).

## 설계 — 목록을 없애지 말고, 어긋나면 깨지게 한다

두 선택지가 있고, 강도와 비용이 다르다.

### 옵션 A — 교차 스택 런타임 가드 (테스트)

frontend 테스트가 **backend 선언 파일을 읽어** 화이트리스트 포함 여부를 검증한다. 기존 가드가 이미 `readRepoFile(join(__dirname, "../../../../../", relPath))` 로 **repo root 부터 읽으므로** backend 파일 접근이 가능하다 (실측 확인).

| | |
|---|---|
| **강도** | 런타임(테스트 시점). backend 선언을 **문자열 파싱**하므로 선언 형태가 바뀌면 파서가 놓칠 수 있다 |
| **비용** | 낮음 — 테스트 1파일. backend·빌드 무변경 |
| **위험** | **파싱 실패가 조용한 통과(거짓 음성)로 이어질 수 있다** — `#960`·위 §추가발견과 같은 함정. sanity assert 필수 |

### 옵션 B — 공유 패키지로 enum 통합 (컴파일타임)

`@workflow/*` 패키지에 endReason 을 두고 backend·frontend 가 **같은 타입을 import**. frontend 화이트리스트는 `Exclude` 구조로 **컴파일 타임에** 강제된다.

**초안의 기각 근거는 약하다** — 실측 결과 **공유 패키지는 이 저장소의 예외가 아니라 주력 패턴**이다:

| 패키지 | backend 사용 |
|---|---|
| `node-summary` | **30곳** |
| `expression-engine` | 7곳 |
| `graph-warning-rules` | 2곳 |
| `chat-channel-validation` | 2곳 |

4개 전부 backend·frontend 양쪽이 쓴다. "enum 하나를 위한 패키지" 도 아니다 — `@workflow/ai-end-reason` 같은 이름으로 endReason·interactionType·backend `ConversationTurnSource` 등 **노드 출력 계약 전반**을 담을 자연스러운 자리가 있다.

| | |
|---|---|
| **강도** | **컴파일타임** — drift 가 구조적으로 불가능 (파싱 없음) |
| **비용** | 높음 — 패키지 신설 + backend 선언 4곳 교체 + 빌드/tsconfig |
| **막는 문제** | **선결 과제가 있다** ↓ |

**옵션 B 의 선결 과제**: backend 의 두 유니온이 **서로 다르다** — AI Agent 4값(`condition` 있음, `completed`·`timeout`·`max_retries` 없음) vs IE 6값(반대). 하나로 합치려면 *"두 노드가 같은 endReason 도메인을 공유해야 하는가"* 라는 **설계 결정**이 선행돼야 한다. 이건 E 보다 큰 질문이고, 잘못 합치면 각 노드의 종결 의미가 흐려진다.

### 채택 — **옵션 B** (사용자 결정, 2026-07-17)

초안은 "B 의 선결 과제(유니온 통합)가 E 보다 크다" 며 A 를 권했으나, 사용자가 B 를 선택했다. **그리고 재검토 결과 그 선결 과제는 실재하지 않는다** — 아래 §유니온 분기 해소.

**A 대비 B 의 결정적 이점**: A 는 화이트리스트를 **남겨두고 감시**하지만, B 는 **화이트리스트 자체를 없앤다**. frontend 가 패키지의 배열을 import 하면 손으로 유지할 목록이 사라져 **drift 가 구조적으로 불가능**해진다. A 의 문자열 파싱·거짓 음성 위험도 함께 소멸한다.

### 유니온 분기 — 통합할 필요가 없다 (초안 전제 정정)

초안은 *"AI Agent 4값 vs IE 6값을 하나로 합치려면 설계 결정이 선행돼야 한다"* 고 봤다. **틀렸다** — 합칠 필요가 없다. 각 노드의 정밀한 도메인을 **그대로 두고**, 소비자용 **파생 유니온**만 추가하면 된다:

```ts
// @workflow/ai-end-reason
export type AiAgentEndReason =
  | 'user_ended' | 'max_turns' | 'condition' | 'error';

export type InformationExtractorEndReason =
  | 'completed' | 'max_turns' | 'user_ended' | 'timeout' | 'max_retries' | 'error';

// `'out'`(단일턴 종결) 은 **패키지에 넣지 않는다** — backend 의 두 곳이
// `endReason: 'out' as const` 로 인라인 추론할 뿐 유니온으로 선언한 적이 없고,
// 타입만 만들어 두면 소비처 없는 죽은 export 가 된다. 그 2곳까지 타입화하려면
// E-3 범위가 커지므로 별건으로 둔다 (§결정 기록).

/** 대화 UI 가 "종결" 로 인식해야 하는 전체 도메인 (파생 — 손으로 유지하지 않는다) */
export type ConversationEndReason =
  | AiAgentEndReason
  | InformationExtractorEndReason;
```

각 노드는 자기 유니온을 그대로 쓰므로 **종결 의미가 흐려지지 않는다**. frontend 는 파생 유니온 하나만 보면 된다.

### 화이트리스트를 패키지가 소유한다 (핵심)

값 배열도 패키지가 export 하고, **패키지 내부에서 양방향 강제**한다:

```ts
export const CONVERSATION_END_REASONS = [
  'user_ended', 'max_turns', 'condition', 'error',
  'completed', 'timeout', 'max_retries',
] as const satisfies readonly ConversationEndReason[];
//  ↑ satisfies  → 배열 ⊆ 유니온 (오타·죽은 값 차단)

type _Missing = Exclude<ConversationEndReason, (typeof CONVERSATION_END_REASONS)[number]>;
const _exhaustive: [_Missing] extends [never] ? true : never = true;
//  ↑ Exclude    → 유니온 ⊆ 배열 (누락 차단 — E-1 에서 실측한 그 구조)
void _exhaustive;
```

`satisfies` 와 `Exclude` 가 **양방향**을 잠근다. 어느 노드 유니온에 값이 추가되면 **패키지 컴파일이 깨진다**.

frontend 는:

```ts
import { CONVERSATION_END_REASONS } from "@workflow/ai-end-reason";
const END_REASONS: ReadonlySet<string> = new Set(CONVERSATION_END_REASONS);
```

→ **frontend 에 유지할 목록이 없다.** `#959` 류 drift 가 발생할 자리 자체가 사라진다.

> `'timeout'` 은 현재 죽은 값이지만 IE 유니온이 선언한 이상 파생 유니온에 포함된다 — 과다 포함은 `hasResultMessages` 가 흡수해 무해하다 (§불변량). 반대로 죽은 값을 빼려면 **IE 유니온에서 지우는 게 옳은 자리**이고, 그건 별개 판단이다.

## Phase 1 — spec

착수 전 `/consistency-check --spec` 의무 (완료 — `review/consistency/2026/07/17/15_06_14/`).

**초안의 "CT-S21 신설" 은 폐기한다.** B 에서는 drift 가 **컴파일 타임에** 막히므로, `conversation-thread.md §9.10` 에 런타임 회귀 시나리오를 추가하면 **TypeScript 를 테스트하는 꼴**이 된다 — 의미 없는 시나리오는 표만 무겁게 하고 다음 사람에게 "이건 왜 있지" 를 남긴다.

대신 spec 작업은 세 가지다:

1. **endReason 영구 귀속처 = `interaction-type-registry.md` §4** (확정, 2026-07-17). 후보였던 `node-output.md` 는 **봉투 구조**의 SoT 라 값 도메인을 얹으면 경계가 흐려지고, `conversation-thread.md` 는 대화 UI 규약이라 IE 의 비대화 종결까지 담기엔 범위가 안 맞는다. `interaction-type-registry.md` 는 **"cross-cutting enum 누락" 문제의 거버넌스 진입점**이고 endReason 이 정확히 그 문제 계열이므로 자연스러운 자리다 — 다만 해법이 달라(패키지 SoT) 매트릭스가 아니라 별도 절로 둔다.
2. **E-6** — `interaction-type-registry.md` 등록 + **거짓 보증 정정**.
3. **E-7** — AI Agent / IE spec 산문에 패키지 backlink.

> **런타임 테스트가 아예 없는 건 아니다**: 패키지 자체 jest 로 `CONVERSATION_END_REASONS` 가 기대 집합인지, frontend 쪽은 `isConversationOutput` 이 **각 endReason + messages 조합을 대화로 인식하는지** 를 본다 (Phase 3). 이건 타입이 아니라 **동작** 검증이라 의미가 있다.

## Phase 2 — 구현

착수 전 `/consistency-check --impl-prep` 의무.

### E-1. 기존 가드의 거짓 음성 수정 (같은 파일·같은 결함 계열)

`WaitingInteractionType` · `ConversationTurnSource` 두 곳의 `const _t: ReadonlyArray<T> = VALUES` 를 **양방향 강제 구조**로 교체:

```ts
type MissingX = Exclude<WaitingInteractionType, (typeof ENUM_VALUES)[number]>;
const _noMissingX: [MissingX] extends [never] ? true : never = true;
void _noMissingX;
```

거짓 주석("If you add a value to the type, the next line errors…")도 실제 동작에 맞게 정정한다.

> **회귀 검증 의무**: 교체 후 **일부러 유니온에 값을 추가해 컴파일이 깨지는지 실측**한다. 통과 자체는 검증이 아니다 (#961 최종 라운드에서 Inv-9 테스트가 껍데기였던 사례).

### E-2. `@workflow/ai-end-reason` 패키지 신설

`codebase/packages/graph-warning-rules` 를 최소 템플릿으로 (`package.json` / `tsconfig.json` / `eslint.config.mjs` / `README.md` / `src/index.ts` + jest).

**배선** (실측 확인):
- `pnpm-workspace.yaml` 이 이미 `codebase/packages/*` 를 포함 → 워크스페이스 등록 자동
- `codebase/backend/package.json` · `codebase/frontend/package.json` 에 `"@workflow/ai-end-reason": "workspace:*"` 추가 (기존 4개와 동일 형태)

**내용**: 위 §유니온 분기 · §화이트리스트 소유 의 타입·배열 + 패키지 내부 양방향 강제.

**명명** (naming_collision WARNING 반영): 초안의 `node-output-contract` 는 **폐기**한다 — (a) `spec/conventions/node-output.md`(id: `node-output`) 가 `NodeHandlerOutput` 5필드 계약 전체의 SoT 이고 **본 작업이 편집하는 `node-handler.interface.ts` 를 소유**한다. 그 이름의 패키지는 **SoT 참칭**으로 읽힌다. (b) 열린 `node-output-redesign` plan 과도 주제가 겹친다. (c) 무엇보다 **기존 4개 패키지의 명명 패턴은 "담은 것을 그대로 이름짓기"** 다 (`chat-channel-validation` = "chat-channel provider-issued plaintext 검증 상수"). 포부형 광범위 이름은 패턴 위반.

→ **`@workflow/ai-end-reason`** — AI Agent·IE 가 생산하는 endReason 도메인, 딱 그것만.

**범위 한정**: endReason 만 담는다. `interactionType`·backend `ConversationTurnSource` 는 **`interaction-type-registry.md` 가 이미 SoT 로 소유**하므로 이 패키지로 옮기면 SoT 가 갈린다 — 향후에도 그 문서의 결정 없이는 옮기지 않는다 (초안의 "자리를 열어둔다" 는 서술 철회).

### E-3. backend 선언부를 패키지 import 로 교체 (~~5곳~~ → **6곳**)

| 파일 | 교체 |
|---|---|
| `nodes/core/node-handler.interface.ts:428` | `endReason: AiAgentEndReason` |
| `nodes/ai/ai-agent/ai-turn-executor.ts:3147·3198·3420` | 동일 |
| `nodes/ai/information-extractor/information-extractor.handler.ts:55-61` | `type EndReason = InformationExtractorEndReason` (로컬 별칭 유지 — 호출부 무변경) |
| **`nodes/ai/ai-agent/ai-agent.handler.ts:192`** | **`endReason: AiAgentEndReason`** — 초안이 놓친 6번째 선언처 (아래) |

**동작 무변경** — 리터럴 유니온을 같은 값의 named 타입으로 바꾸는 것뿐이다.

> **"5곳" 은 틀렸다 (2026-07-17 실측 정정)**: 최초 구현(`f0ef4a821`) 후 `ai-agent.handler.ts:192` 에 `'user_ended' | 'max_turns' | 'condition' | 'error'` 인라인 사본이 **그대로 남아 있었다** — engine 이 부르는 handler 표면이 executor 로 위임하는 얇은 래퍼라 초안 조사에서 빠졌다. `grep -rn "user_ended" src/ | grep "|"` 전수로 확인한 결과 backend 에 남은 **마지막** 손 사본이었고 지금은 0곳이다. 리뷰 3인 전원이 이걸 못 본 건 diff-scope 오염으로 reviewer 에게 `codebase/**` 가 안 갔기 때문이다 (§Phase 4).

### E-3b. `MULTI_TURN_INTERACTION_TYPES` — 같은 함수의 **두 번째** 무가드 손 목록 (재검토 발견)

`isConversationOutput` 이 쓰는 하드코딩 목록은 **둘**이다 (초안은 endReason 만 봤다):

```ts
const MULTI_TURN_INTERACTION_TYPES: ReadonlySet<string> = new Set([
  "ai_conversation", "ai_form_render",   // ← WaitingInteractionType 의 부분집합
]);
```

**실측**: `output-shape.ts` 는 기존 가드의 `REGISTRY_SITES`([`interaction-type-exhaustiveness.test.ts:37-41`](../../codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts)) 에 **없다**. 즉 새 multi-turn interactionType 이 생기면 이 목록에서 누락돼 **endReason 과 똑같이 미리보기가 사라진다**.

**조치**: `output-shape.ts` 를 `REGISTRY_SITES` 에 추가 — **1줄**. 가드가 이미 값별 grep 을 하므로 그것만으로 닫힌다.

> `MULTI_TURN_INTERACTION_TYPES` 를 패키지로 옮기지는 **않는다**: 이건 `WaitingInteractionType`(4값)의 **부분집합**(multi-turn 인 2값)이라 파생 관계가 다르고, 그 enum 은 `interaction-type-registry.md` 가 이미 SoT 로 소유한다. 패키지로 옮기면 SoT 가 갈린다 — 기존 거버넌스에 사이트만 등록하는 게 맞다.

> **위 "조치" 는 실행되지 않았다 (2026-07-17 실측 정정)**: `output-shape.ts` 를 `REGISTRY_SITES` 에 추가하는 대신, `interaction-type-registry.ts` 에 `IS_MULTI_TURN_INTERACTION: Record<WaitingInteractionType, boolean>` exhaustive 구조를 신설해 `MULTI_TURN_INTERACTION_TYPES` 를 그 파생으로 바꿨다(`f17fc18dd`). 이유: `REGISTRY_SITES` 모델은 "등록된 모든 값이 모든 사이트에 문자열로 등장" 을 grep 으로 요구하는데, `MULTI_TURN_INTERACTION_TYPES` 는 `INTERACTION_TYPE_VALUES`(4값)의 **부분집합**(multi-turn 인 2값)만 담는다 — `output-shape.ts` 를 문자 그대로 `REGISTRY_SITES` 에 추가했다면 그 파일에 `"form"`/`"buttons"` 리터럴이 등장하지 않아(실측: `grep -n '"form"\|"buttons"' output-shape.ts` 매치 0건) 가드가 이 둘을 "누락" 으로 오탐해 테스트가 깨졌을 것이다. `Record<WaitingInteractionType, boolean>` 방식은 "값이 존재하느냐" 가 아니라 "빠짐없이 분류했느냐" 를 묻는 exhaustive 구조라 부분집합에도 안전하다(근거: `interaction-type-registry.ts` 의 `IS_MULTI_TURN_INTERACTION` JSDoc). 강도는 동일하게 컴파일타임 — `output-shape.ts` 는 여전히 `REGISTRY_SITES` 목록엔 없지만, `MULTI_TURN_INTERACTION_TYPES` 자체가 이제 그 exhaustive 가드의 파생값이라 별도 grep 사이트 등록이 애초에 불필요해졌다.

### E-4. frontend — 화이트리스트 제거

`output-shape.ts` 의 `CONVERSATION_END_REASONS` 하드코딩 배열을 **삭제**하고 패키지 import 로 교체. `isConversationOutput` 의 **동작·조건은 무변경** (이 함수는 대화 UI 전체의 게이트라 건드리는 순간 회귀 위험이 크고, 이번 목표는 drift 차단이지 리팩토링이 아니다). 각 OR 갈래가 무엇을 판정하는지 주석만 정리.

### E-5. 배선 전수 (실측 확정 — 이 변경의 최대 위험)

메모리 교훈(`pnpm node-linker isolated 전환`): **tsc 통과 ≠ 런타임 정상**. 초안은 Docker 를 "확인" 이라고만 적었으나, 실측 결과 **하드코딩 목록이 6곳**이고 빠뜨리면 조용히 깨지거나 **조용히 검증이 사라진다**.

| # | 파일 | 필요한 추가 | 빠뜨리면 |
|---|---|---|---|
| 1 | `codebase/backend/Dockerfile` | **2줄** — `:19-24` package.json COPY + `:32-35` **소스** COPY | install 은 되고 **build 에서 깨짐** |
| 2 | `codebase/frontend/Dockerfile` | **1줄** — `:25-30` package.json COPY (소스는 `:33` 이 통째 복사) | install 깨짐. **backend 와 비대칭** — 이 차이를 놓치면 한쪽만 깨진다 |
| 3 | `codebase/frontend/Dockerfile.playwright-e2e` | **2줄** — `:29-34` + `:42-` (backend 와 동형 2단) | e2e 이미지 빌드 깨짐 |
| 4 | `docker-compose.e2e.yml` | **1줄** — `playwright-runner.volumes` 마스킹 | **e2e `config-guard` job 하드 실패** (아래) |
| 5 | **`.github/workflows/packages-checks.yml` `paths:`** (`:10-13`) | **2줄** — `pull_request` **와 `push` 둘 다** (아래) | **패키지를 고쳐도 CI 가 안 돈다** (조용한 무검증) |
| 6 | **동 파일 `matrix.pkg`** (`:41-`) | 1줄 | **신규 패키지 lint/test/build 가 CI 에서 통째로 빠진다** |
| **7** | **`.claude/test-stages.sh` `INTERNAL_PACKAGES`** | **1줄** | **로컬 wrapper 의 lint/unit/build 에서 통째로 빠진다** (아래) |
| — | `pnpm-workspace.yaml` | 불필요 — `codebase/packages/*` 글롭 | |
| — | `codebase/{backend,frontend}/package.json` | `"@workflow/ai-end-reason": "workspace:*"` | |

**5·6 이 특히 위험하다** — 빌드는 통과하는데 **CI 검증만 조용히 사라진다**. 이번 세션에서 반복 확인된 "가드가 있는 줄 알았는데 안 돌던" 계열이다.

> **"6곳" 도 틀렸다 (2026-07-17 실측 정정)**: 표가 **7번째(`.claude/test-stages.sh`)를 빠뜨렸고**, 그 결과 최초 구현 후 이 패키지의 lint·unit·build 가 **로컬 wrapper 3단계 전부에서 한 번도 실행되지 않았다**. `INTERNAL_PACKAGES` 가 손 유지 배열이라 신규 패키지가 자동 등록되지 않는다 — `status=PASS` 를 받고도 이 패키지에 관한 한 껍데기였다. 표가 스스로 "조용한 무검증" 을 경고하면서 정확히 그 함정에 빠진 셈이다. **교훈: 배선처는 "몇 곳" 을 세지 말고 신규 패키지명을 repo 전수 grep 해 확인한다** (`grep -rn "chat-channel-validation" --include="*.yml" --include="*.sh" --include="Dockerfile*"` 처럼 **기존 패키지명**으로 grep 하면 등록돼야 할 자리가 전부 나온다).
>
> 4 도 표기가 안일했다 — "mask/volume 확인" 이라 적었으나 실제로는 `scripts/check-e2e-playwright-config.py` 가 강제하는 **하드 게이트**였고, 누락 상태로 `config-guard` job 이 exit 1 이었다 (side_effect 리뷰가 재현). `docker build` 성공은 이 게이트를 커버하지 않는다.

**검증 순서**: 루트 **clean** `pnpm install` (메모리: in-place 하이브리드 오염) → backend·frontend build → **Docker 빌드 authoritative** (3개 Dockerfile 모두).

### E-6. 기존 거버넌스에 등록 + 거짓 보증 정정 (cross_spec WARNING 1)

이 저장소는 **"cross-cutting enum 값 추가 시 N곳 누락"** 문제 계열에 대해 **이미 공식 거버넌스**를 갖고 있다 — `spec/conventions/interaction-type-registry.md` 매트릭스 + `PROJECT.md` "변경 유형 → 갱신 위치 매핑" + `.claude/config/doc-sync-matrix.json`(CI 강제). endReason 은 **구조적으로 동일한 문제**인데 draft 가 별도 메커니즘(공유 패키지)으로만 풀고 등록을 안 했다.

1. **`interaction-type-registry.md` 에 endReason 등록** — 다만 다른 enum 들과 달리 **"패키지가 SoT, 가드 불필요"** 로 서술한다 (메커니즘이 다르므로).
2. **`interaction-type-registry.md:125` 의 과장된 보증 정정** — **정밀하게 쓴다** (rationale WARNING):

   문서가 든 3중은 ① 매트릭스 SoT ② AST grep 가드 ③ TypeScript exhaustive switch 다. **③ 은 정상 동작한다** (본 세션에서 `rag` 추가 시 실제로 `Type '"rag"' is not assignable to type 'never'` 로 막았다). 죽은 건 3중 중 하나가 아니라 **② 의 선결 조건**이다:

   - ② 는 `ENUM_VALUES` 의 각 값이 각 사이트에 등장하는지 grep 한다 — **`ENUM_VALUES` 가 타입과 일치한다는 전제** 위에서만 의미가 있다.
   - 그 전제를 지키라고 놓인 `const _typecheck: ReadonlyArray<T> = ENUM_VALUES` 가 **`VALUES ⊆ T` 만 검사**한다 → 타입에 값이 추가돼도 통과 → ② 가 **낡은 목록을 검사**하게 된다.

   → 정정문은 **"3중 가드가 죽었다"가 아니라 "② 앞의 연결고리(`ENUM_VALUES` ↔ 타입 동기화)가 약했고 E-1 이 그것을 `Exclude` 로 잠갔다"** 로 쓴다. "영구히 차단" 같은 절대 표현도 실제 강도에 맞게 완화한다.
3. **`PROJECT.md` doc-sync 매트릭스** — endReason 행 추가 여부 판단 (패키지가 SoT 면 갱신 위치가 1곳이라 매트릭스 대상이 아닐 수 있다 — 그 판단 자체를 명시).

### E-7. spec 산문의 2차 SoT 에 backlink (cross_spec WARNING 2)

패키지가 code-level SoT 가 돼도 **spec 산문의 값 열거가 남는다**:

| 문서 | 위치 | 결과 |
|---|---|---|
| `spec/4-nodes/3-ai/1-ai-agent.md` | ~~§3.2~~ · **§7** | §7 상단에 backlink (`9df2bb42f`) |
| `spec/4-nodes/3-ai/3-information-extractor.md` | ~~§3.2~~ · **§5.6** | §5.6 상단에 backlink (`9df2bb42f`) |

기존 공유 패키지 관례(`cross-node-warning-rules.md` 등)는 **해당 spec 에 패키지를 SoT 로 지목하는 backlink** 를 남긴다. 동일 적용.

> **§3.2 는 대상이 아니다 (2026-07-17 실측 정정)**: 초안이 §3.2 를 지목했으나 양쪽 문서의 §3.2 는 **출력 포트 표**이지 endReason 값 열거가 아니다. 포트 id 가 endReason 값과 상당수 겹쳐(`user_ended` / `max_turns` / `error` / `completed`) 열거처럼 보이지만 **다른 도메인**이다 — 패키지는 endReason **값 도메인**만 소유하고 **port 매핑은 spec 이 소유**한다는 게 이 설계의 경계이며(§7·§5.6 backlink 본문이 그렇게 명시), §3.2 에 패키지를 SoT 로 지목하면 그 경계를 정면으로 흐린다. backlink 는 값을 실제로 열거하는 §7·§5.6 에만 붙는 게 맞다.

**+ endReason 도메인의 영구 귀속처 지정** (convention WARNING 4): 설계 rationale 이 plan 파일에만 있으면 plan 이 `complete/` 로 이동한 뒤 고아가 된다. 기존 4개 패키지가 모두 갖는 "spec 안의 영구 계약 서술처" 를 endReason 에도 지정한다.

→ **확정: [`spec/conventions/interaction-type-registry.md §4`](../../spec/conventions/interaction-type-registry.md)** (Phase 1 §1, `9df2bb42f`). 후보였던 `node-output.md`(봉투 구조 SoT — 값 도메인을 얹으면 경계가 흐려짐)·`conversation-thread.md`(대화 UI 규약 — IE 의 비대화 종결까지 담기엔 범위 불일치) **둘 다 기각**하고 제3의 위치를 골랐다. 근거는 Phase 1 §1 참조. 이 plan 이 `complete/` 로 가도 §4 가 살아있는 귀속처이므로 rationale 은 고아가 되지 않는다.

## Phase 3 — 테스트 · Phase 4 — `/ai-review`

`#959`·`#961` 교훈: **코드 동결 후 마지막 리뷰 라운드**를 돌려 게이트 재무장 루프를 피한다. 테스트는 **mutation 을 주입해 red 가 되는지 실측** — 통과 자체는 검증이 아니다 (#961 최종 라운드에서 Inv-9 테스트가 껍데기였던 사례).

## 결정 기록

- **옵션 B(공유 패키지) 채택** (사용자 결정, 2026-07-17). 초안은 A(런타임 가드)를 권했으나 사용자가 B 를 선택했고, 재검토 결과 **B 가 더 낫다**: A 는 화이트리스트를 남겨두고 감시하는 반면 **B 는 화이트리스트 자체를 없앤다**. A 의 문자열 파싱·거짓 음성 위험도 함께 소멸.
- **초안의 "선결 과제" 전제는 틀렸다**: AI Agent/IE 유니온을 **합칠 필요가 없다** — 각 노드 도메인을 그대로 두고 **파생 유니온**(`ConversationEndReason = AiAgentEndReason | InformationExtractorEndReason`) 만 추가하면 소비자 요구가 충족된다. 종결 의미가 흐려지지 않는다.
- **B 에선 `⊇` 가 아니라 `===` 다 (A 전제 정정)**: 초안의 "⊇(superset) 강제" 는 **옵션 A 전용 논리**였다 — frontend 가 목록을 소유할 때 과다 포함을 허용하자는 것. **B 는 배열을 패키지가 소유하고 `satisfies`(⊆) + `Exclude`(⊇) 로 양방향을 잠그므로 배열 === 파생 유니온**이다. 과다·과소 둘 다 컴파일 에러 (3방향 실측 검증 — §설계).
- **`'out'` 은 파생 유니온에 없다 (의도)**: 두 노드 유니온 어디에도 없으므로 `ConversationEndReason` 에 안 들어가고, 따라서 frontend Set 에도 없다. **무해** — 단일턴 종결이라 `result.messages` 가 없어 `hasResultMessages` 가 먼저 거른다. (초안이 "과다 포함 예시" 로 든 `'out'` 은 B 에선 애초 포함되지 않는다.)
- **`'timeout'`(죽은 값)은 파생 유니온에 포함**: IE 유니온이 선언한 이상 `satisfies`/`Exclude` 가 배열 포함을 **강제**한다. 무해하며(`hasResultMessages` 게이트), 빼려면 **IE 유니온에서** 지우는 게 옳은 자리 — 별개 판단이다.
- **패키지명 `@workflow/ai-end-reason` · endReason 한정** (초안 `node-output-contract` 폐기): 초안은 "이름을 넓게 두고 자리를 열어둔다" 였으나 **철회**한다 — (a) `node-output.md` 가 `NodeHandlerOutput` 계약 전체의 SoT 이자 본 작업이 편집하는 `node-handler.interface.ts` 의 소유자라 **참칭**으로 읽히고 (b) 기존 4개 패키지의 명명 패턴은 **"담은 것을 그대로 이름짓기"** 다. `interactionType`·`ConversationTurnSource` 는 `interaction-type-registry.md` 가 SoT 이므로 그 문서의 결정 없이는 이관 대상이 아니다 — 열어둘 자리가 애초 없다.
- **기존 가드 거짓 음성 동반 수정**: `interaction-type-exhaustiveness.test.ts` 의 `ReadonlyArray<T> = VALUES` 는 누락을 못 잡는다(실측). 같은 파일·같은 결함 계열이라 E 에서 함께 고친다 — 이 수정이 없으면 새로 만든 패키지 가드만 정상이고 기존 두 가드는 계속 거짓 음성으로 남는다.
