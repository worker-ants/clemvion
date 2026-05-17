### 발견사항

- **[INFO]** `restricted-approval.ts` 신규 모듈이 단일 책임 원칙(SRP)을 잘 구현
  - 위치: `backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts`
  - 상세: `SCOPE_LEVEL_RESTRICTED_SCOPES`, `pickRestrictedApprovalScopes`, `extractCafe24ScopeTokens`, `RESTRICTED_APPROVAL` 상수가 하나의 모듈에 응집되어, 다른 metadata 파일들(`mileage.ts`, `notification.ts`, `privacy.ts`, `store.ts`)이 이 모듈만 import하여 마커를 참조한다. 중복 정의 없이 단일 진실 원처(SoT)가 코드 레벨에서 구현된 점이 양호하다.
  - 제안: 현행 유지.

- **[WARNING]** `extractCafe24ScopeTokens` 가 Infrastructure 레이어에 위치하지 않고 `metadata/` 하위에 혼재
  - 위치: `backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts` (L943–L971), `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` (import 측)
  - 상세: `extractCafe24ScopeTokens` 는 Cafe24 API 의 에러 응답 본문(`errBody`)을 파싱하는 Infrastructure 관심사(raw HTTP response parsing)임에도 `metadata/` 서브패키지 안에 위치한다. `metadata/` 는 API 연산 서술 메타데이터를 담는 모듈로 의도된 것으로 보이며, HTTP body 파싱 로직이 여기에 공존하면 레이어 책임 분리가 흐려진다. `cafe24-api.client.ts` 가 `metadata/restricted-approval.js` 를 import 하는 방향은 node 구현체 → metadata 로 자연스러우나, metadata 내부에 runtime 파싱 함수가 포함되는 것은 메타데이터 모듈의 정적(static) 성격을 위반한다.
  - 제안: `extractCafe24ScopeTokens` 를 `cafe24-api.client.ts` 와 같은 레이어(예: `cafe24/` 루트 또는 `cafe24/utils/`) 로 분리하고, `metadata/restricted-approval.ts` 는 `RESTRICTED_APPROVAL`, `SCOPE_LEVEL_RESTRICTED_SCOPES`, `pickRestrictedApprovalScopes` (순수 필터 함수) 만 담게 한다.

- **[WARNING]** `ScopeOption.requiresApproval` 필드가 Backend(`service-registry.ts`)와 Frontend(`integrations.ts`, API DTO) 에 각각 독립 선언되어 타입 동기화 부담 발생
  - 위치: `backend/src/modules/integrations/services/service-registry.ts` (L137), `frontend/src/lib/api/integrations.ts` (L466)
  - 상세: `ScopeOption` 인터페이스가 backend와 frontend에 별도로 정의되어 있고 `requiresApproval?: boolean` 필드도 각자 추가되었다. `Cafe24RestrictedApproval` 구조체 역시 `backend/metadata/types.ts` 와 `frontend/lib/node-definitions/types.ts` 에 동일 형태로 이중 선언된다. 현재는 단순 `boolean` / 단순 구조체이므로 drift 위험이 낮지만, 향후 필드가 추가될 때 양쪽을 동시에 수정하지 않으면 런타임 불일치가 생길 수 있다. 이 패턴은 `Cafe24ApprovalGroup` union 타입도 동일하게 이중 선언되어 있어 총 3개의 타입이 동일 내용을 복제한다.
  - 제안: 공유 타입 패키지(예: `packages/shared-types`) 또는 OpenAPI code-gen 을 통해 단일 진실을 확보하거나, 최소한 spec 문서에 "이 타입은 backend와 frontend 양쪽에 선언된다" 는 동기화 경고를 남기고 catalog-sync 테스트처럼 양방향 검증 테스트를 추가한다.

