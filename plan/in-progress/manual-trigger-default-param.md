---
title: Manual Trigger 파라미터 default 미적용 — 3지점 방어 수정
worktree: manual-trigger-default-param-e0d395
started: 2026-07-09
owner: developer
status: in-progress
spec_area: spec/4-nodes/7-trigger/1-manual-trigger.md
---

## 배경 / 근본 원인

Manual Trigger 에 `required:false` + `defaultValue` 파라미터를 설정해도 `output.parameters` 가 `{}` 로 나와 default 가 안 먹는다. 표현식(`$node[...].output.parameters.region`, `$input.parameters.region`)도 전부 빈값.

근본 원인 (empirically 재현): `loadTriggerParameterSchema` 가 저장된 `config.parameters` 를 검증할 때 **파라미터가 하나라도 구조 위반(빈 이름 슬롯 등)이면 배열 전체를 폐기**(all-or-nothing) → 유효한 param 의 default 까지 소실 → `output.parameters: {}`. 프론트 "Add Parameter" 가 빈 이름 슬롯을 시드하고, `saveCanvas` 는 param 스키마를 검증하지 않아 잘못된 param 이 조용히 영속된다.

spec §6 (line 163) 은 이 구조 위반을 **"handler.validate (저장 시점)"** 에서 잡도록 규정 — 즉 구현이 spec 을 안 지킨 버그. 3지점 방어로 수정 (spec 변경 아님, 구현 정합).

## ⚑ e2e 로 밝힌 최종 근본원인 (핵심)

e2e(save→execute→engine, trigger→transform)로 실측하니 **resolution 만으론 부족**했다:

- **(c) 엔진 재진입 input 소실 [진짜 핵심]** `runNodeDispatchLoop` 의 3개 재진입/redrive 호출부(`driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive`)가 `input: {}` 전달. 주석은 "재기동 후 input 사라짐"이라지만 **`Execution.inputData` 는 durable 컬럼**이라 사라지지 않는다. 그 결과 아직 미완료인 진입 노드(Manual Trigger)가 `input={}` 를 받아 **`output.parameters:{}`** 산출 → `$node["X"].output.parameters` / `$params` 표현식 전부 빈값(turn2 증상). e2e 인프라의 stalled-redelivery 로 trigger-only·2노드 모두 결정적으로 재현. **fix: 3개 호출부 `input: savedExecution.inputData ?? {}`**. 이미 완료된 노드는 skip 되므로 미완료 진입 노드에만 영향.

즉 사용자 증상 = (b) 조회 실패 **또는** (c) 재진입 input 소실. (c) 가 resolution 성공에도 `output.parameters:{}` 를 만드는 pervasive 버그.

## 수정 (consistency-check 후 재조정 — 실제 원인 (a)(b)(c) + hardening 유지)

- [x] **(c) 엔진 재진입 input [진짜 핵심]** `execution-engine.service.ts` 3개 재진입 dispatch `input: {}` → `savedExecution.inputData ?? {}`. 트리거가 durable 입력을 받아 `output.parameters` 정상 산출.
- [x] **(b) 조회 by type [PRIMARY]** `loadTriggerParameterSchema`: `category=TRIGGER` → **`type='manual_trigger'`** 조회. category 누락/불일치 데이터(프론트 is-trigger.ts fallback 이 방어하는 실존 케이스)를 못 찾아 valid 스키마인데 `{}` 나오던 근본 버그 해결.
- [x] **(a) 프론트 영속** `node-settings-panel.tsx handleConfigChange`: 로컬 state 만 → `updateNodeConfig` 로 **store 즉시 커밋 + isDirty**. "Save changes" 안 눌러도 config 편집이 Run 시 영속.
- [x] **② 저장 검증 [hardening]** `workflows.service.ts validateManualTrigger`: malformed param 400 `INVALID_TRIGGER_PARAMETERS`. spec §6.
- [x] **③ 프론트 이름 검증 [hardening]** `trigger-configs.tsx`: 빈/식별자위반/중복 inline 에러 (ko/en).
- [x] **① 되돌림**: resolve 레벨 lenient(partition)는 엔진 `handler.validate` 게이트가 먼저 throw 해 run 경로에서 무의미(cross_spec CRITICAL) → `resolve-trigger-parameters.ts`·`load-...` 원복(strict all-or-nothing 유지).

## 테스트

- [x] backend unit: `load-trigger-parameter-schema.spec.ts` — type 조회 + category 누락 노드 resolve
- [x] backend unit: `workflows.service.spec.ts` — saveCanvas invalid param 이름 400 reject
- [x] frontend: `trigger-configs.test.tsx` — invalid 이름 에러 표시
- [ ] frontend: `node-settings-panel` config 편집 → store 커밋 + isDirty (해당 테스트 있으면 보강)

## 워크플로 체크

- [x] consistency-check --impl-prep (cross_spec CRITICAL → 진단 재조정, 위 참조)
- [x] TEST: lint PASS / unit PASS / build PASS / **e2e PASS (246/246, crash-redrive·stalled·park 무회귀)**
- [ ] /ai-review + fix
- [ ] consistency-check --impl-done (spec 연결 코드 변경)

## ⚠️ consistency-check(cross_spec) CRITICAL — 진단 재검토 필요

`/consistency-check --impl-prep` 의 cross_spec 이 CRITICAL 발견. 실측 재확인 결과:

- 엔진 `executeNode`(execution-engine.service.ts:5242)가 **모든 노드(트리거 포함)** 에 `handler.validate()` 를 호출하고 실패 시 `INVALID_NODE_CONFIG` throw. 트리거도 예외 없음.
- `ManualTriggerHandler.validate` 실측: 빈/부재 params → **valid**(실행 성공→`{}`); malformed params → **invalid**→ `INVALID_NODE_CONFIG`→ **실행 실패(loud)**.
- ∴ **사용자의 "성공적 `output.parameters:{}`" 증상은 malformed param 으로는 불가능**(그 경우 loud 실패). 성공적 `{}` ⟺ config.parameters 가 **빈/부재** at resolve.
- ∴ turn3 의 all-or-nothing 진단은 **사용자 증상과 불일치**. 실제 원인은 (a) 미영속(turn1 persistence gap) 또는 (b) `loadTriggerParameterSchema` 가 매뉴얼 트리거 노드를 못 찾음(현재 `category:TRIGGER`+findOne 로 조회 — type=manual_trigger 아님, 다중 트리거/카테고리 불일치 시 fragile).
- Fix ①(resolve graceful-degrade)은 run 경로에서 handler.validate 게이트에 막혀 **무의미**(CRITICAL). ②③ 는 malformed 방지 hardening 으로는 유효하나 사용자 증상은 못 고침.

**결론: 스코프 재조정 필요.** 사용자에게 보고 + 확인(config.parameters echo/노드 category) 요청. 커밋 보류.

## 비고

- turn1 persistence gap: 노드 설정 패널 `handleConfigChange` 가 store isDirty 미설정 — config 편집이 "Save changes" 없이 미영속. 사용자 실제 원인 후보.
