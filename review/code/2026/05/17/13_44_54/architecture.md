# 아키텍처(Architecture) 리뷰 결과

## 발견사항

- **[WARNING]** `needsAttention()` 함수가 `autoRefresh` 가드 없이 남아 있어 레이어 간 일관성 불일치
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `needsAttention()` 함수 (라인 2510–2512 전체 파일 컨텍스트 기준)
  - 상세: `computeStatus()`는 `expiresSoon && !integration.autoRefresh` 분기로 autoRefresh 통합을 warn 레이어에서 올바르게 제외한다. 그러나 `needsAttention()` / `computeAttentionBreakdown()`은 여전히 `isExpiringSoon(tokenExpiresAt)` 만으로 판단한다. 결과적으로 배지 렌더 레이어(status-badge)와 목록 집계 레이어(attention 배너·`?status=attention` 필터)가 서로 다른 술어를 사용하게 된다. PR 범위에서 제외한 사실이 커밋 메시지에 명시되어 있으나, 이 불일치는 아키텍처 상 두 책임이 동일한 파일에 공존하면서도 서로 다른 상태 관찰 로직을 갖는 설계 부채다. 향후 autoRefresh=true인 cafe24 통합이 목록 페이지에서 "expiring" 집계에 잘못 포함되는 거짓 양성이 유저에게 노출될 수 있다.
  - 제안: `needsAttention()`도 `isExpiringSoon(at) && !integration.autoRefresh`로 좁히거나, 단일 `computeAttentionPredicate(integration)` 추상화를 두어 `computeStatus()`와 `needsAttention()` 양쪽이 동일 술어를 공유하도록 리팩토링. 이 변경을 다음 PR에서 즉시 처리하지 않으면 `20260516-full-review` W-32 해소 시점에 충돌 가능성이 있음.

- **[WARNING]** `TooltipProvider`가 `InfoRow` 내부에 지역적으로 선언되어 레이아웃 레이어 응집도 저하
  - 위치: `frontend/src/app/(main)/integrations/[id]/page.tsx` — `InfoRow` 컴포넌트 (라인 1704–1715 전체 파일 컨텍스트 기준)
  - 상세: Radix `TooltipProvider`는 보통 앱 루트나 레이아웃 최상위에서 한 번 선언하는 패턴을 권장한다. `InfoRow` 마다 `<TooltipProvider delayDuration={150}>` 를 인스턴스화하면, 동일 페이지에서 여러 `InfoRow`가 tooltip을 갖게 될 경우 중첩 Provider 인스턴스가 누적된다. 현재는 단일 행(Token Expires)만 사용하여 실질적 문제는 없지만, `InfoRow`가 재사용 컴포넌트임을 고려하면 향후 tooltip이 붙는 행이 늘어날 때 렌더 비용 및 설계 의도(Provider는 공유 컨텍스트) 위반이 발생한다.
  - 제안: `TooltipProvider`를 `OverviewTab` 상단 또는 `IntegrationDetailPage` 레이아웃 레벨로 올리거나, 프로젝트 공통 레이아웃에 이미 존재한다면 `InfoRow` 내부의 Provider를 제거하고 `<Tooltip>/<TooltipTrigger>/<TooltipContent>`만 남긴다.

- **[WARNING]** `humanizeUntil` 함수가 프레젠테이션 파일(`status-badge.tsx`)에 위치하나 `page.tsx`에서도 직접 import
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `humanizeUntil` export; `page.tsx` import 구문
  - 상세: `humanizeUntil`은 날짜 포맷 유틸리티로 프레젠테이션 로직과 무관하다. 현재 `status-badge.tsx`에 정의되고 export되어 `page.tsx`가 `status-badge`에 대한 추가 의존성을 갖는다. 이는 `page.tsx`가 상태 표시 컴포넌트에 의존하게 만들어 레이어 경계를 흐린다. `formatDate` 등이 이미 `@/lib/utils/date`에 있는 패턴과 불일치한다.
  - 제안: `humanizeUntil`을 `@/lib/utils/date.ts` 또는 `@/lib/utils/humanize.ts`로 이동하고 `status-badge.tsx`와 `page.tsx` 양쪽에서 공통 유틸로 import. `status-badge.tsx`에서는 re-export 없이 직접 참조.

