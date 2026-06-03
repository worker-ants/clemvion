---
id: node-common
status: partial
code:
  - codebase/frontend/src/components/editor/canvas/custom-node.tsx
  - codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx
  - codebase/frontend/src/components/editor/expression/*.tsx
  - codebase/frontend/src/lib/node-definitions/resolve-dynamic-ports.ts
  - codebase/backend/src/nodes/**/*.schema.ts
pending_plans:
  - plan/in-progress/spec-sync-node-common-gaps.md
---

# Spec: 노드 공통 스펙

> 관련 문서: [PRD 워크플로우 에디터](./_product-overview.md#5-노드-설정-패널) · [PRD 노드 시스템](../4-nodes/_product-overview.md#2-노드-공통-요구사항) · [Spec 캔버스](./0-canvas.md) · [Spec 노드 개요](../4-nodes/0-overview.md)

---

## 1. 포트 시스템

### 1.1 입력 포트 (Input Port)

| 속성 | 설명 |
|------|------|
| 위치 | 노드 좌측 |
| 기본 개수 | 1개 (일부 노드는 복수: Merge) |
| 식별자 | `in` (기본), 복수 입력 시 `in_0`, `in_1`, ... |
| 다중 연결 | 하나의 입력 포트에 여러 엣지 연결 가능 (Merge 역할) |

### 1.2 출력 포트 (Output Port)

| 속성 | 설명 |
|------|------|
| 위치 | 노드 우측 |
| 기본 개수 | 1개 (분기 노드는 복수) |
| 식별자 | 노드 유형에 따라 다름 (아래 표) |
| 다중 연결 | 하나의 출력 포트에서 여러 엣지 연결 가능 (데이터 복제 전달) |
| 라벨 | 포트별 이름 표시 (예: "True", "False", "Case 1") |
| **error 포트** | 에러 처리 정책이 "Route to Error Port"인 경우 동적 생성. 빨간 원(●) 아이콘, 노드 우하단 위치 |
| **포트 색상** | 데이터 포트=초록(●), 시스템 포트=파랑(●), 에러 포트=빨강(●), **컨테이너 `emit` 포트=보라(●)**(Loop/ForEach/Map의 body 결과 수집 입력, 헤드 라벨도 보라색). 시스템 포트는 노드가 사전 정의하는 고정 출력(예: AI Agent의 `user_ended`, `max_turns`, `out`). 사용자 조건 포트와 시스템 포트 사이에는 점선 구분자를 표시. 입력 포트가 여러 개(예: 컨테이너의 `Input`·`Emit`)일 때는 핸들 옆에 라벨 텍스트가 함께 표시되어 구분 |

### 1.3 노드별 포트 구성

| 노드 유형 | 입력 | 출력 | 출력 포트 식별자 |
|-----------|------|------|-----------------|
| Manual Trigger | 0 | 1 | `out` — 워크플로우 시작점. 입력 포트 없음. 워크플로우 실행 입력 데이터를 패스스루 |
| If/Else | 1 | 2 | `true`, `false` |
| Switch | 1 | N (동적) | `case_0`, `case_1`, ..., `default` |
| Loop (**컨테이너**) | 2 | 2 (+error) | 입력: `in`, `emit`(보라색, body 결과 수집). 출력: `body` (반복 진입점), `done` (수집된 배열) |
| Variable Declaration | 1 | 1 | `out` |
| Variable Modification | 1 | 1 | `out` |
| Split | 1 | 1 | `out` (분리된 항목을 `[{index, value}]` 배열로 일괄 출력) |
| Map (**컨테이너**) | 2 | 2 (+error) | 입력: `in`, `emit`(보라색, body 결과 수집). 출력: `body` (각 항목 진입점), `done` (변환된 배열) |
| ForEach (**컨테이너**) | 2 | 2 (+error) | 입력: `in`, `emit`(보라색, body 결과 수집). 출력: `body` (각 항목 진입점), `done` (수집된 배열) |
| Parallel | 1 | N (동적) + done | `branch_0`, `branch_1`, ... (분기별, 동적) + `done` (모든 분기 완료 후 수집 결과, 항상 추가) |
| Merge | N (동적) | 1 | `out` |
| Filter | 1 | 2 | `match`, `unmatched` |
| Background | 1 | 2 (+error) | `main` (즉시 진행), `background` (백그라운드 본문 진입점 — 컨테이너 박스 없이 평면으로 렌더링. PRD 3 §4.12 ND-BG-05 대안 구현) |
| Workflow | 1 | 2 | `out`(data), `error`(error) |
| AI Agent | 1 | N (동적) | `cond_0`, `cond_1`, ... (사용자 조건별, 동적, data) + 시스템 포트 + `error`(error). 시스템 포트는 모드별로 다름 — 단일턴: `out`(system); 멀티턴: `user_ended`(system), `max_turns`(system). 조건이 0개여도 시스템 포트·`error` 는 항상 발행. §1.2 시스템 포트 설명 참조 |
| Text Classifier | 1 | N (동적) + fallback + error | `class_0`, `class_1`, ... (카테고리별, 동적, data) + `fallback`(data, 항상 추가) + `error`(error, 항상 추가) |
| Information Extractor | 1 | 2 (모드별) | 단일턴: `out`(system), `error`(error). 멀티턴: `completed`(system), `user_ended`(system), `max_turns`(system), `error`(error) |
| HTTP Request | 1 | 2 | `success`, `error` |
| Database Query | 1 | 1 | `out` |
| Send Email | 1 | 1 | `out` |
| Transform | 1 | 1 | `out` |
| Code | 1 | 1 | `out` |
| Carousel | 1 | 1 또는 N (동적) | `out` (기본). 버튼 설정 시 `out` 제거 → port 버튼별 동적 포트 (`{button.id}`) + link 전용 시 `continue` 자동 생성 |
| Table | 1 | 1 또는 N (동적) | Carousel과 동일 |
| Chart | 1 | 1 또는 N (동적) | Carousel과 동일 |
| Form | 1 | 1 | `out` |
| Template | 1 | 1 또는 N (동적) | Carousel과 동일 |
| **(조건부) error** | — | +1 | `error` — 에러 처리 정책이 "Route to Error Port"인 노드에 동적 추가. 빨간 원, 노드 우하단 |

### 1.4 포트 인터랙션

| 인터랙션 | 설명 |
|----------|------|
| 호버 | 포트 확대 + 연결 가능 표시 |
| 드래그 시작 | 출력 포트에서 드래그 시작 → 임시 엣지 렌더링 |
| 드래그 중 | 유효한 입력 포트 위에서 하이라이트 (초록) |
| 드래그 중 (무효) | 유효하지 않은 대상 위에서 차단 표시 (빨강) |
| 드롭 | 유효한 입력 포트에 드롭 → 엣지 생성 |
| 드롭 (빈 영역) | 노드 추가 검색 팝업 표시 → 선택 시 노드 생성 + 엣지 연결 |

### 1.5 동적 포트 ID 규칙

동적 포트(Switch 케이스, Parallel 분기, Merge 입력, Text Classifier 카테고리 등)의 ID는 다음 규칙을 따른다:

| 규칙 | 설명 |
|------|------|
| ID 생성 | 동적 포트 추가 시 **UUID v4**를 할당한다 |
| ID 불변 | 포트 이름 변경, 순서 재정렬, 다른 포트 삭제 등 편집 작업에도 기존 포트 ID는 변경되지 않는다 |
| 엣지 유지 | 포트 ID가 불변이므로, 포트에 연결된 엣지는 편집 이후에도 자동으로 유지된다 |
| 포트 삭제 | 동적 포트를 삭제하면 해당 포트에 연결된 엣지도 함께 삭제된다 |

> 상세: [노드 개요 §1.3 PortDef](../4-nodes/0-overview.md#13-포트-정의-portdef)

---

## 2. 노드 설정 패널

### 2.1 패널 구조

```
┌──────────────────────────────┐
│  ✕  If/Else Settings         │
│  ─────────────────────────── │
│  Name: [Check user role___]  │
│  ─────────────────────────── │
│                              │
│  [Settings] [Code] [Info]    │
│                              │
│  ┌──────────────────────────┐│
│  │                          ││
│  │  (노드별 고유 설정 폼)   ││
│  │                          ││
│  └──────────────────────────┘│
│                              │
│  ─────────────────────────── │
│  Error Handling: [Stop ▼]    │
│  □ Disable this node         │
│  ─────────────────────────── │
│  Notes: [________________]   │
└──────────────────────────────┘
```

### 2.2 공통 탭

| 탭 | 내용 |
|----|------|
| **Settings** | 노드 유형별 고유 설정 폼 (기본 탭) |
| **Code** | JSON 형태로 노드 설정 직접 편집 (개발자용) |
| **Info** | 노드 유형 설명, 사용법 가이드, 최근 실행 결과 요약 |

### 2.3 공통 설정 필드

| 필드 | 설명 |
|------|------|
| Name | 노드 레이블 (캔버스에 표시) |
| Error Handling | 에러 발생 시 정책 (아래 참조) |
| Disable | 노드 비활성화 체크박스 |
| Notes | 메모/설명 텍스트 (마크다운 지원) |

### 2.3.1 필드 도움말 (FieldHelp)

노드 설정 폼의 각 필드는 라벨 우측에 도움말 아이콘(`?`)을 둘 수 있다. 사용자가 UI만으로 필드 의미를 파악하기 어려운 경우에 한해 제공한다.

| 규칙 | 설명 |
|------|------|
| 트리거 | 클릭 시 Popover 노출. 호버는 보조 수단이며 단독 사용은 금지(모바일 접근성) |
| 본문 | 한두 문장 설명 + 필요 시 매뉴얼 딥링크("자세히 보기 →") |
| 딥링크 | `/docs/<section>/<slug>#<anchor>` 형태. 반드시 새 탭(`target="_blank"`, `rel="noopener"`) |
| 접근성 | 트리거 버튼 `aria-label="도움말"` |
| 점진 채택 | 기존 필드의 `hint`(항상 노출 캡션)와 공존 가능. 복잡한 필드부터 순차 적용 |
| 대상 | 조건식, 표현식, Tool 설정, Fallback 정책, Cron 표현식, 인증 헤더 등 개념 설명이 필요한 필드 |

> 상세 스펙: [User Guide Spec](../2-navigation/13-user-guide.md) · [FieldHelp 컴포넌트](../2-navigation/13-user-guide.md#8-공용-mdx-컴포넌트)

### 2.4 에러 처리 정책

| 옵션 | 동작 |
|------|------|
| **Stop Workflow** (기본) | 에러 발생 시 워크플로우 실행 중단. 상태: failed |
| **Skip Node** | 에러 발생 시 이 노드를 건너뛰고 다음 노드로 진행. 출력: null |
| **Use Default Output** | 에러 발생 시 미리 설정한 기본 출력 값 사용. 아래 §2.5 참조 |
| **Retry** | 재시도 (최대 재시도 횟수 `maxRetries`, 재시도 간격 `retryInterval` 설정). **구현 상태**: Error Handling select 에 `Retry` 옵션은 존재하나, `maxRetries`/`retryInterval` 입력 UI 는 미구현 (Planned) — `node-settings-panel.tsx` 에 별도 입력 필드 없음 |
| **Route to Error Port** | 에러 발생 시 에러 데이터를 `error` 포트로 전달. 선택 시 노드에 error 포트가 동적 생성됨. error 포트에 연결된 노드가 없으면 Stop Workflow 폴백. ([에러 처리 상세](../5-system/3-error-handling.md#32-route-to-error-port-상세) 참조) |

### 2.5 Use Default Output — 기본 출력값 정의

"Use Default Output" 정책 선택 시, 에러가 발생하면 사용자가 미리 설정한 기본 출력값을 대신 출력 포트로 전달한다.

#### 2.5.1 기본값 설정 UI (미구현 — Planned)

> **구현 상태**: 현재 설정 패널의 Error Handling 은 단일 select(`Stop`/`Skip`/`Use Default Output`/`Retry`/`Route to Error Port`)만 렌더링한다. "Use Default Output" 선택 시 아래의 조건부 JSON 에디터·"Reset to Type Default" 버튼은 아직 구현되어 있지 않다 (`node-settings-panel.tsx` §Error handling policy). 아래는 계획된 UI 다.

"Use Default Output" 선택 시 설정 패널에 기본값 입력 폼이 추가로 표시된다(계획):

```
┌──────────────────────────────────┐
│  Error Handling: [Use Default ▼] │
│                                  │
│  ▼ Default Output Value          │
│  ┌──────────────────────────────┐│
│  │ {                            ││
│  │   "result": null,            ││
│  │   "status": "fallback"       ││
│  │ }                            ││
│  └──────────────────────────────┘│
│  [Reset to Type Default]         │
└──────────────────────────────────┘
```

- JSON 에디터로 기본 출력값을 직접 편집
- 구문 강조 및 JSON 유효성 실시간 검증
- "Reset to Type Default" 버튼: 타입별 기본값으로 초기화

#### 2.5.2 타입별 기본값 (사용자가 미지정 시)

사용자가 기본값을 직접 설정하지 않은 경우, 노드 출력 타입에 따라 아래 값이 자동 적용된다:

| 출력 타입 | 기본값 | 설명 |
|-----------|--------|------|
| Object | `{}` | 빈 객체 |
| Array | `[]` | 빈 배열 |
| String | `""` | 빈 문자열 |
| Number | `0` | 영 |
| Boolean | `false` | 거짓 |
| Null/Unknown | `null` | null |

> **타입 추론**: 노드의 마지막 정상 실행 출력에서 타입을 추론한다. 실행 이력이 없으면 `Object`(`{}`)를 기본 타입으로 사용한다.

#### 2.5.3 실행 시 동작

```
1. 노드 실행 중 에러 발생
2. 에러 처리 정책이 "Use Default Output"인지 확인
3. 사용자가 설정한 기본값이 있으면 → 해당 값을 출력으로 사용
4. 사용자 설정이 없으면 → 타입별 기본값 적용 (§2.5.2)
5. 기본값을 출력 포트로 전달 → 다음 노드 정상 실행
6. NodeExecution 상태: "completed" (에러 없이 성공 처리됨)
   - 단, node_execution.error 필드에 원래 에러 정보를 기록 (디버깅용)
   - 캔버스에서 해당 노드에 ⚠️ 아이콘 표시 (성공했지만 기본값이 사용되었음을 표시)
```

---

## 3. 표현식 시스템

노드 설정에서 이전 노드의 출력 데이터를 참조할 때 사용하는 표현식 문법.

> **상세 사양**: 문법 BNF, 지원 함수 전체 목록, 타입 시스템, 에러 처리 등은 [표현식 언어 상세 스펙](../5-system/5-expression-language.md) 참조.

### 3.1 표현식 문법

```
{{ expression }}
```

### 3.2 사용 가능한 참조

| 참조 | 예시 | 설명 |
|------|------|------|
| 이전 노드 출력 | `{{ $node["Node A"].output.field }}` | 특정 노드의 출력 필드 (expression **평가 결과**) |
| 이전 노드 설정 | `{{ $node["Node A"].config.field }}` | 특정 노드의 설정 필드 (expression **원본**, 미평가 형태) |
| 직전 노드 출력 | `{{ $input.field }}` | 바로 이전 연결 노드의 출력 |
| 변수 | `{{ $var.myVariable }}` | 선언된 변수 참조 |
| 실행 컨텍스트 | `{{ $execution.id }}` | 현재 실행 ID |
| 현재 시간 | `{{ $now }}` | 현재 타임스탬프 |
| 환경 변수 | `{{ $env.MY_VAR }}` | 환경 변수 (셀프 호스팅) |
| Loop 인덱스 | `{{ $loop.index }}` | 현재 반복 인덱스 |
| ForEach 항목 | `{{ $item }}` | ForEach의 현재 항목 |
| JSON Path | `{{ $input.data[0].name }}` | 중첩 객체/배열 접근 |

> **`.config.*` vs `.output.*`** — 노드의 설정 필드 중 expression(`{{ ... }}`)이 포함된 것 (예: Send Email 의 `subject`, `body`) 은 두 영역에 서로 다른 값을 노출한다. `.config.subject` 는 작성된 **원본 템플릿** (예: `"Hello {{ name }}"`), `.output.subject` 는 **평가 결과** (예: `"Hello Alice"`) 다. expression 미사용 필드 (예: `mode`, `chartType`) 는 두 값이 동일하므로 `.config.*` 만 사용해도 충분하다. 상세는 [실행 엔진 §5.1](../5-system/4-execution-engine.md#51-nodehandler-인터페이스), [CONVENTIONS Principle 7](../conventions/node-output.md) 참조.

### 3.3 표현식 에디터

| 기능 | 설명 |
|------|------|
| 자동완성 | `{{` 입력 시 사용 가능한 참조 목록 팝업. 현재 노드에서 접근 가능한 조상 노드·변수만 표시 (토폴로지 기반) |
| 컨테이너 스코프 | 루프/ForEach 안에서만 `$loop` / `$item` / `$itemIndex` 제안. `parallel` 컨테이너는 바깥 스코프를 차단 |
| 노드 출력 스키마 | 이전 노드의 출력 구조를 트리 형태로 탐색/선택 |
| 실시간 검증 | 문법 오류는 빨간색, 접근 불가 노드·스코프 밖 변수 참조는 주황색 경고 |
| 미리보기 | 마지막 실행 데이터 기준으로 표현식 결과 미리보기 |
| 모드 전환 | 정적 값 ↔ 표현식 모드 토글 (필드별) |

---

## 4. 노드 데이터 흐름

### 4.1 데이터 구조

노드 간 전달되는 데이터는 JSON 형식이다.

```json
{
  "field1": "value1",
  "field2": 42,
  "nested": {
    "array": [1, 2, 3]
  }
}
```

### 4.2 데이터 전달 규칙

| 규칙 | 설명 |
|------|------|
| 1:1 연결 | 출력 데이터가 그대로 다음 노드의 입력으로 전달 |
| 1:N 분기 | 출력 데이터가 복제되어 각 연결된 노드에 동일하게 전달 |
| N:1 합류 | 여러 입력이 도착하면 Merge 노드의 전략에 따라 처리 |
| 조건부 분기 | If/Else, Switch 등은 조건에 맞는 출력 포트로만 데이터 전달 |
| 에러 라우팅 | 에러 정책이 "Route to Error Port"인 노드에서 에러 발생 시 에러 데이터를 `error` 포트로 전달. 에러 엣지(빨간 점선)로 연결된 다음 노드가 에러 데이터를 입력으로 실행 |
