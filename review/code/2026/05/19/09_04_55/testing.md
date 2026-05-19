# 테스트(Testing) 관점 코드 리뷰

## 발견사항

### 핵심 코드 변경 — 버튼 cap 통일 (button-cap-spec-validator)

- **[CRITICAL]** `shadow-workflow.spec.ts` 의 `maxButtonsValidator` 인라인 헬퍼가 구 cap(10) 을 하드코딩한 채 갱신되지 않음
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/shadow-workflow.spec.ts:1234`
  - 상세: `maxButtonsValidator` 클로저가 `buttons.length > 10` 과 `'Maximum 10 buttons allowed per node'` 를 하드코딩. 본 PR 이 cap 을 5로 통일함에 따라 이 테스트 헬퍼는 실제 production 로직(`validateButtons` — `MAX_BUTTONS_PER_NODE = 5`)과 불일치하는 경계값을 검증한다. 6~10개 버튼을 전달하면 production 에서는 rejected 되지만 이 테스트 헬퍼는 통과시켜 버린다. plan 의 tests 체크리스트에 이 파일이 포함되지 않은 것은 누락이다.
  - 제안: `maxButtonsValidator` 헬퍼를 제거하고 `_shared/button.types.ts` 의 `validateButtons` 를 직접 import 해 사용. 또는 최소한 `buttons.length > 10` 을 `buttons.length > MAX_BUTTONS_PER_NODE` 로 교체하고 에러 메시지도 동기화.

- **[WARNING]** `button.types.spec.ts` 에 경계값 6개(cap+1) 케이스가 명시적으로 포함되지 않을 수 있음
  - 위치: `codebase/backend/src/nodes/presentation/_shared/button.types.spec.ts`
  - 상세: plan 의 작업 항목에 `"should fail when more than 10" → "passes with exactly 5"` + `"should fail when more than 5"` 로 갱신한다고 명시되어 있다. "should fail when more than 5" 케이스가 실제로 6개(경계값, cap+1)를 사용하는지, 아니면 임의 초과값(예: 10개)을 사용하는지가 중요하다. `> MAX_BUTTONS_PER_NODE` 의 경계는 6개이므로, 5개는 허용·6개는 거부 를 각각 단위 테스트로 명시하는 것이 최선이다.
  - 제안: 테스트 케이스를 다음 세 가지로 구성: (1) `exactly 5` — 통과, (2) `exactly 6` — 거부 (경계값 테스트), (3) `more than 5 arbitrary (e.g., 10)` — 거부. spec 에러 표도 `≥6개` 로 정정되었으므로 테스트가 이를 반영해야 한다.

- **[WARNING]** `carousel.schema.spec.ts` 경계값 테스트의 "caps per-item buttons at 5" 케이스가 5개 입력 시 에러가 나지 않는다는 점을 명시적으로 검증하는지 불분명
  - 위치: `codebase/backend/src/nodes/presentation/carousel/carousel.schema.spec.ts`
  - 상세: plan 에 `"caps per-item buttons at 4" → "allows exactly 5"` + `"caps per-item buttons at 5"` 로 갱신한다고 명시. `validateCarouselItemButtons` 의 로직이 `buttons.length > MAX_BUTTONS_PER_NODE` (strictly greater) 라면, 5개 허용·6개 거부가 정확한 경계다. "allows exactly 5" 케이스가 5개를 전달하여 에러 없이 통과함을 검증하고, "caps per-item buttons at 5" 케이스가 6개를 전달하여 `maximum 5 buttons per item` 에러를 검증해야 한다. 4개에서 5개로만 올리는 수정이라면 6개 경계 케이스가 빠질 수 있다.
  - 제안: `validateCarouselItemButtons` 에 대해 명시적으로: 5개 입력 → 성공, 6개 입력 → `items[i]: maximum 5 buttons per item` 에러, 6개 `itemButtons` → `itemButtons: maximum 5 buttons per item` 에러 를 별도 `it()` 케이스로 분리.

- **[WARNING]** `login-form.tsx` 의 타입 가드 인라인화에 대한 단위 테스트 부재
  - 위치: `codebase/frontend/src/components/auth/login-form.tsx` lines 44-58
  - 상세: 기존 `isTwoFactorChallenge()` / `isAccessTokenResponse()` 타입 가드 함수가 제거되고, 인라인 조건식 `payload && "requires2fa" in payload && payload.requires2fa` 와 `payload && "accessToken" in payload ? payload.accessToken : undefined` 로 대체되었다. 타입 가드 함수는 독립 단위 테스트가 가능한 단순한 순수 함수였지만, 인라인화 이후 해당 분기 로직은 컴포넌트 레벨 테스트를 통해서만 커버된다. `accessToken` 이 `undefined` 인 경우(payload 가 null 이거나 `accessToken` 키가 없는 경우) `completeLogin` 이 호출되지 않는다는 점이 테스트로 검증되어 있는지 확인이 필요하다.
  - 제안: `login-form` 의 통합 테스트 또는 스토리에 (a) 정상 로그인 응답(accessToken 포함) → `completeLogin` 호출, (b) 2FA 챌린지 응답(requires2fa: true) → 챌린지 흐름 진입, (c) 비정상 payload(null/빈 객체) → `completeLogin` 미호출 시나리오를 포함.

- **[WARNING]** `isTwoFactorChallenge` / `isAccessTokenResponse` 타입 가드 함수 삭제로 인한 기존 테스트 회귀 검증 필요
  - 위치: `codebase/frontend/src/lib/api/auth.ts`
  - 상세: `auth.ts` 에서 두 타입 가드 함수와 `AccessTokenResponse` / `TwoFactorChallengeResponse` 인터페이스가 전부 제거되었다. 이 함수들을 직접 import 해 사용하는 테스트 파일이 있다면 컴파일 에러 또는 런타임 실패가 발생한다. 또한 이 함수들을 소비하는 컴포넌트/훅이 `login-form.tsx` 외에 더 있을 경우 해당 소비처의 로직이 함께 수정되었는지, 그리고 기존 테스트가 여전히 통과하는지 검증이 필요하다.
  - 제안: `isTwoFactorChallenge` / `isAccessTokenResponse` / `AccessTokenResponse` / `TwoFactorChallengeResponse` 를 import 하는 모든 파일을 grep 으로 확인하고, 영향 파일의 테스트가 PR 에 함께 갱신되었는지 확인.

- **[INFO]** frontend `button-list-editor.tsx` 의 `maxButtons = 5` default 변경에 대한 컴포넌트 테스트 부재 가능성
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/shared/button-list-editor.tsx`
  - 상세: `maxButtons` default 가 10 → 5 로 변경되었다. 이 컴포넌트의 consumer (`button-list-widget.tsx`, `presentation-configs.tsx` 등) 중 `maxButtons` 를 명시적으로 `10` 으로 전달하는 곳이 있으면 UI 상 제한이 우회된다. 컴포넌트 단위 테스트 또는 스토리에서 5개 버튼이 추가된 후 "버튼 추가" 버튼이 비활성화되는지 검증하는 케이스가 있어야 한다.
  - 제안: `button-list-editor` 테스트에 "5개 이후 추가 버튼 비활성화" 케이스 추가. consumer 파일에서 `maxButtons={10}` 을 명시 전달하는 곳이 있는지 확인하고, 있으면 제거 또는 `MAX_BUTTONS_PER_NODE` 와 연동.

