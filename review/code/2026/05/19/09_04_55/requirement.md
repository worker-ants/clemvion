# 요구사항(Requirement) 리뷰

## 발견사항

---

### [파일 1] codebase/frontend/src/components/auth/login-form.tsx

- **[WARNING]** `accessToken` 이 없을 때 로그인이 조용히 실패 (silent no-op)
  - 위치: diff 내 `+` 블록 — `if (accessToken) { await completeLogin(accessToken); }` 분기
  - 상세: 기존 코드는 `completeLogin(payload.accessToken)` 을 무조건 호출했지만, 변경 후 `accessToken` 이 `undefined` 이면 `completeLogin` 이 아예 호출되지 않는다. 이 경우 UI 는 아무 피드백 없이 로딩 상태를 빠져나가거나 멈춘다. 2FA 분기(`requires2fa`)에 해당하지 않는데 `accessToken` 도 없는 케이스 — 예: 서버가 예상 밖의 응답 형태를 반환하는 경우 — 에서 사용자는 로그인이 완료됐는지 실패했는지 알 수 없다.
  - 제안: `accessToken` 이 없을 때 명시적 에러를 던지거나 사용자에게 에러 메시지를 표시해야 한다. `else { throw new Error("Unexpected login response"); }` 또는 `setError(t("auth.login.genericFailed"))` 호출을 추가.

- **[WARNING]** `isTwoFactorChallenge` type guard 제거로 타입 안전성 저하
  - 위치: diff `-` 블록 — `isTwoFactorChallenge` import 제거, `auth.ts` 에서 함수 삭제
  - 상세: 기존에는 `isTwoFactorChallenge(payload)` 가 TypeScript narrowing 을 통해 `payload.challengeToken`, `payload.methods` 접근을 타입 안전하게 보장했다. 변경 후 `"requires2fa" in payload && payload.requires2fa` 인라인 검사는 동일한 narrowing 효과를 낼 수 있으나, `setChallengeToken(payload.challengeToken)` 과 `payload.methods` 접근 시 TypeScript 가 여전히 union 타입을 좁히는지 확인이 필요하다. `payload` 의 타입이 `LoginResponseData | undefined` (실제로는 `any` 혹은 unwrapped union) 라면 narrowing 이 불완전할 수 있다.
  - 제안: 인라인 타입 체크가 올바른 TypeScript narrowing 을 수행하는지 확인. 필요하다면 `isAccessTokenResponse` / `isTwoFactorChallenge` 를 인라인 type predicate 형태로 유지하거나, 변수 `payload` 의 정확한 타입을 명시.

- **[INFO]** `payload && "requires2fa" in payload` 중복 방어 검사
  - 위치: diff `+` 블록 L44
  - 상세: `payload` 가 이미 `response.data.data` 로 추출된 이후이므로, `null`/`undefined` 가능성은 서버 응답 구조에 달려 있다. 두 번의 `payload &&` 방어 코드 스타일이 일관성이 없다. 첫 번째 분기는 `payload &&` 를 붙이고 두 번째 분기도 동일하게 처리한다.
  - 제안: `payload` 의 타입을 명확히 선언하고, 방어 코드의 필요 여부를 타입 수준에서 결정.

---

### [파일 2] codebase/frontend/src/components/editor/settings-panel/node-configs/shared/button-list-editor.tsx

- **[INFO]** `maxButtons` default 값 변경(10 → 5)이 기존 consumer 에게 breaking change 가능
  - 위치: diff `+` 블록 — `maxButtons = 5`
  - 상세: `maxButtons` 를 명시적으로 전달하지 않는 consumer(`button-list-widget.tsx`, `presentation-configs.tsx` 등)는 자동으로 새 default(5) 를 적용받는다. 이전에 10개까지 버튼을 설정한 기존 데이터가 있다면, UI 에서는 추가가 막히지만 기존 데이터는 그대로 표시될 수 있다. 단순 UI cap 변경이므로 데이터 파괴는 없으나, 의도한 동작인지 명시가 필요하다.
  - 제안: JSDoc 에 기존 데이터가 5개를 초과하는 경우 UI 동작(읽기 전용 표시, 추가 버튼 비활성화 등)을 기술. consumer 중 `maxButtons={10}` 을 명시적으로 전달하는 곳이 있다면 제거 혹은 상수 참조로 전환.

