# Plan 정합성 검토 — auth-reauth-spec-accuracy.md

> Recovery re-run (2026-07-10 10:33): 이전 Workflow 실행이 success 로 보고됐으나 output_file 이
> FS-write flakiness 로 유실되어 재실행. 대상은 정정된 draft
> (`plan/in-progress/auth-reauth-spec-accuracy.md`, 이번 개정에 "변경 3" — `error-codes-catalog-sot.md`
> 후속 체크박스 갱신 — 추가됨).

## 조사 방법

- `plan/in-progress/auth-reauth-spec-accuracy.md` (target, 온디스크 최신본) 전문 확인.
- `plan/in-progress/error-codes-catalog-sot.md` 전문 확인 (변경 3 의 실제 타깃).
- `plan/complete/refactor-auth-reverify-unify.md`, `plan/complete/spec-draft-email-change.md` 확인 (target 이 주장하는 "계보" — §2.3 문구 정정 위임·유실 경위 — 검증).
- `plan/in-progress/` 전체에서 `verifyReauth`/`REAUTH_*`/`PASSWORD_INVALID`/`TOTP_INVALID`/`§2.3`/`1-auth.md`/`refactor-auth-reverify-unify`/`WebAuthn` 문자열로 교차 검색 — target 영역과 겹치는 다른 미해결 plan 유무 확인.
- `task_10ac843b` 추적 (직전 09:29/10:11 리뷰 산출물 및 `suggestions-prefix-dry.md`) — target 이 언급한 선행 발견의 계보 확인.
- `git status` / `git diff HEAD` — target 이 기술하는 "변경 1·2" 가 실제로 워킹트리에 어느 정도 반영됐는지 확인(변경 3 만 미반영 상태임을 교차검증).

## 발견사항

### [INFO] 변경 3 은 직전 리뷰(10_11_30)가 지적한 WARNING을 정확히 해소함 (확인)

- target 위치: `## 변경 3 — plan/in-progress/error-codes-catalog-sot.md 후속 체크박스 갱신` (line 104-106)
- 관련 plan: `plan/in-progress/error-codes-catalog-sot.md` `## 후속 (비차단, 별도 완결성 pass)` line 52-54
- 상세: 직전 실행(`review/consistency/2026/07/10/10_11_30/plan_coherence.md`)이 "target 이 완결시키는 후속 항목이 출처 plan 의 체크박스·오기 status 값에는 반영되지 않아 target 완료 후에도 그 문서가 stale 하게 남는다"는 WARNING을 냈다. 실제로 `error-codes-catalog-sot.md` line 52 는 현재도 `[ ]` 미체크 상태이며 status 표기가 `REAUTH_REQUIRED(403)`·`PASSWORD_INVALID(400)`으로 **틀려 있다** (target 의 코드검증 ground truth: `REAUTH_REQUIRED`=400, `PASSWORD_INVALID`=401, `TOTP_INVALID`=401 — `sessions.service.ts:244-291` 재확인 완료). target 의 "변경 3" 은 이 정확한 값(400/401/401)으로 체크박스를 `[x]` 로 갱신하도록 명시해, 직전 WARNING을 정확히 겨냥해 해소한다. `error-codes-catalog-sot.md` 의 두 번째 후속 항목(`NOT_A_MEMBER`/`INVALID_PASSWORD`)은 target 이 의도적으로 건드리지 않고(범위 밖 섹션과 일치), 해당 plan 은 계속 in-progress 로 남는 것이 맞다.
- 제안: 없음(정상). 참고로 워킹트리 `git diff HEAD` 확인 결과 target 의 "변경 1"(1-auth.md §2.3 행·주석·Rationale 1.1.B-4·§2.3.D)과 "변경 2"(3-error-handling.md §1.2.1 3행+주석)는 이미 워킹트리에 반영돼 있고, "변경 3"(error-codes-catalog-sot.md 체크박스)만 아직 미반영 — 이번 recovery 시점 기준 target 워크플로의 잔여 작업량과 문서 서술이 일치한다.

### [INFO] Rationale 1.1.B-4 중간 문장이 이미 완료된 plan 을 향후 작업 영역으로 계속 지칭

- target 위치: `spec/5-system/1-auth.md` Rationale `1.1.B-4` — target 의 "변경 1d" 는 이 문단의 오프닝·말미만 교체하고 중간 문장은 그대로 유지("WebAuthn 을 재인증 수단으로 쓰는 것은 challenge/response step-up 흐름이 필요해 `verifyReauth` 가 현재 미지원이며(§2.3 세션-revoke 와 동일 한계), **그 일반화는 `plan/complete/refactor-auth-reverify-unify.md` 영역이다**.")
- 관련 plan: `plan/complete/refactor-auth-reverify-unify.md` (완료·closed, worktree 도 삭제됨). 이 plan 의 실제 "범위 밖 / 후속" 목록을 확인한 결과 WebAuthn step-up 재인증 **구현**(challenge/response 일반화)은 어디에도 없다 — 이 plan 의 후속은 순수 spec 문서 갱신 항목(에러코드 표 등재, self-revoke 정책 명시 등)뿐이었다.
- 상세: target 자신이 새로 쓰는 문구(변경 1a 의 §2.3 행: "…일반화 **미착수** — Rationale 1.1.B-4·2.3.D", 신규 §2.3.D)는 이 generalize 작업에 소유자 plan 이 없음을 정직하게 "미착수"로 표현하도록 이미 개선했다. 그런데 target 이 손대는 동일 Rationale(1.1.B-4) 안에 남아있는 옛 문장은 여전히 이미 **완료·종결된** plan 을 마치 그 일반화 작업이 진행될 곳인 것처럼 가리킨다 — 사실과 다르다(그 plan 은 raw bcrypt 통합만 다뤘고 이미 머지·closed). target 이 이 문단을 부분 편집하는 김에 남겨진 stale 참조라 완전히 새로운 이슈는 아니지만, target 의 다른 신규 문구와 내적으로 모순되는 상태로 병합되게 된다.
- 제안: 변경 1d 범위를 확장해 중간 문장의 `그 일반화는 plan/complete/refactor-auth-reverify-unify.md 영역이다` 를 제거하거나 "일반화는 별도 미착수 백로그(소유 plan 없음)" 식으로 정정 권장. 필수는 아님(스펙 내용 정확성 이슈로 CRITICAL/BLOCK 대상 아니며, cross_spec/rationale_continuity 체커가 더 정확히 다룰 수 있는 영역). WebAuthn step-up 재인증 일반화를 실제로 추적할 별도 backlog plan 이 현재 `plan/in-progress/`·`plan/complete/` 어디에도 없다는 점은 참고 삼아 남겨둔다(target 의 "범위 밖" 절이 이미 "WebAuthn/이메일 OTP 재인증 실제 구현 — refactor-auth-reverify-unify 영역(미지원 유지)" 라고 명시해 두었으나, 이 지칭 대상 plan 이 closed 라는 점은 동일한 갭).

