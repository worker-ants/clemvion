---
id: "CLE-WF-LIST"
title: "워크플로우 목록과 폴더"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-WFLIST-001", "REQ-WFLIST-002", "REQ-WFLIST-003", "REQ-WFLIST-004", "REQ-WFLIST-005", "REQ-WFLIST-006", "REQ-WFLIST-007", "REQ-WFLIST-008", "REQ-WFLIST-009", "REQ-WFLIST-010", "REQ-WFLIST-011", "REQ-WFLIST-012", "REQ-WFLIST-013", "REQ-WFLIST-014", "REQ-WFLIST-015", "REQ-WFLIST-016", "REQ-WFLIST-017", "REQ-WFLIST-018", "REQ-WFLIST-019", "REQ-WFLIST-020", "REQ-WFLIST-021", "REQ-WFLIST-022", "REQ-WFLIST-023", "REQ-WFLIST-024", "REQ-WFLIST-025", "REQ-WFLIST-026", "REQ-WFLIST-027", "REQ-WFLIST-028", "REQ-WFLIST-029", "REQ-WFLIST-030", "REQ-WFLIST-031", "REQ-WFLIST-032", "REQ-WFLIST-033", "REQ-WFLIST-034", "REQ-WFLIST-035", "REQ-WFLIST-036", "REQ-WFLIST-037", "REQ-WFLIST-038", "REQ-WFLIST-039", "REQ-WFLIST-040", "REQ-WFLIST-041", "REQ-WFLIST-042", "REQ-WFLIST-043", "REQ-WFLIST-044", "REQ-WFLIST-045", "REQ-WFLIST-046", "REQ-WFLIST-047", "REQ-WFLIST-048", "REQ-WFLIST-049", "REQ-WFLIST-050", "REQ-WFLIST-051"]
basis_superseded: false
parent: "CLE-WF"
ancestors: ["CLE-VISION", "CLE-WF"]
area: "CLE-WF"
content_hash: "5591281afd4797596f03f3ad1f931fc946acdad75a6179ca6e12e337a09bc362"
read_as: "approved"
task: null
source_paths: ["spec/2-navigation/1-workflow-list.md", "spec/2-navigation/_product-overview.md", "spec/3-workflow-editor/_product-overview.md"]
mirror_sha256: "5e5c28b662127e7f74a7ba13590958c4fbaa71884d4e5beeaf76273f58b14f6b"
etag: "sha256-b7e64616d6610bd30d2171a00ccb1b0eba0c584c5eb5d22f45d421e90ad1efd7"
---
> 구현 상태: 부분 구현 · 원문: `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/_product-overview.md` (§3.1), `spec/3-workflow-editor/_product-overview.md` (§6 ED-SV-05·06) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

워크플로우 목록 화면은 현재 워크스페이스의 워크플로우를 표로 보여 주는 화면이다. 사용자는 여기서 워크플로우를 찾고(검색·필터·정렬), 새로 만들고, 복제·내보내기·가져오기·삭제하고, 활성 상태를 켜고 끈다. 이름을 누르면 [에디터](CLE-WF-EDITOR.md)로 들어간다.

이 문서는 목록 화면의 동작과 목록·폴더 API, 그리고 내보내기·가져오기(export, import) JSON 파일 형식을 정한다. 폴더(Folder, `folder`)는 워크플로우를 묶는 계층 구조다. 지금은 목록의 필터로만 쓰고 폴더를 만들고 고치는 화면은 없다.

범위 밖:

- 레이아웃·사이드바·워크스페이스 slug 라우팅은 [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md) 이 정한다.
- Workflow·Folder 엔티티 컬럼과 제약, 복제의 데이터 흐름은 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 이 정한다.
- 워크플로우를 지울 때 트리거와 외부 자원을 정리하는 순서는 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 가 정한다.
- 검색 결과 없음 상태의 공통 패턴은 [오류 화면과 빈 상태](../CLE-UI/CLE-UI-ERRORS.md) 가 정한다.
- 목록 응답 형식과 페이지네이션은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 을 따른다. 역할별 권한 표는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 에 있다.

## 요구사항

