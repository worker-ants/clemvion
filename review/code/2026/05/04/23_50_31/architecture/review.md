## 아키텍처 코드 리뷰 결과

---

### 발견사항

---

**[WARNING]** 모듈 경계 위반 — `dashboard`가 `executions` 내부 유틸을 직접 참조
- **위치**: `dashboard.service.ts:10-14`, `dashboard-response.dto.ts:2-5`
- **상세**: `dashboard` 모듈이 `executions/utils/execution-trigger`, `executions/utils/load-parent-workflow-names`를 직접 import하고 있음. 특히 DTO 레이어(`dashboard-response.dto.ts`)가 다른 모듈의 내부 유틸 경로에 의존하는 것은 계층 책임 원칙 위반임. `executions` 모듈의 내부 구현이 변경될 때 `dashboard` 모듈이 영향을 받는 암묵적 결합 발생
- **제안**: 두 모듈이 공유하는 타입/상수/유틸(`ExecutionTriggerSource`, `EXECUTION_TRIGGER_SOURCES`, `loadParentWorkflowNames`)을 `common/executions/` 또는 `shared/` 네임스페이스로 이동하거나, `executions` 모듈의 barrel export(`index.ts`)를 통해 공개 API로만 접근하도록 경계를 명확히 할 것

---

**[WARNING]** `loadParentWorkflowNames`의 소속 위치가 실제 소비 범위와 불일치
- **위치**: `backend/src/modules/executions/utils/load-parent-workflow-names.ts`
- **상세**: 이 함수는 이제 `executions.service.ts`와 `dashboard.service.ts` 두 모듈에서 사용되고 있음. 모듈 내부 유틸(`executions/utils/`)에 위치하면서 외부 모듈이 의존하는 상태는 응집도와 모듈 경계 원칙 모두에 반함. 향후 `reports` 나 `analytics` 모듈이 추가되면 동일 패턴의 크로스 모듈 임포트가 증식할 위험이 있음
- **제안**: `backend/src/common/utils/` 또는 `backend/src/modules/executions/executions.utils.ts`(공개 배럴)로 이동하여 소비 범위를 명시적으로 표현

---

**[INFO]** DTO 레이어가 런타임 상수(`EXECUTION_TRIGGER_SOURCES`)를 타입 이상으로 참조
- **위치**: `dashboard-response.dto.ts:3`, `EXECUTION_TRIGGER_SOURCES` import
- **상세**: `ApiProperty({ enum: EXECUTION_TRIGGER_SOURCES })` 용도로 런타임 배열 상수를 import하고 있음. 타입만 필요한 경우와 달리 런타임 번들 의존성이 생겨 DTO와 비즈니스 로직 모듈 간 결합이 강해짐. 이 패턴이 계속 사용되면 DTO가 도메인 로직에 결합되는 Anemic DTO 안티패턴을 유발할 수 있음
- **제안**: `EXECUTION_TRIGGER_SOURCES` 상수를 `common/constants/`로 이동하거나, Swagger enum 값은 DTO 파일 내부에 인라인 문자열 배열로 정의하여 DTO의 독립성을 유지

---

**[INFO]** 테스트 전략 불일치 — 직접 생성자 주입 vs. NestJS 테스팅 모듈
- **위치**: `dashboard.service.spec.ts:66-70` vs. `websocket.gateway.spec.ts:33-59`
- **상세**: `DashboardService` 테스트는 `new DashboardService(repo as never, ...)` 방식으로 직접 의존성을 주입하고, `WebsocketGateway` 테스트는 `Test.createTestingModule()`을 사용함. 전자가 테스트 속도와 격리 측면에서 더 우수하지만, 두 패턴이 혼재하면 팀 일관성이 저하되고 신규 기여자의 판단 기준이 불명확해짐
- **제안**: 프로젝트 레벨에서 unit test 패턴을 문서화하거나 `CLAUDE.md`에 기준을 명시할 것. `DashboardService` 방식이 더 단순하므로 이를 표준으로 선택하는 것도 합리적임

---

**[INFO]** `TriggerCell` 컴포넌트의 `TRIGGER_ICON`/`TRIGGER_LABEL_KEY` 맵이 `ExecutionTriggerSource` 타입에 구조적으로 묶여 있음
- **위치**: `trigger-cell.tsx:12-26`
- **상세**: `Record<ExecutionTriggerSource, ...>` 타입을 사용하여 새 소스 타입 추가 시 컴파일 에러로 강제 업데이트를 유도함. 이는 OCP보다 실용적인 선택으로 현재 규모에서 적절함. 단, 소스 타입이 5개 이상으로 증가하면 별도 설정 파일 분리를 고려할 것
- **제안**: 현재 구조 유지. 소스 종류가 8개 이상이 되면 `TRIGGER_CONFIG: Record<ExecutionTriggerSource, { icon: LucideIcon; labelKey: TranslationKey }>` 단일 맵으로 통합 리팩터링 권장

---

### 요약

전반적인 아키텍처 방향성은 올바름. `loadParentWorkflowNames` 추출과 `TriggerCell` 공유 컴포넌트화는 DRY 원칙과 단일 책임 원칙을 잘 따른 개선임. 핵심 위험은 `dashboard` 모듈이 `executions` 모듈의 내부 유틸 경로를 직접 참조함으로써 모듈 경계가 느슨해진 점으로, 현재는 기능적 문제가 없지만 `executions` 모듈의 내부 리팩터링이 `dashboard`에 파급되는 암묵적 결합을 만들어냄. 공유 타입과 유틸을 `common/` 또는 명시적 배럴 export로 이전하면 모듈 자율성이 회복되고 향후 확장성도 확보됨.

### 위험도

**LOW**