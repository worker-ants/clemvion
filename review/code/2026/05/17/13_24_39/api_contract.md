# API 계약(API Contract) 리뷰

### 발견사항

- **[WARNING]** `IntegrationDto.lastError.details` 필드 — 프론트엔드 타입이 `Record<string, unknown>`으로만 선언되어 있어 실제 페이로드 구조(`requiresCafe24Approval: string[]`)와 불일치
  - 위치: `frontend/src/lib/api/integrations.ts` 파일 17 / `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` 라인 ~183
  - 상세: 백엔드가 `lastError.details.requiresCafe24Approval: string[]`를 내려보내지만, `IntegrationDto`의 `details` 타입은 `Record<string, unknown>`으로만 선언되어 있다. `scope-tab.tsx`에서는 `as { requiresCafe24Approval?: string[] } | undefined` 타입 단언으로 접근하고 있어, 런타임에 백엔드 응답 구조가 바뀌더라도 컴파일 타임에 검출되지 않는다. `lastError` 자체도 `| Record<string, unknown>` 유니온이 병렬로 존재하여 타입 가드 없이 사용 시 불안정.
  - 제안: `IntegrationDto.lastError`의 `details` 필드를 `{ requiresCafe24Approval?: string[] } & Record<string, unknown>` 또는 별도 명명 인터페이스(`IntegrationLastErrorDetails`)로 구체화하고, `scope-tab.tsx`의 타입 단언을 제거하거나 타입 가드 함수로 대체한다.

- **[WARNING]** `lastError` shape 확장에 따른 하위 호환성 — 기존 `{ code, message, at }` 클라이언트에 `details` 추가 영향 미미하지만, 응답 스키마 문서 부재
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` (파일 1), `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` (파일 4)
  - 상세: `lastError`에 `details` 키를 선택적으로 추가하는 방식은 additive 변경이므로 기존 클라이언트 파괴(breaking)는 아니다. 그러나 두 곳(`markIntegrationCallbackError`, `markAuthFailed`)에서 `details`를 각각 구성하는 패턴이 분산되어 있고, 어느 `statusReason`에서 `details`가 채워지는지 OpenAPI/Swagger 스키마에 기록된 증거가 없다. 향후 다른 statusReason이 details를 활용할 경우 클라이언트에게 공식 문서 없이 내부 규약만 참조하게 된다.
  - 제안: 백엔드 DTO 또는 Swagger 데코레이터에 `details` 필드를 명시하고, `requiresCafe24Approval`이 어느 조건에서 채워지는지 주석 또는 스키마로 문서화한다.

- **[WARNING]** 새로운 `statusReason` 값 `oauth_invalid_scope` 추가 — 기존 클라이언트가 이 값을 처리하지 못할 수 있음
  - 위치: `backend/src/modules/integrations/integration-status-reason.ts` (파일 2)
  - 상세: `INTEGRATION_STATUS_REASONS` union에 `oauth_invalid_scope`를 추가하고 있다. 프론트엔드가 `statusReason` 값을 switch/if 분기로 처리하는 경우, 새 값을 모르는 클라이언트 버전은 이 값을 `unknown_error` fallback처럼 처리하거나 UI에 미처리 상태로 노출될 수 있다. 현재 변경 범위에 프론트엔드 `statusReason` 분기 코드가 포함되지 않아 대응 여부를 직접 확인할 수 없다.
  - 제안: 프론트엔드에서 `statusReason === 'oauth_invalid_scope'`를 처리하는 UI 분기(에러 메시지, 안내 등)가 추가되었는지 확인하고, 없다면 추가하거나 기존 `unknown_error` 분기가 이 값을 적절히 커버하는지 보장한다.

- **[INFO]** `PublicCafe24OperationSupported.restrictedApproval` — 응답 스키마에 선택적 필드 추가 (additive, non-breaking)
  - 위치: `backend/src/nodes/integration/cafe24/metadata/public-meta.ts` (파일 9), `frontend/src/lib/node-definitions/types.ts` (파일 22)
  - 상세: API 응답 타입 `PublicCafe24OperationSupported`에 선택적 필드 `restrictedApproval?`을 추가한다. Optional 추가이므로 기존 클라이언트 호환성은 유지된다. 백엔드-프론트엔드 간 `Cafe24RestrictedApproval` 타입이 각각 별도로 정의되어 있는데(`backend/metadata/types.ts` vs `frontend/lib/node-definitions/types.ts`), 구조가 동일하므로 현재는 문제없으나 향후 변경 시 양쪽을 동시에 갱신해야 하는 이중 관리 부담이 있다.
  - 제안: 공유 타입 패키지가 없다면 타입 동기화 테스트(`catalog-sync.spec.ts` 방식 참고)를 유지하거나, 장기적으로는 백엔드 응답 DTO → 프론트엔드 타입 자동 생성 파이프라인(codegen)을 검토한다.

- **[INFO]** `ScopeOption.requiresApproval` 필드 — 백엔드와 프론트엔드 DTO 양쪽에 선택적 필드로 추가, additive 변경
  - 위치: `backend/src/modules/integrations/services/service-registry.ts` (파일 3), `frontend/src/lib/api/integrations.ts` (파일 17)
  - 상세: 기존 `ScopeOption`에 `requiresApproval?: boolean`을 선택적으로 추가하는 non-breaking 변경이다. 해당 필드가 없는 기존 클라이언트는 `undefined`로 취급되어 영향 없다.
  - 제안: 특이사항 없음. 구조 자체는 안전.

- **[INFO]** `extractCafe24ScopeTokens` — 외부(Cafe24) 에러 바디 파싱 로직의 스키마 의존
  - 위치: `backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts` (파일 10)
  - 상세: 정규식 `TOKEN_RE = /mall\.(?:read|write)_[a-z_]+/g` 를 사용해 Cafe24 에러 응답 본문에서 scope 토큰을 추출한다. Cafe24 에러 응답 바디 구조가 변경되거나 scope 토큰 패턴이 달라질 경우(예: 대소문자 혼용, 숫자 포함) 조용히 빈 배열을 반환하여 `requiresCafe24Approval`이 누락될 수 있다. 에러 파싱 실패 시 별도 로그나 경고가 없다.
  - 제안: 토큰 추출 실패(빈 결과) 시 디버그 로그를 남기거나, Cafe24 에러 응답 구조의 변경을 감지할 수 있는 통합 테스트를 보완한다.

### 요약

이번 변경은 Cafe24 제한 스코프(partner-approval required scopes)를 API 계약 레벨에서 표현하기 위해 `lastError.details`, `ScopeOption.requiresApproval`, `PublicCafe24OperationSupported.restrictedApproval`, `statusReason`의 `oauth_invalid_scope` 값 등 여러 곳에 선택적 필드를 additive 방식으로 추가한다. 기존 클라이언트에 대한 breaking change는 없으나, 두 가지 중간 수준의 문제가 있다. 첫째, 프론트엔드의 `lastError.details` 타입이 `Record<string, unknown>`으로 너무 느슨하게 정의되어 있고 `scope-tab.tsx`에서 타입 단언으로 우회하고 있어 향후 구조 변경 시 런타임 오류 위험이 있다. 둘째, 신규 `statusReason` 값 `oauth_invalid_scope`에 대한 프론트엔드 UI 분기 처리가 이번 변경 범위에 포함되지 않아 미처리 케이스로 남을 가능성이 있다. 나머지는 정보성 사항으로, 백엔드-프론트엔드 타입 이중 관리와 외부 파서의 무음 실패 위험이 장기적으로 주의가 필요하다.

### 위험도

MEDIUM
