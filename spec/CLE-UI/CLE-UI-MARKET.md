---
id: "CLE-UI-MARKET"
title: "마켓플레이스 (구상)"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-MARKET-001", "REQ-MARKET-002", "REQ-MARKET-003", "REQ-MARKET-004", "REQ-MARKET-005", "REQ-MARKET-006", "REQ-MARKET-007", "REQ-MARKET-008", "REQ-MARKET-009", "REQ-MARKET-010", "REQ-MARKET-011", "REQ-MARKET-012", "REQ-MARKET-013", "REQ-MARKET-014", "REQ-MARKET-015", "REQ-MARKET-016", "REQ-MARKET-017", "REQ-MARKET-018", "REQ-MARKET-019", "REQ-MARKET-020"]
basis_superseded: false
parent: "CLE-UI"
ancestors: ["CLE-VISION", "CLE-UI"]
area: "CLE-UI"
content_hash: "ece00b53cb1e4de83c4c1d4b0623d0525b7bf14c1fc2a3d8c26d2720453e0714"
read_as: "approved"
task: null
source_paths: ["spec/2-navigation/8-marketplace.md", "spec/2-navigation/_product-overview.md", "spec/4-nodes/4-integration/_product-overview.md"]
mirror_sha256: "9210ddaf9e49444e19ae01d8aa7bea19a07802b5b9e2668eca40b0eedae5ff69"
etag: "sha256-125f5a185e7232175a4dce8e96d03ef537f56cd185f6a635132b455ca57796dc"
---
> 구현 상태: 미구현 · 원문: `spec/2-navigation/8-marketplace.md` (전체), `spec/2-navigation/_product-overview.md` (§3.10 Marketplace), `spec/4-nodes/4-integration/_product-overview.md` (§4 Marketplace) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

마켓플레이스(Marketplace)는 워크플로우 템플릿·AI 에이전트 프리셋·통합 플러그인·커스텀 노드를 게시하고 설치하는 공간이다. 아직 구현하지 않았다. 백엔드와 프론트엔드 어디에도 마켓플레이스 모듈·라우트·식별자가 없다.

**이 문서는 구현 약속이 아니다.** 착수할 때까지 방향을 남겨 두는 설계 스케치다. 화면 구조·설치 흐름·API 표는 그 시점의 노드·통합 체계에 맞춰 다시 검토한다. 요구사항은 목표 정의이고 모두 미구현이다.

범위 밖:

- 사이드바 메뉴 위치는 [레이아웃과 내비게이션](CLE-UI-LAYOUT.md) 이 정한다. 아직 정하지 않았다.
- 셀프 호스팅 환경에서 마켓플레이스에 닿는 방식(프록시 또는 오프라인 패키지)은 [시스템 아키텍처](../CLE-PLAT/CLE-PLAT-ARCH.md) 의 배포 환경 분리 절에 있다.
- 로드맵 안의 위치는 [Clemvion 제품 개요](../CLE-VISION.md) 에 있다.

## 요구사항

요구사항 ID 가 두 벌이던 것을 합쳤다. 한 줄에 원본 ID 를 모두 적는다. 줄 끝 괄호의 우선순위는 원문 값이다.

### 콘텐츠 유형

- REQ-MARKET-001 WHEN 사용자가 워크플로우 템플릿을 찾아 설치하면 THE SYSTEM SHALL 곧바로 쓰거나 고칠 수 있는 새 워크플로우를 만든다. (원본: NAV-MP-01, MP-CT-01, 필수) (미구현)
- REQ-MARKET-002 WHEN 사용자가 AI 에이전트 프리셋(시스템 프롬프트·모델 설정·도구 구성)을 설치하면 THE SYSTEM SHALL AI 에이전트 노드 설정에서 그 프리셋을 고를 수 있게 한다. (원본: NAV-MP-02, MP-CT-02, 필수) (미구현)
- REQ-MARKET-003 WHEN 사용자가 통합 플러그인을 찾아 설치하면 THE SYSTEM SHALL 새 서비스 연동을 통합 목록에 더하고 인증 정보를 입력받는다. (원본: NAV-MP-03, MP-CT-03, 필수) (미구현)
- REQ-MARKET-004 WHEN 사용자가 커스텀 노드를 설치하면 THE SYSTEM SHALL 노드 팔레트에 그 노드를 더한다. (원본: MP-CT-04, 필수) (미구현)

### 탐색과 설치

