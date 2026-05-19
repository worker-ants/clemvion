### 발견사항

---

**[WARNING] `LoginResponseData` JSDoc 에서 discriminated union 설명 제거로 인한 정보 손실**
- 위치: `codebase/frontend/src/lib/api/auth.ts` — `LoginResponseData` 타입 선언 앞 JSDoc 블록
- 상세: 변경 전 JSDoc 은 "discriminated union" 이라는 표현과 함께 `AccessTokenResponse` / `TwoFactorChallengeResponse` 두 인터페이스를 명명하고, `isTwoFactorChallenge` 타입 가드 사용 패턴 (`if (isTwoFactorChallenge(payload)) { ... }`)을 예제로 제공했다. 변경 후에는 인라인 익명 union 으로 대체되면서 JSDoc 첫 줄의 "discriminated union" 설명이 삭제됐다. 이제 타입의 구조적 의미(양 멤버가 서로 배타적이고 discriminant 필드 `requires2fa` 로 구별됨)가 문서에서 사라졌고, 개발자가 타입 내부를 직접 읽지 않으면 분기 방식을 알기 어렵다.
- 제안: JSDoc 에 "이 union 의 두 멤버는 `requires2fa` 유무로 구별됩니다. 2FA 분기 시 `payload && 'requires2fa' in payload && payload.requires2fa` 로 좁히세요." 와 같은 사용 패턴 안내를 최소 1문장 추가한다.

---

**[WARNING] `isTwoFactorChallenge` / `isAccessTokenResponse` 타입 가드 삭제 — 대체 패턴 미문서화**
- 위치: `codebase/frontend/src/lib/api/auth.ts` (제거된 함수들) / `codebase/frontend/src/components/auth/login-form.tsx` (사용처)
- 상세: 공개 exported 함수 `isTwoFactorChallenge` 와 `isAccessTokenResponse` 가 JSDoc(`타입 가드: ... 형태로 사용`) 포함 전부 삭제됐다. `login-form.tsx` 는 이 헬퍼 대신 인라인 `"requires2fa" in payload && payload.requires2fa` 패턴을 직접 사용하도록 변경됐으나, 이 패턴은 주석 없이 코드만 남아 있다. 향후 동일 union 을 다른 컴포넌트에서 사용할 개발자가 올바른 분기 방법을 찾을 문서 진입점이 없어진 상태다. 타입 가드가 없어진 이유(단순화, 번들 크기, 다른 이유)도 기록되지 않았다.
- 제안: `LoginResponseData` JSDoc 에 "타입 가드가 제거됨 — 직접 `'requires2fa' in payload` 로 좁힐 것" 한 줄을 추가하거나, `login-form.tsx` 의 인라인 분기 바로 위에 간단한 인라인 주석으로 의도를 명시한다.

---

**[WARNING] `button-list-editor.tsx` JSDoc 의 `maxButtons` 기본값 근거가 백엔드 상수와 연결되지 않음**
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/shared/button-list-editor.tsx` — 컴포넌트 JSDoc 블록
- 상세: 추가된 JSDoc 은 `maxButtons` default 5 가 "backend `MAX_BUTTONS_PER_NODE` 와 spec/4-nodes/6-presentation/0-common.md §1.1" 을 따른다고 설명한다. 이는 올바른 SSOT 추적이다. 그러나 현재 frontend 코드에는 `MAX_BUTTONS_PER_NODE` 상수를 import 해 default 값으로 사용하는 대신 숫자 리터럴 `5` 를 직접 사용한다. 이로 인해 상수가 백엔드에서 변경될 경우 JSDoc 설명과 실제 코드가 분리되고, 이 JSDoc 자체가 오래된 주석이 될 위험이 있다. consistency-check 세션(naming_collision.md)도 동일 문제를 INFO 로 지적했다.
- 제안: JSDoc 에 "현재는 숫자 리터럴 `5` 를 사용하며, 추후 `packages/` 공유 상수로 추출 예정 (follow-up)" 을 명시하거나, `MAX_BUTTONS_PER_NODE` 를 직접 import 해 `maxButtons = MAX_BUTTONS_PER_NODE` 로 사용해 JSDoc 설명과 코드를 일치시킨다.

---

**[WARNING] 제거된 `AccessTokenResponse` / `TwoFactorChallengeResponse` 인터페이스의 CHANGELOG 또는 deprecation 기록 없음**
- 위치: `codebase/frontend/src/lib/api/auth.ts`
- 상세: 두 named 인터페이스가 삭제되고 익명 union 멤버로 대체됐다. 이 인터페이스들은 exported 이었으므로, 이 파일을 직접 import 해 타입으로 사용하는 코드가 있다면 빌드 오류가 발생한다. 또한 `isTwoFactorChallenge` / `isAccessTokenResponse` 함수도 exported 상태로 삭제됐다. 변경 이력(왜 named 인터페이스를 제거했는지, 어떤 버전에서 제거됐는지) 이 CHANGELOG 나 commit 메시지 외의 어떤 문서에도 없다. 기존 JSDoc 에 `Swagger 측은 oneOf 로 분리 표기 (백엔드 §9 follow-up)` 언급이 삭제됨으로써 Swagger 연계 작업 추적도 끊어졌다.
- 제안: (1) 동일 파일 상단 주석에 "v[현재버전]에서 `AccessTokenResponse` / `TwoFactorChallengeResponse` named 인터페이스 및 타입 가드 함수 제거 — 인라인 union 으로 단순화" 한 줄을 추가한다. (2) Swagger `oneOf` 연계 follow-up 은 `plan/in-progress/2fa-webauthn-followups.md` §9 에 이미 역행(`[x]` → `[ ]`)된 것이 확인되므로 plan 단에서 추적 중인 점은 양호하다.

---

**[INFO] `plan/in-progress/2fa-webauthn-followups.md` — §9 항목이 완료(`[x]`)에서 미완(`[ ]`)으로 역행됐으나 이유 미명시**
- 위치: `plan/in-progress/2fa-webauthn-followups.md` §9 `LoginChallengeDto union 분리`
- 상세: §9 항목 세 개가 `[x]` 완료에서 `[ ]` 미완으로 되돌려졌고, 섹션 제목의 "**완료**" 표기도 제거됐다. 이는 `auth.ts` 의 타입 가드 / named 인터페이스 삭제 결정(이번 PR) 이 기존 완료 처리를 무효화한 것으로 보이나, 왜 이미 완료된 작업이 revert 됐는지(설계 변경, 기술 부채로 재분류 등)에 대한 설명이 plan 문서에 없다. §10 도 동일하게 완료 → 미완으로 역행됐으나 이유가 없다.
- 제안: 각 역행된 섹션 아래에 짧은 메모로 "역행 이유: ..." 를 추가해 향후 추적자가 혼란을 겪지 않도록 한다.

---

**[INFO] `login-form.tsx` 의 인라인 타입 좁히기 패턴에 인라인 주석 없음**
- 위치: `codebase/frontend/src/components/auth/login-form.tsx` L44–L58
- 상세: `if (payload && "requires2fa" in payload && payload.requires2fa)` 조건문과, 이후 `payload && "accessToken" in payload ? payload.accessToken : undefined` 표현식이 주석 없이 나열되어 있다. 타입 가드를 의도적으로 제거하고 직접 `in` 연산자로 좁힌 이유, 그리고 `accessToken` 이 undefined 일 때 `completeLogin` 을 호출하지 않는 이유가 문서화되어 있지 않다. 복잡한 타입 좁히기 패턴에 해당한다.
- 제안: `// requires2fa 가 없는 분기 = 즉시 발급 (AccessToken 응답)` 과 같은 짧은 인라인 주석을 추가해 분기 의미를 명확히 한다.

