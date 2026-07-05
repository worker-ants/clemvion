# Rationale 연속성 검토 — V-14 rerun-modal typed form (impl-done)

## 대상

- target(구현 완료, `git diff origin/main...HEAD`):
  - `codebase/frontend/src/components/executions/rerun-modal.tsx` — 원본 실행 ID를 새 탭 링크로, 입력 폼을 `manual_trigger` 노드 `config.parameters` 스키마 기반 typed 동적 폼(string→text, number→number, boolean→checkbox, object/array→JSON stringify/parse)으로 전환. 스키마 부재 시 원본 `inputData.parameters` 키를 text 필드로 fallback.
  - `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx` — 위 두 동작 + boolean native 값 전송 회귀 테스트 3건 추가.
- SoT: `spec/5-system/13-replay-rerun.md §10.2` + `## Rationale`(RR-PL-01~07), 보조: `spec/5-system/4-execution-engine.md §6.1.1`(resolveTriggerParameters), `spec/4-nodes/7-trigger/0-common.md §1`(TriggerParameterDefinition), `spec/4-nodes/7-trigger/1-manual-trigger.md`.
- 선행 이력: 같은 세션 18:21:17 impl-prep consistency-check(같은 계획 사전 승인, BLOCK: NO, rationale 위험도 NONE). 본 라운드는 실제 구현 diff 기준 독립 재검증.

## §10.2 대조 (원문 vs 구현)

| §10.2 필드 동작 문구 | 구현 |
| --- | --- |
| "원본 ID 클릭 시 새 탭으로 원본 상세 페이지" | `<a href="/workflows/:workflowId/executions/:id" target="_blank" rel="noopener noreferrer">` — 일치 |
| "Manual Trigger parameters 스키마 기반 동적 폼. 필드 라벨/타입은 워크플로의 manual_trigger 노드 config 에서 도출" | `workflowNodes.find(type === "manual_trigger").config.parameters` 를 `TriggerParameterDefinition[]` 로 읽어 `RerunField[]`(name/type/description) 도출, 타입별 위젯 분기 — 일치 |

두 항목 모두 spec 본문이 **이미 확정한 문구**를 그대로 구현한 것이며, 이번 구현으로 신규 정책 결정이 도입된 것은 아니다.

## 검토 관점별 분석

### 1. 기각된 대안의 재도입

Rationale 의 명시적 기각 대안은 A1/A4(안전장치 강도), B1/B3(입력모드 자체), C2/C3(부분 재실행), D2(multi-turn 자동재사용), G2(AI 트리거 권한) 6개 — 모두 §5~§7 **정책 레벨**에 관한 것이다. 이번 diff는:
- 입력 편집 가능 여부(B2 채택 상태) 를 바꾸지 않음 — `useOriginalInput` 토글, `paramValues` 편집 로직 유지
- dry-run 토글·판정 로직(RR-PL-01) 불변
- 권한(RR-PL-06)·chain(RR-PL-05)·multi-turn(RR-PL-04)·AI 비트리거(RR-PL-07) 무관

폼 **렌더링 방식**(스키마 typed vs key-only text) 은 Rationale 항목 어디에서도 "기각된 대안"으로 다뤄진 적이 없다 — §10.2 본문이 처음부터 typed 폼을 요구했고, 이번 구현은 그 요구를 뒤늦게 이행한 것. 재도입 사례 없음.

### 2. 합의된 원칙 위반

- RR-PL-02 "원본 미리보기 + 사용자 편집" 원칙: `paramValues` 초기값이 여전히 `originalParameters`(원본 `inputData.parameters`)로 세팅되고(`useState(originalParameters)`, 모달 open 시 리셋), 스키마 `defaultValue` 필드로 override 되지 않는다 — "원본 미리보기" 원칙과 정합. `defaultValue` 는 서버 `resolveTriggerParameters`(§6.1.1 3단계, "누락 필드에 대해서만" 적용)가 담당하는 영역이라 클라이언트가 이를 무시하는 것이 오히려 올바른 책임 분리.
- RR-PL-01 dry-run 안전장치: `externalCall`/`dryRunDisabled` 로직 변경 없음.
- 5필드 invariant(`spec/conventions/node-output.md` Principle 1.1, `config`=schema echo vs `output`=값, 0-common.md §3 인용): 코드가 `manualNode.config.parameters` 를 스키마로, `originalParameters`(= 원본 실행의 `inputData.parameters`, 즉 트리거 `output`) 를 값으로 정확히 구분해서 사용 — config/output 직교 invariant 위반 없음.
- 원칙 위반 없음.

### 3. 결정의 무근거 번복

이번 diff 는 과거 결정을 뒤집지 않는다. §10.2 문구는 이미 typed 폼과 new-tab 링크를 명시하고 있었고, 이전 구현(plain text ID, key-only text 폼)이 그 문구에 미달한 상태였다. 이번 변경은 "번복"이 아니라 **spec 대비 구현 갭 해소**이므로 새 Rationale 항목 작성 의무는 발생하지 않는다.

