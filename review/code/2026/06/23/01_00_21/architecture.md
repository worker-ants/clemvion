# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] SRP 준수 — AssistantToolRouter 추출은 단일 책임 원칙을 올바르게 적용
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts`
- 상세: `WorkflowAssistantStreamService`에 혼재되어 있던 (a) explore 9도구 dispatch, (b) kind 분류 두 가지 책임을 `AssistantToolRouter`로 명확히 분리했다. `streamMessage`의 책임 범위가 "SSE 조립 + plan/edit/finish dispatch + §10 가드"로 압축되었고 각각의 경계가 명확하다.

### [INFO] OCP seam 설계 — handleExploreCall switch 확장점
- 위치: `assistant-tool-router.service.ts` L559–L606 (`handleExploreCall`)
- 상세: 신규 explore 도구 추가 시 `handleExploreCall` switch에 case 하나를 추가하는 것으로 완결된다. `TOOL_KIND_BY_NAME`이 단일 소비점으로 `classifyKind`에서만 참조되므로 kind 메타 변경도 한 곳에서 관리된다. OCP seam이 명시적으로 설계된 점은 긍정적이다.

### [WARNING] dispatchExplore 내 if-chain — 추상화 경계 혼재 위험
- 위치: `assistant-tool-router.service.ts` L481–L548 (`dispatchExplore`)
- 상세: `dispatchExplore` 메서드는 현재 세 가지 서로 다른 추상화 레벨의 로직을 순차 if로 처리한다. (1) shadow 직접 접근 도구(`get_current_workflow`, `verify_workflow`), (2) 캐시/하드스톱 정책이 붙은 도구(`get_node_schema`), (3) 순수 위임 도구(그 외). `get_node_schema`의 캐시·하드스톱 로직이 현재 `dispatchExplore` 내에 인라인되어 있어, 새 도구에도 유사한 rate-limit 정책이 붙을 경우 이 메서드가 또 길어지는 구조다. 캐시 정책을 별도 `SchemaCachePolicy` 헬퍼 또는 전략 객체로 분리해 `handleExploreCall` 호출 전후에 데코레이터처럼 적용하는 방향이 OCP에 더 부합한다.
  - 제안: `get_node_schema` 캐시/하드스톱 처리를 `dispatchExplore` 외부의 private 메서드(`dispatchNodeSchema`)로 분리하거나, 이후 유사 케이스가 늘어날 때를 대비해 `ToolDispatchPolicy` 인터페이스로 추상화할 것을 고려한다. 현 시점에서는 단계적 리팩터링의 1단계이므로 즉각 수정보다는 후속 단계(M-3 2/3단계) 설계 시 반영하면 적절하다.

### [INFO] 의존성 역전 — ExploreToolsService 인터페이스 부재
- 위치: `assistant-tool-router.service.ts` L457 (`constructor`)
- 상세: `AssistantToolRouter`는 `ExploreToolsService` 구체 클래스를 직접 주입받는다. 현재 구조상 `ExploreToolsService`가 단일 구현체이고 테스트에서 `as never`로 duck-typing 주입하는 방식으로 대응하고 있어 실용적이다. 다만 `IExploreToolsService` 인터페이스를 추출하면 DIP를 완전히 만족하고 향후 목킹/교체가 명시적 타입 계약 위에서 이루어진다.
  - 제안: 현재 단계에서는 낮은 우선순위. `ExploreToolsService` 메서드 시그니처가 안정화된 후 인터페이스 추출 검토.

### [INFO] 순환 의존성 없음 — coerce.ts 분리 전략 유효
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/coerce.ts`
- 상세: `asString`을 `coerce.ts`로 분리해 `WorkflowAssistantStreamService`와 `AssistantToolRouter` 양쪽에서 공유하는 방식은 순환 의존 없이 공통 유틸을 공유하는 적절한 설계다. 10줄짜리 유틸이 별도 파일로 분리된 것이 과도한 추상화처럼 보일 수 있으나, 향후 `asNumber`, `asBoolean` 등 유사 coercion 함수가 추가될 경우 자연스러운 확장점이 된다.

