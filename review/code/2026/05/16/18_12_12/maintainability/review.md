# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

### 파일 1: `backend/src/modules/integrations/integrations.service.spec.ts`

- **[INFO]** 테스트 파일 내 `vi.advanceTimersByTime(360)` 매직 넘버 잔존
  - 위치: `use-cafe24-mall-id-precheck.test.tsx` 내 3곳 (라인 3147, 3176, 3214, 3338, 3352)
  - 상세: `cafe24-precheck.test.tsx` 에서는 `DEBOUNCE_ADVANCE_MS = 360` 상수 + `advanceDebounce()` 헬퍼로 INFO 12 조치가 완료됐지만, `use-cafe24-mall-id-precheck.test.tsx` (파일 8)에서는 동일한 `360` 이 인라인 숫자 리터럴로 5회 반복된다. 두 테스트 파일이 동일한 매직 넘버를 각자 관리하므로 debounce 값이 변경될 경우 양쪽을 동시에 수정해야 하는 위험이 남아 있다.
  - 제안: `use-cafe24-mall-id-precheck.test.tsx` 에도 같은 `DEBOUNCE_ADVANCE_MS = 360` 상수를 정의하거나, 두 테스트 파일이 공유할 수 있는 `testUtils.ts` 에 상수를 이동해 단일 관리 지점을 만든다.

- **[INFO]** 테스트 케이스 이름에 외부 리뷰 ID 참조 포함
  - 위치: `integrations.service.spec.ts` 라인 50 — `'returns integration even when audit log record throws internally (best-effort audit)'` 케이스 상단 주석에 `ai-review INFO 10` 참조
  - 상세: 주석에 리뷰 세션 ID(`ai-review INFO 10 — 2026-05-16`)가 직접 기술되어 있다. 이 자체는 의도적 traceability 이며 프로젝트 컨벤션과 일치하나, 시간이 지나면 해당 리뷰 문서를 추적하지 않는 개발자에게 맥락 없는 숫자로 읽힐 수 있다.
  - 제안: 현재 수준은 허용 가능하나, 향후 review 세션 경로도 함께 기재(`review/code/2026/05/16/...`)하면 추적성이 더 명확해진다.

---

### 파일 2: `backend/src/modules/integrations/integrations.service.ts`

- **[WARNING]** `create()` 메서드 내 설명적 블록 주석의 과도한 분량
  - 위치: 라인 526~537 (diff 기준), 전체 파일 컨텍스트 기준 `// 트랜잭션 미적용 의도` 블록
  - 상세: 트랜잭션 미적용 결정 + best-effort audit 의도를 설명하는 인라인 주석이 12줄에 달한다. 주석 자체는 ADR 역할을 하고 있으나, `create()` 함수 길이(약 70줄)를 체감상 더 길게 만들고 코드 흐름을 파악하기 어렵게 한다. 프로젝트 규약상 설계 결정의 근거는 `spec/` 의 Rationale 섹션에 두도록 되어 있다.
  - 제안: 인라인 주석은 "트랜잭션 미적용 의도 — spec/2-navigation/4-integration.md Rationale §W23 참고" 한 줄로 줄이고, 상세 근거를 spec Rationale 섹션으로 이관한다.

- **[INFO]** `create()` 내 두 개의 중첩 try/catch 블록 구조
  - 위치: 라인 538~143(diff), `saved` 저장 블록과 audit 블록 각각
  - 상세: 두 try/catch 블록이 연속으로 위치하며 각각의 역할(save 실패 → 고유 제약 검사, audit 실패 → warn 로그)이 다르다. 현재 구조는 의도적이고 주석으로 설명되어 있으나, `create()` 메서드가 이미 OAuth 토큰 소비·자격증명 검증·entity 생성 등 다양한 책임을 지고 있어 총 복잡도가 높은 편이다.
  - 제안: 즉각 수정이 필요한 수준은 아니지만, audit 기록 로직을 `recordAuditSafe(saved, ...)` 같은 private 메서드로 추출하면 `create()` 의 주 흐름이 단순해지고 나중에 audit 전략이 변경될 때의 수정 범위가 줄어든다.

