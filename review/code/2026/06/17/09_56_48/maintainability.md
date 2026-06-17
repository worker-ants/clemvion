# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [INFO] processButtonResumeTurn 함수 길이 및 복잡도
- 위치: `button-interaction.service.ts`, `processButtonResumeTurn` (라인 735-1017, 약 280줄)
- 상세: `processButtonResumeTurn` 메서드 하나가 포트 선택 분기 로직(`if/else if/else`), structured output 구성, flat output 구성, thread append, NodeExecution 저장, 이벤트 emit 까지 총 6개의 책임을 가진다. 함수 본문의 중첩 깊이는 최대 4단계(`if click.type → if clickedButton.type → if selectedItem`)이다. `verbatim 이동` 임을 커밋 메시지에서 밝히고 있으므로 이번 PR에서 변경이 의도된 사항은 아니나, 향후 유지보수 부담으로 남아 있다.
- 제안: 포트/interactionData/structuredInteraction/updatedOutput 3중 분기를 `resolveButtonInteraction(click, buttons, buttonItemMap, outputItems, now)` 와 같은 순수 함수로 추출하면 테스트 가능성이 높아지고 이 메서드의 길이를 ~100줄 이하로 줄일 수 있다.

### [INFO] 중복 코드: buttonConfig 해석 패턴 두 메서드에 반복
- 위치: `button-interaction.service.ts` 라인 646-658 / 748-755
- 상세: `waitForButtonInteraction`과 `processButtonResumeTurn` 양쪽이 `context.structuredOutputCache?.[node.id]?.config?.buttonConfig ?? flatNodeOutput.buttonConfig` + `!Array.isArray(buttonConfig.buttons)` 가드를 동일하게 수행한다. FormInteractionService에는 이 패턴이 없어 서비스 간 구조 대칭도 깨진다.
- 제안: `private resolveButtonConfig(node: Node, context: ExecutionContext): ButtonConfig` 헬퍼를 추출해 양 메서드에서 공유한다.

### [INFO] 중복 코드: cleanNodeOutput 내부 필드 제거 패턴
- 위치: `button-interaction.service.ts` 라인 775-778
- 상세: `status`, `interactionType` 필드를 delete하는 패턴은 다른 노드 처리 컨텍스트에서도 나타날 가능성이 높다. 현재는 processButtonResumeTurn 내부에 인라인으로 작성됐다.
- 제안: `stripInternalFields(output: Record<string, unknown>): Record<string, unknown>` 유틸 함수로 추출하거나, 이미 있는 `stripControlFields` 유틸이 이 역할을 할 수 있는지 확인한다.

### [INFO] 매직 문자열: 'continue', '__item_' 하드코딩
- 위치: `button-interaction.service.ts` 라인 820, 848
- 상세: `'continue'` (selectedPort fallback), `'__item_'` (동적 아이템 버튼 ID 구분자)이 소스에 직접 박혀 있다. 이 값은 이미 다른 파일에서도 참조될 가능성이 있다.
- 제안: `BUTTON_PORT_CONTINUE = 'continue'`, `BUTTON_ITEM_SEPARATOR = '__item_'` 같은 상수로 네이밍하고, button.types.ts 또는 전용 constants 파일에 위치시킨다.

### [INFO] `as unknown as never` 패턴의 가독성
- 위치: `button-interaction.service.spec.ts` 라인 125, `form-interaction.service.spec.ts` 동일
- 상세: `mockNodeExecutionRepository as unknown as never` 타입 단언은 의도를 숨긴다. `never`가 아니라 `Repository<NodeExecution>`으로 단언하면 IDE 지원이 개선되고 의도가 명확해진다.
- 제안: `mockNodeExecutionRepository as unknown as Repository<NodeExecution>` 또는 TypeScript satisfies 패턴 사용.

