## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING] AuthConfigsService에서 모듈 경계 위반 (Cross-Module Direct Repository Injection)**
- 위치: `auth-configs.service.ts`, `auth-configs.module.ts`
- 상세: `AuthConfigsService`가 다른 모듈(`Execution`, `Trigger`)의 Repository를 직접 주입받고 있습니다. 이는 모듈 간 경계를 침범하며, `AuthConfigs` 모듈이 `Executions` 및 `Triggers` 모듈의 내부 영속성 레이어에 직접 의존하는 구조입니다. `TriggersService`, `ExecutionsService`가 이미 해당 데이터 접근 로직을 담당해야 합니다.
- 제안: `AuthConfigsModule`에서 `TriggersModule`과 `ExecutionsModule`을 import하고, 해당 서비스들을 주입받아 사용하도록 변경. Repository 직접 주입 제거.

```typescript
// 올바른 방식
constructor(
  @InjectRepository(AuthConfig)
  private readonly authConfigRepository: Repository<AuthConfig>,
  private readonly triggersService: TriggersService,
  private readonly executionsService: ExecutionsService,
) {}
```

---

**[WARNING] TriggersService에서 동일한 모듈 경계 위반**
- 위치: `triggers.service.ts`, `triggers.module.ts`
- 상세: `TriggersService`가 `Execution` Repository를 직접 주입받아 `getHistory()`를 구현합니다. Execution 데이터 접근은 `ExecutionsService`의 책임입니다.
- 제안: `ExecutionsModule`을 import하고 `ExecutionsService`를 통해 히스토리 조회.

---

**[WARNING] `SchedulesController`에 비즈니스 로직 혼입 (레이어 책임 위반)**
- 위치: `schedules.controller.ts:82-96`
- 상세: `runNow` 엔드포인트에서 컨트롤러가 직접 `workflowId` 추출 및 유효성 검사를 수행합니다. 컨트롤러는 HTTP 바인딩만 담당해야 하며, `schedule → workflow` 연결 로직은 서비스 레이어에 있어야 합니다.
- 제안: `SchedulesService.runNow(id, workspaceId, userId)` 메서드로 로직 이전.

---

**[WARNING] `integrations.service.ts`의 OAuth 설정 하드코딩 (개방-폐쇄 원칙 위반)**
- 위치: `integrations.service.ts:98-121`
- 상세: `reauthorize()` 메서드에 Slack, Google, GitHub의 OAuth URL과 scope가 하드코딩되어 있습니다. 새로운 서비스 추가 시 이 메서드를 수정해야 하며, `process.env` 키 조합도 서비스에서 직접 처리합니다. 이는 확장에 닫혀 있는 구조입니다.
- 제안: OAuth 설정을 별도 설정 파일이나 전략 패턴(Strategy Pattern)으로 분리. 환경변수 접근은 `ConfigService`를 통해 처리.

---

**[WARNING] `statistics.service.ts`의 PostgreSQL 특정 문법 사용으로 DB 결합도 증가**
- 위치: `statistics.service.ts:208-230`
- 상세: `::int`, `::float`, `::numeric`, `FILTER (WHERE ...)` 등 PostgreSQL 전용 문법이 TypeORM QueryBuilder에 직접 포함되어 있습니다. DB 교체나 테스트 시 문제가 발생합니다.
- 제안: 집계 후처리는 TypeScript 레이어에서 수행하거나, Raw Query를 별도 Repository 메서드로 격리.

---

**[WARNING] `statistics.controller.ts`의 `@Res()` 직접 사용 (NestJS 인터셉터 우회)**
- 위치: `statistics.controller.ts:48-67`
- 상세: `@Res()` decorator를 사용하면 NestJS의 Response Interceptors, Exception Filters가 해당 엔드포인트에서 동작하지 않습니다. 이는 횡단 관심사(cross-cutting concerns) 처리의 일관성을 깨뜨립니다.
- 제안: `@Res({ passthrough: true })`를 사용하거나, StreamableFile 반환 패턴 적용.

```typescript
@Get('export')
async exportData(@Res({ passthrough: true }) res: Response, ...) {
  res.setHeader(...)
  return new StreamableFile(buffer);
}
```

---

**[INFO] `layout.tsx`의 `"use client"` 추가로 서버 컴포넌트 이점 손실**
- 위치: `frontend/src/app/(main)/layout.tsx`
- 상세: 레이아웃 컴포넌트에 `"use client"`가 추가되어 하위 트리 전체가 클라이언트 컴포넌트가 됩니다. Sidebar가 React Query를 사용하기 위해 필요한 것으로 보이나, 레이아웃 자체는 서버 컴포넌트로 유지하고 Sidebar만 별도 클라이언트 컴포넌트로 분리하는 것이 더 적절합니다.
- 제안: `layout.tsx`는 서버 컴포넌트 유지. `Sidebar`가 이미 `"use client"`이므로 레이아웃에 추가 불필요.

---

**[INFO] `workflow import/export`에서 인덱스 기반 참조의 취약성**
- 위치: `workflows.service.ts:190-260`, `import-workflow.dto.ts`
- 상세: 노드 간 연결을 배열 인덱스(`sourceNodeIndex`, `targetNodeIndex`)로 표현합니다. 직렬화 순서가 보장되어야 하며, 외부에서 생성된 파일이 잘못된 인덱스를 가질 경우 silent failure가 발생합니다 (if문으로 건너뜀).
- 제안: 익스포트 시 임시 UUID를 사용하거나, 인덱스 범위 유효성 검사 추가.

---

**[INFO] `RunResultsDrawer`의 `activeTab` 상태 인덱스 기반 관리**
- 위치: `run-results-drawer.tsx`
- 상세: `activeTab`이 `nodeResults` 배열의 인덱스이므로, 결과가 추가되는 과정에서 인덱스가 유효하지 않을 수 있습니다.
- 제안: `nodeId`를 탭 식별자로 사용.

---

### 요약

전반적으로 기능 구현은 완성도 있게 이루어졌으나, **모듈 경계 위반**이 핵심 아키텍처 이슈입니다. `AuthConfigs`, `Triggers`, `Statistics` 모듈이 다른 모듈의 Repository를 직접 주입받아 사용하는 패턴이 반복되어, NestJS 모듈 시스템의 캡슐화 원칙이 무너지고 있습니다. 서비스 간 협력은 Repository가 아닌 Service를 통해 이루어져야 합니다. `integrations.service.ts`의 하드코딩된 OAuth 설정과 `statistics.controller.ts`의 `@Res()` 직접 사용도 확장성과 프레임워크 일관성 측면에서 개선이 필요합니다. 프론트엔드는 구조적으로 양호하나 `layout.tsx`의 불필요한 `"use client"` 전환은 서버 컴포넌트 최적화 기회를 놓치고 있습니다.

### 위험도

**MEDIUM**