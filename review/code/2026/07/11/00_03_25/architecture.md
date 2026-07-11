# 아키텍처(Architecture) 리뷰 — EIA/WS continuation 명령 ↔ 대기 표면 매트릭스 가드

검토 대상: `execution-engine.service.ts`(`resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface` 신설), 신규 순수 모듈 `waiting-surface-guard.ts`, `hooks.service.ts`(`forwardToInteractionService` 리팩터), `interaction.controller/service.ts`(문서 주석), 관련 테스트·e2e·plan. `review/consistency/**` 산출물(파일 11~17)은 이번 작업의 이전 단계(impl-prep) 리뷰 아카이브이며 코드가 아니므로 아키텍처 관점 분석 대상에서 제외했다(cross_spec/rationale_continuity/convention_compliance/naming_collision/plan_coherence 관점은 해당 checker 들이 이미 수행함).

## 발견사항

- **[WARNING]** 영속 `interactionType` 파싱 규칙이 최소 3곳에 독립 구현(triplication)
  - 위치: `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts` `readPersistedInteractionType()` (신규) — 자체 docstring 이 "엔진의 in-memory `getInteractionType`(structured cache → flat cache) 와 동형이며 §7.5 rehydration 의 `persistedInteractionType` 계산과 정확히 같은 규칙" 이라고 명시
  - 상세: 같은 알고리즘("`meta.interactionType` 우선, legacy flat root fallback")이 (1) 신규 `readPersistedInteractionType`, (2) 엔진의 기존 in-memory `getInteractionType`, (3) `resumeFromCheckpoint`(§7.5 rehydration)의 `persistedInteractionType` 계산 세 곳에 **각각 별도로** 구현돼 있고, 공유는 코드가 아니라 주석("동형이다")과 사람의 주의로만 유지된다. 세 구현 중 하나가 향후 변경(예: 새 fallback 규칙 추가)될 때 나머지 두 곳이 조용히 stale 해져도 컴파일러/타입시스템은 이를 잡아주지 못한다 — 전형적인 shotgun-surgery 위험. `waiting-surface-guard.ts` 는 이번에 "순수 함수 모듈"이라는 좋은 위치를 새로 만들었으므로, 오히려 이 기회에 세 구현을 이 모듈의 단일 함수로 합치고 나머지 두 곳이 그것을 import 하도록 리팩터하는 편이 자연스러웠다.
  - 제안: 최소한 후속 항목으로 "세 구현을 `waiting-surface-guard.ts`(또는 더 낮은 레벨의 공용 유틸)의 단일 함수로 합치기"를 별도 정리 작업으로 등록할 것. 지금 당장 범위를 넓히지 않더라도, 세 구현이 다른 파일에서 값이 갈릴 경우를 잡아내는 최소 1개의 크로스 사이트 회귀 테스트(예: 동일 fixture 로 세 함수를 나란히 호출해 결과 동치를 단언)를 추가하면 drift 를 조기에 잡을 수 있다.

- **[WARNING]** `resolveWaitingSurface` 가 표방하는 "registry 대칭" 불변식이 실제로는 절반만 테스트됨
  - 위치: `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts` 상단 docstring("`resumeTurnRegistry` / `parkEntryRegistry` 의 selects 술어와 동일") 및 `resolveWaitingSurface()` JSDoc(동일 문구) / `codebase/backend/src/modules/execution-engine/waiting-surface-guard.spec.ts` `describe('registry 대칭 — parkEntryRegistry.selects 와 동일 판정', ...)`
  - 상세: 모듈·함수 JSDoc 은 명시적으로 두 registry(`resumeTurnRegistry`, `parkEntryRegistry`) 모두와의 술어 동일성을 불변식으로 선언하지만, 실제 회귀 테스트(`waiting-surface-guard.spec.ts`)는 `buildParkEntryRegistry` 만 import 해 `parkEntryRegistry` 쪽만 대칭을 hard-fail 로 검증한다. `resumeTurnRegistry` 쪽에 대한 대응 테스트는 diff 어디에도 없다. 두 registry 가 실제로 같은 selects 정의를 공유하는 게 아니라 각자 독립 정의라면(그렇게 보임 — 이름부터 별개), 이 가드가 지금은 우연히 맞더라도 향후 `resumeTurnRegistry`(worker 측 실제 재개 라우팅)만 변경되는 PR 에서는 아무 테스트도 걸리지 않고 publisher 사전 검증이 조용히 worker 의 실제 선택과 어긋날 수 있다 — 이 가드가 막으려는 바로 그 클래스의 버그(퍼블리셔가 워커의 처리기 선택을 잘못 예측)를 이 가드 자신이 재도입할 수 있는 구조적 허점이다.
  - 제안: `resumeTurnRegistry` 에 대해서도 동일한 `it.each(SELECTORS)` 대칭 테스트를 추가하거나, 최소한 모듈 JSDoc 에서 "현재는 `parkEntryRegistry` 대칭만 자동 검증되며 `resumeTurnRegistry` 대칭은 수동 검토 대상"임을 명시해 불변식 커버리지에 대한 오해를 방지할 것.