---

### 파일 3: `frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx`

- **[INFO]** `vi.advanceTimersByTime(500)` 인라인 리터럴 잔존 (패턴 위반 케이스)
  - 위치: 라인 893~896 — `'패턴 위반 mall_id 는 precheck 호출 skip'` 케이스
  - 상세: `DEBOUNCE_ADVANCE_MS` + `advanceDebounce()` 로 INFO 12 를 조치했으나, 패턴 위반 케이스에서 debounce 가 실행되지 않음을 검증하는 부분에는 `500` 이라는 다른 숫자 리터럴이 그대로 남아 있다. 이 값은 "debounce 보다 길게 기다려도 호출 없음"을 표현하므로 의미는 다르지만, 테스트 파일 내 숫자 리터럴 관리 정책과 일관성이 없다.
  - 제안: `DEBOUNCE_ADVANCE_MS * 2` 또는 `PATTERN_SKIP_WAIT_MS = 500` 상수를 정의해 의미를 명시한다.

- **[INFO]** `advanceDebounce()` 헬퍼와 `DEBOUNCE_ADVANCE_MS` 상수 위치가 파일 전체 컨텍스트 기준 `describe` 블록 앞에 위치함
  - 위치: 라인 799~811 (전체 파일 컨텍스트)
  - 상세: `createWrapper()` → `renderPage()` → `DEBOUNCE_ADVANCE_MS` → `advanceDebounce()` → `describe` 순서로 모듈 레벨 선언이 나열되어 있어 최상위 유틸리티 공간이 늘어나고 있다. 현재는 작은 파일이라 문제가 없지만, 테스트 유틸리티가 누적될 경우 파일 구조가 복잡해질 수 있다.
  - 제안: 현 수준은 양호. 향후 유틸 증가 시 별도 `test-utils.ts` 로 분리 검토.

---

### 파일 4: `frontend/src/app/(main)/integrations/new/page.tsx`

- **[WARNING]** `NewIntegrationPage` 컴포넌트의 과도한 책임 범위
  - 위치: 전체 `NewIntegrationPage()` 함수 (라인 1301~1756)
  - 상세: 이번 변경으로 precheck 로직이 `useCafe24MallIdPrecheck` 훅으로 분리(W9)되어 개선됐지만, `NewIntegrationPage` 는 여전히 다음을 직접 보유한다: (1) OAuth 팝업 라이프사이클, (2) 팝업 닫힘 감지 폴링 루프, (3) 페이지 이탈 경고, (4) 크리에이트 뮤테이션, (5) OAuth Begin 뮤테이션, (6) validate() 로직, (7) Cafe24 private pending 상태. `useEffect` 블록이 5개, `useRef` 가 4개, 뮤테이션이 2개로 순환 복잡도가 높다.
  - 제안: 즉각 수정 필요 수준은 아니나, `useOAuthPopup()` 훅(팝업 라이프사이클 + 팝업 닫힘 폴링 + 타임아웃)으로 추출하면 `NewIntegrationPage` 의 state 보유량이 절반 이하로 줄어든다.

- **[INFO]** `validate()` 내 Cafe24 분기의 정규식 중복
  - 위치: 라인 1591 — `!/^[a-z0-9-]{3,50}$/.test(mallId)`
  - 상세: 동일 정규식이 `useCafe24MallIdPrecheck.ts` 에는 `CAFE24_MALL_ID_PATTERN` 상수로 정의되어 있지만, `page.tsx` 의 `validate()` 에는 인라인 리터럴로 남아 있다. 패턴이 바뀔 때 두 곳을 동시에 수정해야 한다.
  - 제안: `CAFE24_MALL_ID_PATTERN` 을 `use-cafe24-mall-id-precheck.ts` 에서 export하고 `validate()` 에서 import해 단일 진실 지점을 유지한다. 또는 shared constants 모듈에 위치시킨다.

