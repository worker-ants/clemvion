# Consistency SUMMARY — impl-prep spec/4-nodes/1-logic/ (19_55_49)

모드: `--impl-prep` — V-12(Switch switchValue asterisk) 구현 착수 직전. 계획: `SwitchConfig`(`logic-configs.tsx`) switchValue `ExpressionInput` 에 `required={mode === "value"}` 1줄 추가 → `spec/4-nodes/1-logic/2-switch.md §8.1` 의 `ui.requiredWhen: { field: 'mode', equals: ['value'] }` asterisk 를 override-track 에서 재현. spec 변경 불요.

## BLOCK: NO

V-12 관련 Critical/Warning 0. convention WARNING 1건은 무관한 선존 drift(10-parallel.md).

## Checker 결과

| Checker | 위험도 | 핵심 |
|---|---|---|
| cross_spec | NONE | `required={mode==="value"}` 가 §8.1 `requiredWhen` 정책을 override-track 에 정확 미러(2-track 렌더 SoT `1-node-common §2.6`). `ExpressionInput.required`=순수 시각 asterisk, 런타임 validation(`NodeHandler.validate`)과 무충돌. 백엔드 lock test `logic-ui-required.spec.ts` 무영향 |
| rationale | NONE | `mode==="value"` = backend `switch.schema.ts` `equals:['value']` whitelist 일치. 기각된 blacklist(`notEquals:'expression'`) 재도입 아님 |
| plan_coherence | NONE | V-12 코드-구현 옵션 정확 이행·인접 plan 무충돌 |
| naming | NONE | 신규 식별자 0 — 기존 `required` prop·`requiredWhen` 규약 재사용 |
| convention | (무관 WARNING) | V-12 무관. 선존 drift: `10-parallel.md` cancel-others-on-fail 범위가 "HTTP만"으로 stale(실제 AI 3종도 구현, SoT `node-cancellation.md §6`). 별도 후속 |

## 구현 방침

- `logic-configs.tsx` SwitchConfig switchValue 에 `required={mode === "value"}` 추가(스펙 주석 동반).
- 신규 unit `switch-config.test.tsx`: mode=value→asterisk·기본값(mode 미지정)→asterisk·mode=expression→없음.
- 후속(무관): 10-parallel.md cancel-others-on-fail stale 정정(별도 planner 트랙).
