# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 파일 1: `codebase/frontend/src/lib/api/auth.ts`

- **[CRITICAL]** `isTwoFactorChallenge` / `isAccessTokenResponse` 공개 함수 삭제 — 기존 사용자 파괴
  - 위치: `auth.ts` diff — `export function isTwoFactorChallenge`, `export function isAccessTokenResponse` 전체 제거
  - 상세: 두 함수는 `export` 키워드로 공개된 API였다. `login-form.tsx` 내부 사용은 이번 diff 에서 인라인 guard 로 대체됐지만, 코드베이스의 다른 파일(테스트, 다른 컴포넌트, 외부 소비자)이 이 함수를 직접 import 하고 있을 경우 컴파일 에러 또는 런타임 참조 오류가 발생한다. 특히 `2fa-webauthn-followups.md` plan 항목 9 ("클라이언트 타입 가드 패턴 정리") 가 현재 `[ ]` 미완료 상태로 남아 있어, 이 삭제가 의도된 확정 제거인지 임시 조치인지 불명확하다.
  - 제안: 제거 전 `grep -r "isTwoFactorChallenge\|isAccessTokenResponse"` 로 모든 import 사용처를 확인하고, 타입 가드 패턴 정리(plan §9) 와 함께 atomic 하게 처리할 것. 현재 plan §9 가 미완이므로 삭제가 조기 적용된 것으로 보인다.

- **[WARNING]** `AccessTokenResponse` / `TwoFactorChallengeResponse` named interface 삭제 — 타입 시그니처 변경
  - 위치: `auth.ts` diff — 두 interface 제거, `LoginResponseData` 가 anonymous inline union 으로 대체
  - 상세: 기존에 named interface `AccessTokenResponse`, `TwoFactorChallengeResponse` 를 import 하는 소비자가 있으면 타입 에러가 발생한다. `LoginResponseData` 타입의 공개 형태도 discriminated union 에서 anonymous union 으로 변경되어, 패턴 매칭을 명시적 타입 가드에 의존하던 코드가 타입 추론 실패를 겪을 수 있다.
  - 제안: named interface 를 삭제하는 대신 `export type AccessTokenResponse = { accessToken: string }` 형태로 alias 를 유지하여 기존 import 호환성을 보장하거나, 모든 사용처를 일괄 갱신 후 삭제.

- **[INFO]** 주석 중 Swagger `oneOf` 언급 삭제 — 외부 문서 계약 변경 아님
  - 위치: `auth.ts` diff — `* Swagger 측은 oneOf: [AccessTokenDto, LoginChallengeDto] 로 분리 표기 (백엔드 §9 follow-up).` 줄 제거
  - 상세: 주석 삭제 자체는 런타임 부작용이 없다. 그러나 해당 주석이 Swagger 스키마 follow-up 을 추적하는 역할을 하고 있었고, 삭제 후 `2fa-webauthn-followups.md` plan §9 에서도 Swagger `oneOf` 가 `[ ]` 미완이다. 추적 맥락이 사라진다.
  - 제안: 삭제보다는 plan §9 링크 참조로 대체하거나, 해당 JSDoc 에 plan §9 를 명시.

---

### 파일 2: `codebase/frontend/src/components/auth/login-form.tsx`

- **[WARNING]** `completeLogin` 미호출 경로 신설 — 로그인 완료 상태 변경 누락 가능
  - 위치: diff L54–L58 — `payload && "accessToken" in payload ? payload.accessToken : undefined` 분기 + `if (accessToken)` guard
  - 상세: 변경 전 코드는 `isTwoFactorChallenge` 분기를 통과한 모든 경우에 `completeLogin(payload.accessToken)` 을 호출하도록 보장했다. 변경 후 `payload` 가 존재하지 않거나 `accessToken` 키가 없는 경우 `completeLogin` 이 **조용히 호출되지 않는다**. 이 경우 인증 스토어(`useAuthStore`), access token 쿠키/로컬스토리지, 라우팅 상태 등이 갱신되지 않아 사용자는 로그인에 성공했음에도 인증되지 않은 상태가 될 수 있다.
  - 제안: `accessToken` 이 undefined 인 경우를 예외(에러 표시 또는 로그)로 처리. 예: `if (!accessToken) { setError(t("auth.login.genericFailed")); return; }` 를 guard 에 추가.

- **[INFO]** `isTwoFactorChallenge` import 제거 → 인라인 타입 narrowing 으로 대체
  - 위치: diff L36, L45
  - 상세: 기능적으로 동일하나 (같은 조건 `"requires2fa" in payload && payload.requires2fa`), 인라인 guard 는 타입스크립트 narrowing 이 덜 명시적이다. `payload` 가 이미 `LoginResponseData` 타입이어야 하는데 `payload &&` 널 가드가 추가된 것은 응답 타입이 `undefined` 를 포함할 수 있다는 암묵적 가정으로, 타입 정의와 실제 사용 간 불일치를 나타낸다.
  - 제안: 응답 타입 자체를 `LoginResponseData | undefined` 로 명시하거나, 타입 가드 함수를 유지하여 타입 안전성을 확보.

---

### 파일 3: `codebase/frontend/src/components/editor/settings-panel/node-configs/shared/button-list-editor.tsx`

