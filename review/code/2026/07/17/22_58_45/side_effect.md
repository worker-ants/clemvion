# 부작용(Side Effect) 리뷰 — resumable-handler-generic-typing

## 개요

리뷰 대상 4개 코드 파일(`ai-agent.handler.ts`, `information-extractor.handler.ts`,
`node-handler.interface.ts`, `packages/ai-end-reason/src/index.ts`)은 모두 TypeScript
**타입 레벨(컴파일타임) 리팩터**다 — `ResumableNodeHandler` 인터페이스를
`ResumableNodeHandler<TEndReason>` 제네릭으로 전환하고, 두 핸들러가 자기 종결
도메인(`AiAgentEndReason` / `InformationExtractorEndReason`)으로 `implements` 하도록
좁히며, `implements` 가 못 잡는 파라미터 bivariance 축을 `AssertEndReasonDomain`
컴파일타임 단언으로 보강한다. 어떤 함수 바디(런타임 로직)도 diff 에 포함되지 않았다 —
전체 파일 컨텍스트와 diff 를 대조한 결과 `execute` / `validate` /
`processMultiTurnMessage` / `endMultiTurnConversation` / `buildMultiTurnFinalOutput`
등 기존 메서드 구현은 문자 그대로 무변경이다.

## 발견사항