- **[INFO]** `oauthBeginMutation.mutationFn` 내 `cafe24Extra` 객체 구성 로직
  - 위치: 라인 1434~1448
  - 상세: `serviceType === "cafe24"` 분기 내 조건부 스프레드(`credentials.app_type === "private"` 인 경우에만 `clientId`/`clientSecret` 추가)가 중첩되어 있다. 로직 자체는 올바르나, 이 함수 안에서 Cafe24 전용 payload 조립 책임을 직접 가지고 있어 다른 서비스 유형이 추가되면 유사한 분기가 늘어난다.
  - 제안: `buildCafe24OAuthExtra(credentials)` 같은 순수 함수로 추출해 `mutationFn` 의 길이를 줄이고 단위 테스트를 용이하게 한다.

---

### 파일 5: `frontend/src/lib/api/integration-error-codes.ts`

- **[INFO]** `getIntegrationErrorI18nKey` 의 `Object.prototype.hasOwnProperty.call` 사용
  - 위치: 라인 2495 (전체 컨텍스트)
  - 상세: `INTEGRATION_ERROR_CODE_TO_I18N` 은 `Readonly<Record<...>>` 로 타입이 고정되어 있고 prototype 오염 가능성이 없는 컴파일 타임 상수다. `hasOwnProperty.call` 은 방어적으로 정확하지만 과도하게 verbose하다. `errorCode in INTEGRATION_ERROR_CODE_TO_I18N` 또는 단순 `INTEGRATION_ERROR_CODE_TO_I18N[errorCode as ...]` 후 nullish 체크가 더 가독성이 높다.
  - 제안: `if (errorCode in INTEGRATION_ERROR_CODE_TO_I18N)` 로 교체한다. 타입 캐스트와 함께 사용 시 TypeScript 가 타입 narrowing 을 올바르게 처리한다.

- **[INFO]** `INTEGRATION_LOCALIZED_ERROR_CODES` 와 `INTEGRATION_ERROR_CODE_TO_I18N` 두 구조체 간 역할 경계
  - 위치: 파일 전체
  - 상세: `INTEGRATION_LOCALIZED_ERROR_CODES` 는 의미 기반 alias → backend 코드 문자열 매핑, `INTEGRATION_ERROR_CODE_TO_I18N` 은 backend 코드 문자열 → i18n 키 매핑이다. 현재 항목이 하나뿐이라 중복처럼 보이지만 설계 의도는 명확하며, 항목이 늘어날수록 각 구조의 역할이 뚜렷해진다. 주석도 충분히 설명하고 있어 이 자체는 양호.
  - 제안: 현 구조 유지. 향후 항목 추가 시 두 객체를 동시에 갱신해야 한다는 점을 주석에 명시적으로 강조("두 항목 동시 추가 필수")하면 실수 방지에 도움이 된다.

---

### 파일 6 & 7: `frontend/src/lib/i18n/dict/en/integrations.ts`, `ko/integrations.ts`

- **[INFO]** i18n 키 명명 패턴 혼재 — `cafe24Validate*` vs 기존 패턴
  - 위치: `cafe24ValidateMallIdPattern`, `cafe24ValidateAppType`, `cafe24ValidatePrivateClientIdRequired`, `cafe24ValidatePrivateClientSecretRequired`
  - 상세: 이번에 추가된 키들은 `cafe24Validate` prefix 를 사용한다. 기존 유효성 관련 키(`nameRequired`, `selectAtLeastOneScope`, `fieldRequired` 등)는 범용 prefix를 쓰는 반면, Cafe24 전용 항목은 `cafe24` prefix를 붙이는 패턴으로 구분되어 있다. 이 자체는 기존 `cafe24DuplicateMall*` 패턴과 일관성이 있어 양호하다.
  - 제안: 현 패턴 유지.

