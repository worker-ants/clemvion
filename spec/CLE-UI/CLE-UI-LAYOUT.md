---
id: "CLE-UI-LAYOUT"
title: "레이아웃과 내비게이션"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-LAYOUT-001", "REQ-LAYOUT-002", "REQ-LAYOUT-003", "REQ-LAYOUT-004", "REQ-LAYOUT-005", "REQ-LAYOUT-006", "REQ-LAYOUT-007", "REQ-LAYOUT-008", "REQ-LAYOUT-009", "REQ-LAYOUT-010", "REQ-LAYOUT-011", "REQ-LAYOUT-012", "REQ-LAYOUT-013", "REQ-LAYOUT-014", "REQ-LAYOUT-015", "REQ-LAYOUT-016", "REQ-LAYOUT-017", "REQ-LAYOUT-018", "REQ-LAYOUT-019", "REQ-LAYOUT-020", "REQ-LAYOUT-021", "REQ-LAYOUT-022", "REQ-LAYOUT-023", "REQ-LAYOUT-024", "REQ-LAYOUT-025", "REQ-LAYOUT-026", "REQ-LAYOUT-027", "REQ-LAYOUT-028", "REQ-LAYOUT-029", "REQ-LAYOUT-030", "REQ-LAYOUT-031", "REQ-LAYOUT-032", "REQ-LAYOUT-033", "REQ-LAYOUT-034", "REQ-LAYOUT-035", "REQ-LAYOUT-036", "REQ-LAYOUT-037", "REQ-LAYOUT-038", "REQ-LAYOUT-039", "REQ-LAYOUT-040", "REQ-LAYOUT-041", "REQ-LAYOUT-042", "REQ-LAYOUT-043"]
basis_superseded: false
parent: "CLE-UI"
ancestors: ["CLE-VISION", "CLE-UI"]
area: "CLE-UI"
content_hash: "9f423a48e67910f8c9fc3ab093c36cc320c738218c9dcb86b2567c1bd65d455e"
read_as: "approved"
task: null
source_paths: ["spec/0-overview.md", "spec/2-navigation/_layout.md", "spec/2-navigation/_product-overview.md"]
mirror_sha256: "d4b8919f845d2da6fe218159cc17248f36e47d49fff73b26b21f68f2428b29db"
etag: "sha256-2264a3e1523bd932098400a2cdcf37dc1f7f3395fbdb6579d00446a1622df9d5"
---
> 구현 상태: 구현됨 · 원문: `spec/2-navigation/_layout.md` (§1 레이아웃 구조, §2 사이드바, §4 메인 컨텐츠 영역, §5 공통 헤더, Rationale), `spec/2-navigation/_product-overview.md` (§1 개요, §2 내비게이션 구조), `spec/0-overview.md` (§3 공통 UI 패턴, Rationale «Inline Alert 의 위치») · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 로그인한 사용자가 보는 모든 화면의 틀을 정한다. 왼쪽 사이드바와 오른쪽 메인 영역으로 나뉜 레이아웃, 사이드바 메뉴와 동작, 워크스페이스 슬러그(slug, `Workspace.slug`)를 붙인 라우팅, 메인 영역과 공통 헤더, 그리고 여러 화면이 함께 쓰는 UI 패턴(목록·상세 패널·상태 표시·반응형·테마)이다.

제품의 내비게이션은 왼쪽 사이드바가 중심이다. 메뉴 항목마다 독립 화면으로 바뀌고, 워크플로우 에디터는 목록에서 워크플로우를 고르면 들어가는 별도 화면이다.

범위 밖:

- 사이드바 하단 사용자 영역과 팝업 메뉴는 [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md) 이 정한다.
- 알림 벨과 알림 팝오버는 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) 이 정한다.
- 전체 화면 오류와 빈 상태는 [오류 화면과 빈 상태](CLE-UI-ERRORS.md) 가 정한다.
- 로고 변종과 색은 [브랜드](CLE-UI-BRAND.md) 가 정한다.
- 워크플로우 에디터 안의 레이아웃과 저장 모델은 [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md) 가 정한다.

## 요구사항

### 레이아웃과 화면 전환

