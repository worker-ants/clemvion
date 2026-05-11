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

### 1. If/Else operator 정리 (P1) — D1 구현

`is_type` / `regex` 가 schema enum 에는 있으나, If/Else·Switch(expression) 가 사용하는 `core/condition-evaluator.util.ts` 의 `CONDITION_OPERATORS` 에는 없어 silent `false` fall-through 된다 (Filter 가 사용하는 `_shared/condition-eval.util.ts` 와는 별개의 evaluator).

- [ ] `backend/src/nodes/core/condition-evaluator.util.ts` 의 `CONDITION_OPERATORS` 에 `'regex'`, `'is_type'` 추가 + `evaluateCondition` switch 분기에 두 case 구현 (`_shared/condition-eval.util.ts:123-137` 패턴 차용 — `MAX_REGEX_LENGTH` / `VALID_TYPES` 상수도 함께 이동)
- [ ] `_shared/condition-eval.util.ts` 와의 통합 — 권장: `_shared` 의 `evaluateResolvedCondition` 이 `core` 측 함수를 위임 호출하도록 변경. 단 Filter 의 `compileRegexCache` per-item 최적화는 유지
- [ ] `backend/src/nodes/core/condition-evaluator.util.spec.ts` 에 `is_type` / `regex` 단위 테스트 추가 (silent false 회귀 잠금)
- [ ] `frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx` 의 `operatorOptions` 에 `is_type` 옵션 복원 (i18n 라벨 추가)
- [ ] `spec/4-nodes/1-logic/1-if-else.md:155` 의 "⚠ 미구현 (P1)" 박스 제거
- [ ] `spec/4-nodes/1-logic/0-common.md` §2 지원 연산자 표가 두 op 의 동작을 정확히 기술하는지 확인

### 2. Loop `breakCondition` 평가 (P1) — D2 구현

`loop-executor.ts` 는 함수 형태 `breakCondition` 시그니처를 받지만, JSON `ConditionGroup` → 함수 변환 경로가 없고 `execution-engine.service.ts:4464-4488` 가 `breakCondition` 자체를 전달하지 않는다.

- [ ] `backend/src/nodes/core/condition-group-adapter.util.ts` (신규) — `ConditionGroup` 을 `(ctx) => boolean` closure 로 변환. 매 호출마다 `evaluateCondition` 으로 평가 (기존 `core/condition-evaluator.util.ts` 재사용)
- [ ] closure 가 보는 컨텍스트 명시 — `$loop.index` (set 완료), `$var.*` (mutation 반영), 직전 iteration output (`previousOutput` — `loop-executor.ts:48, 70-72`)
- [ ] `loop.handler.ts` 에서 `config.breakCondition` (ConditionGroup) → 어댑터 변환 후 `loopExecutor.execute({ count, maxIterations, breakCondition }, ...)` 로 전달
- [ ] `execution-engine.service.ts:4485-4488` 의 `structuredMeta` 에 `meta.exitReason: 'completed' | 'break' | 'maxIterations'` 신규 필드 추가
- [ ] `meta.maxIterationsReached` 의미 동기화 — "한도 도달" = "break 없이 한도까지 정상 완료" 로 정의 변경 + 회귀 테스트
- [ ] frontend Loop 설정 패널 (`logic-configs.tsx`) 에 `breakCondition` 위젯 노출 확인 — schema UI hint(`condition-builder`) 가 자동 렌더되는지, 아니면 수동 추가 필요한지 점검 후 처리
- [ ] `spec/4-nodes/1-logic/3-loop.md:19, 68, 110, 140-141, 182, 186` 의 P1 미구현 박스/문구 제거 + `meta.exitReason` 명세 추가
- [ ] 단위/통합 테스트 — `breakCondition` true → 조기 종료, false → 정상 완료, 최대 iteration 도달 시 동작

### 3. If/Else, Switch `meta.matchedConditions` / `meta.matchedCaseIndex` (P0) — ✅ 핸들러 완료, spec 정리만 남음

핸들러 구현은 이미 완료되었다. 남은 작업은 spec 표기 정합화 + 표기 정정.

