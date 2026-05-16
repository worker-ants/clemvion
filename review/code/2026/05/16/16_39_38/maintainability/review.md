# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `buildFakeCafe24Integration` — `mallId` 기본값 결정 로직이 두 단계로 분리되어 의도 파악이 약간 어렵다
  - 위치: `integration-oauth.service.cafe24.spec.ts` L61-64
  - 상세: `mallId` 는 `overrides.mallId === undefined ? 'priv-shop' : overrides.mallId` 로 계산되고, `credentialsMallId` 는 `overrides.credentialsMallId ?? mallId ?? 'priv-shop'` 로 다시 계산된다. `mallId` 가 `null` 일 때 `credentialsMallId` 의 fallback 이 `'priv-shop'` 이 되는 경로를 이해하려면 두 줄을 동시에 읽어야 한다. JSDoc 에 "legacy row" 설명이 있어 의도는 전달되지만, 중간 변수 `credentialsMallId` 의 도출 규칙을 JSDoc 에도 한 줄 더 명시하면 신규 기여자의 이해 비용이 낮아진다.
  - 제안: JSDoc 에 `credentialsMallId` 결정 우선순위(`overrides.credentialsMallId` → `mallId` → `'priv-shop'`)를 한 줄 인라인 설명으로 추가.

- **[INFO]** `buildFakeCafe24Integration` — 조건부 필드 추가 패턴이 `if` 블록 세 개로 반복된다
  - 위치: `integration-oauth.service.cafe24.spec.ts` L70-74
  - 상세: `clientId`, `clientSecret`, `scopes` 각각이 `if (overrides.X !== undefined) credentials.Y = overrides.X;` 패턴으로 나열된다. 현재 세 개 수준은 읽기에 큰 부담이 없으나, 향후 필드가 추가될 경우 boilerplate 가 늘어난다. 일관성 측면에서도 다른 필드들은 `??` 연산자로 처리되는 반면 이 세 필드만 명령형 `if` 로 처리된다.
  - 제안: `Object.entries({ client_id: overrides.clientId, client_secret: overrides.clientSecret, scopes: overrides.scopes }).filter(([, v]) => v !== undefined).forEach(([k, v]) => { credentials[k] = v; });` 로 단일화하거나, 현 수준이 충분하다면 그대로 유지해도 무방.

- **[INFO]** `page.tsx` — `aborted` 플래그와 `AbortController` 가 같은 역할을 이중으로 담당한다
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` L2813, L2832-2834
  - 상세: `aborted` 로컬 변수는 React state setter 호출 방지용이고, `controller.abort()` 는 네트워크 레이어 cancel 용이다. 두 메커니즘이 모두 필요한 것은 맞지만, `aborted` 를 `controller.signal.aborted` 로 대체할 수 있어 중복을 줄일 수 있다. `catch` 블록에서 `AbortError` 를 명시적으로 구분하지 않고 `!aborted` 로 처리하는 점도 같은 이중성에서 비롯된다.
  - 제안: `if (!aborted)` 가드를 `if (!controller.signal.aborted)` 로 교체하면 `aborted` 변수 선언 자체를 제거할 수 있다. 혹은 현 방식을 유지하되 `AbortError` 를 명시적으로 구분하는 주석을 추가(`// controller.signal.aborted === true 이면 err 는 DOMException('AbortError')`).

- **[INFO]** `integrations.controller.ts` — `@ApiOperation.description` 이 매우 길어 diff 가독성이 저하된다
  - 위치: `integrations.controller.ts` L370-371 (변경된 description 문자열)
  - 상세: Swagger description 에 라우트 순서 안전망 문구, spec 링크, 비고 등이 한 문자열에 모두 포함되어 400자 이상이 된다. 컨트롤러 코드에 이미 L590-595 에 동일 내용의 주석이 있어 중복이다. 나쁜 것은 아니지만(Swagger UI 에서 보이는 용도와 코드 주석은 독자가 다름), 두 곳을 동기화해야 한다는 부담이 남는다.
  - 제안: Swagger description 에는 기능 설명과 spec 링크만 유지하고, 라우트 순서 경고는 코드 주석(L590-595)에만 두는 방식으로 분리. 현재처럼 Swagger에도 노출하는 것은 API 소비자에게 유용한 정보일 수 있으므로 현 상태 유지도 합리적 선택.