- REQ-MARKET-005 WHEN 사용자가 마켓플레이스를 둘러보면 THE SYSTEM SHALL 카테고리와 태그로 탐색할 수 있게 한다. (원본: NAV-MP-04, MP-CS-01, 필수) (미구현)
- REQ-MARKET-006 WHEN 사용자가 키워드나 필터로 검색하면 THE SYSTEM SHALL 조건에 맞는 항목을 보인다. (원본: MP-CS-02, 필수) (미구현)
- REQ-MARKET-007 WHEN 사용자가 항목을 열면 THE SYSTEM SHALL 설명·스크린샷·사용법·리뷰가 든 상세 페이지를 보인다. (원본: MP-CS-03, 필수) (미구현)
- REQ-MARKET-008 WHEN 사용자가 상세 페이지의 "Install" 을 누르면 THE SYSTEM SHALL 한 번의 동작으로 설치 흐름을 시작한다. (원본: MP-CS-04, 필수) (미구현)
- REQ-MARKET-009 WHEN 설치를 진행하면 THE SYSTEM SHALL 필요한 통합·모델 설정 같은 의존성을 확인한다. (원본: 8-marketplace §2.4) (미구현)
- REQ-MARKET-010 WHEN 설치를 진행하면 THE SYSTEM SHALL 이미 설치한 같은 항목의 다른 버전과 충돌하는지 확인한다. (원본: 8-marketplace §2.4) (미구현)
- REQ-MARKET-011 WHEN 설치를 진행하면 THE SYSTEM SHALL 개인 워크스페이스와 팀 워크스페이스 가운데 설치 위치를 고르게 한다. (원본: 8-marketplace §2.4) (미구현)

### 설치한 항목 관리

- REQ-MARKET-012 WHEN 설치한 항목에 새 버전이 나오면 THE SYSTEM SHALL 업데이트 가능 배지로 알린다. (원본: NAV-MP-06, MP-CS-05, 필수) (미구현)
- REQ-MARKET-013 WHEN 사용자가 설치한 항목을 업데이트하면 THE SYSTEM SHALL 변경 사항을 보이고 확인을 받은 뒤 업데이트한다. (원본: MP-CS-05, 8-marketplace §2.5) (미구현)
- REQ-MARKET-014 WHEN 사용자가 설치한 항목을 제거하면 THE SYSTEM SHALL 연관 워크플로우에 미칠 영향을 경고하는 확인 대화상자를 거쳐 삭제한다. (원본: 8-marketplace §2.5) (미구현)
- REQ-MARKET-015 WHEN 사용자가 항목에 평점과 리뷰를 남기면 THE SYSTEM SHALL 저장하고 다른 사용자가 볼 수 있게 한다. (원본: NAV-MP-05, MP-CS-06, 권장) (미구현)

### 게시

- REQ-MARKET-016 WHEN 사용자가 자기가 만든 워크플로우·노드·AI 에이전트 프리셋을 게시하면 THE SYSTEM SHALL 마켓플레이스에 공개한다. (원본: NAV-MP-07, MP-PB-01, 필수) (미구현)
- REQ-MARKET-017 WHEN 사용자가 게시를 요청하면 THE SYSTEM SHALL 필수 필드와 의존성을 자동 검증한 뒤 공개한다. (원본: MP-PB-02, 필수) (미구현)
- REQ-MARKET-018 WHEN 게시자가 새 버전을 게시하면 THE SYSTEM SHALL 이전 버전을 유지한다. (원본: NAV-MP-06, MP-PB-03, 필수) (미구현)
- REQ-MARKET-019 WHEN 게시자가 게시자 대시보드를 열면 THE SYSTEM SHALL 게시자 프로필과 게시물 목록을 보인다. (원본: MP-PB-04, 권장) (미구현)
- REQ-MARKET-020 WHEN 게시자가 게시물 통계를 열면 THE SYSTEM SHALL 다운로드 수와 평점 추이를 보인다. (원본: MP-PB-05, 권장) (미구현)

## 화면 스케치

### 목록 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 헤더 | 맨 위 | 제목 "Marketplace" | — |
| 검색·필터 | 헤더 아래 | 검색창("Search marketplace..."), 카테고리 드롭다운("Category: All") | 키워드·카테고리로 거른다 |
| 카테고리 탭 | 검색 아래 | All · Workflows · Nodes · AI Agents · Integrations | 탭별로 항목을 거른다 |
| 항목 카드 격자 | 가운데 | 한 줄에 카드 4개. 카드마다 아이콘·이름·평점·다운로드 수 | 카드를 누르면 상세 페이지 |
| 더 보기 | 맨 아래 | "Load More" 버튼 | 다음 항목을 이어 불러온다 |

### 카테고리 탭

| 탭 | 내용 |
| --- | --- |
| All | 전체 항목 |
| Workflows | 워크플로우 템플릿 |
| Nodes | 커스텀 노드 |
| AI Agents | AI 에이전트 프리셋 |
| Integrations | 통합 플러그인 |

### 항목 카드

| 요소 | 설명 |
| --- | --- |
| 아이콘·썸네일 | 유형별 기본 아이콘이나 게시자가 준 이미지 |
| 이름 | 항목 이름 |
| 카테고리 배지 | 유형(Workflow, Node, Agent, Integration) |
| 평점 | 5점 만점 별점 |
| 다운로드 수 | 설치 횟수 |
| 게시자 | 만든 사람 이름 |