- **[WARNING]** `maxButtons` prop default 값 하향 (10 → 5) — 기존 묵시적 default 의존 호출자 행동 변경
  - 위치: diff L94–L95 — `maxButtons = 10` → `maxButtons = 5`
  - 상세: prop 시그니처 자체는 변경되지 않았으나, `maxButtons` 를 명시적으로 전달하지 않는 기존 모든 호출처(`button-list-widget.tsx`, `presentation-configs.tsx` 등)는 자동으로 cap 이 10에서 5로 낮아진다. 이는 이미 5개 이상의 버튼을 설정해 저장한 기존 사용자 데이터를 UI 에서 편집할 때 "6번째 버튼 추가" 버튼이 비활성화되거나 초과분이 잘릴 수 있는 부작용을 낳는다. 런타임 에러는 아니지만 사용자에게 보이는 UI 상태가 바뀐다.
  - 제안: `naming_collision.md` 의 제안대로 `maxButtons={10}` 을 명시적으로 넘기는 호출처가 있는지 확인하고, 의도치 않게 구 cap 을 우회하지 않도록 일괄 갱신. 또한 이미 5개 초과로 저장된 레거시 데이터에 대한 UI 동작(readonly 표시 등)을 명시적으로 처리할 것.

---

### 파일 4: `plan/in-progress/2fa-webauthn-followups.md`

- **[WARNING]** 항목 9·10을 `[x]` 완료에서 `[ ]` 미완료로 되돌림 — plan 상태 역행으로 선행 완료된 코드 변경의 보호막 제거
  - 위치: diff L299–L317 — 항목 9("완료"), 항목 10("의도적 미실행 + 컨벤션 보강으로 종결") 를 미완료 체크박스로 교체
  - 상세: 항목 9는 `AccessTokenResponse` / `TwoFactorChallengeResponse` interface 와 타입 가드 추가가 이미 완료(`[x]`)로 기록되어 있었다. 그런데 본 PR 의 `auth.ts` 변경이 해당 interface 와 타입 가드를 **삭제**하면서 plan 항목도 다시 `[ ]` 로 되돌렸다. 이는 기존에 완료된 구현을 취소(regression)한 것이며, 관련된 소비자 코드의 보호가 해제된 상태에서 plan 만 미완료로 재표기된 형태다. 항목 10도 "컨벤션 보강으로 종결"이라는 결론을 폐기하고 `[ ]` 로 되돌렸으나, 해당 컨벤션 보강(`migrations/README.md §1`) 자체가 취소된 것인지 불명확하다.
  - 제안: plan 항목을 되돌리기 전에 해당 구현 변경의 의도(타입 가드 삭제가 완전한 개선인지 임시 중간 상태인지)를 명확히 기록하고, 삭제된 구현이 다른 소비자에 영향을 주지 않는지 먼저 확인할 것.

- **[INFO]** 항목 10의 `(열린 follow-up)` 항목 삭제 — `login_history 1M row 도달 모니터링` 추적 소실
  - 위치: diff L315 — `- [ ] (열린 follow-up) login_history 1M row 도달 모니터링 — 도달 시 다음 CHECK 변경부터 NOT VALID 2-step 의무화` 제거
  - 상세: 미완 항목이 삭제되어 추적이 사라졌다. 새 `[ ]` 항목으로 대체됐으나 모니터링 조건이 다르다.
  - 제안: 기존 follow-up 항목을 삭제하지 말고 조건부 주석으로 유지하거나, 별도 plan 으로 분리하여 추적 단절을 방지.

---

### 파일 5–6: plan 문서 변경 (`button-cap-spec-validator.md`, `presentation-button-render-investigation.md`)

- **[INFO]** plan 문서 자체는 코드 부작용 없음 — 추적 문서 변경으로 런타임 영향 없음
  - 위치: 전체 두 파일
  - 상세: plan·investigation 문서 변경은 부작용 관점에서 직접적인 런타임·상태·API 영향이 없다. 다만 `worktree` frontmatter 변경(`node-config-required-defaults-sweep` → `button-cap-spec-validator`)이 consistency-checker 의 `plan_coherence` 검사에 영향을 줄 수 있으며, 이는 이미 consistency-check 에서 확인된 사안이다.

---

### 파일 7–16: review/consistency 산출물 및 `_retry_state.json`

- **[INFO]** review 산출물 파일은 코드 부작용 없음
  - 위치: `review/consistency/2026/05/19/08_44_42/`, `review/consistency/2026/05/19/08_55_14/`
  - 상세: `_retry_state.json` 은 orchestrator 가 sub-agent 재시도 상태를 추적하기 위해 생성하는 파일이다. 이 파일의 신규 생성은 review 워크플로 내 의도된 파일시스템 부작용이며, worktree 범위 내에 한정된다. `agents_pending` 에 모든 checker 가 있는 초기 상태로 기록되어 있으나 이는 orchestrator 초기화 시점의 스냅샷이다.

---

## 요약

이번 변경에서 가장 주목할 부작용은 두 가지다. 첫째, `auth.ts` 에서 `isTwoFactorChallenge` / `isAccessTokenResponse` 두 공개 함수와 named interface 를 삭제하여 기존 코드베이스의 타입 참조가 파괴될 수 있으며, 관련 plan (`2fa-webauthn-followups.md` §9) 이 아직 `[ ]` 미완이어서 삭제가 조기 적용되었을 가능성이 있다. 둘째, `login-form.tsx` 에서 `completeLogin` 호출이 조건부로 변경되어 `accessToken` 이 없거나 `payload` 가 예상치 못한 형태일 경우 인증 완료 상태 갱신이 **조용히 누락**되는 경로가 생겼다. `button-list-editor.tsx` 의 default cap 하향(10→5)은 의도된 변경이나, 명시적 `maxButtons={10}` 을 전달하는 기존 호출처가 있으면 old cap 을 우회하게 되어 별도 확인이 필요하다. plan 문서 변경에서 `2fa-webauthn-followups.md` 의 항목 9·10 을 완료에서 미완료로 되돌린 것은 선행 구현의 취소(regression)와 연결되어 있어 다른 소비자에 대한 영향 검토가 선행되어야 한다.

## 위험도

**HIGH**
