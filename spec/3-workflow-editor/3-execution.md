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
┌──────────────────────────────────────────────────┐
│  ⏸ Waiting for input at "Approval Form"          │
│                            [Open Form] [■ Stop]   │
└──────────────────────────────────────────────────┘
```

- 캔버스에서 Form 노드에 입력 대기 아이콘(⏸) 표시 + 핑크 테두리 펄스 애니메이션
- [Open Form] 버튼 클릭 시 폼 모달 또는 새 탭으로 폼 UI 표시
- 폼 제출 후 실행 자동 재개, 상태 바가 "▶ Running..." 으로 전환

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

Presentation 노드의 실행 결과는 렌더링된 형태로 표시된다:

| 노드 유형 | 결과 렌더링 |
|-----------|------------|
| Carousel | 슬라이드 형태로 카드 렌더링, 좌/우 탐색 |
| Table | 테이블 형태로 렌더링, 컬럼 헤더 + 행 데이터 표시 |
| Chart | SVG 차트 렌더링, 인터랙티브 호버 |
| Template | outputFormat에 따라 HTML 렌더링 또는 Markdown/텍스트 표시 |
| PDF | 썸네일 미리보기 + [다운로드] 버튼 + [새 탭에서 열기] 링크 |
| Form | 제출된 데이터를 키-값 형태로 표시 |

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
| `execution.waiting_for_input` | executionId, nodeId, formConfig | Form 노드에서 사용자 입력 대기 |

### 8.2 WebSocket 명령 (클라이언트 → 서버)

| 명령 | 데이터 | 설명 |
|------|--------|------|
| `execution.start` | workflowId, input, fromNodeId? | 실행 시작 |
| `execution.stop` | executionId, force? | 실행 중단 |
| `execution.continue` | executionId | 브레이크포인트 후 계속 |
| `execution.step` | executionId | 한 노드만 실행 |
| `execution.submit_form` | executionId, nodeId, formData | Form 노드에 사용자 입력 제출 |

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
