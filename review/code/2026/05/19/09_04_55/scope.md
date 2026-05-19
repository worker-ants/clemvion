# 변경 범위(Scope) 리뷰

## 발견사항

- **[CRITICAL]** 파일 1·3 (`login-form.tsx` / `auth.ts`) 변경이 본 PR 목적(버튼 cap 통일)과 전혀 무관한 인증 로직 수정
  - 위치: `codebase/frontend/src/components/auth/login-form.tsx` 전체 diff, `codebase/frontend/src/lib/api/auth.ts` 전체 diff
  - 상세: 본 PR 의 유일한 목적은 "Presentation 노드 버튼 cap 5로 통일 — spec 명문화 + backend validator + frontend default 갱신" 이다 (plan `button-cap-spec-validator.md` §결정). 그런데 다음 두 파일에 인증 관련 실질 코드 변경이 혼입되어 있다.
    1. `auth.ts` — `AccessTokenResponse` / `TwoFactorChallengeResponse` 네임드 인터페이스와 `isTwoFactorChallenge` / `isAccessTokenResponse` 타입 가드 함수 두 개를 삭제하고, discriminated union 을 인라인 anonymous type 으로 교체. 주석 "discriminated union" 도 제거.
    2. `login-form.tsx` — `isTwoFactorChallenge` import 제거 후 해당 타입 가드 호출부를 인라인 property-check (`"requires2fa" in payload && payload.requires2fa`) 로 대체. `completeLogin(payload.accessToken)` 직접 호출을 optional-chain 패턴(`if (accessToken) { await completeLogin(accessToken) }`)으로 교체.
  - 이 변경들은 2FA/WebAuthn 도입 PR 의 후속 타입 정리 작업(`plan/in-progress/2fa-webauthn-followups.md §9 LoginChallengeDto union 분리`)에 해당하며, 해당 plan 항목은 현재 미체크(`[ ]`)로 별도 PR 로 분리 예정이다. 버튼 cap PR 에 인증 타입 정리가 혼입된 것은 범위 초과다.
  - 제안: `auth.ts` 와 `login-form.tsx` 의 변경분을 별도 PR (2fa-webauthn-followups §9 항목)로 분리한다. 본 PR 에서 해당 두 파일을 원상 복구하거나 커밋에서 제외한다.

- **[WARNING]** `auth.ts` 에서 named export 타입 가드 함수 두 개 삭제 — 외부 사용처 잔존 가능성
  - 위치: `codebase/frontend/src/lib/api/auth.ts` — `isTwoFactorChallenge`, `isAccessTokenResponse` 함수 삭제
  - 상세: 두 함수는 `login-form.tsx` 에서만 사용 여부가 확인되지만 exported public API 이므로 다른 소비처가 있을 경우 타입 오류가 발생한다. 삭제 자체가 버튼 cap 작업의 의도와 무관하므로 본 PR 범위를 벗어나는 동시에 안전성 위험도 내포한다.
  - 제안: CRITICAL 항목과 동일 — 해당 변경을 분리 PR 로 이동한다.

- **[WARNING]** `plan/in-progress/2fa-webauthn-followups.md` 에서 §9·§10 항목을 "완료" 에서 다시 "미완"으로 되돌린 변경
  - 위치: `plan/in-progress/2fa-webauthn-followups.md` diff — `### 9. LoginChallengeDto union 분리 — **완료**` 제목과 `[x]` 체크박스들이 `### 9. LoginChallengeDto union 분리` 와 `[ ]` 미체크로 교체됨. `### 10. V058 마이그레이션 NOT VALID 2-step 분리 — **의도적 미실행 + 컨벤션 보강으로 종결**` 도 동일하게 "완료" 표기와 근거 내용 제거 후 미체크 항목으로 대체됨.
  - 상세: 이 변경은 버튼 cap 통일 작업과 직접 관련 없다. 2fa-webauthn 계열 follow-up plan 을 갱신하는 작업이 버튼 cap PR 커밋에 혼입된 것이다. 특히 §10 은 "완료" 처리된 항목을 다시 미완으로 되돌리는 것이어서, 기존에 종결된 의사결정을 재오픈하는 효과를 낳는다. 버튼 cap PR 에서 다른 도메인(인증/마이그레이션)의 plan 상태를 역행시키는 것은 변경 의도와 무관한 수정이다.
  - 제안: `2fa-webauthn-followups.md` 의 §9·§10 변경을 본 PR 에서 revert 한다. 해당 plan 항목 상태 변경은 인증 도메인 작업 PR 에서 별도로 처리한다.

