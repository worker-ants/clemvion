# Spec 감사 — 3-workflow-editor

## 요약

- **감사 파일 수**: 6개 (`0-canvas.md`, `1-node-common.md`, `2-edge.md`, `3-execution.md`, `4-ai-assistant.md`, `_product-overview.md`)
- **severity 분포**: none 0 / minor 0 / major 6 / severe 0 (모든 파일이 major)
- **핵심 메시지**:
  - 이 영역은 spec 본문이 약속한 UI/API surface 가 코드에 상당 폭 미구현된 채 단정형으로 기술되는 패턴이 반복된다. 특히 `0-canvas.md`(미니맵·줌슬라이더·노드삭제버튼·copy/paste·대부분 단축키·팔레트 Recent/Installed)와 `2-edge.md`(사이클·자기연결·중복 차단, 실행상태 스타일, Data Flow Preview), `3-execution.md`(§9 API 표 절반 불일치, §8 WS 이벤트/command 어긋남)가 가장 drift 가 크다.
  - `status:implemented` 로 표기된 `1-node-common.md`·`3-execution.md` 는 미구현 surface 가 다수라 **partial 강등**이 타당하다.
  - 공통적으로 frontmatter `code:` 글로브가 실제 drift 의 SoT(특히 `lib/stores/editor-store.ts`, `lib/node-definitions/resolve-dynamic-ports.ts`, backend WS gateway·controller, `workflow-editor.tsx`)를 누락한다 — `fix-code-paths` 가 영역 전반의 공통 액션.

## 파일별 발견사항

### spec/3-workflow-editor/0-canvas.md — major / partial / patch-content, fix-code-paths

**headline**: status=partial 는 타당하나 미니맵·줌슬라이더·노드 삭제버튼·컨테이너 삭제 다이얼로그·다수 단축키·팔레트 Recent/Installed 가 코드에 부재 — spec 만 보면 과대 표현됨.

| § | claim | reality | evidence |
| --- | --- | --- | --- |
| §7 (major) | 미니맵 — 우하단 오버레이, 뷰포트 사각형, 클릭/드래그 이동, 토글 | `@xyflow/react MiniMap` 컴포넌트 전혀 렌더링 안 됨. ReactFlow children 은 Background/ZoomControls/Panel 뿐. grep MiniMap 0건 | workflow-canvas.tsx:520-526 |
| §5.4 (major) | 노드 삭제 버튼 — 우상단 20x20 원형 ✕, hover/선택 시 표시, fade 200ms | custom-node.tsx 에 ✕ 삭제 버튼 없음. 삭제는 우클릭 메뉴·Delete 키만. grep delete-button 0건 | custom-node.tsx:144-406 |
| §11.3 (major) | 컨테이너 삭제 — 자식 있으면 Delete/Ungroup 확인 다이얼로그 | removeNode 는 노드+엣지 제거·containerId 재계산만. Ungroup/전체삭제 다이얼로그 없음. grep Ungroup 0건 | editor-store.ts:615-632 |
| §3.1/§6 (major) | 줌 슬라이더 + 줌 퍼센트 표시 | ZoomControls 는 ZoomIn/ZoomOut/Fit 버튼 3개만. 슬라이더·퍼센트 없음 | workflow-canvas.tsx:677-712 |
| §10 (major) | 키보드 단축키 14종 (Ctrl+C/V/D/A, Escape, Space+드래그, Ctrl++/-, Ctrl+0/1, Ctrl+Shift+R 등) | 구현은 Ctrl+Z/Y/S/Ctrl+/ 만. Delete/Backspace 는 ReactFlow deleteKeyCode. 나머지 미구현 | workflow-editor.tsx:79-104; workflow-canvas.tsx:517 |
| §3.3 (major) | Ctrl+C 복사 / Ctrl+V 붙여넣기(오프셋) | clipboard/copy/paste 로직 없음(grep 0건). 복제는 우클릭 duplicate(+50,+50)만 | workflow-canvas.tsx:267-292 |
| §4.1/§4.2 (major) | 팔레트 — Recent 섹션, Installed(마켓플레이스) 섹션, 클릭 추가, 패널 접기 토글 | 백엔드 카테고리 목록+검색+카테고리 접기만. Recent/Installed 없음, 클릭-추가 없음(드래그만), 전체 접기 토글 없음 | node-palette.tsx:21-154 |
| §5.2 (minor) | 비활성 — 반투명 + 사선 패턴 오버레이 | data.isDisabled 시 opacity-50 만. 사선 패턴 없음 | custom-node.tsx:149 |
| §2 (minor) | 더보기(⋮) 메뉴 5개(설정/버전히스토리/내보내기/가져오기/삭제) | 버전히스토리·내보내기·삭제 3개만. 설정·가져오기 없음 | editor-toolbar.tsx:437-472 |
| §3.4 (minor) | 노드 컨텍스트 메뉴 6개(실행/여기서부터 실행 포함) | 설정/복제/비활성·활성/삭제 4개만. 실행 항목은 toolbar Run 드롭다운에만 | workflow-canvas.tsx:529-583 |
| §5.2 (minor) | Presentation 완료 — 우하단 👁 배지, 클릭 시 Run Results 드로어 | status indicator 는 completed·failed 만. presentation 👁 배지·드로어 연결 없음 | custom-node.tsx:391-403 |
| §11.4 (minor) | 중첩 최대 3단계, 레벨별 배경 틴트(5/10/15%), 초과 시 토스트 | depth 제한/틴트 로직 없음(grep nestingDepth 0건). §11.2 가 '시각 containment 미사용' 명시 → §11.4 내부 모순 | 0-canvas.md:585 vs 660-667 |

