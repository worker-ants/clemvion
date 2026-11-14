---
id: "CLE-ACCT-WS"
title: "워크스페이스와 멤버"
type: "feature"
version: 25
status: "approved"
requirements: ["REQ-WSPACE-001", "REQ-WSPACE-002", "REQ-WSPACE-003", "REQ-WSPACE-004", "REQ-WSPACE-005", "REQ-WSPACE-006", "REQ-WSPACE-007", "REQ-WSPACE-008", "REQ-WSPACE-009", "REQ-WSPACE-010", "REQ-WSPACE-011", "REQ-WSPACE-012", "REQ-WSPACE-013", "REQ-WSPACE-014", "REQ-WSPACE-015", "REQ-WSPACE-016", "REQ-WSPACE-017", "REQ-WSPACE-018", "REQ-WSPACE-019", "REQ-WSPACE-020", "REQ-WSPACE-021", "REQ-WSPACE-022", "REQ-WSPACE-023", "REQ-WSPACE-024", "REQ-WSPACE-025", "REQ-WSPACE-026", "REQ-WSPACE-027", "REQ-WSPACE-028", "REQ-WSPACE-029", "REQ-WSPACE-030", "REQ-WSPACE-031", "REQ-WSPACE-032", "REQ-WSPACE-033", "REQ-WSPACE-034", "REQ-WSPACE-035", "REQ-WSPACE-036", "REQ-WSPACE-037", "REQ-WSPACE-038", "REQ-WSPACE-039", "REQ-WSPACE-040", "REQ-WSPACE-041", "REQ-WSPACE-042", "REQ-WSPACE-043", "REQ-WSPACE-044", "REQ-WSPACE-045", "REQ-WSPACE-046", "REQ-WSPACE-047", "REQ-WSPACE-048", "REQ-WSPACE-049", "REQ-WSPACE-050", "REQ-WSPACE-051", "REQ-WSPACE-052", "REQ-WSPACE-053", "REQ-WSPACE-054", "REQ-WSPACE-055", "REQ-WSPACE-056", "REQ-WSPACE-057", "REQ-WSPACE-058", "REQ-WSPACE-059", "REQ-WSPACE-060", "REQ-WSPACE-061", "REQ-WSPACE-062", "REQ-WSPACE-063", "REQ-WSPACE-064", "REQ-WSPACE-065", "REQ-WSPACE-066", "REQ-WSPACE-067", "REQ-WSPACE-068", "REQ-WSPACE-069", "REQ-WSPACE-070", "REQ-WSPACE-071", "REQ-WSPACE-072", "REQ-WSPACE-073"]
basis_superseded: false
parent: "CLE-ACCT"
ancestors: ["CLE-VISION", "CLE-ACCT"]
area: "CLE-ACCT"
content_hash: "de959f17638c9a1d9e58ed7367d0fc8ca9958b2aba7e32f3fef46db6ae6bbfe6"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/0-overview.md", "spec/2-navigation/10-auth-flow.md", "spec/2-navigation/9-user-profile.md", "spec/5-system/1-auth.md", "spec/data-flow/12-workspace.md"]
mirror_sha256: "ae4ddd29d4dc5a33f7c2851653aa5d2224c91125279588e29e48f5b9f4893b90"
etag: "sha256-1233b0dc4d3dc55fef91938792dcc6b5e61eaaa5a9b5628aa78b4a84af5ac404"
---
> 구현 상태: 구현됨 · 원문: `spec/5-system/1-auth.md` (§1.5, §3, §5 전환·초대 행, Rationale 1.5.A~D·멤버 관리 정정·부트 캐너리), `spec/2-navigation/9-user-profile.md` (§3, §4, §6.1 워크스페이스 행), `spec/2-navigation/10-auth-flow.md` (§2.6, §6), `spec/0-overview.md` (§4 사용 단위), `spec/data-flow/12-workspace.md` (규칙·Rationale 중 인가와 멤버 관리 부분) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