- [x] If/Else 핸들러 `meta.matchedConditions` 누적 — `if-else.handler.ts:74-83`
- [x] Switch 핸들러 `meta.matchedCaseIndex` / `meta.matchedCaseLabel` / `meta.resolvedValue` — `switch.handler.ts:115-127, 130-142`
- [ ] `spec/4-nodes/1-logic/0-common.md:155, 181-182` 의 "(P0 미구현)" 표기 제거 (matchedConditions / matchedCaseIndex / resolvedValue)
- [ ] 본 plan 표기 정정 — `meta.matchedValue` → `meta.resolvedValue` (실제 핸들러 명칭 반영)
- [ ] frontend run-results UI 가 새 meta 키를 안전하게 처리(표시/무시) 하는지 점검 — 필요 시 별도 PR 로 UI 보강

### 4. Variable Declaration / Modification meta 필드 (P1) — ✅ 핸들러 완료 + D5 opt-in 추가

핸들러는 이미 `meta.declared[]`, `meta.skipped[]`, `meta.coercionWarnings[]`, `meta.modifications[]`, `meta.createdVariables[]` 를 출력 중. spec 표기 정리 + opt-in 값 기록만 남음.

- [x] Variable Declaration `meta.declared[]` / `meta.skipped[]` / `meta.coercionWarnings[]` — `variable-declaration.handler.ts:81-89`
- [x] Variable Modification `meta.modifications[]` (variable, operation, applied) / `meta.coercionWarnings[]` / `meta.createdVariables[]` — `variable-modification.handler.ts:77-87, 204-211`
- [ ] `spec/4-nodes/1-logic/0-common.md:183-184` 의 "(P1 미구현)" 표기 제거
- [ ] 본 plan 표기 정정 — `meta.declaredVariables[]` → `meta.declared[]` (실제 핸들러 명칭)
- [ ] **D5 opt-in 추가**:
  - [ ] `variable-modification.schema.ts` 에 `recordValues: z.boolean().default(false)` 필드 추가
  - [ ] `backend/src/nodes/logic/_shared/value-masking.util.ts` (신규) — secret 변수명 매칭(`password`/`token`/`apiKey`) → `'***'`, 큰 객체/배열(size > N) → `'[truncated:size]'`, PII 부분 마스킹 옵션
  - [ ] `variable-modification.handler.ts` 에서 `recordValues=true` 일 때 `meta.modifications[i]` 에 `before` / `after` 추가 (마스킹 적용)
  - [ ] `spec/4-nodes/1-logic/5-variable-modification.md` §5.1 의 `meta.modifications[i]` 타입 정의 갱신 (`before?`, `after?` 추가 + 마스킹 정책 기술)
  - [ ] `frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx` 의 Variable Modification 섹션에 `recordValues` 체크박스 추가
  - [ ] 단위 테스트 — opt-in off (default) / opt-in on / 마스킹 케이스 회귀

### 5. Merge 노드 `timeout` / `partialOnTimeout` (P2) — D3 본 plan 흡수

현 P1 sequential engine 에서는 모든 predecessor 가 동기 resolved 후 Merge 가 실행됨 (`merge.handler.ts:85-95`). barrier 활성화는 비동기 노드 실행 모델 + per-branch 도착 추적이 선결 조건.

- [ ] **선결 조사 (PR-6 첫 단계)**: `execution-engine.service.ts` 의 노드 스케줄링이 동기 → 비동기 전환 가능한지, Merge 만 부분 비동기 처리가 가능한지 점검
- [ ] (조사 결과 가능) `MergeHandler` 에 fan-in barrier 도입 — predecessor 도착 추적 + `timeout` 초과 시 `partialOnTimeout` 분기
- [ ] (조사 결과 가능) `MERGE_TIMEOUT` 에러 코드 상수 + Merge 노드 schema 에 `error` 포트 추가 + 핸들러에서 timeout 시 throw 또는 `output.error` 채움
- [ ] (조사 결과 가능) `partialOnTimeout=true` 시 부분 결과 emit 로직 (도착한 입력만 strategy 적용)
- [ ] (조사 결과 가능) `meta.dormantFields` 제거 또는 활성 표기로 전환 (`meta.timeoutTriggered` / `meta.arrivedBranches` 등 신규 메트릭)
- [ ] (조사 결과 가능) 통합 테스트 — timeout 도달 + partial off (throw) / on (부분 결과), 정상 완료 회귀
- [ ] (조사 결과 가능) `spec/4-nodes/1-logic/11-merge.md:7-9, 19-20, 74-75, 132, 187, 203` 의 dormant 표기 → 활성 표기로 전환
- [ ] **(조사 결과 불가능 시 fallback)** D3 를 별도 plan(`plan/in-progress/merge-p2-async-fanin.md`) 으로 분리, 본 plan 의 §5 는 dormant spec 정합 마감으로 종료

