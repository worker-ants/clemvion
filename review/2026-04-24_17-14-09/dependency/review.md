## 발견사항

### [INFO] 새 외부 패키지 없음 — 모든 추가 의존성은 내부 모듈
- **위치**: 전체 변경사항
- **상세**: 외부 npm 패키지가 한 개도 추가되지 않았습니다. 백엔드 추가분(`@nestjs/common`, `IntegrationsModule`, `KnowledgeBaseModule` 등)은 이미 존재하는 NestJS 모듈이며, 프론트엔드 추가분(`lucide-react`, `react`, `@testing-library/*`, `vitest`)도 모두 기존 의존성입니다.
- **제안**: 조치 불필요.

---

### [WARNING] `IntegrationsModule` · `KnowledgeBaseModule` 신규 임포트 — 순환 의존성 위험 미검증
- **위치**: `workflow-assistant.module.ts` +35~38
- **상세**: `WorkflowAssistantModule`은 이미 `TypeOrmModule.forFeature([Integration, KnowledgeBase, ...])` 로 두 엔티티를 참조하고 있었습니다. 이번 변경으로 **모듈 수준**의 임포트(`IntegrationsModule`, `KnowledgeBaseModule`)까지 추가되면서 의존 범위가 넓어졌습니다. 두 모듈 중 하나라도 `WorkflowAssistantModule` 또는 그 이행 의존성을 임포트한다면 NestJS 순환 참조가 발생합니다. 변경 diff에는 두 모듈의 `imports` 배열이 포함되어 있지 않아 현재 diff만으로는 순환 여부를 확인할 수 없습니다.
- **제안**: `IntegrationsModule` 과 `KnowledgeBaseModule`의 `imports` 배열을 직접 확인하거나, `nest build --webpack` 출력·`madge --circular` 등 도구로 빌드 시 순환 의존성이 없음을 검증하십시오. 만약 순환이 발생한다면 `forwardRef()` 를 사용하거나, `CandidateLookupService` 가 두 서비스를 직접 주입받는 대신 Repository를 직접 쓰는 방향으로 분리를 검토하십시오.

---

### [WARNING] `IntegrationsService` · `KnowledgeBaseService` · `LlmConfigService` 의 `exports` 여부 미검증
- **위치**: `candidate-lookup.service.ts` +3~9, `workflow-assistant.module.ts` +35~38
- **상세**: NestJS에서 모듈을 임포트해도, 해당 모듈이 Provider를 `exports` 배열에 포함시키지 않으면 다른 모듈에서 주입받을 수 없습니다. Diff에 세 모듈의 `exports` 배열이 포함되어 있지 않습니다. 런타임에 "Nest can't resolve dependencies of the CandidateLookupService" 오류가 발생할 수 있습니다.
- **제안**: 각 모듈 파일에서 `exports: [IntegrationsService]` 등의 선언을 확인하십시오. 이미 다른 모듈에서 동일 서비스를 주입받고 있다면(e.g., `LlmConfigService`는 기존에도 사용), exports가 이미 설정되어 있다고 볼 수 있지만, 신규 두 모듈(`IntegrationsModule`, `KnowledgeBaseModule`)은 명시적 검증이 필요합니다.

---

### [INFO] `LlmConfigService.findAll` 반환 타입이 `Record<string, unknown>` — 모듈 간 계약 불명확
- **위치**: `candidate-lookup.service.ts` +110~130 (`lookupLlmConfigs`)
- **상세**: 코드 주석에 "LlmConfigService.findAll 의 row 타입이 `Record<string, unknown>` 로 선언되어 있어"라고 명시되어 있습니다. `defaultModel` vs `model` 분기를 런타임 typeof 체크로 처리하고 있습니다. 이는 모듈 간 타입 계약 부재를 시사합니다. 의존성 자체가 잘못된 것은 아니나, `LlmConfigService` 의 응답 타입이 변경될 경우 컴파일 타임에 감지할 수 없습니다.
- **제안**: `LlmConfigService`에 적절한 반환 타입(entity 또는 DTO)이 선언되어 있다면 사용하고, 없다면 엔티티 파일에 타입을 추가하여 모듈 간 계약을 명확히 하십시오.

