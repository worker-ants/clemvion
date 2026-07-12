---
id: canvas
status: partial
code:
  - codebase/frontend/src/components/editor/canvas/*.tsx
  - codebase/frontend/src/components/editor/canvas/quick-add-nav.ts
  - codebase/frontend/src/components/editor/palette/node-palette.tsx
  - codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx
  - codebase/frontend/src/components/editor/workflow-editor.tsx
  - codebase/frontend/src/lib/stores/editor-store.ts
  - codebase/frontend/src/lib/stores/recent-nodes-store.ts
  - codebase/frontend/src/lib/stores/palette-canvas-bridge.ts
pending_plans:
  - plan/in-progress/ai-agent-tool-connection-rewrite.md
  - plan/complete/spec-sync-canvas-gaps.md
---

# Spec: 캔버스 인터랙션 상세

> 관련 문서: [PRD 워크플로우 에디터](./_product-overview.md) · [Spec 노드 공통](./1-node-common.md) · [Spec 엣지](./2-edge.md) · [Spec 실행/디버깅](./3-execution.md) · [Spec AI Assistant](./4-ai-assistant.md)

---

## 1. 에디터 전체 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│  ← Workflows / My Workflow       [🤖] [Save] [▶ Run] [⋮]    │
│  ┌─────┬─────────────────────────────────────────┬────────┐ │
│  │Node │                                         │Setting │ │
│  │Palet│         Canvas                          │ Panel  │ │
│  │te   │                                         │   or   │ │
│  │     │    ┌──────┐    ┌──────┐                 │   AI   │ │
│  │Logic│    │Node A│───→│Node B│                 │Assist. │ │
│  │ if  │    └──────┘    └──┬───┘                 │ Panel  │ │
│  │ sw  │                   │                     │ (상호  │ │
│  │ lp  │              ┌────▼───┐                 │ 배타)  │ │
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
│  │  [📋 Table] [📊 Chart] [📄 Template] ...                │ │
│  │  (렌더링된 Presentation 노드 결과)                      │ │
│  └────────────────────────────────────────────────────────┘ │
│  [Zoom -] ━━━━●━━━━ [Zoom +]  [Fit]  [Undo] [Redo]         │
└──────────────────────────────────────────────────────────────┘

> Run Results 드로어는 워크플로우 실행 시에만 표시된다. 상세는 [실행/디버깅 §10. Run Results Drawer](./3-execution.md#10-run-results-drawer) 참조.
> 헤더의 🤖 버튼은 AI Assistant 패널 토글이다. 우측 사이드바는 Node Settings Panel과 상호 배타적으로 표시된다. 상세는 [AI Assistant §3.1](./4-ai-assistant.md#31-패널-위치크기) 참조.
```

---

## 2. 에디터 헤더

| 요소 | 설명 |
|------|------|
| 뒤로가기(←) | 워크플로우 목록으로 이동 (변경사항 있으면 저장 확인) |
| 브레드크럼 | "Workflows / {워크플로우 이름}" |
| 워크플로우 이름 | 인라인 편집 가능 (클릭 시 텍스트 필드 전환) |
| AI Assistant 버튼 (🤖) | 우측 AI Assistant 패널 토글. 활성 상태 시 강조. 상세: [AI Assistant Spec](./4-ai-assistant.md) |
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
| 줌 버튼 | 좌하단 오버레이의 줌아웃(−)·줌인(+) 버튼 + 줌 레벨 슬라이더 + 현재 줌 퍼센트 표시 (§6). |
| Fit 버튼 | 모든 노드가 보이도록 뷰포트 자동 조정 |
| 줌 범위 | 최소 25% ~ 최대 200% |
| 더블클릭 (빈 영역) | 노드 추가 검색 팝업 열기 |

### 3.2 선택

| 인터랙션 | 동작 |
|----------|------|
| 노드 클릭 | 해당 노드 선택. 이전 선택 해제 |
| Shift + 클릭 | 기존 선택에 노드 추가/제거 (토글) |
| 빈 영역 드래그 | 선택 영역(Lasso) 생성 → 포함된 노드 모두 선택 |
| Ctrl + A | 모든 노드 선택 (빈 영역 우클릭 메뉴의 "전체 선택"과 동일. §10 참조) |
| Escape | 노드 선택 해제. **우선순위**: Run Results 드로어에 포커스가 있을 때는 캔버스 포커스 복귀(§10.12)가 우선하고, 그 외(편집 필드 제외)에만 선택 해제한다 — 전역 `handleKeyDown` 이 드로어 branch 를 early-return 으로 먼저 처리한다 |
| 빈 영역 클릭 | 선택 해제, 설정 패널 닫기 |

### 3.3 노드 조작

| 인터랙션 | 동작 |
|----------|------|
| 팔레트에서 드래그 | 캔버스에 새 노드 추가 (드롭 위치에 배치) |
| 노드 드래그 | 노드 이동 (그리드 스냅 적용) |
| 다중 선택 후 드래그 | 선택된 모든 노드 동시 이동 |
| Ctrl + C | 선택된 노드(+양끝이 선택된 내부 엣지) 복사 (앱 내부 클립보드 `editorClipboard`) |
| Ctrl + V | 복사된 노드 붙여넣기 (원본 대비 +40,+40 오프셋·유니크 라벨·엣지 신규 id 재연결. 우클릭 메뉴 "붙여넣기"는 클릭 위치 기준) |
| Ctrl + D | 선택된 노드 즉시 복제 (클립보드 미변경. 우클릭 메뉴 "복제"와 동일 효과) |
| Delete / Backspace | 선택된 노드 삭제 (연결된 엣지도 함께 삭제) |
| 노드 더블클릭 | 설정 패널 열기 (또는 단일 클릭으로) |
| 우클릭 | 컨텍스트 메뉴 |
| 컨테이너 멤버십 | **엣지 기반** — body/emit/chain 엣지로 자동 지정/해제. 드래그-드롭으로 컨테이너 안에 넣는 UX는 없음. 자세한 규칙은 §11.2.1 참조 |
| Tool Area에 드래그 _(제거됨)_ | 노드를 AI Agent의 Tool Area에 드롭 → Tool 등록 (tool_owner_id 설정). 기존 데이터 흐름 엣지 자동 제거. 현재 비활성 — §12 박스 참조 |

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
| 붙여넣기 | 클립보드의 노드를 클릭 위치에 붙여넣기 (`editorClipboard` 비어 있으면 비활성) |
| 전체 선택 | 모든 노드 선택 |
| 맞춤 보기 | Fit to View |

### 3.6 빈 캔버스 Empty State

새 워크플로우는 백엔드가 기본 트리거 노드를 1개 자동 주입하므로 "완전 빈 상태"는 거의 발생하지 않는다. 따라서 **트리거 카테고리 노드 외에 다른 노드가 없는 상태**를 "빈 워크플로우"로 간주해 캔버스 우측 상단에 "시작하기" 안내 카드를 표시한다. 사용자는 트리거 다음 단계를 바로 알 수 있다.

| 요소 | 내용 |
|------|------|
| 제목 | "워크플로우를 이어서 완성해봐요" |
| 소제목 | "트리거 다음에 이어 붙일 노드를 추가하면 워크플로우가 완성돼요." |
| 체크리스트 | 3단계: (1) 팔레트에서 다음 노드를 드래그 (2) 트리거 출력 포트에 연결 (3) 실행해서 결과 확인. 각 항목 우측에 "자세히" 링크 → 관련 매뉴얼 섹션 딥링크 |
| CTA | "시작 가이드 열기" → `/docs/01-getting-started/first-workflow` 새 탭. 노드 추가는 팔레트 드래그 앤 드롭으로 수행하므로 카드 내부에 별도 버튼을 두지 않음 |
| 표시 조건 | (완전 빈 상태) 또는 (트리거 카테고리 노드만 존재) 일 때 표시. 첫 비트리거 노드가 추가되면 300ms 페이드 아웃 |
| 위치·크기 | `top-right` Panel, 너비 340px. 트리거 노드와 겹치지 않도록 우측에 고정 |
| 접근성 | `role="region"` + `aria-label="시작하기"`. 숨김 상태에서는 `aria-hidden="true"`와 `tabIndex={-1}`로 포커스에서 제외 |
| 링크 동작 | 매뉴얼 딥링크는 새 탭으로 열어 작업 맥락을 보존 |

> 상세 스펙: [User Guide Spec](../2-navigation/13-user-guide.md)

---

## 4. 노드 팔레트 (좌측 패널)

### 4.1 구조

> **구현 (ED-PL-04)**: `⏱ Recent` 섹션은 최근 사용 노드 타입을 팔레트 상단에 표시한다 (`node-palette.tsx` — 세션 한정·최대 5개·최신순·중복 제거·manual_trigger 제외, 검색 중에는 숨김). 최근 사용은 `editor-store.addNode`(드롭·팔레트 클릭·빠른추가·우클릭 복제·assistant)가 `recent-nodes-store` 에 기록하고, `addNode` 를 우회하는 배치 경로(Ctrl+V 붙여넣기·Ctrl+D 복제)는 `recordRecentNodeTypesFrom` 으로 별도 기록한다.
> **미구현 (Planned)**: `▼ Installed`(마켓플레이스) 섹션은 아직 렌더되지 않는다 — 마켓플레이스 모듈 도입 후로 미룬다 (backlog, §Rationale 참조).

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
│   Send Email     │
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
├──────────────────┤
│ ▼ Installed  (Planned)
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
| 클릭 | 현재 뷰포트 중앙에 노드 추가 (반복 클릭 시 겹치지 않도록 소량 지터). 키보드 접근성: 아이템에 포커스 후 Enter/Space 도 동일. 캔버스 접근은 `palette-canvas-bridge` 경유 |
| 패널 접기 | 검색 헤더의 토글 버튼으로 팔레트를 아이콘 레일(펼치기 버튼만)로 접기/펼치기 (ED-PL-03) |

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
- 결과 항목 클릭으로 선택, 클릭(더블클릭) 위치에 노드 배치
- **키보드**: ↑/↓ 로 하이라이트 이동(끝에서 순환), Enter 로 하이라이트 항목 선택(더블클릭 위치에 배치), Escape 로 팝업 닫기. **Escape 우선순위**: 팝업이 열려 있으면 팝업 닫기가 최우선이다 — 팝업 입력의 keydown 이 `stopPropagation` 으로 전역 keydown(§10 Escape 선택 해제·[실행 §10.12](./3-execution.md#1012-단축키) 드로어 복귀)보다 먼저 소비한다.

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
     │  gpt-4o · 1 KB                   │
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
| 업데이트 | 노드 config 가 store 에 반영되면(설정 패널 `변경 저장`·`JSON 적용`, 어시스턴트 편집 등) 요약도 즉시 갱신 |

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
| Send Email | `⚠ Recipient not set` | to 미설정 |
| Transform | `⚠ No operations defined` | operations 미설정 |
| Code | `⚠ Code not written` | code 미설정 |
| Table | `⚠ Columns not defined` | columns 미설정 |
| Chart | `⚠ Chart type not selected` / `⚠ Axis fields not set` | chartType 또는 axis 누락 |
| Form | `⚠ No fields defined` | fields 미설정 |
| Template | `⚠ Template not set` | template 미설정 |
| AI Agent | `⚠ Model not selected` / `⚠ Default provider not configured` | model 및 llmConfigId 미설정 시 "Model not selected". "Default provider" 선택(`llmConfigId=""`) 시 Models (Chat 탭)에서 실제 default 존재 여부를 확인하여 없으면 "Default provider not configured" 표시 |
| Text Classifier | `⚠ Model not selected` / `⚠ Default provider not configured` / `⚠ Categories not defined` | AI Agent와 동일한 LLM provider 규칙 적용 + categories 누락 시 별도 경고 |
| Info Extractor | `⚠ Model not selected` / `⚠ Default provider not configured` / `⚠ Output schema not defined` | AI Agent와 동일한 LLM provider 규칙 적용 + outputSchema 누락 시 별도 경고 |

#### 5.3.3 컨테이너 노드 요약

컨테이너 노드(Loop, ForEach, Map)는 헤더 바의 사용자 레이블 우측에 요약을 표시한다. Background 는 컨테이너 박스 없이 평면으로 렌더링되므로 일반 노드 본체의 요약 영역(§5.3.1)을 사용한다.

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
| Background | 알림 채널 | `notify: in_app, email` |
| Workflow | `{워크플로우 이름} · {모드}` | `Data Pipeline · sync` |
| AI Agent | ⚠ 미구현(Planned) — 목표 `{모델} · {N} KB · {N} MCP …`([공통 §8](../4-nodes/3-ai/0-common.md#8-캔버스-요약)). `summaryTemplate` 부재로 현재 미표시. 구 `{N} tools`(Tool Area) 폐기 | (목표) `gpt-4o · 1 KB` |
| Text Classifier | `{모델} · {N} categories` | `gpt-4o-mini · 3 categories` |
| Info Extractor | ⚠ 미구현(Planned) — 목표 `{모델} · {N} fields`. `summaryTemplate` 부재로 현재 미표시 | (목표) `claude-sonnet · 4 fields` |
| HTTP Request | `{METHOD} {url}` | `GET https://api.exam...` |
| Database Query | `{{queryType\|upper}} · {{query}}` | `SELECT · SELECT * FROM us...` |
| Send Email | `{{to.length}} recipients · {{subject}}` | `2 recipients · Welcome` |
| Transform | `{N} operations` | `3 operations` |
| Code | `{{language\|upper}}` | `JAVASCRIPT` |
| Carousel | `{layout} · {titleField}` | `card · name` |
| Table | `{N} columns` + pagination 표시 | `3 columns · pagination` |
| Chart | `{chartType} · {x}/{y}` | `bar · month / revenue` |
| Form | `{N} fields · "{title}"` | `3 fields · "Approval"` |
| Template | `{{outputFormat}} · {{buttons.length}} buttons` | `html · 2 buttons` |

> 포맷 SoT 는 각 노드 spec 의 `summaryTemplate` 이다. downscope(예: Code 의 `N lines`, Send Email 의 `to: +N` 미지원) 근거는 해당 노드 Rationale / `0-common.md §5` 참조.

#### 5.3.5 엣지 케이스

| 케이스 | 동작 |
|--------|------|
| 표현식 사용 | 표현식 텍스트 그대로 표시: `{{ $input.role }}` (잘림 적용) |
| 삭제된 Integration 참조 | `⚠ Missing integration` (앰버색) |
| 삭제된 Workflow 참조 | `⚠ Missing workflow` (앰버색) |
| 커스텀/마켓플레이스 노드 | configSchema의 첫 2개 필드를 `key: value` 형태로 표시 |
| 사용자 레이블 미설정 | 2번째 줄(레이블)이 없으면 요약이 2번째 줄로 올라감 |

> **`⚠ Missing X` 배지의 판정 메커니즘 (두 배지는 서로 다른 경로)**: `⚠ Missing integration` 은 **렌더러 전용 cross-entity 판정**이다 — `warningRules`/`warnWhen` DSL 은 노드 자신의 config 만 평가하므로 integration 실재(삭제) 여부에 닿지 못한다. 캔버스 렌더러(`custom-node.tsx`)가 워크스페이스 integration 목록을 조회해 `config.integrationId` 실재를 대조하며, graph-warning 배지(`AlertTriangle`)와 구분되는 연결 끊김 아이콘(`Unplug`)을 쓴다 ([4-nodes/4-integration/0-common §5](../4-nodes/4-integration/0-common.md#5-캔버스-요약)). 반면 `⚠ Missing workflow` 는 write-time 스냅샷(`workflowName`)을 이용한 config-only `warnWhen`(`workflowId && !workflowName`, `workflow.schema.ts`) 이라 표준 schema DSL 경로다.

### 5.4 노드 삭제 버튼

> **구현됨** (`custom-node.tsx`): 노드 우상단 ✕ 삭제 버튼. 우클릭 메뉴 "삭제"·Delete/Backspace 키(ReactFlow `deleteKeyCode`)에 더한 추가 어포던스로, 클릭 시 `requestNodeDelete` 로 연결 엣지까지 함께 제거한다. **예외**: 자식이 있는 컨테이너 노드는 즉시 삭제하지 않고 §11.3 확인 다이얼로그(Delete-all vs Ungroup)를 거친다. 아래 명세는 일반 노드·빈 컨테이너 기준이다.

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
| 클릭 | 노드 즉시 삭제 (Delete 키와 동일 동작: 연결된 엣지도 함께 삭제). 자식 있는 컨테이너는 §11.3 확인 다이얼로그 경유 |
| Undo | Ctrl+Z로 복원 가능 (기존 Undo 메커니즘과 동일) |
| 우클릭 메뉴 | 기존 "삭제" 항목 유지 (삭제 버튼은 추가 어포던스) |

---

## 6. 줌 컨트롤 · Undo/Redo

> **구현 현황**: 줌 컨트롤(줌아웃 −/줌인 +, 줌 레벨 슬라이더 + 현재 퍼센트, Fit)은 캔버스 **좌하단 오버레이**(`ZoomControls`, `zoom-controls.tsx`)에 표시된다. Undo/Redo 는 별도 하단 바가 아니라 **헤더 툴바**(`editor-toolbar.tsx`)에 있다 — 아래 다이어그램의 Undo/Redo 를 좌하단 바에 통합하는 레이아웃만 계획안이다.

```
좌하단 오버레이:  [−] ━━━━━●━━━━━ [+]  100%  [Fit]                       ← 구현됨 (슬라이더·퍼센트 포함)
계획 레이아웃:    [−] ━━━━━●━━━━━ [+]  100%  │  [Fit]  │  [↩ Undo] [↪ Redo]   ← Undo/Redo 통합만 Planned
```

| 요소 | 설명 |
|------|------|
| 줌 아웃/인 버튼 (−/+) | 좌하단 오버레이. 구현됨 |
| Fit 버튼 | 전체 맞춤 보기. 구현됨 |
| 줌 슬라이더 | 25% ~ 200%. 구현됨 |
| 줌 퍼센트 | 현재 줌 레벨 표시. 구현됨 |
| Undo (Ctrl+Z) | 실행 취소. 헤더 툴바에 위치 |
| Redo (Ctrl+Y) | 다시 실행. 헤더 툴바에 위치 |

---

## 7. 미니맵

> **구현됨** (`canvas-minimap.tsx`): @xyflow `MiniMap` 을 캔버스 우하단에 렌더하고(`pannable`/`zoomable`), 토글 버튼으로 표시/숨김한다. 아래 명세대로 동작한다.

- 캔버스 우하단에 작은 오버레이로 표시
- 전체 워크플로우의 조감도
- 현재 뷰포트 영역을 사각형으로 표시
- 미니맵 내 클릭/드래그로 뷰포트 이동
- 토글 버튼으로 표시/숨김

---

## 8. 저장

캔버스 변경은 in-memory store 에만 쌓이고(`isDirty` 세팅), 다음 두 경로에서만 서버에 영구 저장된다. **주기적(타이머) 자동 저장은 두지 않는다.**

| 항목 | 설명 |
|------|------|
| 수동 저장 | 헤더 `Save` 버튼 또는 `Ctrl+S`(Mac `Cmd+S`) — 즉시 저장. 미저장 변경이 없거나 그래프 오류(hasError)가 있으면 버튼 비활성 |
| 실행 직전 자동 저장 | `Run`(전체·부분·단일 노드) 시 `isDirty` 면 실행 직전에 먼저 저장 → 실행은 항상 최신 캔버스 기준 |
| 저장 표시 | 헤더 상태 텍스트 — "저장 중..." / "저장되지 않은 변경 사항" / "저장됨" (`isSaving`·`isDirty` 기반) |
| 저장 API | store 액션 `saveWorkflow` 가 API client `saveCanvas`(`POST /workflows/:id/save`)를 호출해 현재 노드/엣지 전체 스냅샷을 저장. 마지막 저장이 서버 상태가 된다 |

### 8.1 저장과 버전의 관계

영구 저장이 일어나는 매 순간, 서버가 동일 트랜잭션에서 `workflow_version` 스냅샷을 함께 생성한다([§5 버전 이력](./5-version-history.md)). 타이머 자동 저장이 없으므로 "버전 없이 저장만" 되는 경우는 없다.

| 동작 | 서버 저장 | 버전 생성 |
|------|-----------|-----------|
| 캔버스 변경 (노드/엣지/설정) | X (in-memory store, `isDirty`) | X |
| 수동 저장 (`Ctrl+S`·`Save`) | O | O — 미저장 변경이 있을 때만 |
| 실행 직전 저장 (Run) | O | O — 실행 직전 스냅샷 |
| 버전 복원 | O | O — `Restored from vN` |

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

> **구현 현황**: 전역 keydown 핸들러(`workflow-editor.tsx`)가 저장·Undo/Redo·AI 패널 토글·드로어 토글(Ctrl+Shift+R)과 **Ctrl+C/V/D/A·Escape** 를 바인딩한다. 줌(Ctrl++/-/0/1)과 Space 패닝은 ReactFlow 인스턴스가 필요해 캔버스 컴포넌트(`workflow-canvas.tsx`)에서 처리한다(줌은 로컬 keydown, 패닝은 `panActivationKeyCode="Space"`). Delete/Backspace 는 ReactFlow `deleteKeyCode` + `onBeforeDelete`(컨테이너 삭제 확인 §11.3) 로 처리된다. Ctrl+C/V/D/A·Escape·줌 단축키는 입력 필드 포커스 중에는 가로채지 않는다(`isEditableTarget` 가드).

| 단축키 | 동작 | 상태 |
|--------|------|------|
| Ctrl + S | 저장 | 구현됨 |
| Ctrl + Z | Undo | 구현됨 |
| Ctrl + Y / Ctrl + Shift + Z | Redo | 구현됨 |
| Ctrl + / | AI Assistant 패널 토글 (상세: [AI Assistant §3.5](./4-ai-assistant.md#35-키보드-단축키)) | 구현됨 |
| Delete / Backspace | 선택 항목 삭제 | 구현됨 (ReactFlow `deleteKeyCode`) |
| Ctrl + C | 선택 노드(+내부 엣지) 복사 (앱 내부 클립보드) | 구현됨 |
| Ctrl + V | 붙여넣기 (원본 대비 +40 오프셋·유니크 라벨) | 구현됨 |
| Ctrl + D | 선택 노드 즉시 복제 | 구현됨 |
| Ctrl + A | 전체 선택 | 구현됨 |
| Escape | 포커스 위치에 따라 분기: **Run Results 드로어에 포커스가 있으면** 캔버스로 포커스 복귀(§10.12) — **그 외에는** 노드 선택 해제 | 구현됨 |
| Space + 드래그 | 캔버스 패닝 (대안) | 구현됨 (ReactFlow `panActivationKeyCode`) |
| Ctrl + + / - | 줌 인/아웃 | 구현됨 |
| Ctrl + 0 | 줌 100% | 구현됨 |
| Ctrl + 1 | Fit to View | 구현됨 |
| Ctrl + Shift + R | Run Results 드로어 펼침/접힘 토글 | 구현됨 (상세: [실행 §10.12](./3-execution.md#1012-단축키)) |

---

## 11. 컨테이너 노드

Loop, ForEach, Map 노드는 **컨테이너**로 렌더링된다. 내부에 자식 노드를 배치할 수 있는 그룹이며 body/emit/done 포트 모델 + emit 기반 결과 수집을 공유한다. Background 는 PRD 3 §4.12 ND-BG-05 의 대안 구현 결정에 따라 컨테이너 박스를 사용하지 않고 일반 다중 출력 포트 노드로 평면 렌더링한다 — 본문은 `background` 포트 엣지로 시각적으로 분기가 드러나며, 메인과 같은 캔버스 그래프 안에 평면적으로 존재한다.

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

> **두 삭제 경로**: 컨테이너 삭제 시 (a) 기본 **Ungroup** — 컨테이너 노드만 제거하고 자식은 위 전체 재계산으로 top-level 승격(`containerId=null`), (b) **Delete container and all children** — 컨테이너 + `containerId`가 이를 가리키는 자식 전부를 함께 제거(cascade). §11.3 확인 다이얼로그가 자식이 있는 컨테이너에서 두 경로를 선택하게 한다. (a)는 본 절의 재계산 로직을 그대로 쓰고, (b)만 신규 cascade 경로다.

### 11.2.2 제약

| 제약 | 동작 |
|------|------|
| 트리거 노드 child 금지 | trigger 카테고리 노드는 컨테이너 child가 될 수 없음. 엣지 자동 전파가 거부하고, 실행 시에도 백엔드가 `CONTAINER_INVALID_CHILD` 에러로 실패 |
| 자기 자신 child 금지 | 컨테이너는 자기 자신을 `containerId`로 가질 수 없음 |
| 자손 컨테이너 child 금지 | A의 자손 컨테이너 B를 다시 A의 부모로 지정하면 cycle. 실행 시 `CONTAINER_CYCLE` 에러로 거부 |
| Emit 필수 | 컨테이너 실행 시 `emit` 포트에 정확히 1개의 child 노드가 연결되어야 함 (`CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT`). emit 엣지는 있으나 source가 child가 아닌 경우 오류 메시지에 해당 노드 이름 + 해결 안내 포함 |
| Body 내부 제약 | back-edge(순환), blocking 노드(form/buttons/ai_conversation)는 컨테이너 body 내부에서 사용 불가 |

### 11.3 컨테이너 삭제

> **구현**: 자식이 있는 컨테이너를 삭제하려 하면 아래 확인 다이얼로그(Delete-all vs Ungroup)가 뜬다. **세 삭제 경로 모두** 이를 거친다 — ✕ 버튼·우클릭 메뉴는 `editor-store.ts` `requestNodeDelete` 로, Delete/Backspace 키는 ReactFlow `onBeforeDelete` 가 컨테이너를 감지해 기본 삭제를 취소하고 다이얼로그를 연다(`workflow-canvas.tsx`). 자식이 없는 컨테이너(§11.3.3)와 일반 노드는 다이얼로그 없이 즉시 삭제된다. 선택 결과는 `confirmContainerDelete(mode)` 가 수행: `ungroup` = 컨테이너만 제거(기존 `removeNode` — 자식은 `containerId` 재계산으로 top-level 승격), `deleteAll` = 컨테이너 + `containerId`가 이를 가리키는 자식 cascade 삭제.

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
| **Delete container and all children** | 컨테이너 노드 + 모든 자식 노드(`containerId`가 해당 컨테이너를 가리키는 노드) + 관련 엣지 모두 삭제 |
| **Ungroup** (기본 선택) | 컨테이너 노드만 제거. 자식 노드는 top-level로 승격 (`containerId = null`). 자식 노드 간 내부 엣지는 유지. 컨테이너의 `body`/`background` 포트에서 자식으로의 엣지만 제거 |
| **Cancel** | 취소 |

#### 11.3.3 빈 컨테이너

자식 노드가 없는 컨테이너는 확인 다이얼로그 없이 즉시 삭제한다.

#### 11.3.4 삭제 버튼 위치

컨테이너 노드의 삭제 버튼(✕)은 헤더 바 우상단 외곽에 표시된다 (버튼은 §5.4 구현. 자식이 있으면 클릭 시 §11.3.1 확인 다이얼로그가 뜬다):

```
                                                     ╭───╮
┌────────────────────────────────────────────────────┤ ✕ ├
│ 🔄 Loop "Process Items"  10x · break   [−] ▼ ⋮    ╰───╯
│ ─────────────────────────────────────────────── │
│   ...child nodes...                             │
└─────────────────────────────────────────────────┘
```

### 11.4 중첩

> **중첩은 허용·실행되며, 깊이 제한과 레벨별 배경 틴트는 도입하지 않는다 (미도입 확정)**: 컨테이너(Loop/ForEach/Map)는 다른 컨테이너 안에 `containerId` 체인으로 중첩될 수 있고, 실행 엔진이 중첩 스코프(외부 `$loop`/`$item` save/restore, `$parent` 참조)를 지원한다 — 실행 시맨틱의 SoT 는 [실행 엔진 §3.4 중첩 컨테이너 스코프](../5-system/4-execution-engine.md#34-중첩-컨테이너-스코프) 다. 멤버십은 §11.2 대로 `containerId` 데이터 모델 + `in <Container>` 배지로만 표현하며, 컨테이너를 시각적으로 감싸는 containment 영역은 두지 않는다. 과거 계획했던 (a) 최대 중첩 깊이(3) 제한·초과 토스트와 (b) 레벨별 배경 틴트는 **파기하고 앞으로도 구현하지 않는다** (근거 §Rationale R-4). 유일한 중첩 가드는 사이클 거부(`CONTAINER_CYCLE`, §11.2.2)이며 깊이 상한은 없다.

| 항목 | 설명 |
|------|------|
| 중첩 허용 | 컨테이너 안에 다른 컨테이너 배치 가능 (`containerId` 체인). 실행 스코프는 [실행 엔진 §3.4](../5-system/4-execution-engine.md#34-중첩-컨테이너-스코프) |
| 깊이 제한 | 없음 — 상한을 두지 않는다. 사이클만 `CONTAINER_CYCLE`(§11.2.2)로 거부 |
| 레벨별 시각 구분 | 없음 — §11.2 "시각 containment 미사용" 결정에 따라 배경 틴트·깊이 표시를 두지 않는다 |

---

## 12. AI Agent Tool Area

> ⚠ **재작성 예정 (현재 제거됨)** — 본 섹션의 Tool Area 시각·인터랙션은 현재 비활성이며, AI Agent 의 도구 연결 config 필드(`toolNodeIds` / `toolOverrides`)도 스키마에서 제거됐다. 캔버스에서 AI Agent 노드 우측 점선 영역 및 드래그/드롭 인터랙션을 노출하지 않는다. 새 도구 연결 디자인이 결정될 때 갱신한다. 자세한 사유와 백엔드 영향은 `spec/4-nodes/3-ai/1-ai-agent.md` §1 박스 참조.

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
| 컨테이너 겸용 불가 | 컨테이너 내부 노드(`containerId`가 설정된 노드)는 Tool Area에 등록 불가 (역방향도 동일) |

---

## Rationale

### R-1. 팔레트 Recent 는 구현, Installed(마켓플레이스)는 backlog (§4.1) (2026-07-07)

§4.1 다이어그램의 두 신규 섹션 중 **Recent 만 구현**하고 **Installed(마켓플레이스)는 미룬다**. Recent 는 기존 노드 정의(카테고리 목록)만으로 충족되는 순수 프론트엔드 기능이라 선행 의존이 없다. 반면 Installed 는 마켓플레이스에서 설치한 노드 목록을 전제하는데, 마켓플레이스·플러그인 SDK 자체가 아직 backlog(`plan/in-progress/marketplace-and-plugin-sdk.md`)라 표시할 데이터 원천이 없다. 데이터 없는 빈 섹션을 미리 렌더하지 않고, 마켓플레이스 모듈 도입 시 함께 구현한다.

Recent 는 **세션 한정(비영속)**으로 둔다 — 영속화하면 무관한 다른 워크플로/세션에서 쓰던 타입이 새 편집기 첫 진입에 새어나오고, 스코프(워크스페이스/워크플로 단위)를 정해야 하는 추가 결정이 생긴다. 최근 사용 기록은 `editor-store.addNode`(모든 추가 경로의 단일 choke point)에 두어 드롭·팔레트 클릭·빠른추가·복제·assistant 가 균일하게 반영되게 했다 — 복제/붙여넣기도 "그 타입을 최근 썼다"는 의미라 함께 집계한다.

### R-2. 팔레트→캔버스 노드 추가는 브리지 경유 (§4.2) (2026-07-07)

팔레트 클릭 노드 추가(§4.2)는 뷰포트 중앙 좌표(ReactFlow 인스턴스)·locale·기본 LLM config 가 필요하고, 이들은 모두 `WorkflowCanvas` 에만 있다. 이 로직을 editor-store(순수 상태)로 옮기면 React Query·RF 인스턴스·i18n 의존이 store 로 새어 계층이 무너진다. 그래서 canvas 가 노드 추가 핸들러를 `palette-canvas-bridge`(모듈 레지스트리)에 등록하고 팔레트가 이를 호출한다 — 양쪽이 서로 import 하지 않아 순환을 피하는, `assistant-editor-bridge` 와 동일한 확립된 seam 이다.

### R-3. §8 저장 모델·ED-SP-05 정정 — 타이머 자동 저장·즉시 반영은 미제공 (2026-07-08)

기존 §8 은 "노드/엣지/설정 변경 후 2초 디바운스 자동 저장" + "오프라인 로컬 스토리지 임시 저장" + "동시 편집 충돌 감지" 를, ED-SP-05(PRD §5) 는 "설정 변경 즉시 반영(별도 저장 버튼 불필요)" 를 약속했으나 **현재 구현은 셋 다 없다**. 저장은 수동(`Ctrl+S`·`Save`)·실행 직전 저장 두 경로뿐이고(`saveWorkflow` 호출처 = 툴바·`Ctrl+S` 핸들러·Run 전 3곳), 설정 패널은 `변경 저장`·`JSON 적용` 명시 클릭으로만 store 에 반영된다(`node-settings-panel.tsx` — `key={selectedNodeId}` remount 로 미저장 편집 폐기). `workflow-editor.tsx` 의 500ms 디바운스는 저장이 아니라 그래프 경고 평가(`evaluateGraphWarningsLocal`)용이다.

명시 저장 + 실행 직전 저장은 `Save` 버튼·"저장되지 않은 변경 사항" 상태 텍스트·save-before-run 이 일관되게 맞물린 **의도된 설계**로 판단해(사용자 확인, 2026-07-08), 스펙을 현재 동작으로 정정한다(구현을 옛 스펙에 맞추지 않음). `spec/data-flow/11-workflow.md §1.4` 도 이미 "auto-save 없음, 500ms debounce 는 graph-warning 용" 으로 동일 사실을 서술한다. 유저 가이드(`03-workflow-editor/{overview,settings-panel,saving-and-sharing}` · `01-getting-started/{ui-tour,first-workflow}`)는 이미 현재 동작을 서술한다. 타이머 자동 저장·오프라인 초안 복원을 되살릴지는 별도 기획 판단으로 남긴다. 추적: [`plan/complete/spec-sync-canvas-gaps.md`](../../plan/complete/spec-sync-canvas-gaps.md).

### R-4. §11.4 컨테이너 중첩 — 깊이 제한·레벨별 배경 틴트 파기 (미도입 확정) (2026-07-08)

§11.4 는 원래 컨테이너 중첩에 대해 (a) 최대 깊이 3단계 제한 + 초과 토스트, (b) 중첩 레벨별 배경 틴트(L1 5%/L2 10%/L3 15%) 를 "미구현 (Planned)" 으로 두었다. 이 두 항목을 **파기하고 앞으로도 구현하지 않기로 확정한다**(사용자 결정, 2026-07-08). 반면 **중첩 기능 자체는 유지**한다 — 파기 대상은 "미구현으로 남아 있던 캔버스 UX 폴리시" 뿐이다.

근거:

1. **중첩 실행은 이미 실재·구현·테스트된 기능이다.** spec·backend·frontend 전수 조사 결과, Loop/ForEach/Map 을 다른 컨테이너 안에 `containerId` 체인으로 중첩하는 것은 데이터 모델상 허용에 그치지 않고 실행 엔진이 중첩 스코프(외부 `$loop`/`$item` save/restore, `$parent` 참조)로 지원하며([실행 엔진 §3.4](../5-system/4-execution-engine.md#34-중첩-컨테이너-스코프)), `loop-executor`/`foreach-executor` 의 컨텍스트 save/restore + "nested-container safe" 단위 테스트, `editor-store` 의 3단 중첩 삭제 테스트 등으로 검증돼 있다. 따라서 §11.4 를 통째로 파기하면 살아 있는 기능의 캔버스 측 문서가 사라지므로, 기능 문서는 남기고 미구현 폴리시만 제거한다.
2. **레벨별 배경 틴트는 §11.2 결정과 모순된다.** §11.2 "시각 containment 미사용"(컨테이너를 일반 노드 크기로 렌더, 자식은 자유 배치, 멤버십은 `containerId` + `in <Container>` 배지로만 표현) 하에서는 컨테이너가 자식을 감싸는 시각 영역이 없어 "중첩 레벨별 배경 틴트"가 성립할 지점이 없다. 틴트를 구현하려면 시각 containment 자체를 재도입해야 하는데, 그 방향으로 가지 않기로 한다.
3. **깊이 상한(3)은 근거가 없고 실제 동작과도 어긋난다.** 실행 엔진은 컨테이너 중첩에 깊이 상한을 두지 않고 사이클(`CONTAINER_CYCLE`, §11.2.2)만 거부한다. "3단계"라는 숫자에 제품/기술적 근거가 없어 임의 상한을 신설하지 않고, 현재의 무제한(사이클만 차단) 동작을 확정 상태로 둔다. (Parallel 의 `parallel:nested-depth-exceeded` depth ≤ 2 는 그래프 토폴로지 기반의 별개 메커니즘으로 컨테이너 `containerId` 중첩과 무관하다. 또한 workflow-assistant `shadow-workflow.ts` 의 `MAX_CONTAINER_DEPTH = 64` 는 손상된 `containerId` 체인의 무한 순회를 막는 방어적 순회 상한일 뿐 제품 차원의 중첩 깊이 제한이 아니다.)

`spec/conventions/cross-node-warning-rules.md §9` 의 "Loop / ForEach 의 중첩 깊이 정책 (도입 시)" 향후 확장 항목도 본 결정에 따라 미도입 확정으로 갱신한다.
