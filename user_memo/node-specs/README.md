# 노드 스펙 레퍼런스

워크플로우 빌더에서 사용 가능한 모든 노드의 **input / output / config** 명세서입니다. 워크플로우를 제작할 때 노드 설정에서 변수(`{{ $node["..."].output.xxx }}` 등)로 접근할 수 있는 항목을 정확히 파악하기 위한 레퍼런스로 사용하세요.

> 본 문서는 `backend/src/nodes/<category>/*` 의 `*.schema.ts`, `*.handler.ts`, `*.component.ts` 와 `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 를 기준으로 작성되었습니다.

---

## 1. 공통 개념

### 1.1 NodeHandlerOutput (모든 노드의 실행 결과)

모든 노드 핸들러는 다음 구조의 객체를 반환합니다.
출처: `backend/src/modules/execution-engine/handlers/node-handler.interface.ts`

```ts
interface NodeHandlerOutput {
  config: Record<string, unknown>;     // 해석된 설정값 (자격증명은 제거됨)
  output: unknown;                     // 후속 노드에 전달되는 주 데이터
  meta?: Record<string, unknown>;      // 실행 메타데이터 (duration, statusCode, tokens 등)
  port?: string | string[];            // 라우팅 포트 지시 (없으면 기본 포트로 흐름)
  status?: string;                     // 흐름 제어 상태 (waiting_for_input, requires_integration 등)
}
```

후속 노드에서는 이 5가지 필드 모두에 변수로 접근할 수 있습니다.

```text
{{ $node["노드 이름"].config.<필드> }}    → 해석된 설정값
{{ $node["노드 이름"].output.<필드> }}    → 출력값
{{ $node["노드 이름"].meta.<필드> }}      → 메타데이터
{{ $node["노드 이름"].port }}             → 활성화된 출력 포트 ID
{{ $node["노드 이름"].status }}           → 상태 (대기/완료 등)
```

> 노드 이름이 같은 노드가 여러 개 있을 경우 `#2`, `#3` 같은 disambiguation suffix가 자동 부여됩니다 (실행 순서 기준). UUID로도 접근 가능합니다.

### 1.2 전역 Expression 컨텍스트

`{{ }}` 표현식 안에서 사용할 수 있는 전역 변수들입니다.
출처: `backend/src/modules/execution-engine/expression/expression-resolver.service.ts`

| 변수 | 설명 | 예시 |
| --- | --- | --- |
| `$input` | 현재 노드가 받은 input 객체 전체 | `{{ $input.user.email }}` |
| `$params` | `$input.parameters` 만 따로 노출 (트리거 파라미터 접근용) | `{{ $params.userId }}` |
| `$node["라벨"]` | 이전에 실행된 노드의 `NodeHandlerOutput` (위 1.1 참고) | `{{ $node["HTTP Request"].output.response.id }}` |
| `$var` | 워크플로우 변수 저장소 (Variable Declaration/Modification 노드로 관리) | `{{ $var.counter }}` |
| `$execution.id` | 현재 실행의 고유 ID | `{{ $execution.id }}` |
| `$execution.workflowId` | 워크플로우 ID | |
| `$execution.startedAt` | 실행 시작 시각 (ISO 8601) | |
| `$execution.mode` | 실행 모드 (`manual`, `webhook`, `schedule` 등) | |
| `$now` | 현재 시각 ISO 8601 문자열 | `{{ $now }}` → `2026-04-18T12:34:56.789Z` |
| `$today` | 오늘 날짜 (`YYYY-MM-DD`) | `{{ $today }}` → `2026-04-18` |
| `$loop` | Loop 노드 내부에서만 노출. `{ index, iteration, isFirst, isLast }` | `{{ $loop.iteration }}` |
| `$item` | ForEach/Map 본문 내부에서만 노출. 현재 항목 값 | `{{ $item.title }}` |
| `$itemIndex` | ForEach/Map 본문 내부에서만 노출. 현재 항목 인덱스(0-based) | `{{ $itemIndex }}` |

