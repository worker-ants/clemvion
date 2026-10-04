---
id: "CLE-GLOSSARY-WF"
title: "용어 사전 — 워크플로우 작성"
type: "convention"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-GLOSSARY"
ancestors: ["CLE-VISION", "CLE-GLOSSARY"]
area: null
content_hash: "250072c2da31da332560db169c2860e893d8ea7d82492476c30196cdb16a4514"
read_as: "approved_fallback"
task: "CLE-T-V22XN8"
source_paths: []
mirror_sha256: "e17e6addafdfa7b79f78c5216d67340f008b86c57344a79e123d5ccbab769cb6"
etag: "sha256-372004515265a002de2c9f84ef19dd5126a77cec8d5f0b43c69c59583aad152c"
---
## 개요

[용어 사전](CLE-GLOSSARY.md) 의 「워크플로우 작성」 영역 용어다. 표기 원칙 · 약어 · 상태값 표기와 표의 열 순서는 [용어 사전](CLE-GLOSSARY.md) 에 있다. 여러 영역에 걸친 같은 말은 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 이 가른다.

## 용어

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 워크플로우 | Workflow, `workflow` | 노드와 연결선으로 만든 자동화 단위. 트리거나 수동 실행으로 돈다. | 워크플로, 작업 흐름, Workflow(본문) | [워크플로우 데이터와 저장 흐름](CLE-WF/CLE-WF-DATA.md) |
| 워크플로우 활성 상태 | active, `workflow.is_active` | 활성·비활성 두 값. 비활성 워크플로우는 스케줄·웹훅 트리거로 시작하지 않고 수동 실행만 된다. | Active/Inactive(본문) | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 폴더 | Folder, `folder` | 워크플로우를 묶는 계층 폴더. 정한 깊이까지 중첩하고 순환을 막는다. 지금은 목록 필터로만 쓴다. | 컬렉션(폴더 뜻으로) | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 태그 | tag | 워크플로우에 붙이는 자유 라벨. 목록 필터에 쓴다. | 없음 | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 소유 필터 | ownership filter, `mine`, `shared`, `all` | 팀 워크스페이스 목록에서 내가 만든 워크플로우와 남이 만든 워크플로우를 거르는 필터. "공유된 워크플로우" 는 작성자가 내가 아닌 워크플로우를 고르는 필터 값 이름이다. 팀 배지가 따르는 "공유" 정의는 팀 워크스페이스 단위다([워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) Rationale). | 없음 | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 팀 배지 | Team badge | 팀 워크스페이스에 속한 워크플로우에 붙는 "Team" 표시. | 없음 | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 복제 | duplicate | 캔버스 전체를 비활성 사본으로 복사하는 동작. 버전 기록·트리거·테스트 데이터셋은 옮기지 않는다. | Copy(본문) | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 내보내기·가져오기 | export, import | 워크플로우를 JSON 파일로 내보내거나 파일에서 새 워크플로우로 만드는 동작. | Export, Import(본문) | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 에디터 | workflow editor | 캔버스·노드 팔레트·설정 패널·AI 어시스턴트·실행 결과 드로어가 있는 워크플로우 편집 화면. | 편집기, 워크플로 에디터, 워크플로우 편집기 | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 캔버스 | Canvas | 노드와 연결선을 배치하는 에디터의 작업 영역. 저장 대상을 말할 때는 "캔버스 내용(노드·연결선 전체)" 으로 쓴다. | 없음 | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 노드 팔레트 | Palette | 에디터 왼쪽의 노드 목록. 카테고리별 목록·검색·최근 사용을 보여 준다. | Palette(본문) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 노드 검색 팝업 | node search popup | 캔버스를 더블클릭하거나 포트에서 끌어 빈 곳에 놓을 때 뜨는 노드 선택 팝업. | 빠른 노드 추가 팝업, 노드 추가 검색 팝업, 빠른추가 | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 설정 패널 | Settings Panel, `node-settings-panel` | 노드를 고르면 오른쪽에 열리는 설정 편집 패널. 설정·코드·정보 탭이 있다. | Settings Panel, Node Settings Panel(본문) | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| auto-form | auto-form, `SchemaForm`, `UiHint` | 노드 스키마의 UI 힌트로 설정 폼을 자동으로 그리는 방식. 이 방식으로 표현하지 못하는 노드는 수작업 폼을 쓴다. | 스키마 기반 자동 폼 | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 노드 레이블 | node label, `Node.label` | 캔버스에 보이는 노드 이름. 한 워크플로우 안에서 겹치면 안 된다. | 노드 라벨, 라벨(이 뜻으로) | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 노드 메모 | notes, `config.notes` | 노드에 붙이는 자유 메모. 설정 패널은 `config.notes` 에 저장한다(`Node.description` 과의 관계는 결정 항목 D48). | 메모/설명 | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 노드 비활성화 | disable node, `isDisabled` | 실행할 때 건너뛰도록 표시한 노드 상태. 워크플로우 비활성과 다르다. | Disable(본문) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 설정 요약 | configuration summary, `summaryTemplate` | 노드 설정을 템플릿으로 줄여 캔버스 노드 셋째 줄에 보여 주는 문구. | 캔버스 요약, Configuration Summary(본문) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 노드 경고 규칙 | `warningRules` | 노드 하나의 설정만 보고 누락이나 오류를 알리는 선언형 규칙. 심각도는 `blocking` 과 `advisory` 다. | warningRule(본문) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 미설정 경고 | not-configured badge | 필수 설정이 비었을 때 캔버스 노드에 붙는 경고 배지. 노드 경고 규칙의 결과다. | Not configured(본문) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 그래프 경고 규칙 | `graphWarningRules` | 노드 사이 관계를 보고 판단하는 경고 규칙. 심각도가 `error` 면 저장을 막는다. | cross-node warningRule, graph-warning | [그래프 경고 규칙](CLE-WF/CLE-WF-WARN.md) |
| 탈출 불가 순환 경고 | `graph:unescapable-cycle` | 분기 노드가 아닌 노드에서 되돌아가는 연결선이 만든 순환에 붙는 경고. 에디터는 순환 자체를 막지 않는다. | 글로벌 DAG 사이클 검사 | [그래프 경고 규칙](CLE-WF/CLE-WF-WARN.md) |
| 저장 | save, `saveCanvas` | 캔버스 내용을 서버에 쓰는 동작. 수동 저장과 실행 직전 저장 두 경로만 있고 타이머 자동 저장은 없다. | 자동 저장(실행 직전 저장 뜻으로), 캔버스 bulk save | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 앱 내부 클립보드 | `editorClipboard` | 복사한 노드와 그 사이 연결선을 담는 에디터 전용 버퍼. OS 클립보드가 아니다. | 클립보드(단독) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 시작 가이드 카드 | `CanvasEmptyState` | 트리거 노드만 있을 때 캔버스에 뜨는 단계별 안내 카드. | 시작하기 카드, Empty State 카드 | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 연결선 | Edge, `edge` | 앞 노드의 출력 포트와 뒤 노드의 입력 포트를 잇는 선. `type` 값은 `data` 또는 `error` 다. | 엣지, 에지, Edge(본문) | [연결선](CLE-WF/CLE-WF-EDGE.md) |
| 연결선 분할 | edge split | 연결선 위에 노드를 떨어뜨려 가운데에 끼워 넣는 동작. | mid-insert, 중간 노드 삽입, 엣지 분할 | [연결선](CLE-WF/CLE-WF-EDGE.md) |
| 연결선 분리 | detach | 재연결 앵커를 빈 곳에 놓아 연결선을 지우는 동작. 연결선 분할과 다르다. | 없음 | [연결선](CLE-WF/CLE-WF-EDGE.md) |
| 연결선 자동 정리 | `dropStaleEdges` | 워크플로우를 불러올 때 지금 설정에 없는 포트에 붙은 연결선을 지우는 동작. 저장해야 서버에 반영된다. | stale 엣지 자동 제거 | [연결선](CLE-WF/CLE-WF-EDGE.md) |
| 데이터 미리보기 | Data Flow Preview | 연결선을 골라 그 선으로 흐른 데이터를 보는 기능. | 엣지 데이터 미리보기 | [연결선](CLE-WF/CLE-WF-EDGE.md) |
| 포트 | Port, `source_port`, `target_port` | 노드의 입력·출력 연결 지점. 입력 기본 포트 이름은 `in` 이다. | 핸들, handle(본문), sourceHandle(본문) | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 에러 포트 | error port, `error` | 런타임 에러 정보를 내보내는 출력 포트. 노드에 원래 있는 고정 에러 포트와, 에러 처리 정책이 "에러 포트로 라우팅" 일 때 생기는 동적 에러 포트가 있다. | error 포트, runtime 에러 포트 | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 시스템 포트 | system port | 노드가 미리 정한 고정 제어 출력 포트(`out`, `done`, `user_ended` 등). | control 포트, 제어 포트 | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 동적 포트 | dynamic ports | 설정 항목(Switch 케이스, 분류 카테고리, AI 조건, 버튼)마다 생기는 포트. | dynamic-ports(본문) | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 포트 ID | stable port id | 동적 포트를 가리키는 바뀌지 않는 문자열. 형식이 맞지 않을 때만 `case_0` 같은 순번 ID 로 대신한다. | stable slug id | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 컨테이너 | container, `containerId` | 자식 노드를 반복 실행하는 Loop·ForEach·Map 세 노드. 자식은 `containerId` 로 소속을 나타낸다. Parallel 과 Background 는 컨테이너가 아니다(결정 항목 D17). | 그룹 박스, 컨테이너(Parallel·Background 뜻으로) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 컨테이너 본문 | container body | 컨테이너가 반복할 때마다 실행하는 자식 노드 묶음. | body 서브그래프, 내부 노드 그룹, 하위 노드 그룹, 하위 워크플로우(노드 그룹) | [컨테이너 실행](CLE-EXEC/CLE-EXEC-CONTAINER.md) |
| body·emit·done 포트 | `body`, `emit`, `done` | 컨테이너 반복 구조의 세 포트. body 는 본문 진입, emit 은 반복 결과를 모으는 입력, done 은 모은 배열 출력이다. | loopback, 출력 수집(포트 이름으로) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 그룹 해제 | Ungroup | 컨테이너만 지우고 자식 노드를 최상위로 올리는 삭제 방식. 자식까지 지우는 방식은 "모두 삭제" 다. | 없음 | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 도구 영역 | Tool Area, `tool_owner_id` | AI 에이전트 노드 옆에 노드를 놓아 도구로 등록하던 영역. 기능은 제거했고 DB 컬럼만 남았다. 현행 기능으로 쓰지 않는다. | Tool Area(현행 기능처럼) | [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| 버전 기록 | Version History, `WorkflowVersion` | 저장할 때마다 쌓이는 워크플로우 스냅샷 목록과 그 화면. | 버전 히스토리, 버전 이력, Version History(본문) | [버전 기록](CLE-WF/CLE-WF-VERSION.md) |
| 버전 스냅샷 | version snapshot, `workflow_version.snapshot` | 한 번 저장한 시점의 이름·설명·노드·연결선. 워크플로우 설정(`settings`)은 담지 않는다. | 스냅샷(단독) | [버전 기록](CLE-WF/CLE-WF-VERSION.md) |
| 버전 번호 | vN, `workflow_version.version` | 버전 기록에 보이는 순번. 워크플로우의 `current_version` 과 한 칸 어긋난다. | 없음 | [버전 기록](CLE-WF/CLE-WF-VERSION.md) |
| 버전 비교 | version diff | 두 버전 사이에 추가·삭제·수정된 노드와 연결선을 보여 주는 기능. | Diff(본문 단독), 버전 차이 | [버전 기록](CLE-WF/CLE-WF-VERSION.md) |
| 버전 복원 | restore | 과거 스냅샷을 다시 저장해 새 버전을 만드는 동작. 이력을 되감지 않고 앞으로 쌓는다. | 롤백 | [버전 기록](CLE-WF/CLE-WF-VERSION.md) |
| 변경 요약 | `change_summary` | 저장 요청이 보낸 버전 설명 문자열. 에디터는 보내지 않고 복원할 때만 "Restored from vN" 이 들어간다. | 변경 사항 요약 | [버전 기록](CLE-WF/CLE-WF-VERSION.md) |
| 표현식 | Expression, `{{ }}` | 노드 설정 문자열 안에서 앞 노드 출력·변수·실행 정보를 읽는 인라인 문법. 노드 실행 직전에 한 번 평가한다. | expression(본문), 수식 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 표현식 언어 | Expression Language | 표현식 문법·내장 변수·함수를 정한 명세. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 평가 | evaluate | 표현식을 값으로 바꾸는 일. | 해석(같은 뜻으로), resolve(본문) | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 내장 변수 | built-in variables | `$node`, `$input`, `$var`, `$params`, `$trigger`, `$execution`, `$now`, `$env`, `$loop`, `$item`, `$thread` 처럼 `$` 로 시작하는 표현식 루트. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 워크플로우 변수 | workflow variables, `context.variables`, `$var` | 실행 동안 노드가 읽고 쓰는 사용자 정의 값. 표현식은 `$var`, Code 노드는 `$vars` 로 읽는다. | `$variables`, 워크플로우 변수 저장소 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 트리거 파라미터 참조 | `$params` | `$input.parameters` 의 줄임. 수동 트리거 노드가 검증한 입력 파라미터를 읽는다. | context.parameters | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 웹훅 요청 뷰 | `$trigger` | 웹훅으로 시작한 실행의 원본 HTTP 요청(`body`, `headers`, `query`, `method`). 다른 경로로 시작하면 빈 객체다. | triggerData(본문) | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 노드 참조 | `$node["레이블"]` | 다른 노드의 노드 출력을 레이블이나 UUID 로 읽는 표현식. `.output`, `.config`, `.meta`, `.port`, `.status` 를 읽을 수 있다. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 반복 컨텍스트 | `$loop` | Loop 본문 안에서 `index`·`iteration`·`isFirst`·`isLast` 를 읽는 변수. `$parent` 는 표현식에 없다. | `$loop.count`(표현식 변수로), `$parent.loop` | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 항목 컨텍스트 | `$item`, `$itemIndex` | ForEach·Map·Filter 가 처리하는 현재 배열 항목과 순번. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 환경 변수 참조 | `$env`, `EXPRESSION_ENV_ALLOWLIST` | 운영자가 허용 목록에 적은 환경 변수만 읽는 표현식 변수. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 제한 표현식 | restricted expression | 스케줄 파라미터 값처럼 `$now`·`$schedule` 만 쓸 수 있는 표현식. | 없음 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 표현식 에러 코드 | `EXPR_*` | 문법·참조·타입·함수·시간·깊이 여섯 가지 평가 실패 코드. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 표현식 제외 키 | `EXPRESSION_EXCLUSIONS` | 엔진이 미리 평가하지 않는 노드별 설정 키(`code.code`, `filter.conditions` 등). | 핸들러별 제외 규칙 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 자동완성 스키마 보강 | enricher | 설정에 선언한 필드를 출력 스키마에 넣어 표현식 자동완성을 돕는 장치. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| AI 어시스턴트 | Workflow AI Assistant, `workflow-assistant` | 에디터 오른쪽 패널에서 자연어 요청을 받아 노드와 연결선을 만들고 고치는 대화형 도우미. AI 에이전트 노드와 다른 기능이다. | 워크플로우 어시스턴트, Workflow Assistant, Assistant(본문), AI 에이전트(이 뜻으로), 채팅형 AI 에이전트 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 어시스턴트 세션 | `AssistantSession`, `workflow_assistant_session` | 워크플로우 하나에 묶인 사용자별 어시스턴트 대화. | 세션(단독) | [AI 어시스턴트 스트리밍과 세션 API](CLE-WF/CLE-WF-ASSIST-PROTO.md) |
| 어시스턴트 메시지 | `AssistantMessage`, `workflow_assistant_message` | 어시스턴트 세션의 사용자·어시스턴트 메시지 행. 도구 호출·계획·사용량 정보가 붙는다. | WorkflowAssistantMessage(본문) | [AI 어시스턴트 스트리밍과 세션 API](CLE-WF/CLE-WF-ASSIST-PROTO.md) |
| 탐색·계획·편집 단계 | Clarify, Plan, Execute | 어시스턴트 대화가 거치는 세 단계. 셋째 단계는 캔버스 편집이지 워크플로우 실행이 아니다. | Execute 단계, 실행 단계 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 계획 카드 | Plan card, `propose_plan` | 어시스턴트가 제안하는 단계별 편집 계획. 사용자가 승인해야 편집을 시작한다. 화면 제목은 "실행 계획" 이다(결정 항목 D38). | 실행 계획(본문), Plan 카드 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 편집 턴 | execution turn | 성공한 편집이 하나 이상 있는 어시스턴트 턴. 계획만 낸 턴은 "계획 전용 턴" 이다. | 실행 턴 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 후보 선택기 | candidate picker, `pendingUserConfig` | 통합·모델 설정·지식 저장소·워크플로우처럼 사용자가 직접 골라야 하는 값을 어시스턴트가 후보 목록으로 보여 주는 장치. | in-message picker | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| Shadow 검증 | `ShadowWorkflow` | 어시스턴트 편집을 서버 메모리의 워크플로우 사본에 먼저 적용해 검증하는 장치. | shadow 검증 | [AI 어시스턴트 도구](CLE-WF/CLE-WF-ASSIST-TOOLS.md) |
| 어시스턴트 도구 | assistant tools, `explore`, `plan`, `edit` | 어시스턴트가 부르는 탐색·계획·편집 LLM 도구. | 없음 | [AI 어시스턴트 도구](CLE-WF/CLE-WF-ASSIST-TOOLS.md) |
| 자동 이어서 진행 | `auto_resume` | 계획 단계가 남았는데 텍스트만 내고 멈춘 턴을 서버가 정한 횟수만큼 더 이어 가게 하는 장치. 실행 재개와 다르다. | 자동 재개, stall 자동 복구 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 어시스턴트 도구 호출 한도 | tool-call budget, `toolCallsBudget` | 어시스턴트 한 턴에서 부를 수 있는 도구 호출 수의 상한. AI 노드의 도구 호출 한도와 다르다. | tool-call budget(본문), 동적 budget | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 종료 가드 | finish guard | 계획 완결성·품질 점검·요청 대조가 끝나기 전에 어시스턴트 턴이 끝나지 않게 막는 서버 검사. | 없음 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 턴 종료 사유 | `finish_reason` | 어시스턴트 턴이 끝난 이유(`stop`, `tool_calls`, `error`, `aborted`, `auto_resume_pending`). | 없음 | [AI 어시스턴트 스트리밍과 세션 API](CLE-WF/CLE-WF-ASSIST-PROTO.md) |
| 응답 중단 | stop streaming | 어시스턴트 응답 스트림을 끊는 버튼 동작. 실행 중지와 다르다. | 없음 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |

## Rationale

2026-10-02 에 [용어 사전](CLE-GLOSSARY.md) 한 문서의 「워크플로우 작성」 절에서 옮겼다. 나눈 이유와 표준을 고른 기준은 그 문서의 Rationale 에 있다.

### 정의 보정 (2026-10-03)

NERV Task `CLE-T-V22XN8` 가 정한 정의 보정을 반영했다.

- 개요의 안내 문단(영역 소개 · 열 순서)과 Rationale 의 분할 설명을 색인을 가리키는 한 줄로 줄였다. 같은 문단이 하위 문서 열 곳에 복사돼 있었다.
- 「노드 메모」 · 「컨테이너」 · 「계획 카드」 의 결정 항목에 번호를 붙였다. D48(노드 메모 저장 필드), D17(컨테이너의 범위), D38(계획 카드의 화면 제목)이다.
- 「소유 필터」: 「공유된 워크플로우」 는 필터 값 이름이고 팀 배지가 따르는 「공유」 정의는 팀 워크스페이스 단위라고 적었다([워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) Rationale).
- 「폴더」 · 「시작 가이드 카드」 · 「자동 이어서 진행」: 정의에서 기준 문서의 수치를 뺐다(색인 표기 원칙 14).
