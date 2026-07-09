# 정식 규약 준수 검토 — spec/5-system/ (impl-done)

## 검토 범위 확인

prompt 에 `spec/5-system/1-auth.md`·`spec/5-system/10-graph-rag.md` 전문이 참고자료로 포함돼 있었으나,
`git diff origin/main...HEAD -- spec/5-system/` 로 재확인한 결과 이번 변경(diff-base `origin/main`)이
실제로 건드린 `spec/5-system/` 파일은 **`spec/5-system/5-expression-language.md` 1개뿐**이며 변경량도
2줄 삽입/1줄 삭제로 작다 (나머지 두 파일은 이번 diff 와 무관한 배경 컨텍스트로 판단해 신규 위반 후보에서
제외). 아래는 그 diff 를 `spec/conventions/**` 및 동일 문서 내부의 기존 확립된 서식 관례와 대조한 결과다.

```diff
-**config 기반 스키마 보강 (enricher)** — ... 4개 노드 타입은 ...
+**config 기반 스키마 보강 (enricher)** — ... 5개 노드 타입은 ...
 | 노드 타입 | 투영 규칙 |
 ...
+| `manual_trigger` | `config.parameters[].name` → `.output.parameters.<name>` (param `type` 로 타입 매핑). `config.parameters` 는 배열 정의라 이름 접근 불가 — 사용자를 name-keyed `output.parameters` 로 유도 (Manual Trigger §4/§5.1) |
```

구현 근거(대상 워크트리, 절대경로로 확인):
`codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts` 의
`enrichManualTriggerOutputSchema` + `codebase/frontend/src/components/editor/expression/use-expression-context.ts`
의 `nodeType === "manual_trigger"` 분기 — 둘 다 diff 상 신규 추가이며 spec 서술과 일치한다.

## 발견사항

- **[INFO] 신규 표 행의 내부 문서 참조가 이 문서의 확립된 링크 관례를 따르지 않음**
  - target 위치: `spec/5-system/5-expression-language.md` §7.2 "config 기반 스키마 보강 (enricher)" 표, `manual_trigger` 행 말미 `(Manual Trigger §4/§5.1)`
  - 위반 규약: 명시적 `spec/conventions/*.md` 항목은 아니며, **동일 문서 내부에서 이미 100% 일관되게 지켜지는 자체 서식 관례**(§4.1 `$env`/`$trigger`/`$thread` 행, §4.5 본문, §8.5 표 등 모두 `[문서명 §N](경로#앵커)` 마크다운 링크 사용)와의 괴리
  - 상세: 같은 파일의 다른 모든 교차참조(예: `[4-execution-engine §6.1.1](./4-execution-engine.md#611-트리거-입력-파라미터-seeding)`, `[12-webhook §5.3](./12-webhook.md#53-민감-헤더-마스킹-ingestion)`)는 예외 없이 하이퍼링크 형태다. 이번에 추가된 `(Manual Trigger §4/§5.1)` 만 plain-text 괄호로 남아 있어 클릭 내비게이션이 끊긴다. 대상 문서(`spec/4-nodes/7-trigger/1-manual-trigger.md`)의 §4/§5.1 자체는 실존하고 인용 내용도 정확하다(§4 실행 로직 5단계 `output.parameters = resolvedParameters`, §5.1 Case 표 `output.parameters` = runtime adapter resolved) — 순수 서식 이슈.
  - 제안: `(Manual Trigger §4/§5.1)` → `([Manual Trigger §4](../4-nodes/7-trigger/1-manual-trigger.md#4-실행-로직)/[§5.1](../4-nodes/7-trigger/1-manual-trigger.md#51-case-manual--schedule-어댑터-port-out))` 형태로 통일 권장. 규약 갱신은 불필요(이미 이 문서 자체가 일관된 관례를 갖고 있으므로 그것을 따르면 됨).

