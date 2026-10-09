---
id: "CLE-WF-NODEPANEL"
title: "노드 포트와 설정 패널"
type: "feature"
version: 1
status: "approved"
requirements: ["REQ-NODEUI-001", "REQ-NODEUI-002", "REQ-NODEUI-003", "REQ-NODEUI-004", "REQ-NODEUI-005", "REQ-NODEUI-006", "REQ-NODEUI-007", "REQ-NODEUI-008", "REQ-NODEUI-009", "REQ-NODEUI-010", "REQ-NODEUI-011", "REQ-NODEUI-012", "REQ-NODEUI-013", "REQ-NODEUI-014", "REQ-NODEUI-015", "REQ-NODEUI-016", "REQ-NODEUI-017", "REQ-NODEUI-018", "REQ-NODEUI-019", "REQ-NODEUI-020", "REQ-NODEUI-021", "REQ-NODEUI-022", "REQ-NODEUI-023", "REQ-NODEUI-024", "REQ-NODEUI-025", "REQ-NODEUI-026", "REQ-NODEUI-027", "REQ-NODEUI-028", "REQ-NODEUI-029", "REQ-NODEUI-030", "REQ-NODEUI-031", "REQ-NODEUI-032", "REQ-NODEUI-033", "REQ-NODEUI-034", "REQ-NODEUI-035", "REQ-NODEUI-036", "REQ-NODEUI-037", "REQ-NODEUI-038", "REQ-NODEUI-039", "REQ-NODEUI-040", "REQ-NODEUI-041"]
basis_superseded: false
parent: "CLE-WF"
ancestors: ["CLE-VISION", "CLE-WF"]
area: "CLE-WF"
content_hash: "c03aa1f18f1abbeec038dd967364a234d53ee74b953918c04ba7190044fdf166"
read_as: "approved_fallback"
task: "CLE-T-V0JAG1"
source_paths: ["spec/3-workflow-editor/1-node-common.md", "spec/3-workflow-editor/_product-overview.md"]
mirror_sha256: "3541f87bf97c8cdaab3ef9ba60fe8c72d3bdb918c4bb954d418853f0a84bfe7c"
etag: "sha256-19e0663968c2587bcc198c95fa66ce21e13dbeadec8ebd81a01d38d6c8dfe381"
---
> 구현 상태: 구현됨 · 원문: `spec/3-workflow-editor/1-node-common.md`, `spec/3-workflow-editor/_product-overview.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 모든 노드가 함께 쓰는 에디터 쪽 규칙을 정한다. 노드의 입력·출력 포트(Port, `source_port`·`target_port`) 체계, 노드를 고르면 오른쪽에 열리는 설정 패널(Settings Panel, `node-settings-panel`), 스키마로 설정 폼을 그리는 auto-form(`SchemaForm`, `UiHint`), 노드 사이 데이터 전달 규칙을 다룬다.

포트 ID 와 노드별 포트 구성은 각 노드 문서가 정한다. 이 문서는 포트 체계의 공통 규칙만 두고 노드별 포트는 [노드별 포트 문서](#노드별-포트-문서) 표로 각 노드 문서를 가리킨다. 포트 정의 속성(`PortDef`)과 동적 포트 ID 생성 방식은 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 가 정한다.

범위 밖:

- 캔버스 위 노드 모양, 설정 요약, 미설정 경고는 [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md) 가 정한다.
- 연결선의 생성·유효성·색은 [연결선](CLE-WF-EDGE.md) 이 정한다.
- 설정 필드 안의 `{{ }}` 표현식 문법·자동완성·검증은 [표현식 언어](CLE-WF-EXPR.md) 가 정한다.
- 에러 처리 정책이 실행될 때의 동작(재시도 백오프, 에러 포트 폴백, 노드 실행 상태)은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 이 정한다.
- 노드 출력의 다섯 필드와 `.config`·`.output` 구분은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다.

## 요구사항

- REQ-NODEUI-001 WHEN 사용자가 노드를 고르면 THE SYSTEM SHALL 오른쪽에 설정 패널을 연다. (원본: ED-SP-01)
- REQ-NODEUI-002 WHILE 설정 패널이 열려 있는 동안 THE SYSTEM SHALL 노드 유형에 맞는 고유 설정 필드를 보여 준다. (원본: ED-SP-02)
- REQ-NODEUI-003 WHEN 사용자가 Settings 탭의 `변경 저장` 이나 Code 탭의 `JSON 적용` 을 누르면 THE SYSTEM SHALL 설정 변경을 에디터 상태(캔버스)에 반영한다. (원본: ED-SP-05)
- REQ-NODEUI-004 IF 사용자가 설정을 반영하지 않고 다른 노드로 옮기면 THE SYSTEM SHALL 반영하지 않은 편집을 버린다. (원본: ED-SP-05)
- REQ-NODEUI-005 WHEN 사용자가 Code 탭을 고르면 THE SYSTEM SHALL 노드 설정을 JSON 으로 직접 고칠 수 있게 한다. (원본: ED-SP-06)
- REQ-NODEUI-006 WHEN 사용자가 설정 패널의 Name 필드를 고치면 THE SYSTEM SHALL 노드 레이블을 바꾼다. (원본: ED-SP-07)
- REQ-NODEUI-007 WHEN 사용자가 Notes 필드에 입력하면 THE SYSTEM SHALL 노드 메모로 저장한다. (원본: ED-SP-08)
- REQ-NODEUI-008 WHILE 노드를 그리는 동안 THE SYSTEM SHALL 입력 포트를 왼쪽에, 출력 포트를 오른쪽에 둔다.
- REQ-NODEUI-009 WHEN 입력 포트 하나에 연결선이 여러 개 들어오면 THE SYSTEM SHALL 모두 받는다.
- REQ-NODEUI-010 WHEN 출력 포트 하나에서 연결선이 여러 개 나가면 THE SYSTEM SHALL 같은 데이터를 복제해 각 대상에 전달한다.
- REQ-NODEUI-011 WHILE 노드에 출력 포트가 여럿인 동안 THE SYSTEM SHALL 포트마다 라벨을 표시한다.
- REQ-NODEUI-012 WHEN 노드의 에러 처리 정책을 "에러 포트로 라우팅" 으로 고르면 THE SYSTEM SHALL 노드 오른쪽 아래에 빨간 동적 에러 포트를 만든다.
- REQ-NODEUI-013 WHILE 포트를 그리는 동안 THE SYSTEM SHALL 데이터 포트는 초록, 시스템 포트는 파랑, 에러 포트는 빨강, 컨테이너 `emit` 포트는 보라로 표시한다.
- REQ-NODEUI-014 WHILE 사용자 조건 포트와 시스템 포트가 함께 있는 동안 THE SYSTEM SHALL 둘 사이에 점선 구분자를 표시한다.
- REQ-NODEUI-015 WHILE 노드에 입력 포트가 여럿인 동안 THE SYSTEM SHALL 포트 옆에 라벨을 표시한다.
- REQ-NODEUI-016 WHEN 사용자가 출력 포트를 끌면 THE SYSTEM SHALL 임시 연결선을 그리고 유효한 입력 포트는 초록, 유효하지 않은 대상은 빨강으로 표시한다.
- REQ-NODEUI-017 WHEN 사용자가 포트에서 끈 연결선을 빈 영역에 놓으면 THE SYSTEM SHALL 노드 검색 팝업을 열고 고른 노드를 만들어 연결한다.
- REQ-NODEUI-018 WHEN 동적 포트를 추가하면 THE SYSTEM SHALL `^[a-zA-Z0-9_-]{1,64}$` 형식에 맞는 바뀌지 않는 포트 ID 를 부여한다.
- REQ-NODEUI-019 WHEN 포트 이름을 바꾸거나 순서를 바꾸거나 다른 포트를 지우면 THE SYSTEM SHALL 기존 포트 ID 와 거기 붙은 연결선을 그대로 둔다.
- REQ-NODEUI-020 WHEN 동적 포트를 지우면 THE SYSTEM SHALL 그 포트에 붙은 연결선도 함께 지운다.
- REQ-NODEUI-021 WHEN 사용자가 필드 도움말 아이콘을 누르면 THE SYSTEM SHALL Popover 로 설명과 사용자 가이드 링크를 보여 준다.
- REQ-NODEUI-022 WHEN 사용자가 필드 도움말의 사용자 가이드 링크를 누르면 THE SYSTEM SHALL 새 탭(`target="_blank"`, `rel="noopener"`)으로 연다.
- REQ-NODEUI-023 WHILE 에러 처리 정책이 기본값인 동안 THE SYSTEM SHALL 워크플로우 중단(`stop_workflow`)을 적용한다.
- REQ-NODEUI-024 WHEN 사용자가 노드 재시도를 고르면 THE SYSTEM SHALL `maxRetries` 와 `retryInterval` 입력 필드를 보여 준다.
- REQ-NODEUI-025 WHEN 설정 패널이 에러 처리 정책을 저장하면 THE SYSTEM SHALL 중첩 객체 `config.errorHandling` 형태로 저장한다.
- REQ-NODEUI-026 WHEN 사용자가 기본 출력 사용을 고르면 THE SYSTEM SHALL JSON 에디터와 "Reset to Default" 버튼을 보여 준다.
- REQ-NODEUI-027 IF 기본 출력 JSON 을 파싱하지 못하면 THE SYSTEM SHALL 저장을 막고 인라인 에러를 표시한다.
- REQ-NODEUI-028 IF 기본 출력 에디터를 비우고 저장하면 THE SYSTEM SHALL `defaultOutput` 을 `null` 로 저장한다.
- REQ-NODEUI-029 WHEN 사용자가 "Reset to Default" 를 누르면 THE SYSTEM SHALL 에디터를 빈 객체 `{}` 로 초기화한다.
- REQ-NODEUI-030 IF 기본 출력이 설정되지 않은 노드에서 에러가 나면 THE SYSTEM SHALL 출력 타입에 맞는 기본값을 추론해 쓴다. (미구현)
- REQ-NODEUI-031 WHEN 기본 출력 사용 정책으로 에러를 대신 처리하면 THE SYSTEM SHALL 캔버스의 그 노드에 ⚠️ 아이콘을 표시한다.
- REQ-NODEUI-032 IF 노드가 `OVERRIDE_REGISTRY` 에 등록돼 있으면 THE SYSTEM SHALL 수작업 폼 컴포넌트로 Settings 탭을 그린다.
- REQ-NODEUI-033 IF 노드가 `OVERRIDE_REGISTRY` 에 없으면 THE SYSTEM SHALL 백엔드 zod 스키마의 UI 힌트로 auto-form 을 그린다.
- REQ-NODEUI-034 WHEN auto-form 필드에 `visibleWhen` 조건이 있으면 THE SYSTEM SHALL 조건이 맞을 때만 그 필드를 보여 준다.
- REQ-NODEUI-035 WHEN `clearFields` 가 있는 필드의 값이 바뀌면 THE SYSTEM SHALL 목록의 설정 키를 함께 비운다.
- REQ-NODEUI-036 IF `clearFields` 에 예약 키(`__proto__` 등)가 있으면 THE SYSTEM SHALL 그 키를 비우지 않는다.
- REQ-NODEUI-037 IF 노드 스키마가 auto-form 이 그릴 수 없는 위젯(`integration-selector`, `condition-builder`, `table-grid`)을 쓰면 THE SYSTEM SHALL 그 노드를 수작업 폼 트랙에 둔다.
- REQ-NODEUI-038 WHEN 조건 노드(If/Else, Switch 등)가 출력 포트를 고르면 THE SYSTEM SHALL 고른 포트로만 데이터를 전달한다.
- REQ-NODEUI-039 WHEN 여러 입력이 한 노드에 모이면 THE SYSTEM SHALL Merge 노드의 전략에 따라 처리한다.
- REQ-NODEUI-040 WHEN 에러 포트로 라우팅하는 노드에서 에러가 나면 THE SYSTEM SHALL 에러 데이터를 `error` 포트로 보내 연결된 다음 노드가 입력으로 실행하게 한다.
- REQ-NODEUI-041 WHEN 설정 패널이 ForEach · Map · Parallel 노드를 불러오거나 저장하면 THE SYSTEM SHALL `config.errorPolicy` 를 에러 처리 정책으로 옮기지 않고 지우지도 않는다.

## 포트 체계

### 입력 포트

| 속성 | 설명 |
| --- | --- |
| 위치 | 노드 왼쪽 |
| 기본 개수 | 1개. 컨테이너(Loop·ForEach·Map)는 `in` 과 `emit` 두 개다. |
| 식별자 | 기본 이름은 `in` 이다. |
| 다중 연결 | 입력 포트 하나에 연결선을 여러 개 연결할 수 있다. [Merge 노드](../CLE-NODE-LOGIC/CLE-NODE-MERGE.md) 도 입력 포트 `in` 하나에 여러 연결선을 받는다. |

### 출력 포트

| 속성 | 설명 |
| --- | --- |
| 위치 | 노드 오른쪽 |
| 기본 개수 | 1개. 분기 노드는 여럿이다. |
| 식별자 | 노드 유형마다 다르다. [노드별 포트 문서](#노드별-포트-문서) 참조 |
| 다중 연결 | 출력 포트 하나에서 연결선을 여러 개 낼 수 있다. 데이터는 복제해서 보낸다. |
| 라벨 | 포트마다 이름을 붙인다. 예: "True", "False", "Case 1" |

### 포트 종류와 색

| 종류 | 색 | 설명 |
| --- | --- | --- |
| 데이터 포트 | 초록(●) | 일반 데이터를 내보내는 포트 |
| 시스템 포트(system port) | 파랑(●) | 노드가 미리 정한 고정 제어 출력 포트. 예: AI 에이전트 노드의 `user_ended`·`max_turns`·`out`, 컨테이너의 `done` |
| 에러 포트(error port, `error`) | 빨강(●) | 런타임 에러를 내보내는 출력 포트. 노드에 원래 있는 **고정 에러 포트**와, 에러 처리 정책이 "에러 포트로 라우팅" 일 때 생기는 **동적 에러 포트**가 있다. 동적 에러 포트는 노드 오른쪽 아래에 빨간 원으로 그린다. |
| 컨테이너 `emit` 포트 | 보라(●) | Loop·ForEach·Map 의 본문 결과를 모으는 입력 포트. 헤드 라벨도 보라다. |

- 사용자 조건 포트와 시스템 포트 사이에는 점선 구분자를 둔다.
- 입력 포트가 여럿이면(예: 컨테이너의 `Input`·`Emit`) 포트 옆에 라벨을 붙여 구분한다.
- 연결선 색은 출발 포트 종류를 따른다. 규칙은 [연결선](CLE-WF-EDGE.md) 이 정한다.
- 시스템 포트의 코드 식별자는 층마다 다르다. [미결 사항](#미결-사항) 참조.

### 노드별 포트 문서

노드별 포트 ID·개수·종류는 각 노드 문서의 포트 절이 정하고 노드 스키마와 함께 바뀐다. 포트 ID 는 연결선의 `source_port`·`target_port` 값이므로 아래 문서를 기준으로 쓴다.

| 노드 | 포트 정의 문서 | 비고 |
| --- | --- | --- |
| 수동 트리거 노드 | [수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md) | 입력 포트 없음 |
| If/Else | [If/Else 노드](../CLE-NODE-LOGIC/CLE-NODE-IFELSE.md) | |
| Switch | [Switch 노드](../CLE-NODE-LOGIC/CLE-NODE-SWITCH.md) | 케이스마다 동적 포트 |
| Loop | [Loop 노드](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md) | 컨테이너 포트(`body`·`emit`·`done`) |
| 변수 선언 | [변수 선언 노드](../CLE-NODE-LOGIC/CLE-NODE-VARDECL.md) | |
| 변수 수정 | [변수 수정 노드](../CLE-NODE-LOGIC/CLE-NODE-VARSET.md) | |
| Split | [Split 노드](../CLE-NODE-LOGIC/CLE-NODE-SPLIT.md) | |
| Map | [Map 노드](../CLE-NODE-LOGIC/CLE-NODE-MAP.md) | 컨테이너 포트(`body`·`emit`·`done`) |
| Filter | [Filter 노드](../CLE-NODE-LOGIC/CLE-NODE-FILTER.md) | |
| ForEach | [ForEach 노드](../CLE-NODE-LOGIC/CLE-NODE-FOREACH.md) | 컨테이너 포트(`body`·`emit`·`done`) |
| Parallel | [Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md) | 병렬 분기마다 동적 포트 |
| Merge | [Merge 노드](../CLE-NODE-LOGIC/CLE-NODE-MERGE.md) | 입력 포트 하나에 여러 연결선 |
| Background | [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) | 컨테이너가 아니다. `background` 포트로 본문을 가리킨다. |
| 워크플로우 호출 노드 | [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) | |
| AI 에이전트 노드 | [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) | 조건마다 동적 포트, 모드별 시스템 포트 |
| 텍스트 분류기 노드 | [텍스트 분류기 노드](../CLE-NODE-AI/CLE-NODE-CLASSIFIER.md) | 카테고리마다 동적 포트 |
| 정보 추출기 노드 | [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) | 모드별 시스템 포트 |
| HTTP Request | [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md) | |
| Database Query | [Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) | |
| Send Email | [Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md) | |
| Cafe24 | [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) | |
| MakeShop | [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) | |
| Transform | [Transform 노드](../CLE-NODE-DATA/CLE-NODE-TRANSFORM.md) | |
| Code | [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) | |
| Carousel·Table·Chart·Template | [Carousel 노드](../CLE-NODE-PRES/CLE-NODE-CAROUSEL.md), [Table 노드](../CLE-NODE-PRES/CLE-NODE-TABLE.md), [Chart 노드](../CLE-NODE-PRES/CLE-NODE-CHART.md), [Template 노드](../CLE-NODE-PRES/CLE-NODE-TEMPLATE.md) | 버튼마다 동적 포트. 공통 규칙은 [Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| Form | [Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md) | |

에러 포트를 원래 가진 노드와 에러 분류 원칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다.

### 포트 인터랙션

| 인터랙션 | 설명 |
| --- | --- |
| 마우스 올림 | 포트를 키우고 연결할 수 있음을 표시한다. |
| 드래그 시작 | 출력 포트에서 끌기 시작하면 임시 연결선을 그린다. |
| 드래그 중(유효) | 유효한 입력 포트 위에서 초록으로 강조한다. |
| 드래그 중(무효) | 유효하지 않은 대상 위에서 빨강 차단 표시를 한다. |
| 놓기 | 유효한 입력 포트에 놓으면 연결선을 만든다. |
| 빈 영역에 놓기 | 노드 검색 팝업을 열고, 고르면 노드를 만들어 연결선까지 잇는다. 자세한 규칙은 [연결선](CLE-WF-EDGE.md) 에 있다. |

### 동적 포트 ID 규칙

동적 포트(dynamic ports)는 Switch 케이스, Parallel 병렬 분기, 텍스트 분류기 카테고리, AI 에이전트 조건, Presentation 버튼처럼 설정 항목마다 생기는 포트다. 동적 포트의 포트 ID(stable port id)는 아래 규칙을 따른다.

| 규칙 | 설명 |
| --- | --- |
| ID 생성 | 동적 포트를 추가할 때 `^[a-zA-Z0-9_-]{1,64}$` 형식에 맞는 바뀌지 않는 ID 를 붙인다. 만드는 방식은 노드마다 다르다(각 노드 문서). |
| ID 불변 | 포트 이름을 바꾸거나, 순서를 바꾸거나, 다른 포트를 지워도 기존 포트 ID 는 바뀌지 않는다. |
| 연결선 유지 | 포트 ID 가 바뀌지 않으므로 포트에 붙은 연결선은 편집 뒤에도 그대로 남는다. |
| 포트 삭제 | 동적 포트를 지우면 그 포트에 붙은 연결선도 함께 지운다. |

ID 형식이 맞지 않을 때 `case_0` 같은 순번 ID 로 대신하는 규칙과 노드별 생성 방식은 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 가 정한다. `case_0`·`cond_0` 같은 순번 ID 는 형식이 맞지 않을 때의 대체값이라 포트 ID 의 예로 쓰지 않는다. 정상 경로의 포트 ID 는 아래 표와 같다.

| 동적 포트 | 포트 ID |
| --- | --- |
| Switch 케이스 | 사용자가 정한 slug(`<case.id>`, 예: `approve`) |
| AI 에이전트 조건 | 조건 id(`<condition.id>`). 프론트엔드가 발급한 UUID v4 다. `cond_` 는 LLM 조건 도구 이름의 접두사이고 포트 ID 가 아니다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)). |
| Presentation 버튼 | 버튼 id(`<button.id>`). 에디터가 버튼을 추가할 때 UUID v4 를 발급한다. 형식만 맞으면 slug 도 유효하다([Presentation 노드 공통 §동적 포트 ID 규칙](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md#동적-포트-id-규칙)). |
| Parallel 병렬 분기 | 인덱스 ID(`branch_<index>`) |

## 설정 패널

### 패널 구성

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 제목 줄 | 맨 위 | 닫기(✕), "{노드 유형} Settings" | 닫기를 누르면 패널을 닫는다. |
| 이름 | 제목 아래 | Name 입력(노드 레이블) | 레이블을 고친다. |
| 탭 | 가운데 위 | Settings, Code, Info | 탭을 바꾼다. |
| 노드별 설정 폼 | 가운데 | 노드 유형마다 다른 폼 | [auto-form](#auto-form) 참조 |
| 공통 설정 | 아래 | Error Handling 드롭다운, "Disable this node" 체크박스 | 에러 처리 정책, 노드 비활성화 |
| 메모 | 맨 아래 | Notes 입력 | 노드 메모 |

설정 패널과 AI 어시스턴트 패널은 같은 오른쪽 자리를 쓰므로 한 번에 하나만 연다([워크플로우 AI 어시스턴트](CLE-WF-ASSIST.md)).

### 공통 탭

| 탭 | 내용 |
| --- | --- |
| Settings | 노드 유형별 고유 설정 폼. 기본 탭이다. `변경 저장` 을 눌러야 에디터 상태에 반영한다. |
| Code | 노드 설정을 JSON 으로 직접 고치는 개발자용 탭. `JSON 적용` 을 눌러야 반영한다. |
| Info | 노드 유형 설명, 사용법, 최근 실행 결과 요약 |

설정 패널은 `key={selectedNodeId}` 로 노드마다 다시 마운트한다. 그래서 반영하지 않고 다른 노드로 옮기면 편집 내용이 사라진다. 이 모델을 고른 이유는 [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md) 의 Rationale 「저장은 수동 저장과 실행 직전 저장 두 경로만 둔다」 항목에 있다.

### 공통 설정 필드

| 필드 | 설명 |
| --- | --- |
| Name | 노드 레이블(node label, `Node.label`). 캔버스에 보이고 워크플로우 안에서 겹치면 안 된다. 레이블 규칙은 [표현식 언어](CLE-WF-EXPR.md) 의 `$node` 참조 절에 있다. |
| Error Handling | 에러가 났을 때의 정책. 화면 라벨은 "오류 처리" 다. [에러 처리 정책 설정](#에러-처리-정책-설정) 참조 |
| 노드 비활성화 | 화면 문구는 "Disable this node" 체크박스다. 켜면 실행할 때 이 노드를 건너뛴다. |
| Notes | 노드 메모(notes, `config.notes`). 마크다운을 쓸 수 있다. 현재 구현은 `config.notes` 에 저장한다(`node-settings-panel.tsx`). `Node.description` 컬럼과의 관계는 [미결 사항](#미결-사항) 참조 |

### 필드 도움말

설정 폼의 필드는 라벨 오른쪽에 도움말 아이콘(`?`, FieldHelp)을 둘 수 있다. UI 만으로 필드 뜻을 알기 어려울 때만 둔다.

| 규칙 | 설명 |
| --- | --- |
| 여는 방법 | 누르면 Popover 가 열린다. 마우스 올림은 보조 수단이고 그것만 쓰면 안 된다(모바일 접근성). |
| 본문 | 한두 문장 설명과, 필요하면 사용자 가이드 링크("자세히 보기 →") |
| 사용자 가이드 링크 | `/docs/<section>/<slug>#<anchor>` 형식. 반드시 새 탭(`target="_blank"`, `rel="noopener"`)으로 연다. |
| 접근성 | 아이콘 버튼에 `aria-label="도움말"` |
| 점진 도입 | 기존 필드의 `hint`(항상 보이는 캡션)와 함께 쓸 수 있다. 복잡한 필드부터 차례로 붙인다. |
| 대상 | 조건식, 표현식, 도구 설정, Fallback 정책, Cron 표현식, 인증 헤더처럼 개념 설명이 필요한 필드 |