### 1.3 표현식 해석 규칙

- 문자열 전체가 단일 표현식(`{{ ... }}`)이면 **타입이 보존**됩니다 (숫자, 객체, 배열 그대로 반환).
- 문자열 안에 텍스트와 표현식이 섞여 있으면 **항상 문자열로 강제 변환**됩니다 (객체는 `JSON.stringify`).
- 필터 문법: `{{ path|upper }}`, `{{ path|lower }}`, `{{ path|default:GET }}`.
- 최대 중첩 깊이 10. 그 이상은 해석되지 않고 원본 유지.

### 1.4 포트 타입

| 타입 | 의미 |
| --- | --- |
| `data` | 일반 데이터 흐름 |
| `error` | 에러 발생 시 라우팅 |
| `control` | 흐름 제어용 (컨테이너 노드의 body/done 등) |
| `system` | 시스템적인 종료 사유 (`user_ended`, `max_turns`, `completed` 등) — 동적 포트에서만 사용 |

### 1.5 동적 포트 (Dynamic Ports)

일부 노드는 config에 따라 출력 포트가 동적으로 생성됩니다.
규칙 정의: `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts`

| 종류 (`kind`) | 적용 노드 | 어떻게 만들어지는가 |
| --- | --- | --- |
| `switch-cases` | `switch` | `config.cases[]`의 각 항목마다 `{id, label}` 포트 + `default` |
| `classifier-categories` | `text_classifier` | `config.categories[]`마다 `class_<index>` 포트 + `fallback`, `error` |
| `ai-agent-conditional` | `ai_agent` | `config.conditions[]`의 `id`로 포트 + `out`(single)/`user_ended`+`max_turns`(multi-turn) + `error` |
| `info-extractor-mode` | `information_extractor` | `mode === 'multi_turn'`이면 `completed`/`user_ended`/`max_turns`/`error`, 아니면 `out`/`error` |
| `presentation-buttons` | `form`, `carousel`, `table`, `chart`, `template` | `config.buttons[]`에서 `type === 'port'`인 버튼마다 포트, 없으면 정적 outputs |
| `parallel-branches` | `parallel` | `config.branchCount`(2~16)만큼 `branch_0` ... `branch_N` + `done` |

### 1.6 컨테이너 노드 (Container Nodes)

내부에 자식 노드(서브그래프)를 가지는 노드입니다. 본문(body) 내부에서 노드가 실행될 때 추가 컨텍스트가 노출됩니다.

| 노드 | body 내부에 노출되는 컨텍스트 |
| --- | --- |
| `loop` | `$loop.index`, `$loop.iteration`, `$loop.isFirst`, `$loop.isLast` |
| `foreach`, `map` | `$item`, `$itemIndex` (+ 위 `$loop.*`) |
| `parallel` | (분기별 독립 실행, 각 분기는 자체 input 받음) |
| `background` | (background 분기 fire-and-forget) |
| `workflow` | (인라인 sub-workflow 실행) |

### 1.7 Blocking 노드 (사용자 입력 대기)

다음 노드들은 `status: 'waiting_for_input'` 을 반환하여 워크플로우 실행을 일시 중지하고, 사용자 입력을 받은 후 엔진이 output을 갱신합니다.

| 노드 | 대기 종류 | 재개 후 output 채워지는 필드 |
| --- | --- | --- |
| `form` | 폼 제출 | `output.submittedData` |
| `ai_agent` (multi_turn) | 사용자 메시지 | `output.response`, `output.messages` 등 |
| `information_extractor` (multi_turn) | 사용자 메시지 | 추출된 필드들 |
| `carousel` | 버튼 선택 | `output.buttonId` 등 |

---

## 2. 카테고리별 노드 인덱스

