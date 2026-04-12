### 발견사항

---

**[WARNING] `interactionType` 추출 로직 중복**
- 위치: `execution-engine.service.ts` — `executeInline` (~L461) 및 resume 경로 (~L845)
- 상세: `structuredOutput → meta → interactionType` 폴백 체인이 두 곳에 동일하게 복사되어 있음. 향후 `meta` 구조 변경 시 양쪽을 모두 수정해야 함.
- 제안: `getInteractionType(nodeId, context)` 헬퍼로 추출

---

**[WARNING] `buttonConfig` 접근 체인에 non-null assertion 사용**
- 위치: `execution-engine.service.ts` ~L1553
  ```ts
  const buttonConfig = ((structuredConfig?.buttonConfig ??
    nodeOutput.buttonConfig) as ButtonConfig | undefined)!;
  ```
- 상세: `!` 단언은 `buttonConfig`가 실제로 없을 경우 런타임에 `undefined.buttons` 참조 에러를 유발. 바로 아래 `buttonConfig.buttons`를 무조건 참조하므로 위험.
- 제안: 단언 제거 후 early return 또는 throw로 방어
  ```ts
  const buttonConfig = (structuredConfig?.buttonConfig ?? nodeOutput.buttonConfig) as ButtonConfig | undefined;
  if (!buttonConfig) throw new Error(`[waitForButtonInteraction] buttonConfig missing for node ${node.id}`);
  ```

---

**[WARNING] `updatedStructured` → `nodeExec.outputData` 강제 캐스팅**
- 위치: `execution-engine.service.ts` ~L1760
  ```ts
  nodeExec.outputData = updatedStructured as unknown as Record<string, unknown>;
  ```
- 상세: `as unknown as T` 이중 캐스팅은 타입 안전성을 완전히 포기하는 패턴. `NodeHandlerOutput`과 `Record<string, unknown>`의 구조 불일치를 숨김.
- 제안: `outputData` 컬럼 타입을 `NodeHandlerOutput | Record<string, unknown>`으로 확장하거나, 별도 직렬화 함수 도입

---

**[WARNING] `waitForButtonInteraction` 함수 길이 과다**
- 위치: `execution-engine.service.ts` — `waitForButtonInteraction` 메서드
- 상세: diff에서 확인되는 것만 약 +56줄이 추가되어 단일 메서드 책임이 과중해짐. structured 캐시 미러링, flat 캐시 갱신, DB 저장, 이벤트 발행이 모두 한 메서드에 존재.
- 제안: `mirrorInteractionToStructuredCache(...)` 로 structured 캐시 갱신 블록 분리

---

**[INFO] `configEcho` 명칭이 목적을 충분히 설명하지 못함**
- 위치: `carousel.handler.ts`, `chart.handler.ts`, `table.handler.ts`
- 상세: `configEcho`는 "설정을 echo한다"는 내부 구현 관점의 이름. 외부에서 보면 "핸들러가 엔진에 전달하는 메타데이터" 혹은 "처리 파라미터 요약"에 가까움. 세 파일에서 동일하게 사용되나 포함 필드가 제각각.
- 제안: `handlerConfig` 또는 `resolvedConfig`로 통일, 포함 필드 기준도 문서화

---

**[INFO] `toEngineFlatShape`의 `adapted.config` spread 타입 변경 추적 필요**
- 위치: `handler-output.adapter.ts` L82
  ```ts
  // 변경 전
  ...(hasConfig ? (adapted.config as Record<string, unknown>) : {})
  // 변경 후
  ...(hasConfig ? adapted.config : {})
  ```
- 상세: 변경 자체는 올바르나, `NodeHandlerOutput.config`의 타입이 `Record<string, unknown>`이 아닌 경우(예: 강화된 타입으로 마이그레이션 시) spread 연산이 컴파일 오류 없이 의도와 다르게 동작할 수 있음.
- 제안: `NodeHandlerOutput.config` 타입 정의에 spread 가능 제약 명시 또는 주석 보강

---

**[INFO] `prevOutput` 기본값 할당 방식의 암묵적 의존**
- 위치: `execution-engine.service.ts` ~L1730
  ```ts
  const prevOutput = prevStructured?.output ?? cleanNodeOutput;
  ```
- 상세: `cleanNodeOutput`은 위에서 `delete` 연산으로 `interactionType`을 제거한 변형 객체. 이 의존 관계가 코드상 명시적이지 않아 순서 변경 시 버그 발생 가능.
- 제안: 변수 선언 위치를 `cleanNodeOutput` 생성 직후로 이동하거나, 주석으로 순서 의존 명시

---

**[INFO] `status: interactionData.interactionType as string` 의미 혼용**
- 위치: `execution-engine.service.ts` ~L1753
  ```ts
  status: interactionData.interactionType as string,
  ```
- 상세: `NodeHandlerOutput.status`는 `'waiting_for_input'` 같은 실행 상태를 담는 필드인데, 여기서는 `'button_click'` 같은 인터랙션 유형을 할당함. 필드 의미가 다른 값을 담게 되어 후속 코드에서 혼란 유발 가능.
- 제안: 별도 필드(`interactionStatus` 등) 사용 또는 `meta.interactionType`에만 기록하고 `status`는 `'completed'`로 설정

---

### 요약

이번 변경은 핸들러 출력 형태를 `{ config, output, meta, status }` 구조화 포맷으로 일관되게 전환하는 마이그레이션의 일부로, carousel/table/chart/pdf 핸들러와 테스트, 어댑터, 엔진 서비스가 함께 수정되어 방향성은 올바르다. 그러나 `interactionType` 추출 로직이 두 곳에 중복되고, `waitForButtonInteraction` 메서드가 structured 캐시 미러링까지 흡수하면서 책임이 비대해졌다. 또한 non-null assertion(`!`)과 이중 캐스팅(`as unknown as T`)이 타입 안전성을 약화시키고 있으며, `status` 필드에 인터랙션 유형 값을 혼용하는 점은 향후 소비 코드에서 혼란을 초래할 수 있다. 전반적으로 구조 전환 자체의 일관성은 높지만, 전환 과정에서 발생한 중복과 타입 안전성 약화 지점들을 정리해야 장기 유지보수성이 확보된다.

### 위험도

**MEDIUM**