- REQ-LAYOUT-001 WHEN 로그인한 사용자가 앱 화면에 들어오면 THE SYSTEM SHALL 왼쪽 고정 사이드바와 오른쪽 메인 영역으로 화면을 나눈다. (원본: 0-overview §3.1)
- REQ-LAYOUT-002 WHEN 사용자가 사이드바 메뉴 항목을 누르면 THE SYSTEM SHALL 그 항목의 독립 화면으로 전환한다. (원본: 내비게이션 PRD §1)
- REQ-LAYOUT-003 WHEN 사용자가 워크플로우 목록에서 워크플로우를 고르면 THE SYSTEM SHALL 별도 화면인 워크플로우 에디터로 들어간다. (원본: 내비게이션 PRD §1)

### 사이드바

- REQ-LAYOUT-004 WHILE 사이드바가 펼쳐진 동안 THE SYSTEM SHALL 사이드바 상단에 Full logo 를 보인다. (원본: _layout §2.1)
- REQ-LAYOUT-005 WHILE 사이드바가 접힌 동안 THE SYSTEM SHALL 사이드바 상단에 Icon mark 를 보인다. (원본: _layout §2.1)
- REQ-LAYOUT-006 WHEN 사용자가 사이드바 로고를 누르면 THE SYSTEM SHALL 대시보드(`/dashboard`)로 이동한다. (원본: _layout §2.1)
- REQ-LAYOUT-007 WHEN 사이드바를 그리면 THE SYSTEM SHALL [메뉴 항목](#메뉴-항목) 표의 13개 항목을 그 순서대로 보인다. (원본: _layout §2.2, 내비게이션 PRD §2)
- REQ-LAYOUT-008 WHEN 사이드바를 그리면 THE SYSTEM SHALL 하단에 사용자 영역(아바타와 사용자 이름)을 둔다. (원본: _layout §2.1)
- REQ-LAYOUT-009 WHILE 사용자가 어떤 페이지에 있는 동안 THE SYSTEM SHALL 그 페이지에 해당하는 메뉴 항목을 배경색이나 왼쪽 표시로 강조한다. (원본: _layout §2.3)
- REQ-LAYOUT-010 WHEN 사용자가 사이드바 하단 토글 버튼을 누르면 THE SYSTEM SHALL 아이콘만 보이는 축소 모드로 바꾸거나 되돌린다. (원본: _layout §2.3)
- REQ-LAYOUT-011 WHILE 뷰포트 너비가 1280~1439px 이고 사용자가 직접 정하지 않은 동안 THE SYSTEM SHALL 사이드바를 자동으로 축소한다. (원본: _layout §2.3)
- REQ-LAYOUT-012 WHILE 사이드바가 축소 모드인 동안 THE SYSTEM SHALL 메뉴 아이콘에 마우스를 올리면 메뉴 이름 툴팁을 보인다. (원본: _layout §2.3)
- REQ-LAYOUT-013 WHILE 뷰포트 너비가 1440px 이상인 동안 THE SYSTEM SHALL 사이드바를 기본으로 240px 펼친다. (원본: _layout §2.4)
- REQ-LAYOUT-014 WHILE 뷰포트 너비가 1280~1439px 인 동안 THE SYSTEM SHALL 사이드바를 기본으로 64px 아이콘 모드로 축소한다. (원본: _layout §2.4)
- REQ-LAYOUT-015 WHILE 뷰포트 너비가 1280px 미만인 동안 THE SYSTEM SHALL 사이드바를 숨기고 햄버거 메뉴로 연다. (원본: _layout §2.4)
- REQ-LAYOUT-016 WHEN 사용자가 워크플로우 에디터 라우트에 들어가면 THE SYSTEM SHALL 사이드바를 자동으로 축소하거나 숨긴다. (원본: _layout §2.3) (미구현)

### 워크스페이스 슬러그 라우팅

- REQ-LAYOUT-017 WHEN 사이드바가 메뉴 링크를 만들면 THE SYSTEM SHALL 현재 워크스페이스 슬러그를 붙인 `/w/<slug>/<경로>` 로 만든다. (원본: _layout §2.2)
- REQ-LAYOUT-018 WHEN 사이드바가 사용자 가이드 링크를 만들면 THE SYSTEM SHALL 슬러그를 붙이지 않고 `/docs` 로 만든다. (원본: _layout §2.2)
- REQ-LAYOUT-019 WHEN 사용자가 슬러그 없는 앱 경로로 들어오면 THE SYSTEM SHALL 현재 워크스페이스의 슬러그 경로로 넘기고 query 와 hash 를 보존한다. (원본: _layout §2.2)
- REQ-LAYOUT-020 WHEN 사용자가 `/w/<slug>` 만으로 들어오면 THE SYSTEM SHALL 그 워크스페이스의 대시보드로 넘기고 query 와 hash 를 보존한다. (원본: _layout §2.2)
- REQ-LAYOUT-021 IF `/w/` 로 시작하는 경로가 어떤 라우트에도 맞지 않으면 THE SYSTEM SHALL 슬러그를 다시 붙이지 않고 404 로 끝낸다. (원본: _layout §2.2, R-3)

### 메인 영역과 공통 헤더

- REQ-LAYOUT-022 WHEN 메인 영역을 그리면 THE SYSTEM SHALL 사이드바를 뺀 나머지 너비를 모두 쓴다. (원본: _layout §4)
- REQ-LAYOUT-023 WHILE 사용자가 메인 영역을 스크롤하는 동안 THE SYSTEM SHALL 사이드바는 고정하고 메인 영역만 따로 스크롤한다. (원본: _layout §4)
- REQ-LAYOUT-024 WHEN 사용자가 페이지를 옮기면 THE SYSTEM SHALL SPA 라우팅으로 부드럽게 전환한다. (원본: _layout §4)
- REQ-LAYOUT-025 WHILE 페이지나 데이터를 불러오는 동안 THE SYSTEM SHALL 스켈레톤 UI 를 보인다. (원본: _layout §4, 0-overview §3.4)
- REQ-LAYOUT-026 WHEN 페이지를 그리면 THE SYSTEM SHALL 메인 영역 맨 위에 페이지 제목, 설명 또는 브레드크럼, 주 액션 버튼을 가진 공통 헤더를 둔다. (원본: _layout §5)
- REQ-LAYOUT-027 WHEN 하위 페이지를 그리면 THE SYSTEM SHALL 공통 헤더에 브레드크럼을 보인다. (원본: _layout §5)

### 공통 UI 패턴

- REQ-LAYOUT-028 WHEN 목록 화면을 그리면 THE SYSTEM SHALL 위에 검색바·필터·생성 버튼을, 가운데에 표나 카드 목록을, 아래에 페이지 이동이나 무한 스크롤을 둔다. (원본: 0-overview §3.2)
- REQ-LAYOUT-029 WHEN 사용자가 목록 항목을 우클릭하거나 더보기(…) 메뉴를 열면 THE SYSTEM SHALL 편집·복제·삭제 같은 항목 액션을 보인다. (원본: 0-overview §3.2)
- REQ-LAYOUT-030 WHEN 사용자가 상세나 설정을 열면 THE SYSTEM SHALL 상세 드로어나 모달로 보인다. (원본: 0-overview §3.3)
- REQ-LAYOUT-031 WHEN 사용자가 설정 패널의 값을 바꾸면 THE SYSTEM SHALL 저장·취소(또는 "변경 저장") 버튼으로 저장하게 한다. (원본: 0-overview §3.3)
- REQ-LAYOUT-032 WHEN 사용자가 값을 입력하면 THE SYSTEM SHALL 유효성 검증 결과를 즉시 보인다. (원본: 0-overview §3.3)
- REQ-LAYOUT-033 WHEN 리소스 상태를 보이면 THE SYSTEM SHALL 한 단어짜리 배지로 보인다(Active 초록, Inactive 회색, Error 빨강, Processing 파랑 스피너). (원본: 0-overview §3.4)
- REQ-LAYOUT-034 WHEN 단발성 성공·실패·정보를 알리면 THE SYSTEM SHALL 토스트로 보인다. (원본: 0-overview §3.4)
- REQ-LAYOUT-035 WHILE 사용자가 외부 작업을 하면서 안내를 계속 봐야 하는 동안 THE SYSTEM SHALL 페이지 안에 인라인 안내를 계속 보인다. (원본: 0-overview §3.4)
- REQ-LAYOUT-036 WHEN 인라인 안내를 보이면 THE SYSTEM SHALL 긴급도에 따라 info(파랑)·warning(amber)·error(빨강) 세 톤 가운데 하나를 쓴다. (원본: 0-overview §3.4)
- REQ-LAYOUT-037 WHEN 관련된 다음 변경 요청이 시작되기 직전이면 THE SYSTEM SHALL 인라인 안내를 비운다. (원본: 0-overview §3.4)
- REQ-LAYOUT-038 WHEN 변경 요청과 연결된 인라인 안내를 보이면 THE SYSTEM SHALL 사용자가 닫는 X 버튼을 두지 않는다. (원본: 0-overview §3.4)
- REQ-LAYOUT-039 IF 인라인 안내가 변경 요청과 연결되지 않은 단순 정보나 경고이면 THE SYSTEM SHALL 닫는 X 버튼을 둘 수 있다. (원본: 0-overview §3.4)

### 반응형과 테마

- REQ-LAYOUT-040 WHEN 에디터·대시보드 같은 작업형 페이지를 그리면 THE SYSTEM SHALL 1280x720 을 최소 권장 해상도로 삼는다. (원본: 0-overview §3.5)
- REQ-LAYOUT-041 WHEN 사용자가 테마를 고르면 THE SYSTEM SHALL 라이트와 다크 테마를 모두 지원한다. (원본: 0-overview §3.5)
- REQ-LAYOUT-042 WHEN 사용자가 모바일에서 워크플로우 에디터를 열면 THE SYSTEM SHALL 뷰어 모드만 제공한다. (원본: 0-overview §3.5)
- REQ-LAYOUT-043 WHILE 뷰포트 너비가 1024px 미만인 동안 THE SYSTEM SHALL 사용자 가이드 같은 열람형 페이지를 상세 드로어(`SlideDrawer`) 진입으로 최소한 열람할 수 있게 한다. (원본: 0-overview §3.5)

## 화면 구성

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 사이드바 | 왼쪽 고정. 펼침 240px, 축소 64px | 위: 로고. 가운데: 메뉴 13개. 아래: 사용자 영역(아바타·이름) | 메뉴를 누르면 화면 전환. 축소·펼침 토글. 1280px 미만에서는 숨기고 햄버거로 연다 |
| 메인 영역 | 사이드바 오른쪽 전체 | 공통 헤더 + 페이지 본문 | 사이드바와 따로 스크롤. 불러오는 동안 스켈레톤 |
| 공통 헤더 | 메인 영역 맨 위 | 왼쪽: 페이지 제목(예: "Workflows", "Schedule")과 그 아래 설명 또는 브레드크럼. 오른쪽: 주 액션 버튼(예: "+ New Workflow", "+ Add Schedule") | 하위 페이지면 브레드크럼을 보인다 |

## 사이드바

### 메뉴 항목

경로는 논리 경로다. 실제 URL 은 [워크스페이스 슬러그 라우팅](#워크스페이스-슬러그-라우팅) 에 따라 `/w/<slug>/<경로>` 로 그린다. 사용자 가이드만 예외다.

| 순서 | 항목 | 아이콘 | 경로 | 비고 |
| --- | --- | --- | --- | --- |
| 1 | Dashboard | 홈(LayoutDashboard) | `/dashboard` | [대시보드](../CLE-OBS/CLE-OBS-DASHBOARD.md) |
| 2 | Workflows | 플로우차트(GitBranch) | `/workflows` | [워크플로우 목록과 폴더](../CLE-WF/CLE-WF-LIST.md) |
| 3 | Triggers | 번개(Zap) | `/triggers` | [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 4 | Schedule | 달력(Calendar) | `/schedules` | [스케줄](../CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 5 | Web Chat | 말풍선(MessageCircle) | `/web-chat` | 임베드형 웹채팅 위젯의 설치·미리보기 콘솔. [웹채팅 운영 콘솔](../CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) |
| 6 | Integration | 퍼즐(Puzzle) | `/integrations` | HTTP·DB·Email·MCP 서버 등 외부 통합. [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) |
| 7 | Knowledge Base | 책(BookOpen) | `/knowledge-bases` | RAG 용 지식 저장소. Vector·Graph 모드. [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md) |
| 8 | Models | 두뇌(Brain) | `/models` | AI 노드가 부를 모델 프로바이더·기본 모델·파라미터. [모델 설정](../CLE-AI/CLE-AI-MODELS.md) |
| 9 | Authentication | 자물쇠(Lock) | `/authentication` | 외부 호출자용 API Key·Bearer·Basic 인증. [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 10 | Statistics | 차트(BarChart3) | `/statistics` | [통계](../CLE-OBS/CLE-OBS-STATS.md) |
| 11 | System Status | 활동(Activity) | `/system-status` | 워크스페이스·사용자와 무관한 전체 시스템(큐) 상태. [시스템 상태](../CLE-OBS/CLE-OBS-STATUS.md) |
| 12 | Agent Memory | 두뇌 회로(BrainCircuit) | `/agent-memory` | 에이전트 메모리 조회·관리. [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) |
| 13 | User Guide | 책(BookMarked) | `/docs` | 에디터·설정·노드 도움말. [사용자 가이드](CLE-UI-GUIDE.md) |

모델 설정과 인증 설정은 설정(Config) 하위 메뉴가 아니라 최상위 메뉴다. 설정 묶음 하위 메뉴와 그 접기·펼치기 동작은 지금 없다. 나중에 설정 묶음을 다시 도입하면 그때 정한다.

마켓플레이스는 아직 구현하지 않아 사이드바에 없다([마켓플레이스 (구상)](CLE-UI-MARKET.md)). 구현할 때의 위치는 정하지 않았다([미결 사항](#미결-사항)).

### 사용자 영역

사이드바 하단에는 아바타(또는 이니셜)와 이름, 현재 워크스페이스 이름, 알림 벨이 있다. 아바타를 누르면 팝업 메뉴가 열린다. 사용자 영역과 팝업은 [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md), 알림 벨과 팝오버는 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md), 워크스페이스 전환은 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 가 정한다.

### 축소와 반응형

| 뷰포트 너비 | 사이드바 기본 상태 |
| --- | --- |
| 1440px 이상 | 펼침(240px) |
| 1280~1439px | 축소(아이콘만, 64px) |
| 1280px 미만 | 숨김. 햄버거 메뉴로 연다 |

축소 모드는 하단 토글 버튼(수동)과 1280~1439px 자동 축소 두 가지로 켜진다. 사용자가 직접 정한 값이 있으면 그 값을, 없으면 뷰포트 기준 값을 쓴다(`manualCollapse ?? isMedium`).

워크플로우 에디터도 같은 축소 상태를 따른다. 에디터 라우트에 들어갈 때 사이드바를 자동으로 축소하거나 숨기는 동작은 아직 없다(미구현).

이 표는 모든 화면에 걸친 전역 사이드바에만 적용한다. 사용자 가이드(`/docs`) 안의 가이드 사이드바는 본문 안의 보조 탐색이라 별도 기준(1024px)을 쓴다. 근거는 [사용자 가이드](CLE-UI-GUIDE.md) 의 Rationale 에 있다.

## 워크스페이스 슬러그 라우팅

앱 화면의 URL 은 현재 워크스페이스(active workspace) 기준이다. 사이드바는 `buildWorkspaceHref(slug, path)` 로 `/w/<slug>/<경로>` 링크를 만든다. URL 의 슬러그는 화면 라우팅의 기준이고, 서버 인가의 기준은 아니다([워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)).

- **사용자 가이드는 예외다.** `/docs` 는 워크스페이스와 무관한 콘텐츠라 슬러그 밖에 둔다. 인증 화면(`(auth)`)도 같다. 사이드바는 이 예외를 메뉴 정의(`navItems`)의 `workspaceScoped: false` 로 적는다. 예외를 선언할 때 고정해 두면 "모든 항목에 슬러그를 무조건 붙이는" 회귀를 막는다.
- **에디터도 슬러그 경로다.** 워크플로우 에디터는 `/w/<slug>/workflows/[id]` 다.
- **옛 경로 흡수 라우트(catch-all route)**: 슬러그 없는 옛 경로로 들어오면 `(main)/[...rest]` 가 현재 워크스페이스 슬러그로 흡수한다. 이 라우트는 `/w/` 로 시작하는 경로를 흡수하지 않고 끝낸다.

| 들어온 경로 | 동작 |
| --- | --- |
| 슬러그 없는 경로(`/workflows`, `/dashboard`, `/integrations/<id>`, `/`) | 현재 워크스페이스 슬러그 경로로 넘긴다. query 와 hash 를 보존한다 |
| `/w/<slug>` 만 | 그 워크스페이스의 대시보드로 넘긴다. query 와 hash 를 보존한다 |
| 그 밖의 `/w/…` | `notFound()` 로 404 를 보인다. 사이드바는 유지한다([오류 화면과 빈 상태](CLE-UI-ERRORS.md)) |

예를 들어 `/w/<slug>/docs` 는 `/docs` 가 슬러그 밖 라우트라 `w/[slug]` 아래에 없다. 이런 경로에 슬러그를 다시 붙이면 맞지 않는 경로가 한 바퀴마다 한 세그먼트씩 길어지는 무한 리다이렉트가 된다.

슬러그가 없는 워크스페이스이거나 사용자가 멤버가 아니면 404 가 아니라 기본 워크스페이스로 넘긴다. 이것은 라우트는 있고 슬러그 해석만 실패한 경우로, 다른 층이다([오류 화면과 빈 상태](CLE-UI-ERRORS.md)).

## 공통 UI 패턴

### 목록 화면

- 위: 검색바 + 필터 + 생성 버튼
- 가운데: 표나 카드 목록
- 아래: 페이지 이동 또는 무한 스크롤
- 항목마다: 우클릭이나 더보기(…) 메뉴로 편집·복제·삭제 같은 액션

검색·필터 결과가 없을 때와 데이터가 없을 때의 화면은 [오류 화면과 빈 상태](CLE-UI-ERRORS.md) 가 정한다.

### 상세·설정 패널

- 오른쪽 상세 드로어 또는 모달로 연다.
- 설정 패널은 저장·취소(또는 "변경 저장") 버튼으로 저장한다. 워크플로우 에디터 캔버스는 수동 저장(`Ctrl+S`·Save)과 실행 직전 저장만 하고 타이머 자동 저장은 없다([워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md)).
- 유효성 검증 결과를 즉시 보인다.

### 상태 표시

| 패턴 | 쓰임 |
| --- | --- |
| 배지(Badge/Tag) | 리소스의 상태를 한 단어로 보인다. Active(초록), Inactive(회색), Error(빨강), Processing(파랑 스피너). 색은 리소스 상태를 뜻하고 인라인 안내의 톤(긴급도)과는 별개다. 같은 파랑이라도 배지의 Processing 과 안내의 info 는 뜻이 다르다 |
| 토스트(Toast) | 성공·실패·정보를 알린다. 사용자가 다른 화면으로 넘어가도 되는 단발성 메시지다. 인라인 안내와 함께 쓸 때는 "응답이 왔다" 만 알리는 보조 역할이고 본문은 안내가 맡는다. 변경 요청 하나의 결과만 알리는 단독 토스트와는 역할이 다르다 |
| 인라인 안내(inline alert) | 페이지 안에 계속 보이는 안내 상자. 아래 설명 참조 |
| 스켈레톤(Skeleton) | 불러오는 동안의 UI 자리표시자 |

전체 화면 오류와 빈 상태는 이 표의 대상이 아니다. 화면 안 신호(배지·토스트·인라인 안내·스켈레톤)만 다룬다.

### 인라인 안내

사용자가 외부 작업을 하는 동안 안내를 계속 봐야 할 때 쓴다. 외부 작업의 예는 Cafe24 Developers 콘솔에서 권한 켜기, 본사 승인 신청, 외부 시스템 키 교체, 이메일 인증이다. 모달·대화상자와 달리 닫혀도 사라지지 않아, 사용자가 화면을 떠나지 않고 외부 작업과 안내를 함께 볼 수 있다.

- **톤**: info(파랑)·warning(amber)·error(빨강) 세 단계. 긴급도를 뜻한다. 뜻이 다른 두 안내가 한 화면에 함께 있으면 톤으로 바로 구분된다. 단순 상태 표시는 배지가 맡고, 인라인 안내는 "사용자가 다음에 무엇을 해야 하는가" 가 본문일 때 쓴다.
- **토스트와의 역할 분리**: 안내는 본문, 토스트는 도착 신호다. 응답이 왔다는 사실은 토스트가 한 번 알리고, 무엇을 해야 하는지는 안내가 계속 보인다. 둘은 서로를 대신하지 않는다. 외부 작업 안내를 토스트만으로 처리하면 사용자가 다른 화면으로 넘어가는 순간 사라져 맥락이 끊긴다.
- **수명**: 관련된 다음 변경 요청이 시작되기 직전(`useMutation` 의 `onMutate`)에 비워 옛 안내가 새 요청과 섞이지 않게 한다. 사용자가 닫는 X 버튼은 두지 않는다. 외부 작업이 끝나 자동으로 갱신되거나 다음 시도가 시작될 때 비워진다. 닫아도 안전한 경우(단순 정보, 변경 요청과 연결되지 않은 경고)에만 X 버튼을 허용한다.
- **현재 사용처**:
  - Cafe24 Public 새 등록 폼의 별도 승인 권한 경고(warning, 계속 표시): [통합 관리](../CLE-INT/CLE-INT-MANAGE.md), [Cafe24 별도 승인 scope](CLE-C24-SCOPES)
  - 통합 상세 Scope & Permissions 탭의 Cafe24 Private 권한 추가 응답 안내(warning): [통합 관리](../CLE-INT/CLE-INT-MANAGE.md)
  - 통합 상세 활동 탭의 "연결 안 됨" 안내. 통합 상태에 따라 톤을 올린다. `error` 는 error(빨강), `expired`·`pending_install` 은 warning(amber)이다: [통합 관리](../CLE-INT/CLE-INT-MANAGE.md)

### 반응형과 테마

- 최소 해상도 1280x720 은 에디터·대시보드 같은 작업형 페이지의 권장 기준이다.
- 라이트·다크 테마를 지원한다. 테마를 바꾸는 곳은 [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md) 의 환경설정이다.
- 워크플로우 에디터는 데스크톱 전용이다. 모바일에서는 뷰어 모드만 준다([미결 사항](#미결-사항)).
- 사용자 가이드(`/docs`) 같은 열람형 페이지는 1024px(lg) 미만에서도 상세 드로어(`SlideDrawer`) 진입으로 최소한 열람할 수 있다([사용자 가이드](CLE-UI-GUIDE.md)).

## 미결 사항

- **모바일 뷰어 모드의 근거**: 원문 공통 UI 패턴은 "에디터는 데스크톱 전용이고 모바일에서는 뷰어 모드만 제공한다" 고 적는다. 그런데 뷰어 모드를 정의한 문서가 이 한 줄 말고 없고, 레이아웃 규칙은 1280px 미만에서 사이드바를 숨기는 것만 정한다. 모바일 뷰어 모드가 실제로 있는지 확인이 필요하다. 없으면 계획으로 표시해야 한다.
- **마켓플레이스 메뉴 위치**: 레이아웃 원문의 주석은 구현하면 System Status 바로 뒤에 둔다고 적고, 내비게이션 PRD 트리는 User Guide 뒤 맨 끝에 둔다. 주석의 번호(11)도 지금 메뉴 순서와 맞지 않는다. 착수할 때 정한다(관련: [마켓플레이스 (구상)](CLE-UI-MARKET.md)).

## 구현 위치

- `codebase/frontend/src/components/layout/**`
- `codebase/frontend/src/lib/stores/sidebar-store.ts`
- `codebase/frontend/src/lib/notifications/*.ts` (알림 벨 필터와 딥링크. 규칙은 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md))
- `codebase/frontend/src/app/(main)/[...rest]/page.tsx` (옛 경로 흡수 라우트)
- `codebase/frontend/src/lib/workspace/href.ts` (`buildWorkspaceHref`)

## Rationale

### 사이드바 로고 규칙은 브랜드 문서를 따른다

이 문서는 사이드바의 자리만 정하고, 그 자리에 들어가는 로고 변종과 색은 [브랜드](CLE-UI-BRAND.md) 가 정한다. 펼침은 Full logo, 접힘은 Icon mark 라는 규칙도 브랜드 문서의 로고 노출 자리 결정을 옮긴 것이다. 라이트·다크 자산 선택도 노출 자리의 배경 톤에 따라 브랜드 문서가 정하므로, 이 문서의 로고 행은 라이트·다크를 구분하지 않는다.

### 옛 경로 흡수 라우트가 `/w/` 경로를 흡수하지 않는 이유

`(main)/[...rest]` 는 슬러그 없는 경로를 현재 슬러그로 흡수하지만, 이미 `/w/` 인 경로는 흡수하지 않고 끝낸다. 두 대안을 기각했다.

- **슬러그 다시 붙이기**: 처음 구현이었고 실제 사용자 보고 회귀의 원인이었다. `w/[slug]` 아래에 없는 세그먼트(예: `/w/<slug>/docs`)는 라우트에 맞지 않아 흡수 라우트로 오는데, 여기서 슬러그를 또 붙이면 영원히 맞지 않는 경로가 한 바퀴마다 한 세그먼트씩 길어진다(`/w/a/docs` → `/w/a/w/a/docs` → …). 무한 리다이렉트다.
- **`/w/<slug>` 를 떼고 다시 넘기기**: `/w/<slug>/<미지>` → `/<미지>` → 흡수 라우트가 다시 붙여 `/w/<slug>/<미지>` → … 로 오가는 무한 루프가 되어 증상만 바뀐다.

그래서 끝내는 것이 무한 루프가 없는 유일한 선택이다. `notFound()` 는 새 정책이 아니라 "존재하지 않는 라우트 접근은 404" 라는 기존 정책을 지키는 것이다. 오히려 고치기 전의 무한 리다이렉트가 그 정책 위반이었다. `/w/<slug>` 만 대시보드로 넘기는 것은 그 경로가 워크스페이스 루트로서 뜻이 있고, 넘기는 곳(`/w/<slug>/dashboard`)이 실재 라우트라 흡수 라우트로 다시 들어오지 않기 때문이다.

`buildWorkspaceHref` 는 일부러 멱등이 아니다. 이미 `/w/…` 인 경로를 조용히 삼키면 호출한 쪽의 버그를 감춘다. `("team-a", "/w/team-b/x")` 에 대한 올바른 답이 team-a 인지 team-b 인지도 정의되지 않는다. 이런 실패는 흡수 라우트의 종료 규칙이 무한 리다이렉트가 아니라 눈에 보이는 404 로 떨어뜨려 드러낸다.

슬러그가 없거나 멤버가 아닌 워크스페이스의 처리(기본 워크스페이스로 넘김, 404 아님)와는 다른 층이다. 그쪽은 라우트는 있고 슬러그 해석만 실패한 경우로, `[slug]` 레이아웃의 `WorkspaceSlugGate` 가 맡는다. 이 규칙은 라우트 자체가 없는 경우다.

### 인라인 안내를 공통 패턴 자리에 둔 이유

인라인 안내는 통합·지식 저장소 같은 내비게이션 화면에서 처음 도입됐다. 그래서 내비게이션 레이아웃 문서에 두는 것이 자연스러워 보였다. 그러나 앞으로 웹훅 서명 키 교체나 알림 설정 변경처럼 내비게이션 밖으로 사용처가 넓어질 가능성을 보면, 영역에 묶어 두는 비용이 더 크다고 판단했다. 그래서 여러 화면이 함께 쓰는 공통 패턴 자리에 둔다. 첫 사용처와 문서상 거리가 멀어진 것은 받아들인 비용이다.
