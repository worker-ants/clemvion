# Rationale 연속성 검토 — V-14 rerun-modal typed form (impl-prep, 재검토)

> 직전 세션의 `_prompts/rationale_continuity.md` payload 는 `spec/5-system/1-auth.md` · `spec/5-system/10-graph-rag.md` 만 담아 CONTEXT(V-14 rerun modal typed form)와 mismatch 였다. 본 라운드는 orchestrator payload 를 무시하고 rerun modal 의 실제 SoT `spec/5-system/13-replay-rerun.md` 를 직접 읽어 재검토했다.

## 대상

- target(계획된 변경, 아직 diff 없음): `codebase/frontend/src/components/executions/rerun-modal.tsx`
  - (a) 원본 실행 ID → `/workflows/:workflowId/executions/:id` 새 탭 링크
  - (b) 입력 폼을 워크플로 `manual_trigger` 노드 `config.parameters` 스키마(`Array<{name,type,required?,defaultValue?,description?}>`) 기반 typed 동적 폼으로 전환 (string→text, number→number, boolean→checkbox, object/array→JSON). manual_trigger 스키마 부재 시 기존처럼 originalParameters 키를 text 로 fallback
- SoT: `spec/5-system/13-replay-rerun.md` §10.2 + `## Rationale` (RR-PL-01~07), 보조로 `spec/5-system/4-execution-engine.md §6.1.1`(트리거 입력 파라미터 seeding), `spec/4-nodes/7-trigger/1-manual-trigger.md`(§1 config.parameters 스키마), `spec/4-nodes/7-trigger/0-common.md`(TriggerParameterDefinition)

## 현재 구현 상태 (착수 전 baseline 확인)

`rerun-modal.tsx` 를 직접 읽은 결과, 현재 코드는:
- 원본 실행 ID 를 `<span className="font-mono text-xs">{original.id}</span>` 로 plain text 렌더 — 링크 없음
- 입력 폼은 `extractParameters(original.inputData)` 로 얻은 원본 `inputData.parameters` 객체의 **key 목록만**으로 `<Input type="text">` 를 반복 렌더 (`paramKeys.map(...)`) — 워크플로의 `manual_trigger` 노드 `config.parameters` 스키마(`type`/`required`/`defaultValue`/`description`)는 전혀 조회·참조하지 않음 (`workflowNodes` 쿼리는 이미 존재하지만 dry-run 카운트용으로만 쓰임)

즉 계획된 변경은 신규 정책 도입이 아니라, **spec §10.2 가 이미 명시해 둔 두 항목(원본 링크, 스키마 기반 typed 폼)을 뒤늦게 구현으로 맞추는 작업**이다.

## §10.2 원문 대조

`spec/5-system/13-replay-rerun.md` §10.2 "필드 동작" 표:

| 요소 | 기본값 | 동작 |
| --- | --- | --- |
| 원본 실행 헤더 | — | 원본 ID, 시작 시각, 최종 상태 표시. **ID 클릭 시 새 탭으로 원본 상세 페이지** |
| 입력 데이터 폼 | 원본의 `inputData.parameters` | **Manual Trigger parameters 스키마 기반 동적 폼**. 필드 라벨/타입은 워크플로의 manual_trigger 노드 config 에서 도출 (Spec 실행 엔진 §6.1.1) |

계획 (a)/(b) 는 이 두 문장을 그대로 구현한다.

`manual-trigger.md §1` 의 `TriggerParameterDefinition` type enum(`string/number/boolean/object/array`, 5종)과 계획된 위젯 매핑(text/number/checkbox/JSON)이 1:1 대응 — object/array 를 JSON 편집기로 묶는 것은 스펙이 그 두 타입의 세부 위젯을 규정하지 않으므로(§10.2 는 "필드 라벨/타입 도출"까지만 명시) 충돌이 아니다.

## 검토 결과

### 1. 기각된 대안의 재도입 — 없음

Rationale 의 기각 대안(A1/A4, B1/B3, C2/C3, D2, G2)은 모두 §5~§7 정책 레벨(안전장치 강도, 입력모드 자체, 부분 실행, multi-turn 세션, AI 트리거 권한)에 관한 것이다. 입력 폼의 **렌더링 방식**(text-only vs 스키마 typed) 은 어느 Rationale 항목에서도 대안으로 다뤄지거나 기각된 적이 없다. RR-PL-02(B2 채택)의 Rationale 은 "원본 미리보기 + 편집 가능" 모드를 택한 이유(디버그·재현 use-case 우선)를 다룰 뿐, 그 편집 UI가 스키마 기반 typed 여야 하는지 여부는 침묵 — §10.2 본문이 이미 "Manual Trigger parameters 스키마 기반 동적 폼"이라고 결정해 뒀다. 따라서 typed 폼 전환은 기각된 대안의 재도입이 아니라 **본문에 이미 확정된 정책의 뒤늦은 이행**이다.

