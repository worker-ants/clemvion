### 발견사항

---

**[WARNING] 이중 캐시 조회 로직이 서비스 전체에 중복 산재**
- 위치: `execution-engine.service.ts` ~L461-491, ~L845-866
- 상세: `interactionType` 해석을 위한 폴백 패턴이 최소 두 곳에 복제되어 있음.
  ```typescript
  const structuredMeta = structuredOutput?.meta;
  const interactionType =
    (structuredMeta?.interactionType as string | undefined) ??
    (nodeOutput?.interactionType as string | undefined);
  ```
  "interactionType을 어떻게 읽는가"라는 단일 지식이 분산되어 있고, 캐시 키 확인 → 폴백 → 타입 캐스팅 절차가 변경될 경우 모두 수정해야 함.
- 제안: `ExecutionContextService` 또는 별도 헬퍼에 `resolveInteractionType(context, nodeId): string | undefined` 메서드를 추출하여 단일 진실 공급원(SSOT)으로 관리.

---

**[WARNING] `waitForButtonInteraction`의 단일 책임 원칙 위반**
- 위치: `execution-engine.service.ts` ~L1539-1766
- 상세: 단일 메서드가 이하를 모두 담당함:
  1. 플랫 캐시 조회 (`nodeOutputCache`)
  2. 구조화 캐시 조회 (`structuredOutputCache`)
  3. `updatedOutput` (플랫 형태) 구성
  4. `updatedStructured` (신규 형태) 구성 및 미러링
  5. 두 캐시 동시 갱신
  6. `nodeExec` DB 저장
  7. WebSocket 이벤트 발행

  변경 이후 메서드 길이가 크게 증가하였으며, 상호작용 결과를 `NodeHandlerOutput`으로 변환하는 로직이 엔진 서비스 안에 인라인으로 매몰됨.
- 제안: 구조화 출력 페이로드 조립 로직(`structuredOutputPayload` 빌드 블록)을 `InteractionResultMapper` 또는 `handler-output.adapter.ts`의 함수로 추출. 캐시 미러링 책임은 `ExecutionContextService`로 이관.

---

**[WARNING] 하드코딩된 `interactionType` 분기 — 확장성 결함**
- 위치: `execution-engine.service.ts` ~L483-495, ~L858-870
- 상세:
  ```typescript
  } else if (interactionType === 'buttons') {
  } else if (interactionType === 'ai_conversation') {
  ```
  새로운 인터랙션 타입(예: `'form_step'`, `'file_upload'`) 추가 시 엔진 서비스 직접 수정 필요. OCP 위반.
- 제안: `InteractionHandler` 인터페이스를 정의하고 `NodeHandlerRegistry`와 유사한 `InteractionHandlerRegistry`에 등록 방식으로 전환. 또는 최소한 분기 로직을 단일 메서드로 위임(`dispatchInteractionWait(type, ...)`)하여 변경 지점을 일원화.

---

**[WARNING] `nodeExec.outputData` 저장 형태 변경 — 하위 호환 위험**
- 위치: `execution-engine.service.ts` ~L1755
- 상세:
  ```typescript
  // 이전: nodeExec.outputData = updatedOutput (플랫 형태)
  // 이후: nodeExec.outputData = updatedStructured as unknown as Record<string, unknown>
  ```
  DB에 저장되는 `outputData` 형태가 변경됨. 이 컬럼을 직접 조회하는 조회 API, 이력 재조회 로직, 또는 외부 이벤트 소비자가 구 형태를 기대할 경우 런타임 오류 발생. `as unknown as` 이중 캐스팅은 타입 안전성 상실을 나타내는 신호.
- 제안: DB 스키마/엔티티 수준에서 `NodeExecution.outputData`의 공식 타입을 `NodeHandlerOutput`으로 갱신하고, 기존 레코드 조회 시 역방향 호환 어댑터 적용 여부를 검토.

---

**[WARNING] `previousOutput` 중첩 저장 — 무한 성장 위험**
- 위치: `execution-engine.service.ts` ~L1737
- 상세:
  ```typescript
  structuredOutputPayload.previousOutput = prevOutput;
  ```
  버튼 인터랙션이 반복될수록 `output.previousOutput.previousOutput...` 형태로 체인이 누적될 수 있음. 특히 루프 노드에서 반복 실행 시 메모리 및 직렬화 비용 문제.
- 제안: `previousOutput` 저장이 필요하다면 깊이를 1로 제한하거나, 이력은 `nodeExecutionRepository`의 별도 레코드로 관리하고 캐시에는 최신 상태만 유지.

---

**[INFO] `configEcho` 패턴 — 핸들러-엔진 간 불필요한 결합**
- 위치: `carousel.handler.ts` ~L221, `chart.handler.ts` ~L72, `table.handler.ts` ~L157
- 상세: 각 핸들러가 자신이 받은 config 일부를 `configEcho`로 출력에 재포함. 핸들러는 "처리 결과"만 반환해야 하는데, 처리 입력 파라미터를 역으로 전달하는 구조는 핸들러가 엔진의 캐시 전략을 인지하고 있다는 의미.
- 제안: 엔진이 `adaptHandlerReturn` 시점에 원본 `node.config`를 `NodeHandlerOutput.config`에 병합하는 방식을 고려. 핸들러는 순수하게 `output`과 인터랙션 메타만 반환.

---

**[INFO] `ButtonConfig.buttonItemMap` — 모듈 경계 오염**
- 위치: `button.types.ts` L13
- 상세: `buttonItemMap`은 캐러셀/테이블의 per-item 버튼 매핑이라는 구체적 구현 세부사항. 이를 공통 `ButtonConfig` 인터페이스에 추가하면 버튼 타입 모듈이 프레젠테이션 핸들러의 내부 구현에 종속됨.
- 제안: `CarouselButtonConfig extends ButtonConfig { buttonItemMap?: ... }` 형태로 확장 타입으로 분리하거나, `ButtonConfig`의 optional 필드로 유지하되 JSDoc에 "캐러셀/테이블 전용"임을 명시하고 일반 버튼 검증 로직에서 무시하도록 처리.

---

### 요약

이번 변경은 플랫 핸들러 반환 형태에서 `{ config, output, meta }` 구조화 형태로의 마이그레이션 1단계를 구현한 것으로, 어댑터 패턴 적용과 하위 호환 폴백 전략은 방향성 자체가 올바르다. 그러나 이중 캐시 운영에 따른 폴백 로직이 `ExecutionEngineService` 전체에 산재하여 단일 책임 원칙을 위반하고 있으며, `waitForButtonInteraction`은 캐시 조회·빌드·미러링·DB 저장·이벤트 발행을 모두 담당하는 신 메서드(god method)로 성장하고 있다. 특히 하드코딩된 `interactionType` 분기와 `nodeExec.outputData` 형태 변경은 확장성과 하위 호환성 측면에서 중기적 리스크를 내포하므로, Phase 3 완료 전에 인터랙션 디스패치 레지스트리 도입과 컨텍스트 서비스로의 책임 이관을 우선적으로 고려할 것을 권장한다.

### 위험도

**MEDIUM**