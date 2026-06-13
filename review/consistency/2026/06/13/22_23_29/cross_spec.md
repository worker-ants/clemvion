# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md`
**검토 일시**: 2026-06-13
**검토 모드**: spec draft 검토 (--spec)

---

## 발견사항

### [INFO] 변경 1 — §2.3 표 행 추가: `session_revoked` 의미 확장이 §4.3 표와 동기화 필요
- **target 위치**: draft §A-1 변경 2 — `spec/5-system/1-auth.md §4.3 session_revoked` 행 설명 확장
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/spec/5-system/1-auth.md` §4.3 (line 400) + `spec/data-flow/1-audit.md` §1.2 caller 표 (line 101)
- **상세**: 현재 `spec/5-system/1-auth.md` §4.3 의 `session_revoked` 항목은 "사용자가 활성 세션 목록에서 다른 family 강제 종료" 로만 서술된다. draft 변경 2 는 이 설명을 확장해 "비밀번호 변경 성공 시 전체 family revoke(bulk, `familyId=null`)" 를 추가하며, `data-flow/1-audit.md §1.2` 와도 병기한다. 두 파일 모두 동일 이벤트에 대해 협소한 설명만 가지고 있으므로, draft 가 두 위치를 모두 갱신한다는 점은 명시하고 있다(변경 2 + 변경 6). 충돌이 아닌 동기화 의도이며 정합하다.
- **제안**: draft 의 변경 2 와 변경 6 이 두 파일을 동시에 업데이트하도록 명시하고 있으므로 현행 계획대로 진행하되, 실제 spec 편집 시 `spec/5-system/1-auth.md §4.3` 과 `spec/data-flow/1-audit.md §1.2` 를 반드시 같이 갱신한다.

---

### [INFO] 변경 4 — `POST /api/users/me/change-password` 응답 shape 변경: 성공 토스트/리다이렉트 흐름과의 정합 확인 필요
- **target 위치**: draft §A-1 응답 계약. 변경 4 — `spec/2-navigation/9-user-profile.md §2.2 + §6.1 L303`
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/spec/2-navigation/9-user-profile.md` §2.0 (line 109), §2.2 (line 126)
- **상세**: 현재 `9-user-profile.md` §2.0 은 "성공 시 `/profile` 로 리다이렉트 + 성공 토스트" 로 서술한다. 응답이 `{ data: { success: true } }` 에서 `{ data: { accessToken: string } }` 로 변경되더라도 클라이언트가 새 accessToken 을 교체한 후 `/profile` 리다이렉트 + 토스트를 표시하는 흐름은 논리적으로 유지 가능하다. 그러나 §2.0 과 §2.2 에는 "성공 시 서버로부터 accessToken 을 받아 in-memory 갱신" 이라는 신규 클라이언트 처리 단계가 언급되지 않는다. draft 변경 4 는 §API 표(L303) 비고만 보강하는 것으로 기술하며, §2.0/§2.2 의 성공 흐름 서술 자체는 변경 대상에 포함되지 않는다. 완전한 정합을 위해서는 §2.0 또는 §2.2 에 "응답의 새 accessToken 으로 auth-store 갱신 후 리다이렉트" 단계를 명기할 필요가 있다.
- **제안**: draft 에 변경 4-bis 로 `9-user-profile.md §2.0` 비밀번호 변경 페이지 성공 흐름 한 줄("응답의 accessToken 으로 in-memory 토큰 교체 후 `/profile` 리다이렉트") 추가를 포함하도록 권장. 누락해도 기능 구현은 가능하지만 spec 불완전 상태가 된다.

---

