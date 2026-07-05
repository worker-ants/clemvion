# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-prep)

## 검토 개요

target 페이로드는 `spec/5-system/` 영역 전체(1-auth.md 를 포함한 다수 문서)를 구현 착수 전 점검 대상으로 담고 있다. 이 중 이번 작업(invite-accept-confirm-ui)과 직접 관련된 신규 식별자 후보는 §1.5 "초대 토큰 흐름"(`1-auth.md`)의 엔드포인트·에러 코드·엔티티·환경변수·감사 액션이다. 이 문서들은 frontmatter `status: partial` 로 이미 대부분 구현되어 있어(`WorkspaceInvitation` 엔티티, `workspace-invitations.service.ts`, `invitations.controller.ts`, frontend `invitations.ts` 등), 전형적인 "spec 신규 초안"과 달리 대부분의 후보 식별자가 기존 코드베이스·타 spec 문서와 이미 정합적으로 교차 참조되어 있음을 확인했다. 아래는 점검 관점별 결과다.

## 발견사항

### 1. 요구사항 ID 충돌 — 해당 없음

target 은 `id: auth` (frontmatter) 를 그대로 유지하며 새 요구사항 ID를 도입하지 않는다. Graph RAG(§10) 문서도 이미 등록된 ID 체계를 따른다. 신규 ID 충돌 없음.

### 2. 엔티티/타입명 충돌 — 해당 없음 (검증됨)

- `WorkspaceInvitation` — `spec/5-system/1-auth.md`, `spec/data-flow/8-notifications.md`, `spec/data-flow/12-workspace.md`, `spec/data-flow/0-overview.md`, `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts` 등 전 영역에서 동일 의미(워크스페이스 초대 레코드)로 일관되게 쓰인다. 충돌 없음.
- Graph RAG 의 `Entity`/`Relation`/`ChunkEntity`(신규 표시, §2.3~2.5) 는 `spec/1-data-model.md §2.12.2~2.12.4` 에 이미 동일 정의로 통합되어 있어 "새 이름이 기존 다른 의미와 충돌"하는 경우가 아니라 같은 SoT를 참조하는 정상 배치다.

### 3. API endpoint 충돌 — WARNING (경미, 의도된 이중 참조)

- **target 신규/참조 식별자**: `GET /api/invitations/:token`
- **기존 사용처**: `spec/2-navigation/9-user-profile.md:349` (§6.1 사용자·워크스페이스 API 표) 와 `spec/5-system/1-auth.md:481`(§5 API 엔드포인트 표) 두 곳에 동일 엔드포인트가 각각 정의되어 있다.
- **상세**: 두 정의는 설명("인증 불요, 가입 페이지 prefill, 만료·invalidated 시 410")이 동일하며, `1-auth.md:487` 에서 나머지 초대 엔드포인트(발송/재발송/취소/수락)는 "정의는 9-user-profile.md §6.1" 이라고 명시적으로 포인터 처리했다. 그러나 `GET /api/invitations/:token` 만은 포인터 문장 밖에 남아 두 문서 모두에 표 형태로 중복 기재되어 있다 — 다른 초대 엔드포인트와 다르게 이 한 줄만 "중복 정의 금지" 원칙(§Overview: "인접 엔드포인트는 각 SoT 문서를 포인터로 참조한다(중복 정의 금지)")의 예외로 남아있다.
- **제안**: `1-auth.md §5` 표에서 `GET /api/invitations/:token` 행도 다른 초대 엔드포인트처럼 "정의는 9-user-profile.md §6.1" 포인터 문장으로 흡수하거나, 반대로 9-user-profile.md 쪽을 포인터로 바꿔 단일 SoT를 명확히 하면 향후 두 문서가 독립적으로 수정되며 벌어질 드리프트를 예방할 수 있다. (기능적 충돌은 아니며 문서 구조상 결이 어긋난 정도라 WARNING 등급.)

### 4. 이벤트/메시지명 충돌 — 해당 없음

초대 흐름은 webhook·queue·SSE 이벤트를 발생시키지 않는다(§1.5 흐름은 REST + 트랜잭션 기반). Graph RAG §6 WebSocket 이벤트도 기존 `spec/5-system/6-websocket-protocol.md` 네임스페이스와 겹치는지 확인했으나 별도 accept/invite 관련 이벤트명 도입은 없다. 충돌 없음.

### 5. 환경변수·설정키 충돌 — 해당 없음

초대 흐름 자체는 신규 ENV 를 도입하지 않는다(시스템 SMTP 재사용, `WEBAUTHN_*` 계열은 §1.4.3 소관으로 무관 영역). `INVITATION_THROTTLE` 은 상수명이며 `codebase/backend/src/common/constants/throttle.ts` 의 `SENSITIVE_ACTION_THROTTLE` 별칭임이 `spec/5-system/2-api-convention.md:199`, `spec/5-system/1-auth.md:228`, `spec/data-flow/12-workspace.md:71`, 실제 코드(`workspaces.controller.ts:61`) 전부 일치해 충돌 없음.

### 6. 파일 경로 충돌 — 해당 없음

target 은 기존 `spec/5-system/1-auth.md` 등 기존 파일을 그대로 사용하며 신규 파일 경로를 도입하지 않는다. `plan/in-progress/spec-sync-auth-gaps.md` 참조 경로도 기존 컨벤션과 일치.

### 참고 — historical-artifact 명명 예외 (신규 충돌 아님, 재확인)

`invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · (초대 API 한정) `forbidden` · `rate_limited` 는 `UPPER_SNAKE_CASE` 표준과 다른 `lower_snake_case` 이나, 이는 `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 이미 등재되어 문서화된 의도적 예외다(1-auth.md §1.5.4 각주가 동일 근거를 재인용). 신규 코드에 이 lowercase 패턴을 확산시키지 말라는 경고까지 스스로 명시하고 있어 별도 CRITICAL/WARNING 사유가 아니다. INFO 수준 재확인만 남긴다: 향후 이 영역에 새 에러 코드를 추가할 때 실수로 lowercase 패턴을 답습하지 않도록 구현자에게 상기시키는 것이 좋다(이미 spec 에 명시되어 있으므로 추가 조치 불필요).

## 요약

이번 target(`spec/5-system/`, 특히 §1.5 초대 토큰 흐름)은 신규 스펙 초안이 아니라 이미 부분 구현된(`status: partial`) 기존 영역이며, 후보로 검토한 요구사항 ID·엔티티명·에러 코드·환경변수·감사 액션·파일 경로 전부가 코드베이스(`workspace-invitations.service.ts`, `invitations.controller.ts`, `invitations.ts` 등)와 타 spec 문서(`9-user-profile.md`, `data-flow/12-workspace.md`, `conventions/error-codes.md`)에 걸쳐 일관되게 교차 참조됨을 확인했다. 유일하게 발견된 사항은 `GET /api/invitations/:token` 엔드포인트가 "중복 정의 금지" 원칙의 예외로 `1-auth.md`·`9-user-profile.md` 두 곳에 표로 남아있는 구조적 결(WARNING)이며, 이는 의미 충돌이 아니라 SoT 일원화 권고 수준이다. CRITICAL 등급 신규 식별자 충돌은 발견되지 않았다.

## 위험도

LOW