워크스페이스(Workspace, `workspace`)는 워크플로우·통합·지식 저장소·모델 설정 같은 모든 리소스를 격리하는 단위다. 이 문서는 워크스페이스를 만들고 전환하고 설정하는 방법, 멤버(Member, `WorkspaceMember`)와 초대(Invitation, `WorkspaceInvitation`), 역할(Role, `WorkspaceMember.role`)과 권한 매트릭스(RBAC matrix, `RolesGuard`), 그리고 서버가 요청마다 워크스페이스와 역할을 판정하는 인가 규칙을 정한다.

제품은 두 가지 사용 단위를 지원한다.

- 개인: 개인 워크스페이스(personal workspace, `Workspace.type=personal`)에서 혼자 워크플로우를 만들고 관리한다. 개인 워크스페이스는 가입할 때 자동으로 생기고 사용자마다 하나다.
- 팀·조직: 팀 워크스페이스(team workspace, `Workspace.type=team`)에서 워크플로우를 공유하고, 역할과 권한을 관리하고, 공통 통합 설정을 함께 쓴다. 한 사용자가 여러 팀 워크스페이스에 속하고 여러 팀 워크스페이스를 소유할 수 있다.

범위 밖 주제는 다음 문서가 정한다.

- 액세스 토큰 구조와 `activeWorkspaceId` 클레임 이름: [세션과 토큰](CLE-ACCT-SESSION.md)
- 초대 없이 하는 가입·로그인: [가입과 로그인](CLE-ACCT-SIGNIN.md)
- 테이블 컬럼, 서버 시퀀스, 초대 상태 전이, 보존 배치: [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md)
- `/w/<slug>` 슬러그 라우팅과 옛 경로 흡수 라우트(catch-all route): [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md)
- 워크스페이스·멤버 감사 액션: [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)
- 임베드 허용 도메인의 CORS·임베드 검증 동작: [웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md)
- 동시 실행 제한(`maxConcurrentExecutions`) 동작: [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md)
- API 공통 규약과 워크스페이스 스코핑: [HTTP API 규약](../CLE-API/CLE-API-CONV.md)

## 요구사항

