## 성능 코드 리뷰

### 발견사항

---

**[INFO]** `structuredOutputCache` 중복 조회
- 위치: `execution-engine.service.ts` diff +463~468, +845~851
- 상세: 두 곳(`executeInline` 재진입 경로와 `resumeExecution` 경로)에서 동일한 패턴으로 `context.structuredOutputCache?.[node.id]` → `structuredMeta` → `interactionType`을 추출하는 로직이 중복된다. 현재는 단순 객체 프로퍼티 접근이라 비용이 낮지만, 이 패턴이 더 확산되면 헬퍼 함수로 추출하는 것이 유지보수 측면에서 유리하다.
- 제안: `getInteractionType(context, nodeId)` 유틸 함수로 추출해 재사용

---

**[INFO]** `waitForButtonInteraction` 내 구조화 출력 업데이트 시 객체 복사 비용
- 위치: `execution-engine.service.ts` diff +1539~1764, 특히 `structuredOutputPayload` 구성 블록
- 상세: `prevOutput = prevStructured?.output ?? cleanNodeOutput` 에서 `cleanNodeOutput`이 이미 `{ ...nodeOutput }` 스프레드 후 `delete` 연산을 거친 복사본이다. 이후 `updatedStructured`를 또 한번 객체 리터럴로 구성하므로, 단일 인터랙션 처리당 총 3~4회의 얕은 복사가 발생한다. 대용량 `nodeOutput`(예: 수백 행 테이블)의 경우 GC 압력이 증가할 수 있다.
- 제안: `cleanNodeOutput`을 만들 때 필요한 필드만 선택적으로 추출하거나, `previousOutput`을 `prevStructured?.output`으로만 한정해 `nodeOutput` 복사를 피하는 방향 검토

---

**[INFO]** `toEngineFlatShape`에서 `adapted.config` 타입 캐스팅 제거
- 위치: `handler-output.adapter.ts` diff +82
- 상세: `as Record<string, unknown>` 캐스팅 제거는 불필요한 타입 단언을 없애는 긍정적 변경이며 런타임 비용에는 영향 없음. 단, `adapted.config`의 타입이 `NodeHandlerOutput`에서 `Record<string, unknown>`으로 이미 선언되어 있는지 확인 필요. 타입 불일치가 있을 경우 런타임 오류 위험.
- 제안: `NodeHandlerOutput.config` 타입 정의를 명시적으로 `Record<string, unknown>`으로 고정되어 있는지 확인

---

**[INFO]** `configEcho` 중복 데이터 직렬화
- 위치: `carousel.handler.ts`, `chart.handler.ts`, `table.handler.ts` 각 handler의 `execute` 내
- 상세: `configEcho`에 `layout`, `mode`, `columns` 등 원본 `config`에서 이미 존재하는 데이터를 다시 복사해 새 객체를 생성한다. 캐러셀의 경우 `items` 배열 전체가 이미 `payload`에 들어가 있고, `configEcho`에는 포함되지 않아 이중 저장은 아니다. 다만 `table.handler.ts`의 `configEcho`에 `columns: resolvedColumns`를 넣으면 `payload.columns`와 동일 배열 참조가 두 군데 존재하게 된다 — 참조 공유이므로 메모리 이중 점유는 아니지만 의도 불명확.
- 제안: `configEcho`와 `payload`에서 `columns`가 동일 참조임을 주석으로 명시하거나, `configEcho`에서는 컬럼 필드명 목록만 저장하도록 정리

---

**[INFO]** `buttonItemMap` 이동으로 인한 타입 안전성 개선 (성능 무관, 긍정적 변경)
- 위치: `execution-engine.service.ts` diff +1623~1630, `button.types.ts` diff
- 상세: `buttonItemMap`을 `nodeOutput.buttonConfig`에서 매번 런타임 캐스팅으로 꺼내던 것을 `ButtonConfig` 인터페이스 필드로 승격시켰다. 이는 타입 안전성을 높이고, 향후 hot path에서의 불필요한 캐스팅/프로퍼티 탐색을 줄이는 데 기여한다.

---

### 요약

이번 변경은 기능 정확성(레거시 flat shape ↔ 구조화 `NodeHandlerOutput` 캐시 이중 관리)을 위한 리팩터링이 주목적이며, 성능 관점에서 심각한 문제는 없다. 주요 주의 사항은 `waitForButtonInteraction` 내에서 대형 노드 출력(특히 수백 행 테이블, 수십 항목 캐러셀)을 처리할 때 얕은 복사가 3~4회 중첩되어 GC 압력을 높일 수 있다는 점이다. 현재 트래픽 수준에서는 문제가 되지 않을 가능성이 높지만, 고빈도 인터랙션 시나리오나 대용량 데이터 처리 시 병목 후보가 될 수 있다. 나머지 사항들은 코드 구조 개선의 부산물로 발생한 경미한 중복/복사이며, 즉각적인 조치 없이 `INFO` 수준으로 모니터링하면 충분하다.

### 위험도

**LOW**