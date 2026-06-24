# 아키텍처(Architecture) 리뷰

## 발견사항

### [WARNING] ExternalInteractionModule 이 NodeExecution 엔티티를 직접 소유 — 모듈 경계 침범
- **위치**: `codebase/backend/src/modules/external-interaction/external-interaction.module.ts` L66–71, `interaction.service.ts` L65–66
- **상세**: `ExternalInteractionModule` 이 `NodeExecution` 엔티티를 `TypeOrmModule.forFeature([…, NodeExecution])` 로 등록하고, `InteractionService` 에서 `Repository<NodeExecution>` 을 직접 주입받아 조회한다. `NodeExecution` 의 소유권은 `NodeExecutionsModule`(또는 `ExecutionEngineModule`)에 있어야 하며, 상태 복원 쿼리는 소유 모듈이 노출하는 서비스 메서드를 통해 접근하는 것이 모듈 경계 원칙에 부합한다. 현재 구조는 `ExternalInteraction` 레이어가 `NodeExecution` 의 내부 스키마(`outputData.meta.interactionType`, `outputData.config.buttonConfig` 등)를 직접 알아야 하는 높은 결합도를 만든다.
- **제안**: `NodeExecutionsModule`(또는 담당 모듈)에 `findWaitingNodeExecution(executionId)` 같은 전용 메서드를 추가하고 해당 모듈을 `ExternalInteractionModule` 에 임포트하여 간접 접근으로 전환. 이를 통해 `outputData` 내부 구조 변경이 `ExternalInteraction` 코드를 수정 없이 캡슐화 가능.

---

### [WARNING] getStatus 내 outputData 파싱 로직이 InteractionService 에 인라인 — 단일 책임 원칙 위반
- **위치**: `interaction.service.ts` L868–913 (diff 기준)
- **상세**: `outputData.meta`, `outputData.config.buttonConfig`, `outputData.buttonConfig`(legacy fallback) 구조를 직접 파싱하고 SSE wire payload 형식으로 변환하는 로직이 `InteractionService.getStatus` 내부에 50줄 이상 인라인되어 있다. 동일한 변환 로직이 위젯(`parseWaitingForInput`)과 이중으로 존재하며, 백엔드와 프론트엔드가 각각 동일 형식을 독립적으로 구성한다. `InteractionService` 는 REST 요청 조율이 책임이어야 하며, outputData → SSE context 변환은 별도 헬퍼(예: `NodeExecutionContextMapper`) 로 분리하는 것이 적합하다.
- **제안**: `mapNodeExecToWaitingContext(nodeExec: NodeExecution): { currentNode, context }` 형태의 순수 함수를 별도 파일로 분리. 테스트 가능성 향상 + 향후 interactionType 추가 시 단일 위치 수정.

---

### [INFO] InteractionService 생성자 파라미터 증가 — 의존성 팽창 관찰
- **위치**: `interaction.service.ts` L62–70
- **상세**: 이번 변경으로 생성자 파라미터가 4개→5개로 증가했다(`executionRepository`, `nodeExecutionRepository`, `executionEngineService`, `executionsService`, `tokenService`). 아직 SRP 위반 임계치는 아니나, 서비스가 실행 상태 조회(`getStatus`) + 커맨드 dispatch(`interact`) + 토큰 갱신(`refreshToken`) + 취소(`cancel`) 를 모두 담당한다. 향후 기능 확장 시 `ExecutionStatusService` 를 분리하는 방향을 고려할 시점이다.
- **제안**: 즉시 리팩토링 필요는 없으나, `getStatus` 관련 로직(노드 조회 + context 매핑)을 별도 service/helper 로 분리하면 위의 WARNING(단일 책임 + 모듈 경계)도 동시에 해소된다.

---

### [INFO] use-widget.ts의 seedWaitingFromStatus — useCallback 의존성 배열 빈 배열
- **위치**: `codebase/channel-web-chat/src/widget/use-widget.ts` L207
- **상세**: `seedWaitingFromStatus` 의 `useCallback` 의존성이 `[]` 이지만, 함수 본문이 `dispatch`(reducer dispatch)와 `parseWaitingForInput`(imported 함수), `threadToMessages`(imported 함수)를 참조한다. `dispatch` 는 `useReducer` 가 반환하는 stable 참조이고 `parseWaitingForInput`/`threadToMessages` 는 모듈 상수라 실질적 stale closure 위험은 없다. 다만 eslint-plugin-react-hooks 의 exhaustive-deps 규칙이 경고를 발생시킬 수 있고, `dispatch` 를 의존성에 명시하지 않아 코드 의도가 불명확하다.
- **제안**: `[dispatch]` 를 의존성으로 명시하거나, 빈 배열이 의도적임을 주석으로 명기.

---

### [INFO] ExternalInteractionModule JSDoc 의 `TypeOrmModule.forFeature` 의존성 목록 미갱신
- **위치**: `external-interaction.module.ts` L117 JSDoc 주석
- **상세**: 모듈 상단 JSDoc에 `TypeOrmModule.forFeature([Trigger, Execution])` 로 열거되어 있으나, 실제 코드에는 `NodeExecution` 이 추가되었다. 문서와 코드 불일치로 유지보수 혼란 유발.
- **제안**: JSDoc `의존성:` 줄을 `TypeOrmModule.forFeature([Trigger, Execution, ExecutionToken, NodeExecution])` 로 갱신.

---

## 요약

이번 변경은 SSE race 조건 해소라는 명확한 기능 목적을 달성하며, 레이어 분리(컨트롤러·서비스·클라이언트 훅·테스트)와 soft-failure 전략은 전반적으로 적절하다. 핵심 아키텍처 우려는 `ExternalInteractionModule` 이 `NodeExecution` 엔티티를 직접 소유하여 모듈 경계를 넘는 부분이다. `NodeExecution` 의 `outputData` 내부 구조에 `InteractionService` 가 직접 의존하므로, 해당 스키마 변경 시 `external-interaction` 코드도 함께 수정해야 하는 결합도가 생긴다. 단기 픽스로는 수용 가능하나, 중기적으로 소유 모듈에 전용 조회 서비스를 노출하고 파싱 로직을 매퍼 함수로 분리하는 방향을 권장한다.

## 위험도

LOW
