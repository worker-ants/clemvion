## 발견사항

---

### **[WARNING] `SendEmailHandler`가 `IntegrationHandlerBase`를 상속하지 않음**
- **위치**: `send-email.handler.ts`
- **상세**: `DatabaseQueryHandler`, `HttpRequestHandler`, `SlackHandler`는 모두 `IntegrationHandlerBase`를 상속하여 `resolveIntegration` / `logUsage`를 공유하지만, `SendEmailHandler`만 `NodeHandler`를 직접 구현하고 `safeLogUsage` 프라이빗 메서드를 별도로 정의했습니다. 동일한 패턴이 두 곳에 존재하며, 향후 `IntegrationHandlerBase`가 변경될 때 `SendEmailHandler`는 자동으로 따라가지 않습니다.
- **제안**: `SendEmailHandler`도 `IntegrationHandlerBase`를 상속하고, `safeLogUsage` 대신 `this.logUsage`를 사용하도록 리팩터링. integration 검증 로직(`serviceType !== 'email'`, `status !== 'connected'`) 역시 `resolveIntegration`으로 위임 가능.

---

### **[WARNING] NestJS IoC를 우회하는 수동 핸들러 생성 패턴**
- **위치**: `execution-engine.service.ts:177–186`
- **상세**: 핸들러들이 `new HttpRequestHandler(this.integrationsService)` 형태로 `onModuleInit` 안에서 직접 인스턴스화됩니다. NestJS DI 컨테이너를 우회하기 때문에 테스트 시 수동 의존성 주입이 필요하고, 향후 핸들러에 추가 의존성이 생기면 `ExecutionEngineService` 생성자도 함께 수정해야 합니다(OCP 위반, 높은 결합도).
- **제안**: 핸들러를 NestJS Provider로 등록하고 `NodeHandlerRegistry`가 DI로 주입받거나, 최소한 `HandlerFactory`를 별도 서비스로 분리하여 핸들러 생성 책임을 분리.

---

### **[WARNING] `nodeExecutionId`가 선택적 필드여서 로깅이 묵시적으로 스킵됨**
- **위치**: `node-handler.interface.ts`, `integration-handler-base.ts:69`
- **상세**: `nodeExecutionId?: string`이 undefined이면 `logUsage`가 조용히 early-return합니다. 엔진이 핸들러 호출 전에 항상 주입한다고 가정하지만, 새 코드 경로나 테스트에서 누락될 경우 사용 로그가 무음으로 유실됩니다.
- **제안**: `ExecutionContext` 내 통합 핸들러가 사용하는 필드들을 별도 `IntegrationExecutionContext`로 분리하거나, 적어도 런타임 체크 시 경고 로그를 남기도록 변경.

---

### **[WARNING] `paramsSerializer` 변경이 전역 API 클라이언트에 적용됨**
- **위치**: `frontend/src/lib/api/client.ts`
- **상세**: 배열 파라미터 직렬화 방식 변경은 통합 관련 API 외에도 기존 모든 엔드포인트에 영향을 미칩니다. 다른 엔드포인트에서 bracket 형식(`foo[]=a`)을 사용하고 있었다면 동작이 깨집니다.
- **제안**: 변경 전 기존 API 호출 전수 점검이 필요하며, 이 변경은 별도 커밋/PR로 분리하여 영향 범위를 명확히 관리할 것을 권장.

---

### **[INFO] `buildHttpCredentials` / `runAction` switch-case가 OCP를 위반**
- **위치**: `http-request.handler.ts:227`, `slack.handler.ts` `runAction`
- **상세**: 새 HTTP auth 타입이나 Slack 액션을 추가할 때마다 기존 함수를 수정해야 합니다. 현재 규모에서는 허용 가능하지만, 지원 타입이 늘어날수록 단일 파일이 비대해집니다.
- **제안**: 각 auth 타입 / 액션을 별도 전략 객체로 분리하는 구조를 고려. 단기적으로는 현재 구조도 무방.

---

### **[INFO] `getForExecution`이 암호화되지 않은 자격증명을 반환하지만 추상화 없음**
- **위치**: `integrations.service.ts:676`
- **상세**: 타입 시스템 수준에서 "secret material" 여부가 표현되지 않습니다. 동일한 `Integration` 엔티티가 마스킹된 응답(`findAll`)과 원문 자격증명(`getForExecution`) 두 경로 모두에 사용됩니다.
- **제안**: 반환 타입을 `IntegrationWithCredentials` 같은 별도 마커 타입으로 구분하거나, `getForExecution`의 네이밍 컨벤션(`getDecryptedForExecution`)으로 호출자에게 의도를 명확히 전달.

---

### **[INFO] `ExecutionEngineModule` → `IntegrationsModule` 의존성 추가**
- **위치**: `execution-engine.module.ts:28`
- **상세**: 실행 엔진이 통합 모듈에 직접 의존하게 됩니다. 현재는 단방향이라 순환 참조 위험은 없지만, 향후 `IntegrationsModule`이 실행 결과를 참조할 경우 순환 의존이 발생할 수 있습니다.
- **제안**: 의존 방향 문서화 및 `IntegrationsModule`이 `ExecutionEngineModule`을 import하지 않도록 아키텍처 제약 명시.

---

## 요약

전체적으로 `IntegrationHandlerBase`를 통한 공통 패턴 추출, `ExecutionContext`에 `nodeExecutionId` 주입, 프론트엔드의 `IntegrationSelector` 컴포넌트 분리 등 아키텍처적으로 올바른 방향을 취하고 있습니다. 다만 `SendEmailHandler`가 베이스 클래스를 상속하지 않아 동일 패턴이 중복 구현된 점이 핵심 불일치이며, 핸들러를 NestJS DI 외부에서 수동 생성하는 패턴은 모듈 확장성을 제한합니다. `paramsSerializer` 전역 변경은 회귀 위험을 내포하고 있어 별도 검증이 필요합니다.

## 위험도

**MEDIUM**