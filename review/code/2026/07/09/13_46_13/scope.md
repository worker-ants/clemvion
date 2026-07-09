# 변경 범위(Scope) Review

대상: `plan/in-progress/manual-trigger-default-param.md` — Manual Trigger `defaultValue` 파라미터가 실행에서 무시되던 버그 수정. `git diff origin/main...HEAD` 35개 파일(1858 insertions / 43 deletions) 전수 확인. 본 리뷰는 이전 라운드(`review/code/2026/07/09/11_08_21/`)에서 발견된 CRITICAL(프론트 `node-settings-panel.tsx` 즉시 store 커밋이 spec ED-SP-05 위반) fix 이후의 **최종 diff**를 대상으로 한다.

## 발견사항

- **[INFO]** 이전 라운드 CRITICAL(spec ED-SP-05/`0-canvas.md §8 R-3` 위반) 관련 변경은 완전히 원복되어 현재 diff에 남아 있지 않음 — 확인됨(범위 위반 아님, 참고용)
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx`, `codebase/frontend/src/components/editor/settings-panel/__tests__/node-settings-panel-config-commit.test.tsx`
  - 상세: `git diff origin/main...HEAD --stat` 결과(35개 파일) 어디에도 `node-settings-panel.tsx`/`node-settings-panel-config-commit.test.tsx` 가 없다 — RESOLUTION.md 가 기록한 "되돌림"(로컬 state 동작 복원 + 테스트 삭제)이 net diff 기준으로 완전히 반영돼, 즉시 커밋 로직도 그 부작용(undo 우회, keystroke 마다 전역 `nodes` 재계산)도 최종 범위에서 사라졌다. 이번 fix 의 범위는 프론트 인라인 이름 검증(`trigger-configs.tsx`)만 남는다.
  - 조치 불요.

- **[INFO]** `workflows.service.ts` 에 이번 작업과 무관한 타입 단언(cast) 제거가 섞여 있음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:293` — `settings: { ...dto.settings } as Record<string, unknown>,` → `settings: { ...dto.settings },`
  - 상세: 커밋 `06681073b`(fix(manual-trigger): resolve defaultValue params end-to-end)에 포함됐으나, 커밋 메시지·plan 체크리스트(`plan/in-progress/manual-trigger-default-param.md`) 어디에도 이 변경이 언급되지 않는다. Manual Trigger `defaultValue` 버그·저장 시점 파라미터 스키마 검증(②)과 무관한 별도의 타입-레벨 정리로, 동작 차이는 없다(런타임 영향 없는 순수 타입 어노테이션 제거). 같은 파일을 hardening(②)을 위해 어차피 열게 되면서 딸려 들어온 전형적 drive-by cleanup. 이전 라운드 scope 리뷰(INFO)에서도 동일하게 지적됐고 RESOLUTION.md 에는 이 항목에 대한 명시적 조치 기록이 없어(수용/보류 어느 쪽도 명시 안 됨) 그대로 남아 있다.
  - 제안: 위험도는 없으나 diff 최소성 원칙상 되돌리거나, 남긴다면 커밋 메시지/plan 에 "부수적 타입 정리 1건" 으로 명시 권장. 머지 차단 사유는 아님.

- **[INFO]** `schedule-runner.service.spec.ts` 의 순수 포맷팅(재개행) diff — 무관한 파일이지만 커밋 메시지에 명시적으로 사유가 기재됨
  - 위치: `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts:321` 부근 (`resolveOptOutEmailChannels` assertion 재개행)
  - 상세: 로직·기대값 변경 없이 개행 스타일만 바뀐 diff다. `schedule-runner` 모듈은 이번 plan 의 수정 대상(엔진 재진입 input, 트리거 조회 방식, 저장 검증, 프론트 인라인 검증)과 직접 관련이 없다. 다만 커밋 메시지(`06681073b`)에 "Also fixes a pre-existing prettier error in schedule-runner.service.spec.ts surfaced by lint." 라고 명시적으로 사유가 기록돼 있고, RESOLUTION.md W7 도 "사전 존재 prettier 에러라 lint 통과에 필요(이번 작업이 처음 실행한 lint 가 표면화)"로 처분을 남겼다 — 즉 무단 드라이브바이가 아니라 CI lint 게이트 통과를 위해 불가피하게 포함되고 그 사실이 투명하게 문서화된 케이스다.
  - 제안: 조치 불요. 이상적으로는 별도 formatting-only 커밋으로 분리하는 편이 diff noise 를 더 줄이지만, 사유가 이미 커밋 메시지·RESOLUTION.md 양쪽에 명시돼 있어 추적성에는 문제 없다.

- **[INFO]** hardening 2건(② 저장 시점 검증, ③ 프론트 인라인 이름 검증)이 plan 에 사전 계획된 항목과 1:1 대응 — over-engineering 아님
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (`validateManualTrigger` + `skipParamSchemaValidation`), `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx` (`PARAM_NAME_RE`, `nameError`)
  - 상세: 두 항목 모두 `plan/in-progress/manual-trigger-default-param.md` 체크리스트에 "② 저장 검증 [hardening]"/"③ 프론트 이름 검증 [hardening]"으로 사전 명시돼 있고, spec `4-nodes/7-trigger/1-manual-trigger.md §6`(handler.validate 저장 시점 검증 규정)을 실제로 이행하는 것이라 신규 기능 확장이 아니라 spec 이 이미 약속했던 동작의 뒤늦은 구현이다. `restoreVersion` 에 대한 `skipParamSchemaValidation` 예외도 동일 함수의 부작용 완화용으로 범위 안에 있다.
  - 조치 불요(참고용).

