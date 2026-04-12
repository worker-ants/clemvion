### 발견사항

---

**[WARNING] `SendEmailHandler`가 `IntegrationHandlerBase`를 상속하지 않고 동일 로직을 중복 구현**
- 위치: `send-email.handler.ts` — `safeLogUsage`, `execute` 내 통합 검증 블록
- 상세: `IntegrationHandlerBase`가 `resolveIntegration` / `logUsage` 공통 메서드를 제공함에도, `SendEmailHandler`는 직접 `getForExecution` / serviceType 검증 / status 검증 / logUsage를 중복 구현하고 있음. `SlackHandler`, `DatabaseQueryHandler`가 모두 `IntegrationHandlerBase`를 상속하는 것과 일관성 불일치.
- 제안: `SendEmailHandler extends IntegrationHandlerBase`로 변경하고, `safeLogUsage` → `this.logUsage`, 통합 검증 → `this.resolveIntegration()`으로 교체

---

**[WARNING] `ExecutionEngineService`에서 핸들러를 `new`로 직접 생성 — DI 패턴과 불일치**
- 위치: `execution-engine.service.ts:177-184`
- 상세: `new HttpRequestHandler(this.integrationsService)` 같이 서비스 내부에서 핸들러를 직접 인스턴스화하고 있음. NestJS DI 컨테이너를 우회하므로, 핸들러에 새 의존성이 추가될 때마다 이 파일을 함께 수정해야 함. `NodeHandlerRegistry`가 별도로 존재하는데 활용되지 않음.
- 제안: `NodeHandlerRegistry`에 핸들러 등록 로직을 위임하거나, 핸들러들을 NestJS Provider로 등록하여 DI로 주입받는 구조 고려

---

**[WARNING] `send-email.handler.ts`의 `execute` 메서드가 과도하게 길고 다중 책임**
- 위치: `send-email.handler.ts` — `execute` 메서드 (~140줄)
- 상세: 통합 조회, 타입 검증, 상태 검증, 자격증명 검증, 전송, 로깅까지 하나의 메서드에 모두 포함. `SlackHandler`나 `DatabaseQueryHandler`의 `execute`는 `resolveIntegration()`으로 위임해 훨씬 단순한 것과 대조적.
- 제안: `resolveIntegration()` 상속 후 자격증명 검증과 전송 로직을 private 메서드로 분리

---

**[INFO] `http-request.handler.ts` — 통합 미사용 시 logUsage 중복 분기**
- 위치: `http-request.handler.ts:173-198`, `http-request.handler.ts:215-224`
- 상세: `integrationId && authentication === 'integration'` 조건이 두 곳(성공/실패 경로)에 반복됨. 로그 기록 여부 결정 로직이 분산되어 있어 수정 시 누락 위험.
- 제안: 인증 모드를 플래그로 추출하거나 `logUsage` 메서드 내부에서 조건 처리

---

**[INFO] `IntegrationSelector` — `serviceTypes[0]`에 대한 암묵적 의존**
- 위치: `integration-selector.tsx:33-35`
- 상세: `serviceTypes`가 배열이지만 실제로는 단일 값만 사용됨(`serviceTypes[0]`). `createHref`, `displayName` 모두 첫 번째 요소만 참조. API 호출도 배열을 넘기지만 사실상 단수 필터.
- 제안: prop을 `serviceType: string` 단수로 변경하거나, 다중 타입이 실제로 필요한 경우 선택 기준을 명문화

---

**[INFO] `client.ts` — `paramsSerializer` 구현이 전역 클라이언트에 주석 없이 적용**
- 위치: `frontend/src/lib/api/client.ts`
- 상세: 주석이 존재하나 이미 추가되어 있어 양호. 다만 이 직렬화가 모든 API 호출에 영향을 미치므로, 다른 엔드포인트에서 bracket 형식을 기대하는 경우를 추후 식별하기 어려움.
- 제안: 주석에 "현재 모든 백엔드 엔드포인트가 repeated-key 형식을 사용함" 명시하여 의도적 선택임을 강조 (기존 주석 양호, 추가 개선 수준)

---

**[INFO] `DatabaseQueryHandler` — `queryType`에 `'raw'` 추가, validate와 실행 간 불일치 가능성**
- 위치: `database-query.handler.ts` validate 메서드
- 상세: `'raw'` queryType이 validate에서 허용되지만, execute 결과에 `queryType`을 그대로 반환할 뿐 실제 동작 상 분기 없음. 유지보수 중 `raw`를 특수 처리하려 할 때 validate 수정을 잊을 수 있음.
- 제안: 허용 목록을 상수로 추출: `const ALLOWED_QUERY_TYPES = ['select', 'insert', 'update', 'delete', 'raw'] as const`

---

### 요약

전반적으로 `IntegrationHandlerBase`를 통한 공통 로직 추출, `IntegrationError` 타입 계층, `toLogError` 헬퍼 등 유지보수성 관점에서 잘 설계된 구조를 채택하고 있다. 그러나 `SendEmailHandler`가 `IntegrationHandlerBase`를 상속하지 않아 동일한 통합 검증 로직을 약 60줄 중복 구현한 점이 가장 큰 유지보수 부채다. 이로 인해 향후 통합 검증 로직 변경 시 세 핸들러 중 이 파일만 누락될 위험이 있다. 핸들러 인스턴스화 방식도 NestJS DI와 충돌하여 의존성 추가 시 `ExecutionEngineService`를 반복 수정해야 하는 구조적 취약점이 있다.

### 위험도
**MEDIUM**