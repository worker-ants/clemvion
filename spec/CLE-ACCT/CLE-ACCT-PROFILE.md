---
id: "CLE-ACCT-PROFILE"
title: "내 프로필"
type: "feature"
version: 1
status: "approved"
requirements: ["REQ-PROFILE-001", "REQ-PROFILE-002", "REQ-PROFILE-003", "REQ-PROFILE-004", "REQ-PROFILE-005", "REQ-PROFILE-006", "REQ-PROFILE-007", "REQ-PROFILE-008", "REQ-PROFILE-009", "REQ-PROFILE-010", "REQ-PROFILE-011", "REQ-PROFILE-012", "REQ-PROFILE-013", "REQ-PROFILE-014", "REQ-PROFILE-015", "REQ-PROFILE-016", "REQ-PROFILE-017", "REQ-PROFILE-018", "REQ-PROFILE-019", "REQ-PROFILE-020", "REQ-PROFILE-021", "REQ-PROFILE-022", "REQ-PROFILE-023", "REQ-PROFILE-024", "REQ-PROFILE-025", "REQ-PROFILE-026"]
basis_superseded: false
parent: "CLE-ACCT"
ancestors: ["CLE-VISION", "CLE-ACCT"]
area: "CLE-ACCT"
content_hash: "88ec82be0bcae112cf9fa894edd0ad800806dfe0a8f23520cb5e5d946ec797c2"
read_as: "approved_fallback"
task: "CLE-T-E7MF3Q"
source_paths: ["spec/2-navigation/9-user-profile.md", "spec/2-navigation/_layout.md", "spec/2-navigation/_product-overview.md"]
mirror_sha256: "880c50d9b13a934a2ff8deaa8bac95e06ca1de09886b26f366b77f936989947e"
etag: "sha256-17922c11ea371dad3616b695ac01c2a809cb431294970ad4918099898394fe5f"
---
> 구현 상태: 부분 구현 (사용자 메뉴의 알림 설정 항목은 미구현) · 원문: `spec/2-navigation/9-user-profile.md` (§1, §2, §6.1 사용자 행, Rationale), `spec/2-navigation/_layout.md` (§3.2), `spec/2-navigation/_product-overview.md` (§3.12 NAV-UP-01~06) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 사이드바 아래쪽의 사용자 영역과 내 프로필(profile) 화면을 정한다. 사용자 영역을 누르면 열리는 팝업, `/profile` 의 표시와 편집 방식, 이름·아바타·언어·테마 같은 개인 정보와 환경설정, 비밀번호 변경 화면, 이를 받치는 사용자 API(`/api/users/me`)가 범위다.

내 프로필 화면은 보안 관련 하위 화면으로 가는 입구이기도 하다. 그 하위 화면의 규칙은 각 소유 문서가 정한다.

- 이메일 변경 화면(`/profile/change-email`)과 2단계 인증 설정 화면(`/profile/security`): [가입과 로그인](CLE-ACCT-SIGNIN.md)
- 활성 세션·로그인 이력 화면(`/profile/sessions`)과 비밀번호 변경 뒤 세션 처리: [세션과 토큰](CLE-ACCT-SESSION.md)
- 로그인 이력 이벤트와 보존: [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)
- 알림 벨, 알림 설정, 알림 규칙 화면(`/profile/alerts`)과 알림 API: [알림](../CLE-OBS/CLE-OBS-NOTIFY.md)
- 워크스페이스 전환 블록과 워크스페이스 관리 화면: [워크스페이스와 멤버](CLE-ACCT-WS.md)
- 사이드바 메뉴 구성과 슬러그 라우팅: [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md)
- 아바타 파일의 저장 키와 버킷 정책: [파일 저장소](../CLE-PLAT/CLE-PLAT-STORAGE.md)
- UI 언어 문자열: [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md)

## 요구사항