- **[INFO]** `markIntegrationCallbackError` 의 `extra` 파라미터가 약하게 타입화됨
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` (L788–L800)
  - 상세: `extra?: { requiresCafe24Approval?: string[] }` 는 올바른 방향이나, 이 구조는 Cafe24 전용 콘텍스트다. 메서드 자체는 일반 통합(non-Cafe24)에서도 호출되는 공통 서비스임에도 Cafe24 특화 필드명이 인터페이스에 노출된다. SRP 관점에서 서비스가 특정 공급자(provider)의 세부 사항을 알 필요가 없다.
  - 제안: `extra?: { details?: Record<string, unknown> }` 로 일반화하거나, Cafe24 전용 에러 기록 경로를 별도 오버로드/서브클래스로 분리하여 공통 서비스의 인터페이스를 중립적으로 유지한다.

- **[INFO]** `integration-configs.tsx` 에서 `restrictedApproval` 존재 여부만 확인하고 세부 정보(`level`, `approvalGroup`, `inquiryUrl`)를 활용하지 않아 미래 확장성 제한
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` (L320–L334)
  - 상세: 선택된 Operation 의 승인 마커를 단순 `p` 태그로 하드코딩된 tooltip 텍스트와 함께 렌더링한다. `RestrictedScopeNotice` 컴포넌트나 `ApprovalRequiredBadge` 를 재사용하지 않으며, `inquiryUrl` 링크도 제공하지 않는다. `scope-tab.tsx` / `new/page.tsx` 와의 UI 일관성이 부족하다.
  - 제안: `integration-configs.tsx` 도 `ApprovalRequiredBadge` / `RestrictedScopeNotice` 를 사용해 공통 컴포넌트를 통일 적용한다. `inquiryUrl` 은 `restrictedApproval.inquiryUrl` 에서 읽어 링크를 생성한다.

- **[INFO]** `scope-tab.tsx` 에서 `lastError.details` 를 직접 타입 단언(type assertion)으로 접근
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` (L181–L183)
  - 상세: `(integration.lastError?.details as | { requiresCafe24Approval?: string[] } | undefined)?.requiresCafe24Approval` 는 `IntegrationDto.lastError.details` 가 `Record<string, unknown>` 로 정의되어 있기 때문에 발생하는 타입 단언이다. 이 패턴은 필드 이름 오타나 shape 변경에 취약하다.
  - 제안: `IntegrationDto.lastError.details` 를 discriminated union 또는 더 구체적인 타입으로 강화하거나, 파싱 유틸 함수(`parseCafe24ErrorDetails(lastError)`)를 분리해 검증 로직을 한 곳에 집중시킨다.

- **[INFO]** `RestrictedScopeNotice` 의 `inquiryUrl` 기본값이 컴포넌트 파일 내부에 하드코딩
  - 위치: `frontend/src/components/integrations/approval-required-badge.tsx` (L1389)
  - 상세: `inquiryUrl = "https://developers.cafe24.com"` 이 컴포넌트 기본 인자로 박혀 있어, `restricted-approval.ts` 의 `INQUIRY_URL` 상수와 분리된 두 번째 진실이 생긴다. 현재는 동일한 값이지만 나중에 URL 이 변경될 경우 두 곳을 고쳐야 한다.
  - 제안: frontend 에 `CAFE24_INQUIRY_URL` 상수를 정의해 `approval-required-badge.tsx` 의 기본값과 호출 측 양쪽에서 참조하도록 한다.

- **[INFO]** `catalog-sync.spec.ts` 의 열 파싱 로직(`parseHeaderCells`, `buildColumnIndex`, `cellOr`)이 테스트 파일 내부에 인라인 구현
  - 위치: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` (L323–L346)
  - 상세: 헤더 동적 파싱 유틸은 테스트 전용이므로 테스트 파일 내부 구현이 허용되는 패턴이나, 향후 다른 catalog 관련 테스트가 생길 경우 중복이 발생할 수 있다. 현재 범위에서는 문제없음.
  - 제안: 향후 catalog 관련 테스트가 추가될 경우 `catalog-parse-utils.ts` 로 분리를 고려한다.

---

### 요약

이번 변경은 Cafe24 파트너 승인 필요 스코프/오퍼레이션을 시스템 전반에 일관되게 표현하기 위한 기능 추가로, 전체적인 아키텍처 방향성은 양호하다. `restricted-approval.ts` 를 단일 진실 모듈로 신설하고, 메타데이터 파일들이 이를 공통 참조하는 구조는 Open/Closed 원칙과 DRY 를 잘 준수한다. 한편, `extractCafe24ScopeTokens` 라는 Infrastructure 레이어 관심사가 `metadata/` 서브모듈에 혼재하는 점, `ScopeOption`·`Cafe24RestrictedApproval`·`Cafe24ApprovalGroup` 등 핵심 타입이 backend-frontend 간 이중 선언되는 점은 장기적 유지보수 부담을 낳는다. `markIntegrationCallbackError` 의 `extra` 파라미터에 Cafe24 전용 필드명이 노출되는 것도 공통 서비스의 중립성을 약간 손상시킨다. 각 surface(scope-tab, new/page, integration-configs)에서 badge 컴포넌트 재사용 일관성이 일부 부족하고, `lastError.details` 의 타입 단언 패턴도 개선 여지가 있다. 전반적으로 기능 범위 대비 구조가 잘 설계되었으며, 지적된 사항들은 대부분 INFO 수준의 개선 여지로, 현재 구현을 크게 위협하는 설계 결함은 없다.

### 위험도

LOW
