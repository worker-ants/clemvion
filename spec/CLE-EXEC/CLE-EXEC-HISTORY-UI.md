---
id: "CLE-EXEC-HISTORY-UI"
title: "실행 내역 — 화면 구성"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-HISTORY"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-HISTORY"]
area: "CLE-EXEC"
content_hash: "2c27ccd77e0c7a9790c8fead0d248fc732e6e3866f42f75d18ae67416cf7e98a"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "3e5e6f0ca813484e627b41d8d9e131ea6ca586bad8243752eac2edd1dfed4e40"
etag: "sha256-8738b88a5e40d4127f1ad0385bd410daf00044c0f3df88c36510561433a2b314"
---
## 개요

이 문서는 [실행 내역](CLE-EXEC-HISTORY.md) 의 하위 문서로 실행 목록 · 실행 상세 화면의 경로와 구성, 진입점, 반응형 배치를 정한다. 실행 출처 분류와 목록·상세 API 는 부모 문서가 정한다.

## 화면과 경로

| 화면 | 경로 | 설명 |
| --- | --- | --- |
| 실행 목록 | `/w/<slug>/workflows/:id/executions` | 워크플로우 하나의 모든 실행 |
| 실행 상세 | `/w/<slug>/workflows/:id/executions/:executionId` | 실행 한 건의 노드별 결과 |

두 화면 모두 `(main)` 레이아웃 그룹에 속한다(사이드바 포함). `<slug>` 는 현재 워크스페이스의 slug 다. slug 라우팅 규칙은 [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md) 이 정한다.

```text
codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/
├── page.tsx                    # 실행 목록
└── [executionId]/
    └── page.tsx                # 실행 상세
```

## 실행 목록

