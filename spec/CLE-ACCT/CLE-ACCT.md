---
id: "CLE-ACCT"
title: "계정과 워크스페이스"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "0367abfeb845898c149fb6616d12ad92262721ab842d7c5fec3ad3ee6cf86147"
read_as: "approved"
task: null
source_paths: []
mirror_sha256: "797718bdf789f8dd708b6746253962d5d4b0156d83ba93335a34c0e557783a00"
etag: "sha256-234cea8e236f1069d2b44588af50f78c2dcea8574dee95c2b662ad7c734f3e16"
---
> 구현 상태: 부분 구현 · 원문: 영역 문서라 원문이 없다(자식 문서의 원문 참조) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 영역은 누가 Clemvion 을 쓰는지, 그 사람이 어느 워크스페이스에서 어떤 권한으로 일하는지를 다룬다. 사용자 신원(가입·로그인·2단계 인증·소셜 로그인), 로그인 상태를 유지하는 세션과 토큰, 내 프로필, 그리고 리소스를 격리하는 워크스페이스와 그 멤버·초대·역할이 여기에 속한다.

제품은 두 가지 사용 단위를 지원한다. 개인은 가입할 때 자동으로 생기는 개인 워크스페이스에서 혼자 워크플로우를 만들고 관리한다. 팀·조직은 팀 워크스페이스로 워크플로우를 공유하고, 역할과 권한을 관리하고, 공통 통합 설정을 함께 쓴다. 한 사용자는 개인 워크스페이스 1개와 팀 워크스페이스 여러 개에 속할 수 있다.

워크스페이스는 워크플로우·트리거·통합·지식 저장소·모델 설정 같은 모든 리소스의 격리 단위다. 그래서 이 영역의 권한 매트릭스와 서버 인가 규칙은 다른 모든 영역의 API 가 따르는 기준이 된다.

## 문서

- [가입과 로그인](CLE-ACCT-SIGNIN.md): 이메일 가입과 인증, 로그인, 2단계 인증(TOTP, Passkey·보안 키), 소셜 로그인, 비밀번호 재설정, 이메일 변경의 화면과 API.
- [세션과 토큰](CLE-ACCT-SESSION.md): 액세스 토큰과 리프레시 토큰, 로그인 세션 단위의 토큰 회전, 리프레시 쿠키, 세션 목록과 강제 종료, 계정 재인증 에러 코드, 로그아웃, 프론트엔드 라우트 가드.
- [내 프로필](CLE-ACCT-PROFILE.md): 사이드바 사용자 영역과 팝업, 내 프로필 화면의 편집 방식, 아바타·언어·테마, 비밀번호 변경, 사용자 API.
- [워크스페이스와 멤버](CLE-ACCT-WS.md): 워크스페이스 생성·전환·설정, 멤버 관리와 초대, 역할과 권한 매트릭스, 요청마다 워크스페이스와 역할을 판정하는 서버 인가 규칙.
- [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md): User·Workspace·WorkspaceMember·WorkspaceInvitation·RefreshToken·LoginHistory·WebAuthnCredential 엔티티와 인증·워크스페이스 데이터 흐름, 상태 전이.

감사 로그와 로그인 이력의 적재·조회·보존은 [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md), 알림 설정은 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md), 슬러그 라우팅은 [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md) 이 정한다.
