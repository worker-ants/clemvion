---
id: "CLE-EXEC-RUN"
title: "에디터 실행과 디버깅"
type: "feature"
version: 5
status: "approved"
requirements: ["REQ-EXECRUN-001", "REQ-EXECRUN-002", "REQ-EXECRUN-003", "REQ-EXECRUN-004", "REQ-EXECRUN-005", "REQ-EXECRUN-006", "REQ-EXECRUN-007", "REQ-EXECRUN-008", "REQ-EXECRUN-009", "REQ-EXECRUN-010", "REQ-EXECRUN-011", "REQ-EXECRUN-012", "REQ-EXECRUN-013", "REQ-EXECRUN-014", "REQ-EXECRUN-015", "REQ-EXECRUN-016", "REQ-EXECRUN-017", "REQ-EXECRUN-018", "REQ-EXECRUN-019", "REQ-EXECRUN-020", "REQ-EXECRUN-021", "REQ-EXECRUN-022", "REQ-EXECRUN-023", "REQ-EXECRUN-024", "REQ-EXECRUN-025", "REQ-EXECRUN-026", "REQ-EXECRUN-027", "REQ-EXECRUN-028", "REQ-EXECRUN-029", "REQ-EXECRUN-030", "REQ-EXECRUN-031", "REQ-EXECRUN-032", "REQ-EXECRUN-033", "REQ-EXECRUN-034", "REQ-EXECRUN-035", "REQ-EXECRUN-036", "REQ-EXECRUN-037", "REQ-EXECRUN-038", "REQ-EXECRUN-039", "REQ-EXECRUN-040", "REQ-EXECRUN-041", "REQ-EXECRUN-042", "REQ-EXECRUN-043", "REQ-EXECRUN-044", "REQ-EXECRUN-045", "REQ-EXECRUN-046", "REQ-EXECRUN-047", "REQ-EXECRUN-048", "REQ-EXECRUN-049", "REQ-EXECRUN-050", "REQ-EXECRUN-051", "REQ-EXECRUN-052", "REQ-EXECRUN-053", "REQ-EXECRUN-054", "REQ-EXECRUN-055", "REQ-EXECRUN-056"]
basis_superseded: false
parent: "CLE-EXEC"
ancestors: ["CLE-VISION", "CLE-EXEC"]
area: "CLE-EXEC"
content_hash: "b02c3953634ce6c555ab71ed8e64598711cfe8f03f4b4691f4e67529714472ab"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/2-navigation/14-execution-history.md", "spec/3-workflow-editor/3-execution.md", "spec/3-workflow-editor/_product-overview.md"]
mirror_sha256: "28ca222f4d494e0d700aefcda31545f17ff7e27b92c7c646a307b22e47a34f00"
etag: "sha256-439c65420d01f0afa3e6989d6b16625e13103bf08834c356b8dc4940a8e809e4"
---
> 구현 상태: 구현됨 (브레이크포인트만 미구현 로드맵) · 원문: `spec/3-workflow-editor/3-execution.md`, `spec/3-workflow-editor/_product-overview.md` (§7 워크플로우 실행, §8 실행 디버깅), `spec/2-navigation/14-execution-history.md` (§3.4.1·§3.4.2 AI 탭 설명과 R-3) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 워크플로우 에디터 안에서 워크플로우를 실행하고 결과를 살펴보는 방법을 정한다. 실행 방식 세 가지(전체 실행·선택 노드부터 실행·단일 노드 실행), 테스트 입력(Mock Input)과 테스트 데이터셋(`WorkflowTestDataset`), 캔버스의 실행 표시, 실행 중지, 실행 결과 드로어(Run Results drawer), 에디터 안 실행 내역 패널, 재실행 진입점, Background 본문 결과 표시, 실시간 경로가 막혔을 때의 REST 폴링 대체 경로가 범위다.

범위 밖:

- 실행 이벤트와 명령의 필드·ack 형식은 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 이 정한다. 이 문서는 에디터가 어떤 이벤트에 어떻게 반응하는지만 적는다.
- 실행 상태와 전이, 입력 대기와 재개 계약은 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md), 실행 중지의 서버 쪽 관측 방식은 [노드 취소](CLE-EXEC-CANCEL.md) 가 정한다.
- 대화 미리보기의 출처별 시각 규칙·store 변환·UI 불변량은 [대화 미리보기](CLE-EXEC-PREVIEW.md), 노드 출력 필드가 화면마다 복원되는 방식은 [실행 화면 복원 규약](CLE-EXEC-HYDRATION.md) 이 정한다.
- 워크플로우별 실행 목록·실행 상세 화면과 API 는 [실행 내역](CLE-EXEC-HISTORY.md), 재실행 정책·모달·API 는 [재실행](CLE-EXEC-RERUN.md) 이 정한다.
- 에디터 전체 단축키 목록과 캔버스 컨텍스트 메뉴 구성은 [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md), 인터랙션 타입 값은 [인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md) 가 정한다.

