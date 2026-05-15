## 발견사항

---

### [CRITICAL] `WorkflowsModule`에 `Node` 엔티티 미등록
- **위치**: `workflows.controller.ts` — `@InjectRepository(Node)` 주입
- **상세**: `WorkflowsController`가 `@InjectRepository(Node)`를 새로 사용하지만, `workflows.module.ts`의 변경 내역이 없음. `TypeOrmModule.forFeature([Node])`가 없으면 런타임에 "No repository for Node" 오류 발생.
- **제안**: `workflows.module.ts`에 `Node` 엔티티 등록 추가. 또는 `loadTriggerParameterSchema`를 Controller가 아닌 공통 서비스로 이동.

---

### [WARNING] `BadRequestException` 중복 임포트
- **위치**: `workflows.controller.ts` — 상단 임포트 블록
- **상세**:
  ```ts
  import { ..., ParseUUIDPipe } from '@nestjs/common';
  import { BadRequestException } from '@nestjs/common';  // 중복
  ```
  동일 패키지에서 두 번 임포트. 불필요한 추가 임포트.
- **제안**: 첫 번째 `@nestjs/common` 임포트 블록에 `BadRequestException`을 추가하고 별도 라인 제거.

---

### [WARNING] `loadTriggerParameterSchema` 메서드 3중 복제
- **위치**: `hooks.service.ts`, `schedule-runner.service.ts`, `workflows.controller.ts`
- **상세**: 동일한 로직(triggerNode 조회 → schema 추출 → 유효성 검사)이 세 곳에 복제됨. 특히 Controller에 DB 조회 로직이 직접 들어가는 것은 레이어 책임 위반.
- **제안**: `ExecutionEngineModule`이나 별도 `TriggerParameterService`로 추출하여 공유. 이 변경이 현 PR 범위를 벗어나면 최소한 `WorkflowsService`로 이동.

---

### [WARNING] `editor-toolbar.tsx`의 `fromNodeId` 래핑 변경 — 잠재적 동작 변경
- **위치**: `editor-toolbar.tsx` — "Run from node" 경로
- **상세**:
  ```ts
  // 변경 전
  { fromNodeId: selectedNodeId }
  // 변경 후
  { input: { fromNodeId: selectedNodeId } }
  ```
  백엔드 컨트롤러가 `body.fromNodeId`가 아닌 `body.input.fromNodeId`로 읽도록 변경된 것인지 확인 필요. 컨트롤러 diff에서 `fromNodeId` 관련 처리가 보이지 않음.
- **제안**: `WorkflowsController`의 `run` 엔드포인트에서 `input.fromNodeId`를 올바르게 처리하는지 확인.

---

### [INFO] `execution-engine.service.ts` — 타입 캐스트 제거
- **위치**: `execution-engine.service.ts:1238`
- **상세**: `nodeOutput as Record<string, unknown>` → `nodeOutput` 변경. 현 PR 목적과 직접적인 관련 없는 minor cleanup이지만 타입 안전성 개선이라 무해함.

---

### [INFO] `ExpressionResolverService` public export — 노출 범위 확대
- **위치**: `execution-engine.module.ts`
- **상세**: 내부 서비스였던 `ExpressionResolverService`가 모듈 외부로 노출됨. 현재 사용처가 없어 보임(diff 상 타 모듈이 import하는 코드 없음). `ScheduleRunnerService`는 `evaluate`를 직접 임포트하여 사용.
- **제안**: 실제 외부 의존성이 생기기 전까지는 export 보류 고려.

---

## 요약

변경의 핵심 목적(Manual Trigger 파라미터 스키마 선언 → Webhook/Schedule/Manual 실행 시 검증 및 `$params` 표현식 지원)은 명확하고 대부분의 변경이 범위에 부합한다. 그러나 **`WorkflowsModule`에 `Node` 엔티티가 등록되지 않은 것은 런타임 오류를 유발하는 Critical 누락**이며, `loadTriggerParameterSchema`의 3중 복제는 책임 범위를 넘어 Controller에 DB 조회 로직을 삽입하는 문제가 있다. `BadRequestException` 중복 임포트와 `fromNodeId` 래핑 변경도 점검이 필요하다.

## 위험도

**HIGH** — `WorkflowsModule` 미등록으로 인한 런타임 오류 위험