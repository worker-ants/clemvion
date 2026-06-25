# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** 파일 분할로 단일 책임 원칙 개선
  - 위치: `new/page.tsx` 전체
  - 상세: 1444줄 god-file 을 448줄로 줄이고 8개 단위를 별도 파일로 분리. AuthStep·TestStep·Cafe24PrivatePendingStep·MakeshopPendingStep 컴포넌트, useOauthPopupReturn·useUnsavedChangesWarning 훅이 각자 단일 책임을 갖게 됨. SRP 개선이 명확하다.
  - 제안: 이 방향을 유지.

- **[WARNING]** `AuthStep` props 인터페이스 비대 — 조합 분리 불완전
  - 위치: `new/_components/auth-step.tsx` L83-105 (`AuthStepProps` 인터페이스, 실질 21개 prop)
  - 상세: `AuthStep` 은 21개 props 를 받는다(service, variant, variantIndex, setVariantIndex, name, setName, scope, setScope, credentials, setCredentials, selectedScopes, setSelectedScopes, previewToken, oauthWaiting, oauthError, cafe24Conflict, cafe24PrecheckLoading, onConnect, connecting, onContinue, t). 이름 입력·스코프 선택·variant 탭·OAuth 버튼·credentials 폼·Cafe24/Makeshop 특수 필드 등 다수의 책임이 한 컴포넌트에 집계돼 있다. ISP 관점에서 소비자가 필요하지 않은 prop 까지 묶여 있고, `credentials: Record<string, unknown>` 타입 소거로 서비스별 credential 구조가 컴포넌트 경계에서 불투명해진다.
  - 제안: 향후 단계에서 폼 상태를 `useAuthFormState` 훅으로 합산하거나 AuthStep 을 CredentialSection / OAuthSection / ScopeSection 으로 분해해 props 수를 줄이는 것을 권장. 현 PR 이 behavior-preserving 추출이므로 즉각 강제는 불필요하나 후속 이슈로 등록 권장.

- **[WARNING]** `Cafe24ExtraFields`·`MakeshopExtraFields` 가 `service.type` 분기로 직접 처리 — OCP 위반 잠재
  - 위치: `new/_components/auth-step.tsx` L214-229 (AuthStep 내 provider 분기)
  - 상세: AuthStep 이 `service.type === "cafe24"` / `"makeshop"` 조건 분기로 공급자별 ExtraFields 를 직접 렌더한다. 새로운 공급자가 추가될 때마다 AuthStep 내부의 분기가 증가한다. 이는 개방-폐쇄 원칙(OCP) 위반이다. 공급자별 ExtraFields 는 파일 내 private 함수로 캡슐화돼 있어 외부 노출은 막혀 있으나, 확장 지점이 설계에 부재하다.
  - 제안: 공급자별 ExtraFields 를 `extraFieldsRegistry[serviceType]` 맵 또는 `extraFieldsComponent` prop 으로 주입받아 AuthStep 이 공급자 구체 사항을 모르도록 분리. 현재 공급자가 2개뿐이므로 3번째 공급자 추가 시 적용 고려.

- **[WARNING]** `useOauthPopupReturn` 이 i18n(`TFunction`)·toast UI 부수효과를 직접 처리 — 레이어 책임 위반
  - 위치: `lib/integrations/use-oauth-popup-return.ts` L3 import, L391-416 (message handler), L462-484 (startPopup)
  - 상세: `lib/integrations/` 레이어에 속하는 훅이 UI 부수효과인 `toast.error()`·`toast.success()`·`toast.message()`·i18n 번역 문자열 생성을 직접 수행한다. 비즈니스/오케스트레이션 레이어는 상태기계와 이벤트 방출만 담당하고, UI 레이어(컴포넌트·page)가 번역·알림을 처리하는 것이 레이어 책임 분리 원칙에 부합한다. 또한 mount-only effect(`[]`)에서 `t`·`onAuthorized` 가 deps 에서 제외돼 `eslint-disable` 이 2곳에 사용되고 있으며, `t` 가 변경될 경우 메시지가 stale 해질 수 있다.
  - 제안: (a) 훅이 토스트 대신 `onError(msg)`·`onSuccess()` 콜백 파라미터만 노출하고 번역·알림을 호출자에게 위임. (b) 최소한 `onAuthorized`·`t` 를 `useRef` 로 감싸 stale 방지 및 `eslint-disable` 제거.

