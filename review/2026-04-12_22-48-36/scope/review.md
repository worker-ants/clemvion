## 발견사항

### [INFO] `chart.handler.ts` — `config` 필드 이름 변경
- **위치**: `chart.handler.ts` diff, `configEcho` 정의부
- **상세**: 기존 flat output에서 `config: { xAxis, yAxis, title }` 형태로 출력에 포함되던 필드가 `axes: { xAxis, yAxis }`로 이름이 바뀌어 `configEcho`에 들어갑니다. `toEngineFlatShape`을 통해 flat shape으로 변환되면 루트 레벨에 `axes` 키로 노출되며 기존의 `config` 키는 사라집니다. 표현식(`$node["chart"].config.xAxis`)으로 이 값을 참조하는 곳이 있다면 브레이킹 체인지입니다.
- **제안**: 변경이 의도된 것인지 확인하고, 다른 노드(예: expression resolver)에서 이 필드를 참조하는 코드가 없는지 grep으로 확인이 필요합니다.

---

### [WARNING] `nodeExec.outputData` 저장 형식 변경 — DB 퍼시스턴스 영향
- **위치**: `execution-engine.service.ts` diff 말미, `nodeExec.outputData = updatedStructured as unknown as Record<string, unknown>`
- **상세**: 버튼 인터랙션 처리 후 `nodeExecution` 엔티티에 저장하는 값이 기존의 flat `updatedOutput`에서 `NodeHandlerOutput` 구조의 `updatedStructured`로 바뀝니다. 이는 DB에 저장된 `node_execution.output_data` 컬럼의 형식을 바꾸는 것입니다. 기존 레코드를 읽는 코드(실행 히스토리 조회, 재개 로직 등)가 flat 형식을 가정하고 있으면 런타임 오류가 발생할 수 있습니다.
- **제안**: `nodeExec.outputData`를 읽는 모든 경로(특히 `recoverStuckExecutions`, 실행 재개 관련 코드)를 점검하여 양쪽 형식을 허용하거나 마이그레이션을 완전히 완료해야 합니다.

---

### [INFO] `handler-output.adapter.ts` — 불필요한 타입 캐스트 제거
- **위치**: `toEngineFlatShape` 함수 내 `output === null || output === undefined` 분기
- **상세**: `(adapted.config as Record<string, unknown>)` 캐스트 제거는 현재 작업 범위와 직접 관련은 없으나 기능 변경 없이 타입 정확도를 높이는 소규모 정리입니다. 범위를 약간 벗어나지만 무해합니다.
- **제안**: 허용 가능하나, scope review 관점에서는 별도 커밋으로 분리하는 것이 이상적입니다.

---

### [INFO] `button.types.ts` — `ButtonConfig`에 `buttonItemMap` 추가
- **위치**: `ButtonConfig` 인터페이스
- **상세**: 기존에는 `buttonItemMap`이 flat output의 루트에 임시로 존재했습니다. 이번 변경에서 `ButtonConfig`로 공식화한 것은 리팩토링과 직접 연결된 의도된 변경으로 보입니다. 다만 이 인터페이스를 사용하는 다른 소비자가 있다면 영향받을 수 있습니다.

---

### [INFO] `execution-engine.service.ts` — 복잡도 증가 (이중 조회 패턴)
- **위치**: `interactionType` 및 `buttonConfig` 조회 로직 (두 곳)
- **상세**: `structuredOutputCache?.meta?.interactionType ?? nodeOutput?.interactionType` 형태의 이중 조회 패턴이 두 군데 추가되어 있습니다. 이는 이전/이후 핸들러 혼재를 위한 Phase 1→3 마이그레이션 호환 코드로, 의도된 것이지만 완전 마이그레이션 후에는 제거 대상입니다.
- **제안**: 주석으로 "Phase 3에서 제거 예정" 임시 코드임을 명시하거나 TODO를 달아두는 것이 좋습니다.

---

## 요약

이번 변경은 `carousel`, `table`, `chart`, `pdf` 핸들러를 레거시 flat 출력 형식에서 `NodeHandlerOutput({ config, output, meta })` 구조로 마이그레이션하는 Phase 1 작업으로, 변경 범위가 전반적으로 일관되고 의도에 부합합니다. 테스트, 핸들러 구현, 엔진 서비스, 타입 정의가 모두 동시에 업데이트되어 있습니다. 다만 두 가지 주목할 점이 있습니다: (1) `chart.handler.ts`의 `config` → `axes` 이름 변경이 downstream 표현식 참조를 깨뜨릴 가능성, (2) `nodeExec.outputData`의 저장 형식 변경이 기존 DB 레코드를 읽는 로직에 영향을 줄 수 있는 점입니다. 이 두 부분을 확인하지 않으면 런타임 장애로 이어질 수 있습니다.

## 위험도

**MEDIUM**