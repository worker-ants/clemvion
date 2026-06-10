# Requirement Review

## 발견사항

### [INFO] 테스트 커버리지 갭 — refresh-capable provider 의 3d/7d 임계 알림 스킵
- 위치: `integration-expiry-scanner.service.spec.ts` 전반
- 상세: 기존 7d 알림 테스트(`creates a 7d notification for a personal integration expiring in 5 days`)는 non-refresh-capable provider(serviceType 미지정)를 사용한다. refresh-capable provider(cafe24/makeshop + refresh_token)가 7d 또는 3d 임계에 도달했을 때 `claimThreshold`와 알림 발사가 모두 스킵되는지를 직접 검증하는 테스트가 없다. 코드 로직상 `isRefreshCapable` 체크가 루프 최상단에서 `continue`하여 모든 임계(0d/3d/7d)에 대해 동일하게 적용되므로 런타임 회귀 위험은 낮다. 다만 이 경로에 대한 명시적 회귀 방지가 없다.
- 제안: `it('exempts cafe24 with refresh_token from 7d/3d alert dispatch')` 테스트를 추가해 3d/7d 임계에서도 `notificationsService.createMany`에 해당 resourceId가 포함되지 않음을 검증 권장.

---

### [INFO] spec §11.2 발사 정책 — "재인증 실패" 행은 코드에서 구현되지 않음
- 위치: `spec/2-navigation/4-integration.md §11.2` 알림 표 라인 989 / `integration-expiry-scanner.service.ts`
- 상세: spec §11.2 `integration_expired` 알림 표에 `재인증 실패 | Reauthorization failed | Failed to reauthorize "<name>".` 행이 존재한다. 이 알림은 본 스캐너 서비스가 아닌 별도 reauthorize 경로에서 발사되는 것으로 판단되나, 스캐너 코드 어디에도 해당 케이스를 처리하거나 명시적으로 위임하는 코드가 없다. 본 PR 범위 밖의 기존 알림이므로 현재 변경에 의한 회귀는 아니다.
- 제안: 해당 알림이 어느 경로(`integrations.service.ts` 의 reauthorize 핸들러 등)에서 발사되는지 spec 본문에 명시하면 추적 가능성이 높아진다. spec 갱신 대상으로 `project-planner` 위임 권장.

---

## 요구사항 충족 평가

변경 대상인 세 가지 fix(V-01 makeshop 오격하 수정, V-07 §11.2 passive 알림 정책 채택, V-15 큐 레지스트리 동기)는 모두 의도한 동작을 완전히 구현하고 있다.

**V-01**: `isCafe24RefreshCapable` → `isRefreshCapable`로 일반화되어 `serviceType === 'makeshop' && credentials.refresh_token` 조건을 올바르게 포함한다. makeshop에 대해 큐 enqueue 없이 격하만 면제하는 분기(`threshold === '0d' && integration.serviceType === 'cafe24'`)도 정확하다. 빈 문자열 refresh_token 처리(`rt.length > 0` guard)와 null credentials 처리도 완비.

**V-07**: `statusReason = 'token_expired'`가 refresh_token-less 0d 격하 경로에만 추가되고, `INTEGRATION_STATUS_REASONS` union에도 등재됐다. refresh-capable provider의 claim/격하/passive 알림 전부 스킵은 `isRefreshCapable` 체크 → `continue` 구조로 일관되게 구현됐으며 spec §11.2 발사 정책("refresh_token 없는 provider 한정")과 line-level로 일치한다. spec §11.1 표·의사코드·§11.2·data-flow/5-integration.md·spec/1-data-model.md 모두 동기 완료됐다.

**V-15**: `MONITORED_QUEUES`에 `MAKESHOP_REFRESH_QUEUE` 추가, 단위 테스트(`system-status.constants.spec.ts`) 신설, e2e 큐 수 13→14 갱신이 일관되게 적용됐다. 스펙 `spec/5-system/16-system-status-api.md §1` 표에 이미 makeshop 행이 있었으므로 코드만 누락된 상태가 해소됐다.

엣지 케이스(빈 string refresh_token, refresh_token 없는 cafe24 fallback, Redis enqueue 실패 시 graceful 처리)에 대한 테스트가 존재한다. 비즈니스 로직과 spec 본문 간 불일치는 발견되지 않았다.

## 위험도

NONE