**frontmatterIssues**:
- `code:` 글로브가 canvas/*.tsx + palette + toolbar 만 가리키나, 단축키/undo-redo/container 동기화/copy-paste 부재의 SoT 는 `workflow-editor.tsx` 와 `lib/stores/editor-store.ts` 에 있어 실제 구현 SoT 누락 → 두 파일 추가 권장.
- §5.3.2/§5.3.4 SoT 는 backend node schema(warningRules/summaryTemplate)+`@workflow/node-summary` 인데 글로브 미반영(단 본문이 node 스펙으로 cross-ref 하므로 위배는 아님).
- status=partial 은 타당하나 미구현 surface 폭이 커 본문에 미구현 표기 보강 권장.

**structuralNotes**: 파일명 0-canvas.md 는 0- prefix 진입/기술개요 성격으로 적절. 단 영역 기술개요보다 단일 기능 상세에 가까워 네이밍이 약간 모호하나 기존 관행과 일관되면 유지 가능. 구조 자체는 정상.

### spec/3-workflow-editor/1-node-common.md — major / partial / patch-content, fix-code-paths, reclassify

**headline**: 포트 시스템(§1)은 대체로 정합하나 §1.3 노드별 포트 표가 코드와 다수 어긋나고(Parallel/Classifier/InfoExtractor/Workflow/Filter), §2.4~2.5 Default Output·Retry 설정 UI 가 코드에 미구현.

| § | claim | reality | evidence |
| --- | --- | --- | --- |
| §1.3 (major) | Parallel 출력은 branch_0..N(동적)뿐 | static `done`(data) 항상 보유 + branch_N 은 dynamicPorts. 즉 branch_0..N + done | parallel.schema.ts:89-91; resolve-dynamic-ports.ts:46 |
| §1.3 (major) | Text Classifier 출력은 class_0..N 뿐 | 카테고리 포트 뒤 `fallback`(data)·`error`(error) 항상 추가. 표에 누락 | resolve-dynamic-ports.ts:75-79 |
| §1.3 (major) | Information Extractor 입력1/출력1, `out` | 단일턴 `out`+`error`, 멀티턴 `completed`+`user_ended`+`max_turns`+`error`. 1개·out 단일 아님 | resolve-dynamic-ports.ts:82-101 |
| §1.3 (major) | AI Agent 출력1, `out` | cond_N + 시스템(`out`/`user_ended`/`max_turns`) + `error`. §1.2 본문도 system 포트 인정 → 표와 문서 내부 충돌 | resolve-dynamic-ports.ts:103-148; §1.2 line 37 |
| §1.3 (minor) | Workflow 노드 출력 1개 `out` | `out`(data)+`error`(error) 2포트. error 누락 | workflow.schema.ts:120-124 |
| §1.3 (major) | 노드별 포트 표가 전체 노드 나열 | `logic/filter`(match/unmatched) 가 코드 존재하나 표·문서 어디에도 없음 | filter.schema.ts:81-86 |
| §2.5.1 (major) | 'Use Default Output' 시 JSON 에디터 + 'Reset to Type Default' 버튼 표시 | settings-panel 의 Error Handling 은 단일 select 만. 조건부 JSON 에디터/Reset 없음(i18n 사전에만 존재) | node-settings-panel.tsx:227-240 |
| §2.4 (major) | Retry 정책 '최대 재시도 횟수, 재시도 간격 설정' | dropdown 옵션만, maxRetries/retryInterval 입력 UI 가 editor 컴포넌트에 없음 | node-settings-panel.tsx:237 |
| §3.2 (minor) | 참조 표(이전노드/직전출력/변수/실행/시간/env/loop/item/jsonpath) | ROOT_VARIABLES 에 `$trigger`·`$itemIndex` 도 1급인데 §3.2 표에 `$trigger` 누락(§3 위임이라 minor) | expression-constants.ts:26-37 |
| §1.3 (minor) | Loop/ForEach/Map 컨테이너 `emit` 은 보라색 전용 포트 | backend schema 는 emit 을 type:'data' 로 정의(별도 emit 타입 아님). 보라색은 id==='emit' 일 때만 부여 — 동작은 일치, 표현 차이 | loop.schema.ts:72-74; custom-node.tsx:259,268 |

**frontmatterIssues**:
- status: implemented 이나 §2.5.1 Default Output Value 에디터·§2.4 Retry 설정 UI 미구현 → partial 강등 권장.
- code: 글로브 3개는 실재 매치하나 §1.3 포트 표 SoT 인 backend `nodes/**/*.schema.ts` + frontend `resolve-dynamic-ports.ts` 미포함 → 가장 drift 큰 코드가 추적 밖. `resolve-dynamic-ports.ts` 추가 권장.

**structuralNotes**: 파일명/위치/분류 컨벤션 부합, 재배치 불필요. 단 §1.3 표가 노드 목록 단일 진실로 쓰이는데 실제 노드 집합(filter 추가, system/error 포트)과 동기화 깨짐 → 표를 코드 SoT 에 맞춰 재생성하거나 상세 포트는 ../4-nodes 개별 문서로 위임하고 표는 대표 식별자만 남기는 방향 검토(reclassify).

### spec/3-workflow-editor/2-edge.md — major / partial / patch-content, keep

**headline**: 엣지 색상·하이라이팅은 코드와 정확히 일치하나, §2.2/§2.3 연결 유효성(사이클·자기연결·중복 차단)과 §3.2 실행상태 스타일·§4·§5 인터랙션이 미구현 — status:partial 와는 부합하나 본문이 미구현 기능을 단정형으로 기술.

| § | claim | reality | evidence |
| --- | --- | --- | --- |
| §2.3 (major) | 엣지 생성 시 DAG 검증, DFS 사이클 확인 + '순환 연결은 허용되지 않습니다' 툴팁 | onConnect 는 detectContainerConflict 만 검사 후 즉시 addEdge. 사이클/DFS/DAG 검증 없음. isValidConnection prop 미전달 | editor-store.ts:578-605,171; workflow-canvas.tsx:495-520 |
| §2.2 (major) | 금지 연결(자기연결·출력→출력·입력→입력·중복) 시 금지 아이콘/툴팁 | source===target 체크·중복 검출·금지 툴팁 미구현. ReactFlow 기본 핸들 매칭에만 의존 | editor-store.ts:578-605 |
| §3.2 (major) | 실행 상태 스타일(애니메이션 점선/완료 초록/비활성 반투명) | custom-edge 는 selected/isHighlighted 의 strokeWidth·color 만. animated/dashed/disabled/완료 스타일 전무 | custom-edge.tsx:16-31 |
| §4/§5 (major) | 엣지 호버 데이터 미리보기 툴팁 / 'Data Flow Preview' 박스(Size·모달) | onEdgeMouseEnter/Leave 는 hoveredEdgeId 만 설정(하이라이팅용). Preview 툴팁/모달/Size 미구현 | workflow-canvas.tsx:163-171 |
| §1.2/§1.3/§4 (major) | 빈영역 드롭 add-node 팝업+자동연결, 입력포트 역방향 드래그·재연결, 엣지 중간 노드 삽입 | onConnectStart/End, onReconnect, split/insert 핸들러 canvas 미전달. 모두 미구현 | workflow-canvas.tsx:495-520 |
| §3.1 (minor) | 포트 타입별 색상(데이터/에러/시스템/컨테이너) + body→container·error→error·done/AI out 등→system | 정확히 일치. PORT_TYPE_COLORS·resolvePortType 분기 spec 그대로 | edge-utils.ts:12-56; ai-agent.schema.ts:558-559 |
| §3.3 (minor) | hover dim opacity 12%, 150ms ease, source/target glow | 정확히 일치. data-edge-focus-active opacity 0.12, transition 150ms ease, glow 150ms, 우선순위 hoveredEdge>hoveredNode>selectedNode | globals.css:99-133; use-edge-highlighting.ts:42-52 |
| §6.1 (minor) | emit 검증(없음/2개↑ 에러코드, 엔진 upfront) | CONTAINER_MISSING_EMIT/CONTAINER_MULTIPLE_EMIT 존재, emit 와이어 수 따라 throw. 일치 | execution-engine.service.ts:6984-6993 |

**frontmatterIssues**:
- code: 글로브 3개(custom-edge.tsx, use-edge-highlighting.ts, workflow-canvas.tsx)는 시각화·하이라이팅 surface 를 정확히 커버. 단 §2.2/§2.3 유효성 로직 위치인 `editor-store.ts`(onConnect/detectContainerConflict)와 `edge-utils.ts`(색상·portType) 누락 → 추가 권장.
- status: partial 은 적절(다수 surface 미구현이므로 implemented 아님).

**structuralNotes**: 파일명/위치 컨벤션 부합. 본문이 미구현 기능을 현재형 단정("DFS로 확인", "툴팁 표시", "팝업 표시")으로 기술해 status:partial 와 톤 어긋남 → 미구현 행은 '(계획)' 표기나 pending_plans 참조로 구분 권장.

### spec/3-workflow-editor/3-execution.md — major / partial / patch-content, fix-code-paths

**headline**: §9 API 표 절반이 실제 라우트와 불일치(execute-from/nodes-test 부재, executions 경로 상이), §8 WS 이벤트명·command 가 코드와 어긋나고, §2/§7/§10.12 약속 surface(히스토리 로드·실행히스토리 UI·Ctrl+Shift+R) 미구현.

| § | claim | reality | evidence |
| --- | --- | --- | --- |
| §9 (major) | POST .../execute-from/:nodeId, POST /nodes/:id/test | 두 라우트 모두 부재. 부분 실행은 POST .../execute body input.fromNodeId 로, 단일 노드 테스트 엔드포인트는 없음 | workflows.controller.ts:223; nodes.controller.ts; editor-toolbar.tsx:169 |
| §9 (minor) | GET /api/workflows/:id/executions | 해당 경로 없음. 실제는 GET /api/executions/workflow/:workflowId | executions.controller.ts:49,83 |
| §8.1 (minor) | WS 이벤트 node.started/completed/failed (§10.13 node.skipped) | 실제는 `execution.` prefix 붙음(execution.node.started 등) | websocket.service.ts:149-152 |
| §8.2 (major) | WS 명령 execution.start / execution.stop | 해당 @SubscribeMessage 없음. 시작은 REST .../execute, 중단은 REST /executions/:id/stop. 실제 게이트웨이 명령은 submit_form/click_button/submit_message/end_conversation/retry_last_turn | websocket.gateway.ts:375,450,524,597,682; editor-toolbar.tsx:185,126 |
| §8.2 (minor) | 명령 표에 execution.retry_last_turn 누락(본문 §10.6/§10.8 은 약속) | 코드엔 핸들러 실재하는데 §8.2 표에 빠져 표가 불완전 | websocket.gateway.ts:682 |
| §2.2 (major) | Mock Input 다이얼로그 — Load from History/테스트세트 저장/실시간 JSON 검증 | Run with Input 은 plain textarea 1개. History/저장/실시간 검증 없음(제출 시 JSON.parse try/catch 만) | editor-toolbar.tsx:477-507,139 |
| §1.2/§1.3 (major) | 부분 실행 '우클릭→여기서부터 실행', 단일 노드 테스트 '우클릭→실행' | 우클릭 메뉴에 해당 항목 없음. Run from Selected 는 툴바 드롭다운(선택 노드 기준). 단일 노드 테스트 surface 전무 | editor-toolbar.tsx:415-419,160 |
| §1.1 (minor) | 전체 실행 'Run 또는 Ctrl+Enter' | Ctrl+Enter 바인딩 없음(z/y/s/'/' 만). Run 은 버튼만 | workflow-editor.tsx:81-99 |
| §10.12 (major) | Ctrl+Shift+R Run Results 토글, Escape 캔버스 포커스 복귀 | 두 핸들러 모두 미구현(docs mdx 안내만) | workflow-editor.tsx:81-99; run-results.mdx:45 |
| §10.3/§10.5 (minor) | 드로어 기본 300/최소 150px, 타임라인 280px fixed | 상수 불일치. DEFAULT 420/MIN 240. 타임라인 리사이즈 가능(DEFAULT 400/MIN 280/MAX 640) | run-results-drawer.tsx:27-34 |
| §7 (major) | 인-에디터 실행 히스토리(⋮→항목 클릭 시 캔버스 오버레이 + '이 입력으로 다시 실행') | 더보기 메뉴엔 VersionHistory/Export/Delete 만. 캔버스 오버레이·재실행 surface 부재. 실행 히스토리는 별도 페이지로 분리 | editor-toolbar.tsx:443-467 |
| code (minor) | frontmatter code: run-results/*.tsx + editor-toolbar.tsx 만 | 핵심 구현이 backend WS gateway/execution-engine, workflows/executions/nodes/workflow-versions 컨트롤러, workflow-editor.tsx 에도 걸침 → 과소 포착 | websocket.gateway.ts 등 미포함 |

**frontmatterIssues**:
- status: implemented 이지만 §2.2 히스토리 로드·테스트세트 저장·실시간 검증, §7 인-에디터 실행 히스토리, §10.12 단축키, §1.3 단일 노드 테스트 모두 부재 → partial 강등 후보.
- code: glob 이 frontend run-results+toolbar 만 가리켜 실제 surface(backend WS gateway/컨트롤러, workflow-editor.tsx) 누락 → fix-code-paths 로 추가 권장.

**structuralNotes**: 파일 위치/네이밍 컨벤션 부합. §6(브레이크포인트)은 '미구현 로드맵'으로 명시·Rationale 기록돼 정합. drift 는 §1/§2/§7/§8/§9/§10.3·10.5·10.12 의 본문 약속 vs 코드 현실에 집중. 섹션 번호 순서 혼란(§3.4→§3.6→§3.5)도 존재하나 사소.

### spec/3-workflow-editor/4-ai-assistant.md — major / implemented / patch-content

**headline**: 대체로 정합하나, 코드의 2단계 verify 가드(verify_workflow 도구·WORKFLOW_VERIFY_REQUIRED)와 mcp-server-selector widget 이 spec 에 없고, ASSISTANT_WORKFLOW_RUNNING 등 약속된 에러코드 3종·409 동시스트리밍 가드는 미구현.

| § | claim | reality | evidence |
| --- | --- | --- | --- |
| §10/§4.1 (major) | self-review 가드는 WORKFLOW_REVIEW_REQUIRED 단일. finish 는 PLAN_NOT_COMPLETE + REVIEW 2계층만 | review 통과 후 Phase2 WORKFLOW_VERIFY_REQUIRED(non-trigger≥3, 1회)와 explore 도구 verify_workflow(VERIFY_INCOMPLETE) 노출. spec 표·§10 에 없음 | tool-definitions.ts:29,186-220; workflow-assistant-stream.service.ts:1472-1489,1633-1672,236 |
| §7/§12.2 (major) | 실행 중이면 편집 도구가 shadow 에서 ASSISTANT_WORKFLOW_RUNNING 거부 | 해당 문자열·로직 코드베이스 전체에 없음. shadow-workflow 에 running 체크 없음 → 미구현 | grep 0 hits; shadow-workflow.ts |
| §7 (major) | 에러코드 ASSISTANT_STREAMING_UNSUPPORTED, ASSISTANT_LLM_CONFIG_INVALID 반환 | 둘 다 코드베이스에 없음. 실제는 ASSISTANT_NO_LLM_CONFIG, ASSISTANT_TOO_MANY_TOOL_CALLS 등 | grep 0 hits; stream.service.ts:358,515,566 |
| §4.3.1/Rationale ED-AI-39 (major) | candidate picker widget 은 4종(integration/llm-config/kb/workflow-selector)뿐 | 5번째 mcp-server-selector(multi-select)를 backend+frontend 양쪽 구현. spec 명시 없음 | detect-pending-user-config.ts:18,28; candidate-picker.tsx:20,101,196 |
| §10 (minor) | 워크플로우당 활성 스트리밍 1건, 중복 POST 시 409 | 동시 스트리밍 lock/ConflictException/409 없음 → 미구현 | grep 코드 hit 없음 |
| §6 (minor) | 모든 엔드포인트 editor 이상 역할 필요 | GET /sessions, /latest, /:id 는 @Roles('editor') 없이 JWT 만. editor 미만도 읽기 가능 | workflow-assistant.controller.ts:50-97 vs 100,112,125,138 |
| §6 (minor) | 세션 엔드포인트 6개 열거 | spec 표에 없는 GET /sessions/latest(findLatestActive) 추가 존재(§6.1 자동선택 구현) | workflow-assistant.controller.ts:68-86 |
| §4.1.1 (minor) | 마스킹 키 9종 | 코드는 access_token/refresh_token/client_secret(snake) 포함 상위집합. 더 안전하나 1:1 불일치 | mask-sensitive-fields.util.ts:3-16 |
| §4.3/§4.4 (minor) | 편집 도구 인자 camelCase(sourceId 등) | 실제 schema 는 snake_case(source_id 등). §4.4.1 hint 는 source_id 사용 → 문서 내부 혼재 | tool-definitions.ts:368-371 |
| §13/§10 (minor) | self-review blocking 6종 열거 | system-prompt 에 NODE_CONFIG_WARNINGS(configWarnings 미해결 시 finish 차단) 추가 존재. §10·Rationale 미반영 | prompts/system-prompt.ts:332 |

**frontmatterIssues**:
- code: 글로브 3개 모두 정확 매치. 단 frontend 글로브가 assistant-store.ts 단일만 가리켜 함께 변경되는 assistant-editor-bridge.ts·lib/api/assistant.ts(SSE union) 범위 밖 → 글로브 보강 여지.
- status: implemented 는 핵심 기능(세션·대화루프·도구·SSE·picker·auto_resume) 모두 구현돼 대체로 타당. 누락분(ASSISTANT_WORKFLOW_RUNNING/STREAMING_UNSUPPORTED/LLM_CONFIG_INVALID, 409 가드)이 부수 가드라 partial 강등보다 본문 보정이 적절.

**structuralNotes**: 네이밍·위치·frontmatter 컨벤션 모두 부합. 문서 상세하고 Rationale 이 구현 결정을 잘 추적. 단 Rationale 에 verify_workflow/WORKFLOW_VERIFY_REQUIRED Phase2 도입 메모가 빠져 §4.1/§10 에 verify 도구·가드 추가 기술 + Rationale 배경 보강하는 patch-content 필요.

### spec/3-workflow-editor/_product-overview.md — major / N/A / patch-content

**headline**: PRD 인덱스 문서 — 본문 대다수는 코드와 일치하나 ED-AI-33 한 턴 tool-call 상한이 16(spec) vs 동적 48/plan기반(코드)로 어긋남.

| 요구 | claim | reality | evidence |
| --- | --- | --- | --- |
| ED-AI-33 (major) | 한 턴당 tool-call 상한 16회, 초과 시 자동 종료 후 재시도 유도 | 동적 budget — DEFAULT_MAX_TOOL_CALLS_PER_TURN=48, plan 있으면 actionable*3+8, hard cap 200, MAX_TOOL_LOOP_ROUNDS=50. 16 상한 없음. 초과 시 재시도 안내는 일치 | active-plan-context.ts:229-247; workflow-assistant-stream.service.ts:216,562-567 |
| ED-AI-03(권장) (minor) | Ctrl+/ 로 패널 토글 | '/' keydown/Ctrl+/ 바인딩 없음 — 헤더 버튼 토글만. 권장 우선순위라 허용 범위지만 갭 | grep 매치 없음(assistant-panel.tsx, toolbar/*.tsx) |

**frontmatterIssues**:
- frontmatter(status/code/id) 전혀 없음 — PRD 제품정의 인덱스이므로 컨벤션상 의도된 형태(상세 N-*.md 가 frontmatter+code 보유). 부재 자체는 위반 아님.

**structuralNotes**: PRD/제품정의 인덱스로 컨벤션 부합(관련문서 링크 + ED-* 요구사항 표). 상세 기술명세는 0-canvas/2-edge/3-execution/4-ai-assistant 로 정상 분리. ED-AI-* 의 §11.2.2/§9.2 등 내부 참조는 4-ai-assistant.md 섹션을 가리킴(혼동 소지 minor). 네이밍/연번/분류 위반 없음.

## 영역 구조·네이밍 이슈

- **연번/분류**: 파일 연번(0-canvas, 1-node-common, 2-edge, 3-execution, 4-ai-assistant)과 `_product-overview.md` 인덱스 구성은 컨벤션에 부합한다. 구조적 재배치는 불필요하다.
- **0-canvas 네이밍 모호성**: `0-` prefix 가 통상 영역 기술개요(0-overview)를 뜻하나 본 문서는 '캔버스 인터랙션 상세'로 단일 기능 상세에 가깝다. 기존 영역 관행과 일관되면 유지 가능하나, 향후 영역 기술개요 문서가 추가될 경우 충돌 소지가 있어 주시 필요.
- **§1.3 포트 표의 SoT 분산**: `1-node-common.md` §1.3 노드별 포트 표가 노드 목록의 단일 진실로 쓰이는데 실제 노드 집합(filter 노드 추가, 각 노드 system/error 포트)과 동기화가 깨졌다. 표를 코드 SoT(`resolve-dynamic-ports.ts` + `*.schema.ts`)에 맞춰 재생성하거나, 상세 포트 구성은 `../4-nodes` 개별 문서로 위임하고 본 표는 대표 식별자만 남기는 reclassify 검토.
- **frontmatter `code:` 글로브 영역 공통 누락**: 4개 상세 문서가 공통적으로 핵심 drift SoT 를 글로브 밖에 둔다 — `lib/stores/editor-store.ts`(0-canvas/2-edge), `lib/node-definitions/resolve-dynamic-ports.ts`(1-node-common), `lib/utils/edge-utils.ts`(2-edge), backend WS gateway·executions/workflows/nodes 컨트롤러·`workflow-editor.tsx`(3-execution), `assistant-editor-bridge.ts`·`lib/api/assistant.ts`(4-ai-assistant). 영역 차원의 `fix-code-paths` 일괄 정비 권장.
- **본문 톤(미구현 단정형)**: 0-canvas/2-edge/3-execution 이 미구현 기능을 현재형 단정으로 기술한다. 미구현 행을 '(계획)' 표기 또는 pending_plans 참조로 구분하는 본문 규칙을 영역 공통으로 적용 권장.

## 우선 액션 (정렬)

major 우선, 동일 severity 내 drift 폭 순.

1. **[major] `3-execution.md` §9 API 표 전면 재작성** — execute-from/:nodeId·/nodes/:id/test 부재, GET .../executions 경로 상이(실제 GET /executions/workflow/:workflowId)를 코드 라우트(`workflows.controller.ts:223`, `executions.controller.ts:49,83`)에 맞춰 정정.
2. **[major] `3-execution.md` §8 WS 이벤트/명령 표 정정** — 이벤트명 `execution.` prefix 반영, execution.start/stop 명령 부재(REST 로 처리) 명시, 실제 게이트웨이 명령(submit_form/click_button/submit_message/end_conversation/retry_last_turn) 및 누락된 execution.retry_last_turn 반영(`websocket.gateway.ts`, `websocket.service.ts:149-152`).
3. **[major] `3-execution.md` status implemented→partial 강등 + 미구현 surface 표기** — §2.2 히스토리/저장/실시간검증, §7 인-에디터 실행 히스토리·캔버스 오버레이, §10.12 Ctrl+Shift+R·Escape, §1.3 단일 노드 테스트 미구현 반영.
4. **[major] `1-node-common.md` §1.3 포트 표 재생성** — Parallel(+done)/Classifier(+fallback/error)/InfoExtractor(멀티턴 포트)/AI Agent(system/error)/Workflow(+error)/filter 노드 추가를 `resolve-dynamic-ports.ts`·`*.schema.ts` 에 맞춰 정정.
5. **[major] `1-node-common.md` status implemented→partial 강등** — §2.5.1 Default Output Value 에디터·§2.4 Retry 설정 UI 미구현 반영.
6. **[major] `2-edge.md` §2.2/§2.3 연결 유효성·§3.2 실행상태·§4/§5 인터랙션 본문에 미구현(계획) 표기** — DFS 사이클/자기연결/중복 차단, animated/dashed 스타일, Data Flow Preview, 빈영역 드롭/재연결/엣지 삽입을 현재형 단정에서 (계획)으로 구분(`editor-store.ts:578-605`).
7. **[major] `0-canvas.md` 미구현 surface 본문 보강** — 미니맵(§7)/줌슬라이더(§3.1·§6)/노드 삭제버튼(§5.4)/컨테이너 삭제 다이얼로그(§11.3)/copy-paste(§3.3)/단축키 대부분(§10)/팔레트 Recent·Installed(§4)를 미구현으로 명시. §11.4 시각 중첩 묘사와 §11.2(시각 containment 미사용) 내부 모순 해소.
8. **[major] `4-ai-assistant.md` patch-content** — verify_workflow 도구·WORKFLOW_VERIFY_REQUIRED Phase2(§4.1/§10), mcp-server-selector widget(§4.3.1/Rationale), NODE_CONFIG_WARNINGS self-review 항목(§10) 추가 기술. 미구현 약속(ASSISTANT_WORKFLOW_RUNNING/STREAMING_UNSUPPORTED/LLM_CONFIG_INVALID, 409 가드) 본문 정정 + Rationale 보강.
9. **[major] `_product-overview.md` ED-AI-33 정정** — tool-call 상한 16 → 동적 budget(기본 48, plan 시 actionable*3+8, hard cap 200, MAX_TOOL_LOOP_ROUNDS=50)으로 수정.
10. **[minor→공통] frontmatter `code:` 글로브 일괄 보강(fix-code-paths)** — 위 '영역 구조·네이밍 이슈'에 정리한 누락 SoT 파일들을 각 문서 글로브에 추가.
11. **[minor] `3-execution.md` §10.3/§10.5 드로어 상수 정정** — 300/150 → DEFAULT 420/MIN 240, 타임라인 fixed 280 → 리사이즈(DEFAULT 400/MIN 280/MAX 640). 섹션 번호 순서(§3.4→§3.6→§3.5) 정리.
12. **[minor] `1-node-common.md` §3.2 `$trigger`·`$itemIndex` 참조 보강**, `0-canvas.md` §2 더보기 메뉴·§3.4 컨텍스트 메뉴·§5.2 비활성 사선/👁 배지 본문 정정.
