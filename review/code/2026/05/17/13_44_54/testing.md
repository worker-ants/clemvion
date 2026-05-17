# 테스트(Testing) 리뷰

## 발견사항

### 백엔드

- **[INFO]** `toPublic` 경로 분기(credsUnreadable vs 정상) 모두에 `autoRefresh` 추가
  - 위치: `integrations.service.ts` lines 1054, 1068
  - 상세: `toPublic` 내부의 두 return 경로(credsUnreadable 분기 + 정상 분기) 모두에 `autoRefresh` 필드가 삽입되어 있고, 단위 테스트 7번째 케이스(`unreadable credentials`)가 이를 검증한다. 커버리지 갭 없음.
  - 제안: 현행 유지.

- **[WARNING]** `toPublic`이 `findById` 외 다른 메서드(예: `findAll`, `listByWorkspace` 등)에서도 호출된다면 해당 경로의 테스트가 누락될 수 있음
  - 위치: `integrations.service.spec.ts` — `autoRefresh` describe 블록 전체
  - 상세: 제공된 diff와 테스트 파일은 `findById` 경로를 통해서만 `toPublic`을 간접 호출한다. `findAll`/목록 API 등 다른 public-facing 경로가 `toPublic`을 사용한다면, `autoRefresh` 파생 값이 그 경로에서도 올바르게 전달되는지 검증하는 테스트가 없다. 실제로 그 경로들이 존재하는지는 파일 전체가 제공되지 않아 확인할 수 없었지만, 아키텍처상 동일 `toPublic`을 공유하고 있다면 단일 `findById` 테스트로 충분할 수 있다.
  - 제안: `toPublic`이 단일 private 헬퍼로만 노출된다면 문제없음. 목록 조회 경로가 별도로 `toPublic`을 호출한다면 해당 경로에 `autoRefresh` 값 검증 케이스 1건 추가 권고.

- **[WARNING]** `it` 설명과 실제 단언이 불일치하는 케이스 존재
  - 위치: `integrations.service.spec.ts` line 577
  - 상세: 7번째 케이스의 `it` 설명이 `'returns false for cafe24 Private 도 동일 (mall-aware refresh 가 동작 — autoRefresh=true 유지)'`인데, 내용은 `autoRefresh=true` 를 기대한다. 이름에 "returns false" 가 남아있어 처음 읽을 때 혼란을 줄 수 있다 (이미지처럼 복사-수정 과정에서 설명 앞부분이 이전 케이스에서 그대로 남겨진 것으로 보임).
  - 제안: 설명을 `'returns true for cafe24 Private (mall-aware refresh — same as Public)'`로 정정.

- **[INFO]** `supportsTokenAutoRefresh` 필드 자체에 대한 단위 테스트 미존재 (service-registry 레벨)
  - 위치: `service-registry.ts`
  - 상세: service-registry에 신규 필드가 추가되었으나, `findService('cafe24')?.supportsTokenAutoRefresh` 가 `true` 인지 직접 검증하는 registry 레벨 단위 테스트는 없다. 현재는 `integrations.service.spec.ts` 에서 `findById` 를 통해 간접 검증한다. 이 방식은 충분히 작동하나, service-registry 전용 spec 파일이 있다면 거기에 `supportsTokenAutoRefresh` 설정값 검증 케이스를 두는 것이 레이어 분리 측면에서 더 깔끔하다.
  - 제안: 현행 간접 검증 유지 가능. service-registry에 대한 별도 spec이 존재하거나 추가될 경우에는 `google`, `cafe24` → true, `github` → undefined(= false)를 직접 단언하는 케이스 추가 권고.

---

### 프론트엔드

