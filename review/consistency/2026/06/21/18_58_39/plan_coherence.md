# Plan 정합성 검토 결과

검토 모드: `--impl-done` (scope=`spec/5-system/`, diff-base=`origin/main`)

---

## 발견사항

### [INFO] refactor-auth-reverify-unify 의 sessions.service verifyReauth 에러코드 spec 등재 후속이 auth §5 에 미반영
- **target 위치**: `spec/5-system/1-auth.md` §5 API 엔드포인트 표 — `/api/users/me/email-change/request` 행 (Rationale 1.1.B-4 에서 `verifyReauth` 재사용 명시)
- **관련 plan**: `plan/in-progress/refactor-auth-reverify-unify.md` §범위 밖/후속 항목 — "`verifyReauth` 에러 코드(`PASSWORD_INVALID`/`TOTP_INVALID`/`REAUTH_REQUIRED`) spec 본문 테이블 등재"
- **상세**: `refactor-auth-reverify-unify` plan 이 "verifyReauth 에러코드를 spec 본문 테이블에 등재"를 INFO-defer 후속으로 남겨 두었다. 이번 target(`spec/5-system/1-auth.md §1.1.B`)은 같은 verifyReauth 경로를 이메일 변경 재인증에 재사용한다고 명시하나, §5 API 표에 해당 에러코드가 아직 등재되지 않은 상태다. 이는 target 이 plan 의 미해결 follow-up 과 중복 영역에 진입했지만 충돌하지는 않는다 — plan 이 "결정 필요"가 아닌 INFO 추적이기 때문.
- **제안**: 현재 비차단. `refactor-auth-reverify-unify` 의 해당 follow-up(verifyReauth 에러코드 spec 등재)을 이번 auth spec 갱신과 함께 처리하거나, 별도 플래너 작업으로 plan 에 명시적으로 추적.

### [INFO] security-backlog-invitation-token-hash 의 §1.5.D Rationale 개정 결정 미완
- **target 위치**: `spec/5-system/1-auth.md` §1.5.D Rationale (raw 저장 유지 결정) — target 이 변경하지 않은 섹션
- **관련 plan**: `plan/in-progress/security-backlog-invitation-token-hash.md` §작업 범위 1항 — "`spec/5-system/1-auth.md §1.5.D` Rationale 검토 — 해시 저장 전환 결정 여부 명시"
- **상세**: `security-backlog-invitation-token-hash` 는 §1.5.D Rationale 의 "해시 전환 결정 여부 명시"를 착수 전 project-planner 위임으로 남겨 두었다. 이번 target 은 §1.5.D 를 건드리지 않으므로 충돌이 없다. 그러나 이메일 변경 토큰이 SHA-256 해시 저장(§1.1.B, §1.1 표)으로 명시되어 "토큰 해시 저장" 패턴이 이번 target 에서 더 강화됐으므로, 초대 토큰만 raw 저장을 유지한다는 §1.5.D 의 내용이 더욱 두드러진 예외가 되었다. 이 비교 맥락을 §1.5.D 에 명시하면 향후 security-backlog 착수 시 결정 근거가 더 명확해진다.
- **제안**: 비차단. 향후 `security-backlog-invitation-token-hash` 착수 시 §1.5.D Rationale 에서 이메일 변경 토큰 SHA-256 패턴을 대조 근거로 참조하도록 plan 에 메모 추가 권장.

### [INFO] spec-draft-email-change 의 §5(다음 단계) 마지막 항목이 미체크 상태로 잔류
- **target 위치**: 해당 없음 (plan 내부 상태 관찰)
- **관련 plan**: `plan/in-progress/spec-draft-email-change.md` §다음 단계 항목 5 — `[ ] spec PR → merge 후 별도 PR 로 developer 구현 위임`
- **상세**: `spec-draft-email-change.md` 는 planner plan 이며 §다음 단계 5 가 아직 미체크다. 실제로는 `impl-email-change.md` 가 이미 생성되어 developer 구현이 진행(구현·테스트 완료, 리뷰 단계 pending)됐으므로 체크박스가 실제 상태를 반영하지 못하고 있다. plan-lifecycle 규약상 plan 체크박스는 실제 상태와 일치해야 한다.
- **제안**: `spec-draft-email-change.md` §다음 단계 5 체크박스를 `[x]`로 갱신하거나, 해당 plan 을 `plan/complete/`로 이동(구현 완료 후 처리).

---

## 요약

`spec/5-system/` 의 이번 변경(이메일 변경 흐름 `§1.1.B` 신설 등)은 진행 중인 plan 과 구조적 충돌이 없다. `spec-draft-email-change.md` 와 `impl-email-change.md` 가 설계 결정을 선제적으로 정합화했고, WebAuthn reauth 미지원 한계를 `refactor-auth-reverify-unify` 영역으로 위임해 §2.3 기존 reauth 행을 건드리지 않았으며, `security-backlog-invitation-token-hash` 의 raw 저장 Rationale 결정도 이번 target 범위 밖으로 적절히 분리됐다. `refactor-auth-reverify-unify` 의 verifyReauth 에러코드 spec 등재 follow-up 과의 중복 영역이 있으나 이는 INFO 수준 추적 사안이다. CRITICAL/WARNING 수준 충돌은 없다.

## 위험도

LOW
