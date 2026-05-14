### 발견사항

- **[WARNING]** `buildIntegrationMeta`의 OCP 위반
  - 위치: `integrations.service.ts` `buildIntegrationMeta`
  - 상세: `if (entity.serviceType === 'cafe24')` 분기가 제네릭 서비스 메서드에 하드코딩되어 있음. 다른 provider가 meta를 필요로 하면 이 메서드를 직접 수정해야 함.
  - 제안: `Map<serviceType, (entity) => IntegrationMeta>` 형태의 레지스트리 또는 전략 패턴으로 분리. 지금은 Cafe24 단독이라 긴급하지 않으나, 두 번째 provider 추가 전 리팩터링 권고.

- **[WARNING]** 비즈니스 로직이 UI 컴포넌트 파일에 위치
  - 위치: `status-badge.tsx:isReauthorizeDisabled`
  - 상세: 버튼 활성화 gating 규칙(인가 도메인 로직)이 "badge" 표시 모듈에서 export되어 `[id]/page.tsx`가 UI 컴포넌트 모듈을 business logic source로 의존. 모듈 경계 역할이 모호해짐.
  - 제안: `lib/api/integrations.ts` 또는 `lib/integrations/utils.ts`로 이동하면 badge·detail page·미래 컴포넌트 모두 같은 소스를 참조.

- **[WARNING]** `Cafe24PrivatePendingStep`의 오케스트레이션 과부하
  - 위치: `new/page.tsx:Cafe24PrivatePendingStep`
  - 상세: 단일 컴포넌트가 polling 간격 제어, 10분 타임아웃, 상태 전이 감지, 오류 메시지 파생, 라우터 이동, 캐시 무효화를 모두 담당. presentational 컴포넌트가 orchestration 책임을 흡수한 구조.
  - 제안: `useCafe24PendingPolling(integrationId)` 커스텀 훅으로 상태 기계를 분리 → 컴포넌트는 렌더링만.

- **[WARNING]** 중복 방지를 위한 인메모리 `mall_id` 스캔
  - 위치: `integration-oauth.service.ts` `begin` (Cafe24 private 분기)
  - 상세: `mall_id`가 암호화 JSONB에 저장되어 DB 필터가 불가능하고 워크스페이스의 모든 Cafe24 행을 메모리에서 걸러냄. 주석·plan에서 "< 10건"으로 경계를 인정하지만, 이 가정이 코드 외부에 존재하고 성능 저하 시 진단이 어려움.
  - 제안: 허용 상한 초과 경고 로그 추가(`if (existing.length > 20) this.logger.warn(...)`) 또는 plan에 명시된 `mall_id` 평문 컬럼 분리를 마일스톤 트래킹.

- **[INFO]** `IntegrationExpiryScannerService` 책임 증가 추세
  - 위치: `integration-expiry-scanner.service.ts`
  - 상세: 토큰 만료 알림 → 사용 로그 정리 → pending_install TTL로 3번째 pass 추가. 모두 housekeeping이나 Cafe24 특화 로직이 제네릭 스캐너에 누적 중.
  - 제안: 지금은 문제없으나, 4번째 추가 전 `Cafe24HousekeepingService` 분리 검토.

- **[INFO]** `lastError` 타입 유니온의 타입 안전성 미흡
  - 위치: `integrations.ts:IntegrationDto.lastError`
  - 상세: `{ code?; message?; at? } | Record<string, unknown> | null` — 두 번째 유니온 멤버가 첫 번째를 포함하므로 사실상 `Record<string, unknown> | null`과 동치. TS 타입 체커의 narrowing 실익이 없음.
  - 제안: 백엔드 DTO가 `{ code, message, at }` 만 리턴하는 것을 계약으로 확정하고 `Record` 유니온 제거.

- **[INFO]** `staleTime: 0` 의 공격성
  - 위치: `integrations/page.tsx`
  - 상세: `staleTime: 0 + refetchOnWindowFocus: true` 조합은 탭 포커스 회복마다 paginated list 전체를 재요청. Cafe24 Private pending 감지에는 유용하나 일반 워크플로에서 불필요한 네트워크 비용.
  - 제안: `staleTime: 30_000`으로 완화하고 `refetchOnWindowFocus: true`는 유지. 또는 pending_install 행이 목록에 포함된 경우만 staleTime을 0으로 낮추는 조건부 처리.

- **[INFO]** 레거시 라우트 등록 순서 주의
  - 위치: `integrations.controller.ts` `@Get('oauth/install/cafe24')` vs `@Get('oauth/install/cafe24/:installToken')`
  - 상세: NestJS/Express에서 파라미터 라우트가 정적 라우트보다 먼저 등록되면 충돌 가능성. 현재 diff에서 `:installToken` 라우트가 위에 위치하여 의도대로 동작하나, 이 순서가 보장되는지 확인 필요.

---

### 요약

이번 변경은 Cafe24 Private install 흐름의 핵심 결함(O(N) HMAC trial, 중복 pending row 누적, TTL 미정리)을 O(1) DB lookup 패턴(V043 partial unique index)으로 대체한 명확한 아키텍처 개선이다. `meta.appType` 필드를 통해 credentials 내부 구조를 API surface에서 분리한 접근도 올바르다. 다만 `buildIntegrationMeta`·`isReauthorizeDisabled`에 Cafe24 하드코딩이 제네릭 컴포넌트에 누적되기 시작하는 OCP 경향이 보이고, `Cafe24PrivatePendingStep`이 오케스트레이션 로직을 직접 보유하는 점은 추후 테스트·유지보수 부담이 될 수 있다. 모두 현재 단계에서는 허용 범위이나 두 번째 provider 확장 전 리팩터링 기점으로 관리 권고.

### 위험도

**LOW**