### 발견사항

- **[INFO]** `expirePendingInstalls`의 TTL 계산이 인라인으로 풀어쓰임
  - 위치: `integration-expiry-scanner.service.ts:92` — `PENDING_INSTALL_TTL_HOURS * 60 * 60 * 1000`
  - 상세: `DAY_MS` 상수가 같은 파일 내에 이미 존재함에도 별도 계산식을 사용. `PENDING_INSTALL_TTL_HOURS * 60 * 60 * 1000` 대신 `PENDING_INSTALL_TTL_HOURS * DAY_MS / 24`가 더 일관적이거나, 아예 `PENDING_INSTALL_TTL_MS`로 미리 계산해 두는 편이 낫다.
  - 제안: `const cutoff = new Date(now.getTime() - PENDING_INSTALL_TTL_HOURS * DAY_MS / 24);` 또는 상수 `PENDING_INSTALL_TTL_MS = PENDING_INSTALL_TTL_HOURS * DAY_MS / 24`

- **[INFO]** `isReauthorizeDisabled`의 조건 우선순위가 Cafe24 Private 전체를 먼저 잡으면 더 단순해짐
  - 위치: `status-badge.tsx:77-92`
  - 상세: 현재 `pending_install` → `expired+install_timeout` → `cafe24+private` 순서로 확인. 그런데 Cafe24 Private은 `pending_install`이든 `expired`든 어차피 `true`를 반환하므로, Cafe24 Private 검사를 먼저 두면 아래 두 조건을 흡수할 수 있다. 단, "모든 provider의 `pending_install`은 비활성"이라는 cross-provider 규칙이 실제로 의도된 것이라면 현재 순서가 맞다.
  - 제안: 의도가 "Cafe24 Private은 항상" + "다른 provider도 pending_install은 항상"이라면 현재 구조가 정확하므로 주석으로 두 규칙을 명시적으로 구분.

- **[INFO]** `expirePendingInstalls` 테스트에서 `IntegrationExpiryScannerService` 인스턴스를 두 번 중복 생성
  - 위치: `integration-expiry-scanner.service.spec.ts:218-270`
  - 상세: 두 `it` 블록 각각에서 `new IntegrationExpiryScannerService(...)` 7-인자 생성자를 반복 호출. `describe` 안에 `beforeEach`+공유 인스턴스를 두는 기존 `run` 테스트 패턴(`describe('...run')` 블록 참조)을 따르지 않아 일관성이 깨진다.
  - 제안: `describe` 블록에 `beforeEach`로 `scanner`와 `integrationRepo`를 셋업하고 두 `it`에서 공유.

- **[INFO]** `samMall` 오타
  - 위치: `integration-oauth.service.ts:771` — `const samMall = existing.filter(...)`
  - 상세: `samMall`은 `sameMall`의 오타로 보임. 작은 실수이지만 코드베이스 전체에 일관된 영어를 사용하는 컨벤션 기준에서 혼란을 줄 수 있다.
  - 제안: `sameMall`로 교정.

- **[INFO]** `handleInstall`의 빈 토큰 가드가 중복
  - 위치: `integration-oauth.service.ts:857-862`
  - 상세: `if (!installToken || installToken.length === 0)` 가드가 있지만, NestJS `@Param()` 데코레이터는 라우트 매칭 단계에서 이미 빈 segment를 걸러낸다(`/cafe24/` 경로 자체가 매칭 안 됨). 해당 분기는 런타임에 도달 불가.
  - 제안: 가드 제거. 단, `handleInstall`이 내부에서 직접 호출될 수 있다면 유지 가능하나 그 경우 타입을 `string`이 아닌 non-empty string 타입으로 표현하는 것이 낫다.

- **[INFO]** `Cafe24PrivatePendingStep` 내부 `lastErrorMessage` 파생 로직이 `pickErrorMessage`와 중복
  - 위치: `new/page.tsx:822-826`
  - 상세: `(poll.lastError as { message?: string } | null)?.message ?? poll.statusReason ?? null` 는 `status-badge.tsx`의 `pickErrorMessage`와 동일한 로직. 두 곳에 흩어져 있으면 에러 메시지 우선순위 규칙이 바뀔 때 양쪽을 함께 수정해야 한다.
  - 제안: `pickErrorMessage`를 `integrations.ts` API 레이어나 공유 유틸로 이동해 재사용.

- **[INFO]** 폴링 상수가 컴포넌트 파일 내에 인라인 선언됨
  - 위치: `new/page.tsx:749-750` — `PRIVATE_PENDING_POLL_MS`, `PRIVATE_PENDING_TIMEOUT_MS`
  - 상세: 현재 위치(컴포넌트 파일 중간)에 선언되어 있어 파일 최상단이나 상수 모듈에서 찾기 어렵다. `ERROR_CLOSE_DELAY_MS`를 모듈 최상단에 export한 패턴(`oauth-callback.template.ts`)과 불일치.
  - 제안: 파일 최상단 또는 별도 상수 파일로 이동.

---

### 요약

전반적으로 이번 변경은 명확한 의도와 spec 참조를 갖춘 잘 구조화된 코드다. 매직 넘버 대부분은 상수로 추출되었고, 각 함수의 책임이 단일하게 유지되며, 테스트 커버리지도 행복/실패 경로를 고루 다룬다. 유지보수 관점에서 주목할 실질적 약점은 `samMall` 오타, `pickErrorMessage` 로직 중복(FE), 테스트 인스턴스 생성 패턴 불일치 정도로, 모두 INFO 수준이다. `isNaN`-가드 이후 도달 불가 분기와 TTL 계산 방식의 미세한 불일치는 향후 상수 값이 변경될 때 혼선을 일으킬 수 있으므로 다음 PR에서 정리하면 충분하다.

### 위험도

**LOW**