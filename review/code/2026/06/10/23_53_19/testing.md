# Testing Review

## 발견사항

### **[INFO]** `integration-status-reason.ts` 에 `normalizeStatusReason` 단위 테스트 없음
- 위치: `/codebase/backend/src/modules/integrations/integration-status-reason.ts`
- 상세: `token_expired` 슬러그가 신규 추가됐지만 `INTEGRATION_STATUS_REASONS` / `normalizeStatusReason` 헬퍼에 대한 전용 spec 파일이 존재하지 않는다. `normalizeStatusReason('token_expired')` 가 `'token_expired'` 를 그대로 반환하는지, 임의 문자열이 `'unknown_error'` 로 정규화되는지 직접 검증하는 단위 테스트가 없다.
- 제안: `integration-status-reason.spec.ts` 를 신설해 `normalizeStatusReason('token_expired') === 'token_expired'`, `normalizeStatusReason(null) === 'unknown_error'`, `normalizeStatusReason('unknown_garbage') === 'unknown_error'` 를 커버한다. 헬퍼가 단순해 3~4개의 단순 테스트로 충분하다.

### **[WARNING]** refresh-capable provider 의 7d / 3d 임계에서 알림 면제 검증 누락
- 위치: `integration-expiry-scanner.service.spec.ts` — 현재 테스트 목록 참조
- 상세: `isRefreshCapable` 분기가 `continue` 로 claim/격하/알림을 모두 건너뛰므로, cafe24·makeshop 은 `remain ≤ 7d` / `≤ 3d` 임계에서도 알림이 발사되지 않아야 한다. 그러나 현재 테스트는 0d 케이스만 커버하며, 7d/3d 임계에서 refresh-capable provider 가 알림을 수신하지 않음을 검증하는 케이스가 없다. 프로덕션 코드는 `isRefreshCapable` 체크가 `classifyThreshold` 직후이므로 7d/3d 도 면제 대상이지만 테스트 근거가 없다.
- 제안: 아래 두 케이스를 추가한다.
  1. cafe24 + refresh_token 보유, `tokenExpiresAt = now + 5d` → `notificationsService.createMany` 의 호출 목록에 해당 `resourceId` 가 없음 확인.
  2. makeshop + refresh_token 보유, `tokenExpiresAt = now + 2d` → 동일 확인.

### **[INFO]** `demotes makeshop missing refresh_token at 0d` 테스트에서 알림 발사 여부만 검증, `claimThreshold` 선행 검증 없음
- 위치: `integration-expiry-scanner.service.spec.ts` 라인 435–476
- 상세: refresh_token 없는 makeshop 행은 claim 로직을 거쳐야 알림이 발사된다. 테스트는 `notificationsService.createMany` 의 결과 알림 목록이 `makeshop-int-2` 를 포함하는지 확인하지만, `dispatchRepo.__insertBuilder.values` 가 `{ integrationId: 'makeshop-int-2', threshold: '0d' }` 로 호출됐는지 검증하지 않는다. 현재는 기능상 무관하나, 나중에 claim 분기가 우회될 경우 회귀를 놓칠 수 있다.
- 제안: `expect(dispatchRepo.__insertBuilder.values).toHaveBeenCalledWith(expect.objectContaining({ integrationId: 'makeshop-int-2', threshold: '0d' }))` 를 추가한다.

### **[INFO]** refresh-capable 알림 부재 assertion 의 이중 `.flat()` 패턴 일관성
- 위치: `integration-expiry-scanner.service.spec.ts` 라인 70–80, 125–135, 192–202
- 상세: `notificationsService.createMany.mock.calls.flat() as unknown[]` 에 `.flat()` 을 한 번 더 적용하는 패턴이 세 곳에서 반복된다. `createMany` 는 단일 배열 인자 하나만 받으므로 `mock.calls[0]?.[0]` 형태가 더 명확하고 의도를 잘 표현한다. 현 패턴은 `calls`가 비어 있을 때(`calls[0]` 없음) `.flat()` 이 빈 배열을 반환해 테스트가 통과하긴 하지만, "createMany 가 아예 호출되지 않은 경우도 통과"라는 약한 assertion 이 된다. `createMany` 가 호출되지 않은 케이스와 호출됐으나 해당 `resourceId` 를 포함하지 않은 케이스를 구분하지 못한다.
- 제안: 알림 면제 검증 케이스에서 `expect(notificationsService.createMany).toHaveBeenCalledTimes(1)` + `expect(notificationsService.createMany.mock.calls[0][0]).not.toEqual(expect.arrayContaining([expect.objectContaining({ resourceId: '...' })]))` 형태로 단계를 분리한다. 혹은 최소한 `createMany` 가 호출됐을 때만 내용을 검사하도록 guard 를 추가한다.

