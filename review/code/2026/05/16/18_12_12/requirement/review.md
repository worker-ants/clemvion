# 요구사항(Requirement) 코드 리뷰

## 발견사항

### 파일 1: integrations.service.spec.ts — audit fail 회귀 테스트

- **[INFO]** 테스트 전제가 실제 구현과 한 단계 어긋남
  - 위치: 라인 54-56 (`auditLogsService.record = jest.fn().mockRejectedValueOnce(...)`)
  - 상세: 테스트 의도는 "record()가 내부 try/catch를 통과하지 못하고 throw할 때"를 시뮬레이션하는 것이다. 그런데 이 mock은 `record()`가 reject하도록 직접 설정한다. 실제 `AuditLogsService.record`는 내부에서 swallow하므로 이 시나리오는 "내부 swallow가 제거된 미래 회귀 상황"을 모델링한다. 주석(라인 47-53)이 이를 명확히 설명하고 있어 의도와 구현의 불일치는 없으나, 테스트가 현재 코드의 외부 방어선(outer try/catch)을 검증한다는 점을 명확히 알 수 있다.
  - 제안: 테스트 설명에 "outer try/catch in create()"를 검증한다는 문구를 추가하면 독자 혼동이 줄어든다.

- **[INFO]** `PublicIntegration` 타입 단언 사용
  - 위치: 라인 76 (`expect((result as PublicIntegration).name).toBe(...)`)
  - 상세: `result`가 `Error`가 아닌 경우를 단언하는 방식으로 타입 단언을 사용한다. `result instanceof Error` 체크 이후 `.name` 프로퍼티에 직접 접근하는 것이 더 안전하다. 현재 코드는 타입 단언으로 인해 compile-time 타입 안전성이 약화된다.
  - 제안: `if (result instanceof Error) throw result; expect(result.name).toBe(...)` 패턴 또는 `expect(result).toMatchObject({ name: 'My API (audit fail)' })`를 사용하는 것이 더 명확하다.

---

### 파일 2: integrations.service.ts — create() best-effort audit

- **[WARNING]** `saved` 변수의 definite assignment 신뢰성
  - 위치: 라인 114 (`let saved: Integration;`) 및 라인 127-143
  - 상세: `saved`는 첫 번째 try/catch 블록에서 반드시 할당되거나 throw가 발생한다. 두 번째 try 블록(audit log)에서 `saved.id`를 참조할 때 TypeScript는 `saved`가 할당되지 않을 수 있다고 경고할 수 있다. `strictPropertyInitialization` 설정에 따라 다르지만, 런타임에는 문제가 없다. TypeScript `!` non-null assertion이나 초기화 구문(`let saved!: Integration`)을 사용하면 lint 경고를 방지하고 의도를 명확히 할 수 있다.
  - 제안: `let saved!: Integration;`으로 선언해 TypeScript에 "이 변수는 사용 전에 반드시 할당됨"을 알린다.

- **[INFO]** update()/rotateCredentials() 등 다른 mutating 메서드에서는 audit 실패가 여전히 user-visible 500을 반환할 수 있음
  - 위치: integrations.service.ts 전체 (diff에서 확인되지 않는 다른 메서드들)
  - 상세: `create()`에 best-effort audit 방어선을 추가했으나, `update()`, `rotateCredentials()` 등 다른 상태 변경 메서드들이 동일한 패턴을 가지고 있다면 일관성이 깨진다. 본 PR 범위 외이나, 정책 일관성 관점에서 언급할 필요가 있다.
  - 제안: 팀 정책으로 "모든 audit log 호출은 best-effort"를 확정하고, 다른 메서드에도 동일 패턴 적용 여부를 follow-up 이슈로 등록한다.

- **[INFO]** 트랜잭션 미적용 정당화 주석의 포인트 3 설명이 다소 혼란
  - 위치: 라인 108-113 (주석 내 `V045 UNIQUE race loser` 언급)
  - 상세: "UNIQUE race loser가 토큰을 재사용해도 보안상 위험"이라는 문구가 불완전하다. "재사용해도 보안상 위험이 없음" 또는 "의도적으로 재사용을 차단함"으로 분리해서 읽히지 않아 처음 읽는 개발자는 혼란을 느낄 수 있다.
  - 제안: "...race loser가 토큰을 재사용 시도해도 보안상 위험하지 않도록 의도적으로 재사용이 차단됨"과 같이 문장을 명확히 정리한다.

---

### 파일 3: cafe24-precheck.test.tsx — debounce 상수화