- **[CRITICAL]** `humanizeUntil` 함수에 대한 단위 테스트 완전 미존재
  - 위치: `status-badge.tsx` `humanizeUntil` 함수 / `status-badge.test.tsx` 전체
  - 상세: `humanizeUntil`은 내부 분기가 5개 이상이다 (`ms <= 0`, `minutes < 1`, `minutes < 60`, `hours < 24 + remMinutes = 0`, `hours < 24 + remMinutes > 0`, `hours >= 24`). 이 함수는 export 되어 있고(`export function humanizeUntil`) `page.tsx`와 `status-badge.tsx` 두 곳에서 직접 사용된다. 현재 테스트는 `humanizeUntil`을 직접 호출하는 케이스가 단 하나도 없고, `computeStatus` 테스트에서 `subLabel`이 `/Auto-renews/i` 패턴에 매칭되는지만 확인한다. 다음 경계 케이스가 테스트되지 않는다:
    - 과거 시각(`ms <= 0`) → `""` 반환 검증
    - `NaN`/invalid ISO 문자열 → `""` 반환 검증
    - 정확히 1분 → `"1m"` (vs `"less than a minute"` 경계)
    - 정확히 60분 → `"1h"` (vs `"59m"` 경계)
    - `1h 30m` 형식 검증 (remMinutes > 0 분기)
    - 정확히 24h → `"1d"` (vs `"23h..."` 경계)
  - 제안: `humanizeUntil`에 대한 전용 `describe` 블록을 `status-badge.test.tsx` 에 추가. 최소 경계값 케이스: 과거 시각, `"less than a minute"`, 분 단위, 시간 단위(remMinutes=0 vs >0), 일 단위.

- **[WARNING]** `needsAttention` 함수가 `autoRefresh` 플래그를 무시하는 것에 대한 회귀 검증 미흡
  - 위치: `status-badge.tsx` `needsAttention` / `status-badge.test.tsx`
  - 상세: `needsAttention`은 변경되지 않고 `isExpiringSoon`에만 의존하여 `autoRefresh` 를 고려하지 않는다. 커밋 메시지도 이를 "본 PR 범위 밖" 으로 명시한다. 그러나 `computeAttentionBreakdown` 테스트의 `'counts a token expiring in just under 7 days as expiring'` 케이스에서 기본 fixture(`autoRefresh: true`)를 사용한 상태에서 `expiring` count가 1이 되는 것을 기대하고 있다. 이는 `autoRefresh=true` 인 통합이 `needsAttention()` 에서 여전히 attention 대상으로 분류됨을 의미하는데, 현재 명세(`후속 PR`)와는 맞지만 테스트 의도가 모호하다. 테스트에 `autoRefresh: false`를 명시적으로 설정하거나, `autoRefresh=true` 통합은 의도적으로 attention 카운트에 포함됨을 주석으로 표기해야 한다.
  - 제안: `computeAttentionBreakdown` 경계 케이스에 `autoRefresh: false`를 명시적으로 설정. 또는 `needsAttention`이 `autoRefresh`를 무시함을 확인하는 전용 케이스 추가: `autoRefresh=true`인 토큰 임박 통합이 `needsAttention()=true`를 반환하는 것이 현재 의도임을 명시.

- **[WARNING]** `InfoRow` 컴포넌트(tooltip 분기 추가)에 대한 렌더링 테스트 없음
  - 위치: `frontend/src/app/(main)/integrations/[id]/page.tsx` `InfoRow` 함수
  - 상세: `InfoRow`는 `tooltip` prop이 있을 때 Radix `Tooltip` + `TooltipProvider`를 렌더링하고, 없을 때 단순 `div`를 렌더링하는 두 분기가 추가되었다. 이 렌더링 분기에 대한 테스트가 없다. `page.tsx` 전체가 `"use client"` Next.js 페이지이므로 통합 테스트/e2e 없이는 검증이 어렵지만, `InfoRow`가 간단한 순수 함수 컴포넌트이므로 별도 `__tests__/info-row.test.tsx`에서 단위 테스트 가능하다.
  - 제안: `InfoRow`를 별도 파일로 추출하거나, `page.tsx` 파일 내 export 없이 테스트하려면 RTL(React Testing Library) 기반 렌더링 테스트를 추가. 최소 2케이스: tooltip 없을 때 Tooltip 컴포넌트 미렌더링, tooltip 있을 때 hover 시 tooltip 텍스트 노출.

