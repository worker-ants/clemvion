## 발견사항

---

### [WARNING] Non-null assertion으로 인한 런타임 TypeError 위험
- **위치**: `execution-engine.service.ts`, `waitForButtonInteraction` (~line 1555)
- **상세**: `buttonConfig`를 structured/flat cache 양쪽에서 모두 찾지 못하면 `undefined`이지만, 비-null 단언 `!`로 타입을 강제 변환한 후 즉시 `buttonConfig.buttons`에 접근합니다.
  ```typescript
  const buttonConfig = ((structuredConfig?.buttonConfig ??
    nodeOutput.buttonConfig) as ButtonConfig | undefined)!;
  const buttons = buttonConfig.buttons; // undefined.buttons → TypeError
  ```
  마이그레이션 과도기에 structured cache가 아직 채워지지 않은 노드(레거시 핸들러)는 flat cache의 `nodeOutput.buttonConfig`에도 접근하려 하지만, `toEngineFlatShape`가 `config.buttonConfig`를 flat output에 포함시키지 않아 양쪽 모두 undefined일 수 있습니다.
- **제안**: `!` 제거 후 명시적 null 체크 추가:
  ```typescript
  if (!buttonConfig) {
    this.logger.error(`[waitForButtonInteraction] buttonConfig not found for node ${node.id}`);
    throw new Error('Button config missing');
  }
  ```

---

### [WARNING] `nodeExec.outputData` 저장 형식 변경으로 인한 DB 소비자 파손
- **위치**: `execution-engine.service.ts`, `waitForButtonInteraction` (~line 1766)
- **상세**: 버튼 인터랙션 후 `nodeExec.outputData`에 저장되는 형식이 기존 flat object에서 `NodeHandlerOutput` 구조체(`{ config, output, port, status, meta }`)로 변경됩니다.
  ```typescript
  // Before
  nodeExec.outputData = updatedOutput; // flat shape
  // After
  nodeExec.outputData = updatedStructured as unknown as Record<string, unknown>; // structured
  ```
  DB에서 `node_execution.output_data`를 직접 읽어 `interactionData`, `buttonId`, `selectedItem` 등에 접근하는 코드(API 응답, 로그 조회, 재시도 로직 등)가 flat 키를 기대하고 있다면 전부 파손됩니다. `as unknown as` 이중 캐스팅은 타입 안전성 검사를 우회하므로 컴파일 타임에 발견되지 않습니다.
- **제안**: 저장 형식을 명확히 하거나, 기존 소비자가 flat/structured 양쪽을 처리할 수 있도록 어댑터를 적용하세요.

---

### [WARNING] ChartHandler: flat shape에서 `config` 필드 소실
- **위치**: `chart.handler.ts`
- **상세**: 기존 ChartHandler는 bare object `{ type, chartType, title, data, config: { xAxis, yAxis, title } }`를 반환했습니다. `adaptHandlerReturn`이 이를 레거시 bare 경로로 처리하면 `toEngineFlatShape`가 `config: { xAxis, yAxis, title }`를 flat shape에 그대로 포함시켰습니다. 변경 후 신규 shape `{ config: configEcho, output: payload }`에서 `toEngineFlatShape`는 `output = payload = { type, chartType, title, data }`만 flat shape으로 변환하므로, 기존 flat cache에 존재하던 `config.xAxis`, `config.yAxis` 키가 사라집니다.
  ```
  // 기존 flat shape
  { type, chartType, title, data, config: { xAxis, yAxis, title } }
  
  // 변경 후 flat shape
  { type, chartType, title, data }  ← config 소실
  ```
  워크플로우 표현식에서 `$node["차트노드"].config.xAxis` 형태로 참조하는 기존 워크플로우가 있다면 `undefined`를 반환합니다.
- **제안**: 마이그레이션 기간 동안 `toEngineFlatShape`에서 `meta`나 `config`를 flat output에 병합하거나, 기존 워크플로우 표현식 사용 여부를 확인 후 변경하세요.

---

### [INFO] `updatedStructured.status`의 의미론적 변경
- **위치**: `execution-engine.service.ts`, `waitForButtonInteraction` (~line 1744)
- **상세**: 버튼 인터랙션 후 structured cache의 `status`가 `interactionData.interactionType`(`'button_click' | 'button_continue' | 'button_timeout'`)으로 설정됩니다. 이 값은 `NodeExecution` 상태(`PENDING`, `COMPLETED` 등)와 다르고, handler blocking 상태 감지에 쓰이는 `'waiting_for_input'`과도 다릅니다. 향후 structured cache의 `status`를 읽어 blocking 여부를 판단하는 코드가 추가될 경우 오동작할 수 있습니다.

---

### [INFO] `previousOutput` 필드가 표현식 네임스페이스에 노출
- **위치**: `execution-engine.service.ts`, `waitForButtonInteraction` (~line 1730)
- **상세**: `structuredOutputPayload.previousOutput = prevOutput`으로 이전 핸들러 output이 structured cache에 저장됩니다. 이는 `$node["label"].output.previousOutput` 형태로 워크플로우 표현식에서 접근 가능해집니다. 의도된 기능인지 확인이 필요하며, 문서화되지 않은 필드가 외부에 노출됩니다.

---

### [INFO] TableHandler `configEcho`에 사전 평가된 레이블 저장
- **위치**: `table.handler.ts`
- **상세**: `configEcho.columns = resolvedColumns`로 표현식 레이블(`{{ $var.x }}`)이 실행 시점 값으로 평가되어 config cache에 저장됩니다. 원본 템플릿 문자열이 유실되므로, 동일 config로 재실행 시 컨텍스트가 다른 경우 잘못된 레이블이 사용될 수 있습니다.

---

### [INFO] `buttonItemMap`의 `ButtonConfig` 인터페이스 편입
- **위치**: `button.types.ts`
- **상세**: `buttonItemMap`이 선택적 필드로 추가되어 additive 변경입니다. 기존 `ButtonConfig` 사용자에게 영향 없으며, 이전에 ad-hoc으로 처리되던 타입이 명시적으로 정의되어 타입 안전성이 개선됩니다.

---

## 요약

이 변경은 handler output을 flat shape에서 `{ config, output, meta }` 구조체로 마이그레이션하는 Phase 1→3 리팩토링의 일환으로, `adaptHandlerReturn`/`toEngineFlatShape` 어댑터를 통해 기존 엔진 코드와의 하위 호환성을 유지하려는 의도는 적절합니다. 그러나 세 가지 주요 부작용이 존재합니다: (1) structured/flat cache 모두에 `buttonConfig`가 없을 경우 non-null assertion이 런타임 TypeError를 유발하고, (2) `nodeExec.outputData` 저장 형식이 변경되어 DB 소비자를 파손할 수 있으며, (3) ChartHandler의 flat output에서 기존에 있던 `config` 키가 소실되어 이를 참조하는 기존 워크플로우 표현식이 깨집니다. 테스트 파일 변경은 새로운 구조체 형식을 잘 반영하고 있지만, DB 저장 형식 변경과 ChartHandler flat shape 변경에 대한 통합 테스트가 부재합니다.

## 위험도

**MEDIUM**