### [INFO] `task_10ac843b` 역참조가 이번 개정에서 추가되어 직전 리뷰 권고를 반영함 (확인)

- target 위치: `## 범위 밖 (별도)` 마지막 줄 — "`task_10ac843b`(§2.3 3자 불일치) 는 본 작업이 실질 해소."
- 관련 plan: `plan/in-progress/suggestions-prefix-dry.md` `## 후속 (별도, 이 plan 밖)` — "`1-auth.md §2.3` 재인증 3자 불일치 → `task_10ac843b`."
- 상세: 직전 리뷰(10_11_30)가 "target 이 `task_10ac843b`/`suggestions-prefix-dry.md` 를 역참조하지 않아 추적성이 떨어진다"는 INFO를 냈다. 이번 개정은 `## 범위 밖` 절에 해당 참조를 추가해 이를 반영했다(권고된 위치인 `## 배경`은 아니지만 실질적으로 동일 효과). 내용도 실제와 부합 — `suggestions-prefix-dry.md` 의 impl-done consistency-check 가 발견한 `1-auth.md §2.3` pre-existing CRITICAL 을 target 이 정확히 다루고 있음을 확인.
- 제안: 없음(정상, 참고용 확인 기록).

## 교차검증 — 다른 in-progress plan 과의 충돌·선행조건 재확인

- `plan/in-progress/spec-sync-auth-gaps.md` (LDAP/SAML 미구현 추적) — target 영역과 무관, 충돌 없음.
- `plan/in-progress/spec-sync-user-profile-gaps.md` — 알림/아바타/테마/슬러그 항목뿐, §2.3 재인증과 무관.
- `plan/in-progress/exec-intake-followups.md` — 과거 `1-auth.md` WebAuthn 응답 포맷 이슈는 이미 완료(2026-07-05) 처리됨, target 과 겹치지 않음.
- `plan/in-progress/competitive-analysis-n8n-flowise.md` — WebAuthn/TOTP 를 "강점"으로 인용하는 서술뿐(마케팅 문서), target 의 §2.3 미지원 명시와 상충하지 않음(재인증 *수단*이 아니라 *로그인* 2FA 강점 서술).
- `plan/complete/spec-draft-email-change.md` line 102·180 이 §2.3 문구 정정을 `refactor-auth-reverify-unify` 로 위임했다는 target 의 "계보" 주장, 그리고 그 완료 plan(`plan/complete/refactor-auth-reverify-unify.md`)의 실제 "범위 밖/후속" 목록에 §2.3 표 행 자체의 재서술이 빠져있다는 target 의 "유실" 주장 — 둘 다 원본 문서로 실측 확인됨. target 의 배경 서술은 정확하다.
- `error-codes-catalog-sot.md` 의 worktree(`error-codes-catalog-sot-e09193`)는 이미 삭제되어 있어(merge 완료, git log `01e68001c` #882) target 이 그 plan 파일을 직접 편집하는 데 활성 경합은 없다.

## 요약

target(`auth-reauth-spec-accuracy.md`)은 이미 병합·종결된 plan(`refactor-auth-reverify-unify.md`, `spec-draft-email-change.md`)의 명시적 후속과 in-progress plan(`error-codes-catalog-sot.md`)의 명시적 미해결 후속 항목을 정확히 겨냥한 drift 정정이며, 새로운 미해결 결정을 우회하거나 선행 조건이 해소되지 않은 상태로 진행하지도 않는다. 이번 recovery 개정에서 추가된 "변경 3"은 직전 검토(10_11_30)가 지적한 유일한 WARNING(출처 plan `error-codes-catalog-sot.md` 체크박스·상태코드 오기가 target 완료 후에도 stale 하게 남는 문제)을 정확한 status 값(400/401/401)으로 정조준해 해소하며, 워킹트리 실측(`git diff HEAD`)도 target 이 서술하는 잔여 작업 범위(변경 1·2는 이미 반영, 변경 3만 미반영)와 일치한다. `task_10ac843b` 역참조 추가도 직전 INFO 권고를 반영했다. 유일하게 남은 관찰은 Rationale 1.1.B-4 중간 문장이 이미 종결된 plan을 향후 WebAuthn step-up 일반화 작업 영역으로 계속 지칭하는 내적 사소한 불일치(INFO)이며, 이는 target 신규 문구("미착수")와의 미세한 모순일 뿐 차단 사유가 아니다.

## 위험도

LOW