- REQ-WSPACE-001 WHEN 사용자가 이메일 인증을 마치거나 처음 소셜 로그인하면 THE SYSTEM SHALL 개인 워크스페이스를 자동으로 만들고 그 사용자를 소유자로 넣는다.
- REQ-WSPACE-002 IF 사용자가 초대 토큰으로 가입하면 THE SYSTEM SHALL 개인 워크스페이스를 만들지 않고 초대받은 팀 워크스페이스를 현재 워크스페이스로 삼는다.
- REQ-WSPACE-003 WHEN 개인 워크스페이스를 만들면 THE SYSTEM SHALL 이름을 "{사용자 이름}'s Workspace" 로, 슬러그를 이메일 로컬 파트와 랜덤 4자리로 정한다.
- REQ-WSPACE-004 IF 한 사용자에게 두 번째 개인 워크스페이스를 만들려 하면 THE SYSTEM SHALL DB 부분 유니크 인덱스와 앱의 find-or-create 로 막는다.
- REQ-WSPACE-005 WHEN 사용자가 팀 워크스페이스를 만들면 THE SYSTEM SHALL 서버에서 종류를 `team` 으로 고정하고 슬러그를 `team-<uuid 앞 8자>` 로 만들고 요청자를 소유자로 넣는다.
- REQ-WSPACE-006 WHEN 워크스페이스 이름을 바꾸면 THE SYSTEM SHALL 슬러그를 바꾸지 않는다.
- REQ-WSPACE-007 WHEN 사용자가 워크스페이스 전환 블록에서 워크스페이스를 고르면 THE SYSTEM SHALL 바로 전환하고 `/w/<slug>/dashboard` 로 이동한다. (원본: NAV-UP-04)
- REQ-WSPACE-008 WHEN 워크스페이스 전환을 요청받으면 THE SYSTEM SHALL 대상 멤버십을 확인한 뒤 `activeWorkspaceId` 만 바꾼 액세스 토큰을 재발급하고 리프레시 토큰은 회전하지 않는다.
- REQ-WSPACE-009 IF 멤버가 아닌 워크스페이스로 전환하려 하면 THE SYSTEM SHALL 403 `NOT_A_MEMBER` 로 거부한다.
- REQ-WSPACE-010 WHEN `/w/<slug>` 화면을 처음 불러올 때 URL 의 워크스페이스가 저장된 현재 워크스페이스와 다르면 THE SYSTEM SHALL URL 을 기준으로 전환을 다시 맞춘다.
- REQ-WSPACE-011 IF URL 슬러그가 무효하거나 멤버가 아닌 워크스페이스를 가리키면 THE SYSTEM SHALL 기본 워크스페이스로 보낸다.
- REQ-WSPACE-012 WHEN 워크스페이스를 전환하면 THE SYSTEM SHALL 사이드바 메뉴의 데이터 범위를 고른 워크스페이스로 바꾼다.
- REQ-WSPACE-013 WHEN 멤버가 `/workspace/settings` 를 열면 THE SYSTEM SHALL 워크스페이스 종류 아이콘·이름·설명과 개요·멤버·위험 영역 탭을 보여 준다. (원본: NAV-UP-05)
- REQ-WSPACE-014 IF 사용자가 관리자 이상이 아니면 THE SYSTEM SHALL 개요 탭의 이름과 임베드 허용 도메인을 읽기 전용으로 보여 준다.
- REQ-WSPACE-015 WHEN 관리자 이상이 워크스페이스 설정을 바꾸면 THE SYSTEM SHALL 보낸 키만 `settings` 에 부분 병합하고 다른 키를 보존한다.
- REQ-WSPACE-016 IF 임베드 허용 도메인 항목이 `http(s)://host[:port]` 형식이 아니거나 path·query 를 담으면 THE SYSTEM SHALL 그 설정 변경을 거부한다.
- REQ-WSPACE-017 WHEN 임베드 허용 도메인 목록이 비어 있으면 THE SYSTEM SHALL `/api/external/*` CORS 에 built-in 위젯 origin 만 허용한다.
- REQ-WSPACE-018 IF 기본 시간대 값이 IANA 식별자가 아니면 THE SYSTEM SHALL 거부하고, 빈 문자열이면 설정을 지운다.
- REQ-WSPACE-019 WHEN 멤버가 워크스페이스 설정을 조회하면 THE SYSTEM SHALL 뷰어를 포함한 모든 멤버에게 돌려주고 비멤버는 403 `NOT_A_MEMBER` 로 막는다.
- REQ-WSPACE-020 WHEN 관리자 이상이 워크스페이스 이름을 바꾸면 THE SYSTEM SHALL 2~100자 이름만 받는다.
- REQ-WSPACE-021 WHEN 관리자 이상이 이메일로 초대하면 THE SYSTEM SHALL 64자 일회용 초대 토큰을 만들고 7일 만료로 시스템 SMTP 메일을 보낸다.
- REQ-WSPACE-022 IF 같은 워크스페이스와 이메일에 대기 중 초대가 있으면 THE SYSTEM SHALL 새 행을 만들지 않고 그 행의 토큰·역할·초대자·만료를 바꿔 옛 토큰을 무효로 만든다.
- REQ-WSPACE-023 IF 초대 대상 이메일이 이미 멤버이면 THE SYSTEM SHALL 409 `already_a_member` 로 거부한다.
- REQ-WSPACE-024 IF 개인 워크스페이스에서 초대하면 THE SYSTEM SHALL 403 `workspace_type_mismatch` 로 거부한다.
- REQ-WSPACE-025 WHEN 관리자 이상이 대기 중 초대를 재발송하면 THE SYSTEM SHALL 새 토큰을 발급하고 만료를 발급 시점부터 7일로 다시 잡고 메일을 다시 보낸다.
- REQ-WSPACE-026 WHEN 관리자 이상이 대기 중 초대를 취소하면 THE SYSTEM SHALL 그 초대 행을 물리 삭제한다.
- REQ-WSPACE-027 IF 이미 수락한 초대를 재발송하거나 취소하려 하면 THE SYSTEM SHALL 409 `invitation_already_accepted` 로 거부한다.
- REQ-WSPACE-028 WHEN 초대를 수락하거나 초대 토큰으로 가입하면 THE SYSTEM SHALL 로그인·가입 사용자 이메일이 초대 이메일과 같은지 확인하고 다르면 400 `invitation_email_mismatch` 로 거부한다.
- REQ-WSPACE-029 IF 초대 토큰이 없거나 형식이 틀리면 THE SYSTEM SHALL 404 `invitation_not_found` 로 거부한다.
- REQ-WSPACE-030 IF 초대 토큰이 만료됐거나 이미 쓰였으면 THE SYSTEM SHALL 410 `invitation_expired` 나 410 `invitation_already_used` 로 거부한다.
- REQ-WSPACE-031 WHEN 초대를 수락하면 THE SYSTEM SHALL `accepted_at IS NULL` 조건부 갱신으로 한 번만 소비하고 멤버십 추가와 한 트랜잭션으로 처리한다.
- REQ-WSPACE-032 WHEN 미가입자가 초대 링크로 가입하면 THE SYSTEM SHALL 사용자 생성·멤버십 추가·초대 수락을 한 트랜잭션으로 처리하고 실패하면 모두 되돌린다.
- REQ-WSPACE-033 WHEN 가입 페이지가 초대 토큰을 받으면 THE SYSTEM SHALL 초대 메타를 미리 조회해 이메일 입력란을 채우고 읽기 전용으로 고정한다.
- REQ-WSPACE-034 IF 이미 로그인한 사용자가 초대 가입 링크를 열면 THE SYSTEM SHALL 가입 폼 대신 초대 수락 페이지로 보낸다.
- REQ-WSPACE-035 IF 로그인 사용자 이메일과 초대 이메일이 대소문자를 구분하지 않고 비교해도 다르면 THE SYSTEM SHALL 수락 페이지에 초대 대상 이메일 안내와 «다른 계정으로 로그인»(로그아웃) 버튼만 보여 준다.
- REQ-WSPACE-036 WHEN 초대 발급·재발송을 요청받으면 THE SYSTEM SHALL 분당 10건으로 제한하고, 공개 초대 메타 조회는 분당 30건으로 제한한다.
- REQ-WSPACE-037 WHEN 매일 04:00(Asia/Seoul)이 되면 THE SYSTEM SHALL 만료되고 수락되지 않은 초대 행을 지운다.
- REQ-WSPACE-038 WHEN 관리자 이상이 이미 가입한 사용자를 이메일로 직접 추가하면 THE SYSTEM SHALL 메일 없이 바로 그 사용자를 팀 워크스페이스 멤버로 넣는다.
- REQ-WSPACE-039 IF 직접 추가 대상 이메일이 가입하지 않았으면 THE SYSTEM SHALL 404 `USER_NOT_FOUND` 로 거부하고 초대를 쓰게 한다.
- REQ-WSPACE-040 IF 직접 추가에서 소유자 역할을 지정하면 THE SYSTEM SHALL 403 `CANNOT_ASSIGN_OWNER` 로 거부한다.
- REQ-WSPACE-041 IF 역할 변경 대상이 소유자이거나 부여하려는 역할이 소유자면 THE SYSTEM SHALL `OWNER_ROLE_PROTECTED` 로 막고 소유자 이양을 쓰게 한다.
- REQ-WSPACE-042 IF 관리자 이상이 소유자를 멤버에서 제거하려 하면 THE SYSTEM SHALL `CANNOT_REMOVE_OWNER` 로 거부한다.
- REQ-WSPACE-043 WHEN 멤버 제거 대상이 요청자 자신이면 THE SYSTEM SHALL 워크스페이스 나가기로 넘긴다.
- REQ-WSPACE-044 IF 유일한 소유자가 팀 워크스페이스를 나가려 하면 THE SYSTEM SHALL 403 `SOLE_OWNER_CANNOT_LEAVE` 로 막는다.
- REQ-WSPACE-045 IF 개인 워크스페이스에서 나가거나 삭제하려 하면 THE SYSTEM SHALL 403 `CANNOT_LEAVE_PERSONAL` 이나 `CANNOT_DELETE_PERSONAL` 로 거부한다.
- REQ-WSPACE-046 WHEN 소유자가 소유자 이양을 하면 THE SYSTEM SHALL 한 트랜잭션에서 대상 멤버를 소유자로, 기존 소유자를 관리자로 바꾸고 `workspace.owner_id` 를 대상 사용자로 맞춘다.
- REQ-WSPACE-047 IF 소유자 이양 대상이 자기 자신이면 THE SYSTEM SHALL 400 `TARGET_IS_SELF` 로, 이미 소유자면 409 `TARGET_ALREADY_OWNER` 로 거부한다.
- REQ-WSPACE-048 WHEN 소유자가 팀 워크스페이스 삭제를 확인하면 THE SYSTEM SHALL 트리거 외부 자원을 해제한 뒤 초대·멤버·워크스페이스를 한 트랜잭션에서 지운다.
- REQ-WSPACE-049 WHEN 서버가 역할을 비교하면 THE SYSTEM SHALL 소유자·관리자·편집자·뷰어 순의 계층으로 보고 위 역할이 아래 역할의 권한을 모두 갖게 한다.
- REQ-WSPACE-050 IF 뷰어가 워크플로우 실행을 요청하면 THE SYSTEM SHALL 403 으로 거부한다.
- REQ-WSPACE-051 WHEN 인증된 요청이 워크스페이스 컨텍스트를 쓰면 THE SYSTEM SHALL `X-Workspace-Id` 헤더가 있으면 그 값을, 없으면 토큰의 `activeWorkspaceId` 를 현재 워크스페이스로 쓴다.
- REQ-WSPACE-052 IF 토큰의 워크스페이스 클레임이 없거나 그 멤버십이 사라졌으면 THE SYSTEM SHALL 개인 워크스페이스, 없으면 첫 멤버십을 현재 워크스페이스로 쓴다.
- REQ-WSPACE-053 WHEN 요청이 헤더로 워크스페이스를 지정하고 라우트가 `@WorkspaceId()` 를 쓰는 라우트(`@Roles()` 가 없어도 된다)이거나 경로 파라미터로 받는 워크스페이스(`@WorkspaceParam(...)`) 없이 `@Roles()` 를 쓰는 라우트이면 THE SYSTEM SHALL 가드에서 그 워크스페이스의 멤버십을 확인한다.
- REQ-WSPACE-054 WHEN 라우트가 경로 파라미터로 워크스페이스를 받으면 THE SYSTEM SHALL 헤더·토큰이 아니라 경로 값을 인가 대상으로 삼아 멤버십을 항상 조회한다.
- REQ-WSPACE-055 IF 요청자가 대상 워크스페이스 멤버가 아니거나 워크스페이스가 없으면 THE SYSTEM SHALL 둘을 구분하지 않고 403 `NOT_A_MEMBER` 로 거부한다.
- REQ-WSPACE-056 IF 멤버의 역할이 라우트 요구 역할보다 낮으면 THE SYSTEM SHALL 403 `EDITOR_REQUIRED`·`ADMIN_REQUIRED`·`OWNER_REQUIRED` 중 요구 역할에 맞는 코드로 거부한다.
- REQ-WSPACE-057 IF `@WorkspaceId()` 를 쓰는 라우트이거나 경로 파라미터로 받는 워크스페이스(`@WorkspaceParam(...)`) 없이 `@Roles()` 를 쓰는 라우트에서 `X-Workspace-Id` 헤더가 UUID 형태가 아니면 THE SYSTEM SHALL 400 `VALIDATION_ERROR` 로 거부한다. `@Roles()` 없이 `@WorkspaceId()` 를 쓰는 라우트에서 헤더와 클레임이 모두 없으면 400 `WORKSPACE_ID_REQUIRED` 로 거부한다.
- REQ-WSPACE-058 WHEN 서버가 부팅하면 THE SYSTEM SHALL 워크스페이스 파라미터를 소비하는 라우트 수를 세고 0 이면 기동을 멈춘다.
- REQ-WSPACE-059 IF 컨트롤러 핸들러가 이름이 `workspaceId` 이거나 `WorkspaceId` 로 끝나는 파라미터를 `@Param` 으로 받으면 THE SYSTEM SHALL 저장소 가드로 CI 를 실패시킨다.
- REQ-WSPACE-060 WHEN 초대 메일을 보내면 THE SYSTEM SHALL 메일 링크를 `/register?invitationToken=<url 인코딩된 토큰>` 으로 만든다.
- REQ-WSPACE-061 IF 소유자가 아닌 멤버가 대상 멤버의 현재 역할이나 새 역할이 관리자인 역할 변경을 요청하면 THE SYSTEM SHALL 대상이 요청자 자신이어도 역할을 바꾸지 않고 403 `OWNER_REQUIRED` 로 거부한다.
- REQ-WSPACE-062 IF 소유자가 아닌 멤버가 직접 추가나 초대에서 관리자 역할을 지정하면 THE SYSTEM SHALL 멤버십이나 초대를 만들지 않고 403 `OWNER_REQUIRED` 로 거부한다.
- REQ-WSPACE-063 IF 소유자가 아닌 멤버가 관리자 역할로 대기 중인 초대가 있는 이메일을 다시 초대하면 THE SYSTEM SHALL 그 대기 중 초대를 바꾸지 않고 403 `OWNER_REQUIRED` 로 거부한다.
- REQ-WSPACE-064 WHEN 초대를 수락하거나 초대 토큰으로 가입하면 THE SYSTEM SHALL 초대를 보낸 사람의 지금 역할을 다시 확인하지 않고 초대 행의 역할로 멤버십을 만든다.
- REQ-WSPACE-065 IF 소유자가 아닌 관리자가 멤버 탭을 열면 THE SYSTEM SHALL 초대와 역할 변경의 역할 선택지에서 관리자를 빼고 관리자 멤버의 역할을 읽기 전용 배지로 보여 준다.
- REQ-WSPACE-066 IF 로그인 힌트 쿠키(`has_session`)가 없는 사용자가 초대 가입 링크를 열고 토큰 메타 조회 뒤 `POST /api/auth/check-email` 이 초대 이메일을 가입된 이메일로 답하면 THE SYSTEM SHALL 가입 폼 대신 `/login?redirect=<인코딩한 /invitations/accept?token=…>` 로 보낸다.
- REQ-WSPACE-067 IF 초대 토큰 가입이 토큰 이메일 중복으로 거부되면 THE SYSTEM SHALL 사용자를 `/login?redirect=<인코딩한 /invitations/accept?token=…>` 로 보낸다.
- REQ-WSPACE-068 IF 초대 가입 화면의 가입 여부 확인(`POST /api/auth/check-email`)이 실패하거나(429 · 네트워크 에러) 5초 안에 끝나지 않으면 THE SYSTEM SHALL 가입되지 않은 이메일로 보고 가입 폼을 보여 준다.
- REQ-WSPACE-069 WHEN 나가기나 멤버 제거 확인 다이얼로그를 보이면 THE SYSTEM SHALL 그 멤버가 이 워크스페이스에 둔 개인 통합도 함께 지워진다는 문장을 보인다. 개인 통합이 있는지와 그 개수는 보이지 않고 늘 같은 문장을 보인다.
- REQ-WSPACE-070 WHEN 멤버 직접 추가나 초대가 대상 이메일로 기존 계정을 찾으면 THE SYSTEM SHALL [가입과 로그인 「이메일 비교 규칙」](CLE-ACCT-SIGNIN.md#이메일-비교-규칙)대로 입력의 앞뒤 공백을 지우고 대소문자를 구분하지 않고 찾는다.
- REQ-WSPACE-071 IF 직접 추가 대상 이메일에 대소문자만 다른 계정이 둘 이상 맞고 입력과 대소문자까지 같은 계정이 없으면 THE SYSTEM SHALL 가입하지 않은 이메일과 같은 404 `USER_NOT_FOUND` 로 거부한다.
- REQ-WSPACE-072 IF 초대 대상 이메일에 대소문자만 다른 계정이 둘 이상 맞고 입력과 대소문자까지 같은 계정이 없으면 THE SYSTEM SHALL 가입하지 않은 이메일처럼 멤버 여부를 확인하지 않고 인앱 알림 `team_invite` 없이 초대 메일만 보낸다.
- REQ-WSPACE-073 WHEN 사용자가 초대 가입 화면의 가입 폼 아래 «로그인» 링크를 누르면 THE SYSTEM SHALL `/login?redirect=<인코딩한 /invitations/accept?token=…>` 로 보낸다.

## 하위 문서

- [워크스페이스와 멤버 — 생성 · 전환 · 설정 · API](CLE-ACCT-WS-SPACE.md): 워크스페이스 종류와 생성, 전환과 토큰 재발급, 관리 화면, 임베드 허용 도메인, 워크스페이스 설정, API 목록. 요구사항: REQ-WSPACE-001~020, 052
- [워크스페이스와 멤버 — 멤버 관리와 역할](CLE-ACCT-WS-MEMBER.md): 직접 추가, 역할 변경, 제거, 소유자 이양, 나가기와 삭제, 관리자 역할 규칙, 역할 계층과 권한 매트릭스. 요구사항: REQ-WSPACE-038~050, 061~065, 069~071
- [워크스페이스와 멤버 — 초대](CLE-ACCT-WS-INVITE.md): 초대 토큰 정책, 미가입자 가입 경로, 이미 가입한 사용자의 수락 경로, 초대 가입 화면, 초대 에러 코드. 요구사항: REQ-WSPACE-021~037, 060, 066~068, 072, 073
- [워크스페이스와 멤버 — API 인가](CLE-ACCT-WS-AUTHZ.md): 현재 워크스페이스 판정, 가드의 멤버십 검증, 경로 파라미터 워크스페이스, 가드 거부 에러 코드, `X-Workspace-Id` 형식 검사, 부팅 자가 검사. 요구사항: REQ-WSPACE-051, 053~059

## 공통 규칙

- 역할은 소유자 > 관리자 > 편집자 > 뷰어 계층이다. 권한 매트릭스의 단일 기준은 [멤버 관리와 역할 「권한 매트릭스」](CLE-ACCT-WS-MEMBER.md#권한-매트릭스) 다.
- 화면의 역할 · 슬러그 제한은 편의 기능이고 인가 경계는 서버의 403 이다.

## 절 위치

### 전환 API 와 토큰

→ [생성 · 전환 · 설정](CLE-ACCT-WS-SPACE.md#전환-api-와-토큰)

### 워크스페이스 관리 화면

→ [생성 · 전환 · 설정](CLE-ACCT-WS-SPACE.md#워크스페이스-관리-화면)

### 관리자 역할 규칙

→ [멤버 관리와 역할](CLE-ACCT-WS-MEMBER.md#관리자-역할-규칙)

### 직접 추가

→ [멤버 관리와 역할](CLE-ACCT-WS-MEMBER.md#직접-추가)

### 초대

→ [초대](CLE-ACCT-WS-INVITE.md#초대)

### 미가입자 가입 경로

→ [초대](CLE-ACCT-WS-INVITE.md#미가입자-가입-경로)

### 이미 가입한 사용자의 수락 경로

→ [초대](CLE-ACCT-WS-INVITE.md#이미-가입한-사용자의-수락-경로)

### 초대 가입 화면

→ [초대](CLE-ACCT-WS-INVITE.md#초대-가입-화면)

### 초대 에러 코드

→ [초대](CLE-ACCT-WS-INVITE.md#초대-에러-코드)

### API 인가

→ [API 인가](CLE-ACCT-WS-AUTHZ.md#api-인가)

### 멤버십 검증은 가드가 무조건 한다

→ [API 인가](CLE-ACCT-WS-AUTHZ.md#멤버십-검증은-가드가-무조건-한다)

### 가드 거부 에러 코드

→ [API 인가](CLE-ACCT-WS-AUTHZ.md#가드-거부-에러-코드)

### 워크스페이스를 찾지 못할 때

→ [API 인가](CLE-ACCT-WS-AUTHZ.md#워크스페이스를-찾지-못할-때)

### `X-Workspace-Id` 형식 검사

→ [API 인가](CLE-ACCT-WS-AUTHZ.md#x-workspace-id-형식-검사)

## 미결 사항

- **개인 워크스페이스의 기본 시간대와 설정이 없을 때의 폴백**: 가입 화면 원문은 개인 워크스페이스를 만들 때 시간대를 "브라우저 타임존(Accept-Language 헤더에서 추론) 또는 UTC" 로 채운다고 적는다. 데이터 모델은 그런 컬럼 없이 `settings.timezone` 이 없으면 서버 기본 `process.env.TZ`, 없으면 `UTC` 이고 AI 노드 시스템 컨텍스트와 스케줄 기본 시간대가 이 값을 쓴다고 적는다. 스케줄 원문은 `settings.timezone` 다음 `'Asia/Seoul'` 로 폴백한다고 적는다(관련: [스케줄 §미결 사항](../CLE-TRIG/CLE-TRIG-SCHEDULE.md#미결-사항), [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md)). 현재 구현의 `createPersonalWorkspace` 는 `settings={}` 로 만든다. Accept-Language 헤더로는 시간대를 추론할 수도 없다. 기본값 하나를 정할지, 스케줄과 AI 가 서로 다른 폴백을 써도 되는지 결정 필요.
- **초대 요청 한도 초과 코드 `rate_limited`**: 초대 에러 표와 에러 코드 예외 목록은 초대 429 를 소문자 `rate_limited` 로 적고 예외 등록 코드로 올려 둔다. 원문 분석에 따르면 초대 한도는 `@Throttle` 로 걸리고 전역 필터가 429 를 `RATE_LIMITED` 로 바꾸며, 백엔드·프론트엔드 소스에 `'rate_limited'` 문자열은 0건이다(관련: [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)). 같은 표에서 발행처 없는 `forbidden` 을 뺀 선례가 있다. 표와 예외 목록에서 `rate_limited` 를 빼고 `RATE_LIMITED` 로 적을지 결정 필요.


## Rationale

주제별 결정은 각 하위 문서의 Rationale 에 있다.

### 초대 수락·가입 때 이메일 일치를 강제한다

→ [초대](CLE-ACCT-WS-INVITE.md#초대-수락가입-때-이메일-일치를-강제한다)

### 초대 메일 링크는 `/register` 로 보내고 옛 경로는 리다이렉트한다

→ [초대](CLE-ACCT-WS-INVITE.md#초대-메일-링크는-register-로-보내고-옛-경로는-리다이렉트한다)

### 가입 여부 확인은 이메일 존재를 새로 노출하지 않는다 (2026-10-18)

→ [초대](CLE-ACCT-WS-INVITE.md#가입-여부-확인은-이메일-존재를-새로-노출하지-않는다-2026-10-18)

### 관리자 역할을 주고 빼는 일은 소유자만 한다

→ [멤버 관리와 역할](CLE-ACCT-WS-MEMBER.md#관리자-역할을-주고-빼는-일은-소유자만-한다)

### 관리자 역할 판정의 요청자 역할은 잠그지 않고 읽는다

→ [멤버 관리와 역할](CLE-ACCT-WS-MEMBER.md#관리자-역할-판정의-요청자-역할은-잠그지-않고-읽는다)

### 나가기와 제거는 개인 통합도 지운다 (2026-10-29)

→ [멤버 관리와 역할](CLE-ACCT-WS-MEMBER.md#나가기와-제거는-개인-통합도-지운다-2026-10-29)

### 직접 추가와 초대는 어느 계정인지 정할 수 없으면 가입하지 않은 이메일처럼 다룬다 (2026-11-06)

→ [멤버 관리와 역할](CLE-ACCT-WS-MEMBER.md#직접-추가와-초대는-어느-계정인지-정할-수-없으면-가입하지-않은-이메일처럼-다룬다-2026-11-06)

### 멤버십 검증은 가드 한 곳에서 `@Roles()` 와 상관없이 한다

→ [API 인가](CLE-ACCT-WS-AUTHZ.md#멤버십-검증은-가드-한-곳에서-roles-와-상관없이-한다)

### 경로 파라미터 워크스페이스도 가드가 본다

→ [API 인가](CLE-ACCT-WS-AUTHZ.md#경로-파라미터-워크스페이스도-가드가-본다)

### 가드 거부에 에러 코드를 붙인다

→ [API 인가](CLE-ACCT-WS-AUTHZ.md#가드-거부에-에러-코드를-붙인다)

### `X-Workspace-Id` 헤더는 경로 파라미터보다 느슨하게 검사한다

→ [API 인가](CLE-ACCT-WS-AUTHZ.md#x-workspace-id-헤더는-경로-파라미터보다-느슨하게-검사한다)