- **[WARNING]** `HooksService` 가 프레젠테이션(HTTP) 계층의 예외 타입에 직접 결합해 in-process 에러를 판별
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `forwardToInteractionService()` — `catch (err) { if (err instanceof ConflictException) { ... } throw err; }` (import: `import { ConflictException } from '@nestjs/common'`)
  - 상세: `HooksService.forwardToInteractionService` 는 REST 요청이 아니라 웹훅 인바운드를 `InteractionService.interact()` 로 **in-process forwarding** 하는 호출이다. 그런데 성공/실패 판별을 `@nestjs/common` 의 HTTP 상태 코드 캐리어 클래스(`ConflictException`)로 하고 있다 — 이는 `InteractionService` 의 `dispatchContinuation` 이 도메인 에러(`InvalidExecutionStateError`)를 이미 HTTP 표현으로 매핑해 던지기 때문(주석에 "facade 원칙 §R5/§R10"으로 문서화돼 있어 의도적 설계임은 확인됨). 다만 그 결과 non-HTTP 호출자(webhook forwarder)가 라우팅/전송 계층에 속하는 예외 클래스를 import 해 비즈니스 판단(재시도 루프 방지를 위한 삼킴 여부)의 근거로 쓰게 된다 — 레이어 경계가 흐려지는 지점이다. 더 구체적으로, 이 `catch` 는 `err.message`/`err.getResponse().error.code` 등 **구조화된 에러 코드로 구분하지 않고 `ConflictException` 타입 전체**를 표면 불일치로 간주해 삼킨다. 그러나 같은 `InteractionController`/`InteractionService` 경로는 `IDEMPOTENCY_KEY_CONFLICT` 도 동일하게 `ConflictException` 으로 던진다(파일 5 diff 의 `@ApiConflictResponse` 문서: "STATE_MISMATCH ... 또는 IDEMPOTENCY_KEY_CONFLICT"). 지금은 이 forwarding 경로가 idempotencyKey 를 채우지 않아 실제로는 STATE_MISMATCH 만 발생하겠지만, 향후 이 경로에 idempotency 처리가 추가되면 `IDEMPOTENCY_KEY_CONFLICT` 도 같은 catch 에 걸려 "현재 대기 표면과 맞지 않아 거부됨"이라는 **부정확한 로그 메시지**로 삼켜질 수 있다 — 타입 기반의 넓은 catch 가 원인이다.
  - 제안: (1) 가능하면 `dispatchContinuation` 이전 단계, 즉 도메인 에러(`InvalidExecutionStateError`) 를 직접 잡을 수 있는 지점에서 처리하거나, (2) `ConflictException` 을 유지한다면 `err.getResponse()` 의 `error.code === 'STATE_MISMATCH'` 로 좁혀서 catch 하고 그 외 `ConflictException`(예: `IDEMPOTENCY_KEY_CONFLICT`)은 재던지도록 discriminate 할 것.

- **[INFO]** `ExecutionEngineService` god-class 에 책임이 계속 누적됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 신규 private 메서드 `assertCommandMatchesWaitingSurface` (약 5150번대 라인, `resolveWaitingNodeExecutionId` 바로 아래)
  - 상세: 이번 변경은 순수 판정 로직을 `waiting-surface-guard.ts` 로 잘 분리했지만, "노드 조회 + 판정 호출 + 로깅 + 에러 throw" 를 담당하는 오케스트레이션 메서드는 여전히 이미 수천 줄 규모인 `ExecutionEngineService` 안에 추가됐다. 이는 이 서비스가 "단일 publisher chokepoint" 라는 의도된 아키텍처 결정(문서화됨)과 직결돼 있어 지금 당장 분리를 요구할 사안은 아니지만, 이런 식으로 게이트가 하나씩 늘어날 때마다 같은 클래스에 private 메서드가 누적되는 패턴이 반복되면(과거 M-1 god-handler 분할 리팩터 이력이 있는 코드베이스이므로) 결국 유사한 분할이 다시 필요해질 가능성이 있다.
  - 제안: 지금 막을 필요는 없음. 다만 "판정 로직(순수 함수) + 오케스트레이션(DI 서비스)" 분리를 다음 단계로 가져가고 싶다면, `assertCommandMatchesWaitingSurface` 를 `nodeRepository`/`handlerRegistry`만 주입받는 작은 협력자 클래스로 뽑아 `ExecutionEngineService` 는 호출만 하는 구조도 고려 가치가 있다(선택 사항, 후속 refactor 백로그 후보).