- **[INFO]** `button-list-editor.tsx` JSDoc 확장 — 범위 내이나 분량이 다소 과함
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/shared/button-list-editor.tsx` — 단일 줄 JSDoc 을 8줄 블록 주석으로 확장
  - 상세: `maxButtons = 10` → `maxButtons = 5` 변경의 배경과 spec 참조를 설명하는 주석으로 해당 PR 의도(cap 정책 명문화)에 부합한다. carousel 의 "item 5 + global 5 = 10" 가시 모델 설명이 포함되어 있어 코드 이해에 직접 기여한다. 분량이 다소 길지만 정당화 가능한 수준.
  - 제안: 불필요한 주석은 아니나, `spec/4-nodes/6-presentation/0-common.md §1.1` 참조 링크 한 줄로 압축해도 충분하다.

- **[INFO]** `review/consistency/2026/05/19/08_44_42/` 과 `review/consistency/2026/05/19/08_55_14/` 디렉토리 전체 (파일 7~19) — consistency-check 산출물로 범위 내
  - 위치: `review/consistency/2026/05/19/08_44_42/`, `review/consistency/2026/05/19/08_55_14/`
  - 상세: 두 세션 모두 본 PR 착수 전 `/consistency-check` 를 실행한 결과물이다. CLAUDE.md §Skill 체계에서 developer 는 구현 착수 직전 `consistency-checker --impl-prep` 의무 호출이 요구되며, review/ 산출물은 해당 담당 영역(`review/**`) 에 해당한다. 의도된 범위 내 파일.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/button-cap-spec-validator.md` 신규 생성 — 범위 내
  - 위치: `plan/in-progress/button-cap-spec-validator.md`
  - 상세: 본 PR 작업을 추적하는 plan 문서로 CLAUDE.md §PLAN 문서 라이프사이클 규약에 따른 정상 생성.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/presentation-button-render-investigation.md` frontmatter 및 본문 갱신 — 범위 내
  - 위치: `plan/in-progress/presentation-button-render-investigation.md`
  - 상세: 선행 investigation plan 의 소유권 이전(worktree 갱신)과 root cause 확정 기록. 버튼 cap fix 작업의 논리적 전제 조건이며 버튼 도메인 내 문서 연계 갱신이다.
  - 제안: 없음.

## 요약

본 PR 의 핵심 변경(버튼 cap 5 통일 — `button-list-editor.tsx` default 변경, backend 상수·validator 정렬, spec·plan·consistency-check 산출물 갱신)은 모두 명시된 작업 범위 내에 있다. 그러나 `codebase/frontend/src/lib/api/auth.ts` 에서의 인터페이스 삭제·타입 가드 함수 제거와 `login-form.tsx` 에서의 인증 흐름 코드 변경이 버튼 cap 작업과 완전히 무관한 채 혼입되어 있다. 이 변경들은 `plan/in-progress/2fa-webauthn-followups.md §9` 의 미체크 항목(별도 PR 예정)에 해당하는 2FA 타입 정리 작업이다. 동시에 `2fa-webauthn-followups.md` 에서 §9·§10 을 완료에서 미완으로 되돌리는 plan 상태 역행 변경도 혼입되어 있어, 한 PR 이 서로 다른 두 도메인(버튼 cap + 인증 타입)의 코드와 plan 을 동시에 수정하는 scope creep 이 발생하였다.

## 위험도

HIGH
