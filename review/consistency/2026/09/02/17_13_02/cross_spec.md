# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위 및 방법

target 은 `spec/5-system/1-auth.md` 전문(본문+Rationale 366~766행 상당) 이 번들에 포함되었고,
같은 폴더의 나머지 16개 파일(`2-api-convention.md`·`3-error-handling.md`·`4-execution-engine.md`
등)은 컨텍스트 예산 초과로 프롬프트에서 절단되었다. 절단된 부분과 "관련 spec 본문" 섹션의
대다수(`1-data-model.md`, `2-navigation/*`, `data-flow/*` 등)도 마찬가지로 절단되었으므로, 이
보고서는 **`Read`/`grep` 으로 저장소의 실제 파일을 직접 열어 대조**하는 방식으로 작성했다
(프롬프트 절단을 "해당 내용 없음"으로 해석하지 않음).

대조한 파일: `spec/1-data-model.md`(User·WebAuthnCredential·LoginHistory·WorkspaceInvitation),
`spec/2-navigation/9-user-profile.md`(§4.2 RBAC·§6.1 API), `spec/2-navigation/6-config.md`
(§A.4 AuthConfig), `spec/2-navigation/4-integration.md`(§8 권한 규칙), `spec/2-navigation/10-auth-flow.md`,
`spec/2-navigation/8-marketplace.md`, `spec/2-navigation/7-statistics.md`,
`spec/5-system/3-error-handling.md`(§1.2.1·§1.3), `spec/5-system/16-system-status-api.md`,
`spec/conventions/error-codes.md`(§3), `spec/conventions/audit-actions.md`,
`spec/data-flow/2-auth.md`(§3.2 잠금), `spec/data-flow/12-workspace.md`(§1.5·Rationale),
`spec/7-channel-web-chat/4-security.md`(R6).

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** target(`1-auth.md`)의 cross-spec 정합 유지 수준이 이례적으로 높음
  - target 위치: `spec/5-system/1-auth.md` 전반 (§1~§5 + Rationale)
  - 충돌 대상: 없음 — 정보성 관찰
  - 상세: 아래 8개 항목을 실측 대조했고 전부 일치했다.
    1. **데이터 모델** — `password_hash`/`totp_recovery_codes`/`webauthn_recovery_codes`/
       `email_verified` 필드 정의(`1-data-model.md` §2.1) 및 `WebAuthnCredential`(§2.21)·
       `LoginHistory`(§2.18.2, event enum `login_success/login_failed/totp_failed/
       webauthn_failed/logout/session_revoked/token_reuse_detected`, 180일 보존)가 1-auth.md
       §1.1/§1.4/§2.3/§4.3 서술과 정확히 일치.
    2. **RBAC 매트릭스** — `9-user-profile.md` §4.2("멤버 관리" Owner✅/Admin✅/Editor❌/Viewer❌)가
       1-auth.md §3.2 정정(2026-07-28, CRU→CRUD)과 상보적으로 일치. `4-integration.md` §8
       (Organization 생성/수정/전환=Admin+)이 1-auth.md §3.2 "Integration (Org) CRUD/CRUD/R/R"
       와 일치하며, 두 문서 모두 "editor 라우트 가드 floor vs 세부 RBAC" 비-모순 각주를 공유.
    3. **AuthConfig 권한 분리** — `6-config.md` §A.4("mutation Admin+, 조회 Viewer+, reveal
       Admin+")가 1-auth.md §3.2 "Auth Config CRUD/CRUD/R/R" + "Reveal Admin+" 근거 각주와 일치.
    4. **에러 코드 카탈로그** — `3-error-handling.md` §1.2.1(2FA/WebAuthn/재인증 코드)·§1.3
       (`VALIDATION_ERROR`/`WORKSPACE_ID_REQUIRED`/`X-Workspace-Id` 3분기)이 1-auth.md
       §2.3·§5 의 서술·코드값과 완전히 일치. `conventions/error-codes.md` §3 historical-artifact
       레지스트리(`invitation_*`/`forbidden`/`rate_limited` lowercase 예외)가 1-auth.md §1.5.4
       각주와 문자 그대로 일치.
    5. **감사 액션 규약** — `conventions/audit-actions.md`(§1~§3 구조·시제 taxonomy·레지스트리)가
       1-auth.md §4.1 카탈로그·Rationale 4.1.A/4.1.B 와 일치(과거분사 vs 현재형 예외 vs 도메인
       고유 동사 3분류, `workspace.deleted` 구조적 제외 등).
    6. **워크스페이스 토큰 모델** — `data-flow/12-workspace.md` §1.5·§Rationale(`activeWorkspaceId`
       클레임, dual-read, header-first, UUID 검증 강도 비대칭)이 1-auth.md §2.2·§3.3 서술과
       완전히 정합.
    7. **계정 잠금 알림 부재** — `data-flow/2-auth.md` §3.2 에 이메일 알림 언급이 없어, 1-auth.md
       Rationale "계정 잠금에 이메일 알림은 없다"(2026-08-31 정정)와 실제로 정합.
    8. **웹챗 IP 미식별 완화 한도** — `7-channel-web-chat/4-security.md` R6 이 1-auth.md
       Rationale 2.3.B 의 "`req.ip`/`socket` 폴백 미채택" 결정을 그대로 인용·일치.
  - 제안: 없음 — 정보성. 다만 이 정합성은 **target 문서 자체가 최근 수차례 자기 반증형 정정을
    거친 결과**(§Rationale 다수가 "실측으로 정정" 이력을 명시)이므로, 향후 이 문서를 편집할 때도
    같은 방식(구현/타 spec 실측 후 Rationale 남기기)을 유지하는 것이 재발 방지에 유효하다.

## 요약

`spec/5-system/1-auth.md`(전문 검토)와 이를 참조하는 8개 타 영역 spec 파일(데이터 모델·RBAC·
API 계약·에러 코드·감사 액션·워크스페이스 토큰 모델·웹챗 보안)을 실제 저장소 파일을 열어
대조한 결과 데이터 모델 충돌·API 계약 충돌·요구사항 ID 충돌·상태 전이 충돌·RBAC 모델 충돌·계층
책임 충돌 중 어느 관점에서도 CRITICAL 또는 WARNING 수준의 모순을 찾지 못했다. target 문서는
이미 다수의 과거 리뷰(2026-07-28, 2026-08-09, 2026-08-31 등)를 거치며 발견된 불일치를 Rationale
섹션에 실측과 함께 정정해 온 이력이 있고, 이번 검토에서 재검증한 8개 교차 지점 모두 그 정정
상태가 유지되고 있음을 확인했다. 프롬프트에서 컨텍스트 예산으로 절단된 `5-system/` 내 나머지
16개 파일 및 다수 관련 spec 은 이번 교차검증 범위(주로 1-auth.md 가 명시적으로 참조하는 대상)
밖이라 직접 대조하지 않았다 — 별도 라운드에서 그 파일들이 target 이 될 때 재확인이 필요하다.

## 위험도

NONE
