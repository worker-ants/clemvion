---
id: workflow-list
status: partial
code:
  - codebase/frontend/src/app/(main)/w/[slug]/workflows/page.tsx
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

> ⚠️ 아래 목업은 개략도다. `Filter` 는 상태 토글 버튼 그룹이고, 정렬(§2.4)·폴더·태그(§2.3) 필터는 드롭다운/입력으로 검색창 우측에 함께 존재하나 목업에서는 생략했다.

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
| Actions (더보기 메뉴 ⋮) | 편집, 실행 내역, 복제, 내보내기, 활성/비활성 토글, 삭제 |

> **미구현 (Planned)**: 별도 "트리거 요약" 컬럼, "노드 수" 컬럼, 그리고 "마지막 *실행*" 시각 컬럼은 아직 없다. 현재 시각 컬럼은 마지막 *수정*(`updatedAt`) 기준이다.

### 2.2 검색

- 워크플로우 이름 기준 실시간 검색 (debounce 300ms)
- 검색 결과가 없을 경우 "검색 결과가 없습니다" 메시지 표시

### 2.3 필터

| 필터 항목 | 옵션 | 비고 |
|-----------|------|------|
| 상태 | 전체 / Active / Inactive | 상시 노출 (버튼 그룹). ⚠️ **현재 클라이언트는 서버 계약과 어긋난 파라미터를 보낸다** — 아래 경고 참고 |
| 소유 | 내 워크플로우 / 공유된 워크플로우 / 전체 | **팀 워크스페이스 활성 시에만 노출**. "공유된 워크플로우" = `createdBy ≠ 현재 사용자`. 개인 워크스페이스에서는 필터 자체가 사라진다. UI 의 세 옵션은 서버 `GET /api/workflows?ownership=` 의 `mine` / `shared` / `all` 에 1:1 매핑된다 — 개인 워크스페이스 컨텍스트에서는 클라이언트가 파라미터를 보내지 않고, 받더라도 서버는 무시한다 |
| 태그 | 단일 태그 필터 (텍스트 입력) | 입력한 태그 1개를 서버 `?tag=` 로 전달 — 해당 값을 `tags` 배열에 포함한 워크플로우만 조회(§3, `= ANY(tags)`). 빈 값이면 미송신(전체). 검색과 동일하게 debounce 적용, page 리셋. 멀티 선택에서 단일로 하향 조정됨 ([Rationale §4](#4-태그-필터는-단일-free-text-로-하향-2026-07-06)). |
| 폴더 | 폴더 선택 (폴더 존재 시) | 현재 워크스페이스에 폴더가 하나 이상 있을 때만 노출되는 드롭다운(`NativeSelect`). 첫 옵션 "전체 폴더"(빈 값=미송신). 선택 시 서버 `?folderId=` 로 필터(§3), page 리셋. 워크스페이스 전환 시 선택이 초기화된다(폴더는 워크스페이스 스코프). |

> 상태 필터는 서버 계약(`query-workflow.dto.ts`)·클라이언트(`page.tsx`) 모두 `?status=active|inactive` 로 정렬되어 end-to-end 동작한다 (과거 클라이언트가 `?isActive=` 를 보내던 불일치는 수정 완료).

> 팀 뱃지(§2.1 공유 표시)는 워크스페이스 단위의 "공유" 정의를 따르고, 소유 필터는 그 안에서 내 것/남의 것을 다시 구분하는 보조 도구다. 두 정의가 어긋나지 않는 이유는 [Rationale §1](#rationale) 참고.

### 2.4 정렬

클라이언트 목록 상단 정렬 드롭다운(`NativeSelect`, `page.tsx`)이 `sort`/`order` 파라미터를 송신한다. 기본값은 서버와 동일한 생성일 내림차순(`created_at` desc)이며, 기본 외 옵션 선택 시에만 파라미터를 보낸다.

| 정렬 기준 | 방향 | 구현 상태 |
|-----------|------|-----------|
| 최신 생성순 (기본) | 내림차순 | 서버 `created_at` + UI 기본 옵션 |
| 최근 수정순 | 내림차순 | 서버 `updated_at` + UI |
| 이름순 | 오름차순 | 서버 `name` + UI |
| 마지막 실행순 | 내림차순 | 서버 `last_run`(`execution` 테이블의 워크플로별 `MAX(started_at)` correlated subquery, 미실행 워크플로는 `NULLS LAST`) + UI |

### 2.5 새 워크플로우 생성

- "**+ New Workflow**" 버튼 클릭
- 워크플로우 이름 입력 다이얼로그 표시 (기본값: "Untitled Workflow")
- 생성 후 즉시 에디터로 진입

### 2.6 더보기 메뉴 액션

| 액션 | 동작 |
|------|------|
| 편집 | 에디터로 진입 |
| 실행 내역 | `/workflows/:id/executions` 로 이동. 라벨은 i18n `workflows.executionHistory` (ko "실행 내역" / en "Execution History") |
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

> 프론트엔드는 목록의 **폴더 필터**(§2.3)가 `GET /api/folders` 를 소비한다. 다만 폴더 **관리** UI(생성·수정·삭제)는 아직 없다 — 필터 옵션 조회 전용. 아래는 백엔드에 구현 완료된 계약이다 (`folders.controller.ts` / `folders.service.ts`).

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/folders | 폴더 목록 조회 — `sortOrder` → `name` 순 정렬. 계층 구조는 `parentId` 로 구성 |
| GET | /api/folders/:id | 폴더 단건 조회 |
| POST | /api/folders | 폴더 생성 (`editor`+). `parentId` 지정 시 하위로 생성. 깊이 5 초과 시 400 `VALIDATION_ERROR`, 동일 부모 아래 이름 중복 시 409 `RESOURCE_CONFLICT` (unique violation → 409 매핑, 전역 exception filter) |
| PATCH | /api/folders/:id | 폴더 수정 (`editor`+) — 이름·부모·정렬 순서 부분 수정. **`parentId` 변경 시 create 와 동일한 계층 무결성 검증**: 새 부모가 같은 워크스페이스에 없거나, 자기 자신·자손이거나(순환), 이동 결과 서브트리 깊이가 5 초과면 400 `VALIDATION_ERROR`. `parentId: null` 로 루트 이동은 항상 허용 |
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
6. 워크플로우 `settings` 는 strict nested DTO (`WorkflowSettingsDto`) 로 검증 — 현재 `maxConcurrentExecutions`(양의 정수, §8 admission gate)만 허용하고 **미지 키·비양수·비정수는 400 `VALIDATION_ERROR`**. `UpdateWorkflowDto.settings`(patch)와 동일 strict 정책이며, 노드 `config`(soft, item 3)와 달리 workflow-level 실행 파라미터는 admission-gate 정합을 위해 hard-fail 한다([Rationale §2](#rationale), 2026-07-04).

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
- **워크플로우 `settings`(admission-gate 파라미터)는 이 permissive 예외에 포함되지 않는다** — 위 정책은 노드 `config`(soft, 사용자 hand-edit 후 에디터 복구 가능)에 한정된다. `settings.maxConcurrentExecutions`(§8 동시성 cap)는 잘못된 값이 조용히 무시되면 cap 정책이 어긋나므로, write 경계에서 strict nested DTO(`WorkflowSettingsDto`)로 hard-fail 한다. import·patch(`UpdateWorkflowDto`) 대칭이며 `spec/1-data-model.md §2.4` 가 이미 `Workflow.settings` 를 이 키로 스코프한다 (2026-07-04).

### 3. 폴더 계층 무결성은 생성·부모 변경 양쪽에서 강제 (§3.1, 2026-07-05)

`(data-model §2.5)` 의 "최대 깊이 5 / 같은 워크스페이스 / 비순환" 은 폴더 생성뿐 아니라 `PATCH` 부모 변경(재부모화)에서도 hard-fail(400 `VALIDATION_ERROR`)로 강제한다. 종전 `update()` 는 `parentId` 를 무검증 저장해 깊이 초과·순환·타 워크스페이스 부모가 통과했고, **순환은 조상 깊이 계산(`getDepth`)을 무한 루프로 만들어 잠재 DoS** 였다 (V-04).

- **왜 spec 하향(create-only)이 아니라 코드 구현인가**: 깊이는 spec 하향으로 완화할 수 있어도, 순환은 데이터 무결성·가용성 결함(무한 루프)이라 spec 문구로 사라지지 않는다. §2.5 를 SoT 로 유지하고 코드를 맞추는 것이 옳다.
- **에러 코드**: 세 위반(같은 워크스페이스·순환·깊이) 모두 생성 경로와 동일한 `VALIDATION_ERROR` 를 재사용한다. 노드 컨테이너의 `CONTAINER_CYCLE`·워크플로우 그래프의 `CYCLE_DETECTED` 와 이름·의미가 겹치는 폴더 전용 순환 코드를 신설하지 않아 도메인 간 혼동을 피한다.
- **무한 루프 방어**: `getDepth`/서브트리 순회는 방문 집합 + 깊이 상한 가드로, 이미 손상된(순환) 데이터가 있어도 항상 종료한다 — 검증 신설 이전에 저장됐을 수 있는 순환에 대한 방어.

### 4. 태그 필터는 단일 free-text 로 하향 (2026-07-06)

§2.3 태그 필터를 종전 "멀티 선택" 에서 **단일 태그 텍스트 입력**으로 하향 조정했다. (종전 "멀티 선택" 문구는 별도 Rationale 로 채택된 설계 결정이 아니라 서버 단일 계약과 애초에 어긋나 있던 미구현 placeholder 였다 — 결정의 *번복*이 아니라 최초 *확정*이다.)

- **왜 멀티가 아닌 단일인가**: 서버 `GET /api/workflows` 는 `?tag=` **단일** 값만 받아 `= ANY(w.tags)` 로 매칭한다 (`query-workflow.dto.ts`). 멀티 선택을 지원하려면 (a) `?tag=a,b` 또는 반복 파라미터를 받는 서버 계약 확장과 (b) 워크스페이스의 **태그 목록 조회 엔드포인트** 신설(현재 부재 — 선택지를 채울 소스가 없다)이 함께 필요하다. 이 full-stack 확장은 비용 대비 가치가 낮다고 판단해(사용자 결정, 2026-07-06) 서버의 기존 단일 계약에 맞춘 free-text 단일 필터로 범위를 좁혔다.
- **왜 select 가 아니라 free-text 인가**: 태그 목록 엔드포인트가 없어 드롭다운을 채울 확정적 소스가 없다. 단일 텍스트 입력은 서버 계약과 정확히 일치하며 추가 백엔드 없이 end-to-end 동작한다.
- **재확장 여지**: 멀티태그가 다시 필요해지면 서버 계약 확장 + 태그 목록 API 를 함께 도입하는 별도 트랙으로 되살릴 수 있다. 본 하향은 그 대안을 영구 기각하는 것이 아니라 현 시점의 범위 결정이다.
