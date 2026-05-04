## 발견사항

### [INFO] 외부 의존성 추가 없음
- **위치**: 전체 변경 파일
- **상세**: 모든 신규 파일(`load-parent-workflow-names.ts`, `trigger-cell.tsx`)과 수정 파일이 이미 존재하는 외부 패키지(`typeorm`, `lucide-react`, `@nestjs/*`)만 사용. 신규 npm 패키지 설치 없음.
- **제안**: 이상 없음.

---

### [WARNING] 크로스 모듈 내부 의존성 — `dashboard` DTO가 `executions` 유틸을 직접 참조
- **위치**: `dashboard-response.dto.ts:3-5`
  ```ts
  import {
    EXECUTION_TRIGGER_SOURCES,
    type ExecutionTriggerSource,
  } from '../../../executions/utils/execution-trigger';
  ```
- **상세**: `dashboard` 모듈의 DTO가 `executions` 모듈의 내부 유틸(`utils/execution-trigger`)을 3단계 상위 경로로 직접 참조. `executions` 모듈이 리팩터링될 때 `dashboard` DTO까지 영향이 전파되는 구조적 결합이 생긴다. 같은 타입/상수를 `executions.service.ts`와 `dashboard.service.ts` 모두 동일 경로로 임포트하므로 현재는 중복 자체는 없지만, DTO 레이어가 다른 모듈의 `utils/`를 알아야 하는 점이 계층 경계 위반에 가깝다.
- **제안**: `ExecutionTriggerSource`와 `EXECUTION_TRIGGER_SOURCES`를 `src/common/types/execution-trigger.ts` 등 공유 레이어로 이동하거나, `executions` 모듈의 `index.ts`(배럴 파일)를 통해 공개 API로 노출. 그러면 dashboard DTO는 `../../../executions`만 참조하게 되어 내부 구현 경로를 노출하지 않아도 됨.

---

### [INFO] lucide-react 아이콘 임포트 정리 — 번들 영향 없음
- **위치**: `executions/page.tsx` diff (-6 import lines)
- **상세**: `User`, `Clock`, `Webhook`, `GitBranch`, `HelpCircle`, `LucideIcon` 임포트를 삭제하고, 동일 아이콘 셋을 신규 컴포넌트 `trigger-cell.tsx`로 이전. lucide-react는 tree-shaking이 적용되므로 번들 크기 변화 없음. 중복 코드 제거 효과 있음.
- **제안**: 이상 없음.

---

### [INFO] `loadParentWorkflowNames` 파라미터 주입 패턴 — 의존성 방향 적절
- **위치**: `load-parent-workflow-names.ts:12`
  ```ts
  export async function loadParentWorkflowNames(
    repo: Repository<Execution>,
    ...
  ```
- **상세**: 레포지토리를 인자로 받아 NestJS DI 컨테이너와 결합하지 않음. `ExecutionsService`와 `DashboardService` 양쪽에서 재사용 가능하며, 테스트 픽스처(`dashboard.service.spec.ts`)에서도 mock QueryBuilder를 그대로 주입할 수 있어 테스트 용이성이 높음.
- **제안**: 이상 없음.

---

## 요약

이번 변경은 신규 외부 패키지를 전혀 도입하지 않았고, 기존 `typeorm`·`lucide-react` 의존성을 정적 유틸/컴포넌트 수준에서 재활용하는 방식으로 잘 작성되었다. 유일한 지적 사항은 `dashboard-response.dto.ts`가 `executions` 모듈의 내부 유틸 경로를 직접 참조하는 크로스 모듈 결합으로, 공유 타입을 `common/` 레이어로 올리면 해소된다. 보안·라이선스·버전 충돌 리스크는 없다.

## 위험도

**LOW**