---
id: workflow-list
status: partial
code:
  - codebase/frontend/src/app/(main)/workflows/page.tsx
  - codebase/backend/src/modules/workflows/dto/query-workflow.dto.ts
  - codebase/backend/src/modules/workflows/workflows.service.ts
pending_plans:
  - plan/in-progress/spec-sync-workflow-list-gaps.md
---

# Spec: 워크플로우 목록 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#31-workflow-list-워크플로우-목록) · [Spec 레이아웃](./_layout.md) · [Spec 캔버스](../3-workflow-editor/0-canvas.md) · [데이터 모델 - Workflow](../1-data-model.md#24-workflow)

---

## 1. 화면 구조

> ⚠️ 아래 목업은 현재 구현(`page.tsx`)을 반영한다. `Filter` 는 상태 토글 버튼 그룹이며, 정렬·태그·폴더 필터 UI 는 아직 미구현(§2.3 / §2.4 참고).

```
┌─────────────────────────────────────────────────────────┐
│  Workflows              [⤓ Import]  [+ New Workflow]    │
│                                                         │
│  ┌──────────────────┐  [전체][Active][Inactive]         │
│  │ 🔍 Search...     │  ([내][공유][전체] — 팀 워크스페이스 시)│
│  └──────────────────┘                                   │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Status   Name            Tags    Last Updated  Actions│ │
│  ├─────────────────────────────────────────────────────┤ │
│  │  (●─)    My Workflow 1   [sales]   2 min ago      ⋮   │ │
│  │  (─○)    Data Pipeline            1 hour ago      ⋮   │ │
│  │  (●─)    Team Bot 👥Team           5 min ago      ⋮   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│                    1  2  3  ... 10  →                    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 워크플로우 목록 테이블

현재 구현된 컬럼은 다음 5개다 (`page.tsx:409-415`):

| 컬럼 | 내용 |
|------|------|
| Status (상태) | 활성/비활성 토글 스위치. 클릭 시 즉시 상태 토글 (초록=활성, 회색=비활성) |
| Name (이름) | 워크플로우 이름. 클릭 시 에디터로 진입. 팀 워크스페이스에서는 이름 옆에 팀 뱃지(👥 Team) 표시 — 개인 워크스페이스에서는 표시하지 않는다. ([Rationale §1](#rationale)) |
| Tags (태그) | 워크플로우 태그 뱃지 나열 |
| Last Updated (마지막 수정) | 마지막 수정 시각 (`updatedAt`, 상대 시간 표시) |
| Actions (더보기 메뉴 ⋮) | 편집, 실행 기록, 복제, 내보내기, 활성/비활성 토글, 삭제 |

> **미구현 (Planned)**: 별도 "트리거 요약" 컬럼, "노드 수" 컬럼, 그리고 "마지막 *실행*" 시각 컬럼은 아직 없다. 현재 시각 컬럼은 마지막 *수정*(`updatedAt`) 기준이다.

### 2.2 검색

- 워크플로우 이름 기준 실시간 검색 (debounce 300ms)
- 검색 결과가 없을 경우 "검색 결과가 없습니다" 메시지 표시

### 2.3 필터

| 필터 항목 | 옵션 | 비고 |
|-----------|------|------|
| 상태 | 전체 / Active / Inactive | 상시 노출 (버튼 그룹). ⚠️ **현재 클라이언트는 서버 계약과 어긋난 파라미터를 보낸다** — 아래 경고 참고 |
| 소유 | 내 워크플로우 / 공유된 워크플로우 / 전체 | **팀 워크스페이스 활성 시에만 노출**. "공유된 워크플로우" = `createdBy ≠ 현재 사용자`. 개인 워크스페이스에서는 필터 자체가 사라진다. UI 의 세 옵션은 서버 `GET /api/workflows?ownership=` 의 `mine` / `shared` / `all` 에 1:1 매핑된다 — 개인 워크스페이스 컨텍스트에서는 클라이언트가 파라미터를 보내지 않고, 받더라도 서버는 무시한다 |
| 태그 | 태그 멀티 선택 | **미구현 (Planned)**: 서버는 `?tag=` 단일 필터를 지원하지만(§3), 클라이언트에 태그 필터 UI 가 없다 (테이블에 태그 뱃지를 표시만 함). |
| 폴더 | 폴더 선택 (있을 경우) | **미구현 (Planned)**: 서버는 `?folderId=` 필터를 지원하지만(§3), 클라이언트에 폴더 필터 UI 가 없다. |

> ⚠️ **상태 필터 파라미터 불일치 (코드 버그)**: 서버 계약(`query-workflow.dto.ts`)은 `?status=active|inactive` 를 받지만, 클라이언트(`page.tsx:112-113`)는 `?isActive=true|false` 를 보낸다. 서버는 `isActive` 를 무시하므로 상태 필터가 end-to-end 로 동작하지 않는다. 본 spec 의 계약(`status`)이 정본이며, 클라이언트 수정이 필요하다 (plan 스텁 참조).

> 팀 뱃지(§2.1 공유 표시)는 워크스페이스 단위의 "공유" 정의를 따르고, 소유 필터는 그 안에서 내 것/남의 것을 다시 구분하는 보조 도구다. 두 정의가 어긋나지 않는 이유는 [Rationale §1](#rationale) 참고.

### 2.4 정렬

> **미구현 (Planned)**: 클라이언트에 정렬 드롭다운/컨트롤 UI 가 없다. 서버(`workflows.service.ts:646-653` `getSortColumn`)는 `created_at` / `updated_at` / `name` 정렬만 허용하며 기본값은 `created_at` 내림차순이다. 클라이언트는 현재 `sort`/`order` 파라미터를 보내지 않으므로 항상 서버 기본 정렬(생성일 내림차순)이 적용된다.

아래는 목표 정렬 옵션이다 (현재 일부만 서버 지원, UI 전체 미구현):

| 정렬 기준 | 방향 | 구현 상태 |
|-----------|------|-----------|
| 최근 수정순 (기본) | 내림차순 | 서버 지원(`updated_at`), UI 미구현. ⚠️ 현재 서버 *기본값*은 생성일순이며 수정일순이 아니다 |
| 이름순 | 오름차순/내림차순 | 서버 지원(`name`), UI 미구현 |
| 생성일순 | 내림차순 | 서버 지원(`created_at`, 현재 기본값), UI 미구현 |
| 마지막 실행순 | 내림차순 | **미지원** — `getSortColumn` 에 `last_run` 매핑 없음 |

### 2.5 새 워크플로우 생성

- "**+ New Workflow**" 버튼 클릭
- 워크플로우 이름 입력 다이얼로그 표시 (기본값: "Untitled Workflow")
- 생성 후 즉시 에디터로 진입

### 2.6 더보기 메뉴 액션

| 액션 | 동작 |
|------|------|
| 편집 | 에디터로 진입 |
| 실행 기록 | `/workflows/:id/executions` 로 이동 |
| 복제 | 워크플로우 복사본 생성 (이름에 "(Copy)" 추가) |
| 내보내기 | JSON 파일로 다운로드 |
| 활성/비활성 | 상태 토글. 비활성 시 트리거/스케줄 중지 |
| 삭제 | 확인 다이얼로그 후 삭제. 연결된 트리거/스케줄도 함께 비활성화 |

### 2.7 빈 상태

- 워크플로우가 없을 때: 아이콘 + "첫 번째 워크플로우를 만들어 보세요" 메시지 + 생성 버튼 (`EmptyState`)
- 검색·필터 적용으로 결과가 비었을 때는 생성 버튼 대신 "필터를 조정해 보세요" 안내 메시지를 표시한다
- **미구현 (Planned)**: 마켓플레이스 템플릿 추천 링크는 아직 없다

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/workflows | 목록 조회 (쿼리: search, status, tag, folderId, sort, order, page, limit, ownership). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수. `ownership` 은 팀 워크스페이스 컨텍스트에서만 의미가 있으며 (`mine` / `shared` / `all`, default `all`), 개인 워크스페이스에서는 서버가 무시한다 (= `all` 처럼 동작) |
| POST | /api/workflows | 새 워크플로우 생성 |
| PATCH | /api/workflows/:id | 워크플로우 수정 (이름, 상태 등) |
| POST | /api/workflows/:id/duplicate | 워크플로우 복제 |
| DELETE | /api/workflows/:id | 워크플로우 삭제 |
| GET | /api/workflows/:id/export | JSON 내보내기 |
| POST | /api/workflows/import | JSON 가져오기 |

---

## Rationale

### 1. "공유 워크플로우" 의 정의 — 팀 워크스페이스 전체

NAV-WF-07 의 "공유" 기준으로 두 옵션을 검토했다:

- (a) **팀 워크스페이스에 속한 모든 워크플로우** = 공유 (선택)
- (b) `createdBy ≠ 현재 사용자` 또는 명시적 sharedWith 컬럼 = 공유 (폐기)

(a) 를 채택한 이유:

- PRD 의 NAV-WF-07 원문("팀 워크스페이스에서 공유된 워크플로우 구분 표시")이 워크스페이스 단위의 격리·공유를 전제로 하고 있어, 워크스페이스 = 공유 단위라는 정의와 자연스럽게 부합한다.
- 데이터 모델상 워크플로우 격리는 이미 `workspaceId` 로 처리되며(`codebase/backend/src/modules/workflows/entities/workflow.entity.ts`), `sharedWith` 컬럼이나 추가 마이그레이션 없이 구현 가능하다.
- (b) 는 같은 팀 안에서 "내 것" 과 "남의 것" 을 다시 분리하는 정의지만, 그 구분은 §2.3 의 **소유 필터** 가 담당하므로 뱃지에서까지 중복으로 표현할 필요가 없다.

결과적으로 뱃지(워크스페이스 = 공유)와 필터(작성자 단위 세분화)가 역할 분담된다.