- REQ-PROFILE-001 WHEN 사용자가 로그인해 있으면 THE SYSTEM SHALL 사이드바 하단에 사용자 아바타(또는 이름 이니셜)와 이름, 현재 워크스페이스 이름을 보여 준다. (원본: NAV-UP-01)
- REQ-PROFILE-002 WHEN 사용자가 사이드바의 아바타를 누르면 THE SYSTEM SHALL 내 프로필과 로그아웃 두 항목만 있는 팝업을 연다. (원본: NAV-UP-02)
- REQ-PROFILE-003 WHEN 사용자가 팝업의 내 프로필을 누르면 THE SYSTEM SHALL `/profile` 로 이동한다.
- REQ-PROFILE-004 WHEN 사용자가 팝업의 로그아웃을 누르면 THE SYSTEM SHALL 세션을 끝내고 로그인 화면으로 이동한다. (원본: NAV-UP-03)
- REQ-PROFILE-005 WHEN 사용자가 사용자 메뉴를 열면 THE SYSTEM SHALL 알림 설정으로 가는 항목을 제공한다. (원본: NAV-UP-02) (미구현)
- REQ-PROFILE-006 WHEN 사이드바를 그리면 THE SYSTEM SHALL 워크스페이스 전환과 관리는 팝업 밖 워크스페이스 전환 블록에 두고 테마 전환은 프로필 환경설정 카드에 둔다.
- REQ-PROFILE-007 WHEN 사용자가 `/profile` 을 열면 THE SYSTEM SHALL 사용자 정보·비밀번호·환경설정·보안 카드를 읽기 전용으로 보여 준다.
- REQ-PROFILE-008 WHEN 사용자가 사용자 정보 카드나 환경설정 카드의 [편집] 을 누르면 THE SYSTEM SHALL 그 카드만 입력 가능하게 바꾸고 [취소]·[저장] 을 보여 준다.
- REQ-PROFILE-009 WHEN 사용자가 인라인 편집 카드에서 [저장] 을 누르면 THE SYSTEM SHALL 변경 전·후 diff 확인 모달을 한 번 거친 뒤 PATCH 를 보낸다.
- REQ-PROFILE-010 WHILE 환경설정 카드를 편집하는 동안 THE SYSTEM SHALL 테마 미리보기를 로컬 임시 상태에만 적용하고 [취소] 나 모달 닫기 때 원래 테마로 되돌린다.
- REQ-PROFILE-011 WHEN 사용자가 비밀번호 카드의 [변경하기 →] 를 누르면 THE SYSTEM SHALL `/profile/change-password` 전용 페이지로 이동한다.
- REQ-PROFILE-012 WHEN 사용자가 비밀번호 변경을 제출하면 THE SYSTEM SHALL diff 확인 모달 없이 현재 비밀번호 확인을 1차 인증으로 쓴다.
- REQ-PROFILE-013 WHEN 비밀번호 변경이 성공하면 THE SYSTEM SHALL 응답의 새 액세스 토큰으로 메모리 토큰을 바꾸고 `/profile` 로 이동해 성공 토스트를 보여 준다.
- REQ-PROFILE-014 IF OAuth 전용 계정이 비밀번호 변경을 시도하면 THE SYSTEM SHALL `PASSWORD_REQUIRED`(401)로 막고 비밀번호 재설정으로 비밀번호를 추가하는 경로를 안내한다.
- REQ-PROFILE-015 WHEN 사용자가 이메일 카드의 [변경하기 →] 를 누르면 THE SYSTEM SHALL `/profile/change-email` 전용 페이지로 이동한다.
- REQ-PROFILE-016 WHEN 사용자가 프로필을 PATCH 로 수정하면 THE SYSTEM SHALL 이메일은 바꾸지 않는다.
- REQ-PROFILE-017 WHEN 사용자가 아바타 이미지를 올리면 THE SYSTEM SHALL `png`·`jpg`·`jpeg`·`webp`·`gif` 확장자의 2MB 이하 파일만 받고 공개 URL 로 서빙한다.
- REQ-PROFILE-018 IF 아바타 파일이 SVG 이거나 허용하지 않은 확장자면 THE SYSTEM SHALL 400 `INVALID_FILE_TYPE` 으로 거부한다.
- REQ-PROFILE-019 IF 아바타 파일이 없거나 비어 있으면 THE SYSTEM SHALL 400 `FILE_REQUIRED` 로 거부한다.
- REQ-PROFILE-020 IF 아바타 파일이 2MB 를 넘으면 THE SYSTEM SHALL 413 `PAYLOAD_TOO_LARGE` 로 거부한다.
- REQ-PROFILE-021 WHEN 사용자가 UI 언어를 바꾸면 THE SYSTEM SHALL `ko` 나 `en` 으로 저장한다.
- REQ-PROFILE-022 WHEN 사용자가 테마를 바꾸면 THE SYSTEM SHALL 라이트·다크·시스템 가운데 고른 값을 저장하고 바로 적용한다. (원본: NAV-UP-06, system 추가)
- REQ-PROFILE-023 WHEN 저장된 테마가 `system` 이면 THE SYSTEM SHALL 테마를 적용하는 순간의 `prefers-color-scheme` 값에 따라 라이트나 다크로 그린다.
- REQ-PROFILE-024 WHEN 클라이언트가 `GET /api/users/me` 를 호출하면 THE SYSTEM SHALL 확인 대기 중인 새 이메일을 `pendingEmail` 로 싣고 없으면 null 을 싣는다.
- REQ-PROFILE-025 WHEN 사용자가 보안 카드의 링크를 누르면 THE SYSTEM SHALL `/profile/security` 나 `/profile/sessions` 로 이동한다.
- REQ-PROFILE-026 IF 프로필 수정 요청의 테마가 `light`·`dark`·`system` 밖의 값이면 THE SYSTEM SHALL 400 `VALIDATION_ERROR` 로 거부하고 저장된 테마를 바꾸지 않는다.

