# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: integration-expiry-scanner.service.spec.ts

- **[WARNING]** 알림 부재 검증 패턴이 3곳에서 중복 반복됨
  - 위치: 테스트 내 `notifs`, `notifs3`, `mkNotifs`, `mk2Notifs` 변수 관련 블록 (diff 내 3회 반복)
  - 상세: "passive 알림이 특정 resourceId 로 발사되지 않았는지" 확인하는 패턴이 동일 형태로 세 테스트에 복사·붙여넣기되어 있다.
    ```ts
    const notifs = (
      notificationsService.createMany.mock.calls.flat() as unknown[]
    ).flat();
    expect(
      notifs.some(
        (n) =>
          typeof n === 'object' &&
          n !== null &&
          (n as { resourceId?: string }).resourceId === 'cafe24-int-1',
      ),
    ).toBe(false);
    ```
    동일 구조가 `notifs3`, `mkNotifs` 에서 resourceId 리터럴만 달리해 반복된다. 추출된 헬퍼 함수(`hasNotifFor(service, resourceId)`) 로 공통화하면 가독성과 수정 용이성이 크게 향상된다.
  - 제안:
    ```ts
    function getNotifResourceIds(svc: { createMany: jest.Mock }): string[] {
      return (svc.createMany.mock.calls.flat() as unknown[])
        .flat()
        .filter(
          (n): n is { resourceId: string } =>
            typeof n === 'object' &&
            n !== null &&
            'resourceId' in (n as object),
        )
        .map((n) => n.resourceId);
    }
    // 사용: expect(getNotifResourceIds(notificationsService)).not.toContain('cafe24-int-1');
    ```

- **[WARNING]** `savedExpired` 검증 패턴도 3곳에서 중복 반복
  - 위치: cafe24-int-1 테스트, cafe24-int-3 테스트, makeshop-int-1 테스트
  - 상세: `integrationRepo.save.mock.calls.flat()` 이후 `Array.isArray` 분기로 `status === 'expired'` 를 찾는 로직이 동일하게 세 곳에 반복된다. 스펙 변경이나 데이터 구조 변경 시 세 곳을 모두 수정해야 한다.
  - 제안: 헬퍼 함수 `hasSavedExpired(repo)` 추출 후 각 테스트에서 재사용.

- **[INFO]** 변수명 `notifs` / `notifs3` / `mkNotifs` / `mk2Notifs` 의 비일관성
  - 위치: 3개 테스트 내 알림 검증 변수
  - 상세: 같은 역할의 변수가 각 테스트마다 다른 명명 규칙을 사용한다 (`notifs`, `notifs3`, `mkNotifs`, `mk2Notifs`). 헬퍼 함수로 추출하면 변수명 자체가 불필요해지므로 자연히 해소된다.
  - 제안: 공통 헬퍼 함수 추출로 해소.

---

### 파일 2: integration-expiry-scanner.service.ts

- **[INFO]** `isRefreshCapable` 의 서비스타입 목록이 하드코딩 리터럴로 분산될 가능성
  - 위치: `isRefreshCapable` 함수 (파일 끝부분), `run()` 메서드 내 `integration.serviceType === 'cafe24'` 조건
  - 상세: `isRefreshCapable` 이 `'cafe24'`/`'makeshop'` 을 반환 조건으로 갖고, `run()` 내부에서 다시 `integration.serviceType === 'cafe24'` 로 분기한다. Shopify 등 신규 provider 추가 시 `isRefreshCapable` 과 `run()` 내부 분기를 모두 수정해야 하므로 수정 지점이 2곳으로 분리되어 있다. 현재 규모에서는 허용 범위이나, 주석이 "향후 여기에 추가" 라고 안내하므로 확장 시 누락 위험이 존재한다.
  - 제안: `CAFE24_ENQUEUE_CAPABLE = new Set(['cafe24'])` 같은 상수를 도입하거나 `isCafe24EnqueueCapable(integration)` 술어를 추가하면 `run()` 내부의 `serviceType === 'cafe24'` 분기 의도를 명시적으로 표현할 수 있다.

- **[INFO]** `claimThreshold` 의 `if (!claimed) continue` 위치가 리팩터링 이후 더 명확해짐
  - 위치: `run()` 메서드, refresh-capable early-continue 이후 claim 호출 부분
  - 상세: 리팩터링 결과 refresh-capable 경로는 claim 을 전혀 호출하지 않고 continue 하며, refresh_token-less 경로만 claim 을 거친다. 흐름이 명확하고 의도 주석도 충분하다. 추가 조치 불필요.

