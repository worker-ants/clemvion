# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[WARNING]** `StatusView` 인터페이스에 `subLabel?: string` 필드 추가 — 기존 소비자 영향
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `StatusView` 인터페이스 정의부 (diff 라인 +2427)
  - 상세: `StatusView` 는 `export interface` 로 공개된 타입이다. 이번 변경에서 `subLabel?: string` 이 추가되었다. optional 필드이므로 기존 타입을 구조적으로 충족하던 객체 리터럴은 TypeScript 단에서는 호환된다. 그러나 `computeStatus` 반환값을 직접 spread 하거나 destructure 해서 새 객체를 만들던 코드가 이 필드를 무시하면, `StatusBadge` 에서 기대하는 `subLabel` 렌더링이 조용히 누락된다. 현재 `StatusBadge` 자체가 `view.subLabel`을 렌더링하고 있으므로, `computeStatus` 를 호출하지 않고 `StatusView` 객체를 직접 조합하는 코드(예: 테스트 헬퍼, 스토리북, 다른 컴포넌트)는 `subLabel` 을 명시적으로 포함해야 의도된 UI가 나타난다.
  - 제안: `StatusView` 변경 시 모든 직접 생성 호출처를 검색해 `subLabel` 포함 여부를 확인한다. 테스트 `row()` 헬퍼는 이미 업데이트되었으나, 스토리북 fixture나 다른 도메인 통합 테스트가 있다면 점검 필요.

- **[WARNING]** `InfoRow` 컴포넌트 시그니처 변경 — `tooltip?: string` prop 추가
  - 위치: `frontend/src/app/(main)/integrations/[id]/page.tsx` — `InfoRow` 함수 정의 (diff 라인 +1676~+1689)
  - 상세: `InfoRow` 는 파일-내부 함수로 외부 export 는 없다. 그러나 동일 파일 내 여러 호출처가 존재하는 경우, `tooltip` 을 전달하지 않은 기존 호출처는 TypeScript 타입 에러 없이 계속 동작한다(optional 이므로). 부작용 관점에서 더 주의할 점은, `TooltipProvider` 를 `InfoRow` 내부에 매번 인스턴스화하는 구조다. Radix `TooltipProvider` 는 내부 상태(open/close 타이머, DelayGroup 컨텍스트)를 보유하며, 여러 `InfoRow` 가 동시에 렌더될 경우 각각 독립 `TooltipProvider` 를 가진다. 이는 Radix 권장 패턴(앱 루트에 단일 Provider)과 달라, 복수 tooltip이 동일 페이지에 있을 때 `delayDuration` 의 공유 없이 각각 독립 타이머가 작동한다. 현재는 단일 InfoRow 에만 tooltip이 사용되므로 기능적 문제는 없지만, 향후 여러 InfoRow 에 tooltip을 추가할 경우 delay 동작이 일관되지 않을 수 있다.
  - 제안: `TooltipProvider` 를 `InfoRow` 내부가 아닌 상위 컴포넌트(예: `OverviewTab` 또는 페이지 루트)에 한 번만 두고, `Tooltip`/`TooltipTrigger`/`TooltipContent` 만 `InfoRow` 내부에 두는 패턴 권장.

- **[WARNING]** `needsAttention()` 함수가 `autoRefresh` 를 고려하지 않아 목록 페이지 attention 집계와 상세 페이지 상태 표시 간 불일치 발생
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `needsAttention` 함수 (라인 2665~2668) 및 `computeStatus` 내 `expiresSoon` 분기 (라인 2607)
  - 상세: `computeStatus` 는 `expiresSoon && !integration.autoRefresh` 로 만료 임박 경고를 억제한다. 그러나 `needsAttention` 은 여전히 `return isExpiringSoon(integration.tokenExpiresAt)` 만 확인하며 `autoRefresh` 를 보지 않는다. 결과적으로 cafe24 통합(autoRefresh=true, tokenExpiresAt=2시간 후)은 상세 페이지에서 "Connected"로 표시되지만, 목록 페이지 Attention 배너의 `computeAttentionBreakdown` 을 통해 expiring 카운트에 포함된다. PR 범위 밖으로 명시적으로 기재되어 있으나, 현재 상태에서 두 계층 간 불일치가 사용자에게 혼란을 줄 수 있다 — 배너는 "주의 필요" 라고 하지만 상세 페이지는 "Connected + Auto-renews"다.
  - 제안: `needsAttention` 함수에 `autoRefresh` 가드를 추가하거나(`isExpiringSoon && !integration.autoRefresh`), 적어도 이 불일치를 코드 주석으로 명기하고 후속 PR에서 우선 처리되도록 plan 을 업데이트한다. (PR 커밋 메시지와 plan 문서에 이미 명기되어 있지만 코드 자체에 주석 없음.)