## 사이드바 사용자 영역

### 기본 표시

- 사용자 아바타. 이미지가 없으면 이름 이니셜을 쓴다.
- 사용자 이름.
- 현재 워크스페이스 이름(작은 글씨).

사용자 영역 옆이나 사이드바 하단의 알림 벨과 미읽은 알림 수 뱃지는 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) 이 정한다.

### 팝업 메뉴

아바타를 누르면 열리는 팝업에는 두 항목만 둔다. 워크스페이스 전환·관리와 테마 전환은 아래처럼 별도 화면에 있고 팝업에 중복으로 두지 않는다.

| 항목 | 동작 |
| --- | --- |
| 내 프로필 | `/profile` 로 이동한다. 기본은 읽기 전용이고 편집은 카드별 [편집] 이나 전용 페이지로 나눈다 |
| 로그아웃 | 세션을 끝내고 로그인 페이지로 이동한다. 절차는 [세션과 토큰](CLE-ACCT-SESSION.md) |

현재 구현은 `codebase/frontend/src/components/layout/sidebar.tsx` 의 사용자 영역 팝업이 프로필 링크와 로그아웃 버튼만 그린다.

팝업 밖에 있는 항목은 다음과 같다.

| 항목 | 실제 위치 |
| --- | --- |
| 워크스페이스 전환 | 사용자 영역 위의 독립 워크스페이스 전환 블록. 개인·팀 그룹, 현재 워크스페이스 표시, 전환이 들어 있다([워크스페이스와 멤버](CLE-ACCT-WS.md)) |
| 워크스페이스 관리 | 워크스페이스 전환 블록 하단의 "여기 설정"(`/workspace/settings`) 링크와 새 팀 워크스페이스 만들기. 역할별 노출은 그 화면이 처리한다 |
| 테마 전환 | 사이드바가 아니라 `/profile` 의 환경설정 카드. 라이브 미리보기를 제공한다(`app/(main)/w/[slug]/profile/components/profile-preferences-card.tsx`) |
| 알림 설정 | 미구현(Planned). 알림 설정 화면은 아직 없다. 이메일 채널 토글 API 는 있다([알림](../CLE-OBS/CLE-OBS-NOTIFY.md)). `/profile/alerts` 는 알림 규칙 화면이라 이 항목과 별개다 |

## 내 프로필 화면

`/profile` 은 기본이 읽기 전용 표시 화면이다. 사용자 정보·환경설정·비밀번호·보안(2단계 인증·세션)을 한 페이지에서 보되, 편집은 항목의 위험 수준에 맞춘 별도 동작으로 나눈다. 성격이 다른 변경(개인정보·자격 증명·환경설정)을 [Save] 버튼 하나로 한꺼번에 커밋하는 방식은 쓰지 않는다.

