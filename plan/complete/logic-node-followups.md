# Logic 노드 잔여 후속 (P0/P1/P2)

> 작성일: 2026-05-11 / 최종 갱신: 2026-05-11 (의사결정 D1~D7 반영)
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A

## 배경

`spec/4-nodes/1-logic/*` 의 여러 노드 spec이 P0/P1/P2 미구현 마커를 명시하고 있다. 카테고리·영향 범위 기준으로 한 plan에 묶어 한 번의 PR 단위(또는 PR 시리즈)로 처리한다.

## 관련 문서

- `spec/4-nodes/1-logic/0-common.md` §meta 표 (If/Else / Switch / Variable Decl/Mod 의 P0/P1 미구현)
- `spec/4-nodes/1-logic/1-if-else.md` §Operator (P1 `is_type` / `regex` silent fall-through)
- `spec/4-nodes/1-logic/3-loop.md` §1 / §6 / §8 (P1 `breakCondition` 미평가)
- `spec/4-nodes/1-logic/11-merge.md` §1 / §6 (P2 `timeout` / `partialOnTimeout` dormant)
- 사용자 메모 개선안:
  - `user_memo/node-specs-improvement/logic/loop.md` §2 항목 4
  - `user_memo/node-specs-improvement/logic/parallel.md` (Parallel은 별도 plan에서 처리 — `parallel-p2.md`)
  - `user_memo/node-specs-improvement/logic/switch.md` §3 잔여 항목

## 의사결정 요약 (확정)

