# Logic 노드 잔여 후속 (P0/P1/P2)

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A

## 배경

`spec/4-nodes/1-logic/*` 의 여러 노드 spec이 P0/P1/P2 미구현 마커를 명시하고 있다. 카테고리·영향 범위 기준으로 한 plan에 묶어 한 번의 PR 단위로 처리한다.

## 관련 문서

- `spec/4-nodes/1-logic/0-common.md` §meta 표 (If/Else / Switch / Variable Decl/Mod 의 P0/P1 미구현)
- `spec/4-nodes/1-logic/1-if-else.md` §Operator (P1 `is_type` / `regex` silent fall-through)
- `spec/4-nodes/1-logic/3-loop.md` §1 / §6 / §8 (P1 `breakCondition` 미평가)
- `spec/4-nodes/1-logic/11-merge.md` §1 / §6 (P2 `timeout` / `partialOnTimeout` dormant)
- 사용자 메모 개선안:
  - `user_memo/node-specs-improvement/logic/loop.md` §2 항목 4
  - `user_memo/node-specs-improvement/logic/parallel.md` (Parallel은 별도 plan에서 처리 — `parallel-p2.md`)
  - `user_memo/node-specs-improvement/logic/switch.md` §3 잔여 항목

## 작업 단위

### 1. If/Else operator 정리 (P1)

`is_type` / `regex` 가 schema enum 에는 있으나 `evaluateCondition` 에서 silent `false` fall-through 된다.

- [ ] **결정**: 두 연산자를 schema enum 에서 제거할지, validate 단계 reject 로 막을지, 실제 구현할지 사용자에게 질의
- [ ] 결정에 따라 backend `condition-eval.util.ts` (logic/_shared) 또는 schema 갱신
- [ ] 단위 테스트 — silent false 회귀 잠금
- [ ] frontend If/Else 설정 패널의 operator 드롭다운에서 미지원 옵션 제거 (구현 결정 시 정상 옵션으로 추가)
- [ ] spec `1-if-else.md` §1 표·미구현 박스 갱신

### 2. Loop `breakCondition` 평가 (P1)

`loop-executor.ts` 가 사용자 정의 `ConditionGroup` 을 호출하지 않는다.

- [ ] **결정**: schema 에서 제거 vs. 엔진 구현 — 사용자 가치(사용자가 schema 보고 설정해도 동작 안 함)와 구현 난이도 trade-off 질의
- [ ] 결정 (구현) 시: `LoopExecutor` 에 breakCondition 평가 로직 추가, 매 iteration 종료 후 평가 → true 이면 조기 종료, `meta.exitReason = 'break'` 부여
- [ ] 결정 (제거) 시: schema 에서 필드 삭제, frontend 설정 폼의 break 조건 입력 위젯 제거, 마이그레이션 스크립트로 기존 워크플로의 `config.breakCondition` 비우기
- [ ] spec `3-loop.md` §1 / §6 / §8 / §6 미구현 박스 갱신
- [ ] `meta.maxIterationsReached` 의미가 breakCondition 도입 후 어떻게 바뀌는지 문서 동기화

### 3. If/Else, Switch `meta.matchedConditions` / `meta.matchedCaseIndex` (P0)

기능적 영향은 작지만 spec 의 P0 표기로 남아 있다.

- [ ] If/Else 핸들러에서 평가된 조건 결과를 `meta.matchedConditions` 에 누적 (CONVENTIONS Principle 2 준수: meta는 메트릭만)
- [ ] Switch 핸들러에서 매칭된 case index/value 를 `meta.matchedCaseIndex` / `meta.matchedValue` 에 기록
- [ ] 단위 테스트 + frontend run-results UI 가 새 meta 를 안전히 무시하거나 표시 (UI 변경은 별도 PR로 분리해도 됨)
- [ ] spec `0-common.md` §meta 표 P0 표기 제거

### 4. Variable Declaration / Modification meta 필드 (P1)

- [ ] Variable Declaration 핸들러에 `meta.declaredVariables[]` (선언된 변수 이름·타입) 추가
- [ ] Variable Modification 핸들러에 `meta.modifications[]` (변수 이름·이전/이후 값 요약 — 민감 데이터 마스킹 적용) 추가
- [ ] spec `0-common.md` 및 각 노드 spec(`4-variable-declaration.md`, `5-variable-modification.md`)의 P1 표기 제거

### 5. Merge 노드 `timeout` / `partialOnTimeout` (P2)

현재 schema 에는 있으나 dormant. 실제 활성화는 P2 — 본 plan에서는 정합성만 정리하고 활성화 여부는 사용자 결정에 맡긴다.

- [ ] **결정**: P2 활성화를 본 plan에서 진행할지, 별도 plan으로 분리할지 질의
- [ ] (활성화 결정 시) Merge 핸들러에 barrier 도입 + `MERGE_TIMEOUT` 에러 코드 + 부분 결과 emit 옵션 + 단위/통합 테스트
- [ ] (보류 결정 시) spec 의 dormant 표기를 더 명확히 (사용자가 설정해도 의미 없음 + warn 로그 출처 명시)

### 6. Switch 노드 follow-up (개선안 §3 잔여)

- [ ] `user_memo/node-specs-improvement/logic/switch.md` §3 의 잔여 항목 검토 후 본 plan에 흡수 또는 별도 issue 등록
- [ ] `meta.value` deprecated alias 제거 시점 결정 (한 릴리스 후 제거 예정으로 spec 표기 — 구현/문서 정합화)

### 7. 검증

- [ ] backend lint / unit / integration / build 통과
- [ ] frontend lint / unit / build 통과
- [ ] `migrate-node-output-refs.ts` 에 영향 있는지 확인 — meta 필드 추가는 backward compatible 이지만 schema 변경은 마이그레이션 필요
- [ ] `ai-review` 실행 → Critical/Warning 해소

## 수용 기준

- 1~5 항목의 결정이 PRD/Spec에 반영되고 코드와 일치
- spec `4-nodes/1-logic/*` 의 "P0/P1/P2 미구현" 표기가 모두 제거되거나 활성 표기로 갱신
- 단위/통합 테스트가 신규 동작을 회귀 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: 없음. `prd-spec-sync.md` 와 병렬 진행 가능
- **리스크**:
  - operator 제거/추가는 기존 워크플로 호환성 영향 — migration 필요
  - meta 필드 추가는 메트릭만 기록하면 안전하지만, run-results 관측성 UI 가 새 키를 표시하려면 frontend 도 함께 손봐야 함
