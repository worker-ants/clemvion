# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[WARNING]** `markIntegrationCallbackError` 함수 시그니처 변경 — 기존 호출자 영향
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` L788–793
  - 상세: `extra?: { requiresCafe24Approval?: string[] }` 옵셔널 파라미터가 추가됨. 파라미터 자체는 옵셔널이므로 기존 호출자에 컴파일 오류는 없으나, 이 메서드를 직접 호출하는 테스트나 내부 코드가 `extra` 없이 호출할 경우 `details` 필드가 생략된다는 사실을 인지하지 못한 채 통과될 수 있다. 함수 시그니처 변경은 명시적으로 모든 호출 지점을 감사해야 한다.
  - 제안: 이 함수를 호출하는 모든 지점(특히 OAuth invalid_scope 콜백 분기 — `plan/in-progress/cafe24-oauth-invalid-scope-handler.md` 에 follow-up 으로 분리됨)이 `extra` 를 전달해야 할 케이스에서 빠뜨리지 않도록 JSDoc 또는 unit test 로 명시하거나, 향후 `OAUTH_INVALID_SCOPE` 분기 구현 시 파라미터 전달 여부 검증을 포함할 것.

- **[WARNING]** `markAuthFailed` 함수 시그니처 변경 — 기존 호출 지점 전파 누락 위험
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` L803–806, L1075
  - 상세: `errBody?: unknown` 파라미터가 추가되어 호출 지점(L1075)에서 `errBody` 를 전달하도록 변경됨. 파라미터가 옵셔널이므로 다른 호출 지점이 있다면 컴파일 오류 없이 `requiresApproval` 를 계산하지 못한 채 `undefined` 로 넘어간다. 현재 단일 호출 지점처럼 보이나, 미래 코드 변경 시 새 호출 지점에서 `errBody` 를 빠뜨리면 부작용적으로 `requiresCafe24Approval` 정보가 누락된다.
  - 제안: `errBody` 전달이 `insufficient_scope` 시 필수임을 JSDoc 에 강조하거나, `reason` 과 `errBody` 를 하나의 옵션 객체로 묶어 의도적 생략과 실수 누락을 구분할 수 있게 개선 검토.

- **[WARNING]** `lastError.details` 필드 — `IntegrationDto` 공개 API 형태 변경
  - 위치: `frontend/src/lib/api/integrations.ts` L50–53
  - 상세: `IntegrationDto.lastError` 의 타입에 `details?: Record<string, unknown>` 필드가 추가됨. 이는 백엔드 응답 스키마의 확장이다. 기존 클라이언트가 `lastError` 를 역직렬화해서 쓰던 경우 `details` 를 모르지만, 추가 필드는 하위호환이므로 파괴적이지 않다. 그러나 `scope-tab.tsx` 에서 `(integration.lastError?.details as { requiresCafe24Approval?: string[] } | undefined)?.requiresCafe24Approval` 처럼 `unknown` 에서 직접 타입 단언을 사용 중인 점은 런타임 타입 안전성 우려가 있다.
  - 제안: `details` 타입을 `Record<string, unknown>` 이 아닌 구체적 union 또는 zod 스키마로 좁히거나, `scope-tab.tsx` 의 타입 단언 부분에 런타임 가드(Array.isArray 등)를 추가해 방어적으로 처리할 것.

- **[WARNING]** `SCOPE_LEVEL_RESTRICTED_SCOPES` 전역 `ReadonlySet` 도입 — 이중 관리 위험
  - 위치: `backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts` L908–915
  - 상세: `SCOPE_LEVEL_RESTRICTED_SCOPES` Set 과 `RESTRICTED_APPROVAL` 객체의 scope 그룹이 별도로 선언되어 있어 두 목록이 서로 독립적으로 유지된다. `RESTRICTED_APPROVAL.mileage` 에는 `level: 'scope'` 로 mileage 가 scope-level 임이 명시되어 있지만, `SCOPE_LEVEL_RESTRICTED_SCOPES` 에도 `mall.read_mileage`, `mall.write_mileage` 를 명시적으로 열거해야 한다. 이 두 목록이 서로 독립적으로 유지되어야 한다는 점을 주석이 경고하지만 (`Mirrors spec/conventions/cafe24-restricted-scopes.md §1 — keep these two lists in sync when the spec changes.`), 자동 동기 보장이 없다.
  - 제안: `RESTRICTED_APPROVAL` 항목에서 `level === 'scope'` 인 것만 필터링해 `SCOPE_LEVEL_RESTRICTED_SCOPES` 를 파생적으로 구성하거나, 별도 테스트에서 두 목록의 일관성을 검증하는 케이스를 추가할 것.

