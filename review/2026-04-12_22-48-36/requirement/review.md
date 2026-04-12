## 발견사항

### [CRITICAL] `buttonConfig` non-null 단언 시 런타임 크래시 위험
- **위치**: `execution-engine.service.ts`, `waitForButtonInteraction` 메서드, 라인 ~1547
- **상세**: `buttonConfig = ((structuredConfig?.buttonConfig ?? nodeOutput.buttonConfig) as ButtonConfig | undefined)!` — 양쪽 캐시 모두 없을 경우 (서버 재시작 후 복구된 실행, 또는 캐시 초기화 타이밍 이슈) `buttonConfig`가 `undefined`가 되고, 바로 다음 줄 `buttonConfig.buttons`에서 NPE 발생
- **제안**: non-null 단언 제거 후 명시적 early-return 또는 throw로 방어
```typescript
if (!buttonConfig) {
  throw new Error(`[waitForButtonInteraction] buttonConfig missing for node ${node.id}`);
}
```

---

### [WARNING] DB 저장 형태 변경으로 인한 하위 호환성 파괴
- **위치**: `execution-engine.service.ts` 라인 ~1762
- **상세**: `nodeExec.outputData`가 기존 flat shape(`updatedOutput`)에서 structured shape(`updatedStructured`)로 변경. 기존 DB에 저장된 데이터는 구형 flat 구조, 신규는 `{ config, output, meta, port, status }` 구조. 프론트엔드나 다른 서비스가 `nodeExec.outputData`를 직접 읽는다면 형태 불일치로 런타임 오류 발생 가능. 마이그레이션 전략 없음
- **제안**: `nodeExec.outputData`는 flat shape 유지 또는 별도 `structuredOutputData` 컬럼 추가; 혹은 DB 마이그레이션 스크립트 작성

---

### [WARNING] `status` 필드의 의미론적 오용
- **위치**: `execution-engine.service.ts` 라인 ~1750
- **상세**: `updatedStructured.status = interactionData.interactionType as string` — `status`에 `'button_click'`, `'button_continue'`, `'button_timeout'` 같은 인터랙션 타입을 할당. 기존 코드에서 `status`는 워크플로우 상태 머신 값(`'waiting_for_input'` 등)을 의미. `structuredOutputCache` 조회 코드에서 `structuredMeta?.interactionType`을 별도로 읽는 것과 불일치
- **제안**: `status: 'completed'` 혹은 별도 필드 사용; `interactionType`은 `meta`에만 보관

---

### [WARNING] Chart 핸들러의 output 구조 변경으로 표현식 참조 깨짐
- **위치**: `chart.handler.ts` 라인 ~66
- **상세**: 기존 반환값에 `output.config: { xAxis, yAxis, title }`가 포함되어 있었으나, 새 구조에서는 `config.axes: { xAxis, yAxis }`로 이동. 워크플로우 표현식에서 `$node["차트노드"].output.config.xAxis` 참조 시 undefined 반환
- **제안**: spec 문서에서 `$node` 접근 경로 확인 후, 기존 경로 호환 여부 테스트 추가

---

### [WARNING] `previousOutput` 필드의 의도치 않은 노출
- **위치**: `execution-engine.service.ts` 라인 ~1741
- **상세**: `structuredOutputPayload.previousOutput = prevOutput`를 항상 설정하여 이전 출력 전체가 구조화 캐시에 노출됨. 이 필드는 내부 상태용이나 `$node["..."].output.previousOutput`으로 표현식에서 참조 가능해짐. 의도하지 않은 데이터 노출 및 순환 참조 위험
- **제안**: `previousOutput` 필드를 비공개 내부 필드로 명시하거나, structured output에서 제거하고 별도 내부 맵으로 관리

---

### [WARNING] PDF 핸들러 테스트 누락
- **위치**: `pdf.handler.ts`
- **상세**: PDF 핸들러가 새 shape(`{ config, output, status }`)로 변경되었으나 테스트 파일이 diff에 포함되지 않음. `status: 'requires_playwright'`가 엔진에서 `waiting_for_input`과 다르게 처리되는지 검증 없음
- **제안**: `pdf.handler.spec.ts` 작성하여 신규 output shape 및 `requires_playwright` 상태 처리 검증

---

### [INFO] `toEngineFlatShape` 타입 캐스트 제거
- **위치**: `handler-output.adapter.ts` 라인 ~82
- **상세**: `(adapted.config as Record<string, unknown>)` → `adapted.config` — `NodeHandlerOutput.config`가 이미 `Record<string, unknown>`으로 타이핑되어 있으므로 올바른 정리. 동작 변화 없음

---

### [INFO] `buttonItemMap` 타입 명시화
- **위치**: `button.types.ts`
- **상세**: `buttonItemMap`이 `ButtonConfig` 인터페이스에 추가되어 타입 안전성 향상. 기존 이중 캐스트(`as Record<string, unknown>`)를 제거 가능하게 함. 적절한 변경

---

## 요약

이번 변경은 프레젠테이션 핸들러(carousel, table, chart, pdf)의 반환 형태를 `{ config, output, meta?, status? }` 구조로 통일하는 Phase 1→3 마이그레이션의 일환으로 의도는 명확하고 전반적인 방향성은 올바름. 그러나 **`buttonConfig` non-null 단언**으로 인한 크래시 위험과 **DB 저장 형태 변경**으로 인한 하위 호환성 파괴가 프로덕션에서 실제 장애를 유발할 수 있는 핵심 이슈로 즉시 해결이 필요함. `status` 필드에 인터랙션 타입을 저장하는 의미론적 오용과 chart 출력 구조 변경으로 인한 표현식 참조 경로 파괴 역시 런타임 오류를 초래할 수 있어 수정이 필요함.

## 위험도

**HIGH**