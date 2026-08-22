# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-prep)

## 검토 범위 및 방법

target 번들은 컨텍스트 예산 초과로 `spec/5-system/` 17개 파일 중 3개
(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)만 본문이 포함되고 나머지 14개
및 대부분의 "관련 spec 본문"(`spec/1-data-model.md`, `spec/data-flow/**`,
`spec/2-navigation/**` 등)은 절단되었다. 절단된 파일을 "내용 없음"으로 간주하지 않고,
아래 항목은 저장소의 실제 파일을 `Read`/`grep` 으로 직접 열어 대조했다:

- `spec/1-data-model.md` — User/WebAuthnCredential/LoginHistory/AuthConfig 엔티티 필드
- `spec/data-flow/12-workspace.md` — `activeWorkspaceId` 클레임·`X-Workspace-Id` header-first·UUID 검증 비대칭
- `spec/2-navigation/9-user-profile.md` — §6.1 API 포인터(세션·이메일변경·초대)·§4.2 RBAC 매트릭스
- `spec/2-navigation/6-config.md` — AuthConfig/ModelConfig RBAC
- `spec/2-navigation/4-integration.md` — Integration RBAC(Personal/Organization)
- `spec/5-system/16-system-status-api.md` — System Status RBAC(no guard)
- `spec/5-system/12-webhook.md` — webhook 에러 코드·rate limit·body 크기
- `spec/5-system/14-external-interaction-api.md` — `MASKED_VALUE_RESUBMITTED`(§R17) 소비처
- `spec/5-system/4-execution-engine.md` / `6-websocket-protocol.md` — `INVALID_EXECUTION_STATE`/`RESUME_*` 상태 코드
- `spec/conventions/error-codes.md` — historical-artifact 레지스트리(초대 흐름 lowercase 예외)
- `spec/conventions/audit-actions.md` — verb 시제 3분류·도메인별 레지스트리

## 발견사항

교차 검증한 위 10개 접점 전부에서 **직접 모순을 발견하지 못했다.** 이 spec 세트는
"Rationale" 절에 과거 drift 발견·정정 이력을 상세히 남기는 관행이 있어(예: 1-auth.md
"§3.2 멤버 관리 Admin 열 정정", 3-error-handling.md "§1 카탈로그 완결성" 계열), 이번
검토에서 지적할 만한 신규 미정합은 나타나지 않았다. 구체적으로:

- **데이터 모델**: `user.password_hash`/`totp_recovery_codes`/`webauthn_recovery_codes`,
  `WebAuthnCredential`, `login_history.event`(login_success/login_failed/totp_failed/
  webauthn_failed/logout/session_revoked/token_reuse_detected) 필드·enum 이 `1-data-model.md`
  §2.1/§2.18.2/§2.21 과 `1-auth.md` §1.1/§1.4/§4.3 사이에서 완전히 일치한다.
- **RBAC**: `1-auth.md` §3.2 매트릭스(Auth Config: Owner/Admin=CRUD, Editor/Viewer=R ·
  Model Config: Owner/Admin/Editor=CRUD, Viewer=R · Integration Org: Owner/Admin=CRUD,
  Editor/Viewer=R · System Status: 전 역할 R)가 `2-navigation/6-config.md` §A.4/§B,
  `2-navigation/4-integration.md` §8, `5-system/16-system-status-api.md` §2/§4 의 실제
  서술과 정합한다. `9-user-profile.md` §4.2 "멤버 관리" 행도 §3.2 및 그 각주(†, Admin
  CRUD 로 정정된 이력)와 일치한다.
- **API 계약**: 이메일 변경(`/api/users/me/email-change/*`)·세션(`/api/users/me/sessions*`)·
  초대(`/api/workspaces/:id/invitations*`, `/api/workspaces/invitations/accept`) 엔드포인트가
  `1-auth.md` §5 의 포인터 문구와 `9-user-profile.md` §6.1 실제 표 사이에서 메서드·경로·
  설명이 모두 일치한다.
- **요구사항 ID**: webhook `WH-*` 식별자(`WH-EP-02/03`, `WH-SC-04/05/08/09`, `WH-NF-02`)는
  `12-webhook.md` 자체 문서에서만 정의·참조되고, `2-api-convention.md`/`3-error-handling.md`
  의 참조도 같은 의미로 가리킨다 — 다른 영역에서 동일 ID 를 다른 의미로 재사용한 사례 없음.