### 화면 구성

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 사용자 정보 카드 | 상단 | 아바타, Name, Email | 카드 오른쪽 위 [편집] 으로 아바타·이름 인라인 편집. Email 옆 [변경하기 →] 로 `/profile/change-email` 이동. 확인 대기 중인 이메일 변경이 있으면 [재발송]·[취소] 와 함께 보인다 |
| 비밀번호 카드 | 사용자 정보 아래 | "현재 비밀번호 확인이 필요합니다" 안내 | [변경하기 →] 로 `/profile/change-password` 이동 |
| 환경설정 카드 | 비밀번호 아래 | Language, Theme | 카드 오른쪽 위 [편집] 으로 인라인 편집 |
| 보안 카드 | 하단 | [2FA 설정 →], [활성 세션·로그인 이력 →] 링크 | `/profile/security`, `/profile/sessions` 로 이동 |

### 편집 방식

| 편집 방식 | 항목 | 동작 |
| --- | --- | --- |
| 인라인 토글 | 사용자 정보(아바타·이름), 환경설정(언어·테마) | 카드 오른쪽 위 [편집] 을 누르면 그 카드만 입력이 켜지고 [취소]·[저장] 이 보인다. [저장] 을 누르면 변경 전·후 diff 확인 모달("이전: A → 새: B")을 한 번 거친 뒤 PATCH 를 보낸다. 다른 카드는 읽기 전용으로 남는다. 테마 라이브 미리보기는 편집하는 동안 로컬 임시 상태로만 적용하고 [취소] 나 모달 닫기 때 항상 원래대로 돌린다 |
| 전용 페이지 | 비밀번호 | `/profile/change-password` 로 이동한다. 페이지에 들어가는 것 자체가 "지금 비밀번호를 바꾸려 한다" 는 의도 표시다. OAuth 전용 계정 안내는 아래 [비밀번호 변경](#비밀번호-변경) |
| 전용 페이지 | 이메일 | 이 화면은 표시와 [변경하기 →] 만 둔다. `/profile/change-email` 에서 계정 재인증, 새 이메일 확인 메일, 링크 확인 순서로 확정한다([가입과 로그인](CLE-ACCT-SIGNIN.md)) |
| 별도 하위 화면 | 2단계 인증, 활성 세션·로그인 이력 | 보안 카드 링크로 `/profile/security`([가입과 로그인](CLE-ACCT-SIGNIN.md)), `/profile/sessions`([세션과 토큰](CLE-ACCT-SESSION.md)) 에 들어간다 |

### 프로필 필드

| 필드 | 편집 | 편집 방식 | 설명 |
| --- | --- | --- | --- |
| 아바타 | 가능 | 인라인 토글 | 이미지 파일 업로드(`POST /api/users/me/avatar`) 또는 `PATCH /api/users/me` 의 `avatarUrl` 로 외부 URL 을 넣거나 지운다. 올린 이미지는 공개 URL 로 서빙한다([아바타](#아바타)) |
| 이름 | 가능 | 인라인 토글 | 표시 이름 |
| 이메일 | 별도 변경 | 전용 페이지 `/profile/change-email` | 계정 재인증과 새 이메일 확인 메일로 바꾼다. 확정되면 모든 세션을 끊고 현재 기기에 다시 발급한다 |
| 언어 | 가능 | 인라인 토글 | UI 언어 `ko`·`en` |
| 테마 | 가능 | 인라인 토글. 라이브 미리보기는 임시 상태로 격리 | Light·Dark·System 세 버튼. 저장 값은 `light`·`dark`·`system` 이다. `system` 을 그리는 방식은 아래 [테마](#테마) |
| 비밀번호 | 가능 | 전용 페이지 `/profile/change-password` | 현재 비밀번호 확인 뒤 새 비밀번호 입력 |

### 테마

- 저장 값은 `light`·`dark`·`system` 세 가지이고 기본값은 `light` 다. 컬럼 제약은 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 의 User 표에 있다.
- 화면은 `<html>` 의 `.light`·`.dark` 클래스 하나로 테마를 그린다. `system` 은 적용하는 순간 `prefers-color-scheme` 로 OS 색상 모드를 읽어 둘 가운데 하나로 바꾼다.
- Tailwind 의 `dark:` 와 로고도 OS 설정이 아니라 이 클래스를 따른다. 근거는 [브랜드](../CLE-UI/CLE-UI-BRAND.md) 의 Rationale 「로고 자리에 `theme="auto"` 를 쓰고 전용 어두운 배경을 두지 않는 이유」 다.
- 적용한 뒤 OS 색상 모드가 바뀌어도 다시 읽지 않는다. 테마를 다시 적용할 때 그 순간의 값을 읽는다.
- 저장한 테마는 `/profile` 을 열 때와 환경설정 카드에서 바꿀 때 화면에 적용된다(`profile/page.tsx`, `lib/stores/theme-store.ts`). `/profile` 밖의 화면에서 앱을 새로 열면 기본값 라이트로 그린다. 이 공백은 [미결 사항](#미결-사항) 에 있다.

### 보안 카드가 가리키는 화면

| 항목 | 화면 | 규칙을 정하는 문서 |
| --- | --- | --- |
| 비밀번호 변경 | `/profile/change-password` | 이 문서의 [비밀번호 변경](#비밀번호-변경) |
| 2단계 인증 설정 | `/profile/security`. TOTP 카드와 Passkey·보안 키 카드 | [가입과 로그인](CLE-ACCT-SIGNIN.md) |
| 활성 세션 | `/profile/sessions`. 로그인 세션 목록, "현재" 배지, 개별·일괄 종료(비밀번호 또는 TOTP 로 계정 재인증) | [세션과 토큰](CLE-ACCT-SESSION.md) |
| 로그인 이력 | `/profile/sessions` 의 이력 탭. 본인만 조회, 180일 보존 | [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) |

## 비밀번호 변경

비밀번호 변경은 로그인한 상태에서 현재 비밀번호를 알고 새 비밀번호로 바꾸는 동작이다. 메일 링크로 하는 비밀번호 재설정과 다르다.

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 제목·안내 | 상단 | "비밀번호 변경", 현재 비밀번호를 확인한 뒤 새 비밀번호를 정한다는 안내 | 없음 |
| 입력 | 안내 아래 | Current password, New password, Confirm password | 새 비밀번호는 [가입과 로그인](CLE-ACCT-SIGNIN.md) 의 비밀번호 정책을 따른다 |
| 버튼 | 하단 | [취소], [변경] | `POST /api/users/me/change-password` |

- 이 페이지는 diff 미리보기 모달을 생략한다. 마스킹된 값이라 보여 줄 것이 없다. 현재 비밀번호가 1차 인증 역할을 한다.
- 변경에 성공하면 서버가 사용자의 모든 세션을 끊고 현재 기기에 새 세션을 발급한다. 응답 `{ data: { accessToken } }` 으로 새 액세스 토큰을 준다. 클라이언트는 이 토큰으로 메모리의 액세스 토큰(`auth-store`)을 바꾸고, 리프레시 쿠키는 `Set-Cookie` 로 자동으로 바뀐다. 이어서 `/profile` 로 이동해 성공 토스트를 보여 준다. 재로그인 화면으로 보내지 않는다. 세션 처리 규칙과 이유는 [세션과 토큰](CLE-ACCT-SESSION.md) 에 있다.
- OAuth 전용 계정(비밀번호 없음)은 현재 비밀번호 확인 단계에서 `PASSWORD_REQUIRED`(401)로 막힌다. 화면은 비밀번호를 추가하는 경로, 곧 [가입과 로그인](CLE-ACCT-SIGNIN.md) 의 비밀번호 재설정(재설정 요청 뒤 재설정 실행)을 안내한다. 이 안내의 기준은 이 절이다.
- 현재 비밀번호가 틀리면 `PASSWORD_INVALID`(401), 사용자가 없으면 `USER_NOT_FOUND`(404)다. `PASSWORD_INVALID` 의 정의는 [세션과 토큰](CLE-ACCT-SESSION.md) 에 있다. `USER_NOT_FOUND` 는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 를 본다.
- 비밀번호 변경은 감사 로그 `user.password_changed` 로 남는다([감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)).

## 아바타

아바타는 두 방식으로 바꾼다. 이미지 파일을 올리거나(`POST /api/users/me/avatar`), `PATCH /api/users/me` 의 `avatarUrl` 로 외부 URL 을 넣는다. 두 경로가 같은 `user.avatar_url` 컬럼을 쓴다.

- 업로드 계약(필드, 최대 2MB, 허용 확장자, 에러 코드)은 [API](#api) 표에 있다.
- 올린 아바타는 URL 을 아는 누구나 볼 수 있다. 워크스페이스 멤버 전용이 아니다. 공개 URL·서명 URL·백엔드 프록시 세 안 중 공개 URL 을 골랐다(2026-08-31 결정). 접근 통제는 추측할 수 없는 객체 키와 버킷 목록 차단이 함께 맡는다.
- 배포 선행 조건: 아바타 공개 읽기 버킷 정책이 없으면 업로드는 성공하고 이미지만 403 이 된다. 증상이 업로드가 아니라 표시에서 난다. 브라우저가 닿는 `S3_PUBLIC_BASE_URL` 도 필요하다. 정책 예시와 실측은 `scripts/minio/avatars-public-read.json`, `scripts/minio/README.md` 에 있다.

저장 쪽 규칙은 [파일 저장소 §아바타](../CLE-PLAT/CLE-PLAT-STORAGE.md#아바타) 가 정한다. 확장자 허용 목록과 SVG 를 빼는 이유, 확장자로 정하는 `Content-Type`, 객체 키 `avatars/{userId}/{uuid}.{ext}`, 공개 URL, 버킷 정책, 교체 때 DB 저장 뒤 옛 객체를 지우는 순서가 그 문서에 있다.

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/users/me` | 내 프로필 조회. 응답(`UserProfileDto`)에 진행 중인 이메일 변경을 표시하는 `pendingEmail: string \| null` 을 싣는다. 확인 대기 중인 새 이메일이고 없으면 null 이다 |
| PATCH | `/api/users/me` | 프로필 수정(이름, `avatarUrl`, 언어, 테마). 테마는 `light`·`dark`·`system` 만 받고 다른 값은 400 `VALIDATION_ERROR` 로 거부하며 저장된 값을 바꾸지 않는다. 이메일은 바꾸지 않는다. 이메일은 `/api/users/me/email-change/*` 별도 흐름이다 |
| POST | `/api/users/me/avatar` | 아바타 이미지 파일 업로드. `multipart/form-data` 의 `file` 필드, 최대 2MB, 확장자 `png`·`jpg`·`jpeg`·`webp`·`gif`(SVG 제외). 성공하면 200 과 `PATCH /api/users/me` 와 같은 프로필 봉투. 파일 없음·빈 내용 400 `FILE_REQUIRED`, 확장자 불허 400 `INVALID_FILE_TYPE`, 크기 초과 413 `PAYLOAD_TOO_LARGE` |
| POST | `/api/users/me/change-password` | 비밀번호 변경. 성공하면 모든 세션을 끊고 현재 기기에 새 세션을 발급한다. `{ data: { accessToken } }` 을 돌려주고 리프레시 쿠키를 바꾼다. 비밀번호 없음 401 `PASSWORD_REQUIRED`, 불일치 401 `PASSWORD_INVALID`, 사용자 없음 404 `USER_NOT_FOUND` |

`/api/users/me` 아래의 다른 엔드포인트와 프로필 하위 화면이 부르는 세션 API 는 소유 문서가 정한다.

| 경로 | 문서 |
| --- | --- |
| `/api/users/me/email-change/request`·`verify`·`resend`·`cancel` | [가입과 로그인](CLE-ACCT-SIGNIN.md) |
| `/api/users/me/login-history` | [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) |
| `/api/auth/sessions`, `/api/auth/sessions/:familyId/revoke`, `/api/auth/sessions/revoke-others` | [세션과 토큰](CLE-ACCT-SESSION.md) |

세션 API 는 `/api/users/me` 가 아니라 `/api/auth/sessions` 아래에 있다. 현재 세션을 가리는 리프레시 쿠키의 Path 가 `/api/auth` 라서 그 아래에 두었다. 로그인 이력은 쿠키가 필요 없어 `/api/users/me` 아래에 남았다.

2단계 인증 설정 API 는 `/api/auth/2fa/*` 이고 [가입과 로그인](CLE-ACCT-SIGNIN.md) 에 있다. 알림 목록·알림 설정(`/api/notifications/*`)과 알림 규칙(`/api/alerts`) API 는 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md), 워크스페이스·초대 API 는 [워크스페이스와 멤버](CLE-ACCT-WS.md) 에 있다.

## 미결 사항

- **저장한 테마를 앱을 열 때 적용하는가**: 지금은 `/profile` 을 열 때와 환경설정 카드에서 바꿀 때만 저장한 테마를 화면에 적용한다. 앱 전체에 테마를 적용하는 공급자가 없어서, `/profile` 밖의 화면에서 새로 고치면 다크나 시스템을 저장한 사용자도 라이트로 본다. `system` 을 고른 사용자의 화면이 OS 색상 모드 변경을 따라가지 않는 것도 같은 자리에서 정할 일이다. 로그인 뒤 모든 화면에 저장한 테마를 적용하는 요구를 더할지, 더한다면 OS 변경도 따라갈지 결정 필요.

## 구현 위치

- `codebase/frontend/src/components/layout/sidebar.tsx` (사용자 영역과 팝업)
- `codebase/frontend/src/app/(main)/w/[slug]/profile/**` (`/profile`, `change-password`, 카드 컴포넌트. 환경설정 카드는 `components/profile-preferences-card.tsx`)
- `codebase/frontend/src/lib/stores/theme-store.ts`, `codebase/frontend/src/lib/stores/locale-store.ts`
- `codebase/frontend/src/lib/api/users.ts`, `codebase/frontend/src/lib/api/sessions.ts`
- `codebase/backend/src/modules/users/**` (`/api/users/me`, 아바타 업로드, 비밀번호 변경. 테마 허용 값은 `dto/update-me.dto.ts` 의 `USER_THEMES`)
- `codebase/backend/migrations/V149__user_theme_allow_system.sql`, `codebase/backend/migrations/V150__user_theme_allow_system_validate.sql` (테마 CHECK `chk_user_theme`. V149 가 `NOT VALID` 로 걸고 V150 이 검증한 뒤 옛 제약을 지운다)
- `codebase/backend/test/users-theme.e2e-spec.ts` (테마 저장과 범위 밖 값 거부)

## Rationale

### `/profile` 편집을 항목별로 나눴다

처음 와이어프레임은 사용자 정보·환경설정·비밀번호 변경을 한 폼으로 묶고 아래 `[Save Changes]` 버튼 하나로 모두 커밋했다. 다음 문제가 드러나 지금의 하이브리드 방식(인라인 토글, 전용 페이지, diff 확인 모달)으로 바꿨다.

- 성격이 다른 변경이 한 번에 커밋됐다. 자격 증명(비밀번호)·개인정보(이름·아바타)·환경설정(언어·테마)은 위험 수준이 다른데 한 번의 클릭이 모두를 PATCH 했다. 사용자 의도와 결과가 어긋날 가능성이 컸다.
- 편집이 무방비로 켜져 있었다. 모든 입력란이 기본으로 켜져 있어 둘러보다 잘못 입력한 값도 그대로 저장 대상이 됐다.
- 세션 강제 종료와 결이 맞지 않았다. `/profile/sessions` 의 강제 종료는 이미 `RevokeConfirmDialog`(비밀번호 또는 TOTP 로 계정 재인증)로 의도를 분리해 안전하게 쓰고 있었는데, 같은 영역의 다른 민감 동작은 그렇지 못했다.

그래서 (a) `/profile` 을 기본 읽기 전용으로 두고 카드별 [편집] 으로 의도를 나눴다. (b) 위험이 낮은 항목(이름·환경설정)도 저장 직전 diff 확인 모달을 한 번 거쳐 실수를 막는다. (c) 위험이 높은 항목(비밀번호·이메일)은 전용 페이지에 들어가는 것 자체가 의도 표시가 되게 했다. 이메일은 비밀번호와 같은 전용 페이지 방식(`/profile/change-email`)을 따르되, 식별자를 바꾸는 민감도를 반영해 계정 재인증·새 이메일 확인 메일·옛 이메일 통지를 거치는 별도 흐름으로 나눴다.

버린 대안은 세 가지다.

- 모든 편집을 모달로 처리: 환경설정처럼 자주 만지는 항목까지 매번 모달이 떠 마찰이 크다.
- 모든 항목을 전용 페이지로: 환경설정과 이름까지 라우트로 나누면 이동과 뒤로 가기 비용이 가치보다 크다. 위험 수준에 비례한 마찰이 더 합리적이다.
- 한 페이지에 섹션별 Save 버튼: 폼이 기본으로 켜져 무방비라는 핵심 문제를 풀지 못한다.

### 테마 `system` 값을 저장하게 했다

2026-10-10 결정이다(NERV Task `CLE-T-E7MF3Q`, 리뷰 발견 `01a0e542-19bb-75af-9f64-5529605f2b98`). 이 문서의 예전 미결 사항 «테마 `system` 값을 저장할 수 있는가» 를 닫는다. 환경설정 카드에는 System 선택지가 이미 있었고 DTO 도 `system` 을 받았다. DB CHECK 만 `light`·`dark` 로 남아 있어서 System 을 저장하면 500 이 났다.

| 안 | 채택·기각 이유 |
| --- | --- |
| CHECK 를 넓혀 `system` 을 저장한다 | 채택. 화면과 DTO 가 이미 받는 값을 DB 도 받게 한다. 마이그레이션 방식은 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 의 Rationale 「`user.theme` CHECK 확장은 두 단계 마이그레이션으로 했다」 에 있다 |
| DTO 와 화면에서 `system` 을 뺀다 | 기각. OS 색상 모드를 따르는 선택지를 잃는다. 제품 요구사항 NAV-UP-06 이 라이트·다크만 적은 것은 시스템 값을 막으려던 것이 아니라 적지 않은 것으로 봤다 |

시스템 테마 요구(REQ-PROFILE-023)는 지금 구현의 범위로 적었다. 구현은 테마를 적용하는 순간 OS 색상 모드를 한 번 읽어 `.light`·`.dark` 클래스 하나로 바꾼다. 화면이 이 클래스만 따르는 것은 [브랜드](../CLE-UI/CLE-UI-BRAND.md) 의 결정과 같다. 예전 문장 «OS 색상 모드를 따른다» 는 OS 설정이 바뀌면 화면도 따라 바뀐다고 읽힐 수 있어서 좁혔다. 실시간으로 따라갈지는 [미결 사항](#미결-사항) 에서 테마 적용 시점과 함께 정한다.

범위 밖 값의 400 거부는 새 요구(REQ-PROFILE-026)로 따로 적었다. 예전에는 DTO 를 지난 `system` 이 DB 에서 500 으로 실패했다. 그래서 허용 값 밖의 값은 DTO 가 먼저 막고 저장된 값을 건드리지 않는다는 점을 요구로 남긴다.

### 세션 API 경로를 고쳤다

2026-10-10 변경이다(NERV Task `CLE-T-ERAJ7P`). API 소유 표의 세션 경로를 `/api/users/me/sessions*` 에서 `/api/auth/sessions*` 로 바꿨다. 리프레시 쿠키의 Path 가 `/api/auth` 라서 예전 경로에는 쿠키가 실리지 않았고, 서버가 현재 세션을 가리지 못했다. 쿠키 Path 를 넓히는 안과 예전 경로를 별칭으로 남기는 안을 기각한 이유는 [세션과 토큰](CLE-ACCT-SESSION.md#세션-api-를-리프레시-쿠키-path-아래로-옮겼다) 의 Rationale 「세션 API 를 리프레시 쿠키 Path 아래로 옮겼다」 에 있다. 로그인 이력은 쿠키가 필요 없어 `/api/users/me/login-history` 에 남겼다.