- **[INFO]** `integrations.service.ts` — 트랜잭션 미적용 의도 주석이 두 위치에 동일하게 존재한다
  - 위치: `integrations.service.ts` L1307-1316 (전체 컨텍스트 기준)
  - 상세: diff 에서 추가된 주석 블록이 `create` 메서드의 `try` 블록 바로 위에 위치한다. 해당 주석의 근거(3가지 이유)는 명확하고 유용하지만, `update`·`rotate` 등 동일한 패턴(`save` + `auditLogsService.record`)을 사용하는 다른 메서드들에는 이 설명이 없다. 신규 기여자가 `create` 에만 주석이 있음을 보고 "다른 메서드는 다른 의도인가?"라고 혼동할 수 있다.
  - 제안: 주석을 클래스 수준 또는 private 섹션 상단에 한 번 두고("이 서비스의 save+audit 패턴은 의도적으로 트랜잭션 미적용 — 이유: ..."), 각 메서드에서 단순 참조 주석으로 대체. 또는 현행 위치를 유지하고 `update`·`rotate` 에도 짧은 참조 주석 추가.

- **[INFO]** `getActivity` — 매직 리터럴 `24 * 60 * 60 * 1000` 이 인라인으로 존재한다
  - 위치: `integrations.service.ts` L1484
  - 상세: `effectiveDays * 24 * 60 * 60 * 1000` 은 "일 → 밀리초 변환"이다. 같은 파일의 다른 곳(`findAll` 의 `EXPIRING_SOON_INTERVAL`)은 SQL 상수로 분리되어 있는 반면 이 변환식은 인라인이다.
  - 제안: `const MS_PER_DAY = 24 * 60 * 60 * 1000;` 을 파일 상단 상수로 추출하거나 최소한 `/* ms/day */` 주석 추가.

- **[INFO]** `cafe24-precheck.test.tsx` — `vi.advanceTimersByTime(360)` 이 모든 테스트에서 반복된다
  - 위치: `cafe24-precheck.test.tsx` 다수 테스트 케이스
  - 상세: debounce 만료 패턴 `await act(async () => { vi.advanceTimersByTime(360); });` 이 10회 이상 반복된다. `360` 이라는 숫자는 debounce 350ms + 여유 10ms 의 의미이나, 코드만 보면 즉시 알기 어렵다.
  - 제안: `const DEBOUNCE_MS = 350; const DEBOUNCE_ADVANCE = DEBOUNCE_MS + 10;` 를 테스트 파일 상단 상수로 추출하고 반복 패턴을 헬퍼 함수로 래핑.  
    ```ts
    const advanceDebounce = () =>
      act(async () => { vi.advanceTimersByTime(DEBOUNCE_ADVANCE); });
    ```

- **[INFO]** `page.tsx` `validate()` 함수 내 영문 에러 메시지 하드코딩
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` L3067-3084
  - 상세: Cafe24 필드 검증 에러 메시지 (`"Mall ID must be 3-50 lowercase letters..."`, `"Cafe24 app type must be 'public' or 'private'."` 등)가 i18n `t()` 함수를 거치지 않고 영문 리터럴로 하드코딩되어 있다. 다른 검증 메시지들(`t("integrations.nameRequired")` 등)은 모두 i18n 키를 사용하는 반면 Cafe24 전용 분기만 예외다.
  - 제안: i18n 키를 추가하거나, 최소한 `// TODO: i18n` 주석을 달아 의도적 예외인지 누락인지 명확히.

### 요약

이번 변경은 테스트 mock factory(`buildFakeCafe24Integration`) 추출, Swagger description 보강, 트랜잭션 의도 주석 명시, AbortController 도입 등 기존 ai-review 지적 사항을 충실히 이행한 점진적 리팩토링이다. 전반적으로 코드 가독성과 중복 제거 방향이 올바르며 유지보수성이 향상되었다. 발견된 사항은 모두 INFO 수준으로, 치명적 설계 문제나 심각한 중복 패턴은 없다. 주요 개선 기회는 (1) AbortController 도입 후 남은 이중 플래그(`aborted` + `controller.signal`) 정리, (2) 테스트 파일의 `360ms` 매직 넘버 상수화, (3) `validate()` 내 일부 i18n 미적용 에러 메시지 정합화이다. 이 중 어느 것도 기능 결함이나 회귀 위험을 수반하지 않는다.

### 위험도

NONE