---

### 파일 3: integration-status-reason.ts

- **[INFO]** `token_expired` 인라인 주석이 한 줄에 너무 많은 내용을 담고 있음
  - 위치: `'token_expired'` 추가 라인
  - 상세: `// refresh_token 없는 provider 의 token_expires_at 만료 → status=expired (connected-expiry 0d). spec/2-navigation/4-integration.md §11.2` 는 기존 다른 항목 주석(`// 401/403 / refresh_token 무효 → status=error`)과 일관된 형식을 따르고 있으나 spec 참조가 포함되어 줄이 다소 길다. 치명적 문제는 아니며 기존 패턴과의 일관성 측면에서 허용 범위다.
  - 제안: spec 참조는 파일 상단 JSDoc 또는 별도 줄 주석으로 이동하는 것을 고려할 수 있으나, 필수는 아님.

---

### 파일 4: system-status.constants.spec.ts (신규)

- **[INFO]** 테스트 파일 구조 및 네이밍은 기존 패턴과 일관성 있음
  - 위치: 전체
  - 상세: `describe` 블록 네이밍, `it` 설명, `expect` 스타일 모두 기존 테스트 코드베이스 패턴을 따르고 있다. 3개 케이스가 단일 `describe` 에 응집되어 있고 각각 명확한 목적을 가진다.

---

### 파일 5: system-status.constants.ts

- **[INFO]** `MAKESHOP_REFRESH_QUEUE` 추가 위치가 기존 목록 내 논리적 그룹(integration) 에 cafe24 바로 다음으로 배치되어 일관성 있음
  - 위치: `MONITORED_QUEUES` 배열 내 `cafe24-token-refresh` 바로 다음
  - 상세: 추가 방식이 간결하고 기존 패턴을 정확히 따른다. 별도 조치 불필요.

---

### 파일 6: system-status.e2e-spec.ts

- **[INFO]** 큐 개수가 테스트 설명과 배열에 각각 하드코딩되어 있음
  - 위치: `it('인증 시 14개 큐의 집계 상태를 반환한다', ...)` 와 `EXPECTED_QUEUE_NAMES` 배열
  - 상세: 주석에도 명시되어 있듯이 e2e 테스트는 상수를 import 하지 않으므로 `EXPECTED_QUEUE_NAMES.length` 를 테스트 명에서 하드코딩 숫자(14)로 반복하는 것은 큐 추가 시 테스트 명도 직접 수정해야 한다는 의미다. 현재 코드베이스 패턴을 그대로 따르는 것이므로 기존 제약 내에서 허용 범위다.
  - 제안: `it(\`인증 시 ${EXPECTED_QUEUE_NAMES.length}개 큐의 집계 상태를 반환한다\`, ...)` 로 변경하면 배열 수정만으로 테스트 명도 자동 갱신된다.

---

### 파일 7: plan/in-progress/integration-expiry-fixes.md

- 유지보수성 관점에서 코드 파일이 아니므로 주요 평가 항목 해당 없음. 체크리스트 형식이 명확하고 커밋 해시 등 추적 정보가 충실하다.

---

### 파일 8 ~ 10: spec 문서들

- spec 문서는 코드 유지보수성 평가 범위 외. 의사코드 블록의 가독성이 기존 패턴과 일치하며 변경 의도가 명확하다.

---

## 요약

이번 변경의 핵심은 `isCafe24RefreshCapable` 을 `isRefreshCapable` 로 일반화하여 makeshop 을 refresh-capable 경로에 포함시키고, `token_expired` status reason 을 추가하며, passive 알림 억제 로직을 반영한 테스트를 추가·수정한 것이다. 서비스 코드(`integration-expiry-scanner.service.ts`) 자체는 함수 분리가 적절하고 의도 주석이 충분하며 순환 복잡도도 낮아 유지보수성이 양호하다. 가장 두드러진 약점은 spec 파일의 테스트 코드에서 "알림 부재 검증"과 "save 된 항목 중 expired 여부 검증" 패턴이 3곳에 걸쳐 복사·붙여넣기되어 있다는 점으로, 헬퍼 함수 추출로 해소하면 향후 provider 추가 시 테스트 수정 비용이 크게 줄어든다. `system-status.e2e-spec.ts` 의 큐 개수 하드코딩은 경미한 개선 여지이며, 나머지 변경들은 기존 코드베이스 스타일·패턴을 잘 준수하고 있다.

## 위험도

LOW

---

STATUS: SUCCESS