## 요구사항

- REQ-EXECRUN-001 WHEN 사용자가 툴바의 실행 버튼을 누르면 THE SYSTEM SHALL 워크플로우 전체를 실행한다. (원본: ED-EX-01)
- REQ-EXECRUN-002 WHEN 사용자가 노드를 고르고 툴바 실행 드롭다운의 "선택된 노드부터 실행" 을 누르면 THE SYSTEM SHALL 그 노드부터 하류 끝까지 실행한다. (원본: ED-EX-02)
- REQ-EXECRUN-003 IF 고른 노드가 없으면 THE SYSTEM SHALL 실행 드롭다운의 "선택된 노드부터 실행" 항목을 비활성화한다.
- REQ-EXECRUN-004 WHEN 사용자가 노드 우클릭 메뉴의 "이 노드 실행" 을 누르면 THE SYSTEM SHALL 그 노드 하나만 실행하고 하류로 진행하지 않는다. (원본: ED-EX-03)
- REQ-EXECRUN-005 WHEN 단일 노드 실행 요청에 `previousExecutionId` 가 있으면 THE SYSTEM SHALL 그 실행의 직속 상류 노드 출력을 노드 출력 캐시에 복원해 대상 노드의 입력을 정상 실행과 같은 경로로 재구성한다.
- REQ-EXECRUN-006 IF 단일 노드 실행 요청에 `previousExecutionId` 가 없으면 THE SYSTEM SHALL 요청 본문의 `input` 을 대상 노드의 수동 입력으로 쓴다.
- REQ-EXECRUN-007 IF 단일 노드 실행의 대상 노드가 워크플로우에 없거나 `previousExecutionId` 가 다른 워크플로우의 실행이면 THE SYSTEM SHALL 400 으로 거부한다.
- REQ-EXECRUN-008 IF 단일 노드 실행의 대상이 비활성 노드면 THE SYSTEM SHALL 일반 실행과 같이 건너뛰고 빈 결과로 완료한다.
- REQ-EXECRUN-009 WHILE 실행이 진행되는 동안 THE SYSTEM SHALL 캔버스와 실행 결과 드로어에 노드별 상태를 실시간으로 표시한다. (원본: ED-EX-04)
- REQ-EXECRUN-010 WHEN 편집자 이상 사용자가 실행 상태 바의 중지 버튼을 누르면 THE SYSTEM SHALL 현재 노드가 끝난 뒤 실행을 멈추고 실행 상태를 `cancelled` 로 바꾼다. (원본: ED-EX-05)
- REQ-EXECRUN-011 IF 사용자가 뷰어면 THE SYSTEM SHALL 중지 버튼을 표시하지 않고 서버에서도 403 으로 거부한다.
- REQ-EXECRUN-012 WHEN 실행이 끝나면 THE SYSTEM SHALL 노드를 눌러 그 노드의 최근 입력·출력 데이터를 확인할 수 있게 한다. (원본: ED-EX-06, ED-DB-01)
- REQ-EXECRUN-013 WHEN 사용자가 에디터 더보기(⋮) 메뉴의 "실행 히스토리" 를 누르면 THE SYSTEM SHALL 최근 실행 20건을 시작 시각 내림차순으로 나열한 실행 내역 패널을 연다. (원본: ED-EX-07)
- REQ-EXECRUN-014 WHEN 사용자가 실행 내역 패널의 항목을 누르면 THE SYSTEM SHALL 그 실행의 노드 결과로 실행 결과 드로어와 캔버스 상태 표시를 채운다.
- REQ-EXECRUN-015 WHEN 사용자가 "입력과 함께 실행" 을 고르면 THE SYSTEM SHALL 테스트 입력 JSON 을 편집하는 대화상자를 연다. (원본: ED-EX-08)
- REQ-EXECRUN-016 WHILE 테스트 입력이 유효한 JSON 이 아닌 동안 THE SYSTEM SHALL 인라인 오류를 표시하고 실행 버튼을 비활성화한다.
- REQ-EXECRUN-017 IF 테스트 입력의 값 자리에 마스킹 마커(`***`, `[REDACTED]`, `[REDACTED_DEPTH]`)와 정확히 같은 값이 있으면 THE SYSTEM SHALL 에디터에서 실행을 막고 서버에서 `400` 과 `details[].code = MASKED_VALUE_RESUBMITTED` 로 거부한다.
- REQ-EXECRUN-018 WHEN 사용자가 "히스토리에서 불러오기" 로 이전 실행을 고르면 THE SYSTEM SHALL 그 실행의 `inputData` 를 입력란에 채운다.
- REQ-EXECRUN-019 WHEN 사용자가 테스트 입력을 데이터셋으로 저장하면 THE SYSTEM SHALL 공개 범위를 기본 `private` 로 두고 소유자만 조회·수정·삭제하게 한다.
- REQ-EXECRUN-020 WHEN 소유자가 데이터셋을 `workspace` 로 공유하면 THE SYSTEM SHALL 같은 워크스페이스 멤버에게 그 데이터셋을 읽기 전용으로 보여 준다.
- REQ-EXECRUN-021 WHEN 멤버가 조회할 수 있는 데이터셋을 복제하면 THE SYSTEM SHALL 그 멤버 소유의 `private` 사본을 만든다.
- REQ-EXECRUN-022 IF 한 사용자가 같은 워크플로우에 같은 이름의 데이터셋을 저장하거나 복제하면 THE SYSTEM SHALL 409 `DUPLICATE_NAME` 으로 거부한다.
- REQ-EXECRUN-023 IF 소유자가 아닌 사용자가 데이터셋을 수정하거나 삭제하면 THE SYSTEM SHALL 403 으로 거부한다.
- REQ-EXECRUN-024 WHEN AI 에이전트 노드가 멀티턴 입력 대기에 들어가면 THE SYSTEM SHALL 실행 결과 드로어를 펼치고 그 노드를 골라 메시지 입력란을 표시한다. (원본: ED-EX-09)
- REQ-EXECRUN-025 WHILE 멀티턴 대화가 진행되는 동안 THE SYSTEM SHALL 실행 트리에 사용자 메시지·AI 응답·도구 호출을 미리보기 카드로 표시한다. (원본: ED-EX-10)
- REQ-EXECRUN-026 WHEN 사용자가 멀티턴 대화가 끝난 실행을 다시 열면 THE SYSTEM SHALL 전체 대화 기록을 다시 보여 준다. (원본: ED-EX-11)
- REQ-EXECRUN-027 WHEN 사용자가 completed·failed·cancelled·waiting_for_input 상태의 노드를 고르면 THE SYSTEM SHALL 미리보기·입력·출력·설정·오류 결과 상세 탭을 표시하고 AI 노드에는 LLM 사용량 탭을 더한다. (원본: ED-EX-12)
- REQ-EXECRUN-028 WHEN 사용자가 실행 트리에서 노드를 고르면 THE SYSTEM SHALL 오류, 미리보기, 출력 순서로 기본 탭을 고른다. (원본: ED-EX-13)
- REQ-EXECRUN-029 IF 멀티턴 AI 노드가 대화 출력(`output.result.messages`)을 남기고 오류로 끝났으면 THE SYSTEM SHALL retryable 여부와 상관없이 미리보기 탭을 기본 탭으로 고른다. (원본: ED-EX-13)
- REQ-EXECRUN-030 WHEN 사용자가 멀티턴 타임라인에서 assistant 메시지를 고르면 THE SYSTEM SHALL 탭 구성을 미리보기·응답·요청·LLM 사용량으로 바꾼다. (원본: ED-EX-14)
- REQ-EXECRUN-031 IF 한 턴에 LLM 호출이 여러 개면 THE SYSTEM SHALL 호출 선택기를 표시하고 응답·요청·LLM 사용량 탭 사이를 오가도 고른 호출을 유지한다. (원본: ED-EX-14)
- REQ-EXECRUN-032 IF 고른 탭이 선택 변경으로 사라지면 THE SYSTEM SHALL 미리보기 탭이나 남은 첫 탭으로 바꾼다.
- REQ-EXECRUN-033 IF 노드 실행이 실패하면 THE SYSTEM SHALL 캔버스에서 실패 노드를 빨간색으로 강조하고 에러 메시지를 표시한다. (원본: ED-DB-02)
- REQ-EXECRUN-034 WHEN 실행이 진행되거나 끝나면 THE SYSTEM SHALL 실행된 노드·연결선과 선택된 분기를 강조하고 실행되지 않은 경로를 흐리게 표시한다. (원본: ED-DB-03)
- REQ-EXECRUN-035 WHEN 노드 실행이 끝나면 THE SYSTEM SHALL 캔버스 노드와 실행 트리 항목에 실행 시간을 표시한다. (원본: ED-DB-04)
- REQ-EXECRUN-036 WHEN 사용자가 노드에 브레이크포인트를 설정하면 THE SYSTEM SHALL 그 노드 실행 직전에 실행을 일시 정지한다. (원본: ED-DB-05) (미구현)
- REQ-EXECRUN-037 WHEN 컨테이너 본문 노드가 여러 반복 회차에서 실행되면 THE SYSTEM SHALL 회차마다 실행 트리 항목을 따로 만들고 라벨에 `(iter N)` 을 붙인다.
- REQ-EXECRUN-038 WHEN 블로킹 노드가 입력 대기에 들어가면 THE SYSTEM SHALL 드로어에서 그 노드를 자동으로 고르고 미리보기 탭에 입력 UI 를 표시한다.
- REQ-EXECRUN-039 WHEN 사용자가 입력 대기 중인 Form 노드의 폼을 제출하면 THE SYSTEM SHALL `execution.submit_form` 명령을 보내고 실행이 재개되면 상태 바를 실행 중으로 바꾼다.
- REQ-EXECRUN-040 WHEN 사용자가 버튼 대기 노드의 port 버튼을 누르면 THE SYSTEM SHALL `execution.click_button` 명령을 보내 그 포트로 실행을 재개한다.
- REQ-EXECRUN-041 WHEN 사용자가 버튼 대기 노드의 link 버튼을 누르면 THE SYSTEM SHALL 새 탭에서 URL 을 열고 실행 상태를 바꾸지 않는다.
- REQ-EXECRUN-042 IF 대화 스레드의 마지막 항목이 `retryable === true` 인 `system_error` 면 THE SYSTEM SHALL 메시지 입력란 자리에 [다시 시도] 버튼과 `retryAfterSec` 카운트다운을 표시한다.
- REQ-EXECRUN-043 WHEN 사용자가 [다시 시도] 를 누르면 THE SYSTEM SHALL `execution.retry_last_turn` 명령을 보내고 노드 상태를 `running` 으로 바꾼다. WebSocket 이벤트로 `system_error` 를 받은 뒤 REST 폴링 대체 경로로 넘어간 경우에는 노드 상태가 `failed` 에 머문다(REQ-EXECRUN-056).
- REQ-EXECRUN-044 WHEN 새 실행이 시작되면 THE SYSTEM SHALL 이전 실행 트리와 대화 스냅샷을 비운다.
- REQ-EXECRUN-045 WHEN 실행이 완료되거나 실패하면 THE SYSTEM SHALL 드로어와 대화 스냅샷을 그대로 유지한다.
- REQ-EXECRUN-046 WHEN 사용자가 드로어의 닫기 버튼을 누르면 THE SYSTEM SHALL 드로어를 숨기고 실행 상태를 초기화한다.
- REQ-EXECRUN-047 IF 사용자에게 재실행 권한이 없으면 THE SYSTEM SHALL 드로어의 재실행 버튼을 숨긴다.
- REQ-EXECRUN-048 WHEN 재실행 모달이 새 실행 ID 를 받으면 THE SYSTEM SHALL 드로어를 초기화하고 현재 에디터에서 새 실행을 추적한다.
- REQ-EXECRUN-049 WHEN Background 노드 카드가 처음 표시되면 THE SYSTEM SHALL `background:run:<backgroundRunId>` 채널을 구독한다.
- REQ-EXECRUN-050 WHEN `execution.background_run.completed` 를 받으면 THE SYSTEM SHALL 카드 배지를 최종 상태로 바꾸고 그 채널 구독을 해제한다.
- REQ-EXECRUN-051 IF Background 본문 노드가 50개를 넘으면 THE SYSTEM SHALL "Load more" 버튼을 표시하고 누르면 다음 페이지를 이어 붙인다.
- REQ-EXECRUN-052 WHEN 사용자가 Ctrl+Shift+R 을 누르면 THE SYSTEM SHALL 드로어 펼침을 토글하고 브라우저 강력 새로고침을 막는다.
- REQ-EXECRUN-053 WHEN 드로어에 포커스가 있을 때 사용자가 Escape 를 누르면 THE SYSTEM SHALL 포커스를 캔버스로 돌린다.
- REQ-EXECRUN-054 IF Escape 를 누를 때 드로어 안 편집 가능한 필드에 포커스가 있으면 THE SYSTEM SHALL 그 필드가 Escape 를 처리하게 둔다.
- REQ-EXECRUN-055 WHEN 에디터에서 실행 구독 채널(`execution:{executionId}`) 구독이 실패하거나 구독 뒤 10초 동안 그 실행의 `execution.snapshot` 이나 실행 이벤트가 하나도 오지 않으면 THE SYSTEM SHALL 그 시점부터 `GET /api/executions/:id` 를 2초 간격으로 받아 캔버스 노드 상태와 실행 결과 드로어를 채운다.
- REQ-EXECRUN-056 WHEN REST 폴링 대체 경로가 켜진 뒤 그 실행의 `execution.snapshot` 이나 실행 이벤트가 다시 오거나 실행이 종결 상태가 되면 THE SYSTEM SHALL 폴링을 멈추고 멈춘 뒤 도착한 응답을 반영하지 않는다. 마지막 턴 재시도로 `failed` 에서 다시 `running` 이 되는 실행은 따라가지 못한다([노드 결과 수집](#노드-결과-수집) 의 「따라가지 못하는 경우」, NERV Task `CLE-T-GKVH1B`).

## 하위 문서

- [에디터 실행과 디버깅 — 실행 시작·중지와 캔버스 표시](CLE-EXEC-RUN-START.md): 실행 방식 세 가지, 테스트 입력과 테스트 데이터셋, 캔버스 실행 표시, 실행 중지, 노드 결과 조회, API, 브레이크포인트 로드맵. 요구사항 REQ-EXECRUN-001~012, REQ-EXECRUN-015~023, REQ-EXECRUN-033~036.
- [에디터 실행과 디버깅 — 실행 결과 드로어](CLE-EXEC-RUN-DRAWER.md): 드로어 레이아웃·헤더·실행 트리·결과 상세 탭·라이프사이클·단축키. 요구사항 REQ-EXECRUN-024~032, REQ-EXECRUN-037~046, REQ-EXECRUN-052~054.
- [에디터 실행과 디버깅 — 실시간 수신·내역·Background](CLE-EXEC-RUN-SYNC.md): 노드 결과 수집과 REST 폴링 대체 경로, 실행 이벤트와 명령, 에디터 안 실행 내역 패널, 재실행 진입점, Background 본문 결과. 요구사항 REQ-EXECRUN-013~014, REQ-EXECRUN-047~051, REQ-EXECRUN-055~056.

## 노드 결과 수집

→ [노드 결과 수집](CLE-EXEC-RUN-SYNC.md#노드-결과-수집)

## Background 본문 결과

→ [Background 본문 결과](CLE-EXEC-RUN-SYNC.md#background-본문-결과)

## 미결 사항

- **Ctrl+Enter 전체 실행 단축키**: 옛 에디터 실행 문서는 실행 버튼과 함께 Ctrl+Enter 로 전체 실행한다고 적는다. 에디터 전역 단축키 목록([워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md))에는 Ctrl+Enter 가 없다. 현재 구현(`workflow-editor.tsx`, `editor-toolbar.tsx`)에도 바인딩이 없다. 단축키를 만들지 서술을 지울지 정해야 한다.
- **중지 버튼 3초 누르기 강제 중단(Force)**: 옛 에디터 실행 문서는 중지 버튼을 3초 이상 누르면 진행 중인 노드를 즉시 중단한다고 적는다. [노드 취소](CLE-EXEC-CANCEL.md) 와 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 는 사용자 중지가 `AbortController` 를 만들지 않고 실행 행만 갱신하며 진행 중 노드는 다음 노드·턴 경계에서 알아챈다고 정한다. force 경로는 정의돼 있지 않다. WebSocket 의 `force` 옵션은 채택하지 않은 `execution.stop` 명령에만 있고([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)), [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 도 `force` 를 지원하지 않는다. 현재 구현(`editor-toolbar.tsx`, `executions.controller.ts`)에도 길게 누르기와 force 경로가 없다. 강제 중단을 만들지(만든다면 REST stop 의 force 계약과 취소 규약의 생산자 추가가 필요하다) 서술을 지울지 정해야 한다.
- **Table 최대 표시 행 수**: 옛 에디터 실행 문서는 드로어의 Table 을 "최대 50행 표시" 라고 적는다. [Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) 은 같은 드로어 Table 에 "페이지네이션 강제(최대 200행/페이지)" 를 적는다. 현재 구현(`presentation-renderers.tsx`)은 앞 50행만 렌더한다. 어느 쪽을 규칙으로 둘지 결정이 필요하다.
- **드로어 재실행 버튼의 표시 상태**: 옛 에디터 실행 문서는 드로어의 재실행 버튼을 "completed·failed·cancelled·waiting_for_input 종료" 상태에서 보인다고 적으면서, 같은 표에서 진행 중 멀티턴(입력 대기 상태)은 숨긴다고 적는다. `waiting_for_input` 은 엔진에서 종결 상태가 아니다([실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md)). [재실행](CLE-EXEC-RERUN.md) 은 재실행할 수 있는 원본 상태를 제한하지 않는다. 현재 구현(`run-results-drawer.tsx`)은 store 상태가 `completed`·`failed` 일 때만 버튼을 보인다. 드로어에서 버튼을 보일 상태 집합을 결정해야 한다.
- **컨테이너 안 Presentation 노드의 반복 표시**: 옛 에디터 실행 문서 §10.5 는 컨테이너 본문 노드의 반복 회차마다 실행 트리 항목을 따로 만들고 라벨에 `(iter N)` 을 붙인다고 적는다. 같은 문서 §10.9 는 Loop·ForEach 안 Presentation 노드를 `"Table (Iteration 3/5)"` 처럼 표시하고 기본으로 마지막 회차 결과를 보이며 이전 회차는 결과 상세의 반복 드롭다운으로 탐색한다고 적는다. 현재 구현(`timeline-tree.ts`, `result-timeline.tsx`)은 Presentation 노드도 §10.5 방식으로 `(iter N)` 항목을 따로 만들고 반복 드롭다운은 없다. §10.9 를 Presentation 노드 예외로 구현할지, §10.9 서술을 지울지 결정이 필요하다.
- **`subscribed` 실패 응답의 `channel` 필드**: [WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md) 의 `subscribed` 실패 응답에는 `channel` 이 없어 에디터는 어느 구독이 실패했는지 가리지 못한다([노드 결과 수집](CLE-EXEC-RUN-SYNC.md#노드-결과-수집) 의 「바로 켜는 경우」). 실패 응답에 `channel` 을 더할지는 NERV Task `CLE-T-7MBBA7` 에서 정한다.
- **교차 출처 배포의 `Retry-After`**: 프런트엔드가 API 를 다른 출처로 부르는 배포에서는 백엔드 CORS 가 `Retry-After` 를 노출하지 않는다. 그래서 브라우저가 이 헤더를 숨기고, [노드 결과 수집](CLE-EXEC-RUN-SYNC.md#노드-결과-수집) 의 REST 폴링 대체 경로는 429 에도 늘리는 간격으로 대신한다. 헤더를 노출할지는 NERV Task `CLE-T-1XDNY3` 에서 정한다.

## 구현 위치

- `codebase/frontend/src/components/editor/run-results/*.tsx` (실행 결과 드로어, 실행 트리, 결과 상세 탭, 실행 내역 패널)
- `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (실행 버튼, 테스트 입력 대화상자, 중지)
- `codebase/frontend/src/components/editor/workflow-editor.tsx` (드로어 단축키, 실행 이벤트 구독과 폴링 대체 경로 연결)
- `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (노드 컨텍스트 메뉴 "이 노드 실행")
- `codebase/frontend/src/lib/websocket/use-execution-events.ts` (실행 이벤트 구독, 실시간 경로가 막혀 REST 폴링이 필요하다는 신호 `needsRestPolling`)
- `codebase/frontend/src/lib/websocket/use-execution-polling-fallback.ts` (REST 폴링 대체 경로)
- `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` (실행 스냅샷 이벤트 · REST 응답 공용 store 채우기)
- `codebase/backend/src/modules/websocket/websocket.gateway.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts`
- `codebase/backend/src/modules/websocket/websocket-events.types.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (실행, 단일 노드 실행)
- `codebase/backend/src/modules/executions/executions.controller.ts` (continue, stop)
- `codebase/backend/src/modules/workflow-test-datasets/**`
- `codebase/frontend/src/lib/api/workflow-test-datasets.ts`
