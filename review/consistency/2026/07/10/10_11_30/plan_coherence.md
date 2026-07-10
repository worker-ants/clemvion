# Plan 정합성 검토 — auth-reauth-spec-accuracy.md

검토 대상: `plan/in-progress/auth-reauth-spec-accuracy.md`
검토 범위: `plan/in-progress/**` 전체 + 참조된 완료 plan `plan/complete/refactor-auth-reverify-unify.md`

## 발견사항

- **[WARNING]** `error-codes-catalog-sot.md` 의 "후속" 체크박스가 target 워크플로에서 갱신 대상으로 반영되지 않음
  - target 위치: `plan/in-progress/auth-reauth-spec-accuracy.md` `## 워크플로 (project-planner)` (3개 항목: consistency-check / spec 반영 / plan complete 이동)
  - 관련 plan: `plan/in-progress/error-codes-catalog-sot.md` `## 후속 (비차단, 별도 완결성 pass)` 첫 항목 — "재인증(§2.3) 흐름 코드 spec 문서화 → 등재: `REAUTH_REQUIRED`(403)·`PASSWORD_INVALID`(400)·`TOTP_INVALID`(401)... '1-auth.md §2.3 에 코드 문서화 → §1.2.1 등재' 순서 필요"
  - 상세: target 은 이 정확한 후속 항목을 이행한다(배경 절이 명시적으로 인용). 그런데 target 의 변경 2c) 는 "#882 §1.2.1 주석의 status 오기(REAUTH_REQUIRED 403→400·PASSWORD_INVALID 400→401)도 코드 기준으로 정정" 이라고 밝히는데, 이 **잘못된 403/400 status 값은 `error-codes-catalog-sot.md` 자신의 후속 체크박스 텍스트에도 그대로 박제**돼 있다(`3-error-handling.md` line 64 의 오기를 그대로 인용). target 의 spec 반영이 끝나도 `error-codes-catalog-sot.md` 파일 자체는 (a) 체크박스가 `[ ]` 로 남고 (b) status 값이 정정 후 spec 과 어긋난 채 방치된다. `.claude/docs/plan-lifecycle.md` line 10 ("모든 작업·체크리스트·후속 항목까지 끝난 plan 만 complete 로 옮긴다")에 따라 이 plan 은 어차피 `NOT_A_MEMBER`/`INVALID_PASSWORD` 잔여 후속 때문에 곧바로 complete 로 옮겨지진 않지만, 체크박스·status 값이 stale 상태로 남으면 향후 이 plan 을 다시 여는 사람이 "아직 미해결"로 오인하거나 정정된 403/400 을 다시 잘못 참조할 위험이 있다.
  - 제안: target 워크플로에 "`error-codes-catalog-sot.md` 후속 체크박스 1건 `[x]` 처리 + status 값(400/401) 정정 + 본 plan 참조 추가" 항목을 명시적으로 추가한다. (`NOT_A_MEMBER`/`INVALID_PASSWORD` 후속 항목은 target 범위 밖이 맞으므로 그대로 `[ ]` 유지.)

- **[INFO]** `suggestions-prefix-dry.md` 가 언급한 `task_10ac843b` 와 target 의 관계가 명시되지 않음
  - target 위치: target 문서 전체(특히 `## 배경` — task 출처 서술)
  - 관련 plan: `plan/in-progress/suggestions-prefix-dry.md` `## 후속 (별도, 이 plan 밖)` — "`1-auth.md §2.3` 재인증 3자 불일치 → `task_10ac843b`"
  - 상세: `suggestions-prefix-dry.md` 는 별도 세션(#878 W3 리팩터)의 impl-done consistency-check 에서 발견된 `1-auth.md §2.3` pre-existing CRITICAL(재인증 3자 불일치)을 "target 오선정"으로 분리하며 `task_10ac843b` 로 위임했다고 기록했다. target(`auth-reauth-spec-accuracy.md`)이 다루는 문제(§2.3 3자 모순)와 내용이 정확히 일치해, target 이 사실상 `task_10ac843b` 의 후속 실행으로 보이나 target 문서 어디에도 이 task ID 나 `suggestions-prefix-dry.md` 에 대한 역참조가 없다. 충돌은 아니지만(둘 다 동일한 정정 방향을 향함), 추적성을 위해 언급해두면 향후 "이 CRITICAL 이 왜 아직도 열려 있나"는 재조사를 막을 수 있다.
  - 제안: target `## 배경` 또는 `## 워크플로` 에 "이 작업은 `task_10ac843b`(2026-07-10, suggestions-prefix-dry.md impl-done 에서 분리)의 실행" 한 줄 추가 권장. 필수는 아님(WARNING 아님).

## 정합성 확인 (문제 없음 — 참고용)

- **선행 plan 해소 확인**: target 의 배경이 인용하는 `plan/complete/refactor-auth-reverify-unify.md` 는 실제로 "후속 (project-planner)" 목록에 "`verifyReauth` 에러 코드(`PASSWORD_INVALID`/`TOTP_INVALID`/`REAUTH_REQUIRED`) spec 본문 테이블 등재"를 명시적으로 남겨뒀다 — target 이 정확히 그 후속을 수행 중이며 선행 조건(bcrypt 통합·`verifyReauth`=password OR TOTP 확정)은 이미 충족·병합됐다(complete).
- **미해결 결정 충돌 없음**: target 이 "결정"으로 새로 도입하는 항목은 없다. `1-auth.md` Rationale 1.1.B-4(이미 병합된 spec 본문, line 515)가 "WebAuthn 재인증은 §2.3 세션-revoke 와 동일하게 현재 미지원" 이라고 이미 확정해뒀고, target 은 §2.3 자체를 그 기존 결정에 정렬시킬 뿐이다. 현재 `plan/in-progress/**` 전체에서 `spec_area`/`spec_impact` 로 `1-auth.md` 또는 `3-error-handling.md` 를 선언한 plan 은 `error-codes-catalog-sot.md` 와 target 자신뿐이며, `9-user-profile.md` 를 동시 편집 중인 plan 도 없다 — 3자 동시 편집 충돌 없음.
- **Before/After 인용 정확성**: target 이 인용한 `1-auth.md` line 323 표 행, Rationale 1.1.B-4(line 515), `3-error-handling.md` line 64 주석은 현재 저장소 상태와 문자 그대로 일치한다 — 다른 병합된 PR 이 이 구간을 target 작성 이후 먼저 바꿔놓은 drift 는 없다.
- **`ai-agent-tool-connection-rewrite.md` 등 "결정 필요" plan** 은 도메인이 달라(AI Agent 도구 연결, Discord/Slack Gateway, cafe24 등) target 과 무관 — 확인 결과 겹치는 미해결 결정 없음.

## 요약

target draft(`auth-reauth-spec-accuracy.md`)는 이미 병합된 완료 plan(`refactor-auth-reverify-unify.md`)의 명시적 후속과 in-progress plan(`error-codes-catalog-sot.md`)의 명시적 후속 항목을 정확히 겨냥한 drift 정정이며, 새로운 미해결 결정을 우회하거나 선행 조건이 해소되지 않은 상태에서 진행하지도 않는다. 유일한 실질적 갭은 target 이 완결시키는 후속 항목이 그 출처 plan(`error-codes-catalog-sot.md`)의 체크박스·오기 status 값에는 반영되지 않아, target 완료 후에도 그 plan 문서가 stale 한 채로 남는다는 점이다(WARNING 1건). `task_10ac843b` 역참조 누락은 추적성 개선 권고(INFO 1건)로 차단 사유는 아니다.

## 위험도

LOW
