# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** 단일 책임 원칙 — `AttentionBanner` 컴포넌트의 적절한 분리
  - 위치: `frontend/src/app/(main)/integrations/page.tsx` +569~+636
  - 상세: 배너 렌더링 책임을 `IntegrationsPage` 본체에서 `AttentionBanner` 함수 컴포넌트로 분리했다. 클릭 핸들러(`onActivate`)를 props로 주입받아 URL 조작 로직은 부모에 남기고, 배너 컴포넌트는 표시 전용 책임만 갖는다. SRP를 잘 준수한 분리다.

- **[INFO]** 단일 진실 원칙 — `needsAttention()`을 `computeAttentionBreakdown()` 내부에서 재사용
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` +453
  - 상세: `computeAttentionBreakdown`이 개별 항목 판별을 직접 재구현하지 않고 `needsAttention()`에 위임한다. 예산 규칙 변경 시 한 곳만 수정하면 되는 구조로, 공통 판별 로직의 단일 진실이 유지된다.

- **[INFO]** 레이어 책임 분리 — 가상 필터값의 변환 책임이 백엔드 서비스 레이어에 집중
  - 위치: `backend/src/modules/integrations/integrations.service.ts` +138~+150
  - 상세: `attention` 가상 필터값의 SQL 변환이 컨트롤러나 DTO 레이어가 아닌 서비스 레이어(`IntegrationsService.findAll`)에서 일어난다. 프레젠테이션(DTO 유효성 검사) → 비즈니스(서비스 변환) → 데이터(쿼리 빌더) 의 흐름이 명확히 지켜지고 있다.

- **[INFO]** 추상화 수준 — `AttentionBreakdown` 인터페이스의 명시적 계약
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` +424~+437
  - 상세: `mostUrgentId`의 의미를 JSDoc에서 명확히 설명하고(`total === 1`일 때만 의미 있음, 다수일 때의 동작 등) 호출자가 잘못 사용할 여지를 문서로 차단했다. 과도하지 않은 적절한 추상화 수준이다.

- **[WARNING]** `AttentionBanner`의 모듈 경계 — `page.tsx` 내부 private 함수로 정의
  - 위치: `frontend/src/app/(main)/integrations/page.tsx` +569~+636
  - 상세: `AttentionBanner`는 명확한 props 계약(`breakdown`, `onActivate`)을 갖는 독립 컴포넌트임에도 `page.tsx` 파일 내 모듈-private 함수로 정의되어 있다. 이 컴포넌트가 다른 페이지나 레이아웃에서 재사용될 필요가 생길 경우(예: 대시보드 위젯, 다른 목록 페이지의 유사 배너), `_shared/` 폴더로 이동하는 리팩토링 비용이 발생한다. 현재 사용처가 한 곳이므로 즉각적인 문제는 아니지만, 동일 폴더 내 `_shared/status-badge.tsx`에 이미 attention 관련 로직이 집적되어 있어 경계가 다소 분산된다.
  - 제안: 단기적으로는 현 위치를 유지하되, `AttentionBanner`가 두 번째 사용처를 얻는 시점에 `_shared/attention-banner.tsx`로 추출하는 것을 권장한다.

- **[WARNING]** 7일 만료 임박 임계값(7 days) 의 중복 정의
  - 위치: `backend/src/modules/integrations/integrations.service.ts` +148, `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` (기존 `needsAttention` 구현)
  - 상세: `attention` 가상 필터의 "연결된 상태 + 7일 이내 만료"라는 임계값이 백엔드 SQL(`INTERVAL '7 days'`)과 프론트엔드 `needsAttention()` 판별 로직에 각각 정의되어 있다. 현재 변경에서 양쪽을 동시에 수정했으므로 일치하지만, 향후 임계값 변경 시 두 곳을 동시에 수정해야 한다는 숨은 결합이 존재한다. 이는 아키텍처적으로 프론트엔드와 백엔드가 동일 도메인 규칙을 각자 인코딩하는 전형적인 중복이다.
  - 제안: 임계값을 상수(`EXPIRING_THRESHOLD_DAYS = 7`)로 명명하고, 백엔드 서비스와 프론트엔드 유틸 각각에서 해당 상수를 참조하도록 한다. 전체 구조상 단일 상수 파일로 공유하기는 어려우므로 최소한 각 레이어에서 매직 넘버가 아닌 명명된 상수로 관리하는 것이 적절하다.

- **[INFO]** 개방-폐쇄 원칙 — 기존 status 분기 확장 방식
  - 위치: `backend/src/modules/integrations/integrations.service.ts` +138~+150
  - 상세: `status` 처리가 `if/else if` 체인으로 구성되어 있다. 현재 규모(5개 케이스)에서는 적절하나, status 종류가 계속 증가할 경우 전략 패턴(Strategy) 또는 맵 기반 핸들러로 리팩토링하는 시점을 고려할 필요가 있다. 이번 변경 자체는 기존 분기에 하나의 `else if`를 추가한 것으로 기존 케이스에 영향을 주지 않아 안전하다.

- **[INFO]** DTO 계층의 명확한 문서화 — 가상 필터값 표기
  - 위치: `backend/src/modules/integrations/dto/integration.dto.ts` +35~+47
  - 상세: `INTEGRATION_STATUSES` 배열 상단의 블록 주석이 "어떤 값이 DB enum에 없는 가상 필터값인지", "서버에서 어떻게 변환되는지"를 spec 참조와 함께 명시한다. API 계약의 불투명성(virtual value가 DB 컬럼과 다름)을 레이어 경계에서 명확히 문서화한 좋은 사례다.

- **[INFO]** 프론트엔드 타입 계층 — `IntegrationStatus` vs `ListStatusFilter` 분리
  - 위치: `frontend/src/lib/api/integrations.ts` +2~+10
  - 상세: DB 실제 상태를 나타내는 `IntegrationStatus`와 API 쿼리 필터를 나타내는 `ListStatusFilter`가 별도 타입으로 분리되어 있다. `attention`/`expiring` 같은 가상 필터값이 `ListStatusFilter`에만 추가되어 `IntegrationStatus`를 오염시키지 않는다. 인터페이스 분리 원칙(ISP)을 잘 따른 설계다.

## 요약

이번 변경은 "주의 필요(attention)" 가상 필터값을 백엔드-프론트엔드 전체 스택에 일관되게 추가하는 작업으로, 아키텍처 관점에서 전반적으로 건전한 설계를 따르고 있다. DB enum에 없는 가상 필터값을 서비스 레이어에서 SQL 합집합으로 변환하는 책임 분리, `needsAttention()` 재사용을 통한 단일 진실 유지, `IntegrationStatus`와 `ListStatusFilter` 타입 분리를 통한 ISP 준수 등이 긍정적이다. 주요 개선 여지는 두 가지다: 7일 만료 임계값이 백엔드와 프론트엔드에 각각 하드코딩되어 향후 변경 시 두 곳을 동시에 수정해야 하는 숨은 결합이 존재하며, `AttentionBanner` 컴포넌트가 `page.tsx` 내부에 정의되어 있어 재사용 시 추출 비용이 발생할 수 있다. 두 사항 모두 현재 기능 범위에서는 즉각적 위험이 아니며, 이번 변경의 전체적인 아키텍처 위험도는 낮다.

## 위험도

LOW
