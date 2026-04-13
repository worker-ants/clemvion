# Spec: 캔버스 인터랙션 상세

> 관련 문서: [PRD 워크플로우 에디터](../../prd/2-workflow-editor.md) · [Spec 노드 공통](./1-node-common.md) · [Spec 엣지](./2-edge.md) · [Spec 실행/디버깅](./3-execution.md)

---

## 1. 에디터 전체 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│  ← Workflows / My Workflow        [Save] [▶ Run] [⋮]       │
│  ┌─────┬─────────────────────────────────────────┬────────┐ │
│  │Node │                                         │Setting │ │
│  │Palet│         Canvas                          │ Panel  │ │
│  │te   │                                         │        │ │
│  │     │    ┌──────┐    ┌──────┐                 │ (노드  │ │
│  │Logic│    │Node A│───→│Node B│                 │ 선택시)│ │
│  │ if  │    └──────┘    └──┬───┘                 │        │ │
│  │ sw  │                   │                     │        │ │
│  │ lp  │              ┌────▼───┐                 │        │ │
│  │ ... │              │Node C  │                 │        │ │
│  │     │              └────────┘                 │        │ │
│  │     │                                         │        │ │
│  │Flow │                                         │        │ │
│  │ wf  │                                         │        │ │
│  │     │                                         │        │ │
│  │AI   │                                         │        │ │
│  │ ag  │    ┌──────────────────────┐             │        │ │
│  │ tc  │    │     Minimap          │             │        │ │
│  │ ie  │    └──────────────────────┘             │        │ │
│  ├─────┴─────────────────────────────────────────┴────────┤ │
│  │  Run Results (실행 시)                        [−] [✕]  │ │
│  │  [📋 Table] [📊 Chart] [📄 PDF] ...                    │ │
│  │  (렌더링된 Presentation 노드 결과)                      │ │
│  └────────────────────────────────────────────────────────┘ │
│  [Zoom -] ━━━━●━━━━ [Zoom +]  [Fit]  [Undo] [Redo]         │
└──────────────────────────────────────────────────────────────┘