- **[INFO]** `ServiceDefinition.supportsTokenAutoRefresh`가 optional(?) 로 선언되어 falsy 기본값 처리가 암묵적
  - 위치: `backend/src/modules/integrations/services/service-registry.ts` — `ServiceDefinition` 인터페이스
  - 상세: `supportsTokenAutoRefresh?: boolean` 로 선언되어 미설정 시 `undefined`가 된다. 소비 측(`toPublic`)에서 `=== true` 비교로 undefined를 false로 처리하는 방어적 코드를 올바르게 작성했으나, `ServiceDefinition`을 구현하는 새 서비스 등록자가 해당 필드를 명시하지 않으면 조용히 false로 처리된다는 사실이 인터페이스 정의만으로는 전달되지 않는다.
  - 제안: 필드를 `supportsTokenAutoRefresh: boolean`(필수)로 만들고 모든 기존 서비스에 명시적 `false`를 추가하거나, JSDoc에 "omit = false" 계약을 명확히 기재. 신규 서비스 추가 시 체크리스트에 포함될 수 있도록 lint rule(`require-record-keys`) 적용을 검토.

- **[INFO]** `computeStatus` 내 `subLabel` 생성 로직이 `computeStatus` 함수와 동일 위치에 인라인
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `computeStatus` 함수 내 `subLabel` 계산 (라인 2617–2620)
  - 상세: 아직 `subLabel`을 생성하는 조건 분기가 단순하여 큰 문제는 아니나, 추후 `subLabel` 논리가 복잡해지면 `computeStatus`의 단일 책임(SRP)이 흐려진다. 현재는 "Connected" 케이스에서만 발생하여 함수 흐름 상 문제없지만, 여러 상태에 `subLabel`이 생기거나 i18n 포맷팅이 추가되면 별도 `buildSubLabel(integration)` 헬퍼로 추출하는 것이 바람직하다.
  - 제안: 당장 조치 불필요. 단, `subLabel` 조건 분기가 2개 이상이 되는 시점에 `buildSubLabel` 헬퍼로 추출을 권장.

- **[INFO]** `IntegrationDto` 프론트엔드 타입과 백엔드 `PublicIntegration` 타입이 수동 동기화 의존
  - 위치: `frontend/src/lib/api/integrations.ts` — `IntegrationDto` 인터페이스; `backend/src/modules/integrations/integrations.service.ts` — `PublicIntegration` 타입
  - 상세: `autoRefresh: boolean` 추가가 백엔드 DTO(`IntegrationDto` class), 서비스 타입(`PublicIntegration`), 프론트엔드 DTO(`IntegrationDto` interface) 세 곳에 수동으로 반영되었다. 이번 PR에서는 누락 없이 동기화되었으나, 구조적으로 OpenAPI 코드젠 또는 공유 타입 패키지 없이는 이 패턴이 지속적인 드리프트 위험을 내포한다.
  - 제안: 현재 모노레포 구조에서 `openapi-typescript` 기반 코드젠 파이프라인 도입을 중장기적으로 검토. 단기적으로는 백엔드 `PublicIntegration`을 변경할 때 프론트엔드 `IntegrationDto`를 체크리스트 항목으로 명시하는 컨벤션 문서화(`spec/conventions/` 또는 PR 템플릿).

---

## 요약

이번 PR의 전체 아키텍처 설계는 건전하다. `autoRefresh` 필드를 DB 컬럼이 아닌 service-registry 기반 derived 필드로 처리하여 데이터 모델을 오염시키지 않았고, 백엔드 `toPublic` 매핑에서 단일 계산 지점을 유지한 것은 Open-Closed 원칙에 부합한다. 레이어 책임 분리 측면에서 비즈니스 로직(service-registry lookup)은 백엔드 서비스에, 렌더 분기 로직(`computeStatus`)은 프론트엔드 상태 계층에 올바르게 위치하며, 프레젠테이션 컴포넌트(`StatusBadge`, `InfoRow`)는 view 데이터만 소비한다. 핵심 아키텍처 우려 사항은 `needsAttention()` 함수가 `computeStatus()`와 다른 술어를 사용하는 레이어 간 불일치로, 이는 커밋 메시지에서도 인식된 known-gap이나 목록 페이지 집계 오류로 이어질 수 있어 후속 PR에서 조속한 해소를 권고한다. `humanizeUntil`의 위치와 `TooltipProvider` 인스턴스화 방식도 레이어 경계 측면에서 소규모 개선 여지가 있다.

---

## 위험도

LOW
