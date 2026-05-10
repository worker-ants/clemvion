# spec/4-nodes 노드 output·config 상세화 정비 (완료)

**상태**: 완료 (2026-05-10)

## Context

`$node["X"].output.*`·`$node["X"].config.*` 같은 워크플로 표현식의 정합성을 확보하기 위해, `spec/4-nodes/` 31개 노드 spec과 7개 카테고리 공통 문서를 [CONVENTIONS](../../user_memo/node-specs-improvement/CONVENTIONS.md) 의 5필드 모델(`{config, output, meta?, port?, status?}`) 로 통일했다. 이전 상태:

- 백엔드 코드는 이미 5필드 모델로 작동 중.
- `user_memo/node-specs-improvement/` 에 27개 노드의 5필드 기반 개선안 + Principle 0~11 + INCONSISTENCY_MATRIX 가 정리됨 (사실상 reference).
- `spec/4-nodes/` 일부(AI/Presentation/Integration의 0-common 일부)만 정합. Logic 12개 노드는 §5 출력 구조 부재. AI Agent §7은 옛 포맷(`output.metadata.*`, top-level `output.response`) 잔재.
- 외부 spec(spec/3-workflow-editor, spec/5-system) 인용은 옛 포맷 0건이라 정합화 부담 낮음.

## 결정사항

| 항목 | 결정 |
|---|---|
| soT 정책 | user_memo 개선안을 spec에 반영. 코드 미반영 항목은 `> ⚠ 미구현 (P0/P1)` 마커 |
| 공통 문서 | 카테고리 7개(2-flow 포함) 0-common.md 모두 5필드 표준 골격 일관 적용 |
| 외부 spec | 일괄 정합화 (실제로는 옛 포맷 인용 0건 → broken anchor 3건만 정정) |
| 2-flow | 0-common.md 신설 |
| 카테고리 진행 순서 | Logic → Data → Trigger → Flow → Integration → AI → Presentation |

## 작업 결과

### Phase 0: 사전 준비

- `spec/4-nodes/1-logic/1-if-else.md` 를 표준 §1~§7 템플릿으로 직접 재작성 (30개 노드 에이전트의 few-shot reference)

### Phase 1: 카테고리 공통 문서 정비 (7개)

- **신규**: `spec/4-nodes/2-flow/0-common.md`
- **§5필드 공통 규약 + §출력 구조 색인 + §CHANGELOG 추가**: 7개 0-common.md 모두 (`1-logic`, `2-flow`, `3-ai`, `4-integration`, `5-data`, `6-presentation`, `7-trigger`)
- **§Pass-through 노드 규약 신규**: `1-logic/0-common.md` §10 (if_else, switch, var_decl, var_mod, background main)
- **§9.1 Container 핸들러↔엔진 오버라이트 컨트랙트 신규**: `1-logic/0-common.md`
- **§6.1 `meta.duration` → `meta.durationMs` 통일 결정**: `4-integration/0-common.md` (Breaking, P0)
- 모든 0-common 의 기존 §1~§N anchor 보존 (외부 인용 보존을 위해)

### Phase 2: 노드 문서 31개 정비 (서브 에이전트 병렬)

각 노드는 표준 템플릿 §1~§7(또는 §8) 으로 재작성. 카테고리별 처리 결과:

| 카테고리 | 노드 | 핵심 변경 |
|---|---|---|
| Logic (12) | if_else, switch, loop, foreach, map, filter, split, merge, parallel, background, var_decl, var_mod | §5 출력 구조 신규 작성. Container 4종 §5.7 엔진 오버라이트 명문화. Pass-through 5종 컨트랙트 명시 |
| Data (2) | code, transform | code §5.3 에러 envelope. transform §5.8 pre-flight throw |
| Trigger (1) | manual_trigger | `config.parameters` schema vs `output` evaluated 직교 명시 |
| Flow (1) | workflow | sync/async §5.1/§5.2 분기. §5.3 error envelope. §5.8 재귀 깊이 throw |
| Integration (3) | http_request, database_query, send_email | `output.response/rows/messageId` 1차 네이밍 통일. `meta.duration` → `meta.durationMs` 정정 |
| AI (3) | ai_agent, text_classifier, info_extractor | **ai_agent §7 통째 재작성** (옛 `output.metadata.*` 폐지 → `output.result.*` + `meta.*`). 7 sub-cases (§7.1~§7.9). LLM 공통 wrapper `output.result.*` / `output.error.*` / `output.interaction.*` 적용 |
| Presentation (5) | form, carousel, table, chart, template | §5.4 waiting / §5.5 resumed 페어. 옛 `output.submittedData`/`output.view`/`output.previousOutput`/`output.type` 폐기. per-item 동적 포트 `__item_${idx}` 명시 |

### Phase 3: 검증 및 외부 spec 정합화