> Run Results 드로어는 워크플로우 실행 시에만 표시된다. 상세는 [실행/디버깅 §10. Run Results Drawer](./3-execution.md#10-run-results-drawer) 참조.
```

---

## 2. 에디터 헤더

| 요소 | 설명 |
|------|------|
| 뒤로가기(←) | 워크플로우 목록으로 이동 (변경사항 있으면 저장 확인) |
| 브레드크럼 | "Workflows / {워크플로우 이름}" |
| 워크플로우 이름 | 인라인 편집 가능 (클릭 시 텍스트 필드 전환) |
| Save 버튼 | 수동 저장 (Ctrl+S). 변경사항 없으면 비활성 |
| Run 버튼 | 워크플로우 실행. 드롭다운으로 실행 옵션 제공 |
| 더보기(⋮) | 설정, 버전 히스토리, 내보내기, 가져오기, 삭제 |

### 2.1 Run 버튼 드롭다운

| 옵션 | 설명 |
|------|------|
| Run | 전체 워크플로우 실행 |
| Run with Input | 테스트 입력 데이터 설정 후 실행 |
| Run from Selected | 선택된 노드부터 실행 |

---

## 3. 캔버스 인터랙션

### 3.1 뷰포트 제어

| 인터랙션 | 동작 |
|----------|------|
| 마우스 드래그 (빈 영역) | 캔버스 패닝 |
| 마우스 휠 | 줌 인/아웃 (줌 센터: 커서 위치) |
| Ctrl + 휠 | 줌 인/아웃 (대안) |
| 핀치 (트랙패드) | 줌 인/아웃 |
| 줌 슬라이더 | 하단 바의 슬라이더로 줌 레벨 조정 |
| Fit 버튼 | 모든 노드가 보이도록 뷰포트 자동 조정 |
| 줌 범위 | 최소 25% ~ 최대 200% |
| 더블클릭 (빈 영역) | 노드 추가 검색 팝업 열기 |

### 3.2 선택

| 인터랙션 | 동작 |
|----------|------|
| 노드 클릭 | 해당 노드 선택. 이전 선택 해제 |
| Shift + 클릭 | 기존 선택에 노드 추가/제거 (토글) |
| 빈 영역 드래그 | 선택 영역(Lasso) 생성 → 포함된 노드 모두 선택 |
| Ctrl + A | 모든 노드 선택 |
| Escape | 선택 해제 |
| 빈 영역 클릭 | 선택 해제, 설정 패널 닫기 |

### 3.3 노드 조작

| 인터랙션 | 동작 |
|----------|------|
| 팔레트에서 드래그 | 캔버스에 새 노드 추가 (드롭 위치에 배치) |
| 노드 드래그 | 노드 이동 (그리드 스냅 적용) |
| 다중 선택 후 드래그 | 선택된 모든 노드 동시 이동 |
| Ctrl + C | 선택된 노드(+연결된 엣지) 복사 |
| Ctrl + V | 복사된 노드 붙여넣기 (원본 옆에 오프셋 배치) |
| Ctrl + D | 선택된 노드 즉시 복제 |
| Delete / Backspace | 선택된 노드 삭제 (연결된 엣지도 함께 삭제) |
| 노드 더블클릭 | 설정 패널 열기 (또는 단일 클릭으로) |
| 우클릭 | 컨텍스트 메뉴 |
| 컨테이너 멤버십 | **엣지 기반** — body/emit/chain 엣지로 자동 지정/해제. 드래그-드롭으로 컨테이너 안에 넣는 UX는 없음. 자세한 규칙은 §11.2.1 참조 |
| Tool Area에 드래그 | 노드를 AI Agent의 Tool Area에 드롭 → Tool 등록 (tool_owner_id 설정). 기존 데이터 흐름 엣지 자동 제거 |

### 3.4 노드 컨텍스트 메뉴 (우클릭)

| 항목 | 단축키 | 설명 |
|------|--------|------|
| 설정 열기 | Enter | 노드 설정 패널 |
| 실행 | — | 이 노드만 테스트 실행 |
| 여기서부터 실행 | — | 이 노드부터 워크플로우 실행 |
| 복제 | Ctrl+D | 노드 복제 |
| 비활성화/활성화 | — | 노드 토글 |
| 삭제 | Delete | 노드 삭제 |

### 3.5 캔버스 컨텍스트 메뉴 (빈 영역 우클릭)

| 항목 | 설명 |
|------|------|
| 노드 추가 | 노드 검색 팝업 (클릭 위치에 노드 배치) |
| 붙여넣기 | 클립보드의 노드 붙여넣기 |
| 전체 선택 | 모든 노드 선택 |
| 맞춤 보기 | Fit to View |

---

## 4. 노드 팔레트 (좌측 패널)

### 4.1 구조

```
┌──────────────────┐
│ 🔍 Search nodes  │
├──────────────────┤
│ ⏱ Recent         │
│   If/Else        │
│   AI Agent       │
├──────────────────┤
│ ▼ Trigger        │
│   Manual Trigger │
├──────────────────┤
│ ▼ Logic          │
│   If/Else        │
│   Switch         │
│   Loop           │
│   Variable Decl  │
│   Variable Mod   │
│   Split          │
│   Map            │
│   ForEach        │
│   Parallel       │
│   Merge          │
│   Background     │
├──────────────────┤
│ ▼ Flow           │
│   Workflow       │
├──────────────────┤
│ ▼ AI             │
│   AI Agent       │
│   Text Classifier│
│   Info Extractor │
├──────────────────┤
│ ▼ Integration    │
│   HTTP Request   │
│   Database Query │
│   Slack          │
│   Google Sheets  │
│   GitHub         │
│   Send Email     │
│   Google Drive   │
├──────────────────┤
│ ▼ Data           │
│   Transform      │
│   Code           │
├──────────────────┤
│ ▼ Presentation   │
│   Carousel       │
│   Table          │
│   Chart          │
│   Form           │
│   Template       │
│   PDF            │
├──────────────────┤
│ ▼ Installed      │
│   (마켓플레이스   │
│    노드 표시)    │
└──────────────────┘
```

### 4.2 동작

| 동작 | 설명 |
|------|------|
| 검색 | 노드 이름 실시간 필터링 |
| 카테고리 접기/펼치기 | 섹션 헤더 클릭 |
| 드래그 | 캔버스로 드래그하여 노드 추가 |
| 클릭 | 캔버스 중앙(또는 빈 영역)에 노드 추가 |
| 패널 접기 | 토글 버튼으로 팔레트 숨기기/표시 |

### 4.3 빠른 노드 추가 팝업

캔버스 빈 영역 더블클릭 시 검색 팝업 표시:

```
┌────────────────────────┐
│ 🔍 Add node...         │
│ ┌────────────────────┐ │
│ │ If/Else (Logic)    │ │
│ │ AI Agent (AI)      │ │
│ │ Switch (Logic)     │ │
│ │ ...                │ │
│ └────────────────────┘ │
└────────────────────────┘
```

- 타이핑 즉시 필터링
- Enter로 선택, 커서/클릭 위치에 노드 배치
- Escape로 취소

---

## 5. 노드 시각적 표현

### 5.1 노드 외형

```
     ┌──────────────────────────┐
  ●──│  🔀 If/Else              │──● (True)
     │  "Check user role"       │──● (False)
     └──────────────────────────┘
  입력     노드 본체           출력 포트
  포트
```

| 요소 | 설명 |
|------|------|
| 입력 포트(●) | 좌측. 회색. 연결 가능 시 하이라이트 |
| 출력 포트(●) | 우측. 유형에 따라 복수 개 (라벨 표시). 색상은 포트 유형별로 구분: 데이터 포트=초록, 시스템 포트=파랑, 에러 포트=빨강 |
| 카테고리 색상 | 상단 바 또는 좌측 바. Logic=파랑, Flow=보라, AI=초록 |
| 아이콘 | 노드 유형별 고유 아이콘 |
| 이름 | 첫 줄: 노드 유형명 |
| 레이블 | 둘째 줄: 사용자 지정 이름 (있을 경우) |

### 5.2 노드 상태 표시

| 상태 | 시각 효과 |
|------|-----------|
| 기본 | 일반 표시 |
| 선택됨 | 두꺼운 테두리 + 그림자 |
| 비활성(Disabled) | 반투명 + 사선(대각선) 패턴 오버레이 |
| 실행 대기 | — (변화 없음) |
| 실행 중 | 테두리 펄스 애니메이션 (파랑) |
| 성공 | 하단 초록 체크 아이콘 (일정 시간 후 페이드) |
| 실패 | 빨강 테두리 + 에러 아이콘. 클릭 시 에러 상세 |
| 건너뜀 | 회색 처리 |
| Presentation 완료 | 노드 우하단에 👁 아이콘 배지. 클릭 시 Run Results 드로어 열기 + 해당 탭 선택 |

### 5.3 노드 설정 요약 (Configuration Summary)

노드 본체에 3번째 줄로 설정 요약 텍스트를 표시한다. 설정 패널을 열지 않고도 노드의 핵심 설정을 캔버스에서 파악할 수 있다.

#### 5.3.1 시각적 표현

```
     ┌──────────────────────────────────┐
  ●──│  🌐 HTTP Request                 │──● (Success)
     │  "Fetch user"                    │──● (Error)
     │  GET https://api.example.c...    │  ← 설정 요약 (3번째 줄)
     └──────────────────────────────────┘

     ┌──────────────────────────────────┐
  ●──│  🤖 AI Agent                     │──●
     │  "Customer Bot"                  │
     │  gpt-4o · 2 tools · 1 KB        │
     └──────────────────────────────────┘

     ┌──────────────────────────────────┐
  ●──│  📧 Send Email                   │──●
     │                                  │
     │  ⚠ Not configured               │  ← 미설정 경고 (앰버색)
     └──────────────────────────────────┘
```

| 요소 | 설명 |
|------|------|
| 위치 | 노드 본체의 3번째 줄 (아이콘+유형명, 사용자 레이블 아래) |
| 폰트 | 기본 텍스트보다 작은 크기, 뮤트(muted) 색상 |
| 최대 길이 | 40자. 초과 시 `text-overflow: ellipsis` |
| 툴팁 | 요약 텍스트가 잘린 경우 호버 시 전체 텍스트 툴팁 표시 |
| 줌 의존성 | 줌 50% 미만에서는 요약 줄 숨김 (아이콘+유형명+레이블만 표시) |
| 인터랙션 | 표시 전용. 클릭 시 기존과 동일하게 설정 패널 열기 |
| 업데이트 | config 변경 시 실시간 업데이트 (자동 저장 디바운스와 동일, 2초) |

#### 5.3.2 미설정 상태

필수 설정이 완료되지 않은 노드:

| 항목 | 설명 |
|------|------|
| 표시 | 헤더 우측에 `AlertTriangle` 아이콘(`text-white/70`, hover 시 `text-white` 전환) + hover 시 툴팁으로 **구체적 누락 항목** 표시. **모든 노드 유형(일반/컨테이너) 동일하게 헤더 아이콘으로 통일**. 접근성을 위해 아이콘은 `aria-label="warning"` |
| 조건 | 노드의 필수 config 필드가 하나 이상 비어 있을 때 |
| 예외 | Manual Trigger — config 없으므로 아이콘 표시 안 함 |
| 선택적 필드만 | 모든 필드가 선택적이면 정상 summary(일반 노드는 body, 컨테이너는 헤더 텍스트) 표시 |

##### 노드별 미설정 경고 메시지

각 노드 유형은 어떤 필수 항목이 누락되었는지를 구체적으로 안내한다:

| 노드 | 경고 메시지 | 누락 조건 |
|------|-------------|-----------|
| If/Else | `⚠ Condition not set` | conditions 미설정 |
| Switch | `⚠ Switch value not set` | switchValue 미설정 |
| Loop | `⚠ Count not set` | count 미설정 |
| Variable Declaration | `⚠ No variables defined` | variables 미설정 |
| Variable Modification | `⚠ Variable not selected` | modifications 미설정 |
| Split | `⚠ Field path not set` | fieldPath 미설정 |
| Map | `⚠ Input field not set` | inputField 미설정 |
| ForEach | `⚠ Array field not set` | arrayField 미설정 |
| Merge | `⚠ Input count and strategy not set` / `⚠ Strategy not set` / `⚠ Input count not set` | 각 필드 누락 조합별 |
| Filter | `⚠ Input field not set` | inputField 미설정 |
| Workflow | `⚠ Workflow not selected` | workflowId 미설정 |
| HTTP Request | `⚠ URL not set` | url 미설정 |
| Database Query | `⚠ Query not set` | query 미설정 |
| Slack | `⚠ Action not selected` | action 미설정 |
| Send Email | `⚠ Recipient not set` | to 미설정 |
| Transform | `⚠ No operations defined` | operations 미설정 |
| Code | `⚠ Code not written` | code 미설정 |
| Table | `⚠ Columns not defined` | columns 미설정 |
| Chart | `⚠ Chart type not selected` / `⚠ Axis fields not set` | chartType 또는 axis 누락 |
| Form | `⚠ No fields defined` | fields 미설정 |
| Template | `⚠ Template not set` | template 미설정 |
| PDF | `⚠ Template not set` | template 미설정 |
| AI Agent | `⚠ Model not selected` / `⚠ Default provider not configured` | model 및 llmConfigId 미설정 시 "Model not selected". "Default provider" 선택(`llmConfigId=""`) 시 LLM Config에서 실제 default 존재 여부를 확인하여 없으면 "Default provider not configured" 표시 |
| Text Classifier | `⚠ Model not selected` / `⚠ Default provider not configured` / `⚠ Categories not defined` | AI Agent와 동일한 LLM provider 규칙 적용 + categories 누락 시 별도 경고 |
| Info Extractor | `⚠ Model not selected` / `⚠ Default provider not configured` / `⚠ Output schema not defined` | AI Agent와 동일한 LLM provider 규칙 적용 + outputSchema 누락 시 별도 경고 |

#### 5.3.3 컨테이너 노드 요약

컨테이너 노드(Loop, ForEach, Map, Background[🚧 미구현])는 헤더 바의 사용자 레이블 우측에 요약을 표시한다:

```
┌─────────────────────────────────────────────────┐
│ 🔄 Loop "Process Items"  10x · break   [−] ▼ ⋮ │
│ ──────────────────────────────────────── │
│   ...child nodes...                             │
└─────────────────────────────────────────────────┘
```

#### 5.3.4 노드별 요약 포맷

각 노드 유형의 요약 포맷은 해당 노드 스펙 문서에 "캔버스 요약" 항목으로 정의된다. 전체 목록은 [노드 개요 §1.2 summaryTemplate](../4-nodes/0-overview.md#12-노드-정의definition-속성) 참조.

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Manual Trigger | (표시 안 함) | — |
| If/Else | `{조건식}` (첫 번째 조건) | `role == "admin"` |
| Switch | `{값} → {N} cases` | `$input.type → 3 cases` |
| Loop | `{count}x` + break 표시 | `10x · break condition` |
| Variable Declaration | 변수명 나열 (최대 3개, 초과 시 `+N`) | `counter, total, +1` |
| Variable Modification | `{변수} {연산}` | `counter increment` |
| Split | `{필드경로}` | `$input.items` |
| Map | `{inputField}` | `$input.items` |
| ForEach | `{배열필드}` + 에러정책 | `$input.items · skip errors` |
| Parallel | `{N} branches` | `3 branches` |
| Merge | `{N} inputs · {전략}` | `3 inputs · wait_all` |
| Background _(🚧 미구현)_ | 알림 채널 | `notify: slack` |
| Workflow | `{워크플로우 이름} · {모드}` | `Data Pipeline · sync` |
| AI Agent | `{모델} · {N} tools · {N} KB` | `gpt-4o · 2 tools · 1 KB` |
| Text Classifier | `{모델} · {N} categories` | `gpt-4o-mini · 3 categories` |
| Info Extractor | `{모델} · {N} fields` | `claude-sonnet · 4 fields` |
| HTTP Request | `{METHOD} {url}` | `GET https://api.exam...` |
| Database Query | `{queryType} · {쿼리 첫줄}` | `SELECT · SELECT * FROM us...` |
| Slack | `{action} · {채널}` | `send_message · #general` |
| Google Sheets | `{action} · {range}` | `read_rows · Sheet1!A1:D10` |
| GitHub | `{action} · {owner/repo}` | `create_issue · acme/app` |
| Send Email | `to: {수신자}` | `to: user@exam..., +2` |
| Google Drive | `{action} · {경로}` | `upload_file · /reports` |
| Transform | `{N} operations` | `3 operations` |
| Code | `{language} · {N} lines` | `JavaScript · 12 lines` |
| Carousel | `{layout} · {titleField}` | `card · name` |
| Table | `{N} columns` + pagination 표시 | `3 columns · pagination` |
| Chart | `{chartType} · {x}/{y}` | `bar · month / revenue` |
| Form | `{N} fields · "{title}"` | `3 fields · "Approval"` |
| Template | `{format} · {N} lines` | `html · 9 lines` |
| PDF | `{size} {방향} · {파일명}` | `A4 portrait · report.pdf` |

#### 5.3.5 엣지 케이스

| 케이스 | 동작 |
|--------|------|
| 표현식 사용 | 표현식 텍스트 그대로 표시: `{{ $input.role }}` (잘림 적용) |
| 삭제된 Integration 참조 | `⚠ Missing integration` (앰버색) |
| 삭제된 Workflow 참조 | `⚠ Missing workflow` (앰버색) |
| 커스텀/마켓플레이스 노드 | configSchema의 첫 2개 필드를 `key: value` 형태로 표시 |
| 사용자 레이블 미설정 | 2번째 줄(레이블)이 없으면 요약이 2번째 줄로 올라감 |

### 5.4 노드 삭제 버튼

노드에 시각적 삭제 버튼을 제공하여 우클릭 메뉴나 키보드 단축키 없이도 직관적으로 노드를 삭제할 수 있다.

#### 5.4.1 시각적 표현

노드 우상단 외곽에 20×20px 원형 버튼(✕ 아이콘)을 표시한다. 기본 배경은 뉴트럴 그레이, 호버 시 빨간색으로 변경된다.

```
                                    ╭───╮
     ┌──────────────────────────────┤ ✕ ├
  ●──│  🔀 If/Else                  ╰───╯──● (True)
     │  "Check user role"               │──● (False)
     │  role == "admin"                  │
     └──────────────────────────────────┘
```

#### 5.4.2 표시 조건

| 조건 | 삭제 버튼 |
|------|-----------|
| 마우스 호버 시 | fade in (200ms 트랜지션) |
| 마우스 호버 해제 | fade out (200ms). 단, 노드가 선택 상태이면 유지 |
| 노드 선택 상태 | 항상 표시 (호버 없이도) |
| Manual Trigger 노드 | **표시 안 함** (삭제 불가 제약, §9.2) |
| 워크플로우 실행 중 | **숨김** (실행 중 편집 차단) |
| 비활성(Disabled) 노드 | 표시 (삭제 허용) |
| 다중 선택 상태 | 각 노드에 개별 표시. 클릭 시 해당 노드만 삭제 (전체 선택 삭제는 Delete 키 사용) |
| 터치 디바이스 | 탭(선택) 시 표시, 다른 노드 탭 또는 캔버스 탭 시 숨김 |

#### 5.4.3 동작

| 항목 | 설명 |
|------|------|
| 클릭 | 노드 즉시 삭제 (Delete 키와 동일 동작: 연결된 엣지도 함께 삭제) |
| Undo | Ctrl+Z로 복원 가능 (기존 Undo 메커니즘과 동일) |
| 우클릭 메뉴 | 기존 "삭제" 항목 유지 (삭제 버튼은 추가 어포던스) |

---

## 6. 하단 툴바

```
[−] ━━━━━●━━━━━ [+]  100%  │  [Fit]  │  [↩ Undo] [↪ Redo]
```

| 요소 | 설명 |
|------|------|
| 줌 슬라이더 | 25% ~ 200% |
| 줌 퍼센트 | 현재 줌 레벨 표시 |
| Fit 버튼 | 전체 맞춤 보기 |
| Undo (Ctrl+Z) | 실행 취소 |
| Redo (Ctrl+Y) | 다시 실행 |

---

## 7. 미니맵

- 캔버스 우하단에 작은 오버레이로 표시
- 전체 워크플로우의 조감도
- 현재 뷰포트 영역을 사각형으로 표시
- 미니맵 내 클릭/드래그로 뷰포트 이동
- 토글 버튼으로 표시/숨김

---

## 8. 자동 저장

| 항목 | 설명 |
|------|------|
| 트리거 | 노드 추가/삭제/이동, 엣지 변경, 설정 변경 후 디바운스 (2초) |
| 저장 표시 | 헤더에 "Saving..." → "Saved" 상태 텍스트 |
| 충돌 처리 | 동시 편집 시 마지막 저장 우선. 충돌 감지 시 알림 |
| 오프라인 | 로컬 스토리지에 임시 저장. 온라인 복구 시 서버 동기화 |

### 8.1 자동 저장과 버전의 관계

자동 저장과 버전 스냅샷은 별도의 메커니즘이다. 자동 저장은 작업 유실 방지를 위한 것이며, 버전은 의미 있는 시점의 스냅샷이다.

| 동작 | 자동 저장 | 버전 생성 |
|------|-----------|-----------|
| 노드/엣지/설정 변경 | O (2초 디바운스) | X |
| 수동 저장 (Ctrl+S) | O (즉시) | O — 변경사항이 있을 경우에만 |
| 워크플로우 실행 | O (실행 전 저장) | O — 실행 직전 스냅샷 |
| 버전 복원 | O (복원 내용 저장) | O — 복원 시점 기록 |

- 자동 저장은 Workflow 테이블의 현재 상태를 직접 업데이트 (WorkflowVersion 생성 안 함)
- 수동 저장/실행 시에만 WorkflowVersion 레코드 생성
- 버전에는 자동 생성된 `change_summary` 포함 (예: "노드 3개 추가, 엣지 2개 수정")

---

## 9. 시작 노드 (Manual Trigger)

### 9.1 자동 생성

| 항목 | 설명 |
|------|------|
| 생성 시점 | 새 워크플로우 생성 시 서버에서 자동 생성 |
| 기본 위치 | positionX: 250, positionY: 300 |
| 노드 타입 | `manual_trigger` (카테고리: trigger) |
| 포트 | 입력 포트 없음, 출력 포트 1개 (Output) |

### 9.2 제약

| 항목 | 설명 |
|------|------|
| 삭제 불가 | 사용자가 Manual Trigger 노드를 삭제할 수 없음 |
| 중복 불가 | 워크플로우당 1개만 존재. 팔레트에서 추가 드래그 시 무시 |
| 실행 시 역할 | 워크플로우 입력 데이터를 그대로 출력 포트로 전달 (pass-through) |

---

## 10. 키보드 단축키 요약

| 단축키 | 동작 |
|--------|------|
| Ctrl + S | 저장 |
| Ctrl + Z | Undo |
| Ctrl + Y / Ctrl + Shift + Z | Redo |
| Ctrl + C | 복사 |
| Ctrl + V | 붙여넣기 |
| Ctrl + D | 복제 |
| Ctrl + A | 전체 선택 |
| Delete / Backspace | 선택 항목 삭제 |
| Escape | 선택 해제 |
| Space + 드래그 | 캔버스 패닝 (대안) |
| Ctrl + + / - | 줌 인/아웃 |
| Ctrl + 0 | 줌 100% |
| Ctrl + 1 | Fit to View |
| Ctrl + Shift + R | Run Results 드로어 토글 |

---

## 11. 컨테이너 노드

Loop, ForEach, Map, Background[🚧 미구현] 노드는 **컨테이너**로 렌더링된다. 내부에 자식 노드를 배치할 수 있는 그룹이다. Loop/ForEach/Map은 body/emit/done 포트 모델 + emit 기반 결과 수집을 공유하고, Background는 spec-only로 도입 예정.

### 11.1 시각적 표현

```
┌─────────────────────────────────────────┐
│ 🔄 Loop "Process Items"    [−] ▼ ⋮     │  ← 헤더 바 (카테고리 색상)
│ ─────────────────────────────────────── │
│                                         │
│   ┌──────────┐    ┌──────────┐          │
│   │ Transform│───→│ HTTP Req │          │  ← 내부 자식 노드
│   └──────────┘    └──────────┘          │
│                                         │
└─────────────────────────────────────────┘
```

| 요소 | 설명 |
|------|------|
| 헤더 바 | 노드 아이콘 + 유형명 + 사용자 레이블. 카테고리 색상 배경 |
| 바디 영역 | 확장 가능한 사각형. 내부 노드를 자유롭게 배치 |
| 최소 크기 | 400×300px |
| 자동 확장 | 내부 노드 배치에 맞춰 자동 확장 (여백: 40px) |
| 입출력 포트 | 컨테이너 좌측(입력)과 우측(출력)에 표시. 일반 노드와 동일 |

### 11.2 인터랙션

| 인터랙션 | 동작 |
|----------|------|
| 헤더 드래그 | 컨테이너 노드 단독 이동 (자식과는 시각적으로 분리되어 있음) |
| 더블클릭 (헤더) | 컨테이너 설정 패널 열기 |

> **시각 containment 미사용**: 컨테이너는 기존 일반 노드와 동일한 크기로 렌더된다. 자식 노드는 캔버스 어디에든 자유롭게 배치할 수 있고, 컨테이너 멤버십은 데이터 모델(`containerId`)로만 표현된다. 노드 헤더 아래에 `in <Container Label>` 배지가 표시되어 어떤 컨테이너의 멤버인지 한눈에 확인 가능.

### 11.2.1 자동 containerId 동기화 (edge-driven)

`containerId`는 현재 엣지의 **순수 함수**로 매 변경 시 자동 재계산된다. 설정 패널에 수동 지정 UI는 없고, 모든 멤버십은 엣지로 표현된다.

**전파 규칙** (`onConnect` 및 workflow 로드 시 fixed-point 반복):

1. **Body 포트 (강제)**: `Container.body → X` 연결 시 X의 `containerId`를 컨테이너로 **강제 set**. X가 이미 **다른** 컨테이너에 속해 있으면 **엣지 생성 거부 + 토스트 경고** (예: `Cannot connect: "Code" is already a body child of "Loop". Detach it from "Loop" first.`).
2. **Emit 포트 (강제)**: `Y → Container.emit` 연결도 같은 규칙. Y가 다른 컨테이너면 거부 + 경고.
3. **Chain 전파**: 컨테이너 child인 A에서 `A → B` 연결 시 B의 `containerId`가 비어 있으면 동일 컨테이너로 전파. 양 끝이 서로 다른 컨테이너면 조용히 변경 없음 (충돌 회피).

**삭제 시 자동 unset**:

- `Container.body → X` 엣지를 삭제하면 X의 `containerId`가 자동으로 null이 된다 (단, X → `Container.emit` 엣지가 남아 있거나 chain 중간이라면 그쪽 규칙으로 유지).
- 컨테이너 노드 삭제, 자식 노드 삭제, chain 내 중간 엣지 삭제 모두 동일하게 **전체 재계산**되어 dangling containerId가 남지 않는다.

**Workflow load 시 자동 복구**: 저장된 데이터에 edge 없이 containerId만 남아 있어도 로드 시 재계산이 실행되어 정합성이 보장된다. 복구가 실제로 발생하면 `isDirty=true`로 표시되어 사용자가 저장해 고정할 수 있다.

### 11.2.2 제약

| 제약 | 동작 |
|------|------|
| 트리거 노드 child 금지 | trigger 카테고리 노드는 컨테이너 child가 될 수 없음. 엣지 자동 전파가 거부하고, 실행 시에도 백엔드가 `CONTAINER_INVALID_CHILD` 에러로 실패 |
| 자기 자신 child 금지 | 컨테이너는 자기 자신을 `containerId`로 가질 수 없음 |
| 자손 컨테이너 child 금지 | A의 자손 컨테이너 B를 다시 A의 부모로 지정하면 cycle. 실행 시 `CONTAINER_CYCLE` 에러로 거부 |
| Emit 필수 | 컨테이너 실행 시 `emit` 포트에 정확히 1개의 child 노드가 연결되어야 함 (`CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT`). emit 엣지는 있으나 source가 child가 아닌 경우 오류 메시지에 해당 노드 이름 + 해결 안내 포함 |
| Body 내부 제약 | back-edge(순환), blocking 노드(form/buttons/ai_conversation)는 컨테이너 body 내부에서 사용 불가 |

### 11.3 컨테이너 삭제

자식 노드가 있는 컨테이너 노드를 삭제할 때 확인 다이얼로그를 표시한다.

#### 11.3.1 확인 다이얼로그

```
┌──────────────────────────────────────┐
│  Delete Container                    │
│  ──────────────────────────────────  │
│  "Process Items" (Loop) contains     │
│  3 child nodes.                      │
│                                      │
│  ○ Delete container and all children │
│  ● Ungroup: keep children, remove   │
│    container only                    │
│                                      │
│  [Cancel]              [Delete]      │
└──────────────────────────────────────┘
```

#### 11.3.2 삭제 옵션

| 옵션 | 동작 |
|------|------|
| **Delete container and all children** | 컨테이너 노드 + 모든 자식 노드(container_id가 해당 컨테이너를 가리키는 노드) + 관련 엣지 모두 삭제 |
| **Ungroup** (기본 선택) | 컨테이너 노드만 제거. 자식 노드는 top-level로 승격 (`container_id = null`). 자식 노드 간 내부 엣지는 유지. 컨테이너의 `body`/`background` 포트에서 자식으로의 엣지만 제거 |
| **Cancel** | 취소 |

#### 11.3.3 빈 컨테이너

자식 노드가 없는 컨테이너는 확인 다이얼로그 없이 즉시 삭제한다.

#### 11.3.4 삭제 버튼 위치

컨테이너 노드의 삭제 버튼(✕)은 헤더 바 우상단 외곽에 표시된다:

```
                                                     ╭───╮
┌────────────────────────────────────────────────────┤ ✕ ├
│ 🔄 Loop "Process Items"  10x · break   [−] ▼ ⋮    ╰───╯
│ ─────────────────────────────────────────────── │
│   ...child nodes...                             │
└─────────────────────────────────────────────────┘
```

### 11.4 중첩

| 항목 | 설명 |
|------|------|
| 중첩 허용 | 컨테이너 안에 다른 컨테이너 배치 가능 |
| 최대 중첩 깊이 | 3단계 |
| 레벨별 시각 구분 | 중첩 레벨마다 배경 틴트 변경 (L1: 5% 불투명도, L2: 10%, L3: 15%) |
| 초과 시 | 3단계 초과 중첩 시도 → "최대 중첩 깊이(3)를 초과할 수 없습니다" 토스트 |

---

## 12. AI Agent Tool Area

AI Agent 노드에 연결된 도구 노드를 시각적으로 관리하는 전용 영역.

### 12.1 시각적 표현

```
                          ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
┌──────────────────┐      ╎ Tools            [−]  ╎
│  🤖 AI Agent     │      ╎                       ╎
│  "Customer Bot"  │──────╎  ┌─────────────────┐  ╎
│                  │      ╎  │ 🌐 HTTP Request │  ╎
└──────────────────┘      ╎  │ "Ticket API"    │  ╎
                          ╎  ├─────────────────┤  ╎
                          ╎  │ 🗄️ DB Query     │  ╎
                          ╎  │ "Search DB"     │  ╎
                          ╎  └─────────────────┘  ╎
                          └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
```

| 요소 | 설명 |
|------|------|
| 위치 | AI Agent 노드 우측에 자동 배치 |
| 테두리 | 점선 테두리 (AI 카테고리 색상) |
| 타이틀 | "Tools" 헤더 |
| 도구 카드 | 등록된 노드를 컴팩트 카드(아이콘 + 이름)로 표시 |

### 12.2 인터랙션

| 인터랙션 | 동작 |
|----------|------|
| 노드 드래그 인 | 캔버스의 노드를 Tool Area에 드롭 → 도구로 등록. 기존 데이터 흐름 엣지 자동 제거 |
| 도구 드래그 아웃 | Tool Area에서 캔버스로 드래그 → 도구 등록 해제, 일반 노드로 복원 |
| 도구 카드 클릭 | 해당 노드의 설정 패널 열기 |
| 도구 카드 우클릭 | 컨텍스트 메뉴: 설정 열기, 등록 해제, 삭제 |
| 접기/펼치기 [−] | 접힌 상태: "Tools (N)" 배지만 표시 |

### 12.3 AI Agent 삭제 시 도구 처리

AI Agent 노드를 삭제할 때 Tool Area에 등록된 도구 노드가 있으면 확인 다이얼로그를 표시한다:

```
┌──────────────────────────────────────┐
│  Delete AI Agent                     │
│  ──────────────────────────────────  │
│  "Customer Bot" has 2 registered     │
│  tools in its Tool Area.             │
│                                      │
│  Tools will be unregistered and      │
│  converted back to regular nodes.    │
│                                      │
│  [Cancel]              [Delete]      │
└──────────────────────────────────────┘
```

| 항목 | 설명 |
|------|------|
| Delete 확인 | AI Agent 노드 삭제 + Tool Area 제거. 등록된 도구 노드는 등록 해제 (`tool_owner_id = null`)되어 일반 노드로 캔버스에 복원 |
| 도구 없는 경우 | 확인 다이얼로그 없이 즉시 삭제 |

### 12.4 제약

| 항목 | 설명 |
|------|------|
| 데이터 흐름 참여 | Tool Area 노드는 데이터 흐름 그래프에 참여하지 않음 (엣지 연결 불가) |
| 실행 방식 | AI Agent의 LLM이 도구 호출 시 on-demand로 실행 |
| 소속 | 하나의 노드는 하나의 AI Agent Tool Area에만 등록 가능 |
| 컨테이너 겸용 불가 | 컨테이너 내부 노드(container_id가 설정된 노드)는 Tool Area에 등록 불가 (역방향도 동일) |