### [INFO] 변경 3 — Rationale §2.3.C 에 기재된 "Rationale 2.3.B" 상호 참조: 기존 §2.3.B 범위와 부분 중복
- **target 위치**: draft §A-1 변경 3 — Rationale 신규 §2.3.C "클라이언트 IP — `extractClientIp`(`auth/utils/client-ip.ts`, `TRUST_CF_CONNECTING_IP` 정책 — Rationale 2.3.B)"
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/spec/5-system/1-auth.md` §2.3 표 "클라이언트 IP" 행(line 278) + Rationale §2.3.B(line 572)
- **상세**: draft 변경 5(B-1) 에서 `user.*` ipAddress 추출을 "Rationale 2.3.B" 에 위임하며, 변경 3(§2.3.C Rationale) 도 동일 레퍼런스를 사용한다. 기존 §2.3.B 는 SameSite/CSRF/IP 신뢰 세 가지를 묶어 설명하고 있어, §2.3.C 가 IP 부분만을 참조하는 것은 정확하다. 단, §2.3.C 안에서 "best-effort revoke/재발급 실패 처리" 와 "IP 추출" 두 주제가 혼재되어 있어, IP 추출 관련 서술이 §2.3.B 와 중복될 수 있다(§2.3.B 가 이미 IP 신뢰 정책을 정의한다는 점). 모순은 아니나 독자가 §2.3.C 에서 IP 정책을 다시 읽는다면 §2.3.B 를 참조하라는 크로스레퍼런스만 남기고 중복 내용은 생략하는 것이 깔끔하다.
- **제안**: §2.3.C Rationale 에서 IP 추출 방식을 직접 서술하지 말고 "IP 추출은 §2.3.B/Rationale 2.3.B 기준" 한 줄 참조로 대체. 변경 5(B-1) 는 이미 그 방식으로 기술되어 있으므로 §2.3.C 만 간소화하면 충분.

---

### [INFO] 변경 5 (B-1) — `user.*` ipAddress 동반: `data-flow/1-audit.md §1.1` caller 표 행 갱신 범위 명확화 필요
- **target 위치**: draft §B-1 변경 5 — `spec/data-flow/1-audit.md §1.1` user.* 5개 행에 `· ipAddress 동반(포렌식)` 추가
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/spec/data-flow/1-audit.md` §1.1 caller 표 (lines 60-64)
- **상세**: 현재 `data-flow/1-audit.md §1.1` caller 표의 `auth_config.reveal` 행은 "auth_config 계열은 모두 `ipAddress` 를 함께 전달"이라는 주석을 갖는다(line 59). user.* 5개 행(`user.password_changed`, `user.2fa_enabled`(totp), `user.2fa_enabled`(webauthn), `user.2fa_disabled`(totp), `user.2fa_disabled`(webauthn))에는 ipAddress 주석이 없다. draft 변경 5 는 이 5개 행에 `· ipAddress 동반(포렌식)` 추가를 제안하며, auth_config 계열과 동일 패턴의 수평 확장이라고 설명한다. 이는 schema 상 `audit_log.ip_address?` 컬럼이 이미 optional 로 존재하므로(data-flow §4.1 Schema) 데이터 모델 변경 없이 가능하다. 직접 모순은 없으나, user.* 행의 비고 컬럼에 일관된 추가 표기가 필요하며, 5개 행 중 webauthn 2개 행(user.2fa_enabled·user.2fa_disabled의 webauthn variant)은 `details.method='webauthn'`·`credentialId` 등 별도 details 가 있어 "ipAddress 동반" 표기를 어느 컬럼/형식으로 추가할지 draft 가 명확히 하고 있다("비고" 열에 `· ipAddress 동반(포렌식)` 추가). 정합하다.
- **제안**: 변경 5 적용 시 표의 "비고" 컬럼이 추가되지 않는다면(현재 해당 열 없음) 열 추가 여부 또는 기존 설명 뒤에 덧붙이는 방식을 draft 에 명시하는 것이 좋다. auth_config 행 형식을 참고해 일관되게 적용하면 충분.

---

## 요약

target draft 는 `spec/5-system/1-auth.md`, `spec/2-navigation/9-user-profile.md`, `spec/data-flow/1-audit.md` 세 영역에 걸친 변경을 다루며, 각 변경이 참조하는 기존 spec 과 직접적인 모순은 발견되지 않는다. A-1(비밀번호 변경 시 전 세션 revoke + 현재 디바이스 재발급)은 `spec/5-system/1-auth.md §2.3` 세션 정책의 의미 확장이고, `session_revoked` 이벤트 enum 변경 없이 기존 `login_history` 7종 enum 과 정합하며, `data-flow/1-auth.md §1.5`(세션 revoke 흐름)와도 일관된다. B-1(user.* ipAddress 동반)은 `audit_log.ip_address?` optional 컬럼이 이미 존재하는 schema 를 활용하는 수평 확장이라 데이터 모델 충돌이 없다. 단, 변경 4 응답 shape 변경(`{ success: true }` → `{ accessToken }`)이 `9-user-profile.md §2.0` 성공 흐름 서술에 반영되지 않는 누락과, §2.3.C Rationale 의 IP 추출 서술이 기존 §2.3.B 와 부분 중복되는 정리 기회가 INFO 수준으로 확인됐다. 두 사항 모두 기능 정확성이나 다른 영역과의 모순을 야기하지 않으며, 편집 시 소거 가능한 명세 불완전성에 해당한다.

## 위험도

LOW

STATUS: OK