- §5(또는 §7) 헤더 누락 노드: **0건**
- 옛 포맷 잔재(`output.metadata`/`output.view`/`output.submittedData`/`output.previousOutput`): spec/4-nodes 내 0건 (CHANGELOG · 폐기 노트 인용 제외)
- 외부 spec(spec/3-workflow-editor, spec/5-system) 옛 포맷 인용: 0건
- doc-link checker: **0 broken refs across 81 markdown files**
- 정정한 broken anchor 3건:
  - `spec/4-nodes/2-flow/0-common.md:44` `#32-error-port-fallback` → `#32-route-to-error-port-상세`
  - `spec/4-nodes/2-flow/1-workflow.md:81` 동일
  - `spec/4-nodes/6-presentation/1-carousel.md:272` `#22-식별된-불일치` → `#2-식별된-불일치`

## 주요 변경점 (외부 영향)

### Breaking changes

| 변경 | 영향 | 대응 |
|---|---|---|
| ai_agent: `output.response` → `output.result.response` | 다운스트림 expression | spec에 매핑 표 명시 + user_memo 개선안 §4.1 인용 |
| ai_agent: `output.metadata.*` → `meta.*` | 토큰·모델·duration 메트릭 | 동일 |
| ai_agent: `output._turnDebugHistory` → `meta.turnDebug` | 디버그 트레이스 | 동일 |
| info_extractor: `output.output.extracted` → `output.result.extracted` | 이중 wrapper 제거 (Principle 8) | 동일 |
| http_request: `meta.duration` → `meta.durationMs` | 시간 메트릭 | 코드 측 정정 P0 backlog |
| presentation: `output.submittedData` / `output.view` / `output.previousOutput` / `output.type` 폐기 | 폼 제출·블로킹 노드 | `output.interaction.{type, data, receivedAt}` 통일 (Principle 4.5) |

### Spec 미반영 코드 backlog (P0/P1 미구현 마커)

각 노드 §5 또는 §6 에 `> ⚠ 미구현 (P0/P1)` 마커로 명시. 주요 항목:

- if_else: `meta.conditionResult`, `meta.matchedConditions` (P0)
- switch: `meta.matchedCaseIndex`, `meta.matchedValue` (P0)
- var_decl/var_mod: `meta.declaredVariables[]`, `meta.modifications[]` (P1)
- loop: `meta.iterations`, `meta.maxIterationsReached` (P1)
- text_classifier: `meta: {}` (에러 케이스 시 메트릭 미포함, P1)
- ai_agent multi-turn: 핸들러의 `port: 'out'` hardcode 제거 (의도한 종결 사유별 포트로 정정, 별도 plan 필요)
- http_request: 코드 측 `meta.duration` → `meta.durationMs` 정정 (P0)
- 기타 carousel waiting `output.items` echo 등 Principle 1.1 위반 케이스

## Critical Files

- `/Volumes/project/private/idea-workflow/user_memo/node-specs-improvement/CONVENTIONS.md` — 5필드 모델·Principle 0~11 원전
- `/Volumes/project/private/idea-workflow/spec/4-nodes/<cat>/0-common.md` — 7개 카테고리 공통 (정비됨)
- `/Volumes/project/private/idea-workflow/spec/4-nodes/<cat>/<n>-<node>.md` — 31개 노드 (정비됨)
- `/Volumes/project/private/idea-workflow/spec/4-nodes/0-overview.md` — Flow 카테고리 링크 정정 (0-common.md 신설 반영)

## 검증

- ✅ §5(또는 §7) 헤더가 모든 31개 노드에 존재
- ✅ §5 JSON 모두 5필드 외 top-level key 0개
- ✅ 옛 포맷(`output.metadata`/`output.view`/`output.submittedData`/`output.previousOutput`/`output.type`) 사용 0건 (CHANGELOG/폐기 인용 제외)
- ✅ Container 4종(loop/foreach/map/parallel) `{<컬렉션>, count}` 형식 일관 (Principle 9)
- ✅ LLM 3종(ai_agent/text_classifier/info_extractor) `output.result.*` 패턴 일관
- ✅ Integration 3종 `output.error.{code: UPPER_SNAKE_CASE, message, details?}` 패턴 일관
- ✅ Presentation 5종 §5.4 waiting / §5.5 resumed 페어 보유
- ✅ 외부 spec 옛 포맷 인용 0건
- ✅ doc-link checker 0 broken refs
- ✅ 모든 0-common.md 출력 구조 색인 채움 + CHANGELOG 등재

## 후속 작업 (별도 plan으로 분리)

본 작업은 **spec 정합화**에 한정됨. 다음 항목은 코드 변경이 필요하므로 별도 plan으로 추진:

1. **코드 측 P0 정정** (필수):
   - `http_request.handler.ts`: `meta.duration` → `meta.durationMs`
   - `ai_agent.handler.ts` `buildMultiTurnFinalOutput`: 종결 사유별 정확한 port 결정 (`out` hardcode 제거)
   - presentation 노드들의 Principle 1.1 위반 (output에 config 리터럴 echo) 정정
2. **코드 측 P0/P1 기능 추가** (선택):
   - Logic 분기 노드 `meta.conditionResult` / `meta.matchedConditions` 추가
   - LLM 노드 에러 케이스 `meta.{model, durationMs}` 채움
   - 기타 user_memo 개선안의 미구현 P0 항목들