### [INFO] `structuredOutputCache` 접근 타입 단언 반복 (테스트 코드)
- 위치: `button-interaction.service.spec.ts` 라인 163-171, `form-interaction.service.spec.ts` 동일 패턴 반복
- 상세: `(ctx as { structuredOutputCache: Record<string, unknown> }).structuredOutputCache = ...` 패턴이 두 spec 파일에서 반복된다. 이는 `ExecutionContext` 타입이 `structuredOutputCache`를 optional 또는 non-public으로 선언했기 때문이다.
- 제안: 테스트 전용 헬퍼 `setStructuredCache(ctx, nodeId, value)` 를 공유 테스트 유틸로 추출하면 중복을 제거할 수 있다.

### [INFO] isFormSubmittedSentinel 의 static 메서드 위치
- 위치: `form-interaction.service.ts` 라인 3039-3047
- 상세: `isFormSubmittedSentinel`은 인스턴스 상태에 의존하지 않는 순수 타입 가드이다. `private static`으로 선언했으나, 엔진에서도 원래 사용하던 메서드이며 동일한 sentinel 형태를 다른 컨텍스트에서 확인해야 할 경우 재사용이 어렵다. 커밋 메시지에서 이 메서드가 FormInteractionService로 이동했음을 명시했으므로 의도된 배치이지만, 장기적으로는 `process-turn-result.ts` 또는 sentinel 타입 정의 근처에 위치시키는 것이 의존성 방향과 일치한다.
- 제안: 단기적으로는 현 위치 유지가 타당. 향후 `execution-resume/form-sentinel.ts` 같은 파일로 이동을 고려한다.

### [INFO] execution-engine.service.spec.ts: 제거된 describe 블록 대신 새 spec 파일로 이관된 패턴의 일관성
- 위치: `execution-engine.service.spec.ts` 라인 1539-1958 삭제 구간
- 상세: `processFormResumeTurn — 4 branches (SUMMARY W1)` describe 블록이 삭제되고 `form-interaction.service.spec.ts`로 이관됐다. 이관 패턴(verbatim 이동 + assertion 보존)은 일관되게 적용됐으며, 엔진 spec에서는 통합 테스트만 잔류하는 구조가 명확하다. 다만 엔진 spec에서 삭제된 `runFormResume` 헬퍼 함수가 새 spec에서는 서비스 인스턴스에 직접 의존하도록 재작성됐는데, 이 변경은 가독성을 높이는 긍정적 방향이다.
- 제안: 현행 유지.

### [INFO] buttonInteraction / formInteraction 프로퍼티 네이밍 (engine service)
- 위치: `execution-engine.service.ts` 라인 2082-2084
- 상세: `formInteraction`, `buttonInteraction` 이름은 서비스 인스턴스임에도 동사형 패턴이다. 코드베이스의 다른 서비스 주입(`aiTurnOrchestrator`, `conversationThreadService` 등)은 명사/서비스형 네이밍을 따른다.
- 제안: `formInteractionService`, `buttonInteractionService`로 일관성을 맞추거나, 현재 프로젝트 컨벤션이 이미 짧은 형태를 쓴다면 그대로 두어도 무방하다. (AiTurnOrchestrator와 비교 시 `aiTurnOrchestrator`는 Orchestrator가 이미 충분한 명사 역할을 함.)

## 요약

이번 변경은 god-class에서 `FormInteractionService`와 `ButtonInteractionService`를 strangler-fig 패턴으로 추출한 리팩토링이다. 엔진 코드 912줄 감소, 전담 서비스 2개 신설, 대응 테스트 22개 신설이라는 명확한 유지보수성 향상이 이루어졌다. 모듈 경계가 잘 정의됐고, `EngineDriver` 인터페이스를 통한 의존성 역전 패턴이 일관되게 적용됐으며, verbatim 이동으로 인한 동작 변경 없음이 보장됐다. 주요 개선 여지는 `processButtonResumeTurn` 메서드의 함수 길이(약 280줄, 6가지 책임)와 buttonConfig 해석 코드 중복에 집중되며, 이는 현재 PR의 "verbatim 이동" 원칙을 고려하면 후속 step에서 해소하는 것이 적절하다. 전반적으로 유지보수성 관점에서 리팩토링 방향과 실행 품질 모두 양호하다.

## 위험도
LOW
