# Plan 정합성 검토 결과

검토 모드: --impl-done (구현 완료 후)
Target: `spec/5-system/1-auth.md` (diff 범위: auth 모듈 코드 변경)
실제 변경: `auth.controller.ts`, `auth.service.ts`, `auth.controller.spec.ts`, `auth.service.spec.ts`

---

## 발견사항

### 1. [INFO] C-3 체크박스가 plan 에서 미완료 상태로 남아 있음

- target 위치: diff 전체 (auth.controller.ts, auth.service.ts, 및 spec 파일)
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` §C-3
- 상세: plan/in-progress/refactor/02-architecture.md 의 C-3 항목은 현재 `- [ ] 미착수 — auth.controller.ts:55,328-335` 로 표기되어 있다. 실제 구현은 plan 이 명시한 옵션 A(`AuthService.verifyPasswordForUser` 신설, controller 의 bcrypt·UsersService 직접 의존 제거)를 정확히 따라 완료했다. 에러 코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)·메시지·401 shape 보존도 구현에서 확인된다. 그러나 체크박스가 완료로 갱신되지 않았다.
- 제안: plan 파일의 `- [ ] 미착수 — auth.controller.ts:55,328-335` 를 `- [x] 완료` (또는 worktree/PR 참조 포함)로 갱신한다. 구현 완료 후 plan 이동 절차(plan-lifecycle.md)에 따라 complete/ 로 이동하거나 README 추적도 반영한다.

---

## 심층 검토 (3개 관점)

### 1. 미해결 결정과의 충돌

C-3 plan 에 "결정 필요" 로 남겨둔 미확정 사항이 없다. plan 은 이미 옵션 A 를 권장·방향 확정했고("에러 shape 보존만 지키면 사실상 무위험 정렬"), 구현이 그 방향을 그대로 따랐다. 충돌 없음.

### 2. 선행 plan 미해소

C-3 plan 에 선행 조건이 명시되지 않았다. spec 갱신도 "불요" 로 명시됐고, `spec-sync-auth-gaps.md` 가 추적하는 미구현 항목(§1.3 LDAP/SAML)과도 무관하다. auth-config-webhook-followups.md 의 잔여 §2~4 도 본 변경과 독립적이다. 선행 미해소 없음.

### 3. 후속 항목 누락

plan C-3 개선 방안 3번("다른 비밀번호 재확인 경로(세션 강제 종료 재인증 등)가 controller 에 있으면 같은 메서드로 통일")이 구현에서 명시적으로 처리됐는지 diff 에서 확인되지 않는다. diff 는 `disable2fa` 경로만 수정했다. plan 원문이 "controller 에 있으면" 조건부로 기술했으므로, 해당 경로가 없으면 미수행이 정상이다. 그러나 plan 에서 이 확인 여부가 기록되지 않았다 — 추적 메모로 남길 수 있다.

다른 진행 중 plan(C-1/C-2/M-1~M-9 등)은 auth 모듈 레이어와 직교하여 본 변경의 영향을 받지 않는다.

---

## 요약

구현은 `plan/in-progress/refactor/02-architecture.md` §C-3 이 권장한 옵션 A 를 충실히 따랐다. 미해결 결정 우회, 선행 미해소, 후속 항목 신규 발생 등 실질 정합성 문제는 없다. 유일한 gap 은 plan 체크박스가 `[ ] 미착수` 로 남아 있다는 행정적 불일치이며, plan 파일 갱신으로 해소된다.

---

## 위험도

LOW