- **[WARNING]** `Cafe24PrivatePendingStep`·`MakeshopPendingStep` 구조적 중복 — DRY 위반
  - 위치: `new/_components/cafe24-private-pending-step.tsx` 143줄 전체 및 `new/_components/makeshop-pending-step.tsx` 141줄 전체
  - 상세: 두 파일은 구조가 98% 동일하다(URL 복사 UI, 폴링 상태 표시, 에러/대기/타임아웃 분기, 버튼). 차이점은 i18n 키 prefix, 훅 이름(`useCafe24PendingPolling`/`useMakeshopPendingPolling`), 타이틀 텍스트뿐이다. `MakeshopPendingStep` 주석에도 "mirror of `Cafe24PrivatePendingStep`" 라고 명시돼 있다. 세 번째 공급자 추가 시 중복이 더 악화된다.
  - 제안: 공통 `PendingInstallStep` 컴포넌트를 추출하고, i18n-key prefix 와 폴링 훅을 prop 으로 주입. 현 PR 이 behavior-preserving 추출임을 감안해 후속 PR 로 권장.

- **[INFO]** `TestStep` 이 `integrationsApi` 를 직접 호출 — 컴포넌트-API 직접 결합
  - 위치: `new/_components/test-step.tsx` L1294 import, L1331-1346 `useQuery`
  - 상세: TestStep 컴포넌트가 `integrationsApi.previewTest` 를 직접 호출한다. 기존 패턴을 따른 것이고 React Query 가 캐싱/에러 계층 역할을 하므로 실용적 허용 범위 내이나, 컴포넌트 단위 테스트 시 API 모킹 부담이 있다.
  - 제안: `usePreviewTest(serviceType, authType, credentials, skipProbe)` 훅으로 분리하면 재사용성·테스트 용이성이 향상된다. 필수는 아니나 권장.

- **[INFO]** `onConnect` 콜백과 `validate()` 함수에 검증 로직 중복 잔존
  - 위치: `new/page.tsx` — `onConnect` 내 인라인 검증 블록과 `validate()` 함수 양쪽
  - 상세: `selectedScopes.length === 0` 체크, makeshop `client_id`/`client_secret` 체크가 두 곳에 중복돼 있다. 단일 진실 원칙 위반으로 한쪽 수정 시 다른 쪽이 누락될 수 있다. 이번 PR 의 추출 범위 밖 기존 문제이나 명시.
  - 제안: `onConnect` 내 검증을 `validate()` 로 통합하거나, 공통 `validateForOAuthBegin()` 함수로 분리.

- **[INFO]** 라우트-로컬 배치 및 의존성 방향 적절
  - 위치: `new/_components/` 디렉토리 전체
  - 상세: `components→app` 역방향 의존을 방지하고 `../_shared` 정방향 의존을 유지한 배치 결정이 올바르다. 모듈 경계가 명확하다.
  - 제안: 유지.

- **[INFO]** `useUnsavedChangesWarning` 추상화 수준 적절
  - 위치: `lib/hooks/use-unsaved-changes-warning.ts`
  - 상세: 단일 `active: boolean` 파라미터, 의존성 최소화, 반환값 없음. 재사용성과 테스트 용이성 모두 높다.
  - 제안: 해당 없음.

## 요약

이번 PR 은 1444줄 god-file 을 behavior-preserving 분할로 7개 파일에 분산한 리팩토링으로, SRP 개선과 의존 방향 유지라는 아키텍처 목표를 성공적으로 달성했다. 주요 우려사항은 세 가지다: (1) `AuthStep` 이 21개 props 를 받는 집계 컴포넌트로 남아 있어 향후 공급자 추가 시 OCP 위반이 누적될 수 있고, (2) `Cafe24PrivatePendingStep`·`MakeshopPendingStep` 의 98% 구조 중복이 다음 공급자 추가 시 더 악화될 것이며, (3) `useOauthPopupReturn` 이 `lib/integrations/` 레이어임에도 UI 부수효과(i18n 번역, toast 호출)를 직접 처리해 레이어 책임 경계가 불명확하다. 세 항목 모두 후속 PR 로 해결 가능한 수준이며, behavior-preserving 성격의 현 PR 을 즉각 차단할 사유는 없다.

## 위험도

LOW
