# Plan 정합성 검토 — Manual Trigger 파라미터 default 미적용 3지점 방어 수정

검토 모드: `--impl-done`, target = `spec/4-nodes/7-trigger/1-manual-trigger.md`, diff-base = `origin/main`
대상 diff: `execution-engine.service.ts` / `retry-turn.service.ts` (재진입 dispatch input 을 `savedExecution.inputData` 로 대체) · `load-trigger-parameter-schema.ts` (조회를 `category=TRIGGER` → `type=manual_trigger` 로 변경) · `workflows.service.ts`(`validateManualTrigger` 저장 시점 param 스키마 게이트 + `restoreVersion` skip) · `trigger-configs.tsx`(프론트 이름 검증) + 대응 테스트.

## 조사 범위

- `plan/in-progress/` 전체 30개 문서를 대상으로 아래 키워드로 교차 검색: `driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive`/`runNodeDispatchLoop`/`validateManualTrigger`/`loadTriggerParameterSchema`/`resolveTriggerParameters`/`retry-turn.service`/`INVALID_TRIGGER_PARAMETERS`/`manual_trigger`/`output.parameters`/`defaultValue`/`isDirty`/`handleConfigChange`/`restoreVersion`/`WorkflowVersion`.
- 매칭된 문서를 전문 열람: `plan/in-progress/manual-trigger-default-param.md`(본 변경의 owning plan), `plan/in-progress/node-output-redesign/manual-trigger.md`, `plan/in-progress/execution-engine-residual-gaps.md`, `plan/in-progress/exec-intake-followups.md`, `plan/in-progress/spec-sync-canvas-gaps.md`, `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md`.
- `git diff origin/main...HEAD -- spec/` 확인 결과 본 PR 은 spec 파일을 전혀 건드리지 않음(순수 구현 정합화) — target spec 문서 자체는 unchanged.

## 발견사항

이번 diff 와 상충하거나 미해소를 방치하는 CRITICAL/WARNING 급 plan 불일치는 발견되지 않았다.

- **[INFO]** owning plan 의 자체 체크리스트 잔여 항목 — 진행 중(정상 워크플로 상태)
  - target 위치: (해당 없음 — target spec 자체 변경 없음)
  - 관련 plan: `plan/in-progress/manual-trigger-default-param.md` §테스트/§워크플로 체크
  - 상세: 본 plan 은 diff 를 정확히 설명하는 owning plan 이며 근본원인(c: 엔진 재진입 durable input 미사용, b: `category` 조회 fragile)·조치(3지점 방어)·되돌린 항목(a: 프론트 즉시 커밋 — ai-review CRITICAL 로 원복)이 diff 내용과 1:1 정합한다. 다만 다음이 아직 미체크로 남아 있다: (1) `frontend: node-settings-panel config 편집 → store 커밋 + isDirty` 테스트 보강 — (a) 항목이 되돌려지면서 사실상 orphan 성 TODO 가 됐지만 plan 이 명시적으로 미해소로 남겨둠, (2) `TEST WORKFLOW 재수행 (fix 후)`, (3) `consistency-check --impl-done` — 바로 이 턴이 그 항목을 수행 중이다.
  - 제안: (1)은 root cause 와 무관함이 이미 §비고에 문서화돼 있으므로, 필요 시 plan 에 "root cause 아님으로 확인, 별도 트랙 필요 시만 착수"로 명시해 체크박스 의미를 명확히 하면 향후 오독을 줄일 수 있다(선택 사항, 차단 아님). (2)(3)은 이번 세션 진행 중인 정상 단계로 별도 조치 불요.

## 상충·미해소·누락 없음 확인 근거

1. **미해결 결정과의 충돌 없음**: `plan/in-progress/` 전체에서 `manual_trigger`/`defaultValue`/`output.parameters`/`retry-turn`/`validateManualTrigger`/`loadTriggerParameterSchema` 를 언급하는 문서는 `manual-trigger-default-param.md`(owning) 와 `node-output-redesign/manual-trigger.md`(output shape 분석, 별개 관심사) 뿐이다. 후자는 "output 구조가 spec 과 정합한지"만 다루며 config.parameters ↔ output.parameters 직교성 원칙에 변경 없음을 전제 — 이번 diff(입력 해석 경로 버그 수정)와 겹치지 않는다. 다른 어떤 in-progress plan 도 "재진입 시 input 을 `{}` 로 유지해야 한다"거나 "트리거 조회를 category 기준으로 유지해야 한다"는 상반된 결정을 보류 중이지 않다.
2. **선행 plan 미해소 없음**: 이번 diff 가 전제하는 "durable `Execution.inputData` 컬럼 존재"는 `plan/complete/exec-park-durable-resume.md` 등으로 이미 완료돼 `plan/complete/` 로 이동된 상태다(관련 후속 `exec-park-*` 문서 전부 complete). `execution-engine-residual-gaps.md`(G1 철회·G2 defer 확정·G3 완료)는 `errorPolicy=continue` SIGTERM 분기 등 별개 표면을 다루며 본 diff 의 재진입 input 경로와 무관하다. `retry-turn.service.ts` 의 AI multi-turn retry 경로가 의도적으로 `input:{}` 를 유지한 것(diff 주석)에 대응하는 별도 in-progress plan 도 없어 상충 없음.
3. **후속 항목 누락 없음**: `INVALID_TRIGGER_PARAMETERS` 는 신규 에러 코드가 아니라 기존(webhook/실행 경로에 이미 존재)에러 코드를 저장 시점 게이트로 재사용한 것 — `exec-intake-followups.md` ARCH#5 가 언급한 "타 in-progress plan 이 `error-codes.ts` 항목 추가 중이라 충돌 우려"에 해당하지 않는다(신규 등록 없음). 본 PR 은 spec 파일을 변경하지 않으므로 `node-output-redesign/manual-trigger.md` 가 추적하는 spec 라인 인용(`§3`/`0-common.md` 라인 번호)도 stale 해지지 않는다.

## 요약

`plan/in-progress/manual-trigger-default-param.md` 가 이번 diff 의 유일하고 정확한 owning plan 이며, 근본원인 분석·수정 범위·되돌린 결정(프론트 즉시 커밋 원복)이 diff 내용과 정합한다. 다른 in-progress plan(`node-output-redesign/manual-trigger.md`, `execution-engine-residual-gaps.md`, `exec-intake-followups.md`, `spec-sync-canvas-gaps.md` 등) 중 이번 변경과 상충하는 미해결 결정, 미해소 선행 조건, 무효화되는 후속 항목은 발견되지 않았다. 본 PR 은 spec 을 변경하지 않는 순수 구현 정합화라 spec-line 참조 drift 도 발생하지 않는다.

## 위험도
NONE
