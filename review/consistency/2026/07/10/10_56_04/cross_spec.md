### 발견사항

- **[WARNING]** `원칙 5` 가 주장하는 `variables.__*` "예약 네임스페이스 — 사용자 변수와 충돌하지 않는다" 가 Variable Declaration/Modification 노드 spec·구현으로 보장되지 않음
  - target 위치: `spec/conventions/execution-context.md` §원칙 5 (신규 추가분), L63-69 — 특히 L65 "이 `__*` 키는 **예약 네임스페이스**로 사용자 변수와 충돌하지 않는다."
  - 충돌 대상: `spec/4-nodes/1-logic/4-variable-declaration.md`(변수 이름 규칙 — "워크플로우 내 unique 권장" 만 존재, prefix 제한 없음) · `spec/4-nodes/1-logic/5-variable-modification.md`("대상 변수 이름. 선언되지 않은 변수도 즉시 생성 가능" — prefix 제한 없음) · 구현 `codebase/backend/src/nodes/logic/variable-modification/variable-modification.handler.ts`(`context.variables[mod.variable] = value` 직접 대입, 이름 검증 없음) · `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7559`(`filterUserVariables` 가 `key.startsWith('__')` 인 모든 키를 park 영속에서 무조건 제외)
  - 상세: 사용자가 Variable Modification 노드로 `variable: "__workspaceId"` (또는 `__dryRun` / `__workspaceTimezone` / `__workspaceName`) 를 대상으로 지정하면 핸들러가 검증 없이 `context.variables["__workspaceId"] = ...` 를 직접 덮어써, 이후 Integration 조회·AI LLM 설정 해소에 쓰이는 시스템 워크스페이스 식별자가 실행 도중 오염될 수 있다. 역방향으로도, 사용자가 (의도적이든 우연이든) `__` 로 시작하는 변수명을 쓰면 `filterUserVariables` 가 park 영속 시 그 값을 통째로 drop 해 재개 후 사용자 변수가 silent 하게 소실된다. 즉 "충돌하지 않는다" 는 코드 레벨에서 강제되는 불변식이 아니라 문서상의 기대일 뿐이다. 같은 코드베이스에 이미 유사 패턴의 해법 선례가 있다 — `spec/4-nodes/6-presentation/1-carousel.md:368` 는 `button.id` 의 `__item_` prefix 충돌을 `carousel.schema.ts` 의 **schema 레벨 reject** 로 막는다.
  - 제안: (a) Variable Declaration/Modification 의 스키마에 `__` prefix 이름을 400/validation-error 로 거부하는 가드를 추가하고 두 노드 spec 에 "예약 prefix — 사용 불가" 규칙을 명문화하거나, (b) 가드를 당장 추가하지 않는다면 `execution-context.md` §원칙 5 의 "충돌하지 않는다" 문구를 "충돌해서는 안 되며, 사용자 변수명이 `__` 로 시작하지 않도록 하는 것은 현재 컨벤션일 뿐 노드 레벨에서 강제되지 않는다(잔여 리스크)" 로 하향 조정. 어느 쪽이든 두 스펙(execution-context.md ↔ variable-declaration.md/variable-modification.md)이 같은 결정을 공유해야 한다.

- **[INFO]** `원칙 5` "선례" 목록이 실제 코드 SoT(`node-handler.interface.ts`) 대비 불완전
  - target 위치: `spec/conventions/execution-context.md` §원칙 5, L67 — "선례: `__workspaceId`(...), `__workspaceTimezone`(...)."
  - 충돌 대상: `codebase/backend/src/nodes/core/node-handler.interface.ts` L64-79 JSDoc — 알려진 `__`-prefix 키로 `__workspaceId` · `__workspaceName` · `__workspaceTimezone` · `__dryRun` 4개를 문서화(코드가 본 문서의 "실제 타입 정의 SoT"). `spec/5-system/13-replay-rerun.md` L159 도 `__dryRun` 을 "기존 `__workspaceId` 등과 동일한 `__`-prefix 런타임 변수 컨벤션" 으로 이미 언급 중.
  - 상세: 원칙 5 의 "선례" 목록이 2개(`__workspaceId`, `__workspaceTimezone`)만 나열해 실제 4개 중 `__workspaceName`·`__dryRun` 이 누락됐다. 직접적 모순은 아니지만(원칙 자체는 "신규 값은 반드시 `__` prefix" 로 일반화돼 있어 목록이 exhaustive 를 주장하지 않음), 본 문서가 필드 분류의 SoT 를 자임하는 만큼 코드 JSDoc 과 목록을 맞추면 독자가 "선례가 이 2개뿐" 이라고 오인하는 것을 방지할 수 있다.
  - 제안: 원칙 5 선례 목록에 `__workspaceName`(System Context Prefix `workspace` 섹션 이름 해소) · `__dryRun`(Re-run dry-run 모드, [Spec Re-run §7.2](../5-system/13-replay-rerun.md#72-)) 두 항목 추가.

### 요약

target(`spec/conventions/execution-context.md`)의 이번 변경분(원칙 5 — `variables.__*` 예약 네임스페이스)은 `spec/5-system/4-execution-engine.md` §6.1/§6.2/§7.5, `spec/1-data-model.md` `Execution.user_variables`/`dry_run` 컬럼 설명, `spec/5-system/13-replay-rerun.md` §7.2, `spec/conventions/node-cancellation.md`, `spec/4-nodes/1-logic/10-parallel.md` §Rationale 결정 G, `spec/4-nodes/1-logic/12-background.md` §Rationale 등 실제 코드(`execution-engine.service.ts`, `node-handler.interface.ts`)와 대조한 결과 injection 시점·persist 정책·rehydration 재주입 로직 모두 정확히 일치하며 기존 결정(SoT 분리, `_`-prefix 원칙 4 와의 스코프 구분)과도 모순이 없다. 다만 원칙 5 가 새로 명시한 "충돌하지 않는다" 보장이 `Variable Declaration`/`Variable Modification` 노드 spec·구현 어디에도 `__` prefix 예약을 검증/거부하는 가드로 뒷받침되지 않아, 사용자가 `__` 로 시작하는 변수명을 직접 지정하면 시스템 값 오염 또는 park 영속 시 silent 소실이 실제로 가능하다 — 이 부분만 두 spec 영역 간 명시적 정합이 필요하다. 그 외에는 선례 목록의 사소한 불완전성(INFO) 정도이며 구조적 충돌은 없다.

### 위험도

MEDIUM