- **[INFO]** `DEBOUNCE_ADVANCE_MS = 360` 상수 및 `advanceDebounce()` 헬퍼가 파일 내 적용에서 한 곳은 여전히 인라인 사용
  - 위치: 라인 892-895 ("패턴 위반 mall_id 는 precheck 호출 skip" 테스트)
  - 상세: 해당 테스트에서는 `advanceDebounce()` 헬퍼를 사용하지 않고 `vi.advanceTimersByTime(500)`을 직접 호출한다. 이는 의도적인 것(500ms는 패턴 위반 시 충분히 긴 대기임을 보장)이나, 주석에 이유가 없으면 다른 팀원이 `advanceDebounce()`로 교체하려 할 수 있다.
  - 제안: 해당 라인에 `// 패턴 위반이므로 debounce값보다 큰 500ms 사용 — advanceDebounce()와 다른 의도`라는 주석을 추가한다.

- **[INFO]** 테스트 파일 최상단 `DEBOUNCE_ADVANCE_MS`와 `advanceDebounce` 정의 위치
  - 위치: 라인 583-589
  - 상세: `renderPage()` 함수 정의 이후에 `DEBOUNCE_ADVANCE_MS`와 `advanceDebounce()`가 정의되어 있다. JavaScript hoisting으로 런타임에는 문제없지만, 가독성 측면에서 `renderPage()` 정의 이전에 상수와 헬퍼를 배치하는 것이 관례적으로 더 자연스럽다.
  - 제안: `DEBOUNCE_ADVANCE_MS`와 `advanceDebounce()`를 `renderPage()` 함수 정의 위로 이동한다. (전체 파일 컨텍스트에서는 이미 그렇게 되어 있으므로 diff에서의 순서 문제만 해당)

---

### 파일 4: page.tsx — 리팩토링 및 i18n 적용

- **[INFO]** `onConnect` 콜백 내부에서 `cafe24Conflict?.conflict` 체크 시 toast 메시지가 훅의 반환값과 분리된 채 하드코딩
  - 위치: 라인 1702-1707
  - 상세: `onConnect` 핸들러에서 `cafe24Conflict?.conflict === true`일 때 `t("integrations.cafe24DuplicateMallToast")`를 직접 호출한다. 이 분기 자체는 유효하나, 이미 `getIntegrationErrorI18nKey`와 `INTEGRATION_ERROR_CODE_TO_I18N`으로 매핑 시스템을 도입했음에도 이 경로만 매핑을 우회하고 i18n 키를 직접 참조한다. 일관성 관점에서 사소한 냄새다.
  - 제안: 현재 패턴(`t("integrations.cafe24DuplicateMallToast")`)은 기능적으로 정확하며, 이 경로는 "error code 기반 매핑"이 아닌 "precheck state 기반 조기 차단"이므로 별도 경로가 맞다. 주석에 이를 명시하면 혼동 방지에 도움이 된다.

- **[INFO]** `validate()` 함수에서 scope 선택 체크와 previewToken 체크 순서
  - 위치: 라인 1609-1611
  - 상세: Cafe24 OAuth 분기에서 mall_id 패턴·appType 검증 후, 이어서 `selectedScopes.length === 0`과 `!previewToken` 체크가 나온다. 이 순서는 Cafe24가 아닌 다른 OAuth 서비스에도 동일하게 적용된다. previewToken은 OAuth 완료 후에야 생기므로, 사용자가 scopes를 선택하지 않은 채로 Connect를 누르면 scopes 오류가 먼저 뜨고 그 다음에 OAuth를 완료해야 하는 흐름이 될 수 있다. 이는 UX 관점의 문제이며 요구사항 명세에 흐름이 정의되어 있다면 별도 검토가 필요하다.
  - 제안: 현재 흐름이 spec의 의도와 일치하는지 확인한다. 일치한다면 주석으로 순서의 의도를 명확히 기록한다.

---

### 파일 5: integration-error-codes.ts — 에러 코드 매핑 모듈

- **[INFO]** `getIntegrationErrorI18nKey`에서 `Object.prototype.hasOwnProperty.call` 사용
  - 위치: 라인 2494
  - 상세: `INTEGRATION_ERROR_CODE_TO_I18N`이 `Readonly<Record<...>>` 타입이고 `as const` 객체로 생성된 것이므로, prototype chain에 오염된 프로퍼티가 존재할 가능성이 없다. `Object.prototype.hasOwnProperty.call` 방어는 지나치게 방어적이며, 단순한 `errorCode in INTEGRATION_ERROR_CODE_TO_I18N` 또는 직접 인덱싱 후 undefined 체크가 더 관용적이다. 보안상 이슈는 없으나 과잉 방어다.
  - 제안: `INTEGRATION_ERROR_CODE_TO_I18N[errorCode as IntegrationLocalizedErrorCode] ?? null` 패턴으로 단순화한다.