- **[INFO]** `extractCafe24ScopeTokens` 함수 — 2단계 깊이 이상의 중첩 객체는 토큰 추출 불가
  - 위치: `backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts` L943–971
  - 상세: 에러 body 에서 scope 토큰을 추출할 때 최대 2-depth 까지만 탐색한다 (`body` → `value` → `inner`). Cafe24 에러 응답 구조가 변경되어 더 깊은 중첩이 발생하면 토큰을 감지하지 못해 `requiresCafe24Approval` 가 누락된다. 이는 명시적 부작용은 아니지만, 탐지 범위가 암묵적으로 고정되어 있다.
  - 제안: 주석에 2-depth 탐색 의도를 명시하거나, 더 범용적이 필요할 경우 재귀 탐색 또는 JSON.stringify + 정규식 방식으로 전환 검토.

- **[INFO]** `parseCatalogFile` 함수 — 테이블 경계 시 `columnIndex` 상태 초기화
  - 위치: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` L353–360
  - 상세: 테이블 블록이 종료될 때(`!line.trim().startsWith('|')`) `columnIndex = {}` 로 초기화된다. 이 부분은 새로 추가된 코드로, 하나의 파일 내 여러 테이블이 존재하는 경우 앞 테이블의 컬럼 인덱스가 다음 테이블로 오염되지 않도록 한다. 로직 자체는 올바르나, 동일 흐름에서 `headerSeen = false` 와 `columnIndex = {}` 를 분산시켜 리셋하므로 향후 유지보수 시 한 곳만 수정하는 실수가 발생할 수 있다.
  - 제안: 테이블 상태 리셋 로직을 하나의 헬퍼로 묶거나 주석으로 묶음 처리를 명시.

- **[INFO]** `PublicCafe24OperationSupported.restrictedApproval` — 공개 API 응답 필드 추가
  - 위치: `backend/src/nodes/integration/cafe24/metadata/public-meta.ts` L48–55, L107–114
  - 상세: `toPublicSupportedOperation` 이 `op.restrictedApproval` 가 있을 때만 조건부로 `restrictedApproval` 를 응답에 포함시킨다. 스프레드(`...(op.restrictedApproval ? { restrictedApproval: op.restrictedApproval } : {})`) 패턴은 올바르나, 응답 직렬화 단계에서 `Cafe24RestrictedApproval` 의 `inquiryUrl`, `docsUrl` 같은 URL 필드가 외부에 그대로 노출된다. 이 URL 들은 현재 하드코딩된 상수(`INQUIRY_URL`, `SCOPE_GUIDE_URL`)이므로 큰 문제는 아니나 공개 API 응답에 포함된다는 사실을 문서화할 것.
  - 제안: 공개 API 문서(Swagger/OpenAPI)에 `restrictedApproval` 필드를 포함시켜 의도된 변경임을 명시.

- **[INFO]** `RESTRICTED_APPROVAL` 객체 — `as const` 단언
  - 위치: `backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts` L973–1019
  - 상세: `RESTRICTED_APPROVAL` 객체는 `Record<string, Cafe24RestrictedApproval>` 로 타입 선언된 뒤 `as const` 를 붙였다. 그러나 `Record<string, ...>` 으로 widening 한 뒤 `as const` 를 선언하면 `as const` 의 리터럴 좁히기 효과가 없다. `RESTRICTED_APPROVAL.mileage` 에 접근 시 실제로는 `Cafe24RestrictedApproval` 타입이 반환되어 리터럴 타입 추론이 이루어지지 않는다. 이는 타입 안전성의 부작용이 아니라 타입 정확도 문제이므로 `as const satisfies Record<string, Cafe24RestrictedApproval>` 패턴을 고려.
  - 제안: `as const` + `satisfies Record<string, Cafe24RestrictedApproval>` 로 변경하면 각 항목의 리터럴 타입이 보존되고 타입 제약도 유지됨.

---

## 요약

이번 변경은 Cafe24 별도 승인 스코프/오퍼레이션 메타데이터를 백엔드에서 프론트엔드까지 전파하는 수직 슬라이스(vertical slice) 구현이다. 전역 변수 수정, 파일시스템 부작용, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다. 주요 부작용 위험은 두 함수(`markIntegrationCallbackError`, `markAuthFailed`)의 시그니처에 옵셔널 파라미터가 추가되면서 기존 호출자가 컴파일 오류 없이 누락된 채 통과될 수 있는 점, `lastError.details` 를 `unknown` 에서 직접 타입 단언하는 점, 그리고 `SCOPE_LEVEL_RESTRICTED_SCOPES` Set 이 `RESTRICTED_APPROVAL` 와 수동으로 동기화되어야 한다는 이중 관리 구조에 집중된다. 이 중 어느 것도 즉각적 장애를 유발하지는 않지만, 향후 follow-up 작업(oauth_invalid_scope 콜백 분기)이 진행될 때 `extra` 파라미터 전달을 빠뜨릴 경우 운영에서 `requiresCafe24Approval` 정보가 누락될 수 있어 주의가 필요하다.

## 위험도

LOW