### 화면 구성

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 머리 | 위 | Back 링크, "<워크플로우 이름> — Executions", "Open in Editor →" 링크 | [머리](#머리) 참조 |
| 상태 필터 | 머리 아래 | `[All] [Completed] [Failed] [Running] [Cancelled] [Waiting]` | [상태 필터](#상태-필터) 참조 |
| 테이블 | 가운데 | `Status`, `Trigger`, `Started At`, `Duration`, `Nodes` 다섯 열 | [테이블](#테이블) 참조 |
| 페이지네이션 | 아래 | `← 1 2 3 ... 10 →` | [정렬과 페이지네이션](#정렬과-페이지네이션) 참조 |

### 머리

| 요소 | 설명 |
| --- | --- |
| Back 링크 | 이전 화면으로 돌아간다(`router.back()`). 진입점이 여럿(대시보드·목록·에디터)이라 브라우저 기록으로 돌아간다. 상세의 "← Executions" 가 고정 링크인 것과의 비대칭은 의도다. 상세의 상위는 늘 목록이기 때문이다 |
| 워크플로우 이름 | 해당 워크플로우 이름 |
| "Open in Editor" 링크 | 에디터(`/w/<slug>/workflows/:id`)로 이동 |

### 상태 필터

상태 필터 버튼을 가로로 둔다. 고른 필터는 활성 스타일(`variant="default"`), 나머지는 비활성 스타일(`variant="outline"`)이다.

| 필터 | 값 | 설명 |
| --- | --- | --- |
| All | 없음 | 모든 실행(기본값) |
| Completed | `completed` | 완료된 실행 |
| Failed | `failed` | 실패한 실행 |
| Running | `running` | 실행 중인 실행 |
| Cancelled | `cancelled` | 취소된 실행 |
| Waiting | `waiting_for_input` | 입력 대기 중인 실행 |

대기 중(`pending`)은 실행 시작 직전의 순간적인 상태라 조회 · 조치 대상이 아니어서 필터에서 일부러 뺀다. All 필터에서는 보인다. 상태 값과 전이는 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 가 정한다.

### 테이블

| 열 | 설명 | 정렬 |
| --- | --- | --- |
| Status | 상태 아이콘과 텍스트(`✅ Completed`, `❌ Failed`, `⏳ Running`, `⛔ Cancelled`, `🙋 Waiting`) | 가능 |
| Trigger | 실행 출처. 아이콘, 출처 라벨, 보조 라벨(트리거 이름·실행한 사람·부모 워크플로우 이름). 분류는 [실행 출처 분류](CLE-EXEC-HISTORY.md#실행-출처-분류) | 없음 |
| Started At | 실행 시작 시각(`YYYY-MM-DD HH:mm:ss`) | 가능(기본 내림차순) |
| Duration | 소요 시간(초·분 자동 전환). 실행 중이면 `—` | 가능 |
| Nodes | 노드 실행 현황(`완료 수/전체 수`, 실패가 있으면 `(N failed)`) | 없음 |

**Nodes 열**: 화면은 목록 API `ExecutionDto` 의 배치 집계 필드 `totalNodeCount`·`completedNodeCount`·`failedNodeCount` 로 그린다. 노드 실행 본문(`nodeExecutions`)은 목록 응답에 넣지 않는다([실행 내역](CLE-EXEC-HISTORY.md#목록-api-는-노드-실행을-빼고-배치-집계-세-값만-싣는다)).

| 동작 | 설명 |
| --- | --- |
| 행 클릭 | 그 실행의 상세(`/w/<slug>/workflows/:id/executions/:executionId`)로 이동 |
| 행 호버 | `hover:bg-[hsl(var(--muted))/0.5]` 배경 |

### 정렬과 페이지네이션

- 머리를 누르면 오름차순 · 내림차순이 토글되고 현재 정렬 열에 화살표를 표시한다. 기본은 `started_at` 내림차순이다.
- 페이지당 20건, 이전·다음 버튼과 페이지 번호 버튼(워크플로우 목록과 같은 패턴). 필터를 바꾸면 1페이지로 돌아간다.

### 빈 상태와 로딩

- **빈 상태**: 실행 기록이 없으면 Activity 아이콘, "No executions yet", "Run this workflow to see execution history here.", "Open in Editor →" 버튼을 표시한다. 빈 상태 공통 패턴은 [오류 화면과 빈 상태](../CLE-UI/CLE-UI-ERRORS.md) 가 정한다.
- **로딩**: 테이블 자리에 스켈레톤(`animate-pulse`) 5행을 표시한다.

## 실행 상세

### 화면 구성

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 머리 | 위 | "← Executions", 재실행 버튼, `[← Prev] [Next →]` | 목록으로 돌아가기, 재실행 모달, 이전·다음 실행 이동 |
| 요약 카드 | 머리 아래 | 상태, 시작·종료 시각, 소요 시간, 노드 현황, 실패 시 에러, 재실행 체인 배지 | [요약 카드](#요약-카드), [재실행과 체인 표시](#재실행과-체인-표시) |
| 노드 목록 | 왼쪽 | 실행된 노드와 상태 아이콘(skipped 제외) | 고른 노드를 강조하고 오른쪽에 상세를 표시 |
| 노드 상세 | 오른쪽 | 노드 이름, 유형 배지, 상태, 소요 시간, 결과 상세 탭 | [노드 결과 패널](#노드-결과-패널) |

### 요약 카드

| 필드 | 설명 |
| --- | --- |
| 상태 | 아이콘과 텍스트(배지 스타일) |
| 시작 시각 | `YYYY-MM-DD HH:mm:ss` |
| 종료 시각 | `HH:mm:ss`(같은 날이면 시간만) 또는 `—`(끝나지 않음) |
| 소요 시간 | 초·분 자동 전환 |
| 노드 실행 현황 | `완료 수 / 전체 수 completed`(실패가 있으면 `N failed` 추가) |

실패 상태면 요약 카드에 에러 메시지(예: `Error: Connection timeout on "API Call" node`)를 더 표시한다.

### 노드 결과 패널

요약 카드 아래에 좌우 2분할로 노드 목록과 노드 상세를 표시한다.

- **왼쪽 노드 목록**: 실행된 노드만 상태 아이콘과 함께 나열하고(skipped 제외) 고른 노드를 강조한다.
- **오른쪽 노드 상세**: 노드 이름, 유형 배지, 상태, 소요 시간 아래에 결과 상세 탭을 둔다. 에디터 실행 결과 드로어와 **같은 `ResultDetail` 컴포넌트**를 쓰므로 탭 구성·조건·기본 탭(대화형 AI 오류 종료 시 미리보기 우선 예외 포함)·자동 전환, AI 노드의 출력 탭 확장(메타데이터 표, 추출 필드 카드), LLM 사용량·응답·요청 탭은 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 을 따른다.

### 미리보기 탭

미리보기 탭은 노드 유형마다 다른 시각 미리보기를 보여 준다. 출력 JSON 은 출력 탭에서 본다.

- **Presentation 노드**(table, carousel, chart, template, form): 에디터 실행 때와 같은 시각 렌더를 보여 준다. 유형별 렌더는 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 의 Presentation 노드 콘텐츠 표를 따른다. Carousel 은 가로 스크롤 텍스트 중심 카드 목록(제목·설명·버튼 라벨, `layout` 배지, lazy 썸네일)이고 시각 레이아웃 재구성은 대화형 채널이 맡는다([Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md)). Form 은 제출된 데이터를 보여 준다.
- **버튼이 있는 노드**: 노드의 `buttonConfig.buttons` 에서 버튼 전체 목록을 표시한다. 실행이 끝난 뒤 선택된 버튼(`buttonId` 일치)은 primary 색으로 강조하고 선택되지 않은 버튼은 outline 스타일의 비활성으로 표시한다.
- **AI 에이전트·정보 추출기(멀티턴) 노드**: 끝난 대화를 채팅 스레드 모양으로 보여 준다. **오류 종료(`failed`)도 포함한다.** 노드 `outputData` 는 실패해도 저장되므로(`output.error` 와 일부 `output.result.*`, [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md)) 새로고침 뒤에도 대화가 복원되고 마지막에 `system_error` 가 인라인으로 표시된다. 내역 화면의 `system_error` 에는 `nodeExecutionId` 가 없어 [다시 시도] 버튼은 숨는다. 복원 규칙은 [대화 미리보기](CLE-EXEC-PREVIEW.md) 의 데이터 소스와 Inv-8 이 정한다.
  - 턴 수와 종료 사유를 표시한다.
  - User·Assistant 메시지를 말풍선으로 나열한다.
  - 도구 호출 배지는 접고 펼 수 있다.
  - **메시지 클릭**: 그 메시지의 상세만 인라인으로 표시한다. assistant 는 본문과 도구 호출 배지, user 는 내용과 타임스탬프, tool 은 인자와 결과다. assistant 의 원문 요청·응답·사용량은 응답·요청·LLM 사용량 탭에서 본다.
  - "← Back to conversation" 버튼으로 스레드 보기로 돌아간다.
- **일반 노드**: 상태(Status)와 소요 시간(Duration)을 표시한다. 에러가 있으면 에러 메시지도 표시한다.

### 에러 상태

| 상태 | 표시 |
| --- | --- |
| Loading | 스켈레톤 3블록 |
| API Error | "Failed to load execution. Please try again." 과 Back 버튼 |
| Not Found | "Execution not found." 와 Back 버튼 |

### 이전·다음 실행 이동

머리 오른쪽의 `← Prev`·`Next →` 버튼은 같은 워크플로우의 시간 순서에서 이전·다음 실행으로 이동한다. 첫 실행과 마지막 실행에서는 해당 버튼을 비활성화한다.

### 재실행과 체인 표시

요약 카드 오른쪽 머리의 재실행(Re-run) 버튼을 누르면 입력 데이터 미리보기·편집 모달이 열린다. dry-run 토글로 외부 호출을 건너뛴 흐름 검증도 할 수 있다. 모달·정책·API 는 [재실행](CLE-EXEC-RERUN.md) 이 정한다.

| 영역 | 위치 | 들어가는 요소 |
| --- | --- | --- |
| 머리 | 위 | "← Executions", `[⟳ Re-run]`, `[← Prev] [Next →]` |
| 요약 | 가운데 | 상태, 시작 시각과 소요 시간, 노드 현황 |
| 체인 줄 | 요약 아래 | `📎 #3-th re-run · dry-run · 원본: #1234` 와 `[View chain (4) ▼]` |

| 요소 | 표시 조건 | 동작 |
| --- | --- | --- |
| `[⟳ Re-run]` 버튼 | 항상 표시 | 권한이 없으면 비활성화하고 툴팁 `history.rerun.permissionDenied` 를 단다([역할별 표시](#역할별-표시)). 누르면 재실행 모달을 연다 |
| 체인 배지 | `execution.reRunOf != null` | "#N-th re-run · 원본: <ID>". dry-run 이면 "· dry-run" 을 붙인다. 원본 ID 를 누르면 **같은 탭**에서 원본 상세로 이동한다(`<Link href>`, `target=_blank` 없음). 재실행 **모달**의 원본 ID 링크는 편집 맥락을 지키려고 새 탭이다(의도한 구분) |
| `[View chain (N) ▼]` 드롭다운 | 체인의 실행이 2개 이상 | 누르면 `GET /api/executions/:id/chain` 응답을 펼친다. 항목마다 ID, 시작 시각, 최종 상태, dry-run 여부를 보여 준다 |

모달에서 "재실행" 을 누르면 `POST /api/executions/:executionId/re-run` 응답의 새 실행 ID 로 `/w/<slug>/workflows/:workflowId/executions/:newId` 로 이동한다. i18n 키와 에러 매핑은 [재실행](CLE-EXEC-RERUN.md) 에 있다.

실행 상세 화면에는 에디터 실행 결과 드로어와 같은 모양으로 Background 본문 실행 결과 섹션도 표시된다([에디터 실행과 디버깅](CLE-EXEC-RUN.md)).

#### 역할별 표시

체인 배지와 `[View chain (N) ▼]` 드롭다운은 실행 상세를 볼 수 있는 워크스페이스 멤버 모두에게(재실행 권한과 무관하게) 같은 조건으로 보인다. 재실행은 편집자 이상만 할 수 있고 버튼은 역할과 원본 실행의 시작자를 함께 보고 켠다(`canReRun`). 자세한 기준은 [재실행](CLE-EXEC-RERUN.md) 이 정한다.

| 역할 | 체인 배지 · 드롭다운 | `[⟳ Re-run]` 버튼 |
| --- | --- | --- |
| 뷰어 | 보인다 | 늘 비활성. 툴팁 `history.rerun.permissionDenied` 를 단다 |
| 편집자 | 보인다 | 자기가 시작한 실행과 시작자가 없는 자동 실행에서 활성. 남이 시작한 실행에서는 비활성이고 툴팁을 단다 |
| 소유자 · 관리자 | 보인다 | 활성 |

## 진입점

| 진입점 | 동작 |
| --- | --- |
| 대시보드 Recent Executions | 행을 누르면 그 실행의 상세(`/w/<slug>/workflows/:workflowId/executions/:executionId`)로 이동한다. 행에 `cursor-pointer` 를 준다([대시보드](../CLE-OBS/CLE-OBS-DASHBOARD.md)) |
| 워크플로우 목록 | 워크플로우 행의 더보기(⋯) 메뉴에 "실행 내역"(Execution History) 항목이 있다. i18n `workflows.executionHistory`(ko/en), [워크플로우 목록과 폴더](../CLE-WF/CLE-WF-LIST.md) 와 같은 라벨이다. 누르면 실행 목록(`/w/<slug>/workflows/:id/executions`)으로 이동한다 |
| 워크플로우 에디터 | 실행 결과 영역의 "View All Executions" 링크와 에디터 안 실행 내역 패널의 "전체 실행" 링크가 실행 목록으로 이동한다([에디터 실행과 디버깅](CLE-EXEC-RUN.md)) |
| AI 어시스턴트 | 읽기 전용 도구 `get_workflow_executions`·`get_execution_details` 로 현재 워크플로우의 실행 목록과 상세를 조회한다. 직계 자식 포함 범위 · 마스킹 · 부분 타임라인 등 도구 정의는 [AI 어시스턴트 도구](../CLE-WF/CLE-WF-ASSIST-TOOLS.md) 가 정한다 |

## 반응형

| 화면 폭 | 배치 |
| --- | --- |
| 1280px 이상 | 기본 배치 |
| 768px ~ 1279px | 노드 결과 2분할을 세로로 쌓는다 |
| 768px 미만 | 전체를 세로로 쌓고 테이블을 카드형 목록으로 바꾼다 |

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/**` (실행 목록·상세 화면)
- `codebase/frontend/src/lib/executions/can-rerun.ts` (재실행 버튼 활성 판정 `canReRun`)

## Rationale

### 건너뛴 노드를 상세 목록에서 뺀다 (EH-DETAIL-05)

분기(If/Else·Switch)로 실행되지 않은 노드에는 입출력·에러·소요 시간이 없어 진단 가치가 없다. 큰 워크플로우에서는 목록 대부분을 차지해 실패 노드를 찾기 어렵게 만든다. 이 화면은 "이 실행에서 실제로 무슨 일이 있었나" 를 보는 곳이라 실행된 노드만 남긴다. 어떤 노드가 왜 건너뛰어졌는지는 에디터 실행 결과(분기 표시)에서 본다.

### EH-DETAIL-06(단일 노드)과 EH-DETAIL-12(여러 노드, v2)를 나눈다

요구사항 EH-DETAIL-06 하나가 (a) 단일 AI 에이전트 노드의 미리보기 탭(구현 완료)과 (b) 여러 노드를 가로지르는 대화 스레드 재구성 보기(v2, 미구현)를 함께 가리켜, 요구사항 ID 로 상태를 판정하는 도구가 잘못 판단할 수 있었다. 대화 스레드 규약이 가리키던 "EH-DETAIL-06 의 재구성 정책" 도 실재하지 않았다. 그래서 여러 노드 재구성에 새 ID EH-DETAIL-12(v2)를 주고 EH-DETAIL-06 은 단일 노드 범위(구현됨)로 고정했다. 이 문서는 구현됨 상태를 유지한다. v2 항목 EH-DETAIL-12 는 [Clemvion 제품 개요](../CLE-VISION.md) 의 로드맵에서 추적한다. 여러 노드 재구성 보기의 모델은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 의 v2 로드맵에 있다.

### 재실행 버튼과 체인 표시의 설계 결정은 재실행 문서에 둔다

재실행 버튼과 체인 추적의 설계 결정은 [재실행](CLE-EXEC-RERUN.md) 의 Rationale 이 기준이다. 뷰어에게도 체인을 보이고 재실행 버튼만 막은 결정(2026-10-10)의 근거도 [재실행](CLE-EXEC-RERUN.md#체인-조회-권한은-실행-상세-조회와-같다-2026-10-10) 에 있다.
