# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] WARNING #1 해소 확인 — dispatchNodeSchema 추출로 SRP 강화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` L108–L167 (`dispatchNodeSchema`)
- 상세: 이전 리뷰에서 WARNING으로 지적된 `dispatchExplore` 내 `get_node_schema` 캐시/하드스톱 로직 인라인이 private `dispatchNodeSchema()` 메서드로 완전히 추출되었다. `dispatchExplore` 는 이제 `return this.dispatchNodeSchema(args, ctx)` 한 줄로 위임하며, 메서드 자체의 추상화 레벨이 균일해졌다 (모든 분기가 "특수 도구 → 직접 처리, 나머지 → handleExploreCall 위임" 으로 동일 추상화). 이전 WARNING 이 올바르게 해소되었다.
- 제안: 없음.

### [INFO] OCP 확장점 유지 — dispatchExplore 분기 구조 개선
- 위치: `assistant-tool-router.service.ts` L80–L118 (`dispatchExplore`)
- 상세: 추출 후 `dispatchExplore` 의 세 if-block이 각각 (1) shadow 직접 접근, (2) 캐시 정책 위임(`dispatchNodeSchema`), (3) 순수 ExploreToolsService 위임으로 명확히 분리된다. 신규 캐시 정책 도구가 추가될 경우에도 동일한 추출 패턴(`dispatchXxx` private 메서드)을 따르면 `dispatchExplore` 가 비례적으로 성장하지 않는다. 이는 이전 리뷰 권고(M-3 2/3단계에서 `ToolDispatchPolicy` 인터페이스 고려)로 가는 자연스러운 과도기 구조다.
- 제안: 없음 (현 단계에서는 적절).

### [INFO] JSDoc 명문화로 설계 의도 추적성 확보
- 위치: `assistant-tool-router.service.ts` L121–L128 (`dispatchNodeSchema` JSDoc)
- 상세: 비-문자열 `type` 인자(`typeArg === ''`) 시 캐시 키 없이 매번 위임하는 동작이 "빈 type 의 스키마 조회 자체가 무의미해 별도 차단 이득이 없기 때문" 이라는 이유와 함께 JSDoc 으로 명시되었다. 이전 INFO #4 권고("코드 주석으로 명시")가 이행되어 후속 개발자가 캐시 우회를 버그로 오해하지 않도록 설계 의도 추적성이 확보되었다.
- 제안: 없음.

### [WARNING] reviewCompleted 암묵적 guard 신호 패턴 — 미해소 (계획된 defer)
- 위치: `assistant-tool-router.service.ts` L36–L44 (`ExploreDispatchResult` 인터페이스), `workflow-assistant-stream.service.ts` L1019–L1021
- 상세: 이전 리뷰 WARNING #2 가 M-3 2단계 defer로 명시 결정되었고 현 변경도 해당 패턴을 보존한다. `ExploreDispatchResult.reviewCompleted` 가 guard 도메인의 구체 동작 방식을 암묵적으로 연결하는 구조이며, router 가 guard 상태 변이 방식을 알고 있는 설계다. JSDoc 에 "guard 상태 연결" 의도가 명시되어 있어 추적성은 확보되어 있으나, 2단계 guard 객체 추출 완료 전까지는 경계 모호성이 지속된다.
- 제안: 2단계(`AssistantFinishGuard`/`AssistantReviewGuard`) 착수 시 `ExploreDispatchResult` 를 guard 도메인 타입으로 대체하거나, guard 객체가 `dispatchExplore` 결과를 직접 소비하는 구조로 전환한다. 현 단계는 계획된 defer 상태로 추가 조치 불요.

### [INFO] IExploreToolsService 인터페이스 미추출 — 이전 INFO #13 유지
- 위치: `assistant-tool-router.service.ts` L64 (`constructor`)
- 상세: `AssistantToolRouter` 가 `ExploreToolsService` 구체 클래스를 직접 주입받는 구조가 유지된다. 이전 리뷰에서 "낮은 우선순위, 메서드 시그니처 안정화 후 검토" 로 defer 된 사항이며, 현 변경 범위(dispatchNodeSchema 추출 + 테스트)에서는 변경 필요성이 없다. 테스트에서 duck-typing 주입이 동작하므로 현실적 문제는 없다.
- 제안: 없음 (기존 defer 유지).

### [INFO] asString 통일 — 추상화 일관성 확보
- 위치: `assistant-tool-router.service.ts` L133 (`dispatchNodeSchema` 내 `typeArg` 추출)
- 상세: 이전 인라인 삼항 `typeof args.type === 'string' ? args.type : ''` 가 `asString(args.type, '')` 로 통일되어 `handleExploreCall` 내 다른 인자 처리와 스타일이 일치한다. 정의가 완전 동치이므로 동작 보존이 보장된다. 모듈 내 coercion 관용구의 단일 추상화 소비점이 확립되었다.
- 제안: 없음.

### [INFO] 순환 의존성 없음 — coerce.spec.ts 추가로 테스트 격리 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/coerce.spec.ts`
- 상세: `coerce.spec.ts` 가 `coerce.ts` 만 import 하며 router/service 에 역방향 의존이 없다. `asString` 이 순수 함수로 독립 테스트 가능한 구조임이 확인된다. 이전 리뷰 INFO #3 (coerce 독립 테스트 부재) 이행.
- 제안: 없음.

## 요약

이번 "M-3 1단계 review fix" 변경은 이전 리뷰의 아키텍처 WARNING #1(dispatchExplore 내 캐시 정책 인라인) 을 `private dispatchNodeSchema()` 추출로 명확히 해소하고, INFO #4(비문자열 type 캐시 우회 의도 주석) 와 INFO #10(asString 통일) 을 함께 이행하였다. 결과적으로 `dispatchExplore` 의 추상화 레벨이 균일해지고, `dispatchNodeSchema` 가 SRP 를 준수하는 독립 단위가 되었다. 잔여 아키텍처 관점 주의 사항은 WARNING #2(`reviewCompleted` 암묵적 guard 신호)뿐이며, 이는 M-3 2단계에서 guard 객체 직접 소비로 해결될 계획이 명시되어 있다. 전체적으로 god-handler 분해의 1단계로서 아키텍처 방향성이 유지되고 있으며, 이번 fix 를 통해 추상화 경계가 한 단계 더 명확해졌다.

## 위험도

LOW