### 6. Switch 노드 follow-up — D4 + D7 (D6 보류)

- [ ] **D4 — `meta.value` deprecated alias 제거**:
  - [ ] `backend/` `frontend/` 전역에서 `meta.value` (Switch 노드 컨텍스트) 또는 `meta\?\.value` 사용처 grep
  - [ ] 사용자 워크플로 fixture 내 `$node["X"].meta.value` 식 expression 검색
  - [ ] 발견된 항목은 `meta.resolvedValue` 로 마이그레이션
  - [ ] `backend/scripts/migrate-switch-meta-value.ts` (신규) — workflow 내 `$node["X"].meta.value` (Switch 노드만) → `$node["X"].meta.resolvedValue`
  - [ ] `switch.handler.ts:110-113, 124` 에서 `value: switchValue` alias 라인 제거 → `{ resolvedValue: switchValue }` 만 남김
  - [ ] `spec/4-nodes/1-logic/2-switch.md:200` 의 "한 릴리스 후 제거" 표기를 "본 PR 에서 제거" 결과로 갱신
  - [ ] 단위 테스트 — 다운스트림이 `resolvedValue` 만 받는지 회귀
- [ ] **D7 — case id reserved word 검증**:
  - [ ] `frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx` 의 SwitchConfig case id 입력 필드에 reserved set `['default', 'out', 'error']` 검사 + i18n 에러 메시지
  - [ ] `switch.schema.ts` 의 `warningRules` 에 reserved word 충돌 룰 추가 (캔버스 배지 표시)
  - [ ] 단위 테스트 (frontend) — reserved word 입력 시 입력 거부 + 경고 표시
  - [ ] `spec/4-nodes/1-logic/2-switch.md:199` 의 "P1 (reserved word)" 항목을 완료 표기로 갱신
- [ ] **D6 — `meta.switchPath` 보류 메모**:
  - [ ] `user_memo/node-specs-improvement/logic/switch.md` §3 #1 에 "보류 결정 (2026-05-11): switchValue 가 raw 표현식으로 config 에 echo 되므로 추가 필드 가치 낮음" 메모 추가

### 7. 검증

- [ ] backend lint / unit / integration / build 통과
- [ ] frontend lint / unit / build 통과
- [ ] `migrate-switch-meta-value.ts` (신규, D4) + `migrate-node-output-refs.ts` (기존) 영향 검증
- [ ] `grep -rn "P0\|P1\|P2\|미구현" spec/4-nodes/1-logic/` → 결정에 부합하는 마커만 남는지 확인
- [ ] `ai-review` 실행 → Critical/Warning 해소

## 권장 PR 분리

의존성 최소 순서:

1. **PR-1 (spec 정합 only)**: §3·§4 의 spec/plan 표기 정정 (코드 무변경, 문서 only)
2. **PR-2 (D1 구현)**: §1 evaluator 통합 + frontend `is_type` 옵션 복원
3. **PR-3 (D2 구현)**: §2 breakCondition 어댑터 + LoopExecutor 통합 + `meta.exitReason` + frontend 위젯
4. **PR-4 (D5 opt-in)**: §4 의 `recordValues` + 마스킹 유틸
5. **PR-5 (D4 alias 제거 + D7 reserved word)**: §6 의 두 항목
6. **PR-6 (D3 Merge P2)**: 엔진 조사 → 결과에 따라 본 plan 활성화 또는 별도 plan 분리. 가장 마지막

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
