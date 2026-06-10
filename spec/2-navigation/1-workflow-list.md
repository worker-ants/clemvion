---
id: workflow-list
status: partial
code:
  - codebase/frontend/src/app/(main)/workflows/page.tsx
  - codebase/frontend/src/lib/api/workflows.ts
  - codebase/backend/src/modules/workflows/dto/**
  - codebase/backend/src/modules/workflows/workflows.service.ts
  - codebase/backend/src/modules/workflows/workflows.module.ts
  - codebase/backend/src/modules/folders/**
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

> 상태 필터는 서버 계약(`query-workflow.dto.ts`)·클라이언트(`page.tsx`) 모두 `?status=active|inactive` 로 정렬되어 end-to-end 동작한다 (과거 클라이언트가 `?isActive=` 를 보내던 불일치는 수정 완료).

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
| GET | /api/workflows/:id/export | JSON 내보내기 — 파일 포맷은 [§3.2](#32-exportimport-json-포맷) |
| POST | /api/workflows/import | JSON 가져오기 — 검증·기본값 채움 동작은 [§3.2](#32-exportimport-json-포맷) |

### 3.1 폴더 관리 API

워크플로우 폴더(계층 구조)의 백엔드 API. 엔티티·제약 (`(workspace_id, parent_id, name)` UNIQUE, 최대 중첩 깊이 5) 의 SoT 는 [데이터 모델 §2.5 Folder](../1-data-model.md#25-folder) 다.

> **미구현 (Planned)**: 프론트엔드는 본 API 를 아직 소비하지 않는다 — 폴더 필터·폴더 관리 UI 모두 없음 (§2.3 폴더 행 참고). 아래는 백엔드에 구현 완료된 계약이다 (`folders.controller.ts` / `folders.service.ts`).

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/folders | 폴더 목록 조회 — `sortOrder` → `name` 순 정렬. 계층 구조는 `parentId` 로 구성 |
| GET | /api/folders/:id | 폴더 단건 조회 |
| POST | /api/folders | 폴더 생성 (`editor`+). `parentId` 지정 시 하위로 생성. 깊이 5 초과 시 400 `VALIDATION_ERROR`, 동일 부모 아래 이름 중복 시 409 `RESOURCE_CONFLICT` (unique violation → 409 매핑, 전역 exception filter) |
| PATCH | /api/folders/:id | 폴더 수정 (`editor`+) — 이름·부모·정렬 순서 부분 수정 |
| DELETE | /api/folders/:id | 폴더 삭제 (`editor`+, 204). 하위 폴더는 DB cascade 로 함께 삭제, 폴더에 속한 워크플로우는 FK SET NULL 로 루트로 이동 (워크플로우 자체는 보존) |

### 3.2 Export/Import JSON 포맷

사용자에게 파일로 노출되어 손으로 편집·재가져오기 가능한 JSON 계약이다 (SoT: `import-workflow.dto.ts` / `ExportWorkflowDto`).

**Export (`GET /api/workflows/:id/export`)** — top-level 키: `name` / `description` / `tags` / `settings` / `nodes[]` / `edges[]`. 노드 간 참조는 UUID 가 아니라 **`nodes[]` 배열 index** 기반이다:

- edge: `sourceNodeIndex` / `targetNodeIndex` (+ `sourcePort` / `targetPort` / `type` / `condition`)
- 노드: `containerIndex` / `toolOwnerIndex` (컨테이너 소속·Tool 소유 노드 참조, 없으면 `null`)

> ⚠️ Swagger 응답 DTO (`ExportWorkflowDto`) 는 `formatVersion` 필드를 선언하지만, 현재 export 구현은 이 필드를 emit 하지 않고 import DTO 도 받지 않는다 — 포맷 버전 협상은 **미구현 (Planned)**.

**Import (`POST /api/workflows/import`)** — 검증·동작 순서:

1. 노드 `type` 은 허용 노드 타입 화이트리스트 (`@IsIn(ALL_NODE_TYPES)`) 로 DTO 검증 — 미지 타입은 400 `VALIDATION_ERROR`.
2. 노드 `label` 은 워크플로우 내 unique — 중복 시 409 `DUPLICATE_NODE_LABEL`.
3. 노드 `config` 는 해당 노드의 zod schema 로 parse 해 `.default(...)` 기본값을 overlay (`applyConfigDefaults`) — 캔버스에서 노드를 새로 만들 때와 동일한 기본값 채움. **parse 실패 (hand-edit JSON·타입 불일치 등) 시 raw config 를 그대로 보존**하는 permissive 정책 — 사용자가 에디터에서 수정 가능 ([Rationale §2](#rationale)).
4. AI 노드는 `llmConfigId` 누락 시 워크스페이스 기본 LLM 을 자동 주입.
5. index 기반 참조 (`containerIndex` / `toolOwnerIndex` / `sourceNodeIndex` / `targetNodeIndex`) 는 신규 발급 UUID 로 remap 되어 저장된다.

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

### 2. Import 의 permissive config 정책 (§3.2)

JSON 가져오기 시 노드 `config` 의 schema parse 가 실패해도 가져오기를 거부하지 않고 raw config 를 그대로 보존한다.

- import JSON 은 사용자가 손으로 편집할 수 있는 파일이라, 사소한 타입 불일치로 전체 가져오기를 400 으로 거부하면 복구 경로가 없다. 노드 단위 raw 보존이면 사용자가 에디터에서 해당 노드만 수정해 복구할 수 있다.
- 반면 노드 `type` 화이트리스트·`label` unique 는 워크플로우 구조 자체의 무결성이라 DTO 레벨에서 hard-fail (400/409) 로 거부한다 — config 내용(soft)과 구조(hard)를 분리한 것.
- 미지 nodeType 에 대한 `applyConfigDefaults` 의 raw 통과 분기는 forward-compat 방어 코드로, 실제로는 1번 화이트리스트 검증이 먼저 차단한다.