- **[INFO]** `resolveWaitingSurface` 는 컴파일 타임 exhaustiveness 가 없음
  - 위치: `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts` `resolveWaitingSurface()` (if-chain), 대비 `SURFACE_ALLOWED_COMMANDS: Record<WaitingSurface, ...>` (타입이 강제하는 완전성)
  - 상세: `SURFACE_ALLOWED_COMMANDS` 는 `Record<WaitingSurface, ...>` 타입이라 `WaitingSurface` 유니온에 새 값이 추가되면 컴파일 에러로 강제 갱신되지만(OCP 우호적), `resolveWaitingSurface()` 는 단순 if-chain 이라 같은 보장이 없다 — 새 표면 추가 시 반환 로직을 깜빡 갱신하지 않아도 컴파일은 통과한다. 현재는 `waiting-surface-guard.spec.ts` 의 런타임 테스트(`SURFACE_ALLOWED_COMMANDS` 키 목록 검증 등)가 이를 부분적으로 보완하지만, 타입 레벨 가드보다는 약하다.
  - 제안: 필수는 아님 — 다만 `WaitingSurface` 확장이 실제 계획된다면(현재 3종 고정) switch + `never` exhaustiveness 체크로 전환하는 것을 고려.

- **[INFO]** `hooks.service.ts` 의 command-kind → DTO 매핑이 중첩 삼항으로 구현되어 향후 확장(F-1/F-2 plan 이 이미 file_upload/contact_share 분기를 예고)에 불리
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `forwardToInteractionService()` 의 `const dto: InteractDto | undefined = update.command.kind === 'text_message' ? {...} : update.command.kind === 'button_callback' ? {...} : undefined;`
  - 상세: 이번 리팩터는 기존에 두 if/else if 분기마다 중복돼 있던 `ctx` 생성과 `interactionService.interact()` 호출을 단일 지점으로 합쳐 DRY 를 개선했다(긍정적). 다만 그 대가로 DTO 선택 자체가 중첩 삼항식이 됐는데, `plan/in-progress/eia-command-waiting-surface-guard.md` 가 이미 "file_upload / contact_share → submit_form (Phase 4)" 확장을 예고하고 있어 분기가 하나둘 더 늘어나면 가독성이 급격히 나빠질 형태다.
  - 제안: 지금 막을 필요는 없음 — Phase 4 착수 시 `switch (update.command.kind)` 또는 `Record<CommandKind, (cmd) => InteractDto>` 매핑 테이블로 전환하는 것을 권장.

## 요약

이번 변경의 핵심 설계 — 순수 판정 로직(`waiting-surface-guard.ts`)을 오케스트레이션(`ExecutionEngineService`)에서 분리하고, wire 타입(`ContinuationPayload['type']`)에서 `WaitingSurfaceCommand` 를 파생시켜 이중 정의를 피하고, EIA/WS/REST 세 진입점이 동일 chokepoint(`resolveWaitingNodeExecutionId`)를 공유하도록 facade 원칙을 지킨 점 — 은 아키텍처적으로 건전하다. 순환 의존성은 발견되지 않았고 레이어 경계도 대체로 명확하다. 다만 세 가지 응집도/결합도 관점의 실질적 우려가 있다: (1) 영속 `interactionType` 파싱 규칙이 코드 공유 없이 3곳에 독립 구현돼(신규 함수 + 기존 in-memory 캐시 로직 + rehydration 계산) 향후 drift 위험을 안고 있고, (2) 새 가드가 표방하는 "registry 대칭" 불변식이 실제로는 `parkEntryRegistry` 만 테스트되고 `resumeTurnRegistry` 대칭은 검증되지 않아 이 가드 자신이 재도입할 수 있는 클래스의 버그(퍼블리셔가 워커 선택을 오예측)에 노출돼 있으며, (3) `HooksService` 가 in-process 호출의 에러 판별을 프레젠테이션 계층 예외 타입(`ConflictException`)에 직접 결합하면서 error `code` 로 구분하지 않아 향후 `IDEMPOTENCY_KEY_CONFLICT` 같은 다른 원인의 409 도 같은 catch 에 걸릴 여지를 남긴다. 세 항목 모두 지금 당장 기능을 깨뜨리지는 않지만(현재 실제로 트리거되는 경로는 좁음), 유지보수 단계에서 조용한 회귀를 유발할 수 있는 구조적 부채이므로 WARNING 으로 기록한다. god-class 누적과 exhaustiveness 약화는 참고용 INFO 다.

## 위험도

MEDIUM