### Trigger
| 노드 타입 | 라벨 | 문서 |
| --- | --- | --- |
| `manual_trigger` | Manual Trigger | [trigger/manual_trigger.md](./trigger/manual_trigger.md) |

### Logic
| 노드 타입 | 라벨 | 문서 |
| --- | --- | --- |
| `if_else` | If/Else | [logic/if_else.md](./logic/if_else.md) |
| `switch` | Switch | [logic/switch.md](./logic/switch.md) |
| `loop` | Loop | [logic/loop.md](./logic/loop.md) |
| `foreach` | ForEach | [logic/foreach.md](./logic/foreach.md) |
| `map` | Map | [logic/map.md](./logic/map.md) |
| `split` | Split | [logic/split.md](./logic/split.md) |
| `merge` | Merge | [logic/merge.md](./logic/merge.md) |
| `filter` | Filter | [logic/filter.md](./logic/filter.md) |
| `parallel` | Parallel | [logic/parallel.md](./logic/parallel.md) |
| `background` | Background | [logic/background.md](./logic/background.md) |
| `variable_declaration` | Variable Declaration | [logic/variable_declaration.md](./logic/variable_declaration.md) |
| `variable_modification` | Variable Modification | [logic/variable_modification.md](./logic/variable_modification.md) |

### Flow
| 노드 타입 | 라벨 | 문서 |
| --- | --- | --- |
| `workflow` | Sub-Workflow | [flow/workflow.md](./flow/workflow.md) |

### AI
| 노드 타입 | 라벨 | 문서 |
| --- | --- | --- |
| `ai_agent` | AI Agent | [ai/ai_agent.md](./ai/ai_agent.md) |
| `text_classifier` | Text Classifier | [ai/text_classifier.md](./ai/text_classifier.md) |
| `information_extractor` | Information Extractor | [ai/information_extractor.md](./ai/information_extractor.md) |

### Integration
| 노드 타입 | 라벨 | 문서 |
| --- | --- | --- |
| `http_request` | HTTP Request | [integration/http_request.md](./integration/http_request.md) |
| `database_query` | Database Query | [integration/database_query.md](./integration/database_query.md) |
| `send_email` | Send Email | [integration/send_email.md](./integration/send_email.md) |

### Data
| 노드 타입 | 라벨 | 문서 |
| --- | --- | --- |
| `transform` | Transform | [data/transform.md](./data/transform.md) |
| `code` | Code | [data/code.md](./data/code.md) |

### Presentation
| 노드 타입 | 라벨 | 문서 |
| --- | --- | --- |
| `form` | Form | [presentation/form.md](./presentation/form.md) |
| `carousel` | Carousel | [presentation/carousel.md](./presentation/carousel.md) |
| `table` | Table | [presentation/table.md](./presentation/table.md) |
| `chart` | Chart | [presentation/chart.md](./presentation/chart.md) |
| `template` | Template | [presentation/template.md](./presentation/template.md) |

---

## 3. 각 노드 문서의 구조

각 노드 문서는 다음 섹션으로 구성됩니다.

1. **상단 메타 정보**: 카테고리, 컨테이너 여부, Blocking 여부, 동적 포트 여부
2. **Config 파라메터**: 필드명 / 타입 / 필수 / 기본값 / 설명 / 표현식 지원 여부 표
3. **Ports**: 입력/출력 포트 (동적 포트가 있으면 생성 규칙 포함)
4. **Input**: 이전 노드로부터 받는 값을 핸들러가 어떻게 사용하는지
5. **Output**: 케이스별로 분기된 실제 예시 JSON + 필드 설명
6. **변수로 접근 가능한 항목**: `$node["..."]`로 노출되는 모든 항목
7. **주의사항**: 제약, 함정, 호환성

> 핸들러 내부 알고리즘, Zod validation 세부 규칙(min/max/regex), UI 위젯 타입 세부는 본 문서 범위에서 제외됩니다 (필요 시 코드를 직접 참조하세요).