- **[INFO]** `auth.ts` 에서 discriminated union 구조가 익명 인라인 타입으로 변경 — 타입 안전성 회귀 위험
  - 위치: `codebase/frontend/src/lib/api/auth.ts` lines 142-169
  - 상세: 기존 named interface(`AccessTokenResponse`, `TwoFactorChallengeResponse`) + 타입 가드 패턴에서, 이름 없는 익명 union 타입 + 인라인 `"requires2fa" in payload` 체크로 전환되었다. TypeScript 컴파일러가 제대로 narrowing 을 수행하는지는 타입 수준에서 보장되지만, 실제 API 응답이 두 union 멤버 중 어느 쪽에도 해당하지 않는 경우(예: 빈 객체 `{}`, 서버 에러 구조)에 런타임 동작이 어떻게 되는지 테스트가 없다. `payload && "accessToken" in payload ? payload.accessToken : undefined` 에서 `accessToken` 이 `undefined` 면 `completeLogin` 이 호출되지 않고 사용자에게 아무 피드백 없이 로그인 폼에 남는다.
  - 제안: 비정상 API 응답(서버가 예상치 못한 구조를 반환하는 경우)에 대한 에러 처리 테스트 추가. 최소한 `payload` 가 null / 빈 객체인 케이스에 대해 catch 블록이 아닌 정상 흐름에서 사용자 피드백 없이 조용히 실패하는 시나리오를 검증.