- **[INFO]** en 사전에 `cafe24ValidateMallIdPattern` 값이 중복 정의
  - 위치: `en/integrations.ts` 라인 2577~2578 (diff)와 라인 2805~2806 (전체 파일 컨텍스트)
  - 상세: diff 에는 추가 항목 4개가 표시되고, 전체 파일 컨텍스트 마지막 부분에도 동일 키가 다시 나타난다. 이는 diff 표시 방식의 중복이며 실제 파일에 이중 정의가 있는 것은 아니다. 확인 필요.
  - 제안: 실제 파일에서 중복 키 여부를 확인한다 (TypeScript 는 객체 리터럴 중복 키를 오류로 처리하므로 빌드 시 탐지된다).

---

### 파일 8: `frontend/src/lib/integrations/__tests__/use-cafe24-mall-id-precheck.test.tsx`

- **[INFO]** 훅 테스트에서 `vi.advanceTimersByTime(360)` 인라인 리터럴 5회 반복 (파일 1 발견사항과 동일)
  - 위치: 라인 3147, 3176, 3213, 3337, 3352
  - 상세: 파일 1 발견사항 참조. `cafe24-precheck.test.tsx` 와 달리 이 파일은 `DEBOUNCE_ADVANCE_MS` 상수를 정의하지 않아 INFO 12 조치가 절반만 적용된 상태다.
  - 제안: 파일 상단에 `const DEBOUNCE_ADVANCE_MS = 360;` 를 선언하거나, `cafe24-precheck.test.tsx` 의 상수를 공유한다.

---

### 파일 9: `frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts`

- **[INFO]** `!enabled` 와 `!CAFE24_MALL_ID_PATTERN.test(mallId)` 두 early-return 분기에서 `setConflict(null); setLoading(false);` 코드 중복
  - 위치: 라인 3420~3428 (전체 파일 컨텍스트)
  - 상세: 두 조건 모두 동일한 상태 초기화를 수행한다. 현재는 2회 반복이라 크게 문제되지 않으나, 초기화 항목이 늘어나면 동기화가 번거로워진다.
  - 제안: `resetState()` 내부 함수나 로컬 헬퍼로 추출한다. 또는 두 조건을 하나로 합친다: `if (!enabled || !CAFE24_MALL_ID_PATTERN.test(mallId)) { setConflict(null); setLoading(false); return; }`.

- **[INFO]** `setTimeout` 변수명 `t` — 단순하지만 불명확
  - 위치: 라인 3433 `const t = setTimeout(...)`
  - 상세: `t` 는 관용적으로 타이머 ID를 의미하는 약어이나, `debounceTimer` 또는 `timer` 처럼 의도를 더 명확하게 나타낼 수 있다. 훅 내 다른 변수들(`controller`, `signal`, `conflict`, `loading`)이 명확한 이름을 사용하고 있어 불일치가 있다.
  - 제안: `const debounceTimer = setTimeout(...)` 으로 변경한다.

---

## 요약

이번 변경 세트는 전반적으로 유지보수성 측면에서 긍정적인 방향으로 진행됐다. `useCafe24MallIdPrecheck` 훅 추출(W9)로 `page.tsx` 의 precheck 관련 책임이 적절히 분리됐고, `integration-error-codes.ts` 신설(W11)로 에러 코드 관리가 중앙화됐으며, `DEBOUNCE_ADVANCE_MS` 상수 + `advanceDebounce()` 헬퍼(INFO 12)로 테스트 코드의 매직 넘버가 크게 줄었다. 다만 동일한 `360` 매직 넘버가 `use-cafe24-mall-id-precheck.test.tsx` 에는 상수로 추출되지 않아 INFO 12 조치가 일관되게 적용되지 않았고, `page.tsx` 의 mall_id 정규식이 훅과 중복 관리되는 문제가 남아 있다. `create()` 메서드의 과도한 인라인 주석(설계 근거가 spec Rationale이 아닌 코드에 남아있음)은 프로젝트 규약과 경미하게 어긋난다. `NewIntegrationPage` 컴포넌트의 전체 책임 범위는 여전히 넓지만, 이는 이번 변경의 범위 외로 별도 작업이 필요하다.

## 위험도

LOW