### [INFO] 레이어 책임 분리 — turn-scoped 상태 소유권 명확화
- 위치: `workflow-assistant-stream.service.ts` L923 (`schemaCache` 선언), `assistant-tool-router.service.ts` 클래스 레벨
- 상세: turn-scoped 상태(`schemaCache`, `guardState`)는 `streamMessage` 호출 스택이 소유하고 무상태 singleton인 `AssistantToolRouter`에 참조로 전달하는 구조는 책임 소유권 관점에서 올바르다. router가 상태를 보유하면 NestJS singleton scope에서 요청 간 상태 오염이 발생할 수 있으므로, 현재 설계가 레이어 책임을 정확히 구분한다.

### [WARNING] reviewCompleted 신호 — 암묵적 guard 상태 변이 패턴
- 위치: `workflow-assistant-stream.service.ts` L1019–L1021, `assistant-tool-router.service.ts` `ExploreDispatchResult` 인터페이스
- 상세: `dispatchExplore`가 `reviewCompleted: boolean`을 반환하고 호출부(`streamMessage`)가 이를 보고 `guardState.reviewCompleted`를 변이시키는 패턴은 router가 guard 도메인의 구체적 동작 방식을 알고 있음을 시사한다. `reviewCompleted`라는 이름 자체가 guard 상태와 1:1로 연결된 개념이며, router→guard 경계가 희미해질 소지가 있다. M-3 2단계(`AssistantFinishGuard`/`AssistantReviewGuard` 추출)가 완료되면 이 신호가 guard 객체에 직접 전달되어 경계가 명확해질 것으로 보이나, 현 단계에서는 과도기적 설계 임을 인지해야 한다.
  - 제안: `ExploreDispatchResult.reviewCompleted`의 JSDoc 주석(현재 존재)을 유지하되, 2단계 완료 시 guard 객체가 직접 `dispatchExplore` 결과를 소비하도록 리팩터링하는 것을 계획에 명시한다.

### [INFO] 확장성 — 3단계 분할 계획과의 정합성
- 위치: `plan/in-progress/refactor/02-architecture.md` M-3 항목
- 상세: Router→Guard→Persistence 3단계 분할 계획이 명시되어 있고, 1단계인 `AssistantToolRouter` 추출이 그 계획과 일치한다. plan/edit/finish dispatch와 §10 가드 잔류는 의도된 분할 경계이며, 이후 단계에서의 추출을 고려한 현재 설계는 확장성 관점에서 적절하다.

### [INFO] 모듈 경계 — NestJS 모듈 등록 완전성
- 위치: `workflow-assistant.module.ts` L1284–L1285
- 상세: `AssistantToolRouter`가 `providers` 배열에 등록되고 `ExploreToolsService`도 잔류하는 구조로, DI 그래프가 완결된다. `ExploreToolsService`가 `AssistantToolRouter`를 통해 간접 제공됨에도 모듈에 직접 등록된 것은 다른 소비자(미래의 직접 주입 케이스)를 위한 노출로 적절하다.

## 요약

이번 M-3 1단계 리팩터링은 `streamMessage`의 god-handler 분해를 위한 첫 응집 단위 추출로서 아키텍처 관점에서 방향성이 올바르다. `AssistantToolRouter`는 SRP를 준수하고, `TOOL_KIND_BY_NAME` 단일 소비점, `coerce.ts` 분리, turn-scoped 상태 소유권 명확화 등 설계 결정이 일관성 있게 적용되어 있다. 주요 개선 여지는 두 가지다: (1) `dispatchExplore`의 `get_node_schema` 캐시 정책 인라인이 메서드 응집도를 낮추는 경향이 있어 후속 단계 설계 시 분리를 권장하며, (2) `reviewCompleted` 신호 패턴이 router-guard 경계를 암묵적으로 연결하므로 2단계 guard 추출 완료 시 명시적 경계로 전환해야 한다. 전반적으로 현재는 의도된 과도기 설계이며 3단계 분할 완료 시 결합도·응집도 모두 목표 수준에 도달할 것으로 평가된다.

## 위험도

LOW