---

**[INFO] `plan/in-progress/presentation-button-render-investigation.md` — 소유권 이전 메모가 문서 상단에 블록쿼트로만 존재**
- 위치: `plan/in-progress/presentation-button-render-investigation.md` 상단 블록쿼트
- 상세: "소유권 이전 (2026-05-19)" 메모가 블록쿼트로 추가됐다. frontmatter `worktree` 는 `button-cap-spec-validator` 로 갱신됐으나, 이전 worktree(`node-config-required-defaults-sweep`)에 대한 링크나 이관 경위가 없다. plan 문서 규약상 worktree 가 바뀌면 해당 plan 이 어떤 경로로 새 worktree 에 인계됐는지 추적할 수 있어야 한다.
- 제안: 블록쿼트에 "이전 worktree: `node-config-required-defaults-sweep` (PR #[번호] 범위 외 scope-out)" 처럼 출처를 한 줄 추가한다.

---

**[INFO] `review/consistency/` 하위 `_retry_state.json` 파일의 용도 설명 없음**
- 위치: `review/consistency/2026/05/19/08_44_42/_retry_state.json`, `review/consistency/2026/05/19/08_55_14/_retry_state.json`
- 상세: `_retry_state.json` 은 orchestrator 가 사용하는 내부 상태 파일이지만, 파일 내에 어떤 주석이나 `description` 필드도 없어 처음 보는 사람이 파일 목적을 알 수 없다. 특히 `agents_pending` 배열이 모두 채워져 있고 `agents_success` 가 비어있는 상태로 커밋됐는데, 이는 세션 초기화 상태다.
- 제안: 이 파일은 orchestrator 내부 구현체이므로 코드 문서화 대상으로 보기 어렵다. 다만 `review/` 디렉토리 README 또는 consistency-checker SKILL.md 에 이 파일의 역할을 한 줄 기록하면 유지보수성이 높아진다.

---

### 요약

이번 변경의 문서화 상태는 혼재한다. `button-list-editor.tsx` 의 JSDoc 개선은 spec 출처(§1.1)와 override 사용 가이드를 명확히 기술해 우수한 사례다. 반면 `auth.ts` 에서의 대규모 삭제(named 인터페이스 2개 + 공개 타입 가드 함수 2개 제거)는 대체 사용 패턴과 삭제 이유가 문서화되지 않아 동일 union 타입을 사용하는 다른 개발자의 진입 장벽이 높아졌다. `LoginResponseData` JSDoc 도 "discriminated union" 설명이 제거됨으로써 핵심 의미 전달이 약해졌다. `2fa-webauthn-followups.md` 에서 이미 완료 처리된 §9·§10 항목이 역행된 경위가 plan 에 설명 없이 기록됐고, `login-form.tsx` 의 복잡한 인라인 타입 좁히기 패턴에도 인라인 주석이 없다. consistency-check 세션 파일들은 충실하게 작성됐으며 문서화 기준을 잘 따른다. `_retry_state.json` 은 내부 도구 파일이므로 문서화 우선순위는 낮다.

### 위험도

MEDIUM
