### 발견사항

---

**[WARNING] `asynckit`, `combined-stream`, `delayed-stream`, `form-data`, `mime-db`, `mime-types` — `devDependencies` → `dependencies` 격상**
- 위치: `package-lock.json` diff (`"dev": true` 제거)
- 상세: `@slack/web-api`의 의존성인 `axios`가 `form-data`를 production 의존으로 끌어오면서, 이전에 `devDependencies`로만 분류되던 패키지들이 production 번들에 포함됨. 실제 동작은 변하지 않지만, Docker 이미지 빌드 시 `npm ci --omit=dev`를 사용한다면 기존에는 dev로 제외되던 패키지들이 이제 포함됨.
- 제안: Docker/CI 빌드 스크립트를 확인하여 의도치 않은 번들 크기 증가가 없는지 검토.

---

**[WARNING] `p-finally`, `p-timeout` — `optional: true` 제거**
- 위치: `package-lock.json` (`p-finally`, `p-timeout` 항목)
- 상세: `p-queue`의 의존성 체인으로 인해 이전에 optional이던 두 패키지가 필수 의존으로 변경됨. 설치 환경에서 해당 패키지를 누락해도 되던 시나리오가 더 이상 유효하지 않음.
- 제안: 저위험이나, 최소화 빌드 파이프라인이 있다면 확인 필요.

---

**[WARNING] `ExecutionContext.nodeExecutionId` 주입 시점이 handler 호출 직전 — 재사용 컨텍스트 오염 위험**
- 위치: `execution-engine.service.ts` — `nodeContext = { ...nodeContext, nodeExecutionId: nodeExecution.id }`
- 상세: spread로 새 객체를 만들어 재할당하므로 기존 `nodeContext` 참조는 유지됨. 하지만 만약 `nodeContext`가 어딘가 캐시되거나 공유된 참조로 전달된다면, 이전 실행의 `nodeExecutionId`가 잔류할 수 있음. 현재 코드 구조상 직접적 문제는 없으나, 루프/forEach 컨테이너에서 동일 컨텍스트를 재사용하는 경우 로그 귀속 오류 가능성 존재.
- 제안: `LoopExecutor`, `ForEachExecutor`에서 자식 노드 실행 시 컨텍스트 복사 방식을 재확인.

---

**[WARNING] `SendEmailHandler`가 `IntegrationHandlerBase`를 상속하지 않고 `safeLogUsage`를 직접 구현**
- 위치: `send-email.handler.ts`
- 상세: `DatabaseQueryHandler`, `HttpRequestHandler`, `SlackHandler`는 모두 `IntegrationHandlerBase`를 extends하여 `logUsage`를 공유하지만, `SendEmailHandler`만 독자적인 `safeLogUsage` private 메서드를 구현함. `IntegrationHandlerBase.logUsage`에 변경(예: 공통 메타데이터 추가)이 생기면 `SendEmailHandler`만 누락됨.
- 제안: `SendEmailHandler`도 `IntegrationHandlerBase`를 extends하도록 통일.

---

**[INFO] `HttpRequestHandler` — non-integration 호출 시 network 오류는 usage log를 남기지 않음**
- 위치: `http-request.handler.ts` catch 블록
- 상세: catch 블록의 `logUsage` 호출이 `integrationId && authentication === 'integration'` 조건으로 guard되어 있어 의도적인 설계. 하지만 integration 경로에서 `resolveIntegration` 성공 후 실제 fetch transport 오류가 발생하면, 상단에서 이미 `credentials` 를 설정했음에도 logUsage 조건이 `integrationId && authentication === 'integration'` 체크에 의존하므로 실제로는 정상 동작함. INFO 수준.

---

**[INFO] `IntegrationSelector` — `serviceTypes` 배열이 매 렌더마다 새 참조 생성 시 무한 query refetch 가능**
- 위치: `integration-selector.tsx` — `queryKey: ["integrations", "list", { serviceTypes }]`
- 상세: 부모 컴포넌트가 `serviceTypes={["email"]}`을 inline literal로 넘기면 매 렌더마다 새 배열 참조가 생성되지만, React Query는 deep equality로 key를 비교하므로 실제 무한 루프는 발생하지 않음. 단, 부모가 자주 리렌더되면 staleTime(30s) 이내에도 불필요한 key 비교 오버헤드가 발생.
- 제안: 호출 측에서 `useMemo`로 배열을 안정화하거나, `queryKey`에 `JSON.stringify(serviceTypes)` 사용 고려.

---

**[INFO] `axios` 전역 `paramsSerializer` 변경 — 기존 API 호출 파라미터 직렬화 방식 전면 변경**
- 위치: `frontend/src/lib/api/client.ts`
- 상세: `apiClient` 인스턴스 전체에 적용되므로, 기존에 배열 파라미터를 `foo[]=a&foo[]=b` 형식으로 기대하던 엔드포인트가 있다면 동작이 달라짐. 현재 NestJS 백엔드의 쿼리 파서가 repeated key 방식을 사용하므로 의도적인 변경이나, 다른 엔드포인트에서 배열 파라미터 사용 여부를 전수 확인 필요.
- 제안: 배열 쿼리 파라미터를 사용하는 엔드포인트(`/integrations` 외) e2e 테스트로 회귀 검증 권장.

---

### 요약

이번 변경의 핵심 부작용은 크게 두 가지다. 첫째, `@slack/web-api` → `axios` 의존성 체인으로 인해 여러 패키지의 `devDependencies` 분류가 제거되어 production 빌드 아티팩트 크기에 영향을 줄 수 있다. 둘째, `SendEmailHandler`만 `IntegrationHandlerBase`를 상속하지 않아 공통 로직 갱신 시 누락될 위험이 있다. 나머지 변경사항 — `nodeExecutionId` 컨텍스트 주입, `paramsSerializer` 전역 변경, `IntegrationSelector` query key 안정성 — 은 현재 동작에 직접적인 문제를 일으키지 않으나 주의가 필요한 구조적 패턴이다. 전반적으로 설계는 일관성이 있으며 의도치 않은 외부 상태 변경이나 전역 변수 오염은 없다.

### 위험도

**LOW**