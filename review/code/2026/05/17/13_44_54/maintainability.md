# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `humanizeUntil` 함수 내 매직 넘버 `60_000`, `60`, `24` 사용
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `humanizeUntil` 함수 (라인 2496~2508 기준)
  - 상세: `60_000` (ms/min), `60` (min/hr), `24` (hr/day) 상수가 인라인으로 반복 사용된다. 같은 파일 내 `daysUntil` 함수도 `24 * 60 * 60 * 1000` 을 직접 쓰고 있어 동일한 단위 변환 상수가 두 함수에 분산된다.
  - 제안: `MS_PER_MINUTE`, `MINUTES_PER_HOUR`, `HOURS_PER_DAY` 등 파일-스코프 상수로 추출하거나, `daysUntil` 과 `humanizeUntil` 이 공유하는 `MS_PER_DAY` 상수를 하나로 통합한다.

- **[INFO]** `daysUntil` 과 `humanizeUntil` 의 ms-since-epoch 계산 중복
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `daysUntil` / `humanizeUntil` 두 함수
  - 상세: 두 함수 모두 `new Date(at).getTime() - Date.now()` 로 ms 를 계산한다. 로직이 유사하고 향후 타임존·클럭 스큐 처리가 추가될 경우 두 곳을 동시에 수정해야 한다.
  - 제안: `msUntil(at: string): number` 와 같은 내부 헬퍼로 추출해 두 함수가 공유한다.

- **[INFO]** 테스트 픽스처 헬퍼 `inMinutes` / `inDaysIso` / `inDays` 가 테스트 파일 내부에 산재
  - 위치: `frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` — `describe("autoRefresh + expiresSoon")` 블록과 `describe("computeAttentionBreakdown")` 블록 각각에 별도 정의
  - 상세: `inMinutes` 와 `inDaysIso` 는 autoRefresh 블록에, `inDays` 는 computeAttentionBreakdown 블록에 각각 선언되어 있다. 동일 관심사(미래 시각 생성)를 다루는 유틸이 두 군데 존재한다.
  - 제안: 테스트 파일 최상단 또는 별도 `test-utils` 모듈로 통합해 재사용한다.

- **[INFO]** `InfoRow` 컴포넌트 내 `TooltipProvider` 를 인스턴스마다 생성
  - 위치: `frontend/src/app/(main)/integrations/[id]/page.tsx` — `InfoRow` 함수 (라인 1700~1716 기준)
  - 상세: tooltip prop 이 있는 `InfoRow` 가 여러 개 렌더될 경우 각각 독립적인 `TooltipProvider` 를 생성한다. Radix 공식 권장은 앱/페이지 레벨 단일 Provider 배치이며, 중복 Provider 는 z-index/portal 충돌 가능성이 있고 불필요한 컨텍스트 생성을 야기한다.
  - 제안: `TooltipProvider` 를 `OverviewTab` 또는 페이지 루트 수준으로 상향 이동하고, `InfoRow` 내부에서는 `Tooltip` / `TooltipTrigger` / `TooltipContent` 만 사용한다.

- **[INFO]** `supportsTokenAutoRefresh` 프로퍼티명이 길고 backend-frontend 간 명칭이 상이
  - 위치: `backend/src/modules/integrations/services/service-registry.ts` (`supportsTokenAutoRefresh`) vs. `IntegrationDto.autoRefresh` (백엔드 DTO·프론트엔드 타입 모두)
  - 상세: 내부 정의 이름(`supportsTokenAutoRefresh`)과 공개 API 이름(`autoRefresh`)이 달라 `toPublic` 변환 레이어를 처음 보는 개발자가 둘 사이의 연결을 추적해야 한다. 이 자체는 의도적 캡슐화이지만, 주석에서만 연결이 설명되어 있어 타입 추적 툴로 즉시 발견하기 어렵다.
  - 제안: `toPublic` 매핑 지점에 `// ServiceDefinition.supportsTokenAutoRefresh → autoRefresh` 형태의 인라인 주석을 유지하는 것으로 충분하다. 현재 코드가 이미 이를 수행하고 있으므로 낮은 우선순위.

- **[WARNING]** `needsAttention` 함수가 `autoRefresh` 를 무시해 `computeAttentionBreakdown` 과 `computeStatus` 간 의미론 불일치
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `needsAttention` 함수 (라인 2665~2669) 및 PR 범위 밖으로 명시된 후속 항목
  - 상세: `computeStatus` 는 `expiresSoon && !autoRefresh` 로 좁혀 autoRefresh 통합의 노란 경고를 억제하지만, `needsAttention` 은 여전히 `isExpiringSoon(tokenExpiresAt)` 만 보므로 autoRefresh=true 인 cafe24 통합이 `computeAttentionBreakdown` 의 `expiring` 카운트에 포함된다. PR 커밋 메시지에 "후속 PR" 로 명시되어 있어 인식은 되어 있으나, 두 함수가 같은 파일에 있으면서 다른 정책을 적용하는 것은 혼란을 줄 수 있다.
  - 제안: 임시 보완으로 `needsAttention` 주석에 "autoRefresh 통합의 expiring 포함 여부는 후속 PR(W-32)에서 정렬 예정" 이라고 명시하거나, 함수 위에 `// TODO(W-32): autoRefresh 가드 추가` 토큰을 달아 추적 가능하게 한다.

- **[INFO]** 백엔드 테스트의 7번째 케이스 설명문 오기 — `returns false for cafe24 Private` 가 실제 기대값 `true` 와 불일치
  - 위치: `backend/src/modules/integrations/integrations.service.spec.ts` — 라인 577
  - 상세: `it('returns false for cafe24 Private 도 동일 (mall-aware refresh 가 동작 — autoRefresh=true 유지)', ...)` 에서 설명 첫 단어가 "returns false" 이지만 실제로 `expect(result.autoRefresh).toBe(true)` 를 검증한다. 테스트 설명이 결과와 반대로 읽힌다.
  - 제안: `'returns true for cafe24 Private (mall-aware refresh 동일 동작 — autoRefresh=true)'` 로 수정한다.

## 요약

이번 변경은 `autoRefresh` derived 필드를 백엔드 service registry 에서 계산하여 프론트엔드 UI 분기 신호로 전달하는 구조로, 설계 의도가 코드 전 계층에 걸쳐 일관되게 구현되어 있다. 함수 길이는 적절하고, 네이밍 컨벤션은 기존 코드베이스와 잘 맞는다. 주석과 spec 참조도 충실하다. 다만 `humanizeUntil` / `daysUntil` 사이의 단위 변환 상수 중복, 테스트 픽스처 헬퍼의 산재, `InfoRow` 내 `TooltipProvider` 인스턴스화 방식, 그리고 `needsAttention` 과 `computeStatus` 의 `autoRefresh` 정책 불일치(후속 PR 대기 중)가 미미한 유지보수 부담을 남긴다. 특히 `needsAttention` 불일치는 동일 파일 내에서 같은 개념을 두 가지 방식으로 다루므로 추후 혼란의 여지가 있어 WARNING 으로 분류했다. 전체적으로 가독성과 일관성은 양호하다.

## 위험도

LOW