- **[INFO]** consumer 에서 `maxButtons` 를 여전히 10 으로 하드코딩 전달하면 cap 우회 가능
  - 위치: `button-list-editor.tsx` L29 (default prop)
  - 상세: 일관성 검토(naming_collision.md)에서 확인됐듯이, consumer 가 `maxButtons={10}` 을 명시적으로 전달하는 경우 새 default(5)가 적용되지 않고 의도한 cap 통일이 우회된다. 현재 검토 범위에서 consumer 목록 전체를 확인하지 못했다.
  - 제안: consumer 전체를 grep 하여 `maxButtons` 를 숫자 리터럴로 전달하는 곳을 검색하고, 있으면 제거 또는 `MAX_BUTTONS_PER_NODE` 상수 참조로 교체.

---

### [파일 3] codebase/frontend/src/lib/api/auth.ts

- **[WARNING]** `LoginResponseData` type guard 및 discriminated union 구조 해체로 호출처 타입 안전성 저하
  - 위치: diff `-` 블록 — `AccessTokenResponse`, `TwoFactorChallengeResponse`, `isTwoFactorChallenge`, `isAccessTokenResponse` 삭제
  - 상세: 삭제된 exported type guard (`isTwoFactorChallenge`, `isAccessTokenResponse`) 는 `LoginResponseData` discriminated union 을 안전하게 좁히는 public API 였다. 이를 제거하면 향후 `login-form.tsx` 외의 다른 호출처가 생길 때 각자 인라인 체크를 구현해야 한다. 중복 구현이 늘어나면 분기 로직 불일치 위험이 증가한다.
  - 제안: type guard 를 삭제하는 대신, 파일 안에 유지하고 `export` 를 유지할 것. `login-form.tsx` 가 사용을 그쳤더라도 다른 소비자가 나타날 때 재작성 부담을 줄임.

- **[WARNING]** `isAccessTokenResponse` 삭제로 `accessToken` 있는 분기를 명시적으로 검증할 방법 소멸
  - 위치: diff `-` 블록 — `isAccessTokenResponse` 함수 삭제
  - 상세: `login-form.tsx` 의 새 코드는 `"accessToken" in payload` 인라인 체크로 대체했지만, 이는 `isAccessTokenResponse` 와 동일하지 않다. `AccessTokenResponse` 가 `{ accessToken: string }` 임을 보장하는 narrowing 이 더 이상 명시적으로 export 되지 않는다. 만약 `LoginResponseData` 에 두 분기 모두 `accessToken` 필드가 존재하는 서버 응답이 오면 분기가 잘못 처리될 수 있다.
  - 제안: `isAccessTokenResponse` 를 유지하거나, `LoginResponseData` 를 named interface 로 복원하여 타입 시스템이 exhaustive check 를 제공하도록 구조화.

- **[INFO]** `@deprecated` 주석 단문 축약 — 두 마이너 버전 제거 시점 삭제됨
  - 위치: diff `+` 블록 내 `requiresTotp` 필드 JSDoc
  - 상세: 기존 주석 `/** @deprecated — \`methods\` 에 'totp' 포함 시 true. 두 마이너 버전 후 제거. */` 에서 "두 마이너 버전 후 제거" 문구가 삭제됐다. `plan/in-progress/2fa-webauthn-followups.md` 항목 1이 해당 제거 조건을 추적하고 있으므로, spec 에서 제거 시점을 알 수 없게 된다.
  - 제안: 최소한 plan 링크 또는 제거 조건 한 줄을 JSDoc 에 유지.

---

### [파일 4] plan/in-progress/2fa-webauthn-followups.md

- **[CRITICAL]** 항목 9 ("LoginChallengeDto union 분리") 이 완료 표기에서 미완료로 역행 — 완료된 구현이 롤백되지 않았음에도 plan 이 미완으로 재오픈
  - 위치: diff `-` 블록 — 항목 9 `[x]` 세 항목 → `+` 블록 `[ ]` 세 항목으로 역행
  - 상세: 이전 커밋에서 `AccessTokenResponse` / `TwoFactorChallengeResponse` interface + `isTwoFactorChallenge` / `isAccessTokenResponse` 헬퍼 추가가 `[x]` 완료로 기록됐다. 본 PR 은 이 구현을 역으로 삭제(`auth.ts` diff) 하면서 plan 항목도 다시 `[ ]` 로 되돌린다. 즉 **구현 삭제 + plan 역행** 이 동시에 일어나고 있다. 이는 완료된 기능의 의도적 롤백인데, 롤백 이유가 plan 또는 코드 어디에도 명시되지 않았다.
  - 제안: 왜 구현을 롤백하는지 plan 에 명시. 롤백이 의도적이라면 "이유: …" 코멘트 추가. 롤백이 의도적이 아니라면 `auth.ts` 의 interface/type guard 삭제를 되돌려야 한다.

