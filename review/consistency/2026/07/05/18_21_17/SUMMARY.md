# Consistency SUMMARY — impl-prep spec/5-system/ (18_21_17)

모드: `--impl-prep` — V-14(Re-run 모달 원본 ID 링크 + typed 동적 폼) 구현 착수 직전. 계획: `rerun-modal.tsx` 를 (a) 원본 ID 새 탭 링크, (b) manual_trigger `config.parameters` 스키마 기반 typed 폼(string→text·number→number·boolean→checkbox·object/array→JSON, 스키마 부재 시 원본 키 text fallback)으로 전환. `spec/5-system/13-replay-rerun.md §10.2` verbatim.

## BLOCK: NO

Critical 0. cross_spec WARNING 1(선존·다른 UI 요소) + INFO. spec 변경 불요(§10.2 이미 명시).

## Checker 결과

| Checker | 위험도 | 핵심 |
|---|---|---|
| cross_spec | LOW | (명시 컨텍스트로 정확 검토) **WARNING**: §10.2 모달 ID=new-tab vs §3.7 chain badge=same-tab — **다른 UI 요소**·선존 불일치, §10.2 대로 new-tab 진행. 검증: TriggerParameterDefinition 스키마·backend `coerceToType`/`resolveTriggerParameters` **native-typed 값 수용**·`inputData.parameters[name] ?? defaultValue`(RR-PL-02)·inputOverride API·getNodes config.parameters 노출 모두 정합 |
| rationale | NONE | (재실행 — 초기 payload mismatch) §10.2 verbatim 구현, RR-PL-01~07 어느 기각 대안과도 무충돌. INFO: fallback 문서화 여지 |
| plan_coherence | NONE | V-14=plan 옵션(code-impl) 행사·인접 plan 무충돌 |
| naming | NONE | (초기 payload mismatch로 1-auth 검토) V-14 는 신규 요구ID/엔티티/endpoint/이벤트/env 도입 없음(로컬 타입·UI 위젯만) → 본질적 NONE |
| convention | NONE | (초기 payload mismatch로 1-auth 검토) V-14 는 신규 규약·에러코드·네이밍 없음 → 본질적 NONE |

## 주의: impl-prep payload 오배선

`--impl-prep spec/5-system/`(대형 영역, diff 없는 pre-impl)에서 orchestrator 가 rationale/naming/convention 프롬프트에 무관 파일(1-auth·10-graph-rag)을 실어 3개 checker 가 오배선 검토됨. 실질 게이트인 **cross_spec(명시 컨텍스트)·plan_coherence(plan 직독)·rationale(재실행)** 로 판정. naming/convention 은 V-14 성격상(신규 식별자·규약 0) 본질적 NONE.

## 구현 방침

- 원본 ID → `/workflows/:wid/executions/:id` 새 탭 `<a target=_blank rel=noopener>`.
- 입력 폼 → manual_trigger `config.parameters` 스키마 기반 typed 필드. 부재 시 원본 키 text fallback(데이터 은닉 회피).
- 값 default = `originalParameters[name]`, 편집 시 타입 coerce(number/boolean native·object/array JSON). backend 가 native-typed 수용(cross_spec).