- **[INFO]** `buttonDefSchema` 가 4개 schema 파일에 중복 정의 — 각각에 대한 별도 테스트 중복 발생
  - 위치: `carousel.schema.ts`, `table.schema.ts`, `template.schema.ts`, `chart.schema.ts` 각각의 `buttonDefSchema`
  - 상세: `_shared/button.types.ts` 에 `ButtonDef` 인터페이스와 `validateButtons` 가 공유되어 있음에도, `buttonDefSchema` Zod 스키마는 4개 파일에 각각 독립적으로 정의되어 있다. 각 schema 의 테스트가 buttonDef 유효성 케이스를 별도로 보유하게 되어 DRY 위반이며, 한 파일에서 buttonDef 유효성 정의가 바뀌면 다른 3개의 테스트는 자동으로 반영되지 않는다.
  - 제안: 후속 PR 에서 `buttonDefSchema` 를 `_shared` 로 통합하고, buttonDef 관련 테스트 케이스를 `button.types.spec.ts` 로 집약.

### `spec/1-auth.md` Rationale 삭제 (§1.4.G)

- **[INFO]** `spec/5-system/1-auth.md` 에서 §1.4.G Rationale 섹션 삭제 — 관련 테스트 연동 확인 필요
  - 위치: `spec/5-system/1-auth.md` (파일 26)
  - 상세: V058 마이그레이션 NOT VALID 2-step 분리 관련 Rationale 섹션 전체가 삭제됐다. 이 Rationale 에 언급된 `login_history_pruner_service` 모니터링이나 `chk_login_history_event` CHECK 제약 변경 패턴에 대한 테스트가 `2fa-webauthn-followups.md` §10 의 미완 follow-up 으로 추적된다. 삭제된 Rationale 과 연관된 migration 테스트가 있다면 영향 여부를 확인해야 한다.
  - 제안: migration 테스트(`V058` 관련)가 Rationale 삭제와 무관하게 독립적으로 유효한지 확인. `2fa-webauthn-followups.md` §10 이 미완인 상태이므로 추후 V058 관련 테스트 작성 시 삭제된 Rationale 내용을 참조할 수 없음을 인지하고 필요하면 별도 기록 보존.

## 요약

이번 PR 의 테스트 관점 핵심 위험은 두 곳으로 집중된다. 첫째, `shadow-workflow.spec.ts` 의 `maxButtonsValidator` 인라인 헬퍼가 구 cap(10) 기준으로 하드코딩되어 있어 실제 production 로직(`MAX_BUTTONS_PER_NODE = 5`)과 경계값이 불일치한다 — cap 6~10 구간에서 production 은 reject 하지만 해당 테스트는 통과시켜, 이 구간의 버그를 잡지 못한다. 이는 plan 의 tests 체크리스트에서 누락된 항목이다. 둘째, `auth.ts` 의 타입 가드 함수(`isTwoFactorChallenge`, `isAccessTokenResponse`) 와 named interface 전체가 삭제됨에 따라 이를 import 하는 다른 소비처의 기존 테스트가 영향을 받을 수 있으며, 인라인 조건 분기에 대한 독립 단위 테스트가 없어 회귀 잠금이 약화된다. `button.types.spec.ts` 와 `carousel.schema.spec.ts` 의 경계값 케이스(5개 허용, 6개 거부)가 plan 에 명시되어 갱신된 것은 긍정적이나, `shadow-workflow.spec.ts` 누락이 그 효과를 상쇄한다. 전체적으로 backend cap 관련 테스트는 충실히 갱신 계획이 있지만 `shadow-workflow` 영역이 사각지대로 남는다.

## 위험도

MEDIUM