- **[CRITICAL]** 항목 10 ("V058 마이그레이션 NOT VALID 2-step 분리") 의 완료 결정이 역행 — 의도적 미실행으로 종결된 항목이 다시 열림
  - 위치: diff `-` 블록 — 항목 10 `[x]` 세 항목 (spec Rationale 추가, README 갱신, follow-up 분리) + `[ ]` follow-up 1건 → `+` 블록 `[ ]` 두 항목으로 대체
  - 상세: 이전 커밋에서 항목 10 은 "의도적 미실행 + 컨벤션 보강으로 종결"이었고, spec Rationale, migrations README 갱신, follow-up (1M row 모니터링) 총 3+1건이 기록됐다. 본 변경은 이를 "분리하지 않은 단일 statement" 문제로 재오픈하며, 이전에 종결 처리한 `spec/5-system/1-auth.md Rationale 1.4.G` 와 `migrations/README.md §1` 갱신을 없던 일로 만든다. 이전 spec/README 갱신도 함께 롤백됐는지 확인 필요.
  - 제안: 항목 10 재오픈 이유를 명시. 이미 갱신한 spec Rationale 와 README 갱신이 유효한지 검토 후, 유효하다면 `[x]` 항목을 유지하고 추가 항목만 `[ ]` 로 신설.

- **[WARNING]** plan 항목 역행(complete → incomplete)에 대한 변경 이력·이유 미기록
  - 위치: 항목 9, 10 전체
  - 상세: CLAUDE.md 규약에 따르면 "review 중 일부 항목이 follow-up 으로 빠지면 같은 PR 의 추가 commit 으로 plan 의 해당 항목을 `[ ]` 로 되돌린다"고 명시되어 있다. 그러나 이 경우 follow-up 분리가 아니라 완료 처리된 구현 자체를 삭제하는 롤백이 발생하고 있어, 이유 설명이 없으면 추후 검토자가 혼란에 빠진다.
  - 제안: 항목 9, 10 의 변경 사유를 인라인 코멘트 또는 plan 상단 §변경 이력 섹션에 기록.

---

### [파일 5] plan/in-progress/button-cap-spec-validator.md

- **[WARNING]** `shadow-workflow.spec.ts` 의 `maxButtonsValidator` (구 cap 10 하드코딩) 갱신이 tests 체크박스에 미포함
  - 위치: `## 작업 항목` — tests 체크박스 (`button.types.spec.ts`, `carousel.schema.spec.ts` 두 파일만 명시)
  - 상세: naming_collision.md 검토에서 `backend/src/modules/workflow-assistant/tools/shadow-workflow.spec.ts:1234` 의 `maxButtonsValidator` 클로저가 `buttons.length > 10` 과 `'Maximum 10 buttons allowed per node'` 를 하드코딩하고 있다고 확인됐다. 이 테스트는 실제 `validateButtons` (5-cap) 와 불일치한 상태로 남아 있다. plan 의 tests 체크박스에 포함되지 않아 PR 이 머지되면 테스트가 old cap 기준으로 통과·실패할 수 있다.
  - 제안: plan 의 tests 항목에 `shadow-workflow.spec.ts maxButtonsValidator` 갱신을 추가. `validateButtons` 를 직접 import 하여 사용하도록 교체하는 것이 이상적.

- **[INFO]** frontend-backend SSOT 연결 부재 — `maxButtons = 5` 와 `MAX_BUTTONS_PER_NODE = 5` 가 독립 숫자로 공존
  - 위치: plan §작업 항목 — `frontend button-list-editor.tsx` 항목
  - 상세: plan 은 `maxButtons = 10 → 5` 단순 숫자 변경으로만 기술한다. backend 의 `MAX_BUTTONS_PER_NODE` 와 frontend default 가 구조적으로 연결되지 않아, 향후 cap 이 다시 변경될 때 한쪽만 업데이트될 위험이 있다. JSDoc 에 값 출처 명시는 이미 적용(`button-list-editor.tsx` 변경 diff 에서 확인)돼 있으나, 런타임 SSOT 는 아니다.
  - 제안: `packages/` 공유 상수 추출을 follow-up plan 에 명시하거나, 현 PR 범위에서 처리할지 결정을 기록.