### 4. 암묵적 가정 충돌

- 스키마 부재/조회 실패 시 fallback(원본 파라미터 키를 text 로) 은 §10.2 에 문장으로 명시돼 있지 않으나, "데이터 은닉 회피"(값이 있는데 스키마가 없다고 필드를 감추지 않음) 방향의 안전한 하위호환이며 기존(pre-diff) 동작과 같은 방향 — invariant 충돌 없음. 이 점은 impl-prep 라운드(18:21:17)에서 이미 INFO 로 지적됐고 이번 구현도 그 계획 그대로 구현됐다. 재차 INFO 로 기록(아래).
- `coerceInput`(object/array → JSON.parse, 실패 시 raw string 유지)은 `resolveTriggerParameters` 의 `coerceToType` 이 "native-typed 값을 그대로 수용"한다는 전제에 의존한다 — 이 전제는 이전 impl-prep 라운드의 cross_spec 검토("검증: TriggerParameterDefinition 스키마·backend `coerceToType`/`resolveTriggerParameters` **native-typed 값 수용**...모두 정합")로 이미 확인됐다. Rationale 관점에서는 이 위임이 §6.1.1 의 "1.타입 강제 변환 2.필수값 검증 3.기본값 적용" 3단계 계약과 어긋나지 않는다 — 클라이언트가 최선 노력으로 타입을 맞추고 서버가 최종 검증한다는 책임 분리와 부합.
- 새 테스트(`boolean 필드 토글 후 inputOverride 로 native boolean 을 전송한다`)가 실제로 `{ inputOverride: { flag: true } }` (문자열 "true" 아닌 boolean) 전송을 검증 — 이는 §6.1.1 의 "타입 강제 변환"이 서버 책임이라는 가정과, 클라이언트가 이미 correct-typed 값을 보낼 수 있으면 보내는 것이 맞다는 원칙 둘 다와 합치.

## 발견사항

- **[INFO]** 스키마 부재 시 fallback 동작이 spec 본문에 문장으로 아직 없음
  - target 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` `fields` useMemo (manual_trigger 스키마 미발견 시 `originalParameters` 키 기반 text fallback 분기)
  - 과거 결정 출처: `spec/5-system/13-replay-rerun.md §10.2` "입력 데이터 폼" 행 — "Manual Trigger parameters 스키마 기반 동적 폼"만 명시, 스키마 부재/노드 미로딩 시 fallback 정책은 문장으로 없음.
  - 상세: 충돌은 아니다(값 은닉을 피하는 안전한 방향이며 기존 동작과 같은 방향). 다만 §10.2 표에 문장으로 없는 채로 코드에만 존재하는 분기라, 차후 별도 세션의 consistency-check 가 "spec 미기재 동작"으로 반복 플래그할 여지가 있다 — impl-prep 라운드에서도 동일하게 지적된 사안으로, 이번 impl-done 시점까지 spec 갱신은 이뤄지지 않았다.
  - 제안: 차단 사유 아님. 후속 `project-planner` 턴에서 §10.2 "입력 데이터 폼" 행에 한 줄 각주 추가 권장 — 예: "manual_trigger 노드/스키마를 찾지 못하면 원본 `inputData.parameters` 키 기반 text 폼으로 축퇴". 이 문서화가 이번 PR 의 병합을 막을 필요는 없다.

## 요약

구현된 두 변경(원본 실행 ID 새 탭 링크, `manual_trigger` `config.parameters` 스키마 기반 typed 동적 폼)은 `spec/5-system/13-replay-rerun.md §10.2` 가 이미 명시해 둔 문구를 그대로 구현한 것으로, `## Rationale` 의 기각된 대안(A1/A4, B1/B3, C2/C3, D2, G2) 어느 것도 재도입하지 않았고, RR-PL-01~07 정책 및 5필드(config/output 직교) invariant 와 충돌하지 않는다. `paramValues` 초기값이 여전히 원본 실행 입력(`originalParameters`)을 기준으로 하고 스키마 `defaultValue` 로 덮어쓰지 않는 점은 RR-PL-02 "원본 미리보기" 원칙 및 §6.1.1 의 서버측 defaultValue 적용 책임 분리와 정합하다. 유일한 잔여 사안은 스키마 부재 시 fallback 동작이 spec 문언에 아직 없다는 INFO 수준 문서화 갭이며, impl-prep 단계에서 이미 동일하게 식별돼 차단 사유가 아니라고 판정된 바 있고 이번 구현 결과에도 그 판단이 유효하다. 새 Rationale 작성이 필요한 결정 번복 없음, 합의 원칙 위반 없음.

## 위험도

NONE