- **[INFO] 신규 행만 표 셀 안에 근거/설계의도 산문이 포함되어 다른 행과 톤이 다름**
  - target 위치: 같은 표, `manual_trigger` 행 전체
  - 위반 규약: 명시적 규약 없음(스타일 제안)
  - 상세: 기존 4개 행(`information_extractor`/`form`/`table`/`transform`)은 모두 `투영 대상 config 경로 → output 경로` 형태의 단문인 반면, 신규 행은 괄호 부연 2개(`param type 매핑`, `이름 접근 불가 이유`)와 문서 인용까지 한 셀에 담아 표가 시각적으로 비대칭해졌다. 내용 자체는 정확하고 유용하지만, 표의 목적(빠른 스캔용 투영 규칙 요약)에는 다소 무겁다.
  - 제안: 부연설명(`config.parameters 는 배열 정의라 이름 접근 불가 — …`)은 표 아래 안전장치 문단(425행, `안전장치: unsafe 키...`) 근처의 별도 문장으로 옮기고, 표 셀 자체는 다른 행과 동일하게 `config.parameters[].name` → `.output.parameters.<name>` 한 줄로 축약하는 안을 고려할 수 있음. 다만 이는 취향 차이 수준이라 필수 수정은 아님.

## 규약 준수 확인 (위반 없음 — 근거 기록)

- **명명 규약**: 신규 노드 타입 키 `manual_trigger` 는 표의 기존 행(`information_extractor`/`form`/`table`/`transform`)과 동일한 snake_case 이며, 코드(`node-output-schema-enrichers.ts`/`use-expression-context.ts`)의 문자열 리터럴 `"manual_trigger"` 및 `spec/4-nodes/7-trigger/1-manual-trigger.md` 전반의 표기와 정확히 일치한다.
- **출력 포맷 규약**: `.output.parameters.<name>` 은 `spec/conventions/node-output.md` Principle 8.2 통일 네이밍 표·Principle 참조 매트릭스(§1.1 행에 이미 `manual_trigger` 포함)와 정합하며, `spec/4-nodes/7-trigger/1-manual-trigger.md` §5.1 이 정의한 `output.parameters: Record<string, unknown>` shape 과도 일치한다. `config`/`output` 직교성(Principle 1.1)도 위반하지 않는다 — 이 투영은 config 값을 output 에 복사하는 것이 아니라, **힌트용 스키마 property 이름**을 config 정의에서 파생시키는 것(실제 값은 여전히 실행 시점에만 채워짐)이라 Principle 1.1 이 금지하는 "리터럴 값의 output 중복"에 해당하지 않는다.
- **파라미터 타입 매핑**: 코드의 `JSON_SCHEMA_IDENTITY_TYPE_MAP`(`string`/`number`/`boolean`/`object`/`array`)이 `TriggerParameterDefinition.type` enum(`spec/4-nodes/7-trigger/1-manual-trigger.md` §6 에러 코드 표에 명시된 동일 enum)과 정확히 일치한다.
- **개수 정합성**: "4개" → "5개" 로 갱신된 숫자가 실제 표 행 수(5행: `information_extractor`/`form`/`table`/`transform`/`manual_trigger`)와 일치한다.
- **금지 항목**: `spec/conventions/node-output.md` 가 금지하는 패턴(`output.output.*` 이중 중첩, `output.view` 판별자, spread 방식 config echo 등) 어느 것도 이번 diff 에 나타나지 않는다.

## 요약

이번 PR 이 `spec/5-system/` 아래 실제로 변경한 문서는 `5-expression-language.md` 1개이며, 변경 내용(§7.2 enricher 표에 `manual_trigger` 행 추가 + 개수 갱신)은 명명·출력 포맷 양면에서 `spec/conventions/node-output.md` 및 `spec/4-nodes/7-trigger/1-manual-trigger.md` 의 기존 확정 규약과 정확히 정합하고, 구현 코드(`node-output-schema-enrichers.ts`/`use-expression-context.ts`)와도 1:1 대응이 확인된다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다. 유일한 지적은 신규 표 행의 문서 내부 교차참조가 이 파일 자신의 100% 일관된 마크다운 링크 관례를 따르지 않는 서식 디테일(INFO)과, 신규 행만 부연설명이 많아 표 톤이 비대칭해진 점(INFO)이다. 둘 다 선택적 다듬기이며 병합을 막을 사유가 아니다.

## 위험도

NONE