- **[INFO]** `presentation-button-render-investigation.md` 의 후보 B/D/E 가 미체크 상태에서 complete/ 이동 예정
  - 위치: plan §작업 항목 마지막 `git mv` 체크박스
  - 상세: plan_coherence 검토(08_55_14)에서 확인됐듯이, investigation plan 의 체크박스 B(URL 필터)·D(size cap)·E(id 중복) 이 `[ ]` 상태이고 완료 조건도 `[ ]` 두 항목이 미완이다. CLAUDE.md 규칙상 미체크 항목이 있으면 complete/ 이동 불가이므로, 이동 전에 B/D/E 를 별 follow-up plan 으로 분리하거나 scope-out 으로 명시 처리해야 한다. 현재 investigation plan 본문에 "별 follow-up" 코멘트가 있으나, 체크박스 자체는 `[ ]` 로 남아 있어 PLAN 라이프사이클 규칙 위반 위험이 있다.
  - 제안: investigation plan 의 B/D/E 항목을 `[ ]` → `[x] (별 follow-up plan 분리)` 로 전환하거나, 별 follow-up plan 파일을 신설한 뒤 investigation plan 에서 링크로 처리.

---

### [파일 6] plan/in-progress/presentation-button-render-investigation.md

- **[INFO]** Root cause 확정 선언이 investigation plan 완료 조건의 체크박스와 불일치
  - 위치: `## 본 티켓 완료 조건` — 첫 항목 `[x]` 완료, 나머지 두 항목 `[ ]` 미완
  - 상세: "root cause 가 확정됨" 은 `[x]` 처리됐으나, "fix 작업이 별도 worktree·PR 로 분리되어 머지됨"과 "본 plan 의 모든 체크박스가 `[x]`" 가 미완이다. 특히 후자는 후보 B/D/E 체크박스가 `[ ]` 로 남아 있어 자기 참조 조건 자체가 충족될 수 없다.
  - 제안: 완료 조건의 두 번째·세 번째 항목을 완료시키려면, B/D/E 를 `[x]` 로 전환(별 follow-up plan 분리 기록)하고 fix PR 머지 후 세 번째 항목을 체크해야 한다.

---

### [파일들 7–21] review/consistency/**

- **[INFO]** `_retry_state.json` 두 세션 모두 `agents_success: []` 상태로 커밋됨 — 실제 sub-agent 완료 여부와 불일치 가능
  - 위치: `08_44_42/_retry_state.json`, `08_55_14/_retry_state.json`
  - 상세: 두 파일 모두 `"agents_pending": [전체 5개 checker]`, `"agents_success": []` 로 초기화 상태 그대로 커밋됐다. 그러나 동일 세션 디렉토리에 각 checker 결과 파일(`cross_spec.md`, `plan_coherence.md` 등)이 함께 커밋돼 있다. 이는 orchestrator 가 세션 준비 시점의 _retry_state.json 을 초기 상태로 저장하고, sub-agent 완료 후 갱신하지 않았음을 시사한다.
  - 제안: _retry_state.json 이 sub-agent 완료 시점에 `agents_success` 목록을 갱신하도록 orchestrator 플로우를 확인.

---

## 요약

이번 변경의 요구사항 완전성 관점에서 가장 심각한 문제는 두 가지다. 첫째, `auth.ts` 에서 `isTwoFactorChallenge` / `isAccessTokenResponse` type guard 와 named interface 를 삭제하면서 `login-form.tsx` 에서 `accessToken` 이 없을 때 로그인이 조용히 실패(silent no-op)하는 에러 시나리오가 발생한다. 기존 코드에서는 이 경우 `completeLogin` 이 항상 호출됐으나 새 코드는 `if (accessToken)` 가드 안으로 이동시켜 대응 없이 실패를 묵살한다. 둘째, `2fa-webauthn-followups.md` 에서 이전에 완료 처리된 항목 9·10 이 이유 설명 없이 다시 미완료로 역행했으며, 이에 대응하는 `auth.ts` 의 구현 삭제와 맞물려 완료된 기능의 롤백 여부가 불명확하다. 부차적으로 `shadow-workflow.spec.ts` 의 구 cap(10) 하드코딩 테스트가 갱신 범위에서 누락됐고, `presentation-button-render-investigation.md` 의 B/D/E 후보가 미체크인 채 complete/ 이동을 예정하는 라이프사이클 규칙 위반 위험도 남아 있다. `button-list-editor.tsx` 의 cap 변경 자체(5로 통일)와 spec/backend 정합화는 의도된 요구사항을 충실히 반영하고 있어 기능 완전성 측면에서 양호하다.

## 위험도

HIGH
