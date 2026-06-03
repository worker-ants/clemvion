# Spec: 전체 레이아웃

> 관련 문서: [PRD 내비게이션](./_product-overview.md) · [Spec 아키텍처 개요](../0-overview.md)

---

## 1. 레이아웃 구조

```
┌──────────────────────────────────────────────────────────────┐
│ Browser Window                                               │
│ ┌────────────┬──────────────────────────────────────────────┐ │
│ │            │                                              │ │
│ │  Sidebar   │             Main Content                     │ │
│ │  (240px)   │                                              │ │
│ │            │                                              │ │
│ │  ┌──────┐  │                                              │ │
│ │  │ Logo │  │                                              │ │
│ │  └──────┘  │                                              │ │
│ │            │                                              │ │
│ │  Nav Menu  │                                              │ │
│ │  --------  │                                              │ │
│ │  Dashboard │                                              │ │
│ │  Workflows │                                              │ │
│ │  Triggers  │                                              │ │
│ │  Schedule  │                                              │ │
│ │  Integ.    │                                              │ │
│ │  KB        │                                              │ │
│ │  LLM Cfg   │                                              │ │
│ │  Auth      │                                              │ │
│ │  Stats     │                                              │ │
│ │  SysStatus │                                              │ │
│ │  User Gd   │                                              │ │
│ │            │                                              │ │
│ │  --------  │                                              │ │
│ │  ┌──────┐  │                                              │ │
│ │  │User  │  │                                              │ │
│ │  │Avatar│  │                                              │ │
│ │  └──────┘  │                                              │ │
│ └────────────┴──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 사이드바

### 2.1 구성

| 영역 | 위치 | 내용 |
|------|------|------|
| 로고 | 상단 | 제품 로고. 사이드바 expanded 상태에서는 **Full logo** , collapsed 상태에서는 **Icon mark** 를 표시. 클릭 시 대시보드(홈, `/dashboard`)로 이동. 라이트/다크 자산 선택과 변종 매트릭스는 [`spec/6-brand.md` §8.4](../6-brand.md#84-로고-시스템) 참조 |
| 메인 메뉴 | 중앙 | 내비게이션 항목 목록 |
| 사용자 영역 | 하단 | 아바타 + 사용자 이름 |

### 2.2 메뉴 항목

| 순서 | 항목 | 아이콘 | 경로 | 비고 |
|------|------|--------|------|------|
| 1 | Dashboard | 홈 아이콘 (LayoutDashboard) | /dashboard | |
| 2 | Workflows | 플로우차트 아이콘 (GitBranch) | /workflows | |
| 3 | Triggers | 번개 아이콘 (Zap) | /triggers | |
| 4 | Schedule | 달력 아이콘 (Calendar) | /schedules | |
| 5 | Integration | 퍼즐 아이콘 (Puzzle) | /integrations | HTTP·DB·Email·MCP 서버 등 외부 통합 |
| 6 | Knowledge Base | 책 아이콘 (BookOpen) | /knowledge-bases | RAG용 컬렉션. Vector·Graph 모드 지원. 상세는 [Knowledge Base](./5-knowledge-base.md) |
| 7 | LLM Config | 두뇌 아이콘 (Brain) | /llm-configs | AI 노드가 호출할 LLM 프로바이더·기본 모델·파라미터. 상세는 [Config](./6-config.md) Part B |
| 8 | Authentication | 자물쇠 아이콘 (Lock) | /authentication | 외부 호출자용 API Key·Bearer·Basic 인증. 상세는 [Config](./6-config.md) Part A |
| 9 | Statistics | 차트 아이콘 (BarChart3) | /statistics | |
| 10 | System Status | 활동 아이콘 (Activity) | /system-status | 전체 시스템(큐) 상태 지표. 워크스페이스/유저 무관. 상세는 [System Status](./15-system-status.md) 참조 |
| 11 | User Guide | 책 아이콘 (BookMarked) | /docs | 사용자 매뉴얼. 에디터·설정·노드 도움말. 상세는 [User Guide](./13-user-guide.md) 참조 |

<!-- 로드맵 — Marketplace는 아직 미구현이며, 구현 시 System Status(10) 이후에 배치한다. -->

### 2.3 사이드바 동작

| 동작 | 설명 |
|------|------|
| 활성 메뉴 표시 | 현재 페이지에 해당하는 메뉴 항목 하이라이트 (배경색 또는 좌측 indicator) |
| ~~Config 접기/펼치기~~ | ~~Config 클릭 시 하위 메뉴 토글~~ — 현재는 Config 서브메뉴 구조 없음. 차후 Config 그룹 도입 시 적용 |
| 사이드바 축소 | 아이콘만 표시하는 축소 모드 지원. 하단 토글 버튼(수동) + 1280–1439px viewport 자동 축소(`manualCollapse ?? isMedium`). |
| 워크플로우 에디터 모드 | **미구현 (Planned)** — 에디터 라우트 진입 시 사이드바를 자동 축소/숨김하는 트리거는 없다. 에디터 레이아웃도 동일한 collapsed 상태(수동 토글 + 1280–1439px 자동)만 따른다. |
| 툴팁 | 축소 모드에서 메뉴 아이콘 호버 시 메뉴 이름 툴팁 |

### 2.4 반응형

- **≥ 1440px**: 사이드바 기본 확장 (240px)
- **1280px ~ 1439px**: 사이드바 기본 축소 (아이콘만, 64px)
- **< 1280px**: 사이드바 숨김, 햄버거 메뉴로 토글

> **참고**: 본 표는 *전역 chrome* 인 글로벌 사이드바에만 적용된다. `/docs` 내부 가이드 사이드바는 article 안의 *보조 네비* 로 별도 breakpoint (lg=1024px) 를 사용한다. 근거는 [`./13-user-guide.md` Rationale R-1](./13-user-guide.md#r-1-docs-내부-사이드바-breakpoint-가-글로벌-1280px-과-다른-이유) 참조.

---

## 3. 사용자 영역 (하단)

### 3.1 기본 상태
- 사용자 아바타(또는 이니셜) + 이름 표시
- 현재 워크스페이스 이름 표시 (축소 텍스트)
- 알림 벨 아이콘 (visible 미읽은 알림 수 뱃지 표시 — `is_read=false AND dismissed_at IS NULL`, 사용자 영역 옆 또는 사이드바 하단)
  - 팝오버를 열면 알림 목록이 표시되며, 각 항목 hover 시 우측에 ✓(개별 읽음) / ✕(개별 닫기) 액션이 노출된다. 항목 본문 클릭 시 자동 읽음 처리 + `resource_type`/`resource_id` 기반 deep link 이동.
  - 팝오버 헤더 우측 메뉴에 "모두 읽음 처리"(`POST /notifications/mark-all-read`) 와 "모두 지우기"(`POST /notifications/dismiss-all`) 일괄 액션을 분리해 노출한다. 두 액션은 독립이며 한쪽이 다른쪽을 함의하지 않는다.
  - 자세한 read/dismiss 라이프사이클·DTO·동사 선택 근거는 [data-flow/8-notifications.md §3-§4](../data-flow/8-notifications.md#3-상태-전이) 참조.

### 3.2 클릭 시 팝업 메뉴

사용자 아바타 클릭 시 열리는 팝업에는 **내 프로필 · 로그아웃** 2개 항목만 둔다. 워크스페이스 전환/관리·테마 전환은 아래 안내대로 별도 surface 로 분리되어 있으며, 본 팝업에 중복 배치하지 않는다.

| 항목 | 동작 |
|------|------|
| 내 프로필 | 사용자 프로필 페이지(`/profile`, 디폴트 readonly)로 이동. 편집은 카드별 [편집] 토글 또는 sub-route 로 분리. 상세: [User Profile spec §2](./9-user-profile.md#2-내-프로필-화면) |
| 로그아웃 | 세션 종료 후 로그인 페이지 이동 |

> 구현: `codebase/frontend/src/components/layout/sidebar.tsx` 의 user area 팝업(아바타 클릭)은 프로필 링크 + 로그아웃 버튼만 렌더한다.

**팝업 밖으로 분리된 항목**

| 항목 | 실제 위치 |
|------|-----------|
| 워크스페이스 전환 | 사용자 영역 위의 **독립 워크스페이스 스위처** 블록(개인/팀 그룹 + 현재 워크스페이스 표시 + 전환). |
| 워크스페이스 관리 | 워크스페이스 스위처 하단 "여기 설정"(`/workspace/settings`) 링크 + 새 팀 워크스페이스 생성. 권한별 노출은 해당 페이지에서 처리. |
| 테마 전환 | 사이드바가 아니라 **프로필 환경설정 카드**(`/profile`, theme=light/dark 토글, 라이브 프리뷰)에 위치. 구현: `app/(main)/profile/components/profile-preferences-card.tsx`. |
| 알림 설정 | **미구현 (Planned)** — 알림 기본 설정 surface 는 아직 없다. (`/profile/alerts` 는 실패율·duration·LLM 비용 *알림 룰* 페이지로, 본 항목과 별개.) |

---

## 4. 메인 컨텐츠 영역

| 항목 | 설명 |
|------|------|
| 너비 | 사이드바를 제외한 나머지 영역 전체 사용 |
| 스크롤 | 메인 영역 독립 스크롤 (사이드바는 고정) |
| 페이지 전환 | SPA 라우팅, 페이지 전환 시 부드러운 트랜지션 |
| 로딩 상태 | 페이지 로드 중 Skeleton UI 표시 |

---

## 5. 공통 헤더 (메인 영역 상단)

각 페이지의 메인 영역 최상단에 공통 헤더를 배치한다.

```
┌────────────────────────────────────────────────────┐
│  📄 Page Title                    [Action Button]  │
│  Page description or breadcrumb                    │
└────────────────────────────────────────────────────┘
```

| 요소 | 설명 |
|------|------|
| 페이지 제목 | 현재 페이지 이름 (예: "Workflows", "Schedule") |
| 설명/브레드크럼 | 하위 페이지의 경우 브레드크럼 표시 |
| 액션 버튼 | 페이지별 주요 액션 (예: "+ New Workflow", "+ Add Schedule") |

---

## Rationale

### R-1. 사이드바 로고 변종 규칙

§2.1 로고 행에 expanded/collapsed 변종 규칙을 두는 이유: 본 문서는 사이드바의 **자리**만 정의하고, 자리에 들어가는 로고 변종·색은 `spec/6-brand.md §8.4` (brand spec) 가 단일 진실로 결정한다. 본 행은 brand spec §8.4.6 의 결정(expanded → Full logo / collapsed → Icon mark)을 자리 정의에 반영한 것이다.

근거 출처: `spec/6-brand.md §8.4.6` (로고 노출 자리) 및 동 문서 Rationale "브랜드 spec 의 라우트 spec 우선권".

### R-2. §2.1 로고 행 — 라이트/다크 자산 선택 위임

§2.1 의 로고 행은 라이트/다크 한정 없이 표기한다. 라이트/다크 자산 선택은 노출 자리(surface) 의 배경 톤에 따라 brand spec §8.4 가 결정한다 (§8.4.6 표 기준).
