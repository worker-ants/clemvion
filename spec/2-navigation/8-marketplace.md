---
id: marketplace
status: backlog
code: []
---

# Spec: 마켓플레이스 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#310-marketplace-마켓플레이스) · [PRD 통합/연동](../4-nodes/4-integration/_product-overview.md#4-marketplace-마켓플레이스) · [Spec 레이아웃](./_layout.md)

---

## 1. 화면 구조

```
┌──────────────────────────────────────────────────────────────┐
│  Marketplace                                                 │
│                                                              │
│  ┌──────────────────────────┐  ┌────────────────────────┐    │
│  │ 🔍 Search marketplace... │  │ Category: All ▼       │    │
│  └──────────────────────────┘  └────────────────────────┘    │
│                                                              │
│  [All] [Workflows] [Nodes] [AI Agents] [Integrations]       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 📋       │ │ 🤖       │ │ 🔌       │ │ 📋       │       │
│  │ Customer │ │ Support  │ │ Notion   │ │ Data     │       │
│  │ Onboard  │ │ Agent    │ │ Plugin   │ │ Pipeline │       │
│  │ ★★★★☆   │ │ ★★★★★   │ │ ★★★★☆   │ │ ★★★☆☆   │       │
│  │ 1.2k ↓   │ │ 890 ↓   │ │ 3.4k ↓   │ │ 456 ↓   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ ...      │ │ ...      │ │ ...      │ │ ...      │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│                    Load More                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 카테고리 탭

| 탭 | 내용 |
|----|------|
| All | 전체 항목 |
| Workflows | 워크플로우 템플릿 |
| Nodes | 커스텀 노드 |
| AI Agents | AI Agent 프리셋 |
| Integrations | Integration 플러그인 |

### 2.2 아이템 카드

| 요소 | 설명 |
|------|------|
| 아이콘/썸네일 | 유형별 기본 아이콘 또는 게시자가 제공한 이미지 |
| 이름 | 아이템 이름 |
| 카테고리 뱃지 | 유형 구분 (Workflow, Node, Agent, Integration) |
| 평점 | 별점 (5점 만점) |
| 다운로드 수 | 설치 횟수 |
| 게시자 | 제작자 이름 |

### 2.3 아이템 상세 페이지

```
┌──────────────────────────────────────────────────────────────┐
│  ← Marketplace                                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  🤖 Customer Support Agent         [Install] [★ 4.8]  │  │
│  │  by @workflow-master · v2.1.0 · Updated 2026-03-20    │  │
│  │  Category: AI Agent                                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [Overview] [Screenshots] [Reviews] [Versions]              │
│                                                              │
│  ## Description                                              │
│  Pre-configured AI agent for customer support automation...  │
│                                                              │
│  ## Includes                                                 │
│  - System prompt optimized for support scenarios             │
│  - Knowledge Base template for FAQ                           │
│  - 3 tool configurations (ticket create, escalate, ...)      │
│                                                              │
│  ## Requirements                                             │
│  - LLM Provider: OpenAI or Anthropic                         │
│  - Integration: Email (optional)                             │
│                                                              │
│  ## Reviews                                                  │
│  ★★★★★ "Exactly what we needed" - @user123                  │
│  ★★★★☆ "Great but needs more customization" - @dev456       │
└──────────────────────────────────────────────────────────────┘
```

### 2.4 설치 플로우

1. "**Install**" 버튼 클릭
2. 의존성 확인 (필요한 Integration, LLM 설정 등)
3. 충돌 확인 (이미 설치된 동일 아이템의 다른 버전)
4. 설치 위치 선택 (개인/팀 워크스페이스)
5. 설치 완료 → 해당 리소스 자동 생성
   - Workflow 템플릿 → 새 워크플로우 생성
   - Node → 노드 팔레트에 추가
   - Agent 프리셋 → AI Agent 노드 설정에서 선택 가능
   - Integration → Integration 목록에 추가 (인증 정보 입력 필요)

### 2.5 설치된 아이템 관리

- "My Installations" 탭 (또는 필터)
- 업데이트 가능한 아이템 표시 (뱃지)
- 업데이트: 변경 사항 표시 후 확인
- 제거: 확인 다이얼로그 후 삭제 (연관 워크플로우에 영향 경고)

### 2.6 게시(퍼블리싱) 화면

| 단계 | 내용 |
|------|------|
| 1. 소스 선택 | 게시할 워크플로우/노드/Agent 프리셋 선택 |
| 2. 정보 입력 | 이름, 설명, 카테고리, 태그, 스크린샷 |
| 3. 버전 설정 | 버전 번호, 변경 로그 |
| 4. 검증 | 자동 검증 (필수 필드, 의존성 확인) |
| 5. 게시 | 마켓플레이스에 공개 |

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/marketplace/items | 아이템 목록 (쿼리: category, search, sort) |
| GET | /api/marketplace/items/:id | 아이템 상세 |
| POST | /api/marketplace/items/:id/install | 설치 |
| DELETE | /api/marketplace/items/:id/uninstall | 제거 |
| POST | /api/marketplace/items/:id/update | 업데이트 |
| GET | /api/marketplace/items/:id/reviews | 리뷰 목록 |
| POST | /api/marketplace/items/:id/reviews | 리뷰 작성 |
| GET | /api/marketplace/my-installations | 설치된 아이템 목록 |
| POST | /api/marketplace/publish | 게시 |
| GET | /api/marketplace/my-publications | 내 게시물 목록 |
| PATCH | /api/marketplace/my-publications/:id | 게시물 수정 |
| GET | /api/marketplace/my-publications/:id/stats | 게시물 통계 |
