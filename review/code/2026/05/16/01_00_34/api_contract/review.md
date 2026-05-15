### 발견사항

- **[WARNING]** `RequestScopesResult` 타입이 `OAuthBeginResult`와 `cafe24_private_pending` variant의 필드 집합이 동일하지 않음
  - 위치: `frontend/src/lib/api/integrations.ts` L801–L809
  - 상세: 신설된 `RequestScopesResult`의 `cafe24_private_pending` variant는 `scopesAdded: string[]` 필드를 포함하는 반면, 기존 `OAuthBeginResult`의 동일 variant에는 해당 필드가 없다. 두 타입이 동일한 백엔드 응답 스키마를 참조하면서 서로 다른 필드셋을 선언하게 되어, `OAuthBeginResult`를 사용하는 다른 소비자가 `scopesAdded`를 받아도 타입 시스템에서 인식하지 못한다. 타입 분기 시 `OAuthBeginResult`를 확장하거나 공유 base 타입을 두어 중복·불일치를 방지해야 한다.
  - 제안: `OAuthBeginResult`에도 `scopesAdded?: string[]`를 추가하거나, 두 타입을 하나로 통합(`RequestScopesResult = OAuthBeginResult`)하고 `scopesAdded`를 optional 필드로 선언. 또는 `cafe24_private_pending` variant를 공유 discriminated union 정의로 관리.

- **[WARNING]** `requestScopes` API 함수의 반환 타입 변경이 잠재적 breaking change
  - 위치: `frontend/src/lib/api/integrations.ts` L818–L825
  - 상세: `integrationsApi.requestScopes`의 반환 타입이 `Promise<OAuthBeginResult>`에서 `Promise<RequestScopesResult>`로 변경되었다. `RequestScopesResult`의 `cafe24_private_pending` variant는 `OAuthBeginResult`의 동일 variant 대비 `scopesAdded` 필드가 추가되어 있어, 이 함수를 직접 소비하는 다른 컴포넌트·훅이 있다면 기존 타입 추론이 깨질 수 있다. 변경 범위 내에서는 `ScopeTab`만 사용하지만 코드베이스 전역 검색이 필요하다.
  - 제안: `grep -r "requestScopes"` 등으로 다른 소비 지점 확인 후, 영향 범위를 명시적으로 문서화. 타입 호환성이 보장되지 않으면 `OAuthBeginResult`를 확장(`& { scopesAdded?: string[] }`)하는 형태로 후방 호환성을 유지.

- **[INFO]** `onSuccess` 핸들러에서 `cafe24_private_pending` 응답 시 `onChanged()` 가 호출됨
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` L615
  - 상세: `cafe24_private_pending` 모드는 실제로 권한이 아직 부여되지 않은 대기 상태이므로, `onChanged()`를 즉시 호출하면 상위 컴포넌트가 integration 데이터를 리페치하더라도 상태 변화가 없어 불필요한 API 호출이 발생한다. UX상 혼란을 줄 수도 있다.
  - 제안: `cafe24_private_pending` 분기에서는 `onChanged()` 호출을 생략하거나, 호출 의도(캐시 무효화 목적 등)를 주석으로 명시.

- **[INFO]** `RequestScopesResult`의 `cafe24_private_pending` variant에 `appUrl`·`callbackUrl` 필드가 포함되어 있으나 클라이언트에서 미사용
  - 위치: `frontend/src/lib/api/integrations.ts` L803–L808, `scope-tab.tsx` L611–L613
  - 상세: 타입 정의에는 `appUrl`과 `callbackUrl`이 있지만 `ScopeTab`의 `onSuccess` 핸들러는 `scopesAdded`만 사용한다. 불필요한 필드가 타입에 노출되어 소비자 혼란을 유발할 수 있다.
  - 제안: 사용하지 않는 필드는 타입에서 제거하거나, 향후 사용 계획이 있다면 주석으로 의도를 명시.

### 요약

이번 변경은 프론트엔드 UI 레이어에서 백엔드 `cafe24_private_pending` 응답을 올바르게 처리하기 위한 버그픽스이다. API 계약 관점에서 가장 주목할 점은 `integrationsApi.requestScopes`의 반환 타입이 `OAuthBeginResult`에서 `RequestScopesResult`로 교체된 것인데, 두 타입의 `cafe24_private_pending` variant가 `scopesAdded` 필드 유무에서 불일치하여 기존 `OAuthBeginResult` 소비자가 이 필드를 타입 안전하게 접근하지 못하는 문제가 발생한다. 또한 대기 상태임에도 `onChanged()`를 즉시 호출하는 부분은 API 응답의 의미(pending = 실제 변경 없음)와 클라이언트 동작 간의 계약 불일치로 볼 수 있다. 이상의 이슈들은 즉각적인 런타임 오류보다 타입 일관성 및 향후 유지보수 측면의 위험이며, 긴급 차단 수준은 아니다.

### 위험도

LOW