- **상태 전이**: `INVALID_EXECUTION_STATE`(WS 평면 ack) vs `INVALID_STATE`(REST 422) vs
  `STATE_MISMATCH`(EIA REST 409)의 "동일 의미·표면별 의도적 분리"가 `3-error-handling.md`
  §1.3/§1.5/§1.6, `4-execution-engine.md` §7.5.1, `6-websocket-protocol.md` §4.2 세 문서에서
  서로 다른 말로 반복 설명되지만 내용은 모순 없이 정확히 같다. `RESUME_CHECKPOINT_MISSING`/
  `RESUME_FAILED`/`RESUME_INCOMPATIBLE_STATE` 도 동일하게 3문서 정합.
- **명명 규약 예외**: `1-auth.md` §1.5.4 의 초대 흐름 lowercase 에러 코드(`invitation_not_found`
  등, `forbidden`/`rate_limited` 포함)가 `conventions/error-codes.md` §3 historical-artifact
  레지스트리에 "초대 API 한정" 으로 정확히 등재돼 있다 — 다른 영역의 `UPPER_SNAKE_CASE` 코드와
  충돌하지 않는다.
- **금번 작업(마커 재제출 가드) 관련**: `3-error-handling.md` §1.7 이 서술하는
  `MASKED_VALUE_RESUBMITTED`(re-run 을 포함한 세 소비처, 2026-08-20/08-22 정정 이력)와
  `14-external-interaction-api.md` §R17 의 서버측 가드 표(re-run·`workflows/:id/execute` 두
  진입점)는 "가드 호출 지점(2곳)"과 "에러 코드 통일 대상 엔드포인트(3곳: execute/save/re-run)"
  라는 **서로 다른 집합**을 각자 정확한 범위로 서술하고 있어 모순이 아니다 — 표면상 숫자가
  달라 보이지만 지칭 대상이 다르다.

지적할 CRITICAL/WARNING 항목은 없다.

- **[INFO]** 대형 elided 파일 미전수 검증
  - target 위치: `spec/5-system/4-execution-engine.md`(223,516자)·`14-external-interaction-api.md`
    (124,955자)·`6-websocket-protocol.md`(87,000자)·`15-chat-channel.md`(75,705자) 등
  - 충돌 대상: 없음 (커버리지 caveat)
  - 상세: 위 4개 초대형 파일은 이번 세션에서 관련 절만 `grep`/부분 `Read` 로 발췌 대조했고
    전문을 통독하지는 않았다. `1-auth.md`/`2-api-convention.md`/`3-error-handling.md` 가
    참조하는 구체 조항(§7.5.1, §4.2, §R17 등)은 직접 열어 확인했으므로 이번 target 범위에서
    실질 위험은 낮다고 판단하나, 이 절단은 orchestrator 번들링 예산 문제이지 spec 결함이
    아니다.
  - 제안: 조치 불요. 향후 이 영역을 다시 검토할 때 예산이 허용하면 전문 포함을 권장.

## 요약

`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` (target)를 데이터
모델·RBAC·API 계약·상태 코드·명명 규약 축에서 데이터 모델(`1-data-model.md`), 워크스페이스
컨텍스트(`data-flow/12-workspace.md`), 사용자 프로필/설정/연동 RBAC(`2-navigation/9-user-profile.md`,
`6-config.md`, `4-integration.md`), 실행 엔진/웹소켓 상태 코드(`4-execution-engine.md`,
`6-websocket-protocol.md`), webhook/EIA 도메인(`12-webhook.md`, `14-external-interaction-api.md`),
에러코드·감사액션 규약(`conventions/error-codes.md`, `conventions/audit-actions.md`)과 각각
직접 대조했다. 모든 접점에서 필드명·엔드포인트·RBAC 등급·에러 코드·상태 전이가 정합했고,
신규로 지적할 CRITICAL/WARNING 은 없다. 이 spec 세트는 과거 drift 를 Rationale 절에 이력으로
남기는 관행이 정착돼 있어 현재 상태의 자기 정합성이 높다.

## 위험도

NONE
