### 발견사항

- **[WARNING]** `needsAttention()` 함수가 `autoRefresh` 를 고려하지 않음 — 거짓 양성 잔존
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `needsAttention` 함수 (라인 2664-2668)
  - 상세: `computeStatus` 는 `expiresSoon && !integration.autoRefresh` 로 좁혔으나, `needsAttention` 은 여전히 `isExpiringSoon(integration.tokenExpiresAt)` 만 보고 있다. cafe24 autoRefresh=true 통합이 tokenExpiresAt 7일 이내이면 `needsAttention()` 이 `true` 를 반환한다. 이 함수는 `computeAttentionBreakdown` 과 목록 페이지 배너 카운트에 직접 사용되므로, 헤더 배지에서 "Connected" 를 보여주면서 동시에 "Needs Attention" 배너에는 카운트로 잡히는 불일치가 발생한다. PR 자체도 이를 "본 PR 범위 밖 (후속 PR)" 으로 인정했으나 현재 코드에 주석도, 테스트 보호도 없다.
  - 제안: `needsAttention` 에 `if (integration.autoRefresh) return false;` 가드를 추가하거나, `isExpiringSoon` 호출 전에 `&& !integration.autoRefresh` 를 적용한다. 후속 PR 예정이라면 최소한 `// TODO(후속 PR): autoRefresh 가드 추가 — #W-32` 주석으로 불완전함을 명시한다.

- **[WARNING]** `computeAttentionBreakdown` 의 "expiring" 카운트가 autoRefresh 통합을 포함함
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `computeAttentionBreakdown` 함수 (라인 2691-2730)
  - 상세: `computeAttentionBreakdown` 은 `needsAttention(i)` 에 위임하므로 위와 같은 문제를 그대로 이어받는다. `br.expiring` 카운트가 autoRefresh=true 인 cafe24 통합까지 포함할 수 있어 목록 페이지의 "Needs attention N" 배너가 부풀려진 숫자를 표시한다. 기존 테스트 `computeAttentionBreakdown` 에도 autoRefresh=true 인 토큰 만료 케이스가 없다.
  - 제안: `needsAttention` 수정 후 `computeAttentionBreakdown` 테스트에 `autoRefresh=true + expiresSoon` 케이스를 추가해 카운트 배제를 검증한다.

- **[WARNING]** 테스트 케이스 설명과 실제 검증 방향이 불일치 (`cafe24 Private` 케이스)
  - 위치: `backend/src/modules/integrations/integrations.service.spec.ts` 라인 577-589
  - 상세: 테스트 이름이 `"returns false for cafe24 Private 도 동일 (mall-aware refresh 가 동작 — autoRefresh=true 유지)"` 인데, 함수 서술 첫 단어가 "returns false" 이나 실제 `expect(result.autoRefresh).toBe(true)` 를 검증한다. "returns false for" 는 직전 케이스 복사 흔적으로 보이며 오독 유발 가능성이 높다.
  - 제안: 테스트 이름을 `"returns true for cafe24 Private (mall-aware refresh 동일 동작)"` 으로 수정한다.

- **[WARNING]** `humanizeUntil` 에서 "exactly 24h" 경계 케이스 미처리
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `humanizeUntil` 함수 (라인 2649-2662)
  - 상세: `hours < 24` 분기가 24시간 정확히(`hours === 24`)일 때 `days` 분기로 내려간다. `days = Math.floor(24 / 24) = 1` 이므로 `"1d"` 가 반환된다. 이것 자체는 수학적으로 올바르지만, `hours = 24, remMinutes = 0` 이면 "24h" 가 아닌 "1d" 로 표시되어 하루가 넘지 않는 상황에서 "1d" 가 나오는 부자연스러운 UX가 발생할 수 있다. 또한 정확히 `minutes = 60` 이면 `hours = 1, remMinutes = 0` → `"1h"` 로 정상 처리되나, 이 경계도 테스트에 없다.
  - 제안: `humanizeUntil` 테스트에 정확히 60분, 정확히 24시간 케이스를 추가해 예상 출력을 명시적으로 고정한다. 24시간이 "1d" 로 표시되는 게 의도라면 주석으로 명시한다.

- **[INFO]** `InfoRow` 에 `tooltip` prop 이 있으나 접근성(accessibility) 속성 미처리
  - 위치: `frontend/src/app/(main)/integrations/[id]/page.tsx` — `InfoRow` 컴포넌트 (라인 1675-1716)
  - 상세: `tooltip` 이 있을 때 value 래퍼 `<div>` 에 `cursor-help underline decoration-dotted` 만 부여되고 `aria-label` 또는 `title` 이 없다. Radix `TooltipTrigger asChild` 가 일부 접근성을 처리하나, 스크린 리더 사용자는 절대 시각 정보(tooltip 내 datetime)에 접근하지 못할 수 있다.
  - 제안: `TooltipTrigger` 래퍼에 `aria-label={tooltip}` 또는 `title={tooltip}` 을 추가한다. Radix UI 의 `TooltipContent` 는 이미 `role="tooltip"` 을 부여하나 trigger 연결을 명시적으로 하는 것이 권장된다.

- **[INFO]** `IntegrationDto.autoRefresh` 가 필수 non-optional 필드로 선언되었으나 구버전 백엔드 응답에서의 하위 호환성 미검토
  - 위치: `frontend/src/lib/api/integrations.ts` 라인 2938
  - 상세: `autoRefresh: boolean` 으로 required 필드로 선언되어 있어, 만약 구버전 API 응답(이 필드가 없는 응답)을 받으면 타입 불일치가 발생한다. 현재 단일 배포 모노레포라 rolling 배포 중 짧은 불일치 기간이 생길 수 있다.
  - 제안: 필드를 `autoRefresh: boolean` 으로 유지하되, API 응답 처리 시 `?? false` 로 폴백하는 런타임 방어를 `unwrap` 또는 응답 매핑 레이어에 추가한다. 또는 `autoRefresh?: boolean` 으로 선언하고 사용처에서 `?? false` 처리를 명시한다.

- **[INFO]** `@ApiProperty({ example: true })` 에 타입 명시 없음
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 라인 106
  - 상세: `@ApiProperty({ example: true })` 에 `type: Boolean` 이 없다. Swagger 는 `example` 에서 타입을 추론하지만, NestJS Swagger 플러그인이 없거나 타입 추론이 실패할 때 스키마가 `any` 로 생성될 수 있다. 다른 boolean 필드들과 비교해도 `type` 누락이 유일하다.
  - 제안: `@ApiProperty({ type: Boolean, example: true })` 로 명시적 타입을 추가한다.

### 요약

이 PR 의 핵심 요구사항인 "자동 갱신 통합을 attention 술어에서 제외" 는 `computeStatus` 에서 올바르게 구현되었고, 백엔드 derived 필드 매핑과 서비스 레지스트리 변경도 의도와 구현이 일치한다. 그러나 `needsAttention()` 과 `computeAttentionBreakdown()` 에서 동일한 `autoRefresh` 가드가 적용되지 않아, 목록 페이지의 "Needs Attention" 배너 카운트에는 여전히 거짓 양성이 잔존한다. PR 자체도 이를 인지했으나 명시적 TODO 주석이나 실패-테스트 추가 없이 후속 PR 에 위임하고 있어, 이 불완전한 상태가 추적되지 않을 위험이 있다. 또한 테스트 이름 오기와 `humanizeUntil` 경계 케이스 미테스트, 접근성 미처리 등 minor 품질 이슈도 있다.

### 위험도

MEDIUM
