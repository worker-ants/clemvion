# Cross-Spec 일관성 검토 — catalog-residual-codes

target: `plan/in-progress/catalog-residual-codes.md` (spec draft: `spec/5-system/1-auth.md` §5 note 신규, `spec/5-system/3-error-handling.md` §1.2·§1.2.1·주석·Rationale 갱신)

## 발견사항

없음. target 이 등재하는 3코드(`NOT_A_MEMBER` 403 · `INVALID_PASSWORD` 401 · `PASSWORD_REQUIRED` 401)와 그 배치(§1.2 vs §1.2.1)를 아래 다른 영역과 대조했으나 모순을 찾지 못했다.

- **데이터 모델 (`spec/1-data-model.md`)** — `LoginHistory.failure_reason` 에 이미 `INVALID_PASSWORD`(§2.18.2) 감사값이 존재한다. target 의 §1.2 신규 행(`INVALID_PASSWORD`, changePassword API 코드)은 이 감사값과 동명이나, target 표 설명에 "`login_history.failure_reason` 동명값과 별개" 로 명시 disambiguation 을 포함해 데이터 모델과 충돌하지 않는다. `WorkspaceMember.role`(owner/admin/editor/viewer) 등 RBAC 구조도 target 의 `NOT_A_MEMBER` 403(비멤버 검증 실패, 역할과 무관한 멤버십 자체 검증)과 겹치지 않는다.
- **API 계약** — target 이 참조하는 엔드포인트(`POST /api/auth/2fa/disable`, `POST /api/auth/2fa/webauthn/recovery-codes/regenerate`, `POST /api/auth/workspaces/:id/switch`, `POST /users/me/change-password`)를 실제 `spec/5-system/1-auth.md` §5 API 표와 대조 확인 — 경로·설명 모두 기존 문서와 일치한다. `POST /api/auth/workspaces/:id/switch` 행은 이미 "비멤버 `403 NOT_A_MEMBER`" 를 명시 중이며, `spec/data-flow/12-workspace.md` §1.5(라인 111~123)도 동일하게 `403 NOT_A_MEMBER` 를 기술한다 — target 은 기존에 이미 산재해 있던 사실을 공용 카탈로그(`3-error-handling.md`)에 등재만 하는 것으로 신규 모순 없음.
- **요구사항 ID** — target 은 신규 요구사항 ID(`NAV-*`/`ED-*`/`ND-*` 류)를 발행하지 않는다. 해당 없음.
- **상태 전이** — `Integration.status`, `Execution.status` 등 다른 영역 상태 머신과 무관. 해당 없음.
- **권한·RBAC** — `NOT_A_MEMBER` 는 역할(role) 기반이 아니라 멤버십 존재 여부 검증이라 `spec/2-navigation/9-user-profile.md` §4.2 역할·권한 매트릭스, `spec/0-overview.md` §6.1 워크스페이스 RBAC 서술과 겹치는 층위가 다르다. 충돌 없음.
- **범위 경계** — target 은 "범위 밖"에 workspace 직접-추가 경로 코드(`ALREADY_A_MEMBER`/`WORKSPACE_TYPE_MISMATCH`)를 명시적으로 제외했다. 이는 `spec/conventions/error-codes.md`(§3 historical artifact registry)·`spec/data-flow/12-workspace.md`(§1.2·§1.9)가 이미 이 코드들을 **별개 wire 코드**(lowercase 초대 흐름 vs UPPER_SNAKE 직접-추가 경로)로 문서화한 것과 정합 — target 이 이 경계를 넘어 혼입 등재하지 않는다.
- **계층 책임** — `1-auth.md`(도메인 SoT) / `3-error-handling.md`(공용 카탈로그 가시성 등재)의 기존 "도메인 spec 참조" 패턴(§1.5~§1.8 선례)을 그대로 따른다. 새 원칙 도입이 아니다.
- **plan 트래킹 참고 (경미, spec 충돌 아님)** — `plan/in-progress/error-codes-catalog-sot.md` L56 은 후속 항목으로 `NOT_A_MEMBER`·`INVALID_PASSWORD` 두 코드만 명시하고 `PASSWORD_REQUIRED` 는 문구에 없다(실제 deferred 마커는 `3-error-handling.md` §1.2.1 하단 주석에 3코드 모두 존재하며 이것이 SoT). target 자체 워크플로 체크리스트가 "L56 체크박스 갱신(`PASSWORD_REQUIRED` 흡수 명시)"을 이미 후속 작업으로 포함하고 있어 별도 조치 불필요.

## 요약

target 이 등재하려는 3개 에러 코드(`NOT_A_MEMBER`/`INVALID_PASSWORD`/`PASSWORD_REQUIRED`)와 그 §1.2/§1.2.1 섹션 배치를, 프롬프트에 포함된 `spec/0-overview.md`·`spec/1-data-model.md` 전문과, 실제 리포지토리의 `spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md`·`spec/data-flow/12-workspace.md`·`spec/conventions/error-codes.md` 원문을 직접 대조 확인했다. 모든 엔드포인트 경로·앵커·HTTP status·기존 감사값과의 disambiguation 이 실제 spec 상태와 정확히 일치하며, 새로 발행하는 요구사항 ID·데이터 모델 필드·RBAC 규칙·상태 머신도 없다. 이는 이미 도메인 spec(`1-auth.md`, `data-flow/12-workspace.md`)에 분산 기술돼 있던 사실을 공용 카탈로그(`3-error-handling.md`)에 기존 "도메인 spec 참조" 패턴(§1.5~§1.8 선례)으로 등재만 하는 순수 문서 정합화 pass이며, 다른 spec 영역과의 충돌 소지가 발견되지 않았다.

## 위험도
NONE