공용 MDX 컴포넌트와 사용자 가이드 구조는 [사용자 가이드](../CLE-UI/CLE-UI-GUIDE.md) 가 정한다.

### 에러 처리 정책 설정

에러 처리 정책(Error Handling, `config.errorHandling.policy`)은 노드가 실패했을 때의 동작이다. 설정 패널에서 다섯 가지 가운데 하나를 고른다.

| 옵션(화면 라벨) | `policy` | 동작 |
| --- | --- | --- |
| 워크플로우 중단(Stop Workflow, 기본) | `stop_workflow` | 에러가 나면 워크플로우 실행을 멈춘다. 실행 상태는 `failed` 다. |
| 노드 건너뛰기(Skip Node) | `skip_node` | 에러가 나면 이 노드를 건너뛰고 다음 노드로 간다. 출력은 `null` 이다. |
| 기본 출력 사용(Use Default Output) | `use_default_output` | 에러가 나면 미리 정한 기본 출력을 쓴다. [기본 출력](#기본-출력) 참조 |
| 재시도(Retry) | `retry` | 노드 재시도. 고르면 설정 패널에 `maxRetries`(최대 재시도 횟수)와 `retryInterval`(재시도 간격, ms) 입력이 나온다(`node-settings-panel.tsx`). 엔진은 `retryInterval × backoffMultiplier^attempt` 지수 백오프로 재시도한다(`backoffMultiplier` 기본 2). |
| 에러 포트로 라우팅(Route to Error Port) | `route_to_error_port` | 에러 데이터를 `error` 포트로 보낸다. 고르면 노드에 동적 에러 포트가 생긴다. `error` 포트에 연결된 노드가 없으면 워크플로우 중단으로 대신한다. |

**저장 형태**: 설정 패널은 정책을 엔진 계약인 중첩 객체로 저장한다.

```ts
config.errorHandling = {
  policy,          // stop_workflow | skip_node | use_default_output | retry | route_to_error_port
  retryConfig?: { maxRetries, retryInterval, backoffMultiplier },
  defaultOutput?,
}
```

`policy` 값 집합은 실행 엔진의 `error-policy.handler.ts` 와 같다. 기본값과 실행 동작은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 이 정한다.

`config.errorHandling.policy` 가 없는 노드를 불러오면 예전 평면 키 `config.errorPolicy` 의 단축값을 대응하는 에러 처리 정책으로 읽고 저장할 때 그 키를 지운다. ForEach·Map·Parallel 에서는 이 키가 항목 에러 정책(item error policy, `config.errorPolicy`)이라 옮기지도 지우지도 않는다. 저장 코드는 이 세 노드에서 `config.errorHandling` 과 `config.errorPolicy` 두 키를 모두 보존한다(`node-settings-panel.tsx`). 결정 근거는 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#레거시-평면-키-이전-범위를-좁힌-이유) 의 Rationale 에 있다.

이 규칙의 요구사항은 REQ-NODEUI-041 이다.

### 기본 출력

기본 출력 사용 정책을 고르면 에러가 났을 때 사용자가 정한 값을 출력 포트로 대신 보낸다.

**설정 UI**(구현됨, `node-settings-panel.tsx`): Error Handling 드롭다운 아래에 "Default Output Value" 조건부 JSON 에디터와 "Reset to Default" 버튼이 나온다.

- JSON 에디터로 기본 출력을 직접 고친다. 값은 `config.errorHandling.defaultOutput` 에 저장한다.
- JSON 유효성을 실시간으로 검사한다. 파싱에 실패하면 저장을 막고 인라인 에러를 보여 준다.
- "Reset to Default" 버튼은 에디터를 빈 객체 `{}` 로 초기화한다.
- 에디터를 비우고 저장하면 `defaultOutput` 은 `null` 로 저장된다.

**값이 없을 때**: 사용자가 기본값을 정하지 않았거나 비워 두면 엔진은 `errorHandling.defaultOutput ?? null` 규칙으로 `null` 을 내보낸다(`error-policy.handler.ts`).

출력 타입별 기본값 추론은 미구현(계획)이다. 마지막 정상 실행의 출력 타입을 보고 아래 값을 쓰는 방식을 계획했지만 지금은 엔진과 UI 모두 타입을 추론하지 않고 `null` 만 쓴다.

| 출력 타입 | (계획) 기본값 |
| --- | --- |
| Object | `{}` |
| Array | `[]` |
| String | `""` |
| Number | `0` |
| Boolean | `false` |
| Null·알 수 없음 | `null` |

**실행할 때**

1. 노드 실행 중 에러가 난다.
2. 에러 처리 정책이 기본 출력 사용인지 확인한다.
3. 사용자가 정한 기본값이 있으면 그 값을 출력으로 쓴다.
4. 정한 값이 없으면 `null` 을 쓴다.
5. 기본값을 출력 포트로 보내고 다음 노드가 정상 실행된다.
6. 노드 실행(`node_execution`) 상태는 `completed` 다. 원래 에러는 디버깅용으로 `node_execution.error` 에 남긴다. 캔버스에서는 그 노드에 ⚠️ 아이콘을 붙여 기본값을 썼다는 것을 보여 준다.

### auto-form

Settings 탭의 노드별 설정 폼은 두 트랙으로 그린다(`node-configs/index.tsx` 의 `NodeConfigRenderer`).

1. **수작업 폼 트랙**: `node-configs/override-registry.ts` 의 `OVERRIDE_REGISTRY` 에 등록한 노드는 직접 만든 폼 컴포넌트(`node-configs/*-configs.tsx`)로 그린다.
2. **auto-form 트랙(기본 경로)**: 등록하지 않은 노드는 백엔드 zod 스키마의 `.meta({ ui: UiHint })` 힌트를 읽어 `SchemaForm`(`auto-form/schema-form.tsx`)이 폼을 자동으로 만든다. 스키마는 `GET /api/nodes/definitions` 로 불러온다([노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 의 메타데이터 API).

노드를 수작업 폼에서 auto-form 으로 옮기려면 레지스트리에서 항목을 빼고 백엔드 스키마에 충분한 `ui` 힌트를 더한다.

#### UiHint 어휘

기준은 백엔드 `nodes/core/node-component.interface.ts` 의 `UiHint` 다.

| 키 | 뜻 |
| --- | --- |
| `widget` | 그릴 위젯 id([위젯 어휘](#위젯-어휘)) |
| `label` / `placeholder` / `hint` | 라벨, 플레이스홀더, 항상 보이는 캡션. `hint` 는 필드 도움말과 함께 쓸 수 있다. |
| `order` | 폼 안 정렬 순서. 작을수록 먼저 나온다. |
| `hidden` | auto-form 에서 숨긴다. 스키마 검증은 그대로 한다. |
| `visibleWhen` | 조건부 표시. `{ field, equals }`, `{ field, notEquals }`, `{ field, oneOf }` 세 형태다. `equals` 는 단일 값 엄격 비교 전용이고 배열 허용 목록은 `oneOf` 를 쓴다. |
| `required` / `requiredWhen` | UI 필수 표시(별표). `requiredWhen` 은 `{ field, equals }` 한 형태이고 `equals` 는 단일 값(`===`)이나 배열(허용 목록)이다. 실행 시 강제는 `NodeHandler.validate()` 가 맡는다. |
| `clearFields` | 이 필드 값이 바뀌면 함께 비울 설정 키 목록(모드 전환 등). 예약 키(`__proto__` 등)는 prototype pollution 을 막으려고 비우지 못한다. |
| `group` / `collapsible` | 섹션 묶음과 접기 토글 여부 |
| `options` / `language` / `multiline` / `rows` / `itemLabel` / `itemDefault` | 위젯별 보조 옵션 |

#### 위젯 어휘

위젯 id 와 컴포넌트의 대응은 프론트엔드 `auto-form/widget-registry.ts` 가 기준이다. 모두 21종이다.

| 분류 | widget id |
| --- | --- |
| 기본 입력(10) | `text`, `textarea`, `number`, `select`, `multiselect`, `checkbox`, `expression`(표현식 에디터), `kv`, `kv-expression`, `code` |
| 공용 선택기(4) | `llm-config-selector`, `kb-selector`, `mcp-server-selector`, `workflow-selector`(`auto-form/selector-widgets.tsx`). AI 어시스턴트가 후보를 조회하는 계약은 [AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md) 가 정한다. |
| 모델 설정 선택기(2) | `chat-config-selector`, `embedding-config-selector`. `/models` 에 등록한 Chat·Embedding 모델 설정(ModelConfig)을 고른다. 저장 형태는 `config.id` 로 `llm-config-selector` 와 같다. 후보는 워크스페이스 모델 설정을 종류별로 조회한다(`modelConfigsApi.list("chat"\|"embedding")`). 노드의 `llmConfigId` 와 **독립**이고, 실행 시 고른 설정의 provider·자격 증명·기본 모델로 바로 해석한다(`auto-form/config-selector-widgets.tsx`). AI 어시스턴트 후보 선택기 대상이 아니다(`UserActionWidget` 에 없다). 모델 설정은 [모델 설정](../CLE-AI/CLE-AI-MODELS.md) 이 정한다. |
| 배열 편집(2) | `field-array`, `button-list` |
| 수작업 폼 강제(3) | `integration-selector`, `condition-builder`, `table-grid`. `UnsupportedWidget` 으로 대응돼 auto-form 만으로는 그릴 수 없다. 이 위젯을 쓰는 노드는 수작업 폼 트랙에 남아야 한다. |

#### 트랙 배정 현황

- **auto-form 으로 옮긴 노드**: `split`, `map`, `foreach`, `merge`, `carousel`, `ai_agent`, `text_classifier`, `information_extractor`
- **수작업 폼에 남은 노드**(`OVERRIDE_REGISTRY` 기준): `manual_trigger`, `if_else`, `switch`, `loop`, `variable_declaration`, `variable_modification`, `parallel`, `filter`, `workflow`, `http_request`, `database_query`, `send_email`, `cafe24`, `makeshop`, `transform`, `code`, `table`, `chart`, `form`, `template`. 필드 사이 부수 효과(예: table 의 열·행 동기화)처럼 auto-form 이 표현하지 못하는 요구가 남은 노드들이다.

## 표현식 입력

설정 필드에서 이전 노드의 출력을 읽을 때는 `{{ expression }}` 표현식을 쓴다. 문법, 내장 변수(`$node`, `$input`, `$var`, `$params`, `$trigger`, `$execution`, `$now`, `$env`, `$loop`, `$item`, `$thread`), 함수, 에러, 자동완성, 표현식 에디터 기능(정적 값과 표현식 모드 전환, 미리보기, 실시간 검증)은 [표현식 언어](CLE-WF-EXPR.md) 가 정한다. auto-form 은 `expression`·`kv-expression` 위젯으로 표현식 입력을 그린다.

노드의 `.config.*` 는 표현식 원본을, `.output.*` 은 평가 결과를 보여 준다. 이 구분은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다.

## 노드 사이 데이터 전달

노드 사이에 오가는 데이터는 JSON 이다. 예: `{ "field1": "value1", "field2": 42, "nested": { "array": [1, 2, 3] } }`

| 규칙 | 설명 |
| --- | --- |
| 1:1 연결 | 출력 데이터를 그대로 다음 노드의 입력으로 보낸다. |
| 1:N 분기 | 출력 데이터를 복제해 연결된 노드마다 똑같이 보낸다. |
| N:1 합류 | 여러 입력이 도착하면 [Merge 노드](../CLE-NODE-LOGIC/CLE-NODE-MERGE.md) 의 전략에 따라 처리한다. |
| 조건부 경로 선택 | If/Else, Switch 같은 조건 노드는 조건에 맞는 출력 포트로만 데이터를 보낸다. |
| 에러 라우팅 | 에러 처리 정책이 에러 포트로 라우팅인 노드에서 에러가 나면 에러 데이터를 `error` 포트로 보낸다. 에러 연결선(빨간색)으로 이어진 다음 노드가 에러 데이터를 입력으로 받아 실행한다. 에러 연결선 모양은 [연결선](CLE-WF-EDGE.md) 이 정한다. |

## 미결 사항

- **Logic 노드에 에러 포트로 라우팅을 허용하는가**: 이 문서는 에러 포트로 라우팅 정책을 고른 노드에는 어떤 노드든 동적 에러 포트가 생긴다고 적는다. Logic 노드 문서 12종은 런타임 에러 포트가 없다고 적는다(예: [Loop 노드](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md)). Logic 노드에 에러 처리 정책을 적용하는지 [Logic 노드 공통의 미결 사항](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#미결-사항) 에서 정해야 한다. 그 결정 전까지 이 문서는 Loop·Map·ForEach·Background 에 에러 포트를 따로 표기하지 않는다.
- **시스템 포트의 식별자와 포트 type 선언**: 에디터 문서와 프론트엔드 동적 포트(`resolve-dynamic-ports.ts`)·포트 색(`custom-node.tsx`)은 `system` 을 쓴다. [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 의 `PortDef.type` 과 백엔드 `NodePortKind` 는 `data`·`control`·`error` 를 쓴다. 프론트엔드 타입은 둘 다 받는다. 한국어 표기는 "시스템 포트" 로 정했지만 코드 식별자를 하나로 맞출지 결정이 필요하다. 같은 맥락에서 [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) 의 `error` 포트는 type 이 `data` 로 선언돼 있다. 연결선 색은 포트 ID 가 `error` 여도 빨강으로 그리지만 다른 소비처 영향은 미확인이다.
- **노드 메모의 저장 위치**: 데이터 모델은 `Node.description` 을 "메모/설명" 으로 정의하고 [버전 기록](CLE-WF-VERSION.md) 의 비교도 `description` 을 본다. 설정 패널의 Notes 는 `config.notes` 에 저장한다. 어느 쪽이 노드 메모의 저장 위치인지, `description` 컬럼을 무엇에 쓰는지 결정이 필요하다([워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md)).

## 구현 위치

- `codebase/frontend/src/components/editor/canvas/custom-node.tsx` (포트 그리기)
- `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx`
- `codebase/frontend/src/components/editor/settings-panel/node-configs/**` (수작업 폼, `override-registry.ts`)
- `codebase/frontend/src/components/editor/settings-panel/auto-form/**` (`schema-form.tsx`, `widget-registry.ts`, 선택기 위젯)
- `codebase/frontend/src/components/editor/expression/*.ts`, `*.tsx`
- `codebase/frontend/src/lib/node-definitions/resolve-dynamic-ports.ts`
- `codebase/backend/src/nodes/**/*.schema.ts`
- `codebase/backend/src/modules/nodes/**`

## Rationale

### R-1. 기본 출력의 타입별 기본값 추론은 계획으로 남긴다 (2026-06-03)

출력 타입별 기본값 자동 추론(마지막 정상 실행에서 타입 추론)은 엔진과 UI 어디에도 구현돼 있지 않다. 엔진 `error-policy.handler.ts` 는 `config.errorHandling.defaultOutput ?? null` 하나만 쓴다. 이번 작업(설정 패널의 JSON 에디터)은 사용자가 **명시한** 기본 출력을 저장하고 전달하는 표면만 만들었고, 타입 추론 레지스트리는 별도 기능으로 계획에 남긴다.

- 그래서 에디터를 비우고 저장하면 `defaultOutput = null` 이 저장되고 실행 때도 `null` 이 나간다. 타입별 기본값이 아니다. 엔진 실제 동작(`?? null`)과 맞는 의도된 동작이다.
- 타입 추론이 없는 상태에서 혼동을 피하려고 버튼 이름을 "Reset to Type Default" 에서 "Reset to Default"(빈 객체 `{}` 로 초기화)로 바꿨다.

### R-2. 설정 폼은 수작업 폼과 auto-form 두 트랙으로 그린다 (2026-06-10)

설정 패널의 스키마 기반 auto-form(SchemaForm, UiHint DSL, 위젯 레지스트리, override 레지스트리)은 구현이 먼저였고 여러 명세가 조각조각 인용해 왔다(Switch 의 `requiredWhen`, AI 에이전트 노드의 `visibleWhen`, AI 어시스턴트의 선택기 위젯 등). 이 문서의 auto-form 절을 시스템 전체의 기준으로 두고 두 트랙 전략, UiHint 어휘, 위젯 21종, 트랙 배정 현황을 한곳에서 관리한다. 노드 명세마다 프론트엔드 설정 UI 경로를 따로 적지 않고 이 문서의 구현 위치(`node-configs/**`, `auto-form/**`) 한곳에 모은다. 유지 부담을 줄이려는 결정이다(2026-06 명세·코드 대조 감사).

### R-3. 텍스트 분류기·정보 추출기 노드를 auto-form 으로 옮겼다 (2026-06-11)

두 AI 노드의 수작업 폼(`ai-configs.tsx`)은 zod 스키마가 드러낸 필드(대화 맥락 5개, 에이전트 메모리 7개, 시스템 맥락 2개, few-shot `examples`, `enumValues`, `maxCollectionRetries`)를 그리지 못했다. 그래서 사용자는 Code 탭 JSON 으로만 설정할 수 있었다. 이 누락은 명세와 코드를 교차 감사할 때 발견 번호 V-02, 심각도 "심각" 으로 기록됐다. 두 노드의 스키마는 이미 이 필드 전부를 auto-form 위젯(`field-array`, `llm-config-selector`, `multiselect`, `expression`, `visibleWhen` 조건 등)으로 표현할 UI 힌트를 내보내고 있었다. 그래서 `ai_agent` 처럼 `OVERRIDE_REGISTRY` 에서 빼 auto-form 으로 옮기고 수작업 컴포넌트는 없앴다. 백엔드 스키마는 한 줄도 바꾸지 않았다. 누락은 프론트엔드 수작업 폼이 스키마 힌트를 무시해서 생긴 것이었다.

### R-4. ForEach·Map·Parallel 의 `config.errorPolicy` 는 옮기지 않는다 (2026-10-10)

설정 패널은 예전 평면 키 `config.errorPolicy` 를 노드 유형을 가리지 않고 에러 처리 정책으로 옮기고 저장할 때 지웠다. 그래서 ForEach·Map·Parallel 에서 고른 항목 에러 정책이 저장할 때 사라졌다. 이전과 삭제를 세 노드가 아닌 노드로 한정하면 설정 패널 한 곳만 고치면 되고 저장된 워크플로우는 그대로 둘 수 있어서 이 안을 골랐다(NERV Task `CLE-T-V0JAG1`). 항목 에러 정책 키를 `itemErrorPolicy` 같은 새 이름으로 바꾸고 저장된 워크플로우를 마이그레이션하는 안은 기각했다. 승인된 문서 여러 개와 용어 사전을 함께 고쳐야 하고 데이터 마이그레이션이 필요하기 때문이다. 자세한 근거는 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#레거시-평면-키-이전-범위를-좁힌-이유) 에 있다.