### 상세 페이지

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 뒤로 가기 | 맨 위 | "← Marketplace" | 목록으로 돌아간다 |
| 요약 헤더 | 위 | 아이콘·이름, 게시자·버전·갱신일, 카테고리, "Install" 버튼, 평점 | "Install" 로 설치 흐름을 시작한다 |
| 탭 | 헤더 아래 | Overview · Screenshots · Reviews · Versions | 탭 전환 |
| 본문(Overview) | 가운데 | 설명(Description), 포함 항목(Includes, 예: 시스템 프롬프트·지식 저장소 템플릿·도구 구성), 필요 조건(Requirements, 예: 모델 프로바이더·통합) | — |
| 리뷰 | 아래 | 별점과 한 줄 리뷰 목록 | — |

### 설치 흐름

1. 상세 페이지에서 "Install" 을 누른다.
2. 의존성을 확인한다(필요한 통합, 모델 설정 등).
3. 충돌을 확인한다(이미 설치한 같은 항목의 다른 버전).
4. 설치 위치를 고른다(개인 또는 팀 워크스페이스).
5. 설치를 마치면 리소스를 자동으로 만든다.
   - 워크플로우 템플릿 → 새 워크플로우
   - 노드 → 노드 팔레트에 추가
   - AI 에이전트 프리셋 → AI 에이전트 노드 설정에서 고를 수 있게 됨
   - 통합 → 통합 목록에 추가(인증 정보 입력 필요)

### 설치한 항목 관리

- "My Installations" 탭이나 필터로 본다.
- 업데이트할 수 있는 항목에 배지를 단다.
- 업데이트: 변경 사항을 보이고 확인을 받는다.
- 제거: 확인 대화상자 뒤 삭제한다. 연관 워크플로우에 미칠 영향을 경고한다.

### 게시 화면

| 단계 | 내용 |
| --- | --- |
| 1. 원본 선택 | 게시할 워크플로우·노드·AI 에이전트 프리셋을 고른다 |
| 2. 정보 입력 | 이름, 설명, 카테고리, 태그, 스크린샷 |
| 3. 버전 설정 | 버전 번호, 변경 기록 |
| 4. 검증 | 필수 필드와 의존성을 자동 검증한다 |
| 5. 게시 | 마켓플레이스에 공개한다 |

## API 스케치

구현 약속이 아닌 설계 스케치다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/marketplace/items` | 항목 목록(쿼리: `category`, `search`, `sort`) |
| GET | `/api/marketplace/items/:id` | 항목 상세 |
| POST | `/api/marketplace/items/:id/install` | 설치 |
| DELETE | `/api/marketplace/items/:id/uninstall` | 제거 |
| POST | `/api/marketplace/items/:id/update` | 업데이트 |
| GET | `/api/marketplace/items/:id/reviews` | 리뷰 목록 |
| POST | `/api/marketplace/items/:id/reviews` | 리뷰 작성 |
| GET | `/api/marketplace/my-installations` | 설치한 항목 목록 |
| POST | `/api/marketplace/publish` | 게시 |
| GET | `/api/marketplace/my-publications` | 내 게시물 목록 |
| PATCH | `/api/marketplace/my-publications/:id` | 게시물 수정 |
| GET | `/api/marketplace/my-publications/:id/stats` | 게시물 통계 |

## Rationale

### 구현을 미룬 이유

마켓플레이스는 외부 게시자 생태계를 전제로 한다. 한 워크스페이스 안에서 끝나는 다른 화면과 달리, 게시물 검증 파이프라인·버전 배포·평점과 리뷰 관리 같은 부대 인프라가 함께 필요하다. 워크플로우 엔진·통합·지식 저장소 같은 핵심 플랫폼이 먼저 안정돼야 "공유할 가치가 있는 자산" 이 쌓이므로 우선순위를 뒤로 둔다. 원문 스펙 상태도 백로그(`backlog`)였고 연결된 코드가 없었다.

이 문서는 그때까지 방향을 남겨 두는 선행 설계다. 착수할 때는 이 설계를 그대로 구현하지 않고 그 시점의 노드·통합 체계에 맞춰 다시 검토한다.

### 요구사항 ID 두 벌을 합친 이유

옛 문서에는 내비게이션 PRD 의 `NAV-MP-01~07` 과 통합 PRD 의 `MP-CT/CS/PB-*` 가 같은 기능을 따로 정의했다. 범위도 달라, 커스텀 노드는 통합 PRD(`MP-CT-04`)와 화면 설계(Nodes 탭)에는 있지만 내비게이션 PRD 에는 없었다. 제품 개요의 로드맵과 용어 사전도 마켓플레이스 콘텐츠를 네 유형(워크플로우 템플릿·AI 에이전트 프리셋·통합 플러그인·커스텀 노드)으로 정의한다. 그래서 이 문서가 두 벌을 한 벌로 합치고 네 유형을 범위로 삼는다. 원본 ID 는 추적을 위해 남긴다.