| ID | 항목 | 결정 |
| --- | --- | --- |
| D1 | If/Else `is_type` / `regex` | **구현** (`core/condition-evaluator.util.ts` 에 추가, frontend 옵션 복원) |
| D2 | Loop `breakCondition` | **구현** (어댑터 + LoopExecutor 주입 + `meta.exitReason`) |
| D3 | Merge `timeout` / `partialOnTimeout` P2 | **본 plan 에 흡수** (엔진 fan-in 모델 선결 조사 필요) |
| D4 | Switch `meta.value` deprecated alias | **본 PR 에서 제거** + 마이그레이션 |
| D5 | Variable Modification 이전/이후 값 | **opt-in** (`config.recordValues=true` 일 때만 + 마스킹 유틸) |
| D6 | Switch `meta.switchPath` (user_memo §3 #1) | **보류** |
| D7 | Switch case id reserved word 검증 | **본 plan 에 포함** |

## 작업 단위

### 1. If/Else operator 정리 (P1) — D1 구현 ✅ 완료 (PR-2)

- [x] `backend/src/nodes/core/condition-evaluator.util.ts` 의 `CONDITION_OPERATORS` 에 `'regex'`, `'is_type'` 추가 + `evaluateResolvedCondition` 신설 + `compileRegexCache` 이전. `evaluateCondition` 은 SSOT 위임으로 단순화
- [x] `_shared/condition-eval.util.ts` 가 `core` 의 `CONDITION_OPERATORS` / `Condition` / `ConditionOperator` / `MAX_REGEX_LENGTH` / `EXPRESSION_PATTERN` / `compileRegexCache` 를 import·재export 해 SSOT 단일화. `not_contains` defensive 의미 (non-string 시 false) 는 Filter 의도적 잔존
- [x] `backend/src/nodes/core/condition-evaluator.util.spec.ts` 에 `is_type` / `regex` / SSOT export 단위 테스트 추가
- [x] `frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx` 의 `operatorOptions` 에 `is_type` 옵션 복원 + ko/en `opType` i18n 라벨
- [x] `spec/4-nodes/1-logic/1-if-else.md:155` 의 "⚠ 미구현 (P1)" 박스 제거 → 실제 동작 명세로 교체

### 2. Loop `breakCondition` 평가 (P1) — D2 구현 ✅ 완료 (PR-3)

조사 결과 frontend 가 이미 `breakCondition` 을 string `{{ }}` expression 으로 수집 중. ConditionGroup 어댑터 대신 schema 를 string expression 으로 정렬하는 방향으로 전환 (frontend ↔ backend 정합).

- [x] `loop.schema.ts`: `breakCondition` 을 `conditionGroupSchema.optional()` → `z.string().optional()` 로 변경. UI 위젯·placeholder·hint 갱신
- [x] `expression-exclusions.ts`: `loop.breakCondition` 을 EXPRESSION_EXCLUSIONS 에 추가 (사전 resolveConfig 가 i=0 시점에 substitute 하면 매 iteration 재평가가 무력화 + `$loop` 가 dispatch 시점에 undefined 라 throw)
- [x] `execution-engine.service.ts`: 컨테이너 loop 분기에서 raw `node.config.breakCondition` 을 읽어 `buildLoopBreakConditionEvaluator` 로 closure 생성. 매 iteration 종료 후 `expressionResolver.buildExpressionContext` 로 fresh ctx ($loop·$var·$node[...].output 최신값) 만들어 `evaluate()` 재호출. 평가 실패는 silent false (loop 진행 — Filter 의 defensive 패턴 차용)
- [x] `LoopExecutor`: `LoopExecutionResult { iterations, exitReason }` 반환. `exitReason: 'completed' | 'break' | 'maxIterations'`. `count===maxIterations` 정상 완주는 `maxIterations` 로 reclassify
- [x] `meta` 에 `exitReason` 추가. `meta.maxIterationsReached` 는 `exitReason === 'maxIterations'` 와 동치로 의미 정렬
- [x] frontend Loop 위젯 — 이미 string expression 입력으로 작동 중 (logic-configs.tsx:226-234). 변경 불필요
- [x] `spec/4-nodes/1-logic/3-loop.md` 의 P1 미구현 박스 3개 제거 + breakCondition·meta.exitReason 명세 추가 + ConditionGroup → Expression 표기 갱신
- [x] frontend MDX 문서 (logic.mdx / logic.en.mdx) `breakCondition` 타입을 expression 으로 갱신
- [x] 단위 테스트 — 기존 maxIterations 테스트에 exitReason 검증 추가 + 신규 "exits early when breakCondition becomes truthy" 테스트 ($loop.index >= 2 → 3회 실행 후 break)

### 3. If/Else, Switch `meta.matchedConditions` / `meta.matchedCaseIndex` (P0) — ✅ 완료 (PR-1 + PR-5)

- [x] If/Else 핸들러 `meta.matchedConditions` 누적 — `if-else.handler.ts:74-83`
- [x] Switch 핸들러 `meta.matchedCaseIndex` / `meta.matchedCaseLabel` / `meta.resolvedValue` — `switch.handler.ts:115-127, 130-142`
- [x] `spec/4-nodes/1-logic/0-common.md` §meta 표·§10 Pass-through 표에서 "(P0 미구현)" 표기 제거 — PR-1
- [x] 본 plan 표기 정정 — `meta.matchedValue` → `meta.resolvedValue` (실제 핸들러 명칭 반영)
- [x] frontend run-results UI 영향 점검 — additive 필드라 기존 표시 로직에 안전 (UI 표시는 필요 시 별도 PR)

### 4. Variable Declaration / Modification meta 필드 (P1) — ✅ 완료 (PR-1 + PR-4)

- [x] Variable Declaration `meta.declared[]` / `meta.skipped[]` / `meta.coercionWarnings[]` — `variable-declaration.handler.ts:81-89`
- [x] Variable Modification `meta.modifications[]` / `meta.coercionWarnings[]` / `meta.createdVariables[]` — `variable-modification.handler.ts:77-87, 204-211`
- [x] `spec/4-nodes/1-logic/0-common.md` 의 "(P1 미구현)" 표기 제거 — PR-1
- [x] 본 plan 표기 정정 — `declaredVariables` → `declared` (실제 핸들러 명칭)
- [x] **D5 opt-in 추가** (PR-4):
  - [x] `variable-modification.schema.ts` 에 `recordValues: z.boolean().default(false)` 필드 추가 + UI 체크박스 hint
  - [x] `backend/src/nodes/logic/_shared/value-masking.util.ts` (신규) — secret 변수명 패턴 → `'***'`, JSON 4096 byte 초과 → `'[truncated:N bytes]'`, function/symbol → `'[unsupported:...]'`, primitive·소형 컬렉션은 deep-clone 보존
  - [x] `variable-modification.handler.ts`: recordValues=true 시 before(mutation 직전 캡처 — push 의 in-place mutation 회피) / after 기록, 둘 다 maskValueForLog 적용
  - [x] `spec/4-nodes/1-logic/5-variable-modification.md` §1·§5.1 갱신
  - [x] `logic-configs.tsx` Variable Modification 섹션에 `recordValues` 체크박스 + i18n 라벨/hint
  - [x] 단위 테스트 — value-masking.util.spec (신규) + handler.spec recordValues 케이스 5개

### 5. Merge 노드 `timeout` / `partialOnTimeout` (P2) — 별도 plan 분리 (PR-6 fallback) ✅

엔진 조사 결과 (PR-6 첫 단계, 2026-05-11) 현 sequential 모델에서는 모든 predecessor 가 Merge dispatch 시점에 이미 resolved → "도착 시간차" 자체가 없어 timeout / partialOnTimeout 의 의미가 성립하지 않음. 진정한 fan-in barrier 는 엔진 비동기 dispatch 모델 도입이 선결 조건. 본 plan 의 fallback 경로에 따라 별도 plan 으로 분리.

- [x] **엔진 fan-in 모델 조사** — sequential 모델 (토폴로지 정렬 후 순차 포인터 루프 `runExecution` L1155-1376), `gatherNodeInput` 의 `executedNodes.has(sourceId)` 가드 (L3098-3115), background 노드의 BullMQ enqueue 패턴 (L3665-3723), Promise.race timeout 은 Sub-Workflow / Background 에만 사용 (L1034-1081, L3750-3763), per-edge 도착 추적 자료구조 부재 → barrier 자체는 small 변경으로 흉내 가능하나 timeout/partialOnTimeout 의 의미 부재
- [x] **별도 plan 으로 분리**: [`plan/in-progress/merge-p2-async-fanin.md`](./merge-p2-async-fanin.md) 에 선결 조건 (엔진 비동기 dispatch PoC) + 작업 단위 + 의존성·리스크 기록
- [x] 본 plan 의 §5 는 **현 dormant spec 정합 마감 상태로 종료**: spec `11-merge.md` 의 dormant 표기 (L7-9, L19-20, L74-75, L132, L187, L203) 는 PR 작업 이전부터 이미 정합 + handler 의 warn 로그 / `meta.dormantFields` 도 명시적 — 추가 코드 변경 불필요

### 6. Switch 노드 follow-up — D4 + D7 + D6 보류 ✅ 완료 (PR-5)

- [x] **D4 — `meta.value` deprecated alias 제거**:
  - [x] `backend/` `frontend/` 전역에서 `meta.value` (Switch 노드) 사용처 grep — switch.handler 본체 + switch.handler.spec 2개 라인만 영향. frontend·다운스트림 노드 사용처 없음
  - [x] `backend/scripts/migrate-node-output-refs.ts` 에 `RENAMED_META_FIELDS` 신설 + Pass 4b — `$node["X"].meta.value` → `meta.resolvedValue` (Switch 노드만). 기존 `META_FIELDS.switch` 의 `output.value` → `meta.value` 와 체이닝되어 옛 `.output.value` 표현식도 한 번에 `meta.resolvedValue` 로 도달
  - [x] `switch.handler.ts`: alias 라인 제거 → `{ resolvedValue: switchValue }` 만 echo. D4 결정·마이그레이션 출처를 코드 주석에 명시
  - [x] `spec/4-nodes/1-logic/2-switch.md`: §5.1/§5.2 의 `meta.value` 행·예시 제거 + "후속 정비안" 섹션을 완료/보류 표기로 갱신
  - [x] 단위 테스트 — handler.spec 의 alias 검증을 "제거 회귀 잠금" 으로 의미 전환 + migrate-node-output-refs.spec 에 RENAMED_META_FIELDS 케이스 추가
- [x] **D7 — case id reserved word 검증**:
  - [x] `switch.schema.ts validateSwitchConfig` 에 `RESERVED_CASE_IDS = ['default', 'out', 'error']` 추가. 정적 default 포트·기타 노드 관습 포트와의 의미 충돌을 schema 단계에서 차단 (frontend UI 는 case id 를 자동 UUID 로 부여하므로 정상 흐름에서는 충돌 불가능. import / AI 생성 워크플로 / 직접 JSON 편집 경로 보호)
  - [x] schema.spec 에 3개 reserved word 각각의 reject + substring 변형 (default_admin / outbound / error_recovery) 통과 회귀 테스트
- [x] **D6 — `meta.switchPath` 보류 메모**:
  - [x] `user_memo/node-specs-improvement/logic/switch.md` §3 머리말에 D4/D6/D7 결정 메모 추가 (보류 사유: switchValue 가 raw 표현식으로 `config.switchValue` 에 echo 되므로 별도 path 필드 가치 낮음)

### 7. 검증 — 마지막 단계 (PR 마감 후)

- [ ] backend lint / unit / build 통과 — 단계별 PR 에서 매번 확인. 최종 sweep 필요
- [ ] frontend lint / build 통과 — 단계별 PR 에서 매번 확인. 최종 sweep 필요
- [x] `migrate-node-output-refs.ts` 에 D4 RENAMED_META_FIELDS 신설 + 단위 테스트 회귀 잠금
- [ ] `grep -rn "P0\|P1\|P2\|미구현" spec/4-nodes/1-logic/` → 결정에 부합하는 마커만 남는지 확인 (Merge dormant 표기는 의도적 잔존)
- [ ] `ai-review` 실행 → Critical/Warning 해소

## PR 단계 (실행 결과)

| PR | 내용 | 커밋 | 상태 |
| --- | --- | --- | --- |
| PR-1 | spec 정합 only — §3·§4 P0/P1 표기 제거 | `f4f770ec` | ✅ |
| PR-2 | D1 — If/Else `is_type`/`regex` evaluator 통합 | `0e4c1139` | ✅ |
| PR-3 | D2 — Loop breakCondition 어댑터 + meta.exitReason | `6ce2a8e4` | ✅ |
| PR-4 | D5 — Variable Modification recordValues opt-in + 마스킹 | `e67d0937` | ✅ |
| PR-5 | D4 + D7 — Switch meta.value 제거 + reserved word | `90d44212` | ✅ |
| PR-6 | D3 — Merge P2 엔진 조사 → `merge-p2-async-fanin.md` 별도 plan 분리 | (문서 only) | ✅ |

## 수용 기준

- §1~§6 항목의 결정이 PRD/Spec에 반영되고 코드와 일치
- spec `4-nodes/1-logic/*` 의 "P0/P1/P2 미구현" 표기가 모두 제거되거나 활성 표기로 갱신
- 단위/통합 테스트가 신규 동작을 회귀 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: 없음. `prd-spec-sync.md` 와 병렬 진행 가능
- **리스크**:
  - D1: `_shared` ↔ `core` evaluator 통합 시 Filter 의 `compileRegexCache` 경로 보존 필수
  - D2: closure 가 보는 컨텍스트(특히 `previousOutput` 노출 변수명) 결정 필요 — spec 에 명시
  - D3: 엔진 조사 결과에 따라 본 plan 의 §5 가 별도 plan 으로 분리될 수 있음
  - D4: 다운스트림 grep 누락 시 사용자 워크플로 break — 마이그레이션 스크립트 + e2e 검증 필수
  - D5: 마스킹 유틸의 secret 패턴 매칭이 false negative 시 PII 유출 가능 — 보수적 정책 (default mask, opt-out 으로 reveal) 채택 권장
