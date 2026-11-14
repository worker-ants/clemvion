---
id: "CLE-AI-MEMORY-ADMIN"
title: "에이전트 메모리 — 관리 API · 화면"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-AI-MEMORY"
ancestors: ["CLE-VISION", "CLE-AI", "CLE-AI-MEMORY"]
area: "CLE-AI"
content_hash: "e2ea581ed12f24995cbbb2bb50f6dee97ce1882cf1bcaf91043174f1e5034b0e"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "a53fb66065727217d2ac2c285a15088fc9024a839f5043c9349a5ab8e5a89770"
etag: "sha256-526997d9553d9e4ea56d4d445f3399ae627487cd253402a065f091c9702c38dc"
---
## 개요

이 문서는 [에이전트 메모리](CLE-AI-MEMORY.md) 의 하위 문서로 쌓인 메모리를 조회 · 삭제하는 관리 API 와 워크스페이스 수준 관리 화면을 정한다.

## 관리 API

쌓인 메모리를 워크스페이스 멤버가 점검하고 정리하는 조회·삭제 API 다. 저장·회수·정리와는 별개의 관리 경로다. 모든 라우트는 인증 미들웨어가 넣는 현재 워크스페이스 값(`@WorkspaceId()`)에서만 `workspace_id` 를 얻고, 쿼리나 본문으로 받지 않는다. 컨트롤러는 `agent-memory.controller.ts` 다.

| 메서드 · 경로 | 설명 | 최소 역할 |
|---|---|---|
| `GET /api/agent-memories/scopes?q&limit&offset` | 워크스페이스의 메모리 범위 키 목록과 범위별 메모리 건수·최신 `updated_at`. `q` 는 `scope_key` 부분 일치(ILIKE). 한 CTE 쿼리로 구한다 | 뷰어 |
| `GET /api/agent-memories?scopeKey&kind&limit&offset` | 한 범위의 메모리 행. `scopeKey` 필수, `kind`(`fact`·`preference`·`entity`) 선택 필터. `created_at` 내림차순 | 뷰어 |
| `DELETE /api/agent-memories/:id` | 단건 삭제. 204 No Content | 편집자 |
| `DELETE /api/agent-memories?scopeKey=` | 한 범위의 메모리 전체 삭제. 204. `scopeKey` 필수. 삭제 행 수를 `X-Deleted-Count` 응답 헤더로 싣는다 | 편집자 |

- **임베딩 제외**: 조회 응답은 `id`·`content`·`kind`(`metadata.kind`)·`scopeKey`·`createdAt`·`updatedAt`·`expiresAt` 만 싣는다. 임베딩 벡터는 크고 화면에 필요 없으므로 SELECT 하지도 않는다. kind 가 없는 행은 `'fact'` 로 표기한다.
- **영구 삭제**: 삭제는 soft delete 가 아니라 메모리 정리와 같은 영구 삭제다. 메모리는 원래 정리 대상(추출 사실, 범위당 1000건)이라 지식 저장소 문서와 달리 복구를 보장하지 않는다.
- **격리**: 단건 삭제도 `WHERE id = $1 AND workspace_id = $ws` 로 워크스페이스를 넘는 삭제를 막는다. 다른 워크스페이스 행의 ID 를 알아도 지울 수 없고 404 를 받는다.
- **삭제 건수(`X-Deleted-Count`)**: 범위 삭제는 204 라 본문이 없으므로 실제 삭제 행 수를 응답 헤더로 싣는다. 대상이 없으면 0 이다(멱등 삭제). 브라우저가 cross-origin 에서 읽을 수 있도록 CORS `exposedHeaders: ['X-Deleted-Count']` 에 넣어야 한다.
- **범위 목록 페이지**: `GET /api/agent-memories/scopes` 의 `total` 은 `LIMIT/OFFSET` 적용 전 전체 범위 키 수다(한 쿼리의 `COUNT(*) OVER()`). `offset` 이 전체 수를 넘어 결과 행이 0개면 `total` 은 `0` 으로 나온다. 화면은 첫 페이지의 `total` 범위 안에서만 넘기므로 문제가 없다.