- **[INFO]** 신규 모듈-레벨 `const` 3곳 — 런타임상 완전 inert
  - 위치: `ai-agent.handler.ts` 끝부분 `_endReasonDomainLock`, `information-extractor.handler.ts` 끝부분 `_endReasonDomainLock`, `packages/ai-end-reason/src/index.ts` 의 `_universalNonEmpty`
  - 상세: `const x: AssertEndReasonDomain<...> = true; void x;` / `const _universalNonEmpty: [...] = true; void _universalNonEmpty;` 패턴. 모듈 로드 시 boolean 리터럴을 할당하고 즉시 `void` 로 폐기하는 순수 컴파일타임 단언용 상수 — export 되지 않고, 외부에서 참조되지 않으며, mutable 공유 상태도 아니고 I/O 도 없다. "전역 변수 도입"(점검 관점 #2) 요건에 형식적으로는 해당하나 실질적 부작용은 0.
  - 제안: 조치 불필요. (컴파일러가 `noUnusedLocals` 등으로 경고하지 않는지만 CI 에서 확인되면 충분.)

- **[INFO]** 시그니처/인터페이스 변경은 순수 타입 레벨 — 런타임 바디 무변경
  - 위치: `node-handler.interface.ts` `ResumableNodeHandler<TEndReason = UniversalEndReason>`, `isResumableNodeHandler` 반환 타입(`handler is ResumableNodeHandler<UniversalEndReason>`), `AiAgentHandler implements ResumableNodeHandler<AiAgentEndReason>`, `InformationExtractorHandler implements ResumableNodeHandler<EndReason>`
  - 상세: `isResumableNodeHandler` 함수 바디의 런타임 체크(`typeof handler.processMultiTurnMessage === 'function' && typeof handler.endMultiTurnConversation === 'function'`)는 diff 전후 동일하다 — 오직 반환 타입 애노테이션만 narrow 됐다. 두 핸들러의 `implements` 절 추가도 마찬가지로 컴파일타임 표면 검사만 추가하며, 기존에 이미 `endMultiTurnConversation(state, endReason: AiAgentEndReason, ...)` / `endMultiTurnConversation(stateRaw, endReason: EndReason)` 형태로 선언돼 있던 메서드 시그니처와 정확히 일치해 실질적 파라미터/반환값 변경이 없다. `NodeHandler` import 제거(두 핸들러 모두) 후 해당 식별자의 잔존 참조도 없음을 grep 으로 확인(주석 1건 제외).
  - 제안: 조치 불필요.

- **[WARNING]** 인터페이스 좁힘(narrowing)의 전사 ripple 을 이번 세션에서 실제 빌드로 재검증하지 못함
  - 위치: `node-handler.interface.ts` (`ResumableNodeHandler` 기본 타입 인자 `UniversalEndReason` 도입) → 소비처 `modules/execution-engine/ai-turn-orchestrator.service.ts`
  - 상세: `ResumableNodeHandler` 를 타입 인자 없이 bare 로 참조하는 자리가 리포지토리 전체에서 정확히 1곳(`ai-turn-orchestrator.service.ts:974`, `handleAiTurnError(..., handler: ResumableNodeHandler, ...)`) 존재한다. grep 교차대조 결과 이 파라미터에는 `isResumableNodeHandler` 가드로 narrow 된 값만 흘러들어가고(`ai-turn-orchestrator.service.ts:607` 호출부), 두 지점 모두 동일 기본 타입 인자(`UniversalEndReason`)로 귀결되어 정합적으로 보인다. `endMultiTurnConversation` 호출 시 실제로 전달되는 리터럴 값도 `'user_ended'`(914행) / `'error'`(996행) 두 가지뿐이며 둘 다 `UniversalEndReason` 의 원소다. `ResumableNodeHandler`/`isResumableNodeHandler`/`AiAgentEndReason`/`ResumableNodeHandlerOutput` 을 참조하는 파일(`ai-turn-executor.ts` 포함) 전수를 grep 으로 확인했을 때 이 변경으로 깨질 만한 다른 소비처는 발견되지 않았다. 그러나 이번 리뷰 세션에서는 sandbox 의 Bash 안전성 classifier 가 일시 장애 상태여서(`tsc`/`node` 실행을 포함한 여러 커맨드가 반복적으로 "temporarily unavailable" 로 거부됨) `tsc --noEmit` 풀빌드로 이 결론을 직접 검증하지 못했다 — grep 기반 정적 교차참조 분석에만 근거한 결론이다.
  - 제안: merge 전 `pnpm --filter backend build`(또는 backend `tsc --noEmit -p tsconfig.json`) 를 1회 실행해 실제 컴파일 성공을 재확인할 것. (이미 developer 워크플로 상 구현 완료 후 test-stages/CI 단계에서 수행될 가능성이 높으므로, 이 항목은 "누락된 검증"이라기보다 "이 세션에서 재확인 못 한 항목"에 대한 명시적 기록.)

- **관찰(비발견)**: `@workflow/ai-end-reason` 패키지의 `dist/` 산출물이 이번 세션 기준 `src/` 보다 최신(mtime 비교, `UniversalEndReason` export 확인됨)이라 stale-dist 로 인한 타입 drift(과거 세션 교훈: stale `packages/*/dist`) 는 해당하지 않는다.
  - 파일시스템 부작용(점검 관점 #3)·환경 변수(#6)·네트워크 호출(#7)·이벤트/콜백(#8) 관점에서는 diff 내 어떤 파일도 해당 카테고리에 관여하지 않는다 — 전부 순수 타입 선언/단언 추가.

## 요약

본 변경은 `ResumableNodeHandler` 를 제네릭화하고 두 AI 노드 핸들러가 각자의 종결
사유 도메인으로 `implements` 하도록 좁히는 순수 컴파일타임 타입 강화 리팩터로,
diff 에 포함된 4개 파일 중 어느 것도 함수 바디·전역 mutable 상태·파일시스템·환경
변수·네트워크·이벤트 발행 경로를 건드리지 않는다. 새로 추가된 모듈 레벨
`const` 단언 3곳은 `void` 로 즉시 폐기되는 inert 값이라 관측 가능한 부작용이
없다. `ResumableNodeHandler`/`isResumableNodeHandler` 의 타입 시그니처 narrowing
이 다른 소비처를 깨뜨릴 가능성이 유일한 실질적 리스크 축인데, grep 기반 전수
교차대조로는 유일한 소비처(`ai-turn-orchestrator.service.ts`)가 이미 정합적으로
갱신돼 있음을 확인했다. 다만 이 세션은 sandbox Bash classifier 장애로 실제
`tsc` 풀빌드를 실행하지 못해, merge 전 CI/사람이 컴파일 통과를 1회 재확인하는
것을 권장한다.

## 위험도

LOW