---

### [INFO] `ListIntegrationsQueryDto.serviceType` 가 `string[]` 수용 여부 미검증
- **위치**: `candidate-lookup.service.ts` +93~102 (`lookupIntegrations`)
- **상세**: `serviceType: [serviceType]` 로 단일 문자열을 배열로 감싸 쿼리에 전달합니다. 주석에 "IntegrationsService.findAll 은 `IN (:...serviceTypes)` 로 내부 처리"라고 명시되어 있으나, `ListIntegrationsQueryDto` 의 `serviceType` 필드가 실제로 `string[]` 타입을 허용하는지 Diff에서는 확인할 수 없습니다. 런타임 필터가 아닌 DTO 유효성 검사(class-validator)에서 거부될 가능성이 있습니다.
- **제안**: `ListIntegrationsQueryDto`의 `serviceType` 필드 선언을 확인하십시오. `string` 단일 타입이라면 `string[]`로 변경하거나, `CandidateLookupService`에서 단일 문자열로 전달하도록 조정하십시오.

---

### [INFO] 프론트엔드 `useEditorStore` 신규 직접 의존 — store 결합도 증가
- **위치**: `assistant-message.tsx` +9, +35~42
- **상세**: `AssistantMessageView`가 `useEditorStore` 를 직접 구독합니다. 기존에는 assistant 패널 컴포넌트가 editor store와 독립적이었으나, 이번 변경으로 `nodes` 상태와 `updateNodeConfigField` action에 직접 결합됩니다. 이는 의존성 사이클은 아니지만, 컴포넌트 재사용성과 테스트 격리성을 떨어뜨립니다.
- **제안**: 현재 스펙 범위(메시지 버블 내 picker)에서는 이 결합이 불가피하며 허용 수준입니다. 향후 assistant 패널을 다른 컨텍스트에서 재사용해야 한다면 `onConfirm` 을 `CandidatePickers`에 prop으로 주입하는 방향을 고려하십시오.

---

### [INFO] `ExploreToolsService.listWorkflows` 반환 타입이 `unknown` — 런타임 narrowing 필요
- **위치**: `candidate-lookup.service.ts` +152~170 (`lookupWorkflows`, `extractWorkflowItems`)
- **상세**: `ExploreToolsService`의 `listWorkflows`가 `unknown`을 반환하여 `extractWorkflowItems` 헬퍼로 런타임 타입 가드를 수행합니다. 의존성 문제라기보다는 서비스 간 계약이 약한 상태입니다.
- **제안**: 가능하다면 `ExploreToolsService.listWorkflows`의 반환 타입을 구체화하십시오. 현재 구현(명시적 narrowing)은 안전하게 처리되고 있어 즉각적 위험은 없습니다.

---

## 요약

이번 변경사항에서 새로운 외부 npm 패키지는 전혀 추가되지 않았으며, 프론트엔드와 백엔드 모두 기존 의존성만을 재활용합니다. 핵심 위험은 백엔드의 **모듈 간 의존성 확장**에 있습니다. `WorkflowAssistantModule`이 `IntegrationsModule`과 `KnowledgeBaseModule`을 새로 임포트하면서 순환 참조 위험이 생겼고, 두 모듈이 필요한 Provider를 `exports`하는지 Diff로는 확인이 불가능합니다. `LlmConfigService`의 약한 반환 타입과 `ListIntegrationsQueryDto.serviceType`의 배열 수용 여부도 런타임 오류의 잠재 원인입니다. 프론트엔드는 `useEditorStore` 직접 결합 정도가 유일한 설계상 고려사항이며, 현재 스펙 범위에서는 허용 가능한 수준입니다.

## 위험도

**LOW** — 외부 패키지 변경이 없고 대부분 내부 모듈 재조합이지만, `IntegrationsModule`/`KnowledgeBaseModule` 순환 참조 및 exports 미검증이 런타임 DI 오류로 이어질 수 있어 배포 전 명시적 검증이 필요합니다.