- **[INFO]** `review/code/2026/07/09/11_08_21/**`, `review/consistency/2026/07/09/11_39_56/**` — 신규 커밋된 리뷰 산출물, scope 위반 아님
  - 위치: 위 두 디렉터리 하위 17개 파일(RESOLUTION.md/SUMMARY.md/각 관점별 .md/meta.json/_retry_state.json 등)
  - 상세: CLAUDE.md 정보 저장 규약상 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`", "일관성 검토 산출물 → `review/consistency/...`" 로 정해진 정규 워크플로 산출물이며, developer SKILL 의 구현 완료 후 `/ai-review` + fix + `/consistency-check --impl-done` 강제 단계가 남긴 정상 결과물이다. 표본 확인(scope.md/architecture.md/requirement.md/plan_coherence.md/rationale_continuity.md 등) 결과 모두 이번 manual-trigger 작업 자체를 다루고 있어 무관한 내용이 섞여 있지 않다.
  - 조치 불요.

- **[INFO]** `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` — 코드 스코프 밖 후속 작업이 별도 plan 으로 올바르게 분리됨
  - 위치: 신규 plan 파일 전체
  - 상세: 저장 시점 `INVALID_TRIGGER_PARAMETERS` 재사용에 대한 spec §6/`data-flow` 문서 갱신을 `project-planner` 에 위임하는 후속 plan이다. 이번 developer 작업 범위(코드 정합화)에 spec 편집을 섞지 않고 별도 문서로 분리한 것은 CLAUDE.md "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 규약을 정확히 따른 것이며, `codebase/` 변경은 전혀 포함하지 않는다.
  - 조치 불요.

- **[INFO]** 핵심 3지점 수정((c) 엔진 재진입 durable input, (b) type 기반 조회, 테스트/i18n/CHANGELOG)은 plan 체크리스트와 파일 단위로 정확히 일치
  - 위치: `execution-engine.service.ts`(`reentryWorkflowInput` 헬퍼로 3개 호출부 통일 — round1 maintainability WARNING 대응), `retry-turn.service.ts`(주석만, 로직 불변 — 의도적 제외 문서화), `load-trigger-parameter-schema.ts`/`.spec.ts`, `workflows.service.spec.ts`, `manual-trigger-default-param.e2e-spec.ts`, `trigger-configs.test.tsx`, `nodeConfigs.ts`(en/ko), `CHANGELOG.md`
  - 상세: 각 파일이 plan 의 근본원인 (a)(b)(c) + hardening ②③ 중 정확히 하나에 대응하며, 관련 없는 리팩토링·주석 정리·임포트 정리는 발견되지 않았다. 이전 라운드에서 3개 재진입 호출부에 언어가 갈리던(한국어 1건/영어 2건) 중복 주석은 최종 diff 에서 `reentryWorkflowInput` 단일 JSDoc(한국어) + 짧은 참조 주석 3곳으로 통합돼 언어 불일치도 해소됐다.
  - 조치 불요.

## 점검 관점별 요약

1. **의도 이상의 변경**: 타입 단언 제거 1건(INFO) 외 없음. 프론트 즉시 커밋(이전 CRITICAL)은 완전 원복 확인.
2. **불필요한 리팩토링**: `reentryWorkflowInput` 헬퍼 추출은 기능 변경과 직결(중복 로직 통합)이라 불필요한 리팩토링으로 보지 않음.
3. **기능 확장**: hardening ②③ 모두 spec §6 이 이미 규정한 동작의 구현이라 over-engineering 아님.
4. **무관한 수정**: `workflows.service.ts` 타입 단언 제거, `schedule-runner.service.spec.ts` 포맷팅 2건 — 둘 다 위험도 없고 후자는 커밋 메시지에 사유가 명시돼 투명함.
5. **포맷팅 변경**: `schedule-runner.service.spec.ts` 1건만 순수 포맷팅, 실질 변경과 섞이지 않고 파일 전체가 포맷팅 diff 뿐이라 리뷰 부담도 낮음.
6. **주석 변경**: 신규 주석은 모두 비직관적 수정(durable input, category→type)의 근거 설명으로 적절. 언어 불일치는 round 2 커밋에서 해소됨.
7. **임포트 변경**: `workflows.service.ts` 의 `validateTriggerParameterSchema`/`toTriggerParameterErrorDetails`, `trigger-configs.tsx` 의 `cn` 모두 실사용, 불필요한 임포트 없음.
8. **설정 변경**: `package.json`/`tsconfig`/eslint 등 설정 파일 변경 없음.

## 요약

최종 diff(35개 파일)는 plan `manual-trigger-default-param.md` 가 기술한 3지점 방어 수정((c) 엔진 재진입 durable input, (b) 트리거 노드 type 기반 조회)과 그에 부수된 hardening(② 저장 시점 스키마 검증, ③ 프론트 인라인 이름 검증), 대응 테스트/i18n/CHANGELOG/plan 문서, 그리고 정규 워크플로 산출물(review/code, review/consistency)로 범위가 명확히 일치한다. 이전 라운드에서 지적된 유일한 CRITICAL(프론트 즉시 store 커밋의 spec ED-SP-05 위반)은 완전히 원복되어 현재 diff 에 흔적이 남아 있지 않음을 `git diff --stat` 으로 직접 확인했다. 남은 스코프 이슈는 `workflows.service.ts` 의 무관한 타입 단언 제거 1건(위험 없음, 문서화 안 됨)과 `schedule-runner.service.spec.ts` 의 무관한 포맷팅 1건(위험 없음, 커밋 메시지에 사유 명시됨) 뿐이며 둘 다 기능적 영향이 없고 머지를 막을 수준이 아니다.

## 위험도

LOW