### **[INFO]** `system-status.constants.spec.ts` — `INTEGRATION_EXPIRY_QUEUE` 등록 검증 없음
- 위치: `/codebase/backend/src/modules/system-status/system-status.constants.spec.ts`
- 상세: 신설된 spec 은 cafe24·makeshop 갱신 큐만 검증한다. `INTEGRATION_EXPIRY_QUEUE` (integration-expiry-scanner) 도 `MONITORED_QUEUES` 에 포함돼야 하는 큐다. 현재 누락 여부는 없지만, 추가 대상 큐들(`SCHEDULE_QUEUE`, `INTEGRATION_EXPIRY_QUEUE` 등 시스템 중요 큐)에 대한 선택적 누락 탐지 방법이 제한적이다.
- 제안: 현재 스타일과 동일하게 `INTEGRATION_EXPIRY_QUEUE` 가 `names` 에 포함되는지 확인하는 케이스를 추가하거나, 향후 큐 추가 시 `MONITORED_QUEUES` 갱신을 강제할 수 있도록 `MONITORED_QUEUES.length` 가 특정 값 이상인지 assertion 을 두는 방식을 고려한다 (후자는 유지보수 비용 있음).

### **[INFO]** `e2e` 큐 수량 hard-code (`13→14`) 가 향후 큐 추가 시 반복 수정 필요
- 위치: `/codebase/backend/test/system-status.e2e-spec.ts` 라인 79
- 상세: 현 변경은 적법하지만, 큐 수량을 테스트 설명 문자열과 `EXPECTED_QUEUE_NAMES` 배열 길이 비교로 자동 파생하지 않고 숫자 리터럴 `14` 를 두 곳(설명 문자열 + 로직 없음)에 명시한다. 큐가 추가/제거될 때마다 설명 문자열도 수동 갱신이 필요하다.
- 제안: 테스트 설명에 숫자를 박지 않고 `\`인증 시 ${EXPECTED_QUEUE_NAMES.length}개 큐의 집계 상태를 반환한다\`` 형태로 작성하면 `EXPECTED_QUEUE_NAMES` 배열만 관리하면 된다. 현재로서는 LOW 임팩트이나 일관성 관점에서 언급.

---

## 요약

이번 변경의 핵심인 `isRefreshCapable` 일반화(V-01)·`token_expired` statusReason 추가(V-07)·`MONITORED_QUEUES` 동기(V-15) 에 대한 테스트 커버리지는 전반적으로 양호하다. makeshop 2-케이스(refresh_token 유/무) 신규 추가, cafe24 알림 면제 어설션 갱신, empty-string refresh_token 회귀 방지 케이스, system-status.constants.spec 신설이 모두 포함되어 주요 경로는 커버된다. 다만 **7d/3d 임계에서 refresh-capable provider 의 알림 면제를 검증하는 케이스가 없고**, refresh-capable 알림 부재 assertion 에 사용된 이중 `.flat()` 패턴이 "createMany 미호출 시도 통과"하는 약한 assertion 이라는 점이 주의가 필요하다. `integration-status-reason.ts` 의 신규 슬러그 `token_expired` 에 대한 전용 단위 테스트도 없다. 이 세 가지는 코드 정확성에 직접적인 위험을 주지는 않지만 회귀 방어망의 공백이므로 보강을 권장한다.

---

## 위험도

LOW
