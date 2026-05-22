---
worktree: ai-presentation-tools-9b7c5c
started: 2026-05-22
owner: resolution-applier
---
# Spec Fix Draft — presentation top-level field references

## 원본 발견사항

SUMMARY#S1: spec §6.1.d.i `data.presentations[]` 오기재 — top-level `presentations[]` 수정 필요
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md` 라인 333 (§6.1.d.i)
- 내용: "ConversationTurn (현재 turn 의 ai_assistant) 의 `data.presentations[]` 에 push" → `top-level presentations[]` 로 수정

SUMMARY#S2: spec §10.1 `chartNodeConfigSchema` → `chartConfigSchema` 명칭 오기재
- 위치: `spec/4-nodes/6-presentation/0-common.md` §10.1 표
- 내용: chart 행의 schema 이름 `chartNodeConfigSchema` → `chartConfigSchema` 로 수정 (코드 실제 export 명과 일치)

SUMMARY#S3: spec §10.4 `data.presentations[i].truncation` 오기재
- 위치: `spec/4-nodes/6-presentation/0-common.md` §10.4
- 내용: `data.presentations[i].truncation` → `presentations[i].truncation` 로 수정

SUMMARY#S4: spec §12.4 Rationale v1 bullet `ConversationTurn data.presentations[]` 오기재
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md` 라인 1071 (§12.4 v1 bullet)
- 내용: `ConversationTurn data.presentations[] 단일 진실` → `ConversationTurn top-level presentations[] 단일 진실` 로 수정

## 제안 변경

### 1-ai-agent.md §6.1.d.i (line 333)

현재:
```
d.i. **표현 도구 (`render_*`) display-only ...**: payload 를 해당 presentation 노드의 zod schema 로 validate → `defaults` overlay 적용 → 1MB cap 적용 → ConversationTurn (현재 turn 의 `ai_assistant`) 의 `data.presentations[]` 에 push → tool_result 로 `{ok: true}` 스텁 회신.
```

변경 후:
```
d.i. **표현 도구 (`render_*`) display-only ...**: payload 를 해당 presentation 노드의 zod schema 로 validate → `defaults` overlay 적용 → 1MB cap 적용 → ConversationTurn (현재 turn 의 `ai_assistant`) 의 top-level `presentations[]` 에 push → tool_result 로 `{ok: true}` 스텁 회신.
```

### 1-ai-agent.md §12.4 Rationale (line ~1071)

현재:
```
- v1: per-node opt-in, 5 도구 동시 출시, schema 위반 silent drop, presentation 페이로드는 ConversationTurn `data.presentations[]` 단일 진실, downstream 은 thread 접근.
```

변경 후:
```
- v1: per-node opt-in, 5 도구 동시 출시, schema 위반 silent drop, presentation 페이로드는 ConversationTurn top-level `presentations[]` 단일 진실, downstream 은 thread 접근.
```

### 0-common.md §10.1 표 (chart schema 이름)

현재:
```
| `render_chart` | [Chart](./3-chart.md) | `chartNodeConfigSchema` (zod) → JSON Schema |
```

변경 후:
```
| `render_chart` | [Chart](./3-chart.md) | `chartConfigSchema` (zod) → JSON Schema |
```

### 0-common.md §10.4 (truncation 경로)

현재:
```
data.presentations[i].truncation 에 surface 한다
```

변경 후:
```
presentations[i].truncation 에 surface 한다
```

## 주의사항

- 모두 spec 문서 오기재 수정이며 코드 변경 없음
- 코드 구현은 이미 top-level `presentations[]` 를 정확히 사용하고 있으므로 코드 변경 불필요
- `project-planner` 가 수정 전 consistency-check --spec 을 실행해야 함