### 2. 합의된 원칙 위반 — 없음

- §10.2 "원본 실행 헤더" 행과 "입력 데이터 폼" 행 문구를 계획이 정확히 이행한다 (위 대조 참고).
- RR-PL-06(권한), RR-PL-01(dry-run 안전장치) 등 폼 렌더링과 직교하는 다른 정책에는 영향이 없다 — 계획은 `useOriginalInput`/`dryRun`/제출 로직을 변경하지 않는다.
- `execution-engine §6.1.1` 의 `resolveTriggerParameters` 계약(서버측 `config.parameters` 검증→default→coerce)과 클라이언트측 typed 폼이 **같은 스키마 소스**(`TriggerParameterDefinition[]`)를 참조하게 되어, 서버·클라이언트 간 invariant 가 오히려 강화된다(현재는 클라이언트가 스키마를 무시해 서버 검증과 UI 표현이 분리되어 있었음).

### 3. 결정의 무근거 번복 — 없음

이 변경은 과거 결정을 뒤집는 것이 아니라, 이미 확정된 §10.2 문구를 미처 구현하지 못했던 갭을 메우는 것이다. 새 Rationale 항목 추가가 필요한 "번복"이 아니다 — 기존 RR-PL-02 Rationale 이 이미 "원본 미리보기+편집" 원칙을 정당화했고, typed 폼은 그 원칙의 구체화일 뿐 신규 정책 결정이 아니다.

### 4. 암묵적 가정 충돌 — 없음 (fallback 명세만 INFO)

§10.2 는 "스키마 부재/조회 실패 시 fallback" 케이스를 문장으로 규정하지 않는다. 계획의 "manual_trigger 스키마 부재 시 기존처럼 originalParameters 키를 text 로 fallback" 은 §10.2 문언과 상충하지 않고, 현재 구현(스키마를 항상 무시)의 자연스러운 후퇴 경로이자 안전한 하위호환이다. 다만 이 동작이 spec 본문에 아직 문장으로 없으므로, 구현 완료 후 §10.2 표에 한 줄 보강(예: "manual_trigger 스키마 조회 실패/부재 시 원본 `inputData.parameters` 키 기반 text 폼으로 축퇴")을 권장한다 — 새 결정이 아니라 이미 구현이 채택할 동작의 문서화 보완이므로 INFO 등급.

## 발견사항

### 발견사항

- **[INFO]** 스키마 부재 시 fallback 동작이 spec 본문에 문장으로 없음
  - target 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` (계획 중인 fallback 분기 — manual_trigger 노드/스키마를 찾지 못했을 때)
  - 과거 결정 출처: `spec/5-system/13-replay-rerun.md` §10.2 필드 동작 표 "입력 데이터 폼" 행 (스키마 기반 동적 폼만 명시, fallback 케이스 미기재)
  - 상세: §10.2 는 "Manual Trigger parameters 스키마 기반 동적 폼"만 명시하고 스키마 부재/워크플로 노드 조회 실패 시 정책을 언급하지 않는다. 계획된 fallback(원본 파라미터 키 text 폼)은 현재 구현과 방향이 같아 충돌은 아니지만, spec 텍스트에 근거가 없어 향후 리뷰(예: consistency-check 재실행)에서 "spec 미기재 동작"으로 재차 플래그될 수 있다.
  - 제안: 구현 완료 후(impl-done 단계 또는 후속 project-planner 위임) §10.2 표에 fallback 관련 한 줄 각주를 추가. 이번 impl-prep 단계에서 차단 사유는 아님 — plan 문서에 "fallback 근거: 현재 §10.2 미기재, 후속 spec 보강 권장"만 남겨도 충분.

## 요약

계획된 두 변경(원본 실행 ID 새 탭 링크, `manual_trigger` `config.parameters` 스키마 기반 typed 동적 폼)은 `spec/5-system/13-replay-rerun.md` §10.2 가 이미 명시적으로 요구해온 문구("ID 클릭 시 새 탭으로 원본 상세 페이지", "Manual Trigger parameters 스키마 기반 동적 폼")를 그대로 구현하는 것이며, `## Rationale` 의 어떤 기각된 대안(A1/A4, B1/B3, C2/C3, D2, G2)도 재도입하지 않고 합의된 정책(RR-PL-01~07)과 충돌하지 않는다. 현재 baseline 구현(원본 ID plain text, 스키마를 무시한 key-only text 폼)이 오히려 §10.2 와 어긋나 있던 상태였고, 이번 작업은 그 구현 갭을 spec 에 맞춰 메우는 것이다. 새 Rationale 작성이 필요한 결정 번복은 없으며, 유일한 보완 여지는 스키마 부재 시 fallback 동작이 spec 문언에 아직 명시되어 있지 않다는 INFO 수준 사안뿐이다. impl-prep 단계에서 차단할 사유 없음.

## 위험도

NONE