권한 하한의 근거는 [Rationale](#조회는-뷰어-이상-삭제는-편집자-이상으로-둔-이유) 에 있다.

## 관리 화면

사이드바의 "Agent Memory" 메뉴로 여는 워크스페이스 수준 관리 화면이다. 경로는 `/w/<slug>/agent-memory` 이고 메뉴 배치는 [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md) 에서 정한다. 왼쪽에 범위 목록, 오른쪽에 고른 범위의 메모리 목록이 있다.

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 헤더 | 상단 | 제목 "Agent Memory", `[↻ 새로고침]`, 안내 문구 "AI Agent persistent 메모리를 scope 별로 조회/삭제합니다." | 새로고침은 목록을 다시 불러온다 |
| 범위 목록 | 왼쪽 | 검색 입력, 행마다 범위 키(예: `cust:42`)·건수·최신 갱신 상대 시각·🗑, "더 보기" | 행을 고르면 오른쪽에 그 범위의 메모리가 나온다. 🗑 은 범위 전체 삭제(편집자 이상) |
| 메모리 목록 | 오른쪽 | 종류 필터 드롭다운(기본 전체), 건수, 행마다 내용·메모리 종류 배지·상대 시각·🗑, "더 보기" | 🗑 은 단건 삭제(편집자 이상) |

- **범위 목록**: `GET /api/agent-memories/scopes` 로 범위 키 · 건수 · 최신 `updated_at` 을 보여 준다. 범위가 없으면 빈 상태 안내를 보여 준다.
- **메모리 목록**: 범위를 고르면 `GET /api/agent-memories?scopeKey=` 로 내용, 메모리 종류 배지(`fact`·`preference`·`entity`), 생성·갱신 시각, TTL 만료 예정(`expiresAt`)을 보여 준다.
- **단건 삭제**: 메모리 행 🗑 → 확인 모달 → `DELETE /api/agent-memories/:id`. 성공하면 목록을 갱신한다.
- **범위 삭제**: 범위 행 🗑 → 건수 경고가 있는 확인 모달 → `DELETE /api/agent-memories?scopeKey=`. 응답 헤더 `X-Deleted-Count` 로 실제 삭제 건수를 받는다. 0건이면 성공 토스트가 아니라 중립 토스트 "삭제할 메모리가 없었어요" 를 보여 줘 "삭제했다" 는 오해를 막는다.
- **권한**: 화면 진입과 조회는 워크스페이스 멤버(뷰어 이상)가 한다. 삭제 버튼은 편집자 이상에게만 보인다(RoleGate).
- **빈 상태**: `persistent` 메모리를 한 번도 쌓지 않은 워크스페이스에는 "아직 메모리가 없습니다" 안내와 AI 에이전트 노드 `memoryStrategy` 설정 안내 링크를 보여 준다.

## 구현 위치

- `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.ts` · `agent-memory.controller.ts` (관리 API)
- `codebase/frontend/src/app/(main)/w/[slug]/agent-memory/page.tsx`
- `codebase/frontend/src/lib/api/agent-memories.ts`

## Rationale

### 범위 삭제에 X-Deleted-Count 헤더를 쓴 이유

범위 삭제는 204 No Content 라 본문이 없지만 프런트는 실제로 지운 행 수에 따라 토스트를 나눠야 한다(0건이면 중립, 여러 건이면 "삭제됨").

그래서 프로젝트 처음으로 커스텀 응답 헤더 `X-Deleted-Count: <n>` 을 범위 삭제 응답에 더했다.

- 204 에 본문을 실으면 HTTP 의미(No Content)를 어기므로 헤더가 맞는 전달 방법이다.
- 드러나는 정보가 정수 하나라 보안 위험이 낮다.
- 단건 삭제는 성공 여부가 204 와 404 로 분명해 헤더가 필요 없다. 범위 삭제에만 적용하는 비대칭은 도메인 의미 차이에서 온다.

cross-origin(웹채팅 위젯, 외부 앱)에서 브라우저는 기본으로 커스텀 응답 헤더를 숨긴다. 그래서 백엔드 CORS 설정 `exposedHeaders: ['X-Deleted-Count']` 에 반드시 넣어야 프런트가 값을 읽을 수 있다. 멱등 DELETE 와 커스텀 건수 헤더를 공식 규약으로 올리는 일은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 쪽 별도 작업으로 넘겼다.

### 관리 화면을 노드 에디터 밖 별도 화면으로 둔 이유

메모리는 메모리 범위 키(`memoryKey ?? execution_id`) 단위로 실행을 가로질러 쌓이므로 특정 워크플로우나 노드에 속하지 않는다. 그래서 노드 에디터 안이 아니라 지식 저장소처럼 워크스페이스 수준 관리 화면으로 둔다.

### 조회는 뷰어 이상, 삭제는 편집자 이상으로 둔 이유

메모리 내용은 운영 점검 정보라 멤버가 볼 수 있어야 한다. 삭제는 되돌릴 수 없는 영구 삭제이므로 지식 저장소 삭제와 같이 편집자 이상으로 제한한다.