- **[INFO]** 코드명 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`가 public app에도 적용됨
  - 위치: 라인 2472 (주석) 및 `INTEGRATION_LOCALIZED_ERROR_CODES.CAFE24_DUPLICATE_MALL` 정의
  - 상세: 주석에 "historical artifact"로 언급되어 있고 spec Rationale에도 기록되어 있다고 한다. 이 자체는 문서화 수준의 처리로 적절하다. 다만, 향후 새 에러 코드가 추가될 때 혼동 방지를 위해 `INTEGRATION_LOCALIZED_ERROR_CODES` 객체 레벨 주석에 "backend 코드명은 그대로 사용, alias는 의미 기반"이라는 설명이 있으면 좋다.
  - 제안: 현 주석 수준으로 충분하다. 별도 조치 불필요.

---

### 파일 6-7: en/ko integrations i18n — 신규 키 4개

- **[INFO]** en 사전과 ko 사전의 키 순서 불일치 가능성
  - 위치: en/integrations.ts 라인 2576-2582, ko/integrations.ts 라인 2830-2838
  - 상세: 두 파일 모두 동일한 4개 키(`cafe24ValidateMallIdPattern`, `cafe24ValidateAppType`, `cafe24ValidatePrivateClientIdRequired`, `cafe24ValidatePrivateClientSecretRequired`)를 추가한다. 키 이름은 동일하나 ko 파일의 주석이 더 설명적이다. 이 자체는 문제가 없다.
  - 제안: 두 파일의 키 순서 및 키 이름이 완전히 일치하고 있으므로 i18n 완전성 측면에서 이슈 없음.

- **[INFO]** 신규 i18n 키 4개가 `validate()` 함수에서만 사용되고 테스트에서는 직접 검증되지 않음
  - 위치: page.tsx `validate()` 함수; cafe24-precheck.test.tsx
  - 상세: `cafe24ValidateMallIdPattern` 등 4개 i18n 키는 `validate()` 호출 시 반환되는 문자열이지만, 기존 테스트에서 이 검증 메시지가 실제로 노출되는지(예: UI에서 toast로 표시되는지)를 검증하는 케이스가 없다. Connect 버튼 클릭 시 이 경로가 동작함을 보장하는 테스트가 없는 상태다.
  - 제안: "mall_id 패턴 위반 시 validate()가 올바른 i18n 메시지 키를 반환한다"는 단위 테스트를 추가하거나, e2e 테스트에서 검증한다.

---

### 파일 8: use-cafe24-mall-id-precheck.test.tsx — 훅 단위 테스트

- **[INFO]** `loading` 초기 상태 확인 테스트 부재 (enabled=true, 유효 mallId)
  - 위치: 라인 3132-3159 ("유효 mall_id + enabled 면 350ms debounce 후 fetch" 테스트)
  - 상세: 이 테스트는 debounce 진입 직후 `loading=true`를 확인하는데, 이는 올바른 행동이다. 그러나 `loading`이 `false → true`로 즉시 바뀌는 것을 검증하는 것이고, 실제로 `setLoading(true)`가 `setTimeout` 등록 전에 호출된다. 이 상태 전환이 동기적으로 일어나는지 테스트 코드에서 `act()` 없이 바로 확인하는 것이 의도인지 명확하지 않다.
  - 제안: `expect(result.current.loading).toBe(true)`를 `act()` 블록 바깥에서 확인하는 현재 방식이 맞다면, 주석으로 "setLoading(true)는 setTimeout 등록 전 동기 호출"임을 명시한다.

- **[INFO]** abort 후 두 번째 fetch 완료 여부 검증 없음
  - 위치: 라인 3161-3183 ("mallId 변경 시 직전 in-flight fetch가 abort" 테스트)
  - 상세: 첫 fetch가 abort됨을 확인하나, 두 번째 mallId("shop-b")로의 fetch가 정상 완료되고 conflict가 업데이트되는지 검증하지 않는다. abort 후 새 fetch 결과가 반영되는지의 end-to-end 보장이 없다.
  - 제안: `rerender` 후 `advanceTimersByTime(360)`을 호출하고 `waitFor`으로 `precheckMock`이 두 번 호출되었는지 및 두 번째 결과가 반영되었는지 검증한다. (page.tsx 통합 테스트가 이를 커버한다고 볼 수 있으나, 훅 단위 테스트에서도 보장하면 더 완전하다.)

---

### 파일 9: use-cafe24-mall-id-precheck.ts — 훅 구현

- **[INFO]** `setLoading(true)`가 debounce 타이머 시작 전에 호출되는 점
  - 위치: 라인 3431 (`setLoading(true)`)
  - 상세: 사용자가 mall_id를 입력한 즉시 `loading=true`가 된다(debounce 350ms 전). 이는 "확인 중…" 스피너가 입력 즉시 나타난다는 의미다. debounce 의도(짧은 입력 흔들림 억제)를 고려하면, 타이머 fire 후 fetch 직전에 `loading=true`를 설정하는 것이 더 정확하다. 현재 구현은 사용자가 타이핑 중에도 "확인 중…"을 보게 된다.
  - 제안: `setTimeout` 콜백 내부 시작 시점에 `setLoading(true)`를 이동한다. 단, 이 변경이 UX 요구사항(스피너가 입력 즉시 나타나야 하는지, debounce 후에 나타나야 하는지)과 일치하는지 spec을 확인한다. 현재 테스트가 "debounce 진입 직후엔 loading=true"를 단언하므로 변경 시 테스트도 함께 수정해야 한다.

- **[WARNING]** `loading` 상태가 `conflict null + loading true` 구간 동안 이전 conflict 결과를 덮지 않음
  - 위치: 라인 3411 (`conflict` 초기 상태) 및 전체 effect
  - 상세: mallId가 변경되면 effect cleanup에서 이전 abort가 발생하고 새 effect가 시작된다. 새 effect 시작 시 `setLoading(true)`만 호출하고 `setConflict(null)`은 호출하지 않는다. 따라서 이전 mallId의 conflict 결과가 새 debounce가 완료될 때까지 UI에 남아 있다. 사용자가 "shop-a"에서 conflict를 확인한 뒤 "shop-b"로 변경하면, 350ms 동안 "shop-a"의 conflict 배너가 여전히 노출된다.
  - 제안: 새 effect 시작 시 `setConflict(null); setLoading(true);`를 함께 호출해 이전 결과를 즉시 클리어한다. 단, 이 동작이 의도적으로 "스테일 결과를 유지해 배너 flicker를 방지"하는 것이라면 주석으로 그 의도를 명확히 기록한다.

---

### 파일 10: plan/in-progress/cafe24-mall-dup-followup-b.md

- **[INFO]** plan 완료 조건 미달 — AI-REVIEW와 PR 항목 미완성
  - 위치: 라인 3596-3597
  - 상세: `- [ ] AI-REVIEW`와 `- [ ] PR`이 미완성으로 표시되어 있다. 이는 계획된 것이며 CLAUDE.md 정책("처리할 항목이 하나라도 남아있으면 in-progress")과 일치하므로 문제 없다. 리뷰 완료 후 PR 머지 시 plan을 complete/로 이동해야 한다.
  - 제안: 이 PR의 ai-review와 PR 완료 후 `plan/complete/`로 `git mv`한다.

---

## 요약

이번 변경은 ai-review 후속 조치 5건(W9, W11, INFO 10, INFO 12, INFO 13)을 충실히 이행하고 있다. `useCafe24MallIdPrecheck` 훅 추출, `integration-error-codes.ts` 도메인 상수 모듈 신설, audit log best-effort 방어선 이중화, debounce 상수화, validate() i18n 적용 모두 의도한 기능을 올바르게 구현했다. 주요 요구사항인 "audit 실패가 user-visible 500으로 빠지지 않아야 한다"는 `create()`의 이중 try/catch 분리로 완전히 달성됐고 회귀 테스트도 추가됐다. 지적사항 중 기능 정확성에 영향을 미치는 것은 WARNING 수준의 2건이다: (1) `saved!: Integration` 선언 누락으로 인한 TypeScript strictness 약화 — 런타임 영향 없음, (2) `useCafe24MallIdPrecheck` 훅에서 mallId 변경 시 이전 conflict 결과를 즉시 클리어하지 않아 350ms 동안 stale 배너가 노출되는 UX 이슈 — 기능적 버그는 아니나 사용자 혼란 가능성이 있다. 나머지는 모두 INFO 수준의 개선 제안이다.

## 위험도

LOW
