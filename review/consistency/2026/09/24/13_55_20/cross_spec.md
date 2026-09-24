# Cross-Spec 일관성 검토 — `spec/5-system` (impl-prep)

## 검토 범위와 방법

target 은 `spec/5-system` 전체(17개 파일)이나, 조립 프롬프트는 컨텍스트 예산 초과로
`1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 세 파일만 전문을 실었고 나머지
14개(`4-execution-engine.md` 등)와 대다수 관련 영역(`1-data-model.md`,
`2-navigation/*`, `data-flow/*` 등)은 절단됐다. 프롬프트 절단분을 "내용 없음" 으로
간주하지 않고, 워크트리 디스크에서 해당 파일들을 직접 `Read`/`grep` 하여 대조했다:

- 전문 대조: `spec/5-system/1-auth.md`, `2-api-convention.md`, `3-error-handling.md`
- 앵커·본문 대조(grep/부분 Read): `spec/1-data-model.md` §2.1(User) · `spec/data-flow/12-workspace.md`
  (§1.5 워크스페이스 전환, RBAC 표, UUID 검증 비대칭 Rationale) · `spec/data-flow/2-auth.md`
  (rate limit, 423→401) · `spec/conventions/error-codes.md`(historical-artifact 레지스트리,
  rename 이력) · `spec/conventions/audit-actions.md`(시제 분류·레지스트리) ·
  `spec/2-navigation/6-config.md`(AuthConfig RBAC) · `spec/2-navigation/9-user-profile.md`
  §6.1(세션·이메일변경·초대 엔드포인트) · `spec/5-system/6-websocket-protocol.md` §7.1(에러 코드) ·
  `spec/5-system/4-execution-engine.md` §7.5·§7.5.1·§7.5.2·§11(앵커 존재 확인) ·
  `spec/5-system/16-system-status-api.md` §4(보안/RBAC) · `spec/5-system/10-graph-rag.md`·
  `8-embedding-pipeline.md`(에러 코드 앵커) · `spec/5-system/14-external-interaction-api.md`
  (rate-limit 키 모델) · `spec/7-channel-web-chat/3-auth-session.md`(쿠키/Bearer 모델).

`4-execution-engine.md`(227KB)·`14-external-interaction-api.md`(134KB)·
`15-chat-channel.md`(97KB)·`6-websocket-protocol.md`(103KB) 등 초대형 파일은 앵커 존재와
인용된 결론만 표본 대조했고 전문 대조는 아니다 — 아래 "위험도" 는 이 한계를 반영한다.

## 발견사항

전수·표본 대조 결과, target 세 문서와 다른 영역 사이의 **직접 모순(CRITICAL)** 은
발견되지 않았다. `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 자체가 과거
여러 차례의 `--spec`/`--impl-prep`/`--impl-done` cross_spec 라운드에서 발견된 불일치를
그때그때 Rationale 로 정정·기록해 온 문서라(예: `ACCOUNT_LOCKED` 423→401 정정, §3.2 멤버
관리 CRU→CRUD 정정, §2.3 재인증 흐름 정합화, `INVALID_PASSWORD`→`PASSWORD_REQUIRED`/
`PASSWORD_INVALID` 은퇴 등), 이미 알려진 충돌 클래스는 대부분 소진된 상태였다. 대조한
구체 항목들:

- **RBAC 매트릭스 (§3.2) ↔ `2-navigation/6-config.md`**: Auth Config CRUD(Owner/Admin)·
  Reveal(Admin+)·Model Config Editor CRUD 가 config.md §A.4/R-7 과 정확히 일치.
- **RBAC 매트릭스 각주(Admin 멤버 삭제) ↔ `data-flow/12-workspace.md` §1.6/표**: "admin |
  ✓ (owner 제외)" 로 일치. `2-navigation/9-user-profile.md` §6.1 의 `DELETE
  /api/workspaces/:id/members/:memberId`(Admin+ / 자가 탈퇴는 leave 위임) 서술도 동일.
- **User 엔티티 필드 (§1.1/§1.4.1/§1.1.B) ↔ `1-data-model.md` §2.1**: `password_hash`,
  `totp_recovery_codes`, `webauthn_recovery_codes`, `pending_email`, `email_change_token`,
  `email_change_expires_at` 모두 DB 컬럼명·nullable 여부·용도 설명이 대응.
- **활성 워크스페이스 클레임(`activeWorkspaceId`, §2.2) / header-first 모델(§3.3) ↔
  `data-flow/12-workspace.md` §1.5 및 §Rationale**: dual-read, header-first 우선순위,
  `RolesGuard` 멤버십 검증 지점, UUID 검증 강도 비대칭 앵커까지 문구·근거가 일치.
- **에러 코드 카탈로그 (3-error-handling.md §1.2.1/§1.5/§1.9/§1.10) ↔ 도메인 SoT**:
  WS `7.1` 에러 코드 표(`INVALID_MESSAGE`/`UNKNOWN_TYPE`/`SUBSCRIPTION_LIMIT_EXCEEDED`/
  `RATE_LIMITED`/`INVALID_EXECUTION_STATE`), `conventions/error-codes.md` 의
  historical-artifact 레지스트리(초대 흐름 lowercase `forbidden`/`rate_limited`,
  `already_a_member`/`workspace_type_mismatch` vs UPPER_SNAKE 직접-추가 코드 분리),
  `INVALID_PASSWORD` rename 이력 — 전부 target 문서 서술과 status·설명이 일치.
  `conventions/audit-actions.md` 의 시제 3분류·레지스트리도 `1-auth.md §4.1`과 일치.
- **Rate limit 모델**: `2-api-convention.md §7` 의 "UserThrottlerGuard 는 `user:<sub>`
  키로 사용자당 집계, 미인증만 IP 폴백"과 `14-external-interaction-api.md`(EIA 는 워크스페이스
  JWT 가 아니라 인터랙션 토큰을 쓰므로 이 guard 관점에서 항상 미인증 취급 → "IP 기준 100/min")
  · `data-flow/2-auth.md`(`register`/`login` IP 10/min) 표현이 처음엔 상충하는 것처럼
  보였으나, EIA·register/login 이 모두 `req.user.sub` 가 없는 미인증 경로라는 점에서 "미인증만
  IP 폴백" 규칙의 하위 사례로 정합했다 — 충돌 아님(재확인 완료, 별도 조치 불요).
- **웹챗 위젯 refresh 쿠키 미의존 주장 (Rationale 2.3.B) ↔ `7-channel-web-chat/3-auth-session.md`**:
  위젯이 `iext_*` Bearer 토큰만 쓰고 per_trigger(`itk_*`)는 미지원이라는 서술과 정합.

발견된 명백한 모순은 없었으나, 리소스 제약상 `4-execution-engine.md`·
`14-external-interaction-api.md`·`15-chat-channel.md` 등 대형 파일은 앵커·표본만
대조했다 — 이 파일들의 세부 서술(특히 최근 변경분)까지 전수 검증하려면 별도 세션의
전문 대조가 필요하다.

## 요약

`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 세 문서는
RBAC·데이터 모델·JWT/워크스페이스 컨텍스트·에러 코드 카탈로그·rate-limit·감사 액션
규약 등 주요 교차 지점에서 `1-data-model.md`, `data-flow/12-workspace.md`,
`data-flow/2-auth.md`, `conventions/error-codes.md`, `conventions/audit-actions.md`,
`2-navigation/6-config.md`, `2-navigation/9-user-profile.md`, `6-websocket-protocol.md`,
`16-system-status-api.md`, `7-channel-web-chat/3-auth-session.md` 와 표본·전수 대조한
범위 내에서 모순 없이 정합했다. 이는 우연이 아니라, 문서 자체가 과거 다수의 cross-spec
라운드에서 발견된 불일치를 Rationale 로 즉시 흡수해 온 결과로 보인다. 다만 초대형
`5-system` 하위 파일(execution-engine·EIA·chat-channel·websocket)은 컨텍스트 예산상
전문 대조를 못했으므로, 그 파일들이 구체적으로 변경되는 후속 작업에서는 별도의
집중 cross-spec 대조가 여전히 필요하다.

## 위험도

LOW — 확인 가능한 범위 내에서 CRITICAL/WARNING 급 교차-스펙 모순 없음. 대형 미대조
파일이 존재해 NONE 이 아니라 LOW 로 표기.
