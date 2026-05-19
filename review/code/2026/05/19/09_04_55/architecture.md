# 아키텍처(Architecture) 리뷰

## 발견사항

### 파일 3: codebase/frontend/src/lib/api/auth.ts — LoginResponseData discriminated union 해체

- **[WARNING]** 개방-폐쇄 원칙(OCP) / 추상화 수준 저하 — named interface + type guard 제거로 인라인 union 대체
  - 위치: `auth.ts` diff — `AccessTokenResponse` / `TwoFactorChallengeResponse` interface 제거, `isTwoFactorChallenge` / `isAccessTokenResponse` 헬퍼 함수 제거
  - 상세: 변경 전 코드는 ① 두 개의 named interface (`AccessTokenResponse`, `TwoFactorChallengeResponse`), ② discriminated union (`LoginResponseData`), ③ type guard 함수 두 개라는 3-레이어 추상화로 타입 분기 책임을 한 곳에 캡슐화했다. 변경 후에는 union member 가 익명 object literal 로 대체되어 소비처(login-form.tsx)가 직접 `"requires2fa" in payload && payload.requires2fa` 패턴을 인라인으로 작성해야 한다. 소비처가 여러 곳으로 늘어날 경우 동일한 타입 분기 로직이 복수의 컴포넌트에 중복된다. 타입 가드 함수는 단일 책임(SRP)—"이 payload 가 2FA challenge 인가?"라는 판별 로직—을 외부에서 재사용 가능한 형태로 격리한 것이었으므로, 이를 제거하면 그 책임이 소비처 곳곳으로 분산된다.
  - 제안: `AccessTokenResponse` / `TwoFactorChallengeResponse` named interface 와 `isTwoFactorChallenge` / `isAccessTokenResponse` 타입 가드를 복원하거나, 최소한 타입 가드 함수만이라도 `auth.ts` 에 유지한다. 만약 인라인 union 이 의도된 단순화라면, 소비처에서 반복되는 narrowing 패턴을 util 함수로 추출해 중복을 방지해야 한다.

---

### 파일 1: codebase/frontend/src/components/auth/login-form.tsx — 소비처 직접 narrowing

- **[WARNING]** 레이어 책임 혼재 — 프레젠테이션 컴포넌트 내 타입 분기 로직 인라인화
  - 위치: `login-form.tsx` diff L44–58
  - 상세: 변경 전에는 `isTwoFactorChallenge(payload)` 타입 가드를 호출하는 한 줄로 로직 의도가 명확했다. 변경 후에는 컴포넌트 내부에서 `payload && "requires2fa" in payload && payload.requires2fa` 를 직접 평가하고, `payload && "accessToken" in payload ? payload.accessToken : undefined` 라는 이중 방어 코드를 작성한다. 이것은 API 계층이 책임져야 할 타입 판별 로직을 UI 컴포넌트 안으로 끌어들인 것이다. 프레젠테이션 레이어의 응집도(cohesion)가 낮아지고, API 응답 shape 이 바뀌면 컴포넌트를 직접 수정해야 하므로 결합도(coupling)가 높아졌다.
  - 제안: `lib/api/auth.ts` 에 타입 가드 또는 narrowing 헬퍼를 두고, 컴포넌트는 헬퍼만 호출하도록 레이어 책임을 복원한다.

---

### 파일 1 + 파일 3 조합: `isTwoFactorChallenge` 삭제 + 소비처 인라인화 — 잠재적 안전망 제거

- **[WARNING]** 방어적 코딩(defensive programming) 관점 — 옵셔널 체이닝 우회 경로 무보장
  - 위치: `login-form.tsx` L54–58
  - 상세: 변경 전에는 discriminated union 덕분에 `isTwoFactorChallenge(payload)` 가 false 인 분기에서 TypeScript 가 `payload` 를 `AccessTokenResponse` 로 narrowing하고 `payload.accessToken` 접근이 컴파일 시점에 안전하게 보장되었다. 변경 후에는 `payload && "accessToken" in payload ? payload.accessToken : undefined` 로 런타임 가드를 추가했으나, `accessToken` 이 없는 경우(2FA challenge 경로) `completeLogin` 이 호출되지 않아 사용자가 로그인에 실패하면서도 아무런 에러 피드백이 없는 silent failure 가 발생할 수 있다. 이 흐름이 의도된 것인지 불분명하다.
  - 제안: `else if (!accessToken)` 분기에서 명시적 에러 처리(에러 메시지 노출 또는 throw)를 추가하거나, discriminated union + 타입 가드를 통해 exhaustive check 를 컴파일 시점에 보장한다.

---

### 파일 2: codebase/frontend/src/components/editor/settings-panel/node-configs/shared/button-list-editor.tsx — maxButtons default 값 변경

- **[INFO]** 모듈 경계 / 추상화 수준 — frontend-backend SSOT 불일치 구조 부분 해소, 단 공유 상수 부재
  - 위치: `button-list-editor.tsx` diff L94 (`maxButtons = 10` → `maxButtons = 5`)
  - 상세: `maxButtons = 5` default 변경 자체는 바람직한 방향이며 JSDoc 에 `MAX_BUTTONS_PER_NODE` 와의 연관을 명시한 점도 긍정적이다. 그러나 현재 구조에서 frontend 의 `maxButtons = 5` 와 backend 의 `MAX_BUTTONS_PER_NODE = 5` 는 동일한 정책 상수를 두 코드베이스에서 각각 리터럴로 유지한다. `packages/` 공유 라이브러리로 추출하지 않는 한, 향후 cap 이 다시 바뀔 때 두 곳을 동시에 갱신해야 하는 구조적 취약점이 남는다. consistency-check W-5 가 같은 지점을 지적한 바 있다.
  - 제안: 즉각적 조치는 아니지만 후속 PR 에서 `packages/` 에 공유 상수 모듈을 두고 frontend/backend 가 `file:../packages/*` 로 참조하는 구조를 고려한다. 단기적으로는 현재 JSDoc 참조가 최소한의 문서화를 제공하므로 수용 가능하다.

