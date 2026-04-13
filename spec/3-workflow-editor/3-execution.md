# Spec: 워크플로우 실행/디버깅

> 관련 문서: [PRD 워크플로우 에디터](../../prd/2-workflow-editor.md#7-워크플로우-실행) · [PRD 워크플로우 에디터](../../prd/2-workflow-editor.md#8-실행-디버깅) · [Spec 캔버스](./0-canvas.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution)

---

## 1. 실행 모드

### 1.1 전체 실행

| 항목 | 설명 |
|------|------|
| 트리거 | Run 버튼 클릭 또는 Ctrl+Enter |
| 시작점 | 워크플로우의 루트 노드 (입력 엣지가 없는 노드) |
| 입력 데이터 | Mock Input 설정 또는 빈 입력 |
| 종료 | 모든 리프 노드 실행 완료 또는 에러 발생 시 |

### 1.2 부분 실행 (Run from Selected)

| 항목 | 설명 |
|------|------|
| 트리거 | 노드 우클릭 → "여기서부터 실행" |
| 시작점 | 선택된 노드 |
| 입력 데이터 | 이전 실행의 해당 노드 입력 데이터 또는 수동 입력 |
| 범위 | 선택된 노드부터 하류(downstream) 끝까지 |

### 1.3 단일 노드 테스트

| 항목 | 설명 |
|------|------|
| 트리거 | 노드 우클릭 → "실행" |
| 범위 | 해당 노드만 실행 |
| 입력 데이터 | 이전 실행의 해당 노드 입력 데이터 또는 수동 입력 |
| 출력 | 설정 패널의 Info 탭에 결과 표시 |

---

## 2. Mock Input (테스트 입력)

### 2.1 설정 화면

"Run with Input" 선택 시 표시되는 다이얼로그:

```
┌──────────────────────────────────────┐
│  Test Input Data                     │
│  ──────────────────────────────────  │
│  {                                   │
│    "userId": 123,                    │
│    "action": "signup",               │
│    "data": {                         │
│      "email": "test@example.com"     │
│    }                                 │
│  }                                   │
│  ──────────────────────────────────  │
│  [Load from History ▼]    [Run ▶]   │
└──────────────────────────────────────┘
```

### 2.2 기능

| 기능 | 설명 |
|------|------|
| JSON 에디터 | 테스트 데이터를 JSON으로 직접 편집 |
| 히스토리 로드 | 이전 실행의 입력 데이터 불러오기 |
| 저장 | 자주 사용하는 테스트 데이터 세트 저장/이름 지정 |
| 검증 | 유효한 JSON인지 실시간 검증 |

---

## 3. 실행 상태 시각화

### 3.1 실행 시작 시

1. 에디터 상단에 실행 상태 바 표시:
   ```
   ┌──────────────────────────────────────────────┐
   │  ▶ Running...   0.5s elapsed    [■ Stop]     │
   └──────────────────────────────────────────────┘
   ```
2. 모든 노드를 "대기" 상태로 초기화

### 3.2 실행 진행 중

- 현재 실행 중인 노드: 테두리 펄스 애니메이션 (파랑)
- 완료된 노드: 하단에 초록 체크 + 실행 시간 표시
- 엣지: 데이터 흐름 애니메이션 (점이 이동하는 효과)
- 분기: 실행된 경로만 하이라이트, 미실행 경로는 흐릿하게

### 3.3 실행 완료

```
┌──────────────────────────────────────────────────┐
│  ✅ Completed   2.3s   10/10 nodes    [Details]  │
└──────────────────────────────────────────────────┘
```

### 3.4 Form 노드 대기 상태

Form 노드에 도달하여 사용자 입력을 대기 중인 경우:

```
┌──────────────────────────────────────────────────────────────┐
│  ⏸ Waiting for input   "Approval Form"     [Results ↑] [■]  │
└──────────────────────────────────────────────────────────────┘
```

- 캔버스에서 Form 노드에 입력 대기 아이콘(⏸) 표시 + 핑크 테두리 펄스 애니메이션
- Run Results 드로어가 자동 펼침 + Form 탭에 포커스 (§10 참조)
- 드로어의 Form 탭에서 실제 폼 UI를 렌더링하고 제출 가능
- 폼 제출 후 실행 자동 재개, Form 탭은 제출 결과 뷰로 전환, 상태 바가 "▶ Running..." 으로 전환

### 3.6 AI Agent Multi Turn 대화 상태

AI Agent 노드가 Multi Turn 모드로 실행 중인 경우:

```
┌──────────────────────────────────────────────────────────────┐
│  💬 Conversing   "CS Bot"  Turn 2/20     [Results ↑] [■]    │
└──────────────────────────────────────────────────────────────┘
```

- 캔버스에서 AI Agent 노드에 💬 아이콘 + 초록 테두리 펄스 애니메이션
- Run Results 드로어가 자동 펼침 + AI Agent 노드 자동 선택
- 드로어 타임라인에 대화 메시지가 프리뷰 카드로 인라인 표시 (사용자 메시지, AI 응답, Tool 호출)
- 드로어 인스펙터 하단에 메시지 입력 UI 표시 (textarea + Send + End 버튼)
- 사용자 메시지 전송 시 타임라인에 즉시 추가 (optimistic), AI 응답 대기 중 입력 비활성
- AI 응답 수신 시 타임라인에 AI 응답 추가 + 입력 재활성
- End 클릭 시 대화 종료 → 실행 재개, 상태 바 "▶ Running..."으로 전환

### 3.5 실행 실패

```
┌──────────────────────────────────────────────────┐
│  ❌ Failed at "Node C"   1.2s   5/10 nodes       │
│  Error: Connection timeout          [Details]     │
└──────────────────────────────────────────────────┘
```

- 실패 노드 빨간 하이라이트
- 실패 노드 클릭 시 에러 상세 표시

---

## 4. 실행 중단 (Stop)

| 항목 | 설명 |
|------|------|
| Stop 버튼 | 실행 상태 바의 Stop 버튼 클릭 |
| 동작 | 현재 실행 중인 노드 완료 후 중단 (Graceful) |
| 강제 중단 | Stop 버튼 3초 이상 누르기 → 즉시 중단 (Force) |
| 상태 | Execution.status = "cancelled" |

---

## 5. 실행 결과 조회

### 5.1 노드별 입출력 데이터

노드 클릭 시 설정 패널 하단(또는 Info 탭)에 표시:

```
┌──────────────────────────────────┐
│  Last Execution                  │
│  ──────────────────────────────  │
│  Status: ✅ Completed (0.12s)   │
│                                  │
│  ▼ Input                         │
│  {                               │
│    "userId": 123                 │
│  }                               │
│                                  │
│  ▼ Output                        │
│  {                               │
│    "user": { "name": "Gehrig" } │
│  }                               │
│                                  │
│  [Copy Input] [Copy Output]      │
└──────────────────────────────────┘
```

### 5.2 Presentation 노드 결과 렌더링

Presentation 노드의 실행 결과는 **Run Results 드로어**(§10)와 설정 패널 Info 탭 양쪽에서 렌더링된 형태로 표시된다:

| 노드 유형 | 결과 렌더링 |
|-----------|------------|
| Carousel | 슬라이드 형태로 카드 렌더링, 좌/우 탐색 |
| Table | 테이블 형태로 렌더링, 컬럼 헤더 + 행 데이터 표시 |
| Chart | SVG 차트 렌더링, 인터랙티브 호버 |
| Template | outputFormat에 따라 HTML 렌더링 또는 Markdown/텍스트 표시 |
| PDF | 썸네일 미리보기 + [다운로드] 버튼 + [새 탭에서 열기] 링크 |
| Form | 제출된 데이터를 키-값 형태로 표시 |

실행 중/완료 후 Presentation 노드의 주요 결과 확인 경로는 Run Results 드로어이다. 캔버스에서 Presentation 노드 완료 시 노드 우하단에 👁 아이콘 배지가 표시되며, 클릭 시 드로어의 해당 탭으로 이동한다.

### 5.3 실행 경로 표시

- 실행된 노드와 엣지를 하이라이트
- 미실행 노드/엣지는 흐릿하게 표시
- If/Else, Switch 등에서 어떤 분기를 탔는지 명확히 표시

---

## 6. 브레이크포인트

### 6.1 설정

- 노드 좌측 클릭 또는 우클릭 → "브레이크포인트 설정"
- 브레이크포인트가 있는 노드: 빨간 점(●) 표시

### 6.2 동작

| 상태 | 설명 |
|------|------|
| 일시 정지 | 브레이크포인트 노드 실행 직전에 일시 정지 |
| 상태 바 | "⏸ Paused at Node C" + [Continue] [Step Over] [Stop] 버튼 |
| Continue | 다음 브레이크포인트까지 또는 완료까지 실행 |
| Step Over | 현재 노드만 실행 후 다시 일시 정지 |
| 데이터 확인 | 일시 정지 상태에서 현재 노드의 입력 데이터 확인 가능 |

---

## 7. 실행 히스토리

### 7.1 접근

에디터 헤더의 더보기(⋮) → "실행 히스토리" 또는 전용 패널 탭

### 7.2 히스토리 목록

```
┌───────────────────────────────────────────────────┐
│  Execution History                                 │
│  ┌───────────────────────────────────────────────┐ │
│  │ #1234  ✅ Completed  2.3s   Manual  3min ago  │ │
│  │ #1233  ❌ Failed     1.2s   Webhook 1hr ago   │ │
│  │ #1232  ✅ Completed  3.1s   Schedule 2hr ago  │ │
│  │ ...                                           │ │
│  └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

### 7.3 히스토리 항목 클릭 시

- 해당 실행의 모든 노드 실행 결과를 캔버스에 오버레이
- 각 노드에 해당 실행의 상태/시간 표시
- 엣지에 전달된 데이터 미리보기 가능
- "이 입력으로 다시 실행" 버튼 제공

---

## 8. 실행 엔진 통신

> **상세 프로토콜**: 채널 구독, 인증, heartbeat, 재연결, 메시지 스키마 등은 [WebSocket 프로토콜 상세](../5-system/6-websocket-protocol.md) 참조.

### 8.1 WebSocket 이벤트 (클라이언트 ← 서버)

| 이벤트 | 데이터 | 설명 |
|--------|--------|------|
| `execution.started` | executionId | 실행 시작 |
| `node.started` | executionId, nodeId | 노드 실행 시작 |
| `node.completed` | executionId, nodeId, output, duration | 노드 완료 |
| `node.failed` | executionId, nodeId, error | 노드 실패 |
| `execution.completed` | executionId, status, duration | 실행 완료 |
| `execution.paused` | executionId, nodeId | 브레이크포인트 도달 |
| `execution.waiting_for_input` | executionId, nodeId, nodeType, interactionType, formConfig?, buttonConfig?, conversationConfig? | Form 노드, 버튼 Presentation 노드, 또는 AI Agent Multi Turn 대화에서 사용자 입력 대기. `interactionType`: `form` / `buttons` / `ai_conversation`. 상세: [WS 프로토콜 §4.4](../5-system/6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세) |
| `execution.ai_message` | executionId, nodeId, message, turnCount, messages | AI Agent Multi Turn에서 AI 응답 메시지 전달 |

### 8.2 WebSocket 명령 (클라이언트 → 서버)

| 명령 | 데이터 | 설명 |
|------|--------|------|
| `execution.start` | workflowId, input, fromNodeId? | 실행 시작 |
| `execution.stop` | executionId, force? | 실행 중단 |
| `execution.continue` | executionId | 브레이크포인트 후 계속 |
| `execution.step` | executionId | 한 노드만 실행 |
| `execution.submit_form` | executionId, nodeId, formData | Form 노드에 사용자 입력 제출 |
| `execution.click_button` | executionId, nodeId, buttonId | 버튼이 설정된 Presentation 노드에서 버튼 클릭. `buttonId`: port 버튼 UUID 또는 `__continue__` |
| `execution.submit_message` | executionId, nodeId, message | AI Agent Multi Turn에서 사용자 메시지 전송 |
| `execution.end_conversation` | executionId, nodeId | AI Agent Multi Turn 대화 종료 요청 |

---

## 9. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/workflows/:id/execute | 워크플로우 실행 |
| POST | /api/workflows/:id/execute-from/:nodeId | 부분 실행 |
| POST | /api/nodes/:id/test | 단일 노드 테스트 |
| GET | /api/workflows/:id/executions | 실행 히스토리 목록 |
| GET | /api/executions/:id | 실행 상세 (노드별 결과 포함) |
| POST | /api/executions/:id/stop | 실행 중단 |
| GET | /api/workflows/:id/versions | 버전 히스토리 |
| POST | /api/workflows/:id/versions/:ver/restore | 버전 복원 |

---

## 10. Run Results Drawer

워크플로우 실행 시 **모든 노드**의 실행 상태와 결과를 2-column 레이아웃으로 실시간 시각화하는 하단 드로어 패널. 왼쪽 타임라인에 모든 노드가 실행 순서대로 표시되고, 오른쪽 상세 뷰에서 선택한 노드의 결과를 확인한다.

### 10.1 핵심 원칙

- **모든 노드**의 실행 히스토리가 타임라인에 표시된다 (Trigger, Logic, Data, AI, Integration, Presentation 모두 포함).
- Presentation 노드 중 **Form만 실행을 일시 정지**한다 (사용자 입력 대기). 나머지 노드들은 실행을 중단하지 않는다.
- 드로어는 **2-column 레이아웃**으로, 왼쪽에 타임라인 리스트, 오른쪽에 선택된 노드의 상세 결과를 표시한다.
- Presentation 노드는 전용 리치 렌더러(테이블, 차트 등)로 표시되고, 그 외 노드는 JSON 출력 뷰어로 표시된다.

### 10.2 레이아웃

캔버스 하단에 슬라이드업되는 리사이즈 가능한 2-column 패널:

```
┌─ drag handle ─────────────────────────────────────────────┐
│ 🔄 Running...  3/10 nodes                    [−] [✕]     │
├────────────────┬──────────────────────────────────────────┤
│ Timeline List  │ Detail View                              │
│ (280px fixed)  │ (flex-1)                                 │
│                │                                          │
│ 🟡 Trigger  ✓ │  HTTP Request: "Fetch Users"             │
│ 🔵 If/Else  ✓ │  Status: completed (142ms)               │
│ 🟠 HTTP     ✓ │                                          │
│ 🔵 Transform✓ │  Output:                                 │
│ 🩷 Table    ✓ │  ┌──────────────────────────────┐        │
│ 🩷 Form     ⏸ │  │ { "statusCode": 200, ... }   │        │
│                │  └──────────────────────────────┘        │
│                │                                          │
└────────────────┴──────────────────────────────────────────┘
```

### 10.3 드로어 속성

| 속성 | 값 |
|------|---|
| 기본 높이 | 300px |
| 최소 높이 | 150px |
| 최대 높이 | 뷰포트의 60% |
| 위치 | 캔버스 영역 하단, 전체 너비 |
| 리사이즈 | 상단 드래그 핸들로 높이 조정 (localStorage에 저장) |
| 접힌 상태 | 36px 높이 바 — 상태 아이콘 + 라벨 + 노드 카운터 |
| Z-index | 캔버스 위, 모달/다이얼로그 아래 |

### 10.4 헤더

| 요소 | 설명 |
|------|------|
| 상태 아이콘 | 실행 상태에 따른 아이콘: 🔄 Running, ✅ Completed, ❌ Failed, ⏸ Waiting |
| 상태 라벨 | "Running...", "Completed", "Failed", "Waiting for input..." |
| 노드 카운터 | `N/M nodes` — 완료/전체 노드 수. 실패 노드 있으면 `(N failed)` 표시 |
| 최소화 버튼 [−] | 드로어를 접힌 상태로 축소 |
| 닫기 버튼 [✕] | 드로어 완전 숨김 (실행 상태 리셋) |

### 10.5 타임라인 리스트 (왼쪽 칼럼, 280px)

모든 실행된 노드를 시간순으로 나열하는 컴팩트 리스트:

| 요소 | 설명 |
|------|------|
| 카테고리 색상 dot | 노드 카테고리 색상 (Trigger=🟡, Logic=🔵, Flow=🟣, AI=🟢, Integration=🟠, Data=🔵, Presentation=🩷) |
| 노드 라벨 | 사용자 지정 라벨 또는 노드 유형명 (truncate) |
| 상태 아이콘 | ⏳ Running (spinner), ✅ Completed, ❌ Failed, ⏸ Waiting, — Skipped |
| 실행 시간 | duration 표시 (예: "142ms", "1.2s") |
| 클릭 동작 | 해당 노드를 오른쪽 상세 뷰에 표시 |

타임라인은 새 노드 추가 시 자동 하단 스크롤되며, 첫 번째 노드가 자동 선택된다. Form 노드가 대기 상태에 진입하면 해당 노드가 자동 선택된다.

**컨테이너 body 노드의 반복 실행 표시:**

Loop/ForEach/Map 같은 컨테이너의 body 노드는 한 번의 워크플로우 실행에서 여러 번(iter) 실행된다. 이 경우 각 iter는 **독립된 timeline 항목**으로 표시된다:

- 같은 nodeId가 여러 번 나타나면 라벨에 `(iter N)` 접미사 자동 부착 — 예: `Transform (iter 1)`, `Transform (iter 2)`.
- 각 항목은 backend의 `NodeExecution` DB row에 1:1 대응 (`nodeExecutionId`로 식별).
- 항목별로 개별 input / output을 상세 뷰에서 확인 가능 (특정 iter의 실패 원인 추적에 유용).
- 단 회(single iter) 실행 노드는 접미사가 붙지 않는다.

**WebSocket 이벤트 변경**: `NODE_STARTED`, `NODE_COMPLETED`, `NODE_SKIPPED`, `NODE_FAILED`, `EXECUTION_WAITING_FOR_INPUT` 모든 payload에 `nodeExecutionId`가 포함되어 프론트엔드가 iter를 구분한다. REST 폴링도 `nodeExecution.id`로 동일하게 수렴하므로 중복 row가 생기지 않는다.

**AI Agent Multi Turn 노드:**

AI Agent Multi Turn 노드는 접힘/펼침(►/▼) 가능한 트리 항목으로 표시. 펼침 시 대화 턴이 프리뷰 카드로 인라인 표시:

```
▼ 🤖 AI Agent "CS Bot"   ⏳ Turn 3/20
┌──────────────────────────┐
│ 👤 주문 상태를 확인해주세요│
├──────────────────────────┤
│ 🤖 네, 주문번호를 알려주  │
│    시겠어요?              │
├──────────────────────────┤
│ 👤 ORD-12345 입니다       │
├──────────────────────────┤
│  🔧 search_orders     ✓ │
│  🔧 get_shipping      ✓ │
├──────────────────────────┤
│ 🤖 해당 주문은 현재 배송  │
│    중입니다. 도착 예정일은 │
│    4/10입니다.            │
│    📚 2   🔧 2           │
└──────────────────────────┘
```

| 항목 | 아이콘 | 프리뷰 | 뱃지 |
|------|--------|--------|------|
| AI Agent 부모 (접힘) | ► 🤖 | 노드 라벨 | `Turn N/M` + 상태 |
| AI Agent 부모 (펼침) | ▼ 🤖 | 노드 라벨 | `Turn N/M` + 상태 |
| 사용자 메시지 | 👤 | 메시지 첫 2줄 truncate | — |
| AI 응답 | 🤖 | 응답 첫 2줄 truncate | `📚 N` `🔧 N` (있을 때만) |
| Tool 호출 | 🔧 | tool 이름 | ✓ / ✗ |

대화 진행 중(Live): 자동 펼침 + 새 메시지 추가 시 자동 스크롤. 대화 완료 후(History): 접힘 기본, 클릭으로 펼침.

### 10.6 상세 뷰 (오른쪽 칼럼)

선택된 노드의 상세 정보를 표시한다:

**헤더**: 카테고리 색상 dot + 노드 라벨 + 노드 유형명 + 상태 배지 + 실행 시간

#### 10.6.1 서브 탭 (completed/failed 노드)

completed 또는 failed 상태의 노드(AI Agent 제외)는 헤더 아래에 서브 탭 바를 표시한다:

```
┌──────────────────────────────────────────────┐
│ 🩷 Carousel  carousel  ✅ Done  2.1s        │
├──────────────────────────────────────────────┤
│ [Preview]  Input  Output                      │
├──────────────────────────────────────────────┤
│ (선택된 탭의 콘텐츠)                            │
└──────────────────────────────────────────────┘
```

| 탭 | 표시 조건 | 콘텐츠 |
|----|-----------|--------|
| Preview | Presentation 노드이고 outputData가 존재할 때 | 시각적 프리뷰 (테이블, 캐러셀, 차트 등). Output Data JSON은 Output 탭에서 확인 |
| Input | 항상 | 노드에 전달된 inputData를 JSON 뷰어로 표시. 폴링으로 데이터 수신 전에는 "Loading..." 표시 |
| Output | 항상 | 노드의 outputData를 JSON 뷰어로 표시 |
| Error | 에러가 존재할 때만 | 에러 정보를 JSON 뷰어로 표시 |

**디폴트 탭 선택 우선순위** (타임라인에서 노드 클릭 시):
1. Error — 에러가 있으면 최우선
2. Preview — Presentation 노드이고 outputData가 있을 때
3. Output — 그 외

**대기 상태(waiting_for_input) 노드의 탭:**
- Form 입력 대기: Preview 탭에 인터랙티브 폼 UI 표시, Input/Output 탭도 접근 가능
- 버튼 대기: Preview 탭에 렌더링된 콘텐츠 + 버튼 바 표시, Input/Output 탭도 접근 가능
- 디폴트 탭: Preview (인터랙티브 콘텐츠가 있으므로)

**탭이 표시되지 않는 경우:**
- running/pending 상태 노드 → 기존 flat 레이아웃 (탭 없음)
- AI 대화 중 / 완료된 AI Agent → ConversationInspector 유지 (기존 정책)

**inputData 데이터 흐름:**
- WebSocket 이벤트에는 inputData가 포함되지 않음
- REST 폴링(2초 간격)을 통해 inputData가 NodeResult에 반영됨
- 늦게 도착하는 WS 이벤트가 이미 수신된 inputData를 덮어쓰지 않도록 머지 시 보존

**Presentation 노드 콘텐츠**:

| 노드 유형 | 렌더링 |
|-----------|--------|
| Carousel | 가로 스크롤 카드 리스트 — 이미지, 제목, 설명 표시 |
| Carousel (버튼 대기 중) | 카드 리스트 + **버튼 바** — port 버튼 클릭 시 `execution.click_button` WS 명령, link 버튼 클릭 시 새 탭 URL 열기. link 전용 시 암시적 `[Continue →]` 표시. 타임아웃 설정 시 잔여 시간 카운트다운 |
| Carousel (버튼 클릭 후) | 클릭된 버튼 라벨 + 클릭 시각/클릭자 정보 표시 |
| Table | 테이블 — 컬럼 헤더, 행 데이터 (최대 50행 표시) |
| Table (버튼 대기 중) | 테이블 + **버튼 바** — Carousel 버튼 대기와 동일한 인터랙션 |
| Table (버튼 클릭 후) | 클릭된 버튼 라벨 + 클릭 시각/클릭자 정보 표시 |
| Chart | 렌더링된 HTML 차트 (DOMPurify sanitize 적용) |
| Chart (버튼 대기 중) | 차트 + **버튼 바** — Carousel 버튼 대기와 동일한 인터랙션 |
| Chart (버튼 클릭 후) | 클릭된 버튼 라벨 + 클릭 시각/클릭자 정보 표시 |
| Template | outputFormat에 따라 HTML 렌더링 또는 텍스트 코드 블록 |
| Template (버튼 대기 중) | 렌더링된 콘텐츠 + **버튼 바** — Carousel 버튼 대기와 동일한 인터랙션 |
| Template (버튼 클릭 후) | 클릭된 버튼 라벨 + 클릭 시각/클릭자 정보 표시 |
| PDF | 파일명 + 다운로드/열기 링크 |
| Form (대기 중) | **인터랙티브 폼 UI** — 제목, 설명, 필드 목록 (동적 생성), Submit 버튼. 제출 시 `execution.submit_form` WS 명령 전송 |
| Form (제출 후) | 제출된 데이터를 키-값 형태로 표시 |

**AI Agent Multi Turn 콘텐츠:**

타임라인에서 대화 항목을 클릭하면 인스펙터에 해당 항목의 상세 내용 표시:

| 클릭 대상 | 인스펙터 |
|-----------|----------|
| AI Agent 부모 노드 | 요약 (Model, Turns, Tokens, Tool Calls, RAG Sources, End Reason) + 최종 응답 + raw JSON |
| 사용자 메시지 | 전체 메시지 텍스트 |
| AI 응답 | 전체 응답 텍스트 + 해당 턴 메타데이터 (tokens, tool calls, RAG chunks) |
| Tool 호출 | Tool 이름 + Arguments JSON + Result JSON |

대화 진행 중(Live): 인스펙터 하단에 메시지 입력 UI sticky 고정 (textarea + Send + End). AI 응답 대기 중 입력 비활성 + 로딩 표시. 타임라인 어디를 클릭하든 입력 영역 유지.

**Non-Presentation 노드 콘텐츠** (Generic Renderer):

| 요소 | 설명 |
|------|------|
| 에러 표시 | 실패 시 에러 메시지 강조 표시 (빨간 배경) |
| 상태/실행시간 | Status + Duration 텍스트 |
| Output | 접기/펼치기 가능한 JSON 뷰어 — 노드의 outputData를 구조화된 JSON으로 표시 |

**노드 미선택 시**: "Select a node to view details" placeholder 표시.

### 10.7 상태 바

```
🔄 Running...   3/10 nodes                     [−] [✕]
✅ Completed    10/10 nodes                     [−] [✕]
⏸ Waiting for input...   5/10 nodes            [−] [✕]
❌ Failed       5/10 nodes (1 failed)           [−] [✕]
```

### 10.8 라이프사이클

| 이벤트 | 드로어 동작 |
|--------|------------|
| 실행 시작 | 드로어 표시, 타임라인 비움. "Waiting for nodes..." 메시지 표시 |
| 노드 실행 시작 | 타임라인에 running 상태로 항목 추가 + 자동 스크롤 |
| 노드 실행 완료 | 타임라인 항목 상태 업데이트 (completed/failed/skipped) |
| Form 노드 `waiting_for_input` 진입 | 해당 노드 자동 선택, 상세 뷰에 폼 UI 표시 |
| Form 제출 | 실행 재개, 상태 바 "🔄 Running..." |
| Presentation 노드 (버튼) `waiting_for_input` 진입 | 해당 노드 자동 선택, 상세 뷰에 렌더링된 콘텐츠 + 버튼 바 표시. 캔버스에서 `⏸` 아이콘 + 핑크 보더 펄스 |
| 버튼 클릭 (port) | `execution.click_button` WS 명령 전송, 해당 포트로 실행 재개, 상태 바 "🔄 Running..." |
| 버튼 클릭 (link) | 새 탭에서 URL 열기, 실행 상태 변경 없음 |
| Continue 클릭 | `execution.click_button` (`__continue__`) 전송, `continue` 포트로 실행 재개 |
| 버튼 타임아웃 | `buttonTimeoutAction`에 따라 `continue` 포트로 재개 또는 실행 취소. "Timed out" 표시 |
| AI Agent Multi Turn `waiting_for_input` 진입 | 해당 노드 자동 선택 + 펼침, 타임라인에 대화 프리뷰 표시, 인스펙터에 입력 UI 표시 |
| Multi Turn 사용자 메시지 전송 | 타임라인에 사용자 메시지 optimistic 추가, 인스펙터 입력 비활성 |
| Multi Turn AI 응답 수신 (`execution.ai_message`) | 타임라인에 AI 응답 + Tool 항목 추가, 인스펙터 입력 재활성 |
| Multi Turn 대화 종료 (End / maxTurns / timeout) | 실행 재개, 상태 바 "🔄 Running..." |
| 완료된 Multi Turn 노드 클릭 (히스토리) | 접힘/펼침 전환, 대화 이력 프리뷰 표시, 입력 영역 없음 |
| 실행 완료 | 드로어 유지. 타임라인에서 노드 클릭하여 결과 탐색 |
| 실행 실패 | 드로어 유지. 실패 시점까지의 노드 히스토리 표시 |
| 새 실행 시작 | 이전 히스토리 클리어, 드로어 리셋 |
| 드로어 닫기 (`[✕]`) | 실행 상태 리셋 |
| 노드 없는 실행 | "No nodes executed" 메시지 표시 |

### 10.9 Loop/ForEach 내 Presentation 노드

컨테이너(Loop, ForEach) 내부의 Presentation 노드가 반복 실행되는 경우:

- 타임라인 항목에 이터레이션 표시: `"Table (Iteration 3/5)"`
- 기본적으로 최신(마지막) 이터레이션 결과를 표시
- 상세 뷰에 이터레이션 드롭다운으로 이전 결과 탐색 가능

### 10.10 실행 히스토리와의 연동

실행 히스토리(§7)에서 과거 실행을 클릭하면, 해당 실행의 모든 노드 결과로 드로어를 채운다. "이 입력으로 다시 실행" 시 드로어는 리셋된다.

### 10.11 설정 패널과의 공존

Run Results 드로어와 우측 설정 패널은 동시에 표시될 수 있다. 설정 패널은 우측에, 드로어는 하단에 위치하여 캔버스 영역이 수직으로 축소된다.

### 10.12 단축키

| 단축키 | 동작 |
|--------|------|
| Ctrl + Shift + R | Run Results 드로어 토글 (열기/닫기) |
| Escape (드로어 포커스 시) | 캔버스로 포커스 복귀 |

### 10.13 노드 결과 수집

WebSocket `node.started`, `node.completed`, `node.failed`, `node.skipped` 이벤트에 `nodeType`, `nodeLabel`, `output` 필드가 포함된다. 클라이언트는 모든 노드 이벤트를 수신하여 타임라인에 추가한다. REST polling을 통해서도 node relation이 포함된 `NodeExecution` 데이터를 받아 동기화한다.