- REQ-WFLIST-001 WHEN 사용자가 워크플로우 목록 화면에 들어오면 THE SYSTEM SHALL 현재 워크스페이스의 워크플로우를 모두 목록으로 표시한다. (원본: NAV-WF-01)
- REQ-WFLIST-002 WHEN 목록을 표시하면 THE SYSTEM SHALL 각 행에 워크플로우 이름·활성 상태·마지막 실행 시간·생성일을 표시한다. (원본: NAV-WF-02) (부분 구현)
- REQ-WFLIST-003 WHEN 사용자가 검색창에 입력하면 THE SYSTEM SHALL 이름 기준으로 300ms debounce 뒤 목록을 다시 조회한다. (원본: NAV-WF-03)
- REQ-WFLIST-004 IF 검색 결과가 없으면 THE SYSTEM SHALL "검색 결과가 없습니다" 메시지를 표시한다.
- REQ-WFLIST-005 WHEN 사용자가 생성·복제·삭제를 고르면 THE SYSTEM SHALL 해당 워크플로우를 만들거나 복제하거나 지운다. (원본: NAV-WF-04)
- REQ-WFLIST-006 WHEN 사용자가 행의 상태 스위치를 누르면 THE SYSTEM SHALL 워크플로우 활성 상태를 즉시 바꾼다. (원본: NAV-WF-05)
- REQ-WFLIST-007 WHEN 사용자가 목록을 정리하면 THE SYSTEM SHALL 폴더와 태그로 워크플로우를 묶고 거를 수 있게 한다. (원본: NAV-WF-06) (부분 구현)
- REQ-WFLIST-008 WHILE 현재 워크스페이스가 팀 워크스페이스인 동안 THE SYSTEM SHALL 워크플로우 이름 옆에 팀 배지를 표시한다. (원본: NAV-WF-07)
- REQ-WFLIST-009 WHEN 사용자가 워크플로우 이름을 누르면 THE SYSTEM SHALL 그 워크플로우의 에디터로 이동한다. (원본: NAV-WF-08)
- REQ-WFLIST-010 WHEN 사용자가 상태 필터(전체·활성·비활성)를 고르면 THE SYSTEM SHALL 서버에 `?status=active|inactive` 를 보내 목록을 거른다.
- REQ-WFLIST-011 WHILE 현재 워크스페이스가 팀 워크스페이스인 동안 THE SYSTEM SHALL 소유 필터(내 워크플로우·공유된 워크플로우·전체)를 표시하고 `?ownership=mine|shared|all` 로 보낸다.
- REQ-WFLIST-012 IF 현재 워크스페이스가 개인 워크스페이스이면 THE SYSTEM SHALL 소유 필터를 숨기고 `ownership` 파라미터를 보내지 않는다.
- REQ-WFLIST-013 IF 개인 워크스페이스 요청에 `ownership` 이 실려 오면 THE SYSTEM SHALL 그 값을 무시하고 `all` 처럼 동작한다.
- REQ-WFLIST-014 WHEN 사용자가 태그 필터에 값을 입력하면 THE SYSTEM SHALL debounce 뒤 그 태그 하나를 `?tag=` 로 보내고 페이지를 처음으로 돌린다.
- REQ-WFLIST-015 IF 태그 필터가 비어 있으면 THE SYSTEM SHALL `tag` 파라미터를 보내지 않는다.
- REQ-WFLIST-016 WHILE 현재 워크스페이스에 폴더가 하나 이상 있는 동안 THE SYSTEM SHALL 폴더 필터 드롭다운을 표시한다.
- REQ-WFLIST-017 WHEN 사용자가 폴더를 고르면 THE SYSTEM SHALL `?folderId=` 로 목록을 거르고 페이지를 처음으로 돌린다.
- REQ-WFLIST-018 WHEN 사용자가 워크스페이스를 바꾸면 THE SYSTEM SHALL 선택한 폴더 필터를 초기화한다.
- REQ-WFLIST-019 WHEN 사용자가 기본값이 아닌 정렬을 고르면 THE SYSTEM SHALL `sort`·`order` 파라미터를 보낸다.
- REQ-WFLIST-020 WHILE 정렬이 기본값(생성일 내림차순)인 동안 THE SYSTEM SHALL `sort`·`order` 파라미터를 보내지 않는다.
- REQ-WFLIST-021 WHEN 마지막 실행순으로 정렬하면 THE SYSTEM SHALL 워크플로우별 가장 늦은 실행 시작 시각으로 내림차순 정렬하고 실행한 적 없는 워크플로우를 맨 뒤에 둔다.
- REQ-WFLIST-022 WHEN 사용자가 "+ New Workflow" 를 누르면 THE SYSTEM SHALL 기본값 "Untitled Workflow" 가 든 이름 입력 다이얼로그를 띄우고 생성 뒤 바로 에디터로 이동한다.
- REQ-WFLIST-023 WHEN 사용자가 더보기 메뉴에서 실행 내역을 고르면 THE SYSTEM SHALL 현재 워크스페이스 slug 기준 `/w/<slug>/workflows/:id/executions` 로 이동한다.
- REQ-WFLIST-024 WHEN 사용자가 복제를 고르면 THE SYSTEM SHALL 노드·연결선을 포함한 캔버스 전체를 이름 끝에 " (Copy)" 를 붙인 비활성 사본으로 만든다.
- REQ-WFLIST-025 WHEN 워크플로우를 복제하면 THE SYSTEM SHALL 버전 기록·트리거·테스트 데이터셋을 사본에 옮기지 않는다.
- REQ-WFLIST-026 WHEN 사용자가 목록이나 에디터 더보기 메뉴에서 내보내기를 고르면 THE SYSTEM SHALL 워크플로우를 JSON 파일로 내려받게 한다. (원본: ED-SV-05)
- REQ-WFLIST-027 WHEN 사용자가 JSON 파일을 가져오면 THE SYSTEM SHALL 그 파일로 새 워크플로우를 만든다. (원본: ED-SV-06)
- REQ-WFLIST-028 WHEN 사용자가 워크플로우를 비활성으로 바꾸면 THE SYSTEM SHALL 그 워크플로우의 트리거·스케줄 실행을 멈춘다(현재 구현과 다름, 미결 사항 참조). (부분 구현)
- REQ-WFLIST-029 WHEN 사용자가 삭제를 확인하면 THE SYSTEM SHALL 워크플로우와 연결된 트리거를 함께 지우고 트리거가 쓰던 외부 등록과 비밀을 정리한다.
- REQ-WFLIST-030 IF 워크플로우가 하나도 없으면 THE SYSTEM SHALL 아이콘과 "첫 번째 워크플로우를 만들어 보세요" 메시지와 생성 버튼을 표시한다.
- REQ-WFLIST-031 IF 검색·필터 때문에 결과가 비면 THE SYSTEM SHALL 생성 버튼 대신 "필터를 조정해 보세요" 안내를 표시한다.
- REQ-WFLIST-032 IF 목록이 비면 THE SYSTEM SHALL 마켓플레이스 템플릿 추천 링크를 함께 표시한다. (미구현)
- REQ-WFLIST-033 WHEN `editor` 이상 역할의 사용자가 폴더를 만들면 THE SYSTEM SHALL `parentId` 가 있을 때 그 폴더 아래에 만든다.
- REQ-WFLIST-034 IF 새 폴더의 중첩 깊이가 5를 넘으면 THE SYSTEM SHALL 400 `VALIDATION_ERROR` 로 거부한다.
- REQ-WFLIST-035 IF 같은 부모 아래에 같은 이름의 폴더가 있으면 THE SYSTEM SHALL 409 `RESOURCE_CONFLICT` 로 거부한다.
- REQ-WFLIST-036 IF 폴더의 `parentId` 를 바꿀 때 새 부모가 다른 워크스페이스에 있거나 자기 자신·자손이거나 이동 뒤 깊이가 5를 넘으면 THE SYSTEM SHALL 400 `VALIDATION_ERROR` 로 거부한다.
- REQ-WFLIST-037 WHEN 폴더의 `parentId` 를 `null` 로 바꾸면 THE SYSTEM SHALL 항상 루트로 옮긴다.
- REQ-WFLIST-038 WHEN 폴더를 지우면 THE SYSTEM SHALL 하위 폴더를 함께 지우고 그 폴더에 속한 워크플로우는 보존한 채 루트로 옮긴다.
- REQ-WFLIST-039 WHEN 사용자가 폴더를 만들거나 고치거나 지우려 하면 THE SYSTEM SHALL 폴더 관리 화면을 제공한다. (미구현)
- REQ-WFLIST-040 IF 가져온 파일의 노드 `type` 이 허용 목록에 없으면 THE SYSTEM SHALL 400 `VALIDATION_ERROR` 로 거부한다.
- REQ-WFLIST-041 IF 가져온 파일에 같은 노드 레이블이 둘 이상 있으면 THE SYSTEM SHALL 409 `DUPLICATE_NODE_LABEL` 로 거부한다.
- REQ-WFLIST-042 WHEN 노드 설정을 가져오면 THE SYSTEM SHALL 노드 스키마의 기본값을 채운다.
- REQ-WFLIST-043 IF 가져온 노드 설정이 노드 스키마 검사에 실패하면 THE SYSTEM SHALL 가져오기를 거부하지 않고 원래 설정을 그대로 보존한다.
- REQ-WFLIST-044 IF 가져온 AI 노드에 `llmConfigId` 가 없으면 THE SYSTEM SHALL 워크스페이스 기본 모델 설정을 채운다.
- REQ-WFLIST-045 WHEN 가져오기가 끝나면 THE SYSTEM SHALL 배열 인덱스로 된 노드 참조를 새로 발급한 UUID 로 바꿔 저장한다.
- REQ-WFLIST-046 IF 가져온 `settings` 에 모르는 키나 양의 정수가 아닌 값이 있으면 THE SYSTEM SHALL 400 `VALIDATION_ERROR` 로 거부한다.
- REQ-WFLIST-047 WHEN 워크플로우를 내보내면 THE SYSTEM SHALL 노드 사이 참조를 UUID 대신 `nodes[]` 배열 인덱스로 적는다.
- REQ-WFLIST-048 WHEN 내보내기·가져오기를 하면 THE SYSTEM SHALL 파일 형식 버전(`formatVersion`)을 주고받는다. (미구현)
- REQ-WFLIST-049 IF 워크플로우 생성·수정 요청의 `folderId` 가 같은 워크스페이스의 폴더가 아니면 THE SYSTEM SHALL 저장하지 않고 400 `VALIDATION_ERROR`(`details[].field='folderId'`)로 거부한다.
- REQ-WFLIST-050 IF 폴더 생성 요청의 `parentId` 가 같은 워크스페이스의 폴더가 아니면 THE SYSTEM SHALL 저장하지 않고 400 `VALIDATION_ERROR`(`details[].field='parentId'`)로 거부한다.
- REQ-WFLIST-051 WHEN 폴더 수정 요청의 새 `parentId` 가 같은 워크스페이스에 없어 거부하면 THE SYSTEM SHALL 생성과 같은 형태의 `details[]`(`field='parentId'`, `code='INVALID_FIELD'`)를 싣는다.