---

### 파일 4: plan/in-progress/2fa-webauthn-followups.md — 항목 9 후퇴 (완료 → 미완료 재분류)

- **[INFO]** 아키텍처 결정 역추적 — 타입 가드 / DTO 분리 완료 항목이 미완료로 되돌아간 맥락
  - 위치: plan diff §9 — `[x]` 완료 상태였던 "클라이언트 타입 가드 추가, `login-form.tsx` 가 헬퍼 사용" 항목이 `[ ]` 로 복원됨
  - 상세: 위에서 지적한 `auth.ts` 타입 가드 제거 및 `login-form.tsx` 인라인화는 plan §9 의 이전 완료 기록을 취소하는 방향으로 회귀한 것과 일치한다. 아키텍처 관점에서는 completed 상태였던 discriminated union 설계가 이번 PR 에서 부분적으로 해체되고 있으며, plan 에서도 이를 다시 TODO 로 복원하고 있다. 이는 설계 결정의 일관성이 PR 간에 유지되지 않음을 보여준다.
  - 제안: 타입 가드 패턴을 다시 도입할 계획이라면 (plan §9 가 암시), 이번 PR 에서 제거를 동시에 진행하는 것이 아키텍처 일관성 측면에서 적절하지 않다. 타입 가드 제거와 재도입을 동일 PR 에서 하거나, 이번 PR 에서는 삭제를 보류하고 plan §9 완료 이후 정리하는 것이 더 안전하다.

---

### 전체: `buttonDefSchema` 4벌 중복 (기존 코드)

- **[INFO]** DRY 원칙 위반 / 모듈 경계 취약 — 기존 구조 문제, 본 PR 미해결
  - 위치: `carousel.schema.ts:8`, `table.schema.ts:8`, `template.schema.ts:8`, `chart.schema.ts:8` — 각각 동일한 `buttonDefSchema` 정의를 module-scoped 로 중복 선언
  - 상세: `_shared/button.types.ts` 에 `ButtonDef` interface 와 `validateButtons` 가 이미 공유되어 있음에도, Zod schema(`buttonDefSchema`) 는 각 파일에서 개별 정의한다. 본 PR 이 `MAX_BUTTONS_PER_NODE` 상수를 `_shared` 에 추가하며 중앙화를 일부 진전시켰으나, schema 자체의 중복은 해소되지 않았다. naming_collision checker 도 같은 문제를 INFO 로 기록했다.
  - 제안: 후속 PR 에서 `buttonDefSchema` 를 `_shared/button.types.ts` 또는 `_shared/button.schema.ts` 로 통합하고 4개 schema 파일이 import 해 사용하도록 DRY 원칙을 적용한다.

---

### 파일 4: plan/in-progress/2fa-webauthn-followups.md — §8 AuthModule 분리 미완

- **[INFO]** 모듈 경계 미확정 — `AuthModule` ↔ `WebAuthnModule` 양방향 의존성 잔존 위험
  - 위치: plan diff §8
  - 상세: `WebAuthnService` 와 `AuthService` 간 양방향 호출 제거가 아직 미완이다. 양방향 의존성은 순환 의존성(circular dependency)의 전조이며, NestJS 에서는 circular provider injection 으로 인한 런타임 오류로 현실화될 수 있다. 현재 본 PR 의 직접 범위는 아니나, plan 에 기록된 상태이므로 우선순위를 높여 처리하는 것이 좋다.
  - 제안: `AuthModule` 이 `WebAuthnModule` 을 import 하는 단방향 구조를 확립하고, `WebAuthnService` 에서 `AuthService` 를 직접 호출하는 부분이 있다면 이벤트 또는 callback 인터페이스로 의존성 방향을 역전(DIP)한다.

---

## 요약

이번 PR 의 아키텍처 관점 핵심 문제는 `lib/api/auth.ts` 에서 named interface + discriminated union + type guard 3-레이어를 제거하고 익명 object literal union 으로 대체한 점이다. 이 변경은 타입 분기 책임을 API 계층에서 UI 컴포넌트로 분산시키고, TypeScript 의 exhaustive narrowing 보장을 약화시키며, 소비처 증가 시 로직 중복을 유발하는 구조적 후퇴다. plan §9("클라이언트 타입 가드 패턴 정리")가 이 문제를 다시 TODO 로 재등록한 것 자체가 본 PR 의 변경이 미완성임을 시사한다. `button-list-editor.tsx` 의 `maxButtons = 5` default 변경은 올바른 방향이나 frontend-backend 상수 SSOT 구조(공유 패키지 추출)는 후속 과제로 남아있다. `buttonDefSchema` 4벌 중복과 `AuthModule` ↔ `WebAuthnModule` 양방향 의존 미해소는 본 PR scope 외 기존 문제지만, 아키텍처 부채로 누적되고 있어 후속 PR 에서 우선 처리가 권장된다.

## 위험도

MEDIUM