- **[INFO]** `PublicIntegration` 타입에 `autoRefresh: boolean` 추가 — 모든 `toPublic` 호출처에 필드 전파
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `PublicIntegration` 타입 정의 (diff 라인 +712) 및 `toPublic` 메서드 두 곳 (diff 라인 +732, +740)
  - 상세: `PublicIntegration` 은 내부 서비스 타입으로 외부 공개 API가 아니다. 그러나 `toPublic` 의 반환 타입이 확장되었으므로, 이 타입을 consuming 하는 다른 서비스·컨트롤러가 있다면 `autoRefresh` 필드가 이미 포함되어 있다. 현재 코드에서 `PublicIntegration` 을 직접 참조하는 곳을 별도 확인하지 않았으나, TypeScript 덕타이핑 특성상 기존 코드에 컴파일 오류가 발생하지는 않을 것이다(새 필드는 추가이므로). 단, `toPublic` 반환 결과를 특정 shape으로 spread 하거나 직렬화하는 코드가 있다면 `autoRefresh` 가 자동으로 직렬화 대상에 포함된다.
  - 제안: 현재 변경은 올바르게 설계되었다. 다만 `PublicIntegration` 을 사용하는 다른 모듈(예: 캐시 레이어, 이벤트 발행 등)이 있다면 `autoRefresh` 필드가 포함된 결과가 의도치 않게 외부로 노출되는지 확인 권장.

- **[INFO]** `SERVICE_REGISTRY` 배열에 `supportsTokenAutoRefresh` 추가 — 모듈 수준 공유 상태
  - 위치: `backend/src/modules/integrations/services/service-registry.ts` — `SERVICE_REGISTRY` 상수 (diff 라인 +848, +856)
  - 상세: `SERVICE_REGISTRY` 는 모듈 최상위 `export const` 배열로, 프로세스 수명 동안 변경되지 않는 설정 데이터다. `findService()` 가 이를 참조해 `autoRefresh` 를 계산하므로, 새 서비스가 추가될 때 `supportsTokenAutoRefresh` 를 명시하지 않으면 기본값 `undefined` → `false` 로 처리된다. 이는 설계상 안전하다(누락 = false = 보수적). 부작용 없음.
  - 제안: 향후 서비스 추가 시 `supportsTokenAutoRefresh` 명시 여부를 체크리스트 항목으로 추가할 것. (현재 JSDoc 설명에서 케이스별 근거가 잘 기술되어 있음.)

- **[INFO]** `humanizeUntil` 헬퍼 신규 export — `Date.now()` 에 암묵적 의존
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `humanizeUntil` 함수 (라인 2650~2663)
  - 상세: `humanizeUntil` 은 `Date.now()` 를 함수 내부에서 직접 호출한다. 이는 함수를 순수하지 않게 만들어 호출 시점에 따라 반환값이 달라진다. 단위 테스트에서 시간 고정이 필요하다면 `vi.useFakeTimers()` 나 유사한 메커니즘이 필요하다. 현재 테스트 파일에서 `inMinutes(90)` 으로 미래 시간 ISO 문자열을 생성하는 방식은 `Date.now()` 의존을 암묵적으로 우회하므로 실용적이지만, `humanizeUntil` 자체의 경계 케이스 테스트(정확히 1분, 60분, 24시간 경계)는 실시간 의존으로 인해 플래키(flaky) 해질 위험이 있다.
  - 제안: `humanizeUntil(at: string, now: number = Date.now()): string` 시그니처로 `now` 를 주입 가능하게 변경하면 테스트 용이성이 크게 향상된다.

## 요약

이번 변경은 전반적으로 부작용 관리가 잘 된 설계다. `autoRefresh` 는 DB 컬럼이 아닌 서비스 레지스트리 파생 필드로 상태 변경 없이 순수 매핑으로 도입되었고, `SERVICE_REGISTRY` 수정도 불변 설정 데이터 추가에 그친다. 가장 주목할 부작용은 `computeStatus` 와 `needsAttention` 사이의 논리 불일치로, 상세 페이지에서는 "Connected"를 표시하지만 목록 페이지 attention 집계에서는 여전히 만료 임박 통합을 카운트하는 관찰 가능한 불일치가 존재한다. 이는 PR 범위 밖으로 명시적으로 deferred 되었으나 현재 코드에 주석이 없어 후속 개발자가 놓칠 수 있다. `InfoRow` 내 `TooltipProvider` 인스턴스화 패턴은 Radix 권장 패턴과 다르며 확장 시 delay 동작 불일치로 이어질 수 있다. `humanizeUntil` 의 `Date.now()` 암묵적 의존은 테스트 신뢰성을 낮출 수 있다.

## 위험도

LOW