## 화면 구성

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 헤더 | 화면 위 | 제목 "Workflows", `⤓ Import` 버튼, `+ New Workflow` 버튼 | Import 는 JSON 가져오기, New Workflow 는 생성 다이얼로그 |
| 검색·필터 줄 | 헤더 아래 | 검색창, 상태 토글 버튼 그룹(전체·Active·Inactive), 소유 필터(팀 워크스페이스만), 정렬·폴더·태그 입력 | 조건이 바뀌면 목록을 다시 조회 |
| 목록 표 | 가운데 | Status·Name·Tags·Last Updated·Actions 열 | 행마다 상태 스위치와 더보기(⋮) 메뉴 |
| 페이지 이동 | 표 아래 | 페이지 번호와 다음 화살표 | 페이지 전환 |

### 목록 표의 열

지금 구현한 열은 다섯 개다.

| 열 | 내용 |
| --- | --- |
| Status | 활성·비활성 토글 스위치. 누르면 바로 바뀐다. 초록은 활성, 회색은 비활성이다. |
| Name | 워크플로우 이름. 누르면 에디터로 들어간다. 팀 워크스페이스에서는 이름 옆에 팀 배지(Team badge, "👥 Team")를 붙인다. 개인 워크스페이스에서는 붙이지 않는다([Rationale](#rationale) 1번). |
| Tags | 워크플로우 태그 배지 |
| Last Updated | 마지막 수정 시각(`updatedAt`)을 상대 시간으로 표시 |
| Actions | 더보기(⋮) 메뉴: 편집, 실행 내역, 복제, 내보내기, 활성·비활성 토글, 삭제 |

"트리거 요약" 열, "노드 수" 열, "마지막 실행" 시각 열은 아직 없다(미구현). 시각 열은 마지막 수정 시각 기준이다. 그래서 NAV-WF-02 의 마지막 실행 시간·생성일 표시는 부분 구현이다.

## 검색·필터·정렬

### 검색

- 워크플로우 이름으로 실시간 검색한다. 입력 뒤 300ms debounce 를 둔다.
- 결과가 없으면 "검색 결과가 없습니다" 메시지를 표시한다.

### 필터

| 필터 | 옵션 | 동작 |
| --- | --- | --- |
| 상태 | 전체 / Active / Inactive | 항상 보이는 버튼 그룹. 서버 계약(`query-workflow.dto.ts`)과 클라이언트 모두 `?status=active\|inactive` 를 쓴다. |
| 소유 | 내 워크플로우 / 공유된 워크플로우 / 전체 | 팀 워크스페이스일 때만 보인다. "공유된 워크플로우" 는 작성자가 내가 아닌(`createdBy ≠ 현재 사용자`) 워크플로우다. 세 옵션은 서버 `ownership` 의 `mine`·`shared`·`all` 에 하나씩 대응한다. 개인 워크스페이스에서는 필터가 사라지고 파라미터도 보내지 않는다. |
| 태그 | 태그 하나(텍스트 입력) | 입력한 태그 하나를 `?tag=` 로 보낸다. 그 값을 `tags` 배열에 가진 워크플로우만 조회한다(`= ANY(tags)`). 빈 값이면 보내지 않는다. 검색처럼 debounce 를 두고 페이지를 처음으로 돌린다([Rationale](#rationale) 4번). |
| 폴더 | 폴더 선택 | 워크스페이스에 폴더가 하나 이상 있을 때만 보이는 드롭다운(`NativeSelect`). 첫 옵션 "전체 폴더" 는 빈 값이라 보내지 않는다. 고르면 `?folderId=` 로 거르고 페이지를 처음으로 돌린다. 폴더는 워크스페이스 단위라 워크스페이스를 바꾸면 선택을 초기화한다. |

팀 배지는 워크스페이스 단위의 "공유" 정의를 따른다. 소유 필터는 그 안에서 내 것과 남의 것을 다시 나누는 보조 도구다. 두 정의가 어긋나지 않는 이유는 [Rationale](#rationale) 1번에 있다.

### 정렬

목록 위 정렬 드롭다운(`NativeSelect`)이 `sort`·`order` 파라미터를 보낸다. 기본값은 서버와 같은 생성일 내림차순(`created_at` desc)이고 기본이 아닌 옵션을 고를 때만 파라미터를 보낸다.

| 정렬 기준 | 방향 | 서버 기준 |
| --- | --- | --- |
| 최신 생성순(기본) | 내림차순 | `created_at` |
| 최근 수정순 | 내림차순 | `updated_at` |
| 이름순 | 오름차순 | `name` |
| 마지막 실행순 | 내림차순 | `last_run`. `execution` 테이블에서 워크플로우별 `MAX(started_at)` 를 correlated subquery 로 구하고 실행한 적 없는 워크플로우는 `NULLS LAST` 로 둔다. |

## 새 워크플로우 만들기

1. 사용자가 "+ New Workflow" 를 누른다.
2. 이름 입력 다이얼로그가 뜬다. 기본값은 "Untitled Workflow" 다.
3. 만들고 나면 바로 에디터로 들어간다. 서버는 새 워크플로우에 [수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md)를 하나 자동으로 만든다([워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md) 참조).

## 더보기 메뉴 액션

| 액션 | 동작 |
| --- | --- |
| 편집 | 에디터로 들어간다. |
| 실행 내역 | `/w/<slug>/workflows/:id/executions` 로 이동한다. slug 는 현재 워크스페이스 기준이다. 에디터 캔버스 경로 `/workflows/:id` 도 slug 라우팅 2단계부터 slug 기준이다. 라벨은 i18n `workflows.executionHistory` (ko "실행 내역", en "Execution History")다. 화면 내용은 [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md) 이 정한다. |
| 복제 | 워크플로우 사본을 만든다(duplicate). 노드·연결선을 포함한 캔버스 전체를 복사하고 이름 끝에 " (Copy)" 를 붙이며 사본은 비활성으로 시작한다. 버전 기록·트리거·테스트 데이터셋은 옮기지 않는다. 데이터 흐름과 재매핑 규칙은 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 에 있다. |
| 내보내기 | JSON 파일로 내려받는다. 파일 형식은 [내보내기·가져오기 JSON 형식](#내보내기가져오기-json-형식) 에 있다. |
| 활성/비활성 | 워크플로우 활성 상태(`workflow.is_active`)를 바꾼다. 원문은 "비활성이면 트리거·스케줄이 멈춘다" 고 적지만 현재 구현과 다르다. 정의가 갈린다. [미결 사항](#미결-사항) 참조. |
| 삭제 | 확인 다이얼로그 뒤 지운다. 연결된 트리거는 함께 지워진다(FK CASCADE, 스케줄 트리거면 스케줄까지). 트리거가 쓰던 외부 등록과 비밀도 정리한다. 순서와 실패 처리는 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 에 있다. |

에디터 헤더의 더보기 메뉴에도 내보내기·가져오기가 있다([워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md)). 동작과 파일 형식은 이 문서를 따른다.

## 빈 상태

- 워크플로우가 하나도 없을 때: 아이콘, "첫 번째 워크플로우를 만들어 보세요" 메시지, 생성 버튼을 표시한다(`EmptyState`).
- 검색·필터 때문에 결과가 비었을 때: 생성 버튼 대신 "필터를 조정해 보세요" 안내와 "필터 초기화" 버튼을 표시한다. 버튼을 누르면 검색어·상태·소유·정렬·폴더·태그 필터를 모두 기본값으로 되돌리고 첫 페이지로 돌아간다. 현재 구현은 `workflows.resetFilters` 버튼으로 이 동작을 제공한다.
- 검색 결과 없음 상태의 공통 패턴(아이콘·문구·필터 초기화 버튼)은 [오류 화면과 빈 상태 §검색 결과 없음](../CLE-UI/CLE-UI-ERRORS.md#검색-결과-없음) 이 정한다. 이 패턴을 다른 목록에도 적용할지는 [그 문서의 미결 사항](../CLE-UI/CLE-UI-ERRORS.md#미결-사항) 에 있다.
- 마켓플레이스 템플릿 추천 링크는 아직 없다(미구현).

## API

### 워크플로우 API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/workflows` | 목록 조회. 쿼리: `search`, `status`, `tag`, `folderId`, `sort`, `order`, `page`, `limit`, `ownership`. 목록 응답 형식은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 을 따른다. `ownership` 은 팀 워크스페이스에서만 뜻이 있다(`mine`·`shared`·`all`, 기본 `all`). 개인 워크스페이스에서는 서버가 무시하고 `all` 처럼 동작한다. |
| POST | `/api/workflows` | 새 워크플로우 생성. `folderId` 는 같은 워크스페이스의 폴더만 받는다. 아니면 400 `VALIDATION_ERROR`(`details[].field='folderId'`)다([데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)) |
| PATCH | `/api/workflows/:id` | 워크플로우 수정(이름, 상태 등). `folderId` 는 생성과 같은 검사를 한다 |
| POST | `/api/workflows/:id/duplicate` | 복제. 노드·연결선을 포함한 캔버스 전체를 한 트랜잭션으로 복사한다. 복제 범위와 재매핑 규칙은 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 에 있다. |
| DELETE | `/api/workflows/:id` | 워크플로우 삭제 |
| GET | `/api/workflows/:id/export` | JSON 내보내기 |
| POST | `/api/workflows/import` | JSON 가져오기 |

### 폴더 API

워크플로우 폴더(계층 구조)의 백엔드 API 다. 엔티티와 제약(`(workspace_id, parent_id, name)` UNIQUE, 최대 중첩 깊이 5, 같은 워크스페이스, 비순환)은 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 의 Folder 절이 정한다.

프론트엔드는 목록의 폴더 필터에서 `GET /api/folders` 만 쓴다. 폴더를 만들고 고치고 지우는 관리 화면은 아직 없다(미구현). 아래 계약은 백엔드에 구현돼 있다(`folders.controller.ts`, `folders.service.ts`).

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/folders` | 폴더 목록. `sortOrder` 다음 `name` 순으로 정렬한다. 계층은 `parentId` 로 구성한다. |
| GET | `/api/folders/:id` | 폴더 한 건 조회 |
| POST | `/api/folders` | 폴더 생성(`editor` 이상). `parentId` 를 주면 그 아래에 만든다. `parentId` 가 같은 워크스페이스의 폴더가 아니면 400 `VALIDATION_ERROR`(`details[].field='parentId'`), 깊이 5를 넘으면 400 `VALIDATION_ERROR`, 같은 부모 아래 이름이 겹치면 409 `RESOURCE_CONFLICT` 다. 유일성 위반은 전역 exception filter 가 409 로 바꾼다. |
| PATCH | `/api/folders/:id` | 폴더 수정(`editor` 이상). 이름·부모·정렬 순서를 부분 수정한다. `parentId` 를 바꾸면 생성과 같은 계층 검사를 한다. 새 부모가 같은 워크스페이스에 없거나(`details[].field='parentId'`, 생성과 같은 형태), 자기 자신·자손이거나(순환), 이동 뒤 서브트리 깊이가 5를 넘으면 400 `VALIDATION_ERROR` 다. `parentId: null` 로 루트로 옮기는 것은 항상 허용한다. |
| DELETE | `/api/folders/:id` | 폴더 삭제(`editor` 이상, 204). 하위 폴더는 DB cascade 로 함께 지워진다. 폴더에 속한 워크플로우는 FK SET NULL 로 루트로 옮겨지고 워크플로우 자체는 남는다. |

### 내보내기·가져오기 JSON 형식

사용자가 파일로 받아 손으로 고친 뒤 다시 가져올 수 있는 JSON 계약이다. 기준은 `import-workflow.dto.ts` 와 `ExportWorkflowDto` 다.

**내보내기**(`GET /api/workflows/:id/export`)의 최상위 키는 `name`, `description`, `tags`, `settings`, `nodes[]`, `edges[]` 다. 노드 사이 참조는 UUID 가 아니라 `nodes[]` 배열 인덱스로 적는다. 그래서 다른 환경으로 옮겨도 참조가 깨지지 않는다.

- 연결선: `sourceNodeIndex`·`targetNodeIndex`(와 `sourcePort`·`targetPort`·`type`·`condition`)
- 노드: `containerIndex`·`toolOwnerIndex`. 컨테이너 소속과 도구 소유 노드를 가리키고 없으면 `null` 이다. `toolOwnerIndex` 는 제거된 도구 영역 기능의 컬럼(`tool_owner_id`)을 옮기는 자리다.

Swagger 응답 DTO(`ExportWorkflowDto`)는 `formatVersion` 필드를 선언하지만 지금 내보내기는 이 필드를 싣지 않고 가져오기 DTO 도 받지 않는다. 형식 버전 협상은 미구현이다.

**가져오기**(`POST /api/workflows/import`)는 아래 순서로 검사하고 저장한다.

1. 노드 `type` 을 허용 노드 유형 목록(`@IsIn(ALL_NODE_TYPES)`)으로 DTO 검사한다. 모르는 유형이면 400 `VALIDATION_ERROR` 다.
2. 노드 레이블은 워크플로우 안에서 유일해야 한다. 겹치면 409 `DUPLICATE_NODE_LABEL` 이다.
3. 노드 `config` 를 그 노드의 zod 스키마로 parse 해 `.default(...)` 기본값을 덮어 채운다(`applyConfigDefaults`). 캔버스에서 노드를 새로 만들 때와 같은 기본값이다. parse 에 실패하면(손으로 고친 JSON, 타입 불일치 등) 원래 설정을 그대로 보존한다. 사용자는 에디터에서 그 노드를 고칠 수 있다([Rationale](#rationale) 2번).
4. AI 노드에 `llmConfigId` 가 없으면 워크스페이스 기본 모델 설정을 채운다.
5. 인덱스 참조(`containerIndex`·`toolOwnerIndex`·`sourceNodeIndex`·`targetNodeIndex`)를 새로 발급한 UUID 로 바꿔 저장한다.
6. 워크플로우 `settings` 는 엄격한 중첩 DTO(`WorkflowSettingsDto`)로 검사한다. 지금 허용하는 키는 `maxConcurrentExecutions`(양의 정수, 워크플로우당 동시 실행 상한) 하나다. 모르는 키, 양수가 아닌 값, 정수가 아닌 값은 400 `VALIDATION_ERROR` 다. `UpdateWorkflowDto.settings`(PATCH)도 같은 규칙을 쓴다. 동시 실행 상한의 동작은 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 에 있다.

가져오기 전체를 한 트랜잭션으로 저장하는 흐름은 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 에 있다.

## 미결 사항

- **워크플로우 활성 상태가 트리거 실행을 막는가**: 이 문서의 원문(더보기 메뉴 "비활성 시 트리거/스케줄 중지")과 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 의 상태 전이("스케줄·웹훅 트리거는 활성만 동작"), 대시보드의 Active 카드 설명은 워크플로우를 끄면 웹훅·스케줄 실행이 멈춘다고 적는다. [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) 의 웹훅·스케줄 흐름은 `trigger.is_active` 와 `schedule.is_active` 만 본다. 현재 구현도 `hooks.service.ts` 와 schedule runner 가 트리거·스케줄 플래그만 확인하고 `workflow.is_active` 를 확인하지 않는다. 워크플로우 활성 상태를 실행 게이트로 둘지(구현과 트리거 흐름을 고침), 표시용으로 둘지(이 약속을 거둠) 결정이 필요하다. 이 결정은 [트리거 데이터와 흐름의 미결 사항](../CLE-TRIG/CLE-TRIG-DATA.md#미결-사항) 에서 한다.

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/workflows/page.tsx` (목록 화면)
- `codebase/frontend/src/lib/api/workflows.ts`
- `codebase/backend/src/modules/workflows/dto/**` (`query-workflow.dto.ts`, `import-workflow.dto.ts` 등)
- `codebase/backend/src/modules/workflows/workflows.service.ts`
- `codebase/backend/src/modules/workflows/workflows.module.ts`
- `codebase/backend/src/modules/folders/**`

## Rationale

### 1. "공유 워크플로우" 는 팀 워크스페이스의 모든 워크플로우다

요구사항 NAV-WF-07 의 "공유" 기준으로 두 안을 검토했다.

- (a) 팀 워크스페이스에 속한 모든 워크플로우를 공유로 본다. 채택했다.
- (b) `createdBy ≠ 현재 사용자` 이거나 별도 `sharedWith` 컬럼이 있는 워크플로우를 공유로 본다. 기각했다.

(a) 를 고른 이유는 다음과 같다.

- 요구사항 NAV-WF-07 의 원문("팀 워크스페이스에서 공유된 워크플로우 구분 표시")은 워크스페이스 단위의 격리와 공유를 전제로 한다. 워크스페이스를 공유 단위로 보는 정의와 잘 맞는다.
- 데이터 모델은 이미 `workspaceId` 로 워크플로우를 격리한다(`workflow.entity.ts`). 그래서 `sharedWith` 컬럼이나 추가 마이그레이션 없이 구현할 수 있다.
- (b) 는 같은 팀 안에서 "내 것" 과 "남의 것" 을 다시 나누는 정의다. 그 구분은 소유 필터가 맡으므로 배지에서 한 번 더 표현할 필요가 없다.

그래서 배지는 워크스페이스 단위의 공유를, 필터는 작성자 단위의 세분화를 맡는다.

### 2. 가져오기에서 노드 설정은 느슨하게 받는다

가져오기 때 노드 `config` 의 스키마 parse 가 실패해도 거부하지 않고 원래 설정을 보존한다.

- 가져오기 JSON 은 사용자가 손으로 고칠 수 있는 파일이다. 사소한 타입 불일치로 가져오기 전체를 400 으로 거부하면 복구할 길이 없다. 노드 단위로 원래 값을 보존하면 사용자가 에디터에서 그 노드만 고쳐 복구할 수 있다.
- 노드 `type` 허용 목록과 레이블 유일성은 워크플로우 구조 자체의 무결성이다. 그래서 DTO 단계에서 400·409 로 거부한다. 설정 내용(느슨함)과 구조(엄격함)를 나눈 결정이다.
- `applyConfigDefaults` 가 모르는 노드 유형의 설정을 그대로 통과시키는 분기는 앞으로 올 유형에 대비한 방어 코드다. 실제로는 1단계 허용 목록 검사가 먼저 막는다.
- 워크플로우 `settings` 는 이 느슨한 예외에 들지 않는다. 느슨한 정책은 사용자가 손으로 고친 뒤 에디터에서 복구할 수 있는 노드 `config` 에만 쓴다. `settings.maxConcurrentExecutions` 는 동시 실행 상한이라 잘못된 값을 조용히 무시하면 상한 정책이 어긋난다. 그래서 쓰기 경계에서 엄격한 중첩 DTO(`WorkflowSettingsDto`)로 거부한다. 가져오기와 PATCH(`UpdateWorkflowDto`)가 같은 규칙을 쓰고 데이터 모델도 `Workflow.settings` 를 이 키로 한정한다(2026-07-04 결정).

### 3. 폴더 계층 무결성은 생성과 부모 변경에서 모두 강제한다 (2026-07-05)

"최대 깊이 5, 같은 워크스페이스, 비순환" 규칙을 폴더 생성뿐 아니라 `PATCH` 로 부모를 바꿀 때도 400 `VALIDATION_ERROR` 로 강제한다. 이전의 `update()` 는 `parentId` 를 검사 없이 저장해 깊이 초과·순환·다른 워크스페이스 부모가 그대로 통과했다. 순환은 조상 깊이 계산(`getDepth`)을 무한 루프로 만들어 서비스 거부 위험이 있었다(V-04).

- **스펙을 생성 전용으로 낮추지 않고 코드를 고친 이유**: 깊이 제한은 스펙을 낮춰 완화할 수 있다. 순환은 데이터 무결성과 가용성의 결함(무한 루프)이라 스펙 문구로 사라지지 않는다. 그래서 규칙을 그대로 두고 코드를 맞췄다.
- **에러 코드**: 세 위반(같은 워크스페이스·순환·깊이) 모두 생성 경로와 같은 `VALIDATION_ERROR` 를 쓴다. 노드 컨테이너의 `CONTAINER_CYCLE` 이나 워크플로우 그래프의 `CYCLE_DETECTED` 와 이름·뜻이 겹치는 폴더 전용 순환 코드를 새로 만들지 않아 영역 사이 혼동을 피한다.
- **무한 루프 방어**: `getDepth` 와 서브트리 순회는 방문 집합과 깊이 상한으로 막는다. 검사를 도입하기 전에 저장된 순환 데이터가 있어도 순회는 항상 끝난다.

2026-09-27 정정: 이 결정 뒤에도 **생성** 경로는 깊이만 봤다. `getDepth` 가 다른 워크스페이스의 부모를 "없음" 으로 읽어 깊이 1 로 통과시켰다. 고치기 전 e2e 에서 다른 워크스페이스 부모로 만든 폴더가 201 이었다. 지금은 생성에도 부모 변경과 같은 소속 검사를 해서 생성·수정 모두 소속을 본다. 규칙은 [데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 이 정한다.

### 4. 태그 필터는 태그 하나를 텍스트로 받는다 (2026-07-06)

태그 필터를 다중 선택 대신 태그 하나를 입력하는 텍스트 필터로 정했다. 이전의 "다중 선택" 문구는 설계 결정이 아니었다. 서버의 단일 태그 계약과 처음부터 어긋나 있던 자리표시였다. 그래서 이 결정은 번복이 아니라 처음 확정한 것이다.

- **여러 개가 아니라 하나인 이유**: 서버 `GET /api/workflows` 는 `?tag=` 에 값 하나만 받아 `= ANY(w.tags)` 로 맞춘다(`query-workflow.dto.ts`). 다중 선택을 지원하려면 `?tag=a,b` 나 반복 파라미터를 받도록 서버 계약을 넓히고, 워크스페이스의 태그 목록을 조회하는 엔드포인트를 새로 만들어야 한다. 지금은 선택지를 채울 출처가 없다. 이 확장은 비용에 비해 가치가 낮다고 판단했다(사용자 결정, 2026-07-06).
- **선택 목록이 아니라 텍스트인 이유**: 태그 목록 엔드포인트가 없어 드롭다운을 채울 출처가 없다. 텍스트 입력 하나는 서버 계약과 정확히 맞고 백엔드를 더 만들지 않아도 끝까지 동작한다.
- **다시 넓힐 여지**: 여러 태그가 다시 필요해지면 서버 계약 확장과 태그 목록 API 를 함께 도입하는 별도 작업으로 살릴 수 있다. 이 결정은 그 대안을 영구히 버린 것이 아니라 지금의 범위를 정한 것이다.