- **[INFO]** `StatusBadge` 컴포넌트의 `subLabel` 렌더링에 대한 컴포넌트 수준 테스트 없음
  - 위치: `status-badge.tsx` `StatusBadge` 컴포넌트 / `status-badge.test.tsx`
  - 상세: `computeStatus`의 `subLabel` 계산 자체는 단위 테스트가 있으나, `StatusBadge`가 실제로 `subLabel` 을 DOM에 `· {view.subLabel}` 형태로 렌더링하는지 확인하는 컴포넌트 레벨 렌더링 테스트가 없다. 현재 테스트 파일은 `computeStatus` (순수 함수)와 `isReauthorizeDisabled` / `computeAttentionBreakdown`만 테스트한다.
  - 제안: RTL로 `StatusBadge`에 `autoRefresh=true, tokenExpiresAt=<미래>` 통합을 전달했을 때 `Auto-renews` 텍스트가 포함된 `span`이 렌더링되는지 확인하는 케이스 1건 추가.

- **[INFO]** `computeStatus`에서 `status === "expired"` + `autoRefresh=true` 조합 테스트 의존성
  - 위치: `status-badge.test.tsx` line 1940-1954
  - 상세: `'no subLabel when autoRefresh=true but not connected'` 케이스에서 `error`와 `expired` 두 상태를 하나의 `it` 블록에서 동시에 검증한다. 어느 하나가 실패하면 어떤 상태가 문제인지 분리하기 어렵다.
  - 제안: `error`와 `expired` 케이스를 별도 `it` 블록으로 분리하여 실패 진단을 쉽게 한다.

---

### 통합/e2e 레벨

- **[WARNING]** `autoRefresh` 파생 필드에 대한 e2e/통합 테스트 없음
  - 위치: 해당 기능 전체
  - 상세: 백엔드 service-registry에서 `supportsTokenAutoRefresh` 설정 → `toPublic` 매핑 → HTTP 응답 JSON → 프론트엔드 `IntegrationDto.autoRefresh` → `computeStatus` → `StatusBadge` 렌더링의 전체 데이터 흐름을 검증하는 e2e 테스트가 없다. 커밋 메시지는 `npm test`만 언급하며 `make e2e-test` 결과는 포함되지 않는다. 프로젝트가 `docker-compose.e2e.yml` 기반 3계층 테스트를 요구하는 점을 고려할 때, `autoRefresh=true` 통합의 상세 페이지가 "Connected" 라벨 + "Auto-renews" 보조 라벨로 표시되는 e2e 시나리오가 필요하다.
  - 제안: e2e 테스트에 cafe24/google 통합 상세 페이지 검증 시나리오 추가. 최소 조건: `autoRefresh=true` 통합의 헤더 배지가 `warn` 톤 없이 "Connected" + "Auto-renews..." 를 표시하는지 확인.

---

## 요약

이번 변경은 백엔드 7건, 프론트엔드 5건의 단위 테스트를 함께 추가하여 핵심 로직(`autoRefresh` 파생값 계산, `computeStatus` 분기 변경)에 대한 기본 커버리지를 갖춘 점은 긍정적이다. 그러나 신규 추가된 `humanizeUntil` 헬퍼는 export 되어 두 곳에서 사용됨에도 직접 단위 테스트가 전혀 없어 경계값 회귀에 취약하다(CRITICAL). `InfoRow` tooltip 분기, `StatusBadge` 렌더링, `needsAttention`의 `autoRefresh` 미반영에 대한 테스트 의도 명시도 부족하다. 백엔드 테스트 케이스 7번째(`cafe24 Private`)의 `it` 설명이 `"returns false"` 로 남아 있어 코드 리딩 혼란을 유발한다. e2e 계층 검증도 누락되어 있어 전체 데이터 흐름의 회귀 안전망이 불완전하다.

## 위험도

MEDIUM
