# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/` (diff-base: `fcd1d594`, mode: `--impl-done`)

---

## 발견사항

충돌이 확인된 항목 없음.

아래는 분석 과정에서 검토된 신규 식별자 목록과 판정이다.

### [INFO] Rationale 섹션 ID `2.3.C` 신규 추가 — 충돌 없음
- target 신규 식별자: `### 2.3.C — 비밀번호 변경 시 세션 revoke 범위` (`spec/5-system/1-auth.md`)
- 기존 사용처: baseline(`fcd1d594`)의 Rationale 섹션 목록에 `2.3.A`, `2.3.B` 까지만 존재하고 `2.3.C` 는 없었다 (`git show fcd1d594:spec/5-system/1-auth.md` 확인).
- 상세: `2.3.C` 는 완전히 신규이며 기존 어느 spec 파일에서도 같은 번호로 다른 의미를 부여한 흔적이 없다. 참조처(`spec/2-navigation/9-user-profile.md` L109, L303, `spec/data-flow/1-audit.md` L87)가 모두 이 신규 섹션을 가리킨다.
- 제안: 이상 없음.

### [INFO] `session_revoked` LoginHistory 이벤트 — 재사용 확인, 충돌 없음
- target 신규 식별자: §4.3 테이블 행 설명 확장 — `session_revoked`(bulk, `familyId=null`)
- 기존 사용처: `spec/1-data-model.md` L654, `codebase/backend/src/modules/auth/entities/login-history.entity.ts` L18, `sessions.service.ts` L118·L165·L205 등에서 기존부터 `session_revoked` enum 값 사용 중.
- 상세: 이 diff 는 새 enum 값을 추가하는 것이 아니라 기존 `session_revoked` 가 비밀번호 변경 bulk revoke 시에도 기록됨을 **설명 텍스트**에 추가한 것이다. spec 본문도 "enum 값은 기존 그대로 재사용 — DB CHECK 제약·마이그레이션 불요" 라고 명시해 의도가 일관된다.
- 제안: 이상 없음.

### [INFO] `user.*` 감사 액션의 `ipAddress` 필드 — 기존 필드 적용 확장, 충돌 없음
- target 신규 식별자: `spec/data-flow/1-audit.md` §1.1 표의 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 행에 "`ipAddress` 동반(포렌식)" 주석 추가.
- 기존 사용처: `AuditLogsService.record({ ..., ipAddress? })` 는 기존부터 optional 필드로 선언됐으며 `auth_config.*` 계열이 이미 사용 중 (`spec/data-flow/1-audit.md` L59).
- 상세: `ipAddress` 는 `AuditLogsService` 의 기존 optional 파라미터를 `user.*` 계열에도 전달하는 적용 범위 확장이다. 필드 명이나 추출 함수(`extractClientIp`) 모두 기존 코드와 동일하므로 충돌 없다.
- 제안: 이상 없음.

### [INFO] 세션 정책 표 신규 행 "비밀번호 변경 시 처리" — 기존 행 없음, 충돌 없음
- target 신규 식별자: `spec/5-system/1-auth.md` §2.3 세션 정책 테이블의 "비밀번호 변경 시 처리" 행
- 기존 사용처: baseline 버전의 동일 테이블에 해당 행이 존재하지 않았음 (`git show fcd1d594:spec/5-system/1-auth.md` 확인).
- 상세: 완전히 새 행이며, 행 레이블 "비밀번호 변경 시 처리" 는 테이블 내 다른 행("강제 종료", "비활동 만료" 등)과 의미 중복이 없다.
- 제안: 이상 없음.

### [INFO] `POST /api/users/me/change-password` 엔드포인트 설명 갱신 — 기존 endpoint 설명 업데이트, 신규 endpoint 아님
- target 신규 식별자: `spec/2-navigation/9-user-profile.md` §6.1 표의 `POST /api/users/me/change-password` 행 설명 변경
- 기존 사용처: 동일 endpoint 가 이미 baseline 에 "비밀번호 변경" 으로 등록돼 있었음 (`git show fcd1d594:spec/2-navigation/9-user-profile.md` 확인).
- 상세: endpoint method+path 는 변경 없이 행 설명만 세션 재발급 동작으로 보강됐다. 기존 endpoint 와 충돌하지 않는다.
- 제안: 이상 없음.

---

## 요약

이번 diff(`fcd1d594` → HEAD, `spec/5-system/1-auth.md` · `spec/data-flow/1-audit.md` · `spec/2-navigation/9-user-profile.md`)가 도입한 신규 식별자는 Rationale 섹션 ID `2.3.C` 가 유일하며, 이 번호는 baseline 에 존재하지 않았다. 나머지 변경(`session_revoked` 설명 확장, `ipAddress` 적용 범위 확장, 세션 정책 신규 행, endpoint 설명 보강)은 모두 기존 식별자를 재사용하거나 설명 텍스트만 변경한 것으로, 다른 의미로 이미 쓰이는 이름과의 충돌이 없다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 중 어느 축에서도 충돌 항목이 발견되지 않았다.

---

## 위험도

NONE
