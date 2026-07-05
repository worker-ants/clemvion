# Plan 정합성 검토 결과

## 검토 메타
- 검토 모드: --impl-prep (구현 착수 전)
- Target: `spec/4-nodes/1-logic/` (특히 `2-switch.md` §8.1)
- 근거 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-12
- 비고: 전달된 prompt payload(`_prompts/plan_coherence.md`, 2161줄) 는 `plan/in-progress/` 문서 목록에 **`spec-code-cross-audit-2026-06-10.md` 자체를 포함하지 않았다** (ai-agent-tool-connection-rewrite → cafe24-backlog-residual → ... → competitive-analysis-n8n-flowise 순으로 끊김, spec-code-cross-audit 항목 없음). CONTEXT 가 명시적으로 이 plan 파일의 V-12 를 근거로 지목했으므로, 프롬프트 누락을 보완하기 위해 디스크에서 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 를 직접 Read 하여 검토했다. 이 payload 구성 문제 자체는 orchestrator 쪽에 별도 보고할 가치가 있다(재현 시 다른 target 에서도 근거 plan 이 누락될 수 있음).

## 발견사항

검토 결과, target(코드 변경: `logic-configs.tsx` `SwitchConfig` 에 `required={mode === "value"}` 추가)과 plan V-12 항목 사이에 충돌·누락은 발견되지 않았다.

- V-12 갭 서술: "`2-switch.md` §8.1 은 `ui.requiredWhen` 화이트리스트로 mode=value 시 switchValue asterisk 노출을 구현사실로 기술 vs bespoke `SwitchConfig`(override) 의 switchValue `ExpressionInput` 이 asterisk 미렌더(requiredWhen 은 auto-form 만 소비)."
- plan 의 권장안: "코드 구현(소규모) — asterisk 1개 추가는 저비용이고 required 표시 부재는 입력 누락 UX 결함." (결정 대기였으나 recommend 는 이미 코드 구현 쪽으로 명시)
- 실제 diff: `SwitchConfig` 의 `switchValue` `ExpressionInput` 에 `required={mode === "value"}` 를 추가하고, 근거 주석에 `spec/4-nodes/1-logic/2-switch.md §8.1` 을 직접 인용 — plan 이 제시한 "코드 구현" 옵션을 그대로 채택.
- target spec 문서(`2-switch.md` §1/§8.1)는 이미 "UI asterisk 는 `ui.requiredWhen: {...}` 화이트리스트" 라고만 서술하며, "bespoke override 가 이를 렌더한다" 는 문구를 별도로 추가하지 않는다 — 즉 spec 본문은 코드 구현으로 사실이 되는 것이지, 이번 변경으로 spec 을 앞질러 고쳐 쓴(spec 하향/상향 일방 결정) 흔적이 없다.
- plan 이 남겨둔 "결정 필요" 항목(코드 구현 vs spec 하향 중 택1)에 대해, 이번 target 은 **plan 이 이미 권장한 옵션**을 그대로 실행한 것이라 미해결 결정을 우회하거나 뒤집는 게 아니다. cross-audit 문서의 다른 8건(V-04·V-05·V-09·V-10·V-13·V-14·V-18 등)도 동일하게 "권장안 채택" 패턴으로 이미 종결되어 있어, V-12 도 같은 패턴을 따르는 것으로 판단된다.
- 다른 `plan/in-progress/*` 문서 어디에도 Switch `switchValue`/`requiredWhen`/asterisk 를 언급하는 곳이 없어 후속 항목 무효화·선행 조건 미해소 문제도 없다.

## 요약
Target 코드 변경은 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-12 항목이 이미 권장한 "코드 구현(소규모)" 옵션을 그대로 실행한 것으로, plan 이 열어둔 결정과 충돌하지 않는다. spec 본문도 이번 변경으로 앞질러 수정되지 않아 코드-스펙 정합 방향(코드가 spec 약속을 사실화)과 일치한다. 다만 이번 검토에 전달된 prompt payload 가 근거 plan 파일 자체를 목록에서 누락하고 있었음을 별도로 보고한다(디스크 직접 조회로 보완, 결론에는 영향 없음).

## 위험도
NONE
